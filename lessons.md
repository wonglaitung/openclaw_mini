# OpenClaw 项目学习与经验教训

## 2026-03-20

### Git 远端配置经验

**1. Fork 与官方仓库的区分**

- 当修改开源项目时，应先 fork 到个人仓库
- 推送代码应推送到个人 fork，而非官方仓库
- 官方仓库通常有权限限制，直接推送会返回 403 错误

**2. Git 远端配置命令**

- 查看远端配置：`git remote -v`
- 修改远端 URL：`git remote set-url origin <new-url>`
- 添加额外远端：`git remote add <name> <url>`

**3. 推送到 fork 的工作流程**

- 正常工作流程：fork → clone → 修改 → push 到 fork → 创建 PR
- 推送命令：`git push origin main` 或 `git push mini main`（如果有多个远端）
- 创建 PR 需要使用 GitHub 网页界面

**4. 推送前的检查**

- 使用 `git status` 确认工作区干净
- 使用 `git log` 查看待推送的提交
- 确认分支名称：`git rev-parse --abbrev-ref HEAD`

### 内网删减版方案设计经验

**1. 插件化架构的优势**

- OpenClaw 的核心优势是高度模块化的插件系统
- 所有消息渠道（WhatsApp/Telegram/Discord 等）都是独立扩展
- 可以通过 `plugins.deny: ["*"]` 完全禁用不需要的功能
- 无需修改核心代码即可实现功能删减

**2. 沙箱功能的权衡**

- 沙箱（Docker 容器）提供安全隔离，但增加部署复杂度
- 银行内网如果已严格控制访问路径和命令，禁用沙箱是可行的
- 替代方案：工具白名单 + 工作区限制 + 安全二进制列表
- 配置选项：`sandbox.mode: "off"`, `tools.exec.security: "allowlist"`

**3. 环境变量控制**

- `OPENCLAW_SKIP_CHANNELS=1` - 禁用所有消息渠道
- `OPENCLAW_UPDATE_CHECK=0` - 禁用更新检查
- 这些环境变量在代码中有多处检查，确保功能被正确禁用

**4. 配置文件结构**

- OpenClaw 使用 JSON 配置文件：`~/.openclaw/openclaw.json`
- 配置类型定义在 `src/config/types.*.ts` 中
- 推荐先通过配置验证功能，再手动修改

**5. Ollama 本地化方案**

- `extensions/ollama/` 提供完全本地化的 LLM 解决方案
- 支持多种本地模型（Llama、Qwen 等）
- 无需任何外部 API 依赖

**6. Windows 部署考虑**

- Windows 原生 Docker 容器支持（Windows Server 2016+）
- 如果没有 Docker，使用 NSSM 创建 Windows 服务
- 路径处理使用 `path.win32.normalize()` 确保 Windows 兼容性
- PowerShell 脚本需要管理员权限才能创建服务

**7. 安全配置最佳实践**

- `tools.fs.workspaceOnly: true` - 限制文件操作范围
- `tools.exec.safeBins` - 白名单允许的二进制文件
- `tools.exec.pathPrepend` - 指定安全路径
- `gateway.auth.mode: "none"` - 仅本地回环访问

**8. 文档和脚本的重要性**

- 提供完整的部署文档可以减少用户困惑
- 自动化安装脚本降低部署错误率
- 包含故障排除指南可以快速解决问题

**9. 下次优化方向**

- 考虑添加配置验证脚本
- 可以添加模型下载进度提示
- 可以添加一键启动 Ollama 的选项
- 考虑添加健康检查脚本
