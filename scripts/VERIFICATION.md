# OpenClaw 构建包验证指南

## 快速验证

### 1. 运行自动化验证脚本

```bash
bash scripts/verify-build.sh
```

这个脚本会自动检查：

- ✅ 构建目录存在
- ✅ 核心文件完整
- ✅ 关键插件可用
- ✅ 消息渠道已排除
- ✅ 消息渠道依赖已排除
- ✅ 构建大小合理
- ✅ JS 文件数量合理

### 2. 手动验证 CLI 命令

```bash
# 测试版本命令
node openclaw.mjs --version

# 测试帮助命令
node openclaw.mjs --help

# 测试配置命令
node openclaw.mjs config list
```

## 详细验证步骤

### 第一步：验证构建产物

```bash
# 检查构建产物大小
du -sh dist/

# 检查 JS 文件数量
find dist -type f -name "*.js" | wc -l

# 检查插件数量
ls dist/extensions/ | wc -l
```

**预期结果**：

- 构建大小：< 50MB
- JS 文件：< 1000 个
- 插件数量：50 个（25 个已排除）

### 第二步：验证消息渠道排除

```bash
# 检查消息渠道是否有代码文件
for ext in whatsapp telegram discord slack; do
  echo "$ext: $(ls dist/extensions/$ext/*.js 2>/dev/null | wc -l) JS 文件"
done

# 检查消息渠道是否有依赖
for ext in whatsapp telegram discord slack; do
  echo "$ext: $(ls dist/extensions/$ext/node_modules 2>/dev/null | wc -l) node_modules"
done
```

**预期结果**：

- 所有消息渠道：0 JS 文件
- 所有消息渠道：0 node_modules

### 第三步：验证关键插件

```bash
# 检查 LLM 提供商插件
for ext in ollama anthropic openai; do
  echo "$ext: $(ls dist/extensions/$ext/*.js 2>/dev/null | wc -l) JS 文件"
done
```

**预期结果**：

- 所有 LLM 提供商：1 JS 文件（index.js）

### 第四步：验证核心文件

```bash
# 检查核心文件
ls dist/index.js dist/entry.js dist/plugin-sdk/index.js
```

**预期结果**：

- 所有核心文件都存在

### 第五步：验证 CLI 功能

```bash
# 测试版本
node openclaw.mjs --version

# 测试帮助
node openclaw.mjs --help

# 测试配置
node openclaw.mjs config list

# 测试诊断
node openclaw.mjs doctor
```

**预期结果**：

- 所有命令都能正常运行
- 版本号显示正确
- 帮助信息完整

### 第六步：验证离线配置

```bash
# 检查离线配置文件
cat configs/offline-bank.json | grep -A5 '"plugins"'

# 检查插件白名单
cat configs/offline-bank.json | grep -A2 '"deny"'
```

**预期结果**：

- 配置文件存在
- 插件正确设置为白名单模式
- deny: ["*"] 配置正确

## 功能测试

### 测试 AI 代理（需要本地 LLM）

```bash
# 1. 配置本地 LLM（如果还未配置）
node openclaw.mjs provider onboard openai-compatible \
  --base-url http://127.0.0.1:8000/v1 \
  --api-key your-api-key

# 2. 测试代理功能
node openclaw.mjs agent --message "你好"
```

### 测试文件操作

```bash
# 创建测试文件
echo "test content" > /tmp/test.txt

# 测试读取
node openclaw.mjs agent --message "读取 /tmp/test.txt 的内容"

# 测试写入
node openclaw.mjs agent --message "向 /tmp/test-write.txt 写入 'Hello World'"
```

## 问题排查

### 问题 1：CLI 命令无法运行

**症状**：

```
Error: Cannot find module './dist/index.js'
```

**解决方案**：

```bash
# 重新构建
bash scripts/build-offline.sh

# 检查核心文件
ls dist/index.js
```

### 问题 2：消息渠道未被排除

**症状**：

```
whatsapp: 1 JS 文件
```

**解决方案**：

```bash
# 检查构建环境变量
echo $OPENCLAW_BUILD_PROFILE
echo $OPENCLAW_INCLUDE_OPTIONAL_BUNDLED

# 重新构建（确保设置了正确的环境变量）
bash scripts/build-offline.sh
```

### 问题 3：node_modules 未被排除

**症状**：

```
telegram/node_modules: 42M
```

**解决方案**：

```bash
# 清理并重新构建
rm -rf dist dist-runtime
bash scripts/build-offline.sh

# 验证
ls dist/extensions/telegram/node_modules
```

## 验证清单

在部署到银行内网之前，请确保完成以下检查：

- [ ] 运行 `scripts/verify-build.sh` 脚本通过
- [ ] 构建大小 < 50MB
- [ ] JS 文件数量 < 1000
- [ ] 所有消息渠道代码被排除（0 JS 文件）
- [ ] 所有消息渠道依赖被排除（0 node_modules）
- [ ] CLI 版本命令正常：`node openclaw.mjs --version`
- [ ] CLI 帮助命令正常：`node openclaw.mjs --help`
- [ ] 离线配置文件存在且正确：`configs/offline-bank.json`
- [ ] 关键插件可用：ollama, anthropic, openai
- [ ] 核心文件完整：index.js, entry.js, plugin-sdk/index.js
- [ ] 文件操作功能正常
- [ ] AI 代理功能正常（需要本地 LLM）

## 部署前最后检查

```bash
# 运行完整验证
bash scripts/verify-build.sh

# 检查所有验证项是否通过
if [ $? -eq 0 ]; then
  echo "✅ 构建包验证通过，可以部署"
else
  echo "❌ 构建包验证失败，请检查问题"
fi
```

## 结论

如果以上所有检查都通过，说明构建包可以用于银行内网部署。

**主要优势**：

- ✅ 消息渠道完全排除
- ✅ 消息渠道依赖完全排除
- ✅ 构建体积小（< 50MB）
- ✅ 文件数量少（< 1000）
- ✅ 安全性高
- ✅ 合规性好

**使用场景**：

- 银行内网部署
- 受限网络环境
- 安全敏感环境
- 功能最小化需求
