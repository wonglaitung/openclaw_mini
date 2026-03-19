#!/bin/bash
# OpenClaw 离线构建脚本
# 用于构建不包含消息渠道的最小化版本

set -e

echo "🔨 开始构建 OpenClaw 离线版本..."
echo ""

# 设置环境变量
export OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0
export OPENCLAW_BUILD_PROFILE=offline

echo "📋 构建配置："
echo "  - OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0"
echo "  - OPENCLAW_BUILD_PROFILE=offline"
echo ""

# 清理旧的构建产物
echo "🧹 清理旧构建产物..."
rm -rf dist
echo "  ✅ 清理完成"
echo ""

# 运行完整构建
echo "🏗️  开始构建..."
pnpm build

echo ""
echo "✅ 构建完成！"
echo ""
echo "📦 构建产物位置："
echo "  - dist/"
echo ""
echo "📊 离线版本特点："
echo "  - ✅ 不包含任何消息渠道"
echo "  - ✅ 不包含可选插件"
echo "  - ✅ 最小化依赖"
echo "  - ✅ 适合银行内网部署"
echo ""