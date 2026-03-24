# OpenClaw 项目学习与经验教训

## 2026-03-20 - 项目初始化与构建优化

### Git 远端配置经验

- 修改开源项目时应先 fork 到个人仓库
- 推送代码应推送到个人 fork，而非官方仓库
- 修改远端 URL：`git remote set-url origin <new-url>`

### 内网删减版方案设计经验

**插件化架构的优势**：

- 所有消息渠道都是独立扩展，可通过配置禁用
- `plugins.deny: ["*"]` 可完全禁用不需要的功能
- 无需修改核心代码即可实现功能删减

**环境变量控制**：

- `OPENCLAW_SKIP_CHANNELS=1` - 禁用所有消息渠道
- `OPENCLAW_UPDATE_CHECK=0` - 禁用更新检查

### 构建时裁减方案设计经验

**条件导入 vs 运行时配置**：

| 方式       | 优点                   | 缺点             | 适用场景        |
| ---------- | ---------------------- | ---------------- | --------------- |
| 运行时配置 | 简单灵活，无需修改代码 | 代码和依赖仍存在 | 快速部署        |
| 构建时排除 | 减少包体积、减少依赖   | 需要修改代码     | 特定部署场景 ✅ |

**关键代码模式**：

```typescript
// 条件构建模式
const BUILD_PROFILE = process.env.OPENCLAW_BUILD_PROFILE || "full";

// 动态导入（实际功能）
export async function getBundledPlugins(): Promise<Plugin[]> {
  if (BUILD_PROFILE === "offline") return [];
  const plugins = await Promise.all([import("./plugin1.js"), import("./plugin2.js")]);
  return plugins.map((p) => p.default);
}
```

**构建优化效果**：

- 包体积：152M → 36M（减少 76%）
- JS 文件：3,563 → 785（减少 78%）

### 安全配置最佳实践

- `tools.fs.workspaceOnly: true` - 限制文件操作范围
- `tools.exec.safeBins` - 白名单允许的二进制文件
- `tools.exec.pathPrepend` - 指定安全路径
- `gateway.auth.mode: "none"` - 仅本地回环访问

## 2026-03-22 - 文件系统访问控制

### 路径处理特性

- 支持绝对路径和相对路径
- 支持跨平台路径（Linux/macOS/Windows）
- 自动规范化路径
- 子目录自动允许
- 防止部分目录名匹配

### 路径验证函数

```typescript
export function isPathInAllowedDirectories(
  targetPath: string,
  allowedDirectories: string[],
): boolean {
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  return allowedDirectories.some((allowedDir) => {
    const normalizedAllowed = path.normalize(path.resolve(allowedDir)).replace(/[/\\]+$/, "");
    return (
      normalizedTarget === normalizedAllowed ||
      normalizedTarget.startsWith(normalizedAllowed + path.sep)
    );
  });
}
```

### 测试覆盖

- 18 个测试用例，全部通过
- 覆盖：精确匹配、子目录匹配、相对路径、路径规范化、防止部分匹配

## 2026-03-23 - Tool Access 菜单可见性过滤

### 菜单到工具组的映射

```typescript
const menuToToolSectionMap: Record<string, string[]> = {
  channels: ["messaging"],
  automation: ["automation"],
  infrastructure: ["sessions"],
  nodes: ["nodes"],
};
```

### 数据传递路径

```
配置文件 menuVisibility → Gateway API → Config State → Agents Props → renderAgentTools
```

### 关键点

- `menuVisibility` 应该作为 `AgentsProps` 的独立字段，不应嵌套在 `config` 对象内部
- 确保每个层级都正确传递必要参数
- 隐藏的功能不应该在配置界面中显示

## 2026-03-23 - 工具配置优化

### 工具使用场景

| 操作     | 推荐工具    | 原因                  |
| -------- | ----------- | --------------------- |
| 读取文件 | read        | 自适应分页、图片处理  |
| 写入文件 | write       | 原子性、路径控制      |
| 编辑文件 | edit        | 精确匹配上下文        |
| 批量修改 | apply_patch | git-like 格式、原子性 |
| 搜索文件 | grep        | 模式匹配、快速        |
| 查找文件 | find        | glob 模式、灵活       |
| 列出目录 | ls          | 简单直观              |
| 执行命令 | bash        | 白名单控制            |

### 安全配置策略

```json
{
  "tools": {
    "allow": ["bash", "read", "write", "edit", "apply_patch", "grep", "find", "ls"],
    "exec": {
      "security": "allowlist",
      "safeBins": ["python", "python3", "node", "npm", "powershell", "pwsh", "cmd", "cmd.exe"]
    }
  }
}
```

## 2026-03-23 - 银行内网 Windows 系统适配

### PowerShell 自动降级

```
PowerShell 7 → PowerShell 5.1 → cmd.exe
```

### WSL 路径转换

```typescript
// Windows 路径 → WSL 路径
if (/^[A-Za-z]:[\\/]/.test(filePath)) {
  const drive = filePath[0].toLowerCase();
  const restPath = filePath.substring(2).replace(/\\/g, "/");
  resolvedPath = `/mnt/${drive}/${restPath}`;
}
```

### 安全配置

- `tools.exec.security: "allowlist"`
- `tools.fs.allowedDirectories` 路径白名单
- `gateway.auth.mode: "token"` 本地回环访问
- `gateway.audit.enabled: true` 审计日志

## 2026-03-23 - 审计日志按日期滚动和表格展示

### 日志文件管理

- 位置：`~/.openclaw/logs/audit-YYYY-MM-DD.log`
- 格式：JSON Lines（每行一个 JSON 对象）
- 自动轮换：每天零点自动创建新文件

### 配置示例

```json
{
  "gateway": {
    "audit": {
      "enabled": true,
      "file": "logs/audit.log",
      "level": "detailed",
      "rotateDaily": true
    }
  }
}
```

### 审计日志表格列

- Time：时间戳
- Type：日志类型（tool_call/tool_result/messaging/decision）
- Tool：工具名称
- Status：状态（成功/错误/阻止/警告）
- Duration：执行时长（毫秒）
- Details：详细信息（文件路径、命令、搜索模式等）

### 日志策略

| 日志类型 | 用途         | 输出位置  | 记录内容               |
| -------- | ------------ | --------- | ---------------------- |
| 主日志   | 系统运行信息 | 标准输出  | 系统启动、错误等       |
| 审计日志 | 操作审计     | audit.log | 工具调用、结果等 ✅    |
| 调试日志 | 开发调试     | 控制台    | 临时调试信息（应移除） |

## 2026-03-24 - 配置继承机制实现

### 配置文件结构

| 配置文件                          | 位置       | 作用                            | 优先级 |
| --------------------------------- | ---------- | ------------------------------- | ------ |
| `configs/offline-bank.json`       | 项目根目录 | 主配置文件（包含 `tools.exec`） | 低     |
| `~/.openclaw/exec-approvals.json` | 用户主目录 | Exec 批准策略文件（运行时配置） | 高     |

### 配置优先级

```
Agent 覆盖（exec-approvals.json） > exec-approvals.json defaults > tools.exec（主配置） > 硬编码默认值
```

### 继承机制实现

**修改 `normalizeExecApprovals()`**：

```typescript
export function normalizeExecApprovals(
  file: ExecApprovalsFile,
  toolsExec?: {
    security?: string | null;
    ask?: string | null;
    askFallback?: string | null;
    autoAllowSkills?: boolean | null;
  },
): ExecApprovalsFile {
  return {
    ...file,
    defaults: {
      security: file.defaults?.security ?? resolveSecurityFromToolsExec(toolsExec?.security),
      ask: file.defaults?.ask ?? resolveAskFromToolsExec(toolsExec?.ask),
      askFallback:
        file.defaults?.askFallback ?? resolveSecurityFromToolsExec(toolsExec?.askFallback),
      autoAllowSkills: file.defaults?.autoAllowSkills ?? toolsExec?.autoAllowSkills ?? false,
    },
  };
}
```

### 辅助函数

```typescript
function resolveSecurityFromToolsExec(value: string | null | undefined): ExecSecurity {
  if (value === "allowlist" || value === "full" || value === "deny") {
    return value;
  }
  return DEFAULT_SECURITY;
}

function resolveAskFromToolsExec(value: string | null | undefined): ExecAsk {
  if (value === "off" || value === "on-miss" || value === "always") {
    return value;
  }
  return DEFAULT_ASK;
}
```

### 配置设计原则

- 单一配置来源优先：如果可能，避免同一功能在多个地方配置
- 清晰的优先级规则：让用户明确知道哪个配置会生效
- 继承机制：子配置应该从父配置继承默认值
- UI 显示来源：明确告诉用户值从哪里来

### 配置文件职责划分

- 主配置文件：定义基础设置和默认值
- 运行时配置文件：管理动态策略和覆盖
- 避免重复：不要在两个地方配置相同的默认值

## 通用开发经验

### 构建工作流

```
修改后端代码（.ts）  → pnpm build
修改 UI 代码（.tsx）  → pnpm ui:build
修改配置文件（.json） → 重启 gateway
```

### 配置数据加载流程

```
WebSocket 连接建立 → onHello → applySnapshot → loadConfig → configSnapshot 可用 → UI 渲染
```

### 配置验证的双重机制

- TypeScript 类型检查：编译时检查
- Zod Schema 验证：运行时验证
- 两者必须同步更新

### 提交前的检查流程

1. 运行 `git status` 查看所有更改
2. 运行 `git diff HEAD --stat` 查看更改统计
3. 查看最近的提交记录以匹配风格
4. 运行完整的检查：`pnpm check`（lint、format、tsgo等）

### 调试技巧

- 使用浏览器开发者工具查看 API 请求
- 检查实际传递的数据，而不是预期数据
- 使用 `grep` 搜索配置项的所有定义位置
- 硬刷新页面（Ctrl + Shift + R）清除浏览器缓存

### 类型安全的重要性

- 定义明确的类型
- 使用 TypeScript 确保类型正确
- 同步更新所有相关的类型定义
- 避免运行时类型错误

### 用户体验考虑

- 隐藏的功能不应该在配置界面中显示
- 保持 UI 的一致性和逻辑性
- 减少用户困惑，只显示可用的选项
- 根据用户习惯设置合理的默认值
