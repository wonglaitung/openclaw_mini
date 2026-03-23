import fs from "node:fs/promises";
import path from "node:path";
import { getResolvedLoggerSettings } from "../../logging.js";
import { clamp } from "../../utils.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateLogsTailParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_BYTES = 250_000;
const MAX_LIMIT = 5000;
const MAX_BYTES = 1_000_000;
const ROLLING_LOG_RE = /^openclaw-\d{4}-\d{2}-\d{2}\.log$/;
const AUDIT_LOG_RE = /^audit-\d{4}-\d{2}-\d{2}\.log$/;

function isRollingLogFile(file: string): boolean {
  return ROLLING_LOG_RE.test(path.basename(file));
}

async function resolveLogFile(file: string): Promise<string> {
  const stat = await fs.stat(file).catch(() => null);
  if (stat) {
    return file;
  }
  if (!isRollingLogFile(file)) {
    return file;
  }

  const dir = path.dirname(file);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return file;
  }

  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && ROLLING_LOG_RE.test(entry.name))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const fileStat = await fs.stat(fullPath).catch(() => null);
        return fileStat ? { path: fullPath, mtimeMs: fileStat.mtimeMs } : null;
      }),
  );
  const sorted = candidates
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
  return sorted[0]?.path ?? file;
}

async function resolveLogFileByDate(dateStr: string, logType: "main" | "audit"): Promise<string> {
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
  let logsDir: string;

  if (logType === "audit") {
    logsDir = path.join(stateDir, "logs");
  } else {
    logsDir = path.dirname(getResolvedLoggerSettings().file);
  }

  const entries = await fs.readdir(logsDir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return "";
  }

  const targetName = logType === "audit" ? `audit-${dateStr}.log` : `openclaw-${dateStr}.log`;

  for (const entry of entries) {
    if (entry.isFile() && entry.name === targetName) {
      return path.join(logsDir, entry.name);
    }
  }

  return "";
}

async function getAvailableLogDates(logType: "main" | "audit"): Promise<string[]> {
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
  let logsDir: string;

  if (logType === "audit") {
    logsDir = path.join(stateDir, "logs");
  } else {
    logsDir = path.dirname(getResolvedLoggerSettings().file);
  }

  const entries = await fs.readdir(logsDir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return [];
  }

  const pattern = logType === "audit" ? AUDIT_LOG_RE : ROLLING_LOG_RE;
  const dates: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && pattern.test(entry.name)) {
      const match = entry.name.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        dates.push(match[0]);
      }
    }
  }

  return dates.toSorted().toReversed();
}

async function resolveAuditLogFile(basePath: string): Promise<string> {
  // Get audit log directory and pattern
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
  const logsDir = path.join(stateDir, "logs");

  // Try to find the most recent audit log file
  const entries = await fs.readdir(logsDir, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return basePath;
  }

  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && AUDIT_LOG_RE.test(entry.name))
      .map(async (entry) => {
        const fullPath = path.join(logsDir, entry.name);
        const fileStat = await fs.stat(fullPath).catch(() => null);
        return fileStat ? { path: fullPath, mtimeMs: fileStat.mtimeMs } : null;
      }),
  );
  const sorted = candidates
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
  return sorted[0]?.path ?? basePath;
}

async function readLogSlice(params: {
  file: string;
  cursor?: number;
  limit: number;
  maxBytes: number;
}) {
  const stat = await fs.stat(params.file).catch(() => null);
  if (!stat) {
    return {
      cursor: 0,
      size: 0,
      lines: [] as string[],
      truncated: false,
      reset: false,
    };
  }

  const size = stat.size;
  const maxBytes = clamp(params.maxBytes, 1, MAX_BYTES);
  const limit = clamp(params.limit, 1, MAX_LIMIT);
  let cursor =
    typeof params.cursor === "number" && Number.isFinite(params.cursor)
      ? Math.max(0, Math.floor(params.cursor))
      : undefined;
  let reset = false;
  let truncated = false;
  let start = 0;

  if (cursor != null) {
    if (cursor > size) {
      reset = true;
      start = Math.max(0, size - maxBytes);
      truncated = start > 0;
    } else {
      start = cursor;
      if (size - start > maxBytes) {
        reset = true;
        truncated = true;
        start = Math.max(0, size - maxBytes);
      }
    }
  } else {
    start = Math.max(0, size - maxBytes);
    truncated = start > 0;
  }

  if (size === 0 || size <= start) {
    return {
      cursor: size,
      size,
      lines: [] as string[],
      truncated,
      reset,
    };
  }

  const handle = await fs.open(params.file, "r");
  try {
    let prefix = "";
    if (start > 0) {
      const prefixBuf = Buffer.alloc(1);
      const prefixRead = await handle.read(prefixBuf, 0, 1, start - 1);
      prefix = prefixBuf.toString("utf8", 0, prefixRead.bytesRead);
    }

    const length = Math.max(0, size - start);
    const buffer = Buffer.alloc(length);
    const readResult = await handle.read(buffer, 0, length, start);
    const text = buffer.toString("utf8", 0, readResult.bytesRead);
    let lines = text.split("\n");
    if (start > 0 && prefix !== "\n") {
      lines = lines.slice(1);
    }
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines = lines.slice(0, -1);
    }
    if (lines.length > limit) {
      lines = lines.slice(lines.length - limit);
    }

    cursor = size;

    return {
      cursor,
      size,
      lines,
      truncated,
      reset,
    };
  } finally {
    await handle.close();
  }
}

export const logsHandlers: GatewayRequestHandlers = {
  "logs.tail": async ({ params, respond }) => {
    if (!validateLogsTailParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid logs.tail params: ${formatValidationErrors(validateLogsTailParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      cursor?: number;
      limit?: number;
      maxBytes?: number;
      logType?: "main" | "audit";
      date?: string;
    };
    const logType = p.logType ?? "main";

    try {
      let file: string;
      if (p.date) {
        // Resolve log file by specific date
        file = await resolveLogFileByDate(p.date, logType);
        if (!file) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.UNAVAILABLE, `log file not found for date: ${p.date}`),
          );
          return;
        }
      } else {
        // Default: get the most recent log file
        if (logType === "audit") {
          file = await resolveAuditLogFile("");
        } else {
          const configuredFile = getResolvedLoggerSettings().file;
          file = await resolveLogFile(configuredFile);
        }
      }

      const result = await readLogSlice({
        file,
        cursor: p.cursor,
        limit: p.limit ?? DEFAULT_LIMIT,
        maxBytes: p.maxBytes ?? DEFAULT_MAX_BYTES,
      });
      respond(true, { file, ...result }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `log read failed: ${String(err)}`),
      );
    }
  },

  "logs.availableDates": async ({ params, respond }) => {
    try {
      const logType = (params?.logType as "main" | "audit") ?? "audit";
      const dates = await getAvailableLogDates(logType);
      respond(true, { dates }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to get available dates: ${String(err)}`),
      );
    }
  },
};
