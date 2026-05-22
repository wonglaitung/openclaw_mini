#!/usr/bin/env node
/**
 * License Key Generator for OpenClaw
 *
 * Usage:
 *   node scripts/license-generator.mjs generate-keys --private-output admin/private.key --public-output admin/public.key
 *   node scripts/license-generator.mjs create --username USER --valid-days 30 --private-key admin/private.key --output configs/license.key
 *   node scripts/license-generator.mjs verify --license configs/license.key --public-key configs/public.key
 */

import { generateKeyPairSync, createSign, createVerify } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const ALGORITHM = "rsa-sha256";
const MAX_VALID_DAYS = 180;

function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  return { publicKey, privateKey };
}

function signLicense(payload, privateKey) {
  const signer = createSign("SHA256");
  signer.update(JSON.stringify(payload));
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyLicenseSignature(payload, signature, publicKey) {
  const verifier = createVerify("SHA256");
  verifier.update(JSON.stringify(payload));
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function createLicensePayload(username, validDays) {
  const now = new Date();
  const expires = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

  return {
    version: 1,
    username,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

function validateLicenseContent(licenseData, expectedUsername = null) {
  const now = new Date();
  const expiresAt = new Date(licenseData.expiresAt);

  if (now > expiresAt) {
    return { valid: false, message: `License expired at ${licenseData.expiresAt}` };
  }

  if (expectedUsername && licenseData.username !== expectedUsername) {
    return {
      valid: false,
      message: `Username mismatch: expected ${String(expectedUsername)}, got ${licenseData.username}`,
    };
  }

  return { valid: true, message: "Valid" };
}

function cmdGenerateKeys(args) {
  const { publicKey, privateKey } = generateKeyPair();

  // Save private key
  const privatePath = resolve(args["private-output"]);
  const privateDir = dirname(privatePath);
  if (!existsSync(privateDir)) {
    mkdirSync(privateDir, { recursive: true });
  }
  writeFileSync(privatePath, privateKey);
  if (process.platform !== "win32") {
    chmodSync(privatePath, 0o600);
  }

  // Save public key
  const publicPath = resolve(args["public-output"]);
  const publicDir = dirname(publicPath);
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  writeFileSync(publicPath, publicKey);

  console.log(`Key pair generated:`);
  console.log(`  Private key: ${privatePath} (KEEP SECURE!)`);
  console.log(`  Public key: ${publicPath} (distribute to clients)`);
}

function cmdCreate(args) {
  const validDays = parseInt(args["valid-days"], 10);

  if (validDays > MAX_VALID_DAYS) {
    console.error(`Error: Valid days cannot exceed ${MAX_VALID_DAYS} days (6 months)`);
    console.error(`  Requested: ${validDays} days`);
    console.error(`  Maximum: ${MAX_VALID_DAYS} days`);
    process.exit(1);
  }

  if (validDays <= 0) {
    console.error(`Error: Valid days must be positive`);
    process.exit(1);
  }

  const privateKey = readFileSync(resolve(args["private-key"]), "utf8");
  const payload = createLicensePayload(args.username, validDays);
  const signature = signLicense(payload, privateKey);

  const signedLicense = {
    algorithm: ALGORITHM,
    payload,
    signature,
  };

  const outputPath = resolve(args.output);
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(outputPath, JSON.stringify(signedLicense, null, 2));

  console.log(`License created: ${outputPath}`);
  console.log(`  Username: ${payload.username}`);
  console.log(`  Valid for: ${validDays} days`);
  console.log(`  Expires: ${payload.expiresAt}`);
}

function cmdVerify(args) {
  const publicKey = readFileSync(resolve(args["public-key"]), "utf8");
  const licenseFile = JSON.parse(readFileSync(resolve(args.license), "utf8"));

  const { payload, signature } = licenseFile;

  // Verify signature
  const signatureValid = verifyLicenseSignature(payload, signature, publicKey);
  if (!signatureValid) {
    console.error(`ERROR: License signature verification failed`);
    console.error(`The license may have been tampered with.`);
    process.exit(1);
  }

  // Validate license content
  const currentUser =
    args.username || process.env.USER || process.env.USERNAME || os.userInfo().username;
  const { valid, message } = validateLicenseContent(payload, currentUser);

  console.log(`License Details:`);
  console.log(`  Algorithm: ${licenseFile.algorithm}`);
  console.log(`  Username: ${payload.username}`);
  console.log(`  Issued: ${payload.issuedAt}`);
  console.log(`  Expires: ${payload.expiresAt}`);
  console.log(`  Signature: Valid`);
  console.log(`  Status: ${message}`);

  if (!valid) {
    process.exit(1);
  }
}

const { values, positionals } = parseArgs({
  options: {
    "private-output": { type: "string" },
    "public-output": { type: "string" },
    "private-key": { type: "string" },
    "public-key": { type: "string" },
    output: { type: "string", short: "o" },
    username: { type: "string", short: "u" },
    "valid-days": { type: "string", short: "d" },
    license: { type: "string", short: "l" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

const command = positionals[0];

if (values.help || !command) {
  console.log(`
License Key Generator for OpenClaw

Commands:
  generate-keys   Generate RSA key pair (run in secure environment)
  create          Create a signed license (run in secure environment)
  verify          Verify a license signature (run on client)

Examples:
  # Generate keys (admin only)
  node scripts/license-generator.mjs generate-keys \\
    --private-output admin/private.key \\
    --public-output admin/public.key

  # Create license (admin only)
  node scripts/license-generator.mjs create \\
    --username USER --valid-days 30 \\
    --private-key admin/private.key \\
    --output configs/license.key

  # Verify license (client)
  node scripts/license-generator.mjs verify \\
    --license configs/license.key \\
    --public-key configs/public.key
`);
  process.exit(0);
}

switch (command) {
  case "generate-keys":
    cmdGenerateKeys(values);
    break;
  case "create":
    cmdCreate(values);
    break;
  case "verify":
    cmdVerify(values);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
