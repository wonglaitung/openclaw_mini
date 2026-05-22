/**
 * License validation module
 */

import { readFileSync, existsSync } from "node:fs";
import { verifyLicenseSignature, validateLicensePayload } from "./crypto.js";
import { resolveLicensePath, resolvePublicKeyPath } from "./paths.js";
import type { SignedLicense, LicenseValidationResult, LicenseValidationOptions } from "./types.js";
import { getCurrentUsername } from "./user.js";

/**
 * Validate license file
 */
export function validateLicense(
  options?: LicenseValidationOptions & {
    licensePath?: string;
    publicKeyPath?: string;
  },
): LicenseValidationResult {
  const licensePath = resolveLicensePath(options?.licensePath);
  const publicKeyPath = resolvePublicKeyPath(options?.publicKeyPath);

  // Check if license file exists
  if (!existsSync(licensePath)) {
    return {
      valid: false,
      reason: `License file not found: ${licensePath}`,
    };
  }

  // Check if public key file exists
  if (!existsSync(publicKeyPath)) {
    return {
      valid: false,
      reason: `Public key file not found: ${publicKeyPath}`,
    };
  }

  // Read and parse license file
  let signedLicense: SignedLicense;
  try {
    const licenseContent = readFileSync(licensePath, "utf8");
    signedLicense = JSON.parse(licenseContent) as SignedLicense;
  } catch (error) {
    return {
      valid: false,
      reason: `Failed to parse license file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Read public key
  let publicKey: string;
  try {
    publicKey = readFileSync(publicKeyPath, "utf8");
  } catch (error) {
    return {
      valid: false,
      reason: `Failed to read public key: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Verify signature
  if (!verifyLicenseSignature(signedLicense, publicKey)) {
    return {
      valid: false,
      reason: "License signature verification failed (license may have been tampered with)",
    };
  }

  // Get expected username
  const expectedUsername = options?.expectedUsername ?? getCurrentUsername() ?? undefined;

  // Validate payload
  const payloadResult = validateLicensePayload(signedLicense.payload, {
    expectedUsername,
    gracePeriodHours: options?.gracePeriodHours,
  });

  if (!payloadResult.valid) {
    return {
      valid: false,
      reason: payloadResult.reason,
      payload: signedLicense.payload,
    };
  }

  // Format expiresAt to local time
  const expiresAtLocal = new Date(signedLicense.payload.expiresAt).toLocaleString();

  return {
    valid: true,
    payload: signedLicense.payload,
    inGracePeriod: payloadResult.inGracePeriod,
    graceHoursRemaining: payloadResult.graceHoursRemaining,
    reason: payloadResult.reason,
    expiresAtLocal,
  };
}

// Re-export types
export * from "./types.js";
export * from "./crypto.js";
export * from "./user.js";
export * from "./paths.js";
