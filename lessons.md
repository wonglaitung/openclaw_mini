# OpenClaw 项目学习与经验教训

## Git 工作流

- 修改开源项目前先 fork 到个人仓库
- 推送代码到个人 fork，而非官方仓库

## 插件化架构

- 消息渠道和插件可通过配置禁用
- `plugins.deny: ["*"]` 完全禁用不需要的功能

## 构建时裁减

| 方式       | 优点             | 缺点           | 适用场景 |
| ---------- | ---------------- | -------------- | -------- |
| 运行时配置 | 简单灵活         | 代码和依赖仍在 | 快速部署 |
| 构建时排除 | 减少包体积和依赖 | 需修改代码     | 特定部署 |

## 安全配置

- `tools.fs.workspaceOnly: true` 限制文件操作范围
- `tools.exec.safeBins` 白名单允许的二进制文件
- `gateway.auth.mode: "token"` 本地回环访问

## Windows 系统适配

### PowerShell 降级

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

### 平台检测

```typescript
if (process.platform === "win32") {
  // Windows 平台，直接使用 path.normalize()
} else {
  // WSL/Unix 平台，转换 Windows 路径
}
```

## 配置管理

### 配置优先级

```
Agent 覆盖 > 运行时配置 defaults > 主配置 tools.exec > 硬编码默认值
```

### 配置同步检查

```
类型定义 (types.gateway.ts)
    ↓
Zod Schema (zod-schema.ts)
    ↓
配置文件 (configs/offline-bank.json)
    ↓
UI 渲染 (app-render.ts)
```

任一修改需同步更新其他位置，避免类型不匹配或验证失败。

## 开发工作流

### 构建流程

```
修改后端代码 → pnpm build
修改 UI 代码   → pnpm ui:build
修改配置文件   → 重启 gateway
```

### 提交前检查

1. `git status` 查看更改
2. `git diff HEAD --stat` 查看统计
3. `pnpm check` 完整检查

### 调试技巧

- 使用浏览器开发者工具查看 API 请求
- 检查实际传递的数据
- 使用 `grep` 搜索配置项
- 硬刷新页面（Ctrl + Shift + R）

## 菜单可见性配置

### 默认行为设计

```typescript
// 修改前：默认显示（除非设为 false）
const isTabVisible = (tabKey: string): boolean => {
  return menuVisibility?.[tabKey] !== false;
};

// 修改后：默认隐藏（除非设为 true）
const isTabVisible = (tabKey: string): boolean => {
  return menuVisibility?.[tabKey] === true;
};
```

## 技能开发

### 技能目录结构

```
skills/{skill_name}/
├── SKILL.md              # 技能文档（YAML frontmatter + Markdown）
└── scripts/
    ├── package.json      # Node.js 依赖配置
    ├── read_pdf.js       # 核心脚本
    ├── ocr_pdf.js        # OCR 识别脚本
    └── extract_images.js # 图片提取脚本
```

### 技能文档规范

**SKILL.md 必须包含：**

1. **YAML Frontmatter**

   ```yaml
   ---
   name: skill_name
   description: 技能描述
   ---
   ```

2. **核心章节**
   - Overview（概述）
   - Quick Start（快速开始）
   - Core Capabilities（核心功能）
   - Usage（使用方法）
   - Examples（示例）
   - Notes（注意事项）
   - Troubleshooting（故障排除）
   - Dependencies（依赖说明）
   - Resources（资源说明）

### 输出格式标准化

**JSON 格式：**

```json
{
  "success": true,
  "metadata": {
    "pages": 10,
    "title": "Document Title"
  },
  "data": {
    // 实际数据
  }
}
```

**错误格式：**

```json
{
  "success": false,
  "error": "错误描述"
}
```

## Bank Deployment 重构经验

### 代码依赖关系的复杂性

**关键教训：**

- 源代码中有大量对 `extensions/` 目录的引用
- 物理删除扩展会导致 100+ 个构建错误
- 简单的删除操作会破坏构建系统

**解决方案：**

- 使用环境变量控制功能包含：`OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0`
- 使用构建配置文件控制：`OPENCLAW_BUILD_PROFILE=offline`
- 保持代码完整性，通过配置而非删除来实现裁减

### 安全删除的原则

**可以安全删除的内容：**

1. **独立项目**：与核心构建无关的独立项目
   - `apps/` - 客户端应用（Android、iOS、macOS）
   - `Swabble/` - 独立的 Swift 工具项目
   - `skills.backup/` - 备份目录

2. **构建产物**：可以随时重新生成
   - `dist/` - 构建输出
   - `dist-runtime/` - 迟行时构建产物

3. **测试文件**：不影响运行（可选删除）
   - `test/` - 测试代码
   - `test-fixtures/` - 测试固件

**不能删除的内容：**

1. **核心源代码**：构建和运行必需
   - `src/` - 核心 Gateway 代码
   - `extensions/` - 扩展插件（代码中有大量引用）

2. **配置和脚本**：构建和部署必需
   - `scripts/` - 构建脚本
   - `configs/` - 配置文件
   - `package.json` - 依赖管理

3. **依赖和工具**
   - `node_modules/` - npm 依赖
   - `vendor/` - 第三方依赖

### 离线构建的配置文件

**environment variables（环境变量）：**

```bash
OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0  # 排除可选 bundles
OPENCLAW_BUILD_PROFILE=offline          # 使用离线构建配置
OPENCLAW_A2UI_SKIP_MISSING=1            # 跳过 A2UI bundling
```

**configs/offline-bank.json 关键配置：**

```json
{
  "plugins": {
    "enabled": true,
    "allow": ["memory-core", "memory-lancedb"]
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "controlUi": {
      "menuVisibility": {
        "chat": true,
        "overview": true,
        "usage": true,
        "cron": true,
        "agents": true,
        "config": true,
        "nodes": true,
        "logs": true
      }
    },
    "auth": {
      "mode": "token",
      "token": "your-token-here"
    },
    "audit": {
      "enabled": true,
      "file": "logs/audit.log",
      "level": "detailed",
      "rotateDaily": true
    }
  },
  "tools": {
    "fs": {
      "workspaceOnly": false,
      "allowedDirectories": ["/home/user/shared-docs"]
    },
    "exec": {
      "security": "allowlist",
      "pathPrepend": ["scripts", "tools"],
      "safeBins": ["python", "python3", "node", "npm", "powershell", "pwsh", "cmd", "cmd.exe"]
    }
  }
}
```

### 大规模代码删除的风险评估

**删除前的必要检查：**

1. 搜索所有对该目录的引用
2. 检查构建配置文件中的依赖
3. 评估对测试的影响
4. 确认不影响核心功能

**验证方法：**

```bash
# 搜索引用
grep -r "apps/" src/ --include="*.ts" --include="*.js" | head -20

# 检查构建配置
grep "extensions/" tsdown.config.ts knip.config.ts

# 尝试构建
pnpm build
```

### 项目精简的最佳实践

**分层删除法：**

1. 第一层：删除完全独立的项目（apps、Swabble）
2. 第二层：删除可重新生成的产物（dist、dist-runtime）
3. 第三层：删除不必要的文档和测试（docs/、test/、test-fixtures/）
4. 第四层：根据需要删除扩展（需仔细评估依赖关系）

**渐进式验证：**

```bash
# 删除一个目录 → 验证构建 → 提交
rm -rf apps/
pnpm build
git commit -m "remove apps/"

# 删除下一个目录 → 验证构建 → 提交
rm -rf Swabble/
pnpm build
git commit -m "remove Swabble/"
```

## A2UI Bundling 问题与解决

### 问题背景

**A2UI 的作用：**

- Canvas tool display UI for mobile apps (Android/iOS)
- 在 WebView 中显示工具 UI
- 与 mobile apps 通过 WebSocket 通信

**删除 apps/ 的影响：**

- A2UI sources 位于 `apps/shared/OpenClawKit/Tools/CanvasA2UI/`
- A2UI renderer 位于 `vendor/a2ui/renderers/lit/`
- 删除 apps/ 后，缺少 A2UI sources
- bundle-a2ui.sh 失败：缺少 sources 和 prebuilt bundle

### 解决方案

**修改 build 脚本：**

```json
"build": "bash -c 'if [ \"$OPENCLAW_BUILD_PROFILE\" = \"offline\" ] || [ \"$OPENCLAW_A2UI_SKIP_MISSING\" = \"1\" ]; then echo \"Skipping A2UI bundle (offline build)\"; else pnpm canvas:a2ui:bundle; fi' && node scripts/tsdown-build.mjs && ... && node --import tsx scripts/canvas-a2ui-copy.ts && ..."
```

**原理：**

- 检查环境变量 `OPENCLAW_BUILD_PROFILE` 或 `OPENCLAW_A2UI_SKIP_MISSING`
- 如果为 offline 或 skip，跳过 `canvas:a2ui:bundle`
- 继续执行后续构建步骤
- `canvas-a2ui-copy.ts` 检测到 `OPENCLAW_A2UI_SKIP_MISSING=1` 时优雅跳过

### 离线构建脚本更新

**所有离线构建脚本都添加：**

```bash
export OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0
export OPENCLAW_BUILD_PROFILE=offline
export OPENCLAW_A2UI_SKIP_MISSING=1
```

### 经验教训

**1. 构建系统的脆弱性**

- 简单的删除操作可能破坏构建链
- 需要理解每个构建步骤的依赖关系

**2. 环境变量的作用**

- `OPENCLAW_BUILD_PROFILE`：控制构建行为（offline/docker/normal）
- `OPENCLAW_INCLUDE_OPTIONAL_BUNDLED`：控制可选 bundles 的包含
- `OPENCLAW_A2UI_SKIP_MISSING`：控制 A2UI 构建的跳过

**3. 渐进式修改原则**

- 一次只修改一个地方
- 修改后立即验证
- 保持回退选项

## UI 样式优化

### 问题与解决

**需求：**

- 为 Overview 页面的 reset token 按钮添加红色背景
- 突出危险操作的重要性

**遇到的问题：**

1. `.btn.danger` 使用 `var(--danger-subtle)` CSS 变量，透明度只有 0.08，几乎看不见
2. 添加专用样式 `.btn--icon.danger` 可能被其他 CSS 规则覆盖

**最终解决方案：使用内联样式**

```typescript
<button
  type="button"
  class="btn btn--icon"
  style="width: 36px; height: 36px; background: rgba(239, 68, 68, 0.2); color: #dc2626; border-color: transparent;"
  title="Reset token"
  aria-label="Reset token"
  @click=${async () => {
    if (window.confirm(
      "Are you sure you want to reset the gateway token? This will invalidate all existing connections."
    )) {
      await props.onResetToken();
    }
  }}
>
  ${icons.refresh}
</button>
```

**内联样式的优势：**

1. **最高优先级**：内联样式不受 CSS 层叠规则影响
2. **简单直接**：不需要修改 CSS 文件
3. **可维护性**：样式定义在组件内部，易于理解
4. **跨主题兼容**：不依赖 CSS 变量，适用于所有主题

### 经验教训

**1. CSS 变量的透明度陷阱**

- 需要检查 CSS 变量的实际值，不要假设
- 对于危险操作，需要更明显的视觉提示

**2. CSS 层叠的复杂性**

- 添加新类可能被其他规则覆盖
- 内联样式可以避免这些复杂性

**3. 渐进式调试方法**

- 先添加 CSS 类，验证效果
- 如果不可见，检查 CSS 变量值
- 如果被覆盖，提高特异性或使用内联样式

**4. 删除不必要的修改**

- 一旦找到有效方案，删除所有尝试性修改
- 保持代码简洁，避免冗余
- 使用 `git reset --soft` 回退中间提交

**5. Git 工作流的重要性**

```bash
# 回退到有效提交之前
git reset --soft <commit-hash>

# 清理所有中间修改
git restore <files>

# 只保留最终方案
git add <final-files>
git commit -m "final solution"
```

## 测试检查清单

**离线构建验证：**

- [ ] 离线构建成功（无错误）
- [ ] 构建产物大小符合预期（~37M）
- [ ] 服务启动正常
- [ ] Gateway UI 可访问
- [ ] 核心功能正常（聊天、agents、工具）
- [ ] A2UI 请求返回 503（预期行为）