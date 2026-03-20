# OpenClaw 启动脚本 - Windows 离线版本

param(
    [string]$Bind = "127.0.0.1",
    [int]$Port = 18789,
    [switch]$Verbose
)

# 设置环境变量
$env:OPENCLAW_SKIP_CHANNELS = "1"
$env:OPENCLAW_UPDATE_CHECK = "0"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " OpenClaw Gateway - 离线模式" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "配置信息：" -ForegroundColor Yellow
Write-Host "  绑定地址: $Bind:$Port" -ForegroundColor White
Write-Host "  禁用渠道: OPENCLAW_SKIP_CHANNELS=1" -ForegroundColor White
Write-Host "  禁用更新: OPENCLAW_UPDATE_CHECK=0" -ForegroundColor White
Write-Host ""

# 检查 Ollama 是否运行
Write-Host "检查 Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -UseBasicParsing
    Write-Host "✓ Ollama 运行中" -ForegroundColor Green
} catch {
    Write-Host "警告：Ollama 未运行" -ForegroundColor Yellow
    Write-Host "请先启动 Ollama: ollama serve" -ForegroundColor Yellow
    Write-Host "或安装并下载模型: ollama pull llama3.2:70b-instruct" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "是否继续？(y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# 启动 OpenClaw
Write-Host "启动 OpenClaw Gateway..." -ForegroundColor Yellow
Write-Host ""

$arguments = @("gateway", "run", "--bind", $Bind, "--port", $Port)
if ($Verbose) {
    $arguments += "--verbose"
}

try {
    & openclaw @arguments
    $exitCode = $LASTEXITCODE
} catch {
    Write-Host "错误：启动失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    $exitCode = 1
}

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "启动失败，请检查：" -ForegroundColor Yellow
    Write-Host "1. 配置文件是否正确: $env:USERPROFILE\.openclaw\openclaw.json" -ForegroundColor White
    Write-Host "2. 端口 $Port 是否被占用: netstat -an | findstr $Port" -ForegroundColor White
    Write-Host "3. Ollama 是否运行: ollama serve" -ForegroundColor White
    Write-Host "4. 详细错误: openclaw gateway run --verbose" -ForegroundColor White
}

exit $exitCode