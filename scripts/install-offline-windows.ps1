# OpenClaw 离线安装脚本 - Windows 版本
# 用途：银行内网环境，无外部网络依赖

param(
    [string]$InstallDir = "C:\Program Files\openclaw",
    [string]$ConfigDir = "C:\Users\$env:USERNAME\.openclaw",
    [string]$OllamaDir = "C:\Program Files\Ollama",
    [switch]$SkipOllama = $false,
    [switch]$SkipService = $false
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " OpenClaw 离线安装 - 银行内网版本" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "错误：需要管理员权限运行此脚本" -ForegroundColor Red
    Write-Host "请右键点击 PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    exit 1
}

# 1. 检查 Node.js
Write-Host "[1/6] 检查 Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "错误：未找到 Node.js" -ForegroundColor Red
    Write-Host "请先安装 Node.js 22+ https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Node.js 版本: $nodeVersion" -ForegroundColor Green

# 2. 检查 npm
Write-Host "[2/6] 检查 npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "错误：未找到 npm" -ForegroundColor Red
    exit 1
}
Write-Host "✓ npm 版本: $npmVersion" -ForegroundColor Green

# 3. 安装 OpenClaw
Write-Host "[3/6] 安装 OpenClaw..." -ForegroundColor Yellow
npm install -g openclaw@latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：OpenClaw 安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ OpenClaw 安装成功" -ForegroundColor Green

# 4. 安装 Ollama（可选）
if (-not $SkipOllama) {
    Write-Host "[4/6] 检查 Ollama..." -ForegroundColor Yellow
    $ollamaExe = Join-Path $OllamaDir "ollama.exe"
    if (Test-Path $ollamaExe) {
        Write-Host "✓ Ollama 已安装" -ForegroundColor Green
    } else {
        Write-Host "警告：未找到 Ollama" -ForegroundColor Yellow
        Write-Host "请手动安装 Ollama: https://ollama.ai/download" -ForegroundColor Yellow
        Write-Host "或使用 --SkipOllama 参数跳过此步骤" -ForegroundColor Yellow
    }
} else {
    Write-Host "[4/6] 跳过 Ollama 检查 (--SkipOllama)" -ForegroundColor Yellow
}

# 5. 复制配置文件
Write-Host "[5/6] 配置 OpenClaw..." -ForegroundColor Yellow
$configDir = Join-Path $env:USERPROFILE ".openclaw"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

# 检查配置文件是否存在
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $scriptDir "..\configs\offline-bank.json"
if (Test-Path $configFile) {
    Copy-Item $configFile "$configDir\openclaw.json" -Force
    Write-Host "✓ 配置文件已复制到: $configDir\openclaw.json" -ForegroundColor Green
} else {
    Write-Host "警告：未找到配置文件，使用默认配置" -ForegroundColor Yellow
    Write-Host "配置文件路径: $configFile" -ForegroundColor Yellow
}

# 6. 创建 Windows 服务（可选）
if (-not $SkipService) {
    Write-Host "[6/6] 创建 Windows 服务..." -ForegroundColor Yellow

    # 检查 NSSM 是否存在
    $nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $nssmPath) {
        Write-Host "警告：未找到 NSSM" -ForegroundColor Yellow
        Write-Host "请手动安装 NSSM: https://nssm.cc/download" -ForegroundColor Yellow
        Write-Host "或使用 --SkipService 参数跳过此步骤" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "手动创建服务命令：" -ForegroundColor Cyan
        Write-Host "nssm install OpenClawGateway `" -ForegroundColor Gray
        Write-Host "  node.exe C:\Users\$env:USERNAME\AppData\Roaming\npm\node_modules\openclaw\openclaw.mjs `" -ForegroundColor Gray
        Write-Host "  gateway run --bind 127.0.0.1 --port 18789" -ForegroundColor Gray
    } else {
        # 创建服务
        $serviceName = "OpenClawGateway"
        $nodePath = Get-Command node -ErrorAction SilentlyContinue
        if (-not $nodePath) {
            Write-Host "错误：未找到 node.exe 路径" -ForegroundColor Red
            exit 1
        }

        $openclawPath = Join-Path $env:APPDATA "npm\node_modules\openclaw\openclaw.mjs"

        # 检查服务是否已存在
        $serviceExists = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($serviceExists) {
            Write-Host "警告：服务已存在，停止并删除..." -ForegroundColor Yellow
            nssm stop $serviceName
            nssm remove $serviceName confirm
        }

        # 创建新服务
        nssm install $serviceName $nodePath.Source $openclawPath "gateway" "run" "--bind" "127.0.0.1" "--port" "18789"
        nssm set $serviceName AppDirectory (Split-Path -Parent $nodePath.Source)
        nssm set $serviceName DisplayName "OpenClaw Gateway"
        nssm set $serviceName Description "OpenClaw AI Gateway - Local Offline Mode"
        nssm set $serviceName Start SERVICE_AUTO_START

        Write-Host "✓ Windows 服务已创建: $serviceName" -ForegroundColor Green
        Write-Host "  启动服务: Start-Service $serviceName" -ForegroundColor Gray
        Write-Host "  停止服务: Stop-Service $serviceName" -ForegroundColor Gray
    }
} else {
    Write-Host "[6/6] 跳过服务创建 (--SkipService)" -ForegroundColor Yellow
}

# 完成
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " 安装完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "后续步骤：" -ForegroundColor Cyan
Write-Host "1. 如果跳过了 Ollama，请安装 Ollama 并下载模型：" -ForegroundColor White
Write-Host "   ollama pull llama3.2:70b-instruct" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 启动 OpenClaw Gateway：" -ForegroundColor White
if ($SkipService) {
    Write-Host "   openclaw gateway run --bind 127.0.0.1 --port 18789" -ForegroundColor Gray
} else {
    Write-Host "   Start-Service OpenClawGateway" -ForegroundColor Gray
}
Write-Host ""
Write-Host "3. 访问 Web UI：" -ForegroundColor White
Write-Host "   http://127.0.0.1:18789/webchat" -ForegroundColor Gray
Write-Host ""
Write-Host "4. 测试 AI 代理：" -ForegroundColor White
Write-Host "   openclaw agent --message '列出当前目录'" -ForegroundColor Gray
Write-Host ""
Write-Host "配置文件位置：" -ForegroundColor Cyan
Write-Host "   $configDir\openclaw.json" -ForegroundColor Gray
Write-Host ""