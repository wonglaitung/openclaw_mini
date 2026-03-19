# OpenClaw 离线构建脚本 (Windows PowerShell)
# 用于构建不包含消息渠道的最小化版本

$ErrorActionPreference = "Stop"

Write-Host "🔨 开始构建 OpenClaw 离线版本..." -ForegroundColor Green
Write-Host ""

# 设置环境变量
$env:OPENCLAW_INCLUDE_OPTIONAL_BUNDLED = "0"
$env:OPENCLAW_BUILD_PROFILE = "offline"

Write-Host "📋 构建配置：" -ForegroundColor Cyan
Write-Host "  - OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0"
Write-Host "  - OPENCLAW_BUILD_PROFILE=offline"
Write-Host ""

# 清理旧的构建产物
Write-Host "🧹 清理旧构建产物..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
Write-Host "  ✅ 清理完成" -ForegroundColor Green
Write-Host ""

# 运行完整构建
Write-Host "🏗️  开始构建..." -ForegroundColor Yellow
pnpm build

Write-Host ""
Write-Host "✅ 构建完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📦 构建产物位置：" -ForegroundColor Cyan
Write-Host "  - dist/"
Write-Host ""
Write-Host "📊 离线版本特点：" -ForegroundColor Cyan
Write-Host "  - ✅ 不包含任何消息渠道" -ForegroundColor Green
Write-Host "  - ✅ 不包含可选插件" -ForegroundColor Green
Write-Host "  - ✅ 最小化依赖" -ForegroundColor Green
Write-Host "  - ✅ 适合银行内网部署" -ForegroundColor Green
Write-Host ""