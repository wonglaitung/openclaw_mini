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

## 跨平台路径处理

### Windows vs WSL 的路径差异

**问题背景：**

- 代码中假设系统在 WSL（Windows Subsystem for Linux）中运行
- 实际系统可能是原生 Windows
- 路径转换逻辑错误导致权限验证失败

**错误代码示例：**

```typescript
// 错误：总是将 Windows 路径转换为 WSL 格式
if (/^[A-Za-z]:[\\/]/.test(filePath)) {
  const drive = filePath[0].toLowerCase();
  const restPath = filePath.substring(2).replace(/\\/g, "/");
  resolvedPath = `/mnt/${drive}/${restPath}`;
}
```

**正确代码示例：**

```typescript
// 正确：根据平台选择路径处理方式
const isWindows = process.platform === "win32";

if (isWindows) {
  // Windows 平台，直接使用 Windows 路径
  resolvedPath = path.resolve(filePath);
} else {
  // WSL/Unix 平台，转换 Windows 路径
  if (/^[A-Za-z]:[\\/]/.test(filePath)) {
    const drive = filePath[0].toLowerCase();
    const restPath = filePath.substring(2).replace(/\\/g, "/");
    resolvedPath = `/mnt/${drive}/${restPath}`;
  } else {
    resolvedPath = path.resolve(filePath);
  }
}
```

### 平台检测的重要性

**关键原则：**

1. **使用 `process.platform` 而非路径特征判断**
   - `process.platform === "win32"` - 原生 Windows
   - `process.platform === "linux"` - Linux 或 WSL
   - `process.platform === "darwin"` - macOS

2. **路径特征只能作为辅助验证**
   - `/^[A-Za-z]:[\\/]/.test(path)` - Windows 绝对路径
   - `/^\/mnt\//.test(path)` - WSL 挂载点
   - 这些特征不能可靠区分平台

### 路径规范化的最佳实践

**跨平台路径处理流程：**

```typescript
import path from "node:path";
import os from "node:os";

// 1. 解析为绝对路径
const absolutePath = path.resolve(inputPath);

// 2. 规范化路径（统一分隔符、解析 .. 和 .）
const normalizedPath = path.normalize(absolutePath);

// 3. 根据平台进行处理
if (process.platform === "win32") {
  // Windows: 使用反斜杠，但 path.normalize() 会处理
  // 直接比较即可
} else {
  // Linux/macOS/WSL: 使用正斜杠
  // 如果遇到 Windows 路径，需要转换
  if (/^[A-Za-z]:[\\/]/.test(inputPath)) {
    // Windows 路径 → WSL 路径
    const drive = inputPath[0].toLowerCase();
    const restPath = inputPath.substring(2).replace(/\\/g, "/");
    resolvedPath = `/mnt/${drive}/${restPath}`;
  }
}
```

### 路径比较的注意事项

**常见陷阱：**

1. **混合路径分隔符**
   - Windows: `C:\Users\file.txt` vs `C:/Users/file.txt`
   - 解决：使用 `path.normalize()` 统一

2. **大小写敏感**
   - Windows: 不区分大小写
   - Linux/macOS: 区分大小写
   - 解决：比较前统一大小写或使用平台特定的比较方法

3. **符号链接和硬链接**
   - 需要解析真实路径
   - 使用 `fs.realpathSync()` 解析

**正确比较示例：**

```typescript
function pathsEqual(path1: string, path2: string): boolean {
  const norm1 = path.normalize(path.resolve(path1));
  const norm2 = path.normalize(path.resolve(path2));

  if (process.platform === "win32") {
    return norm1.toLowerCase() === norm2.toLowerCase();
  }
  return norm1 === norm2;
}

function isSubdirectory(parent: string, child: string): boolean {
  const normParent = path.normalize(path.resolve(parent));
  const normChild = path.normalize(path.resolve(child));

  if (process.platform === "win32") {
    normParent = normParent.toLowerCase();
    normChild = normChild.toLowerCase();
  }

  // 确保父路径以分隔符结尾
  const parentWithSep = normParent.endsWith(path.sep) ? normParent : normParent + path.sep;

  return normChild.startsWith(parentWithSep);
}
```

## 预设目录豁免机制

### 设计原则

**为什么需要预设目录豁免：**

1. **系统必需目录**
   - OpenClaw 的配置和状态目录
   - 用户数据存储目录
   - 临时文件目录

2. **用户体验考虑**
   - 不需要手动配置常用目录
   - 避免因配置错误导致功能失效
   - 降低使用门槛

3. **安全性考虑**
   - 预设目录通常是安全的
   - 限制在用户主目录下
   - 避免暴露系统敏感目录

### 实现方法

**在路径验证前检查：**

```typescript
export function isPathInAllowedDirectories(
  targetPath: string,
  allowedDirectories: string[],
): boolean {
  const path = require("path") as typeof import("path");
  const os = require("os") as typeof import("os");

  // 1. 规范化目标路径
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  // 2. 检查预设豁免目录（最高优先级）
  const openclawDirBase = path.join(os.homedir(), ".openclaw");
  const normalizedOpenclawDir = path.normalize(path.resolve(openclawDirBase));

  if (
    normalizedTarget === normalizedOpenclawDir ||
    normalizedTarget.startsWith(normalizedOpenclawDir + path.sep)
  ) {
    return true; // 总是允许访问
  }

  // 3. 检查用户配置的允许目录
  return allowedDirectories.some((allowedDir) => {
    const normalizedAllowed = path.normalize(path.resolve(allowedDir));
    return (
      normalizedTarget === normalizedAllowed || normalizedTarget.startsWith(normalized + path.sep)
    );
  });
}
```

### 豁免目录的选择

**应豁免的目录：**

1. **OpenClaw 自身目录**
   - `~/.openclaw/` - 配置、状态、日志
   - `~/.openclaw/workspace/` - 工作区文件
   - `~/.openclaw/sessions/` - 会话记录
   - `~/.openclaw/agents/` - Agent 配置

2. **用户数据目录**
   - `~/Documents/` - 用户文档（可选）
   - `~/Desktop/` - 桌面文件（可选）
   - `~/Downloads/` - 下载文件（可选）

3. **临时目录**
   - `~/.openclaw/tmp/` - 临时文件
   - `os.tmpdir()` - 系统临时目录（谨慎）

**不应豁免的目录：**

1. **系统目录**
   - `C:\Windows\` - Windows 系统目录
   - `/etc/` - Linux 配置目录
   - `/root/` - 超级用户目录

2. **其他用户目录**
   - `/home/otheruser/` - 其他用户的家目录
   - `C:\Users\OtherUser\` - 其他用户目录

3. **敏感目录**
   - `~/.ssh/` - SSH 密钥（除非需要）
   - `~/.aws/` - AWS 凭证（除非需要）
   - `/var/log/` - 系统日志

### 配置文件中的提示

**在配置文件中添加注释说明：**

```json
{
  "tools": {
    "fs": {
      "workspaceOnly": false,
      "allowedDirectories": [
        "C:\\Users\\gyyz-laitungwong\\My Projects\\AIAgentLab\\openclaw_mini",
        "C:\\Users\\gyyz-laitungwong\\Documents",
        "C:\\Users\\gyyz-laitungwong\\Desktop"
      ],
      "_comment": "Note: ~/.openclaw directory is always allowed, no need to add it here"
    }
  }
}
```

**在 UI 中显示提示：**

```html
<div class="callout info" style="margin-top: 8px">
  <strong>Note:</strong> The OpenClaw workspace directory (~/.openclaw) is always allowed and does
  not need to be added to the allowed directories list.
</div>
```

## 技能开发进阶

### 跨平台路径处理（Python）

**问题：**

- Windows 用户可能输入 `~\Documents\file.txt`（混合格式）
- Linux 用户可能输入 `~/Documents/file.txt`
- 需要在 Python 中统一处理

**解决方案：path_utils.py**

```python
from pathlib import Path

def normalize_path(raw_path: str) -> str:
    """Normalize path to unified format (forward slashes)."""
    # 1. Tilde expansion (~ to home directory)
    path = Path(raw_path).expanduser()

    # 2. Convert to absolute path if not already
    if not path.is_absolute():
        path = path.resolve()

    # 3. Normalize to forward slashes for consistency
    return str(path).replace('\\', '/')

def validate_file_path(raw_path: str) -> Path:
    """Validate that path exists and is a file."""
    path = Path(raw_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Path does not exist: {path}")
    if not path.is_file():
        raise ValueError(f"Path is not a file: {path}")
    return path
```

**使用方式：**

```python
# 在脚本中使用
from anomaly_detector.path_utils import normalize_path, validate_file_path

# 规范化路径
normalized = normalize_path("~/Documents\\My Projects/data.csv")
# 结果: C:/Users/username/Documents/My Projects/data.csv

# 验证文件路径
path = validate_file_path(user_input)
```

### 时间序列分析参数设计

**lookback 参数设计：**

```python
# 将 --lookback 和 --time-interval 转换为天数
time_interval_to_days = {
    'minute': 1 / 1440,  # 1分钟 = 1/1440天
    'hour': 1 / 24,      # 1小时 = 1/24天
    'day': 1,            # 1天 = 1天
    'week': 7,           # 1周 = 7天
}

# 计算实际天数
if args.lookback is not None:
    days_per_unit = time_interval_to_days.get(args.time_interval, 1)
    args.lookback_days = args.lookback * days_per_unit
```

**使用场景区分：**

```
历史回测模式：
┌────────────────────────────────────────────┐
│  ←────────── 全部历史数据 ──────────→      │
│  检测所有异常点                            │
└────────────────────────────────────────────┘

实时监控模式：
┌────────────────────────────────────────────┐
│  历史数据（训练）         │  检测窗口     │
│  ←─── window-size ───→    │←─ lookback ─→│
│  计算基准、训练模型        │  报告异常     │
└────────────────────────────────────────────┘
```

### Excel 模板字段检测策略

**布局检测逻辑：**

```python
def detect_layout(ws):
    """
    检测 Excel 模板的布局类型。

    返回：
    - ('horizontal', 0): 水平布局，字段名在首行
    - ('vertical', col_idx): 垂直布局，字段名在 col_idx 列
    """
    # 1. 检查首行（水平布局）
    first_row_fields = count_fields_in_row(ws, 1)

    # 2. 扫描所有列（垂直布局）
    max_vertical_fields = 0
    best_column = 1
    for col in range(1, ws.max_column + 1):
        field_count = count_fields_in_column(ws, col)
        if field_count > max_vertical_fields:
            max_vertical_fields = field_count
            best_column = col

    # 3. 选择得分最高的布局
    if first_row_fields >= max_vertical_fields:
        return ('horizontal', 0)
    else:
        return ('vertical', best_column)
```

**匹配策略优先级：**

```
自定义映射 > 精确匹配 > 模糊匹配
```

### 技能模块复用

**共享工具模块：**

```
skills/
├── anomaly-detector/
│   └── anomaly_detector/
│       ├── path_utils.py    # 跨平台路径工具
│       ├── __init__.py      # 导出公共接口
│       └── ...
└── excel-auto-fill/
    └── excel_auto_fill/
        ├── path_utils.py    # 复制相同的路径工具
        └── ...
```

**最佳实践：**

1. **共享工具放在 `__init__.py` 导出**
2. **相同的工具可以复制到多个技能**（避免跨技能依赖）
3. **文档中说明工具的用途和用法**

### 技能文档结构

**SKILL.md 必需章节：**

```markdown
---
name: skill-name
description: 技能描述
---

# Skill Name

## 检查操作系统

## 何时使用此技能

## 使用场景

## 核心能力

## 当前限制

## 安装依赖

## 使用流程

### Windows 用户

### Linux/macOS 用户

## 命令行参数

## 数据格式要求

## 常见问题
```

**关键要点：**

1. **YAML frontmatter** 必须包含 `name` 和 `description`
2. **操作系统检测** 帮助用户选择正确的命令
3. **使用场景** 让用户快速判断是否适用
4. **命令行参数表格** 提供完整参考
5. **常见问题** 减少支持负担

## 调试日志的最佳实践

## License Key 系统设计

### 安全架构

**问题：对称加密密钥存储在客户端**

如果使用对称加密（AES），密钥存储在客户端会导致安全问题：

- 客户端可以读取密钥
- 客户端可以自行生成任意 License

**解决方案：公钥签名验证**

```
管理员端（离线、安全环境）:
  私钥 (private.key) → 签名生成 license.key

客户端:
  公钥 (public.key) → 验证 license.key 签名
  license.key → 包含用户名 + 到期日 + 签名
```

**为什么安全：**

1. **客户端无法伪造 License**：没有私钥无法生成有效签名
2. **公钥可以公开**：客户端持有公钥只能验证，不能签名
3. **适合离线环境**：无需在线服务器验证

### 跨平台用户名获取

```typescript
function getCurrentUsername(env: NodeJS.ProcessEnv): string | null {
  if (process.platform === "win32") {
    // Windows: 优先 USERNAME 环境变量
    return env.USERNAME?.trim() || os.userInfo().username?.trim() || null;
  } else {
    // Linux/macOS: 优先 USER 或 LOGNAME 环境变量
    return env.USER?.trim() || env.LOGNAME?.trim() || os.userInfo().username?.trim() || null;
  }
}
```

### 有效期限制

- License 有效期最长 180 天（半年）
- 过期后 24 小时宽限期
- 宽限期内警告但允许运行

### 文件位置

| 角色   | 文件                  | 说明                   |
| ------ | --------------------- | ---------------------- |
| 管理员 | `admin/private.key`   | RSA 私钥，离线安全保管 |
| 管理员 | `admin/public.key`    | RSA 公钥，分发给客户端 |
| 客户端 | `configs/public.key`  | 公钥（验证签名）       |
| 客户端 | `configs/license.key` | 签名后的 License       |

### 使用流程

```bash
# 1. 生成密钥对（管理员，安全环境）
node scripts/license-generator.mjs generate-keys \
  --private-output admin/private.key \
  --public-output configs/public.key

# 2. 创建 License（管理员）
node scripts/license-generator.mjs create \
  --username "gyyz-laitungwong" \
  --valid-days 30 \
  --private-key admin/private.key \
  --output configs/license.key

# 3. 验证 License（客户端启动时自动执行）
node scripts/license-generator.mjs verify \
  --license configs/license.key \
  --public-key configs/public.key
```

### 使用结构化日志系统

**问题：直接使用 console.log**

```typescript
// 不推荐：直接使用 console.log
console.log(`[read tool] Path validation:`, {
  filePath,
  resolvedPath,
  allowedDirectories: options.allowedDirectories,
  platform: process.platform,
  isWindows,
});
```

**推荐：使用 createSubsystemLogger**

```typescript
// 推荐：使用结构化日志系统
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agents/pi-tools-read");

log.debug(`[read tool] Path validation:`, {
  filePath,
  resolvedPath,
  allowedDirectories: options.allowedDirectories,
  platform: process.platform,
  isWindows,
});
```

### 日志级别的使用

**日志级别指南：**

| 级别    | 用途           | 示例                    |
| ------- | -------------- | ----------------------- |
| `debug` | 详细的调试信息 | 路径解析过程、参数验证  |
| `info`  | 一般信息       | 功能启用/禁用、配置加载 |
| `warn`  | 警告信息       | 配置错误、兼容性问题    |
| `error` | 错误信息       | 权限拒绝、文件不存在    |

**示例：**

```typescript
// Debug: 详细过程
log.debug(`Path validation details:`, {
  input: filePath,
  normalized: resolvedPath,
  allowed: allowedDirectories,
  result: isAllowed,
});

// Info: 重要状态
log.info(`Allowed directories configured: ${allowedDirectories.length}`);

// Warn: 配置问题
log.warn(`Allowed directory does not exist: ${dir}`);

// Error: 权限问题
log.error(`Access denied to path: ${filePath}`);
```

### 日志的上下文信息

**包含关键上下文：**

```typescript
log.debug(`Path validation`, {
  // 输入参数
  filePath,
  allowedDirectories,

  // 处理过程
  resolvedPath,
  normalizedTarget,
  normalizedAllowed,

  // 环境信息
  platform: process.platform,
  isWindows: process.platform === "win32",
  homedir: os.homedir(),

  // 结果
  isAllowed,
  reason: isAllowed ? "in allowed list" : "not in allowed list",
});
```

### 条件日志

**避免生产环境的性能影响：**

```typescript
// 不推荐：总是构建日志对象
log.debug(`Debug info: ${JSON.stringify(expensiveComputation())}`);

// 推荐：先检查日志级别
if (log.isDebugEnabled()) {
  const details = expensiveComputation();
  log.debug(`Debug info:`, details);
}
```

### 日志与错误处理

**在错误消息中包含调试信息：**

```typescript
try {
  const isAllowed = isPathInAllowedDirectories(resolvedPath, allowedDirectories);
  log.debug(`Path validation result:`, {
    path: filePath,
    resolved: resolvedPath,
    allowed: isAllowed,
  });

  if (!isAllowed) {
    log.error(`Access denied: ${filePath}`, {
      resolvedPath,
      allowedDirectories,
      platform: process.platform,
    });
    throw createFsAccessError("EACCES", filePath);
  }
} catch (error) {
  log.error(`Path validation failed:`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    filePath,
    allowedDirectories,
  });
  throw error;
}
```

### UI 输入框样式优化

### 问题

**Allowed Directories 输入框太短，难以输入长路径**

### 解决方案

**使用百分比宽度：**

```typescript
<input
  class="field mono"
  .value=${dir}
  @input=${(e: Event) => updateDirectory(index, (e.target as HTMLInputElement).value)}
  ?disabled=${!editable}
  placeholder="/path/to/directory"
  autocomplete="off"
  style="width: 80%;"  // 添加宽度样式
/>
```

**优势：**

1. **响应式设计**：自动适应页面宽度
2. **易于维护**：不需要硬编码像素值
3. **用户友好**：足够的空间输入长路径

### 进一步优化建议

**考虑其他布局选项：**

1. **全宽输入框**：`width: 100%`
2. **flex 布局**：自动填充剩余空间
3. **可调整大小**：添加 resize 功能

**示例：使用 flex 布局**

```html
<div style="display: flex; gap: 8px; align-items: center;">
  <input class="field mono" style="flex: 1; min-width: 0;" .value="${dir}" @input="${...}" />
  <button class="btn btn--sm" @click="${...}">✕</button>
</div>
```
