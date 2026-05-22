/**
 * License signature verification using RSA-SHA256
 */

import { createVerify } from "node:crypto";
import type { LicensePayload, SignedLicense } from "./types.js";

/**
 * Verify license signature using public key
 */
export function verifyLicenseSignature(signedLicense: SignedLicense, publicKey: string): boolean {
  try {
    const verifier = createVerify("SHA256");
    verifier.update(JSON.stringify(signedLicense.payload));
    verifier.end();
    return verifier.verify(publicKey, signedLicense.signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Validate license payload content
 */
export function validateLicensePayload(
  payload: LicensePayload,
  options?: {
    expectedUsername?: string;
    gracePeriodHours?: number;
  },
): {
  valid: boolean;
  reason?: string;
  inGracePeriod?: boolean;
  graceHoursRemaining?: number;
} {
  const now = new Date();
  const expiresAt = new Date(payload.expiresAt);
  const gracePeriodHours = options?.gracePeriodHours ?? 24;

  // Check username match
  if (options?.expectedUsername && payload.username !== options.expectedUsername) {
    return {
      valid: false,
      reason: `Username mismatch: expected ${options.expectedUsername}, got ${payload.username}`,
    };
  }

  // Check expiration
  if (now > expiresAt) {
    // Check if in grace period
    const graceEnd = new Date(expiresAt.getTime() + gracePeriodHours * 60 * 60 * 1000);
    if (now <= graceEnd) {
      const graceHoursRemaining = (graceEnd.getTime() - now.getTime()) / (60 * 60 * 1000);
      return {
        valid: true,
        reason: `License expired at ${payload.expiresAt}, in grace period`,
        inGracePeriod: true,
        graceHoursRemaining: Math.round(graceHoursRemaining * 10) / 10,
      };
    }
    return {
      valid: false,
      reason: `License expired at ${payload.expiresAt} and grace period (${gracePeriodHours}h) exceeded`,
    };
  }

  return { valid: true };
}
