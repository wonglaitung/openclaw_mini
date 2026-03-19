#!/bin/bash

echo "OpenClaw 构建包验证脚本"
echo "检查构建包的可用性..."

BUILD_DIR="dist"

# 1. 检查构建目录
echo ""
echo "【检查构建目录】"
if [ -d "$BUILD_DIR" ]; then
    echo "✅ 构建目录存在: $BUILD_DIR"
else
    echo "❌ 构建目录不存在: $BUILD_DIR"
    exit 1
fi

# 2. 检查核心文件
echo ""
echo "【检查核心文件】"
CORE_FILES=(
    "index.js"
    "entry.js"
    "plugin-sdk/index.js"
)

for file in "${CORE_FILES[@]}"; do
    if [ -f "$BUILD_DIR/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file"
    fi
done

# 3. 检查关键插件
echo ""
echo "【检查关键插件】"
KEY_PLUGINS=(
    "ollama"
    "anthropic"
    "openai"
)

for plugin in "${KEY_PLUGINS[@]}"; do
    if [ -f "$BUILD_DIR/extensions/$plugin/index.js" ]; then
        echo "✅ $plugin"
    else
        echo "❌ $plugin"
    fi
done

# 4. 检查消息渠道是否被排除
echo ""
echo "【检查消息渠道排除】"
MESSAGE_CHANNELS=(
    "whatsapp"
    "telegram"
    "discord"
    "slack"
)

for channel in "${MESSAGE_CHANNELS[@]}"; do
    if [ -f "$BUILD_DIR/extensions/$channel/index.js" ]; then
        echo "❌ $channel (未排除)"
    else
        echo "✅ $channel (已排除)"
    fi
done

# 5. 检查消息渠道依赖
echo ""
echo "【检查消息渠道依赖】"
for channel in "${MESSAGE_CHANNELS[@]}"; do
    if [ -d "$BUILD_DIR/extensions/$channel/node_modules" ]; then
        echo "❌ $channel/node_modules (未排除)"
    else
        echo "✅ $channel/node_modules (已排除)"
    fi
done

# 6. 检查构建大小
echo ""
echo "【检查构建大小】"
BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
echo "构建产物大小: $BUILD_SIZE"

BUILD_SIZE_BYTES=$(du -sb "$BUILD_DIR" | cut -f1)
BUILD_SIZE_MB=$((BUILD_SIZE_BYTES / 1024 / 1024))
echo "构建产物大小: ${BUILD_SIZE_MB}MB"

if [ $BUILD_SIZE_MB -lt 50 ]; then
    echo "✅ 构建大小合理 (< 50MB)"
else
    echo "⚠️  构建大小偏大 (>= 50MB)"
fi

# 7. 检查 JS 文件数量
echo ""
echo "【检查 JS 文件数量】"
JS_COUNT=$(find "$BUILD_DIR" -type f -name "*.js" | wc -l)
echo "JS 文件总数: $JS_COUNT"

if [ $JS_COUNT -lt 1000 ]; then
    echo "✅ JS 文件数量合理 (< 1000)"
else
    echo "⚠️  JS 文件数量偏多 (>= 1000)"
fi

echo ""
echo "========================================="
echo "验证完成"
echo "========================================="
