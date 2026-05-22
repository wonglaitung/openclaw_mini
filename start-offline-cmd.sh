#!/bin/bash
# OpenClaw Offline Gateway Startup Script for Linux

# Set UTF-8 locale (ignore warnings if locale not available)
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# Build UI only if dist/control-ui doesn't exist
if [ ! -d "dist/control-ui" ]; then
  pnpm ui:build
fi

# Set config path and start gateway
export OPENCLAW_CONFIG_PATH=configs/offline-bank.json
node openclaw.mjs gateway run --port 18789
