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
  operation?: string;
  operationSummary?: string;
  target?: string;
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
 * Generate operation summary for audit logging
 * Extracts human-readable description of what was done
 */
function generateOperationSummary(
  toolName: string,
  params: Record<string, unknown>,
): { operation: string; target?: string; summary: string } {
  switch (toolName) {
    case "read": {
      const filePath =
        typeof params.path === "string"
          ? params.path
          : typeof params.file === "string"
            ? params.file
            : "unknown";
      return {
        operation: "read",
        target: filePath,
        summary: `读取文件: ${filePath}`,
      };
    }
    case "write": {
      const filePath = typeof params.path === "string" ? params.path : "unknown";
      return {
        operation: "write",
        target: filePath,
        summary: `写入文件: ${filePath}`,
      };
    }
    case "edit": {
      const filePath = typeof params.path === "string" ? params.path : "unknown";
      const operation = typeof params.operation === "string" ? params.operation : "编辑";
      return {
        operation: "edit",
        target: filePath,
        summary: `编辑文件: ${filePath} (${operation})`,
      };
    }
    case "bash": {
      const command = typeof params.command === "string" ? params.command : "unknown";
      // 提取命令名作为操作类型
      const cmdParts = command.trim().split(/\s+/);
      const cmdName = cmdParts[0] || "bash";
      return {
        operation: cmdName,
        target: typeof params.cwd === "string" ? params.cwd : undefined,
        summary: `执行命令: ${cmdName}${cmdParts.length > 1 ? " " + cmdParts.slice(1).join(" ") : ""}`,
      };
    }
    case "list": {
      const dirPath =
        typeof params.path === "string"
          ? params.path
          : typeof params.dir === "string"
            ? params.dir
            : "unknown";
      return {
        operation: "list",
        target: dirPath,
        summary: `列出目录: ${dirPath}`,
      };
    }
    case "create": {
      const filePath = typeof params.path === "string" ? params.path : "unknown";
      return {
        operation: "create",
        target: filePath,
        summary: `创建文件: ${filePath}`,
      };
    }
    case "delete": {
      const filePath = typeof params.path === "string" ? params.path : "unknown";
      return {
        operation: "delete",
        target: filePath,
        summary: `删除文件: ${filePath}`,
      };
    }
    case "move": {
      const fromPath = typeof params.from === "string" ? params.from : "unknown";
      const toPath = typeof params.to === "string" ? params.to : "unknown";
      return {
        operation: "move",
        target: `${fromPath} -> ${toPath}`,
        summary: `移动文件: ${fromPath} 到 ${toPath}`,
      };
    }
    case "copy": {
      const fromPath = typeof params.from === "string" ? params.from : "unknown";
      const toPath = typeof params.to === "string" ? params.to : "unknown";
      return {
        operation: "copy",
        target: `${fromPath} -> ${toPath}`,
        summary: `复制文件: ${fromPath} 到 ${toPath}`,
      };
    }
    case "search": {
      const query = typeof params.query === "string" ? params.query : "unknown";
      const dirPath =
        typeof params.dir === "string"
          ? params.dir
          : typeof params.path === "string"
            ? params.path
            : "unknown";
      return {
        operation: "search",
        target: dirPath,
        summary: `搜索内容: ${query} (目录: ${dirPath})`,
      };
    }
    default: {
      // 通用处理：尝试提取有意义的参数
      const keys = Object.keys(params);
      const targetKey = keys.find((k) =>
        ["path", "file", "dir", "directory", "url", "target"].includes(k),
      );
      const actionKey = keys.find((k) => ["action", "operation", "command", "query"].includes(k));

      const target = targetKey ? String(params[targetKey]) : undefined;
      const action = actionKey ? String(params[actionKey]) : undefined;

      return {
        operation: toolName,
        target,
        summary: action ? `${toolName}: ${action}` : toolName,
      };
    }
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

  const { operation, target, summary } = generateOperationSummary(params.toolName, params.params);

  audit({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    agentId: params.agentId,
    type: "tool_call",
    toolName: params.toolName,
    toolCallId: params.toolCallId,
    operation,
    operationSummary: summary,
    target,
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

  const { summary } = generateOperationSummary(params.toolName, {});

  audit({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    agentId: params.agentId,
    type: "tool_result",
    toolName: params.toolName,
    toolCallId: params.toolCallId,
    operationSummary: summary,
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
