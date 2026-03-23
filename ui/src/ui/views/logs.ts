import { html, nothing } from "lit";
import type { AuditEntry } from "../controllers/logs.ts";
import type { LogEntry, LogLevel } from "../types.ts";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

export type LogsProps = {
  loading: boolean;
  error: string | null;
  file: string | null;
  entries: LogEntry[];
  filterText: string;
  levelFilters: Record<LogLevel, boolean>;
  autoFollow: boolean;
  truncated: boolean;
  logType: "main" | "audit";
  logDate: string | null;
  availableDates: string[];
  onFilterTextChange: (next: string) => void;
  onLevelToggle: (level: LogLevel, enabled: boolean) => void;
  onToggleAutoFollow: (next: boolean) => void;
  onLogTypeChange: (logType: "main" | "audit") => void;
  onLogDateChange: (date: string | null) => void;
  onRefresh: () => void;
  onExport: (lines: string[], label: string) => void;
  onScroll: (event: Event) => void;
};

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}

function parseAuditLogs(entries: LogEntry[]): AuditEntry[] {
  const auditEntries: AuditEntry[] = [];
  for (const entry of entries) {
    try {
      const obj = JSON.parse(entry.raw);
      if (
        obj &&
        typeof obj === "object" &&
        typeof obj.timestamp === "string" &&
        typeof obj.type === "string"
      ) {
        auditEntries.push(obj as AuditEntry);
      }
    } catch {
      // Skip invalid JSON
    }
  }
  return auditEntries;
}

function filterAuditLogs(entries: AuditEntry[], needle: string): AuditEntry[] {
  if (!needle) {
    return entries;
  }
  const lowered = needle.toLowerCase();
  return entries.filter((entry) => {
    const fields = [
      entry.sessionId,
      entry.sessionKey,
      entry.runId,
      entry.agentId,
      entry.type,
      entry.toolName,
      entry.toolCallId,
      entry.action,
      entry.operation,
      entry.operationSummary,
      entry.target,
      entry.status,
      entry.message,
      entry.error,
    ]
      .filter(Boolean)
      .map(String)
      .join(" ")
      .toLowerCase();
    return fields.includes(lowered);
  });
}

function matchesFilter(entry: LogEntry, needle: string) {
  if (!needle) {
    return true;
  }
  const haystack = [entry.message, entry.subsystem, entry.raw]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function renderLogs(props: LogsProps) {
  const needle = props.filterText.trim().toLowerCase();
  const levelFiltered = LEVELS.some((level) => !props.levelFilters[level]);
  let filtered = props.entries.filter((entry) => {
    if (entry.level && !props.levelFilters[entry.level]) {
      return false;
    }
    return matchesFilter(entry, needle);
  });

  let auditEntries: AuditEntry[] | null = null;
  if (props.logType === "audit") {
    auditEntries = filterAuditLogs(parseAuditLogs(filtered), needle);
  }

  const exportLabel = needle || levelFiltered ? "filtered" : "visible";

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Logs</div>
          <div class="card-sub">Gateway file logs (JSONL).</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
          <button
            class="btn"
            ?disabled=${filtered.length === 0}
            @click=${() =>
              props.onExport(
                filtered.map((entry) => entry.raw),
                exportLabel,
              )}
          >
            Export ${exportLabel}
          </button>
        </div>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="min-width: 150px;">
          <span>Log Type</span>
          <select
            .value=${props.logType}
            @change=${(e: Event) => {
              const select = e.target as HTMLSelectElement;
              props.onLogTypeChange(select.value as "main" | "audit");
            }}
          >
            <option value="main">Main Log</option>
            <option value="audit">Audit Log</option>
          </select>
        </label>
        <label class="field" style="min-width: 150px;">
          <span>Date</span>
          <select
            .value=${props.logDate ?? ""}
            @change=${(e: Event) => {
              const select = e.target as HTMLSelectElement;
              props.onLogDateChange(select.value || null);
            }}
          >
            <option value="">Latest</option>
            ${props.availableDates.map(
              (date) => html`
                <option value=${date} ?selected=${props.logDate === date}>${date}</option>
              `,
            )}
          </select>
        </label>
        <label class="field" style="min-width: 220px;">
          <span>Filter</span>
          <input
            .value=${props.filterText}
            @input=${(e: Event) => props.onFilterTextChange((e.target as HTMLInputElement).value)}
            placeholder="Search logs"
          />
        </label>
        <label class="field checkbox">
          <span>Auto-follow</span>
          <input
            type="checkbox"
            .checked=${props.autoFollow}
            @change=${(e: Event) =>
              props.onToggleAutoFollow((e.target as HTMLInputElement).checked)}
          />
        </label>
      </div>

      ${
        props.logType === "main"
          ? html`
        <div class="chip-row" style="margin-top: 12px;">
          ${LEVELS.map(
            (level) => html`
              <label class="chip log-chip ${level}">
                <input
                  type="checkbox"
                  .checked=${props.levelFilters[level]}
                  @change=${(e: Event) =>
                    props.onLevelToggle(level, (e.target as HTMLInputElement).checked)}
                />
                <span>${level}</span>
              </label>
            `,
          )}
        </div>
      `
          : nothing
      }

      ${
        props.file
          ? html`<div class="muted" style="margin-top: 10px;">File: ${props.file}</div>`
          : nothing
      }
      ${
        props.truncated
          ? html`
              <div class="callout" style="margin-top: 10px">Log output truncated; showing latest chunk.</div>
            `
          : nothing
      }
      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 10px;">${props.error}</div>`
          : nothing
      }

      <div class="log-stream" style="margin-top: 12px;" @scroll=${props.onScroll}>
        ${
          props.logType === "audit"
            ? renderAuditLogTable(auditEntries ?? [])
            : renderMainLogEntries(filtered)
        }
      </div>
    </section>
  `;
}

function renderMainLogEntries(entries: LogEntry[]) {
  if (entries.length === 0) {
    return html`
      <div class="muted" style="padding: 12px">No log entries.</div>
    `;
  }

  return entries.map(
    (entry) => html`
      <div class="log-row">
        <div class="log-time mono">${formatTime(entry.time)}</div>
        <div class="log-level ${entry.level ?? ""}">${entry.level ?? ""}</div>
        <div class="log-subsystem mono">${entry.subsystem ?? ""}</div>
        <div class="log-message mono">${entry.message ?? entry.raw}</div>
      </div>
    `,
  );
}

function formatAuditDetails(entry: AuditEntry): string {
  // 优先显示 operationSummary，它通常包含最完整的操作描述
  if (entry.operationSummary) {
    return entry.operationSummary;
  }

  // 如果没有 operationSummary，尝试从 params 中提取关键信息
  if (entry.params) {
    const parts: string[] = [];

    // 对于文件操作工具，显示路径
    if (entry.toolName === "read" && typeof entry.params.path === "string") {
      parts.push(`read: ${entry.params.path}`);
    } else if (entry.toolName === "write" && typeof entry.params.path === "string") {
      parts.push(`write: ${entry.params.path}`);
    } else if (entry.toolName === "edit" && typeof entry.params.path === "string") {
      parts.push(`edit: ${entry.params.path}`);
    } else if (entry.toolName === "apply_patch" && typeof entry.params.path === "string") {
      parts.push(`patch: ${entry.params.path}`);
    } else if (entry.toolName === "bash" && typeof entry.params.command === "string") {
      parts.push(`bash: ${entry.params.command}`);
    } else if (entry.toolName === "grep" && typeof entry.params.pattern === "string") {
      const pathStr = typeof entry.params.path === "string" ? ` in ${entry.params.path}` : "";
      parts.push(`grep: ${entry.params.pattern}${pathStr}`);
    } else if (entry.toolName === "find" && typeof entry.params.pattern === "string") {
      parts.push(`find: ${entry.params.pattern}`);
    }

    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  // 最后显示 message 或 target
  if (entry.message) {
    return entry.message;
  }
  if (entry.error) {
    return `Error: ${entry.error}`;
  }
  if (entry.target) {
    return entry.target;
  }

  return "-";
}

function renderAuditLogTable(entries: AuditEntry[]) {
  if (entries.length === 0) {
    return html`
      <div class="muted" style="padding: 12px">No audit entries.</div>
    `;
  }

  return html`
    <table class="audit-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Agent</th>
          <th>Tool</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(
          (entry) => html`
          <tr>
            <td class="mono">${formatTime(entry.timestamp)}</td>
            <td>${entry.agentId ?? "-"}</td>
            <td>${entry.toolName ?? "-"}</td>
            <td class="status-${entry.status}">${entry.status ?? "-"}</td>
            <td>${entry.duration ? `${entry.duration}ms` : "-"}</td>
            <td class="mono">${formatAuditDetails(entry)}</td>
          </tr>
        `,
        )}
      </tbody>
    </table>
  `;
}
