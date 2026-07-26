import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LOG_DIR = path.join(os.homedir(), ".alexandria");
const LOG_FILE = path.join(LOG_DIR, "context.log");

function logEntry(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n",
    );
  } catch {
    // Logging must never throw
  }
}

export interface ContextObservation {
  id: number;
  type: string;
  title: string;
  narrative: string;
  facts: string[];
  files_modified: string[];
  files_read: string[];
  created_at: string;
}

export interface ContextStoreState {
  observations: ContextObservation[];
  lastSummary: string | null;
  recentPrompts: string[];
  lastObservationId: number;
}

const OBS_TYPE_LABELS: Record<string, string> = {
  bugfix: "[BUGFIX]",
  feature: "[FEATURE]",
  refactor: "[REFACTOR]",
  change: "[CHANGE]",
  discovery: "[DISCOVERY]",
  decision: "[DECISION]",
  learning: "[LEARNING]",
};

export class ContextStore {
  private sessions = new Map<string, ContextStoreState>();

  private initState(): ContextStoreState {
    return {
      observations: [],
      lastSummary: null,
      recentPrompts: [],
      lastObservationId: 0,
    };
  }

  /**
   * Fetch incremental context from the server, merge into the session's store,
   * and return the full rendered markdown for hookSpecificOutput.
   * Returns null on failure or empty response.
   */
  async refresh(
    configUrl: string,
    apiKey: string | undefined,
    sessionId: string,
    projects: string[],
    platform: string,
  ): Promise<string | null> {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, this.initState());
    }
    const state = this.sessions.get(sessionId)!;

    const sinceId = state.lastObservationId;
    logEntry({ session_id: sessionId, event: "refresh", projects, since: sinceId });

    const resp = await fetch(`${configUrl}/api/context-since`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        projects,
        platform,
        since_observation_id: sinceId,
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) {
      logEntry({ session_id: sessionId, event: "fetch_failed", status: resp.status });
      return null;
    }

    const data = await resp.json() as {
      observations: ContextObservation[];
      last_summary: string | null;
      recent_prompts: string[];
      new_since_id: number;
    };

    if (state.lastObservationId === 0) {
      // Full replace — session start
      logEntry({
        session_id: sessionId,
        event: "full_fetch",
        observation_count: data.observations.length,
        has_summary: !!data.last_summary,
        prompt_count: data.recent_prompts.length,
        new_since: data.new_since_id,
      });
      state.observations = data.observations;
      state.lastSummary = data.last_summary;
      state.recentPrompts = data.recent_prompts;
    } else {
      // Merge incremental
      if (data.observations.length > 0) {
        logEntry({
          session_id: sessionId,
          event: "incremental",
          new_observations: data.observations.length,
          new_since: data.new_since_id,
        });
        state.observations.push(...data.observations);
      }
      if (data.last_summary) state.lastSummary = data.last_summary;
      if (data.recent_prompts.length > 0) {
        const existing = new Set(state.recentPrompts);
        for (const p of data.recent_prompts) {
          if (!existing.has(p)) state.recentPrompts.push(p);
        }
      }
    }
    state.lastObservationId = data.new_since_id;

    return this.renderMarkdown(state);
  }

  private renderMarkdown(state: ContextStoreState): string {
    const parts: string[] = [];

    const byDate = new Map<string, ContextObservation[]>();
    for (const obs of state.observations) {
      const date = obs.created_at.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(obs);
    }

    parts.push("<alexandria-context>");

    for (const [date, obsList] of byDate) {
      parts.push(`### ${date}`);
      const byFile = new Map<string, ContextObservation[]>();
      for (const obs of obsList) {
        const file = (obs.files_modified?.[0] || obs.files_read?.[0] || "General");
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file)!.push(obs);
      }
      for (const [file, fileObs] of byFile) {
        parts.push(`**${file}**`);
        for (const obs of fileObs) {
          const label = OBS_TYPE_LABELS[obs.type] || "[OBS]";
          parts.push(`  ${label} ${obs.title}: ${obs.narrative}`);
        }
      }
    }

    if (state.recentPrompts.length > 0) {
      parts.push("");
      parts.push("<recent-prompts>");
      for (const p of state.recentPrompts.slice(0, 3)) {
        parts.push(`- ${p}`);
      }
      parts.push("</recent-prompts>");
    }

    if (state.lastSummary) {
      parts.push("");
      parts.push("<last-summary>");
      parts.push(state.lastSummary);
      parts.push("</last-summary>");
    }

    parts.push("</alexandria-context>");
    return parts.join("\n");
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clearAll(): void {
    this.sessions.clear();
  }
}
