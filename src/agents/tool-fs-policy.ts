import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentConfig } from "./agent-scope.js";

export type ToolFsPolicy = {
  workspaceOnly: boolean;
  allowedDirectories?: string[];
};

export function createToolFsPolicy(params: {
  workspaceOnly?: boolean;
  allowedDirectories?: string[];
}): ToolFsPolicy {
  return {
    workspaceOnly: params.workspaceOnly === true,
    allowedDirectories: params.allowedDirectories,
  };
}

export function resolveToolFsConfig(params: { cfg?: OpenClawConfig; agentId?: string }): {
  workspaceOnly?: boolean;
  allowedDirectories?: string[];
} {
  const cfg = params.cfg;
  const globalFs = cfg?.tools?.fs;
  const agentFs =
    cfg && params.agentId ? resolveAgentConfig(cfg, params.agentId)?.tools?.fs : undefined;
  return {
    workspaceOnly: agentFs?.workspaceOnly ?? globalFs?.workspaceOnly,
    allowedDirectories: agentFs?.allowedDirectories ?? globalFs?.allowedDirectories,
  };
}

export function resolveEffectiveToolFsWorkspaceOnly(params: {
  cfg?: OpenClawConfig;
  agentId?: string;
}): boolean {
  return resolveToolFsConfig(params).workspaceOnly === true;
}

/**
 * 解析有效的允许目录列表
 * @returns 如果配置了 allowedDirectories 则返回解析后的绝对路径数组，否则返回 null
 */
export function resolveEffectiveAllowedDirectories(params: {
  cfg?: OpenClawConfig;
  agentId?: string;
  workspaceRoot?: string;
}): string[] | null {
  const config = resolveToolFsConfig(params);
  if (!config.allowedDirectories || config.allowedDirectories.length === 0) {
    return null;
  }

  const path = require("path") as typeof import("path");
  const workspaceRoot = params.workspaceRoot || process.cwd();

  // 将相对路径转换为绝对路径
  return config.allowedDirectories.map((dir) => {
    if (path.isAbsolute(dir)) {
      return path.normalize(dir);
    }
    // 相对路径相对于 workspace 根目录
    return path.normalize(path.resolve(workspaceRoot, dir));
  });
}

/**
 * 检查路径是否在允许的目录列表中
 * @param targetPath 要检查的目标路径
 * @param allowedDirectories 允许的目录列表（绝对路径或相对路径）
 * @returns 如果路径在允许列表中返回 true，否则返回 false
 */
export function isPathInAllowedDirectories(
  targetPath: string,
  allowedDirectories: string[],
): boolean {
  const path = require("path") as typeof import("path");
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  return allowedDirectories.some((allowedDir) => {
    // 将 allowedDir 也转换为绝对路径并规范化，移除 trailing slashes
    const normalizedAllowed = path.normalize(path.resolve(allowedDir)).replace(/[/\\]+$/, "");
    // 检查目标路径是否等于允许目录或是其子目录
    return (
      normalizedTarget === normalizedAllowed ||
      normalizedTarget.startsWith(normalizedAllowed + path.sep)
    );
  });
}
