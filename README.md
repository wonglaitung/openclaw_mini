# 🦞 OpenClaw — Offline Bank Deployment

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.svg">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.svg" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>EXFOLIATE! EXFOLIATE!</strong>
</p>

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**OpenClaw Bank Deployment** is an offline, security-enhanced variant of OpenClaw designed for banking and enterprise intranet environments. It provides a stripped-down, focused version with strict access controls, audit logging, and reduced attack surface.

If you need a secure, offline-capable AI assistant for regulated environments with strict compliance requirements, this is it.

## Project Purpose

The Bank Deployment variant addresses security and compliance requirements in banking and enterprise intranet environments:

- **Minimal Attack Surface**: Removes 15 messaging channels and 10 optional plugins (76% size reduction)
- **Offline Operation**: Designed to run in air-gapped environments without external dependencies
- **Strict Access Control**: Filesystem whitelisting, tool execution restrictions, workspace isolation
- **Comprehensive Auditing**: Detailed audit logs for all operations with per-day log rotation
- **Enterprise Security**: Token-based authentication, safe binary execution, platform-specific hardening

## Key Modifications

### Build Optimization

| Metric             | Original | Bank Deployment | Reduction |
| ------------------ | -------- | --------------- | --------- |
| Package Size       | 152M     | 36M             | 76%       |
| JS Files           | 3,563    | 785             | 78%       |
| Messaging Channels | 15+      | 0 (disabled)    | 100%      |
| Optional Plugins   | 10+      | 0 (disabled)    | 100%      |

### Security Features

- **Filesystem Access Control**: `allowedDirectories` whitelist with path normalization and subdirectory auto-allow
- **Tool Execution Safeguards**: Binary whitelisting, safe execution patterns, workspace restrictions
- **Audit Logging**: Daily log rotation, structured JSON output, operation details extraction
- **PowerShell Fallback Strategy**: PS 7 → PS 5.1 → cmd.exe with WSL path conversion
- **Token-Based Authentication**: Local loopback access with secure token management

### Configuration

- **Menu Visibility**: Default hidden (unless explicitly enabled)
- **Minimal Functionality**: Only chat/overview/usage/cron/agents/config/nodes/logs exposed
- **Custom Versioning**: Support for `meta.version` in configuration files
- **Config Inheritance**: Child configs inherit defaults from parent configurations

### Platform Support

- Windows (native and WSL2)
- Linux
- macOS

### Build Scripts

- `scripts/build-offline.sh` (Bash)
- `scripts/build-offline.ps1` (PowerShell)
- `scripts/build-offline.py` (Python)

## Configuration File

The offline bank configuration is located at `configs/offline-bank.json`:

```bash
# Build with offline profile
OPENCLAW_BUILD_PROFILE=offline pnpm build

# Run with bank configuration
OPENCLAW_CONFIG_PATH=configs/offline-bank.json node openclaw.mjs gateway run --port 18789
```

### Environment Variables

- `OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0` - Exclude optional bundles
- `OPENCLAW_BUILD_PROFILE=offline` - Use offline build profile
- `OPENCLAW_CONFIG_PATH` - Path to configuration file

## Documentation

For detailed documentation, see:

- [Offline Bank Deployment Guide](scripts/README-OFFLINE.md)
- [Main Project Docs](https://docs.openclaw.ai)

## Bank Branch

This is the `bank` branch of OpenClaw, optimized for offline banking and enterprise deployment.

### Building from Source (Bank Deployment)

```bash
# Clone and switch to bank branch
git clone https://github.com/openclaw/openclaw.git
cd openclaw
git checkout bank

# Install dependencies
pnpm install

# Build with offline profile
OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0 OPENCLAW_BUILD_PROFILE=offline pnpm build

# Run with bank configuration
OPENCLAW_CONFIG_PATH=configs/offline-bank.json node openclaw.mjs gateway run --port 18789
```

### Build Scripts

Choose the appropriate script for your platform:

```bash
# Linux/macOS
bash scripts/build-offline.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/build-offline.ps1

# Python (cross-platform)
python scripts/build-offline.py
```

### Verification

After building, verify the size reduction:

```bash
# Check package size
du -sh dist/

# Check JS file count
find dist/ -name "*.js" | wc -l
```

Expected output:

- Package size: ~36M
- JS files: ~785

### Migration from Main Branch

If you're migrating from the main branch to the bank deployment:

1. Switch to the bank branch: `git checkout bank`
2. Update your configuration to use `configs/offline-bank.json`
3. Review and adjust file access permissions (`allowedDirectories`)
4. Update tool execution whitelists (`tools.exec.safeBins`)
5. Enable audit logging (`gateway.audit.enabled: true`)

### Support

For questions about the bank deployment:

- Review [scripts/README-OFFLINE.md](scripts/README-OFFLINE.md)
- Check audit logs at `~/.openclaw/logs/audit-YYYY-MM-DD.log`
- Run `openclaw doctor` for diagnostics
