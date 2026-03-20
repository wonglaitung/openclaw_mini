# OpenClaw 离线部署指南 - 银行内网版本

## 概述

这是 OpenClaw 的最小化离线配置，专为银行内网封闭环境设计。

**特点**：

- 无外部网络依赖
- 无消息渠道（WhatsApp/Telegram 等）
- 使用本地 OpenAI 兼容的 LLM 服务
- 无 Docker 沙箱
- 仅通过 Web UI/CLI 交互

---

## 前置要求

### Windows 机器

- Windows 10/11 或 Windows Server 2016+
- Node.js 22+ (https://nodejs.org/)
- Python 3.8+ (用于运行安装脚本)

### 本地 LLM 服务

- 提供 OpenAI 兼容的 `/v1/chat/completions` 接口
- 监听地址：`http://127.0.0.1:8000`（可自定义）
- 支持的模型：Qwen、Llama、DeepSeek 等

---

## 安装步骤

### 1. 自动安装（推荐）

```bash
# 以管理员身份运行
python scripts/install-offline-windows.py
```

### 2. 手动安装

```bash
# 1. 安装 OpenClaw
npm install -g openclaw@latest

# 2. 创建配置目录
mkdir %USERPROFILE%\.openclaw

# 3. 复制配置文件
copy configs\offline-bank.json %USERPROFILE%\.openclaw\openclaw.json
```

---

## 启动方式

### 方式 1：Python 脚本启动

```bash
python scripts/start-offline-windows.py
```

### 方式 2：手动命令

```bash
# 设置环境变量
set OPENCLAW_SKIP_CHANNELS=1
set OPENCLAW_UPDATE_CHECK=0

# 启动 Gateway
openclaw gateway run --bind 127.0.0.1 --port 18789
```

---

## 使用方式

### Web UI（推荐）

访问：http://127.0.0.1:18789/webchat

### CLI 命令

```bash
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
    "model": "local-openai/qwen2.5-72b-instruct"
  },
  "models": {
    "providers": {
      "local-openai": {
        "baseUrl": "http://127.0.0.1:8000/v1",
        "apiKey": "sk-dummy",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen2.5-72b-instruct",
            "contextWindow": 32768,
            "maxTokens": 8192
          }
        ]
      }
    }
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

### 本地 LLM 服务配置

根据你的实际模型服务修改：

```json
{
  "models": {
    "providers": {
      "local-openai": {
        "baseUrl": "http://你的服务地址:端口/v1",
        "models": [
          {
            "id": "你的模型名称",
            "contextWindow": 32768,
            "maxTokens": 8192
          }
        ]
      }
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

## 本地 LLM 服务要求

### API 接口

本地服务需提供 **OpenAI 兼容的 API**：

```
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "your-model-name",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

### 响应格式

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      }
    }
  ]
}
```

### 推荐的本地 LLM 服务

- **vLLM** - https://github.com/vllm-project/vllm
- **SGLang** - https://github.com/sgl-project/sglang
- **LM Studio** - https://lmstudio.ai/
- **Ollama** - https://ollama.com/ (需配置 OpenAI 兼容模式)

---

## 故障排除

### 问题 1：端口被占用

```bash
# 检查端口占用
netstat -an | findstr 18789

# 修改配置文件中的端口号
```

### 问题 2：本地 LLM 服务未运行

```bash
# 检查服务状态
curl http://127.0.0.1:8000/v1/models

# 检查服务日志
# （根据你的 LLM 服务查看日志）
```

### 问题 3：配置文件错误

```bash
# 验证配置文件
openclaw config validate

# 查看当前配置
openclaw config get
```

### 问题 4：Python 脚本无法运行

```bash
# 检查 Python 版本
python --version

# 如果是 Python 2，尝试使用 python3
python3 scripts/install-offline-windows.py

# 或直接使用 py 命令
py scripts/install-offline-windows.py
```

---

## 验证安装

```bash
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

- **OpenClaw 日志**：`%USERPROFILE%\.openclaw\logs\`
- **本地 LLM 日志**：根据你的 LLM 服务配置

---

## 卸载

```bash
# 1. 卸载 OpenClaw
npm uninstall -g openclaw

# 2. 删除配置文件
rmdir /s /q %USERPROFILE%\.openclaw

# 3. 停止本地 LLM 服务
# （根据你的 LLM 服务停止方式）
```

---

## 支持与帮助

- 配置验证：`openclaw doctor`
- 配置文档：https://docs.openclaw.ai/gateway/configuration
- 故障排除：https://docs.openclaw.ai/channels/troubleshooting
