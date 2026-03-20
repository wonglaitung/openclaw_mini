import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { auditToolCallBasic } from "../logging/audit.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("shell");

/**
 * Test if PowerShell can execute a simple command
 */
function testPowerShellExecution(pwshPath: string): boolean {
  try {
    // Test if PowerShell can execute a simple command
    const result = spawn(pwshPath, ["-NoProfile", "-NonInteractive", "-Command", "1"], {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    return result.spawnfile !== undefined;
  } catch {
    return false;
  }
}

/**
 * Check if a shell path is cmd.exe
 */
function isCmdExe(shellPath: string): boolean {
  return shellPath.toLowerCase().endsWith("cmd.exe") || shellPath.toLowerCase().endsWith("cmd");
}

/**
 * Get shell configuration for command execution
 */
export function getShellConfig(): { shell: string; args: string[]; isPowerShell: boolean } {
  if (process.platform === "win32") {
    const shellPath = resolvePowerShellPath();
    const isPowerShell = !isCmdExe(shellPath);

    if (!isPowerShell) {
      // Using cmd.exe as fallback
      log.warn(
        `Using cmd.exe (${shellPath}) instead of PowerShell. Command syntax limitations apply (no && chaining, different env var syntax).`,
      );

      // Log shell fallback to audit log if available
      try {
        auditToolCallBasic({
          toolName: "shell_fallback",
          params: {
            shellUsed: "cmd.exe",
            reason: "PowerShell unavailable or disabled",
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Ignore audit log errors
      }

      return {
        shell: shellPath,
        args: ["/c"],
        isPowerShell: false,
      };
    }

    // Use PowerShell
    return {
      shell: shellPath,
      args: ["-NoProfile", "-NonInteractive", "-Command"],
      isPowerShell: true,
    };
  }

  const envShell = process.env.SHELL?.trim();
  const shellName = envShell ? path.basename(envShell) : "";
  // Fish rejects common bashisms used by tools, so prefer bash when detected.
  if (shellName === "fish") {
    const bash = resolveShellFromPath("bash");
    if (bash) {
      return { shell: bash, args: ["-c"], isPowerShell: false };
    }
    const sh = resolveShellFromPath("sh");
    if (sh) {
      return { shell: sh, args: ["-c"], isPowerShell: false };
    }
  }
  const shell = envShell && envShell.length > 0 ? envShell : "sh";
  return { shell, args: ["-c"], isPowerShell: false };
}

export function resolvePowerShellPath(): string {
  // Prefer PowerShell 7 when available; PS 5.1 lacks "&&" support.
  const programFiles = process.env.ProgramFiles || process.env.PROGRAMFILES || "C:\\Program Files";
  const pwsh7 = path.join(programFiles, "PowerShell", "7", "pwsh.exe");
  if (fs.existsSync(pwsh7) && testPowerShellExecution(pwsh7)) {
    return pwsh7;
  }

  const programW6432 = process.env.ProgramW6432;
  if (programW6432 && programW6432 !== programFiles) {
    const pwsh7Alt = path.join(programW6432, "PowerShell", "7", "pwsh.exe");
    if (fs.existsSync(pwsh7Alt) && testPowerShellExecution(pwsh7Alt)) {
      return pwsh7Alt;
    }
  }

  const pwshInPath = resolveShellFromPath("pwsh");
  if (pwshInPath && testPowerShellExecution(pwshInPath)) {
    return pwshInPath;
  }

  const systemRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const ps51 = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  if (fs.existsSync(ps51) && testPowerShellExecution(ps51)) {
    return ps51;
  }

  // PowerShell not available or disabled - fallback to cmd.exe
  const cmdPath = path.join(systemRoot, "System32", "cmd.exe");
  if (fs.existsSync(cmdPath)) {
    log.warn(
      "PowerShell not available or disabled, falling back to cmd.exe. Some features may not work correctly.",
    );
    return cmdPath;
  }

  // Last resort
  log.error("Neither PowerShell nor cmd.exe found. Command execution may fail.");
  return "cmd.exe";
}

export function resolveShellFromPath(name: string): string | undefined {
  const envPath = process.env.PATH ?? "";
  if (!envPath) {
    return undefined;
  }
  const entries = envPath.split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // ignore missing or non-executable entries
    }
  }
  return undefined;
}

function normalizeShellName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return path
    .basename(trimmed)
    .replace(/\.(exe|cmd|bat)$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

export function detectRuntimeShell(): string | undefined {
  const overrideShell = process.env.CLAWDBOT_SHELL?.trim();
  if (overrideShell) {
    const name = normalizeShellName(overrideShell);
    if (name) {
      return name;
    }
  }

  if (process.platform === "win32") {
    if (process.env.POWERSHELL_DISTRIBUTION_CHANNEL) {
      return "pwsh";
    }
    return "powershell";
  }

  const envShell = process.env.SHELL?.trim();
  if (envShell) {
    const name = normalizeShellName(envShell);
    if (name) {
      return name;
    }
  }

  if (process.env.POWERSHELL_DISTRIBUTION_CHANNEL) {
    return "pwsh";
  }
  if (process.env.BASH_VERSION) {
    return "bash";
  }
  if (process.env.ZSH_VERSION) {
    return "zsh";
  }
  if (process.env.FISH_VERSION) {
    return "fish";
  }
  if (process.env.KSH_VERSION) {
    return "ksh";
  }
  if (process.env.NU_VERSION || process.env.NUSHELL_VERSION) {
    return "nu";
  }

  return undefined;
}

export function sanitizeBinaryOutput(text: string): string {
  const scrubbed = text.replace(/[\p{Format}\p{Surrogate}]/gu, "");
  if (!scrubbed) {
    return scrubbed;
  }
  const chunks: string[] = [];
  for (const char of scrubbed) {
    const code = char.codePointAt(0);
    if (code == null) {
      continue;
    }
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      chunks.push(char);
      continue;
    }
    if (code < 0x20) {
      continue;
    }
    chunks.push(char);
  }
  return chunks.join("");
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
        stdio: "ignore",
        detached: true,
      });
    } catch {
      // ignore errors if taskkill fails
    }
    return;
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // process already dead
    }
  }
}
