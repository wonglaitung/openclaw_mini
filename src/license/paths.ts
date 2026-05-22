/**
 * License file paths
 */

import { resolve } from "node:path";

/**
 * Default license file path (relative to project root)
 */
export const DEFAULT_LICENSE_PATH = "configs/license.key";

/**
 * Default public key path (relative to project root)
 */
export const DEFAULT_PUBLIC_KEY_PATH = "configs/public.key";

/**
 * Resolve license file path
 */
export function resolveLicensePath(configPath?: string): string {
  return resolve(configPath ?? DEFAULT_LICENSE_PATH);
}

/**
 * Resolve public key file path
 */
export function resolvePublicKeyPath(configPath?: string): string {
  return resolve(configPath ?? DEFAULT_PUBLIC_KEY_PATH);
}
