#!/bin/bash
# 打包离线部署包

set -e

echo "📦 开始打包 OpenClaw 离线部署包..."

# 1. 构建离线版本
echo "🔨 构建离线版本..."
export OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0
export OPENCLAW_BUILD_PROFILE=offline
rm -rf dist
pnpm build

# 1.5. 构建 UI 资源
echo "🎨 构建 UI 资源..."
pnpm ui:build

# 2. 创建部署目录
DEPLOY_DIR="openclaw-offline-bank"
echo "📁 创建部署目录: $DEPLOY_DIR"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# 3. 复制必要文件
echo "📋 复制必要文件..."
cp openclaw.mjs $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp configs/offline-bank.json $DEPLOY_DIR/
cp README.md $DEPLOY_DIR/
cp LICENSE $DEPLOY_DIR/

# 4. 复制 dist 目录
echo "📦 复制构建产物..."
cp -r dist $DEPLOY_DIR/

# 5. 复制文档
mkdir -p $DEPLOY_DIR/docs
cp scripts/README-OFFLINE.md $DEPLOY_DIR/docs/

# 6. 创建启动脚本
cat > $DEPLOY_DIR/start.sh << 'EOF'
#!/bin/bash
# OpenClaw 离线启动脚本

export OPENCLAW_SKIP_CHANNELS=1
export OPENCLAW_UPDATE_CHECK=0

# 使用离线配置
export OPENCLAW_CONFIG_PATH="./offline-bank.json"

# 启动 Gateway
node openclaw.mjs gateway run --bind loopback --port 18789
EOF
chmod +x $DEPLOY_DIR/start.sh

# 7. 打包成 tar.gz
echo "📦 打包成 tar.gz..."
tar -czf openclaw-offline-bank.tar.gz $DEPLOY_DIR

# 8. 显示打包信息
BUILD_SIZE=$(du -sh dist | cut -f1)
TAR_SIZE=$(du -sh openclaw-offline-bank.tar.gz | cut -f1)
JS_COUNT=$(find dist -name "*.js" | wc -l)

echo ""
echo "✅ 打包完成！"
echo "----------------------------------------"
echo "构建产物大小: $BUILD_SIZE"
echo "部署包大小:   $TAR_SIZE"
echo "JS 文件数量:  $JS_COUNT"
echo "部署包名称:   openclaw-offline-bank.tar.gz"
echo "----------------------------------------"
echo ""
echo "🚀 部署步骤："
echo "1. 复制 openclaw-offline-bank.tar.gz 到目标机器"
echo "2. 解压: tar -xzf openclaw-offline-bank.tar.gz"
echo "3. 进入目录: cd openclaw-offline-bank"
echo "4. 启动: ./start.sh"
echo ""
echo "📋 使用说明请查看: docs/README-OFFLINE.md"