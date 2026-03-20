/**
 * Audit logging for agent operations
 *
 * Provides structured audit logging for agent tool calls and actions,
 * especially important for security-sensitive environments like banking.
 *
 * Audit logs are separate from main logs and can be controlled independently.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type AuditLevel = "none" | "basic" | "detailed" | "verbose";

export interface AuditConfig {
  /** Enable audit logging */
  enabled: boolean;
  /** Audit log file path (relative to state directory) */
  file?: string;
  /** Audit detail level */
  level: AuditLevel;
}

export interface AuditEntry {
  timestamp: string;
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  type: "tool_call" | "tool_result" | "messaging" | "decision";
  toolName?: string;
  toolCallId?: string;
  action?: string;
  status?: "success" | "error" | "blocked" | "warning";
  message?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

let auditConfig: AuditConfig = {
  enabled: false,
  level: "detailed",
  file: "audit.log",
};

let auditFilePath: string | null = null;
let auditStream: fs.WriteStream | null = null;

/**
 * Set audit logging configuration
 */
export function setAuditConfig(config: Partial<AuditConfig>): void {
  auditConfig = { ...auditConfig, ...config };
  if (auditConfig.enabled) {
    initializeAuditLogger();
  } else {
    shutdownAuditLogger();
  }
}

/**
 * Get current audit configuration
 */
export function getAuditConfig(): AuditConfig {
  return { ...auditConfig };
}

/**
 * Initialize audit logger
 */
function initializeAuditLogger(): void {
  if (!auditConfig.enabled || !auditConfig.file) {
    return;
  }

  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
  auditFilePath = path.join(stateDir, auditConfig.file);

  try {
    // Ensure directory exists
    const dir = path.dirname(auditFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create write stream with append mode
    auditStream = fs.createWriteStream(auditFilePath, { flags: "a", encoding: "utf8" });

    auditStream.on("error", (err) => {
      console.error(`Audit logger error: ${err}`);
    });
  } catch (err) {
    console.error(`Failed to initialize audit logger: ${String(err)}`);
    auditStream = null;
  }
}

/**
 * Shutdown audit logger
 */
function shutdownAuditLogger(): void {
  if (auditStream) {
    auditStream.end();
    auditStream = null;
  }
  auditFilePath = null;
}

/**
 * Write audit entry
 */
export function audit(entry: Omit<AuditEntry, "timestamp">): void {
  if (!auditConfig.enabled || !auditStream) {
    return;
  }

  const auditEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    const line = JSON.stringify(auditEntry) + "\n";
    auditStream.write(line);
  } catch (err) {
    console.error(`Failed to write audit entry: ${String(err)}`);
  }
}

/**
 * Log tool call (basic level)
 */
export function auditToolCallBasic(params: {
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  toolName: string;
  toolCallId?: string;
  params: Record<string, unknown>;
}): void {
  if (auditConfig.level === "none") {
    return;
  }

  audit({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    agentId: params.agentId,
    type: "tool_call",
    toolName: params.toolName,
    toolCallId: params.toolCallId,
    action: "execute",
    status: "success",
    params: auditConfig.level === "verbose" ? params.params : undefined,
  });
}

/**
 * Log tool result (detailed level)
 */
export function auditToolResult(params: {
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  toolName: string;
  toolCallId?: string;
  result?: Record<string, unknown>;
  error?: string;
  duration?: number;
}): void {
  if (auditConfig.level === "none" || auditConfig.level === "basic") {
    return;
  }

  audit({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    agentId: params.agentId,
    type: "tool_result",
    toolName: params.toolName,
    toolCallId: params.toolCallId,
    status: params.error ? "error" : "success",
    message: params.error,
    result: auditConfig.level === "verbose" ? params.result : undefined,
    duration: params.duration,
  });
}

/**
 * Log tool blocked by security policy
 */
export function auditToolBlocked(params: {
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  toolName: string;
  toolCallId?: string;
  reason: string;
  params?: Record<string, unknown>;
}): void {
  audit({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    agentId: params.agentId,
    type: "decision",
    toolName: params.toolName,
    toolCallId: params.toolCallId,
    action: "block",
    status: "blocked",
    message: params.reason,
    params: auditConfig.level === "verbose" ? params.params : undefined,
  });
}

/**
 * Log messaging action (e.g., sending a message to a channel)
 */
export function auditMessaging(params: {
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  channel?: string;
  target?: string;
  action: "send" | "reply" | "forward";
  status?: "success" | "error";
  message?: string;
}): void {
  if (auditConfig.level === "none" || auditConfig.level === "basic") {
    return;
  }

  audit({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    agentId: params.agentId,
    type: "messaging",
    action: params.action,
    status: params.status || "success",
    message: params.message,
    metadata: {
      channel: params.channel,
      target: params.target,
    },
  });
}

/**
 * Shutdown audit logger on process exit
 */
process.on("exit", () => {
  shutdownAuditLogger();
});

process.on("SIGINT", () => {
  shutdownAuditLogger();
});

process.on("SIGTERM", () => {
  shutdownAuditLogger();
});
