import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  isPathInAllowedDirectories,
  resolveEffectiveAllowedDirectories,
  resolveToolFsConfig,
} from "./tool-fs-policy.js";

describe("isPathInAllowedDirectories", () => {
  it("should return true when path matches an allowed directory exactly", () => {
    const allowed = ["/data/project-a", "/data/project-b"];
    expect(isPathInAllowedDirectories("/data/project-a", allowed)).toBe(true);
    expect(isPathInAllowedDirectories("/data/project-b", allowed)).toBe(true);
  });

  it("should return true when path is a subdirectory of an allowed directory", () => {
    const allowed = ["/data/project-a", "/data/project-b"];
    expect(isPathInAllowedDirectories("/data/project-a/src", allowed)).toBe(true);
    expect(isPathInAllowedDirectories("/data/project-a/src/utils", allowed)).toBe(true);
    expect(isPathInAllowedDirectories("/data/project-b/tests", allowed)).toBe(true);
  });

  it("should return false when path is not in any allowed directory", () => {
    const allowed = ["/data/project-a", "/data/project-b"];
    expect(isPathInAllowedDirectories("/etc/passwd", allowed)).toBe(false);
    expect(isPathInAllowedDirectories("/tmp/file.txt", allowed)).toBe(false);
    expect(isPathInAllowedDirectories("/home/user/file.txt", allowed)).toBe(false);
  });

  it("should handle paths with trailing slashes", () => {
    const allowed = ["/data/project-a/", "/data/project-b/"];
    expect(isPathInAllowedDirectories("/data/project-a", allowed)).toBe(true);
    expect(isPathInAllowedDirectories("/data/project-a/src", allowed)).toBe(true);
  });

  it("should handle relative paths correctly", () => {
    // 相对路径会被解析为绝对路径
    const allowed = ["./project-a", "../project-b"];
    // 测试路径也会被解析
    const testPath1 = path.resolve("./project-a/src");
    const testPath2 = path.resolve("../project-b/tests");

    // 验证解析后的路径
    expect(isPathInAllowedDirectories(testPath1, allowed)).toBe(true);
    expect(isPathInAllowedDirectories(testPath2, allowed)).toBe(true);
    expect(isPathInAllowedDirectories("/other/path", allowed)).toBe(false);
  });

  it("should handle empty allowedDirectories list", () => {
    expect(isPathInAllowedDirectories("/any/path", [])).toBe(false);
  });

  it("should handle path normalization", () => {
    const allowed = ["/data/project-a"];
    expect(isPathInAllowedDirectories("/data/./project-a", allowed)).toBe(true);
    expect(isPathInAllowedDirectories("/data/project-a/../project-a/src", allowed)).toBe(true);
  });

  it("should not match partial directory names", () => {
    const allowed = ["/data/project"];
    expect(isPathInAllowedDirectories("/data/project-a", allowed)).toBe(false);
    expect(isPathInAllowedDirectories("/data/projects", allowed)).toBe(false);
    expect(isPathInAllowedDirectories("/data/myproject", allowed)).toBe(false);
  });
});

describe("resolveEffectiveAllowedDirectories", () => {
  it("should return null when allowedDirectories is not configured", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: true } },
    };
    expect(resolveEffectiveAllowedDirectories({ cfg })).toBe(null);
  });

  it("should return null when allowedDirectories is empty", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: [] } },
    };
    expect(resolveEffectiveAllowedDirectories({ cfg })).toBe(null);
  });

  it("should resolve absolute paths", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["/data/a", "/data/b"] } },
    };
    const result = resolveEffectiveAllowedDirectories({ cfg });
    expect(result).toEqual(["/data/a", "/data/b"]);
  });

  it("should resolve relative paths against workspace root", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["./relative-a", "relative-b"] } },
    };
    const workspaceRoot = "/workspace";
    const result = resolveEffectiveAllowedDirectories({ cfg, workspaceRoot });
    expect(result).toContain(path.resolve(workspaceRoot, "relative-a"));
    expect(result).toContain(path.resolve(workspaceRoot, "relative-b"));
  });

  it("should normalize paths", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["/data/./a", "/data/b/../a"] } },
    };
    const result = resolveEffectiveAllowedDirectories({ cfg });
    expect(result).toContain(path.normalize("/data/./a"));
    expect(result).toContain(path.normalize("/data/b/../a"));
  });

  it("should prefer agent-specific allowedDirectories over global", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["/global"] } },
      agents: {
        list: [
          {
            id: "agent1",
            tools: {
              fs: { workspaceOnly: false, allowedDirectories: ["/agent-specific"] },
            },
          },
        ],
      },
    };
    const result = resolveEffectiveAllowedDirectories({ cfg, agentId: "agent1" });
    expect(result).toEqual(["/agent-specific"]);
  });

  it("should use global allowedDirectories when agent has no override", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["/global"] } },
      agents: {
        list: [
          {
            id: "agent1",
            tools: {
              fs: { workspaceOnly: false },
            },
          },
        ],
      },
    };
    const result = resolveEffectiveAllowedDirectories({ cfg, agentId: "agent1" });
    expect(result).toEqual(["/global"]);
  });
});

describe("resolveToolFsConfig", () => {
  it("should resolve allowedDirectories from global config", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["/a", "/b"] } },
    };
    const result = resolveToolFsConfig({ cfg, agentId: "main" });
    expect(result.allowedDirectories).toEqual(["/a", "/b"]);
  });

  it("should resolve allowedDirectories from agent-specific config", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: false, allowedDirectories: ["/global"] } },
      agents: {
        list: [
          {
            id: "agent1",
            tools: {
              fs: { workspaceOnly: false, allowedDirectories: ["/agent"] },
            },
          },
        ],
      },
    };
    const result = resolveToolFsConfig({ cfg, agentId: "agent1" });
    expect(result.allowedDirectories).toEqual(["/agent"]);
  });

  it("should return undefined when allowedDirectories is not configured", () => {
    const cfg: OpenClawConfig = {
      tools: { fs: { workspaceOnly: true } },
    };
    const result = resolveToolFsConfig({ cfg, agentId: "main" });
    expect(result.allowedDirectories).toBeUndefined();
  });
});
