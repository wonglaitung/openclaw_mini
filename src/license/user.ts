/**
 * Cross-platform username resolution
 */

import os from "node:os";

/**
 * Get current username from environment or os.userInfo()
 * Works on Windows, Linux, and macOS
 */
export function getCurrentUsername(env: NodeJS.ProcessEnv = process.env): string | null {
  if (process.platform === "win32") {
    // Windows: 优先 USERNAME 环境变量
    return env.USERNAME?.trim() || os.userInfo().username?.trim() || null;
  } else {
    // Linux/macOS: 优先 USER 或 LOGNAME 环境变量
    return env.USER?.trim() || env.LOGNAME?.trim() || os.userInfo().username?.trim() || null;
  }
}
