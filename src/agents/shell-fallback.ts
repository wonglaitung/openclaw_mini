/**
 * Windows shell compatibility helpers
 *
 * Provides automatic fallback from PowerShell to cmd.exe when PowerShell is disabled or unavailable.
 * Handles command translation between PowerShell and cmd.exe syntax.
 */

import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { auditToolCallBasic, getAuditConfig } from "../logging/audit.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveShellFromPath } from "./shell-utils.js";

const log = createSubsystemLogger("shell");

export type ShellKind = "powershell" | "cmd" | "bash" | "sh" | "unknown";
export type ShellConfig = {
  shell: string;
  args: string[];
  kind: ShellKind;
  isPowerShell: boolean;
};

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
 * Detect if a shell path is cmd.exe
 */
function isCmdExe(shellPath: string): boolean {
  return shellPath.toLowerCase().endsWith("cmd.exe") || shellPath.toLowerCase().endsWith("cmd");
}

/**
 * Detect shell kind from path
 */
export function detectShellKind(shellPath: string): ShellKind {
  const lowerPath = shellPath.toLowerCase();
  if (lowerPath.includes("powershell") || lowerPath.includes("pwsh")) {
    return "powershell";
  }
  if (lowerPath.endsWith("cmd.exe") || lowerPath.endsWith("cmd")) {
    return "cmd";
  }
  if (lowerPath.includes("bash")) {
    return "bash";
  }
  if (lowerPath.includes("/sh")) {
    return "sh";
  }
  return "unknown";
}

/**
 * Get shell configuration for command execution
 */
export function getShellConfig(): ShellConfig {
  if (process.platform === "win32") {
    const shellPath = resolvePowerShellPath();
    const isPowerShell = !isCmdExe(shellPath);
    const kind = detectShellKind(shellPath);

    if (!isPowerShell) {
      // Using cmd.exe as fallback
      log.warn(
        `Using ${kind} (${shellPath}) instead of PowerShell. Command syntax limitations apply.`,
      );
      return {
        shell: shellPath,
        args: ["/c"],
        kind,
        isPowerShell: false,
      };
    }

    // Use PowerShell
    return {
      shell: shellPath,
      args: ["-NoProfile", "-NonInteractive", "-Command"],
      kind,
      isPowerShell: true,
    };
  }

  const envShell = process.env.SHELL?.trim();
  const shellName = envShell ? path.basename(envShell) : "";
  // Fish rejects common bashisms used by tools, so prefer bash when detected.
  if (shellName === "fish") {
    const bash = resolveShellFromPath("bash");
    if (bash) {
      return { shell: bash, args: ["-c"], kind: "bash", isPowerShell: false };
    }
    const sh = resolveShellFromPath("sh");
    if (sh) {
      return { shell: sh, args: ["c"], kind: "sh", isPowerShell: false };
    }
  }
  const shell = envShell && envShell.length > 0 ? envShell : "sh";
  return { shell, args: ["-c"], kind: "unknown", isPowerShell: false };
}

/**
 * Translate PowerShell command to cmd.exe syntax
 * Handles common PowerShell patterns that don't work in cmd.exe
 */
export function translatePowerShellToCmd(command: string): {
  translated: string;
  needsTranslation: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let translated = command;
  let needsTranslation = false;

  // PowerShell uses && for chaining, cmd.exe uses &
  if (command.includes(" && ")) {
    warnings.push("PowerShell '&&' command chaining translated to '&' (cmd.exe limitation)");
    translated = translated.replace(/ && /g, " & ");
    needsTranslation = true;
  }

  // PowerShell uses ; for statement separation, cmd.exe uses & as well
  if (command.includes("; ")) {
    warnings.push("PowerShell ';' statement separation translated to '&'");
    translated = translated.replace(/; /g, " & ");
    needsTranslation = true;
  }

  // PowerShell uses $env:VAR for env vars, cmd.exe uses %VAR%
  const envVarPattern = /\$env:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  if (envVarPattern.test(translated)) {
    warnings.push("PowerShell env vars ($env:VAR) translated to cmd.exe format (%VAR%)");
    translated = translated.replace(envVarPattern, (match, p1) => `%${p1}%`);
    needsTranslation = true;
  }

  // PowerShell uses backtick for line continuation, cmd.exe uses ^
  if (translated.includes("`")) {
    warnings.push("PowerShell backtick line continuation translated to '^'");
    translated = translated.replace(/`/g, "^");
    needsTranslation = true;
  }

  // PowerShell uses $null for null output, cmd.exe uses >nul
  if (translated.includes("$null")) {
    warnings.push("PowerShell $null output redirection translated to >nul");
    translated = translated.replace(/\$null/g, ">nul");
    needsTranslation = true;
  }

  // PowerShell uses Write-Host for output
  if (translated.includes("Write-Host")) {
    warnings.push("PowerShell Write-Host removed (cmd.exe limitation)");
    translated = translated.replace(/Write-Host\s+/g, "echo ");
    needsTranslation = true;
  }

  return { translated, needsTranslation, warnings };
}

/**
 * Execute command with automatic shell detection and fallback
 */
export function executeCommandWithFallback(
  command: string,
  options?: SpawnOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number | null; shellUsed: ShellKind }> {
  const config = getShellConfig();
  let finalCommand = command;

  // If we're using cmd.exe and the command looks like PowerShell, try to translate
  if (config.kind === "cmd") {
    const { translated, needsTranslation, warnings } = translatePowerShellToCmd(command);
    if (needsTranslation) {
      log.warn(`Command may need translation for cmd.exe: ${warnings.join("; ")}`);
      finalCommand = translated;
    }
  }

  // Log the shell being used
  log.info(`Executing with ${config.kind}: ${finalCommand}`);

  return new Promise((resolve, reject) => {
    const child = spawn(config.shell, [...config.args, finalCommand], options || {});

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code,
        shellUsed: config.kind,
      });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Log shell fallback event to audit log
 */
export function auditShellFallback(
  originalShell: string,
  fallbackShell: string,
  reason: string,
): void {
  try {
    const auditConfig = getAuditConfig();
    if (auditConfig.enabled) {
      auditToolCallBasic({
        toolName: "shell",
        params: {
          originalShell,
          fallbackShell,
          reason,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch {
    // Ignore audit log errors
  }
}
