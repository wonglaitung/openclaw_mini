# OpenClaw 离线部署指南 - 银行内网版本

## 概述

这是 OpenClaw 的最小化离线配置，专为银行内网封闭环境设计。

**特点**：

- 无外部网络依赖
- 无消息渠道（WhatsApp/Telegram 等）
- 使用本地 Ollama 模型
- 无 Docker 沙箱
- 仅通过 Web UI/CLI 交互

---

## 前置要求

### Windows 机器

- Windows 10/11 或 Windows Server 2016+
- Node.js 22+ (https://nodejs.org/)
- PowerShell 5.1+

### Ollama（可选但推荐）

- 下载安装：https://ollama.ai/download
- 推荐模型：`ollama pull llama3.2:70b-instruct`

---

## 安装步骤

### 1. 自动安装（推荐）

```powershell
# 以管理员身份运行 PowerShell
cd C:\openclaw
.\scripts\install-offline-windows.ps1
```

**参数说明**：

- `--SkipOllama` - 跳过 Ollama 检查
- `--SkipService` - 跳过 Windows 服务创建

### 2. 手动安装

```powershell
# 1. 安装 OpenClaw
npm install -g openclaw@latest

# 2. 创建配置目录
mkdir $env:USERPROFILE\.openclaw

# 3. 复制配置文件
copy configs\offline-bank.json $env:USERPROFILE\.openclaw\openclaw.json
```

---

## 启动方式

### 方式 1：直接启动

```powershell
.\scripts\start-offline-windows.ps1
```

### 方式 2：使用 Windows 服务

```powershell
# 启动服务
Start-Service OpenClawGateway

# 停止服务
Stop-Service OpenClawGateway

# 查看状态
Get-Service OpenClawGateway
```

### 方式 3：手动命令

```powershell
# 设置环境变量
$env:OPENCLAW_SKIP_CHANNELS = "1"
$env:OPENCLAW_UPDATE_CHECK = "0"

# 启动 Gateway
openclaw gateway run --bind 127.0.0.1 --port 18789
```

---

## 使用方式

### Web UI（推荐）

访问：http://127.0.0.1:18789/webchat

### CLI 命令

```powershell
# 发送消息
openclaw agent --message "分析当前目录的文件"

# 执行任务
openclaw agent --message "运行 D:\bank\scripts\data-cleaning.py"
```

---

## 配置说明

### 核心配置 (`configs/offline-bank.json`)

```json
{
  "agent": {
    "model": "ollama/llama3.2:70b-instruct"
  },
  "plugins": {
    "allow": ["ollama", "memory-core", "memory-lancedb"],
    "deny": ["*"]
  },
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "off"
      }
    }
  },
  "tools": {
    "exec": {
      "security": "allowlist",
      "safeBins": ["python", "node", "powershell"],
      "pathPrepend": ["D:\\bank\\scripts"]
    }
  }
}
```

### 环境变量

| 变量                     | 值  | 说明             |
| ------------------------ | --- | ---------------- |
| `OPENCLAW_SKIP_CHANNELS` | `1` | 禁用所有消息渠道 |
| `OPENCLAW_UPDATE_CHECK`  | `0` | 禁用更新检查     |

---

## 安全配置

### 工具白名单

```json
{
  "tools": {
    "allow": ["bash", "read", "write", "edit"],
    "deny": ["*"],
    "exec": {
      "security": "allowlist",
      "safeBins": ["python", "node", "powershell"],
      "pathPrepend": ["D:\\bank\\scripts"]
    }
  }
}
```

### 文件系统限制

```json
{
  "tools": {
    "fs": {
      "workspaceOnly": true
    }
  }
}
```

---

## 离线安装包

如需完全离线部署，准备以下文件：

1. **OpenClaw npm 包**

   ```bash
   npm pack openclaw
   ```

2. **Ollama Windows 安装包**
   - 下载：https://ollama.ai/download

3. **Ollama 模型文件**

   ```bash
   ollama pull llama3.2:70b-instruct
   # 模型存储在 ~/.ollama/models/
   ```

4. **配置文件**
   - `configs/offline-bank.json`

5. **安装脚本**
   - `scripts/install-offline-windows.ps1`
   - `scripts/start-offline-windows.ps1`

---

## 故障排除

### 问题 1：端口被占用

```powershell
# 检查端口占用
netstat -an | findstr 18789

# 修改配置文件中的端口号
```

### 问题 2：Ollama 未运行

```powershell
# 启动 Ollama
ollama serve

# 检查模型列表
ollama list
```

### 问题 3：配置文件错误

```powershell
# 验证配置文件
openclaw config validate

# 查看当前配置
openclaw config get
```

### 问题 4：权限问题

```powershell
# 以管理员身份运行 PowerShell
# 检查目录权限
icacls "C:\Program Files\openclaw"
```

---

## 验证安装

```powershell
# 1. 检查 OpenClaw 版本
openclaw --version

# 2. 检查配置
openclaw config get

# 3. 测试启动
openclaw gateway run --bind 127.0.0.1 --port 18789

# 4. 测试 AI 代理
openclaw agent --message "列出当前目录"
```

---

## 日志位置

- **OpenClaw 日志**：`$env:USERPROFILE\.openclaw\logs\`
- **Ollama 日志**：`$env:USERPROFILE\.ollama\logs\`

---

## 卸载

```powershell
# 1. 停止并删除服务
Stop-Service OpenClawGateway
nssm remove OpenClawGateway confirm

# 2. 卸载 OpenClaw
npm uninstall -g openclaw

# 3. 删除配置文件
Remove-Item -Recurse -Force $env:USERPROFILE\.openclaw

# 4. 删除 Ollama（可选）
ollama uninstall
```

---

## 支持与帮助

- 配置验证：`openclaw doctor`
- 配置文档：https://docs.openclaw.ai/gateway/configuration
- 故障排除：https://docs.openclaw.ai/channels/troubleshooting
