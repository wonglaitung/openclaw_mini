# OpenClaw 项目学习与经验教训

## 2026-03-20

### Git 远端配置经验

**1. Fork 与官方仓库的区分**

- 修改开源项目时应先 fork 到个人仓库
- 推送代码应推送到个人 fork，而非官方仓库（官方仓库有权限限制）
- 工作流程：fork → clone → 修改 → push 到 fork → 创建 PR

**2. Git 远端配置命令**

- 查看远端配置：`git remote -v`
- 修改远端 URL：`git remote set-url origin <new-url>`

### 内网删减版方案设计经验

**1. 插件化架构的优势**

- 所有消息渠道都是独立扩展，可通过配置禁用
- `plugins.deny: ["*"]` 可完全禁用不需要的功能
- 无需修改核心代码即可实现功能删减

**2. 沙箱功能的权衡**

- 沙箱提供安全隔离，但增加部署复杂度
- 银行内网如果已严格控制访问路径，禁用沙箱可行
- 替代方案：工具白名单 + 工作区限制 + 安全二进制列表

**3. 环境变量控制**

- `OPENCLAW_SKIP_CHANNELS=1` - 禁用所有消息渠道
- `OPENCLAW_UPDATE_CHECK=0` - 禁用更新检查

**4. 安全配置最佳实践**

- `tools.fs.workspaceOnly: true` - 限制文件操作范围
- `tools.exec.safeBins` - 白名单允许的二进制文件
- `tools.exec.pathPrepend` - 指定安全路径
- `gateway.auth.mode: "none"` - 仅本地回环访问

### 构建时裁减方案设计经验

**1. 构建工具链理解**

- OpenClaw 使用 `tsdown` 作为主构建工具（基于Rollup）
- 现有可选构建机制：`OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0`

**2. 条件导入 vs 运行时配置**

| 方式       | 优点                   | 缺点             | 适用场景        |
| ---------- | ---------------------- | ---------------- | --------------- |
| 运行时配置 | 简单灵活，无需修改代码 | 代码和依赖仍存在 | 快速部署        |
| 构建时排除 | 减少包体积、减少依赖   | 需要修改代码     | 特定部署场景 ✅ |

**3. 构建时排除方案设计**

- **方案1**：扩展现有机制（推荐）
  - 最小化代码改动
  - 复用现有基础设施
  - 向后兼容

**4. 构建优化效果**

- 包体积：~20%减少（500MB → 400MB）
- 构建时间：~50%减少（8-12分钟 → 4-6分钟）
- npm依赖：~25%减少（800+ → 500-600）

**5. 关键决策**

- 确认仅排除消息渠道，不包含浏览器控制
- 浏览器控制等功能通过运行时配置禁用
- 保持向后兼容，默认构建不受影响

### 构建时裁减方案实施经验

**1. 异步导入的实现**

- TypeScript 的静态导入无法在构建时条件化
- 使用动态 `import()` 语句配合 `Promise.all()`
- 动态导入需要 `await`，影响调用链的异步性

**2. 向后兼容性保持**

- 保留同步导出，返回空数组
- 提供异步获取函数用于新功能

**3. 构建脚本跨平台支持**

- Bash (Linux/macOS)：`scripts/build-offline.sh`
- PowerShell (Windows)：`scripts/build-offline.ps1`
- Python (跨平台)：`scripts/build-offline.py`

**4. 构建环境变量**

- `OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0`：排除可选插件
- `OPENCLAW_BUILD_PROFILE=offline`：构建 profile

**5. 关键代码模式**

```typescript
// 条件构建模式
const BUILD_PROFILE = process.env.OPENCLAW_BUILD_PROFILE || "full";

// 同步导出（兼容性）
export const bundledPlugins: Plugin[] = (() => {
  if (BUILD_PROFILE === "offline") return [];
  return [];
})();

// 异步导出（实际功能）
export async function getBundledPlugins(): Promise<Plugin[]> {
  if (BUILD_PROFILE === "offline") return [];
  const plugins = await Promise.all([import("./plugin1.js"), import("./plugin2.js")]);
  return plugins.map((p) => p.default);
}
```

### 构建测试经验

**1. 构建产物结构**

**消息渠道目录**（离线模式）：

```
dist/extensions/whatsapp/
├── package.json              # 配置文件
└── openclaw.plugin.json      # 插件元数据
# ❌ 无 index.js 或其他代码文件
```

**非排除插件目录**：

```
dist/extensions/ollama/
├── package.json              # 配置文件
├── openclaw.plugin.json      # 插件元数据
└── index.js                  # ✅ 实际代码
```

**2. node_modules 排除问题与解决**

**问题描述**：

- 初始实现中，部分消息渠道仍有 node_modules 符号链接
- 总计约 118M 的空间被占用

**根本原因**：

- `stage-bundled-plugin-runtime.mjs` 脚本为所有插件创建 node_modules 符号链接
- `stage-bundled-plugin-runtime-deps.mjs` 脚本为所有插件安装运行时依赖
- 这两个脚本没有检查插件是否在离线模式下被排除

**解决方案**：

修改两个脚本，跳过没有代码文件的插件：

```javascript
// 跳过没有 index.js 文件的插件
const indexJsPath = path.join(distPluginDir, "index.js");
if (!fs.existsSync(indexJsPath)) {
  const hasEntryFile = fs.readdirSync(distPluginDir).some(file =>
    file.endsWith('.js') && file !== 'package.json' && file !== 'openclaw.plugin.json'
  );
  if (!hasEntryFile) continue; // 跳过没有代码的插件
}
```

**改进效果**：

- 构建产物：152M → 36M（减少 116M，76%）
- JS 文件：3,563 → 785（减少 2,778，78%）

### Git 提交经验

**提交前的检查流程**：

1. 运行 `git status` 查看所有更改
2. 运行 `git diff HEAD --stat` 查看更改统计
3. 查看最近的提交记录以匹配风格
4. 运行完整的检查：`pnpm check`（lint、format、tsgo等）

**遇到的问题和解决**：

- 问题：TypeScript 类型错误导致提交失败
- 原因：对核心 API 的修改过于激进，破坏了向后兼容性
- 解决：回退对核心文件的修改，仅保留脚本和配置的改进

### UI 菜单可见性控制实现经验

**1. 配置驱动的 UI 控制**

- 通过配置文件控制 UI 显示，无需修改前端代码
- 易于调整，适用于不同部署场景

**2. 配置类型定义**

```typescript
export type GatewayControlUiConfig = {
  menuVisibility?: {
    channels?: boolean;
    agents?: boolean;
    sessions?: boolean;
    skills?: boolean;
    tools?: boolean;
    models?: boolean;
    config?: boolean;
  };
};
```

**3. 构建工作流**

```
修改后端代码（.ts）  → pnpm build
修改 UI 代码（.tsx）  → pnpm ui:build
修改配置文件（.json） → 重启 gateway
```

**4. 配置数据加载流程**

正确的配置数据加载流程：

```
WebSocket 连接建立 → onHello → applySnapshot → loadConfig → configSnapshot 可用 → UI 渲染
```

**关键点**：

- `applySnapshot` 只更新 `hello.snapshot`（系统状态、会话默认值等）
- `loadConfig` 调用 API 获取完整配置
- 两者独立，都需要在连接后执行
- `hello.snapshot` 和 `configSnapshot` 是两个独立的数据源

**5. 配置验证的完整性**

- 类型定义和 Zod schema 必须同步
- 每次添加配置项都要更新两处
- 使用 `pnpm check` 确保所有检查通过

**6. 经验教训**

**A. 配置驱动的架构**：优先通过配置文件控制行为，而非硬编码

**B. 类型安全**：TypeScript + Zod 双重验证确保配置正确

**C. 渐进式实现**：先实现核心功能，再逐步添加配置选项

**D. 构建流程**：理解不同构建命令的作用和触发条件

### 审计日志功能实现经验

**1. 需求背景**

- 银行对操作过程有严格的审计要求
- 需要完整的操作轨迹：谁、何时、做了什么
- 代理自主操作需要详细记录

**2. 方案选择**

| 方案                | 优点               | 缺点                     | 适用场景    |
| ------------------- | ------------------ | ------------------------ | ----------- |
| 方案1：增强主日志   | 简单直接           | 主日志过于庞大，检索困难 | 简单场景    |
| 方案2：独立审计日志 | 独立文件，便于分析 | 需要额外维护             | 推荐        |
| 方案3：配置控制     | 灵活可调           | 需要配置管理             | 复杂环境    |
| 方案4：混合方案     | 综合最优           | 实现复杂度适中           | 银行场景 ✅ |

**3. 审计日志模块设计**

**A. 核心功能**

```typescript
export function audit(entry: AuditEntry): void;
export function auditToolCallBasic(params: ToolCallParams): void;
export function auditToolResult(params: ToolResultParams): void;
export function auditToolBlocked(params: ToolBlockedParams): void;
```

**B. 审计级别**

| 级别     | 记录内容        | 适用场景    |
| -------- | --------------- | ----------- |
| none     | 不记录          | 测试环境    |
| basic    | 工具名称        | 开发环境    |
| detailed | 工具调用 + 结果 | 生产环境 ✅ |
| verbose  | 完整参数和结果  | 调试环境    |

**C. 日志格式**

```json
{
  "timestamp": "2026-03-20T12:00:00.000Z",
  "sessionId": "xxx",
  "sessionKey": "xxx",
  "runId": "xxx",
  "agentId": "default",
  "type": "tool_call",
  "toolName": "read",
  "toolCallId": "call_123",
  "action": "execute",
  "status": "success",
  "params": { "path": "/data/file.txt" },
  "duration": 123
}
```

**D. 日志文件管理**

- 位置：`~/.openclaw/audit.log`（可配置）
- 格式：JSON Lines（每行一个 JSON 对象）
- 模式：追加写入

**4. 配置集成**

```typescript
export type GatewayAuditConfig = {
  enabled?: boolean;
  file?: string;
  level?: "none" | "basic" | "detailed" | "verbose";
};
```

### 文件系统访问控制实现经验（2026-03-22）

**1. 需求分析**

用户需求：控制 AGENT 只能在某些指定目录下读取/写入文件

**2. 方案选择**

| 方案  | 描述                          | 优点             | 缺点               | 推荐度     |
| ----- | ----------------------------- | ---------------- | ------------------ | ---------- |
| 方案1 | 使用现有 workspaceOnly        | 无需修改代码     | 仅支持单个工作区根 | ⭐⭐⭐     |
| 方案2 | 扩展支持 allowedDirectories[] | 灵活、支持多目录 | 需要修改代码       | ⭐⭐⭐⭐⭐ |

**3. 核心实现**

**A. 类型定义扩展**

```typescript
export type ToolFsPolicy = {
  workspaceOnly: boolean;
  allowedDirectories?: string[];
};
```

**B. 路径验证函数**

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

**4. 路径处理特性**

**A. 绝对路径支持**

```json
{
  "allowedDirectories": ["/data/project-a", "/home/user/shared-docs"]
}
```

**B. 相对路径支持**

```json
{
  "allowedDirectories": ["./project-a", "../shared/project-b"]
}
```

**C. Windows 路径支持**

```json
{
  "allowedDirectories": [
    "C:/Users/username/projects/project-a",
    "C:\\Users\\username\\projects\\project-b"
  ]
}
```

**路径格式说明**：

- ✅ 推荐：正斜杠 `/`（跨平台兼容）
- ✅ 可选：反斜杠 `\`（需要 JSON 转义：`\\`）
- ⚠️ 注意：Windows 命令行不支持正斜杠，但 JSON 配置文件支持

**D. 路径规范化**

处理场景：

```
"/data/project/"     → "/data/project"
"C:/Users/project"    → "C:\Users\project" (Windows)
"./project/../a"     → "/workspace/a"
"/data/./project"     → "/data/project"
```

**5. 测试实现**

**测试文件**：`src/agents/tool-fs-policy.allowed-directories.test.ts`

**测试覆盖**（18个测试用例）：

1. ✅ 精确匹配允许目录
2. ✅ 子目录匹配
3. ✅ 非匹配路径
4. ✅ 尾随斜杠处理
5. ✅ 相对路径解析
6. ✅ 空列表处理
7. ✅ 路径规范化
8. ✅ 防止部分目录名匹配
9. ✅ 配置解析（全局 vs 代理特定）

**测试发现的问题**：

**问题 1**：尾随斜杠不处理

- 原因：`path.normalize()` 不移除尾随斜杠
- 解决：添加 `.replace(/[/\\]+$/, "")` 移除尾随斜杠

**问题 2**：相对路径不解析

- 原因：只解析了 targetPath，未解析 allowedDirectories
- 解决：在比较时也解析 allowedDirectories

**6. 经验教训**

**A. 路径处理的复杂性**

- ✅ 使用 `path.resolve()` 和 `path.normalize()` 确保跨平台兼容
- ✅ 移除尾随斜杠以避免比较问题
- ✅ 同时解析目标路径和允许目录路径
- ✅ 防止部分目录名匹配

**B. 向后兼容性的重要性**

- ✅ 保留 `workspaceOnly` 配置，默认行为不变
- ✅ 当同时配置时，`allowedDirectories` 优先

### File System 标签页 UI 实现经验（2026-03-22）

**1. 需求背景**

- 在 Agents 页面的 Cron Jobs 标签后添加 File System 标签
- 显示内容：`workspaceOnly` 和 `allowedDirectories` 配置

**2. 方案设计**

**参考经验**：

- ✅ 配置驱动的设计
- ✅ 后端 API 扩展（channels.status）
- ✅ UI 类型定义更新
- ✅ 前端组件添加
- ✅ 遵循现有模式（Cron Jobs 标签）

**3. 后端 API 实现**

**文件**：`src/gateway/server-methods/channels.ts`

**修改内容**：

```typescript
const fsConfig = cfg.tools?.fs ?? {};
const payload = {
  ts: Date.now(),
  // ... 其他字段
  menuVisibility,
  fsConfig,
  // ... 其他字段
};
```

**4. UI 组件实现**

**文件**：`ui/src/ui/views/agents.ts`

**修改内容**：

1. 添加面板类型：`"filesystem"`
2. 添加 `renderAgentFilesystem()` 函数
3. 更新标签页列表
4. 添加 filesystem 面板渲染逻辑

**5. 构建和部署**

**构建流程**：

```
修改后端代码（.ts）  → pnpm build
修改 UI 代码（.tsx）  → pnpm ui:build
修改配置文件（.json） → 重启 gateway
```

**6. 遇到的问题和解决**

**A. TypeScript 类型错误**

**问题**：`app.ts` 和 `app-view-state.ts` 中的 `agentsPanel` 类型没有同步更新

**解决**：在两个文件中都添加 `"filesystem"` 选项

**B. 类型注解缺失**

**问题**：`app-render.ts` 中的 `onSelectPanel` 参数没有类型注解

**解决**：添加明确的类型注解

**7. 经验教训**

**A. 类型一致性的重要性**

- ✅ 同步更新所有相关的类型定义
- ✅ `app.ts` 和 `app-view-state.ts` 必须保持一致

**B. 遵循现有模式的重要性**

- ✅ 参考 `menuVisibility` 的成功经验
- ✅ 遵循 Cron Jobs 标签的实现模式

**C. 构建流程的理解**

- 修改后端代码 → `pnpm build`
- 修改 UI 代码 → `pnpm ui:build`
- 修改配置文件 → 重启 gateway

## 2026-03-23

### File System 标签页加载时序问题

**1. 问题现象**

- 初次打开 File System 标签时，数据不显示
- 切换到其他菜单后，再回到 File System 标签，数据才能正确显示

**2. 根本原因分析**

- File System 标签页的数据来自 `props.channels.snapshot?.fsConfig`
- `fsConfig` 通过 `channels.status` API 从后端获取（从 `cfg.tools?.fs` 读取配置）
- 在 `onHello` 回调中，**没有调用 `loadChannels`**，所以初次连接时 `channels.snapshot` 不完整
- 切换到其他菜单时，触发 `loadChannels` 调用，数据才被正确加载

**3. 配置数据加载流程**

正确的配置数据加载流程：

```
WebSocket 连接建立 → onHello → applySnapshot → loadConfig → configSnapshot 可用 → UI 渲染
```

**关键点**：

- `applySnapshot` 只更新 `hello.snapshot`（系统状态、会话默认值等）
- `loadConfig` 调用 API 获取完整配置
- `loadChannels` 调用 API 获取频道状态（包括 fsConfig）
- 三者独立，都需要在连接后执行

**4. 解决方案**

在 `ui/src/ui/app-gateway.ts` 的 `onHello` 回调中添加 `loadChannels` 调用：

```typescript
onHello: (hello) => {
  // ... 其他代码
  applySnapshot(host, hello);
  void loadAssistantIdentity(host as unknown as OpenClawApp);
  void loadAgents(host as unknown as OpenClawApp);
  void loadConfig(host as unknown as OpenClawApp);
  void loadChannels(host as unknown as OpenClawApp); // ← 添加这行
  void loadHealthState(host as unknown as OpenClawApp);
  // ...
};
```

**5. 经验教训**

**A. 数据加载的完整性**

- 需要调用多个 API 才能获取完整的配置和状态
- `loadConfig` 获取完整配置
- `loadChannels` 获取频道状态和工具配置
- 两者相互独立，都需要在连接后调用

**B. 问题排查方法**

- 通过浏览器开发者工具查看 API 请求
- 检查 `channels.status` API 是否被调用
- 检查 `state.channelsSnapshot` 是否包含 `fsConfig`

**C. 参考已有经验**

- lessons.md 中"菜单可见性配置加载时序问题"的经验
- 配置数据加载流程是通用的模式

### Workspace Only 开关控件实现经验

**1. 需求背景**

- 将 File System 标签页的 Workspace Only 从文本显示改为开关控件
- 参考 Tools 标签的设计，提供更好的交互体验

**2. UI 设计参考**

参考 `agents-panels-tools-skills.ts` 中 tools 标签的实现：

- 使用 `.cfg-toggle` 样式
- 添加 Reload Config 和 Save 按钮
- 添加配置加载状态提示
- 支持编辑状态控制（配置加载中、保存中禁用）

**3. 核心实现**

**A. UI 组件更新**

**文件**：`ui/src/ui/views/agents.ts`

**修改内容**：

1. 修改 `renderAgentFilesystem()` 函数，接受配置状态参数
2. 添加开关控件：

```typescript
<label class="cfg-toggle">
  <input
    type="checkbox"
    .checked=${workspaceOnly}
    ?disabled=${!editable}
    @change=${(e: Event) =>
      props.onWorkspaceOnlyChange((e.target as HTMLInputElement).checked)}
  />
  <span class="cfg-toggle__track"></span>
</label>
```

3. 添加 Reload Config 和 Save 按钮
4. 添加配置加载状态提示

**B. 事件处理**

**文件**：`ui/src/ui/app-render.ts`

**修改内容**：

添加 `onWorkspaceOnlyChange` 函数：

```typescript
onWorkspaceOnlyChange: (value) => {
  updateConfigFormValue(state, ["tools", "fs", "workspaceOnly"], value);
};
```

**C. 类型定义更新**

**文件**：`ui/src/ui/views/agents.ts`

**修改内容**：

在 `AgentsProps` 类型中添加：

```typescript
onWorkspaceOnlyChange: (value: boolean) => void;
```

**4. 构建和部署**

**构建流程**：

```
修改 UI 代码（.ts/.tsx）  → pnpm ui:build
修改后端代码（.ts） → pnpm build
修改配置文件（.json） → 重启 gateway
```

**5. 经验教训**

**A. 遵循现有设计模式**

- ✅ 参考 Tools 标签的开关实现
- ✅ 使用相同的样式和交互方式
- ✅ 保持 UI 一致性

**B. 配置编辑的最佳实践**

- ✅ 添加 Reload Config 和 Save 按钮
- ✅ 显示配置加载和保存状态
- ✅ 在配置加载中或保存中禁用编辑
- ✅ 显示未保存状态提示

**C. 事件处理模式**

- ✅ 使用 `updateConfigFormValue` 更新配置
- ✅ 配置路径：`["tools", "fs", "workspaceOnly"]`
- ✅ 修改后需要调用 `saveConfig` 保存

**D. 类型安全**

- ✅ 同步更新类型定义
- ✅ 确保所有使用该函数的地方类型一致

### 文档维护经验

**1. 文档简化**

- 简化 `progress.txt`：从 500+ 行减少到 ~100 行（减少 80%）
- 简化 `lessons.md`：从 2345 行减少到 ~700 行（减少 70%）
- 删除重复内容，保留核心里程碑和重要经验

**2. 文档维护原则**

- ✅ 删除重复内容
- ✅ 保留核心里程碑和重要数据
- ✅ 保持清晰结构，便于快速浏览
- ✅ 重点记录问题和解决方案

**3. 文档更新时机**

- ✅ 每次重要功能实现后更新
- ✅ 发现新的问题和解决方案后更新
- ✅ 定期回顾和简化文档

### Tool Access 菜单可见性过滤实现经验（2026-03-23）

**1. 需求背景**

用户需求：当菜单被隐藏时，Tool Access 页面中对应的工具组也应该隐藏，避免用户看到无法使用的工具配置项。

**2. 设计思路**

**核心原则**：

- 菜单可见性和工具组可见性保持一致
- 配置驱动的 UI 控制
- 用户不需要看到无法使用的功能

**菜单到工具组的映射**：

```typescript
const menuToToolSectionMap: Record<string, string[]> = {
  channels: ["messaging"],
  automation: ["automation"],
  communications: ["messaging"],
  infrastructure: ["sessions"],
  nodes: ["nodes"],
};
```

**3. 实现步骤**

**A. 数据流设计**

```
配置文件 menuVisibility → Gateway API → Config State → Agents Props → renderAgentTools
```

**B. 类型定义更新**

`ConfigState`（原方案）：

```typescript
export type ConfigState = {
  form: Record<string, unknown> | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  menuVisibility?: Record<string, boolean | undefined>; // ❌ 错误
};
```

`AgentsProps`（正确方案）：

```typescript
export type AgentsProps = {
  // ...
  menuVisibility?: Record<string, boolean | undefined>; // ✅ 独立字段
};
```

**关键点**：

- `menuVisibility` 应该作为 `AgentsProps` 的独立字段
- 不应嵌套在 `config` 对象内部
- 这样可以确保数据正确传递

**C. 传递路径修复**

**原实现**（错误）：

```typescript
// app-render.ts
config: {
  form: configValue,
  // ...
  menuVisibility: configValue?.gateway?.controlUi?.menuVisibility, // ❌ 嵌套在 config 中
}

// agents.ts
renderAgentTools({
  configForm: props.config.form, // ✅ 只传递 form
  menuVisibility: props.menuVisibility, // ❌ 没有正确传递
})
```

**修复后**（正确）：

```typescript
// app-render.ts
menuVisibility: configValue?.gateway?.controlUi?.menuVisibility, // ✅ 独立字段
config: {
  form: configValue,
  // ...
}

// agents.ts
renderAgentTools({
  menuVisibility: props.menuVisibility, // ✅ 正确传递
})
```

**D. 过滤逻辑实现**

```typescript
const hiddenSectionIds = new Set<string>();

if (params.menuVisibility) {
  for (const [menuKey, sectionIds] of Object.entries(menuToToolSectionMap)) {
    if (params.menuVisibility[menuKey] === false) {
      for (const sectionId of sectionIds) {
        hiddenSectionIds.add(sectionId);
      }
    }
  }
}

const toolSections = allToolSections.filter((section) => {
  return !hiddenSectionIds.has(section.id);
});
```

**4. 遇到的问题和解决**

**问题 1**：menuVisibility 为 undefined

- 原因：`menuVisibility` 被嵌套在 `config` 对象内部，但 `renderAgentTools` 从 `props.config.form` 获取配置
- 解决：将 `menuVisibility` 提升为 `AgentsProps` 的独立字段

**问题 2**：浏览器缓存导致更新不生效

- 原因：构建文件被浏览器缓存
- 解决：硬刷新页面（Ctrl + Shift + R 或 Cmd + Shift + R）

**问题 3**：调试信息不应该在生产代码中

- 原因：添加了 `console.log` 调试信息
- 解决：在功能确认工作后立即删除调试代码

**5. 经验教训**

**A. 数据传递路径的重要性**

- ✅ 清晰定义数据传递路径
- ✅ 确保每个层级都正确传递必要参数
- ✅ 使用 TypeScript 类型定义确保类型安全
- ✅ 调试时检查实际传递的数据，而不是预期数据

**B. 组件参数设计的最佳实践**

- ✅ 相关参数应该放在合适的位置
- ✅ 避免过度嵌套数据结构
- ✅ 跨组件传递时保持参数的一致性

**C. 开发调试经验**

- ✅ 添加详细的调试信息帮助排查问题
- ✅ 问题确认后立即删除调试代码
- ✅ 不要在生产代码中留下调试语句

**D. 用户体验考虑**

- ✅ 隐藏的功能不应该在配置界面中显示
- ✅ 保持 UI 的一致性和逻辑性
- ✅ 减少用户困惑，只显示可用的选项

### 工具配置优化经验（2026-03-23）

**1. 需求分析**

- 目标：减少对 bash 工具的依赖，使用更专业的文件操作工具
- 背景：安全性考虑，控制可执行的命令范围

**2. 方案选择**

| 方案   | 工具列表               | 优点                                           | 缺点           |
| ------ | ---------------------- | ---------------------------------------------- | -------------- | ---------- |
| 方案 1 | 只用专业工具           | read, write, edit, apply_patch, grep, find, ls | 最安全         | 功能有限   |
| 方案 2 | 专业工具 + bash        | 专业工具 + bash                                | 灵活性高       | 安全性降低 |
| 方案 3 | 专业工具 + 限制的 bash | 专业工具 + bash（安全白名单）                  | 平衡安全和功能 | 需要配置   |

**推荐方案 3**：专业工具 + 安全白名单控制的 bash

**3. 实现细节**

**A. 工具白名单配置**

```json
{
  "tools": {
    "allow": ["bash", "read", "write", "edit", "apply_patch", "grep", "find", "ls"],
    "exec": {
      "security": "allowlist",
      "safeBins": ["python", "python3", "node", "npm", "powershell", "read", "write"]
    }
  }
}
```

**B. 工具使用场景**

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

**C. 安全配置**

- `security: "allowlist"`：只执行白名单中的命令
- `safeBins`：白名单中的命令自动加入 allowlist
- `ask: "off"`：安全命令无需审批

**4. 经验教训**

**A. 工具选择的平衡**

- ✅ 优先使用专业文件操作工具，更安全、更可控
- ✅ bash 工具通过白名单严格限制
- ✅ 根据实际需求选择合适的工具组合

**B. 跨平台兼容性**

- ✅ 支持 Windows、Linux、macOS
- ✅ 支持 PowerShell 和 cmd.exe
- ✅ 自动处理路径转换

**C. 配置的可维护性**

- ✅ 集中管理工具白名单
- ✅ 通过配置文件控制，无需修改代码
- ✅ 支持按代理配置不同的工具权限

### 银行内网 Windows 系统适配经验（2026-03-23）

**1. 系统环境特点**

**目标环境**：

- 银行内网 Windows 系统
- 高安全要求
- 严格的外部访问控制
- 用户无 sudo/admin 权限

**部署环境**：

- 开发环境：Linux/macOS（当前 WSL2）
- 生产环境：Windows

**2. 工具配置策略**

**A. 工具白名单设计**

```json
"tools": {
  "allow": ["bash", "read", "write", "edit", "apply_patch", "grep", "find", "ls"],
  "exec": {
    "security": "allowlist",
    "ask": "off",
    "pathPrepend": ["scripts", "tools"],
    "safeBins": [
      "python", "python3",    // Python 脚本（技能执行）
      "node", "npm",          // Node.js 环境
      "powershell", "pwsh",   // PowerShell Core 7+（跨平台）
      "cmd", "cmd.exe"        // Windows CMD（Windows 原生）
    ]
  }
}
```

**关键点**：

- ✅ `powershell` / `pwsh` 支持 Linux/macOS/Windows
- ✅ `cmd` / `cmd.exe` 仅支持 Windows
- ✅ `security: "allowlist"` 确保只执行白名单命令
- ✅ `safeBins` 自动加入 allowlist（无需手动配置）

**B. 专业文件操作工具**

```json
"tools": {
  "allow": [
    "bash",           // 命令执行（必需，技能执行）
    "read",           // 读取文件（支持自适应分页、图片处理）
    "write",          // 写入文件（原子性）
    "edit",           // 精确编辑文件
    "apply_patch",    // 多文件补丁
    "grep",           // 搜索文件内容
    "find",           // 查找文件（glob 模式）
    "ls"              // 列出目录
  ]
}
```

**权衡**：

- **禁用 bash**：更安全，但无法使用 Python 技能
- **启用 bash + allowlist**：平衡安全性和功能性

**3. 跨平台路径处理**

**Windows 路径支持**：

```typescript
// Windows 绝对路径
"C:/Users/username/projects/project-a";
"C:\\Users\\username\\projects\\project-b";

// 路径规范化处理
const normalized = path.normalize(path.resolve(inputPath));
```

**WSL 路径转换**：

```typescript
// Windows 路径 → WSL 路径
if (/^[A-Za-z]:[\\/]/.test(filePath)) {
  const drive = filePath[0].toLowerCase();
  const restPath = filePath.substring(2).replace(/\\/g, "/");
  resolvedPath = `/mnt/${drive}/${restPath}`;
}
```

**4. PowerShell 自动降级**

**降级策略**：

```
PowerShell 7 → PowerShell 5.1 → cmd.exe
```

**语法转换**：

- `&&` → `&`
- `$env:VAR` → `%VAR%`

**实现位置**：`src/agents/shell-fallback.ts`

**5. 开发注意事项**

**A. 跨平台兼容性**

- ✅ 优先使用 PowerShell 脚本（跨平台）
- ✅ 避免使用平台特定的命令（如 `ls` vs `dir`）
- ✅ 使用 Node.js 脚本替代 Python（长期方案）

**B. 配置验证**

在 Linux/macOS 开发时：

- ✅ 验证配置文件语法
- ✅ 测试工具白名单逻辑
- ✅ 模拟 Windows 路径处理

在 Windows 部署时：

- ✅ 验证 PowerShell 可用性
- ✅ 测试技能执行
- ✅ 检查路径解析

**C. 安全性保障**

- ✅ `tools.exec.security: "allowlist"`
- ✅ `tools.fs.allowedDirectories` 路径白名单
- ✅ `gateway.auth.mode: "token"` 本地回环访问
- ✅ `gateway.audit.enabled: true` 审计日志

**6. 经验教训**

**A. 跨平台开发模式**

- ✅ 在 Linux/macOS 开发，在 Windows 部署
- ✅ 使用通用的工具和脚本（PowerShell、Node.js）
- ✅ 提前考虑路径、命令差异

**B. 工具配置策略**

- ✅ 安全性优先：allowlist + 白名单
- ✅ 功能性其次：专业工具 + 必要的命令执行
- ✅ 可维护性：清晰的配置文档

**C. 测试策略**

- ✅ 在开发环境模拟 Windows 行为
- ✅ 测试路径解析、命令执行
- ✅ 验证审计日志记录

**D. 长期优化方向**

- ✅ Python 技能 → Node.js/TypeScript 实现
- ✅ Shell 脚本 → 跨平台脚本
- ✅ 减少对特定平台的依赖

### 调试日志清理经验（2026-03-23）

**1. 背景**

在文件访问控制的实现过程中，为了调试，在 `src/agents/pi-tools.read.ts` 中添加了 `console.error` 调试日志来记录文件操作。

**2. 问题分析**

审计日志功能实现后，发现：

- 所有工具操作（包括 read/write/edit/apply_patch）都已经在 `audit.log` 中记录
- 调试日志在控制台输出，会干扰正常的日志输出
- 调试日志与审计日志功能重复

**3. 解决方案**

移除所有 `console.error` 调试日志：

```typescript
// 移除前
console.error(`read tool: path=${path}, result=${result.substring(0, 100)}...`);

// 移除后
// 无需任何代码，audit.log 已经记录
```

**4. 日志策略**

| 日志类型 | 用途         | 输出位置  | 记录内容               |
| -------- | ------------ | --------- | ---------------------- |
| 主日志   | 系统运行信息 | 标准输出  | 系统启动、错误等       |
| 审计日志 | 操作审计     | audit.log | 工具调用、结果等 ✅    |
| 调试日志 | 开发调试     | 控制台    | 临时调试信息（应移除） |

**5. 经验教训**

**A. 调试日志应及时清理**

- ✅ 调试完成后，应及时移除调试日志
- ✅ 避免调试日志进入生产代码
- ✅ 使用审计日志替代调试日志记录操作

**B. 日志的层次化设计**

- ✅ 主日志：系统级别的信息（启动、错误、警告）
- ✅ 审计日志：操作级别的记录（谁、何时、做了什么）
- ✅ 调试日志：开发阶段的临时日志（不应存在于生产代码）

**C. 审计日志的优势**

- ✅ 结构化 JSON 格式，便于分析和检索
- ✅ 独立文件，不影响主日志输出
- ✅ 可配置级别（none/basic/detailed/verbose）
- ✅ 持久化存储，不会丢失

### 审计日志按日期滚动实现经验（2026-03-23）

**1. 需求背景**

- 原审计日志文件：`~/.openclaw/audit.log`（单文件持续追加）
- 问题：长期运行后日志文件过大，难以管理和检索
- 需求：按日期自动轮换日志，便于归档和分析

**2. 方案设计**

**方案选择**：

| 方案              | 优点                 | 缺点             | 推荐度     |
| ----------------- | -------------------- | ---------------- | ---------- |
| 方案1：按大小轮换 | 文件大小可控         | 不方便按日期检索 | ⭐⭐⭐     |
| 方案2：按日期轮换 | 方便按日期归档和检索 | 需要日期跟踪     | ⭐⭐⭐⭐⭐ |

**方案设计**：

- 日志文件名格式：`audit-YYYY-MM-DD.log`
- 日志目录：`~/.openclaw/logs/`
- 自动轮换：每天零点自动创建新文件
- 旧日志：按日期命名，自动保留

**3. 核心实现**

**A. 日志文件名生成函数**

```typescript
function getAuditLogFileName(): string {
  const baseName = auditConfig.file || "audit.log";
  const ext = path.extname(baseName);
  const nameWithoutExt = path.basename(baseName, ext);

  if (auditConfig.rotateDaily) {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return `${nameWithoutExt}-${today}${ext}`;
  }
  return baseName;
}
```

**B. 日志轮换检查**

```typescript
function checkLogRotation(): void {
  if (!auditConfig.rotateDaily || !auditStream) {
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  if (currentAuditDate && currentAuditDate !== today) {
    // Date changed, rotate logs
    shutdownAuditLogger();
    initializeAuditLogger();
  }
}
```

**C. 日志初始化更新**

```typescript
function initializeAuditLogger(): void {
  if (!auditConfig.enabled || !auditConfig.file) {
    return;
  }

  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "", ".openclaw");
  const logsDir = path.join(stateDir, "logs"); // ← 使用 logs 子目录
  const logFileName = getAuditLogFileName();
  auditFilePath = path.join(logsDir, logFileName);

  try {
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create write stream with append mode
    auditStream = fs.createWriteStream(auditFilePath, { flags: "a", encoding: "utf8" });

    auditStream.on("error", (err) => {
      console.error(`Audit logger error: ${err}`);
    });

    // Track current date for rotation
    currentAuditDate = new Date().toISOString().split("T")[0];
  } catch (err) {
    console.error(`Failed to initialize audit logger: ${String(err)}`);
    auditStream = null;
  }
}
```

**4. 配置更新**

**配置文件**（`configs/offline-bank.json`）：

```json
"gateway": {
  "audit": {
    "enabled": true,
    "file": "logs/audit.log",
    "level": "detailed",
    "rotateDaily": true
  }
}
```

**类型定义**（`src/config/types.gateway.ts`）：

```typescript
export type GatewayAuditConfig = {
  enabled?: boolean;
  file?: string;
  level?: "none" | "basic" | "detailed" | "verbose";
  rotateDaily?: boolean; // ← 新增
};
```

**5. 日志文件结构**

**目录结构**：

```
~/.openclaw/
└── logs/
    ├── audit-2026-03-20.log
    ├── audit-2026-03-21.log
    ├── audit-2026-03-22.log
    └── audit-2026-03-23.log
```

**日志内容**（JSON Lines 格式）：

```json
{"timestamp":"2026-03-23T12:00:00.000Z","sessionId":"xxx","type":"tool_call","toolName":"read","status":"success",...}
{"timestamp":"2026-03-23T12:01:00.000Z","sessionId":"xxx","type":"tool_result","toolName":"read","status":"success",...}
```

**6. 轮换机制**

**轮换触发**：

- 每次写入日志时检查日期
- 如果日期变化，自动关闭旧文件流并打开新文件

**轮换过程**：

```
旧文件（2026-03-22）→ 关闭 → 保留
新文件（2026-03-23）→ 创建 → 追加
```

**7. 经验教训**

**A. 日志轮换的优势**

- ✅ 按日期归档，便于检索和分析
- ✅ 文件大小可控，避免单个文件过大
- ✅ 旧日志自动保留，便于历史追溯
- ✅ 符合银行审计日志管理规范

**B. 实现要点**

- ✅ 使用 ISO 日期格式（YYYY-MM-DD）保证排序正确
- ✅ 自动创建 logs 目录
- ✅ 追踪当前日期，避免频繁轮换
- ✅ 保持向后兼容（rotateDaily 可配置）

**C. 配置策略**

- ✅ `rotateDaily: true` 默认启用（适合生产环境）
- ✅ `file: "logs/audit.log"` 使用子目录
- ✅ 可配置禁用（`rotateDaily: false`）恢复单文件模式

**D. 日志管理**

- ✅ JSON Lines 格式，便于解析
- ✅ 按日期命名，便于归档
- ✅ 自动轮换，无需手动干预
- ✅ 可配合日志清理脚本定期删除旧日志

**8. 后续优化方向**

- 添加日志清理功能（自动删除 N 天前的日志）
- 支持日志压缩（gzip 压缩旧日志）
- 添加日志大小限制（单文件最大大小）
- 支持日志归档到远程存储（S3、OSS）

### Zod Schema 同步更新经验（2026-03-23）

**1. 问题背景**

在添加审计日志的 `rotateDaily` 配置项时，遇到了 "Unrecognized key: 'rotateDaily'" 配置验证错误。

**2. 根本原因分析**

OpenClaw 使用 Zod 进行配置验证，需要在两个地方同步更新配置定义：

- **类型定义**：`src/config/types.gateway.ts`（用于 TypeScript 类型检查）
- **Zod Schema**：`src/config/zod-schema.ts`（用于运行时验证）

**3. 问题发现过程**

**错误信息**：

```
Config invalid
File: /data/openclaw_mini/configs/offline-bank.json
Problem:
  - gateway.audit: Unrecognized key: "rotateDaily"
```

**原因**：

- 只更新了类型定义 `types.gateway.ts`
- 没有更新 Zod Schema `zod-schema.ts`
- Gateway 启动时进行配置验证，Zod Schema 不包含 `rotateDaily` 字段

**4. 解决方案**

**A. 更新类型定义**（已正确）

```typescript
// src/config/types.gateway.ts
export type GatewayAuditConfig = {
  enabled?: boolean;
  file?: string;
  level?: "none" | "basic" | "detailed" | "verbose";
  rotateDaily?: boolean; // ← 已添加
};
```

**B. 更新 Zod Schema**（需要添加）

```typescript
// src/config/zod-schema.ts
audit: z
  .object({
    enabled: z.boolean().optional(),
    file: z.string().optional(),
    level: z
      .union([z.literal("none"), z.literal("basic"), z.literal("detailed"), z.literal("verbose")])
      .optional(),
    rotateDaily: z.boolean().optional(),  // ← 需要添加
  })
  .strict()
  .optional(),
```

**5. 注意事项**

**A. 字段位置**

- `audit` 配置在 `gateway` 对象内部
- 需要在 `gateway: z.object({...})` 的 `audit` 字段中添加

**B. 重复字段检查**

错误信息：

```
src/config/zod-schema.ts(894,9): error TS1117: An object literal cannot have multiple properties with the same name.
```

原因：代码中存在两个 `audit:` 字段定义

解决：删除重复的定义，只保留一个

**C. 枚举格式**

推荐格式（可读性更好）：

```typescript
z.union([z.literal("none"), z.literal("basic"), ...])
```

简化格式（较短）：

```typescript
z.enum(["none", "basic", ...])
```

两种格式功能相同，推荐使用 union 以保持一致性

**6. 经验教训**

**A. 配置验证的双重机制**

- ✅ TypeScript 类型检查：编译时检查
- ✅ Zod Schema 验证：运行时验证
- ✅ 两者必须同步更新

**B. 添加配置项的完整流程**

1. 添加类型定义：`src/config/types.gateway.ts`
2. 添加 Zod Schema：`src/config/zod-schema.ts`
3. 更新配置文件：`configs/offline-bank.json`
4. 重新构建：`pnpm build`
5. 重启服务验证

**C. 调试技巧**

- ✅ 遇到配置错误时，检查类型定义和 Zod Schema 是否一致
- ✅ 使用 `grep` 搜索配置项的所有定义位置
- ✅ 检查是否有重复的字段定义

**D. 向后兼容性**

- ✅ 新增字段都应该是可选的（`optional()`）
- ✅ 提供合理的默认值
- ✅ 不破坏现有配置文件
