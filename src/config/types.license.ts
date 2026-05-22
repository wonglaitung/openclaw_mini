/**
 * License configuration types
 */

/**
 * Gateway license configuration
 */
export type GatewayLicenseConfig = {
  /** Enable license validation (default: false) */
  enabled?: boolean;
  /** Grace period in hours after license expires (default: 24) */
  gracePeriodHours?: number;
  /** Hours before expiry to show renewal warning (default: 72) */
  renewalWarningHours?: number;
};
