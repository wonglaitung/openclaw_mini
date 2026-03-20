# OpenClaw 离线部署包使用指南

## 打包 OpenClaw 离线部署包

```bash
scripts/package-offline-deploy.sh
```

---

## 部署包内容

```
openclaw-offline-bank/ls
├── openclaw.mjs          # OpenClaw CLI 入口
├── package.json          # 依赖配置
├── offline-bank.json     # 离线配置文件
├── dist/                 # 编译后的 JS 代码（25MB）
├── start.sh              # 启动脚本
├── README.md             # 项目说明
├── LICENSE               # 许可证
└── docs/
    └── README-OFFLINE.md # 离线部署详细文档
```

---

## 快速部署

### 1. 解压部署包

```bash
tar -xzf openclaw-offline-bank.tar.gz
cd openclaw-offline-bank
```

### 2. 配置本地 LLM 服务

编辑 `offline-bank.json`，修改 `baseUrl` 为你的 LLM 服务地址，并更新模型名称：

```json
{
  "models": {
    "providers": {
      "local-openai": {
        "baseUrl": "http://127.0.0.1:8000/v1",
        "apiKey": "sk-dummy",
        "models": [
          {
            "id": "your-model-id",
            "name": "Your Model Name",
            "contextWindow": 32768,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "models": {
        "primary": "local-openai/your-model-id"
      }
    }
  }
}
```

**重要**：

- `models[].id` 必须与你的 LLM 服务提供的模型 ID 完全一致
- `agents.defaults.models.primary` 必须使用 `provider-id/model-id` 格式
- 可以运行 `curl http://127.0.0.1:8000/v1/models` 查看可用模型列表

### 3. 启动 OpenClaw

```bash
# 方式1：使用启动脚本（推荐）
./start.sh

# 方式2：直接运行（使用环境变量指定配置）
OPENCLAW_CONFIG_PATH=./offline-bank.json node openclaw.mjs gateway run --bind 127.0.0.1 --port 18789
```

### 4. 访问 Web UI

浏览器打开：http://127.0.0.1:18789/webchat

---

## CLI 使用

```bash
# 查看版本
node openclaw.mjs --version

# 查看配置
node openclaw.mjs config get

# 发送消息
node openclaw.mjs agent --message "你的问题"

# 运行任务
node openclaw.mjs agent --message "运行 data-cleaning.py"
```

---

## 配置说明

### 本地 LLM 服务要求

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

### 推荐的本地 LLM 服务

- **vLLM**: https://github.com/vllm-project/vllm
- **SGLang**: https://github.com/sgl-project/sglang
- **LM Studio**: https://lmstudio.ai/
- **Ollama**: https://ollama.com/（需配置 OpenAI 兼容模式）

---

## 安全配置

配置文件已设置工具白名单：

```json
{
  "tools": {
    "allow": ["bash", "read", "write", "edit"],
    "deny": ["*"],
    "exec": {
      "security": "allowlist",
      "safeBins": ["python", "node", "powershell"],
      "pathPrepend": ["/bank/scripts"]
    }
  }
}
```

根据银行环境调整路径。

---

## 故障排除

### 问题1：无法连接本地 LLM

```bash
# 检查服务状态
curl http://127.0.0.1:8000/v1/models

# 检查防火墙
# 确保端口 8000 和 18789 未被阻止
```

### 问题2：端口被占用

```bash
# 检查端口占用
netstat -an | grep 18789

# 修改配置文件中的端口号
```

### 问题3：配置文件错误

```bash
# 验证配置
node openclaw.mjs config validate
```

---

## 日志位置

- **OpenClaw 日志**: `~/.openclaw/logs/`
- **本地 LLM 日志**: 根据你的 LLM 服务配置

---

## 验证安装

```bash
# 1. 检查版本
node openclaw.mjs --version

# 2. 验证配置
node openclaw.mjs config validate

# 3. 测试启动
node openclaw.mjs gateway run --config offline-bank.json
```

---

## 卸载

```bash
# 1. 停止服务
# Ctrl+C 停止正在运行的进程

# 2. 删除部署目录
rm -rf openclaw-offline-bank

# 3. 删除配置和数据
rm -rf ~/.openclaw
```

---

## 更多文档

- 配置文档: https://docs.openclaw.ai/gateway/configuration
- CLI 文档: https://docs.openclaw.ai/cli
- 故障排除: https://docs.openclaw.ai/channels/troubleshooting

---

## 部署包特点

- ✅ 构建大小: 25MB
- ✅ JS 文件: 785 个
- ✅ 消息渠道: 完全排除
- ✅ 适合银行内网部署
- ✅ 无外部网络依赖
- ✅ 工具白名单保护
- ✅ 文件系统限制
