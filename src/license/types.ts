/**
 * License types for OpenClaw
 */

/**
 * License key payload (签名前)
 */
export type LicensePayload = {
  /** 版本号 */
  version: 1;
  /** 用户名（Windows: USERNAME, Linux: USER 或 os.userInfo().username） */
  username: string;
  /** 签发时间 (ISO 8601) */
  issuedAt: string;
  /** 过期时间 (ISO 8601) */
  expiresAt: string;
};

/**
 * 签名后的 license key
 */
export type SignedLicense = {
  /** 签名算法 */
  algorithm: "rsa-sha256";
  /** License payload */
  payload: LicensePayload;
  /** Base64 编码的签名 */
  signature: string;
};

/**
 * License 验证结果
 */
export type LicenseValidationResult = {
  /** 是否有效 */
  valid: boolean;
  /** 错误原因 */
  reason?: string;
  /** License payload */
  payload?: LicensePayload;
  /** 是否在宽限期内 */
  inGracePeriod?: boolean;
  /** 宽限期剩余小时数 */
  graceHoursRemaining?: number;
  /** 过期时间的本地格式显示 */
  expiresAtLocal?: string;
};

/**
 * License 验证选项
 */
export type LicenseValidationOptions = {
  /** 宽限期（小时，默认 24） */
  gracePeriodHours?: number;
  /** 预期用户名（可选，默认使用当前系统用户名） */
  expectedUsername?: string;
};
