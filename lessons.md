# OpenClaw 项目学习与经验教训

## 项目初始化与构建优化

### Git 工作流

- 修改开源项目前先 fork 到个人仓库
- 推送代码到个人 fork，而非官方仓库

### 插件化架构

- 消息渠道和插件可通过配置禁用
- `plugins.deny: ["*"]` 完全禁用不需要的功能

### 构建时裁减

| 方式       | 优点             | 缺点           | 适用场景 |
| ---------- | ---------------- | -------------- | -------- |
| 运行时配置 | 简单灵活         | 代码和依赖仍在 | 快速部署 |
| 构建时排除 | 减少包体积和依赖 | 需修改代码     | 特定部署 |

### 安全配置

- `tools.fs.workspaceOnly: true` 限制文件操作范围
- `tools.exec.safeBins` 白名单允许的二进制文件
- `gateway.auth.mode: "token"` 本地回环访问

## 文件系统访问控制

### 路径处理特性

- 支持绝对/相对路径、跨平台兼容
- 自动规范化、子目录自动允许
- 防止部分目录名匹配

### 测试覆盖

- 18 个测试用例，全部通过

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

### 继承机制

- 子配置从父配置继承默认值
- 清晰的优先级规则
- 避免重复配置

### 配置验证

- TypeScript 类型检查（编译时）
- Zod Schema 验证（运行时）
- 两者必须同步更新

## 审计日志

### 日志文件管理

- 位置：`~/.openclaw/logs/audit-YYYY-MM-DD.log`
- 格式：JSON Lines
- 自动轮换：每天零点

### 日志策略

| 日志类型 | 用途         | 输出位置  |
| -------- | ------------ | --------- |
| 主日志   | 系统运行信息 | 标准输出  |
| 审计日志 | 操作审计     | audit.log |

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

## 用户体验

- 隐藏的功能不应在配置界面显示
- 保持 UI 一致性和逻辑性
- 根据用户习惯设置合理默认值
- UI 响应式布局支持小屏幕

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

### 配置更新要点

- 菜单项需同时更新三个位置：类型定义、Zod schema、配置文件
- 使用 `.strict()` 模式防止未定义的配置项通过验证
- UI 渲染逻辑需与 schema 验证规则保持一致
- 修改默认行为前需评估对现有配置的影响

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

### 依赖管理

- 每个技能的 `scripts/` 目录独立管理依赖
- 使用 `npm init -y` 初始化
- 常用依赖：
  - `pdf-parse`：PDF 文本提取
  - `tesseract.js`：OCR 文字识别
  - `pdfjs-dist`：高级 PDF 处理

### 错误处理最佳实践

```javascript
// 依赖检查
let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (error) {
  console.error("错误: 缺少依赖");
  console.error("请运行: npm install pdf-parse");
  process.exit(1);
}

// 错误处理
try {
  const data = await readPDF(filePath);
  // 处理数据
} catch (error) {
  console.error(`错误: ${error.message}`);
  process.exit(1);
}
```

### 命令行参数解析

```javascript
function parseArgs(args) {
  const options = {
    filePath: null,
    page: null,
    output: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("--")) {
      options.filePath = arg;
      continue;
    }

    const [key, value] = arg.substring(2).split("=");
    options[key] = value || args[++i];
  }

  return options;
}
```

### 输出格式标准化

**JSON 格式**：

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

**错误格式**：

```json
{
  "success": false,
  "error": "错误描述"
}
```

### OCR 实现要点

1. **语言支持**
   - 简体中文：`chi_sim`
   - 繁体中文：`chi_tra`
   - 英文：`eng`
   - 混合：`chi_sim+eng`

2. **性能优化**
   - 按页面处理，避免内存溢出
   - 使用进度条显示识别进度
   - 保存中间结果

3. **输出组织**
   ```
   ocr_output/
   ├── page_1.png      # 渲染图片
   ├── page_1.txt      # 识别文本
   ├── page_2.png
   ├── page_2.txt
   └── ocr_summary.json # 汇总信息
   ```

### 技能测试检查清单

- [ ] 依赖包正确安装
- [ ] 无参数运行显示帮助信息
- [ ] 文件不存在时给出清晰错误提示
- [ ] 输出格式符合规范
- [ ] 支持常用选项（--page, --output 等）
- [ ] 错误处理完善
- [ ] 文档完整且准确

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

### 构建系统依赖分析

**关键入口点：**

- `tsdown.config.ts` - 定义构建入口点
- `knip.config.ts` - 定义未使用代码检查
- `src/plugin-sdk/` - 为扩展提供 SDK 接口

**扩展 SDK 的作用：**

- 为扩展提供统一的 API 接口
- 处理扩展的加载、初始化和通信
- 在 `src/` 中有大量对 `extensions/` 的导入

**删除扩展的影响：**

- 构建系统依赖扩展的存在
- 删除扩展会导致 `tsdown.config.ts` 中的入口点解析失败
- 删除扩展会导致 `knip.config.ts` 中的配置验证失败

### 构建配置的正确方式

**离线构建脚本（推荐）：**

```bash
# 设置环境变量
export OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0
export OPENCLAW_BUILD_PROFILE=offline

# 运行构建
pnpm build
```

**效果：**

- 构建产物：37M（从 152M 减少 76%）
- JS 文件：826 个（从 3,563 个减少 77%）
- 不包含任何消息渠道
- 不包含可选插件
- 适合银行内网部署

### 共享代码引用问题

**问题：**

- `src/agents/tool-display.ts` 和 `ui/src/ui/tool-display.ts` 都引用了 `apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json`
- 删除 `apps/` 后导致 UI 构建失败

**解决方案：**

1. 移除对 `apps/shared/` 的引用
2. 改为使用 `src/agents/tool-display-overrides.json` 作为配置源
3. 保持配置数据的完整性

**修改示例：**

```typescript
// 修改前
import SHARED_TOOL_DISPLAY_JSON from "../../../apps/shared/...";

// 修改后
import TOOL_DISPLAY_OVERRIDES_JSON from "../../../src/agents/tool-display-overrides.json";
const SHARED_TOOL_DISPLAY_CONFIG = {} as ToolDisplayConfig;
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

### 回滚策略

**Git 回滚命令：**

```bash
# 回退到指定提交
git reset --hard <commit-hash>

# 回退并保留更改
git revert <commit-hash>
```

**经验教训：**

- 删除前先提交当前工作
- 保留回退选项
- 小步骤验证（每次只删除一个目录）
- 构建失败立即停止并分析原因

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

### 离线构建的配置文件

**environment variables（环境变量）：**

```bash
OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0  # 排除可选 bundles
OPENCLAW_BUILD_PROFILE=offline          # 使用离线构建配置
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

### 构建产物验证

**验证脚本：**

```bash
# 检查包大小
du -sh dist/

# 检查 JS 文件数量
find dist/ -name "*.js" | wc -l

# 检查是否包含不必要的文件
find dist/ -name "*telegram*" -o -name "*whatsapp*" -o -name "*slack*"
```

**预期结果：**

- 包大小：~37M
- JS 文件数：~826
- 不包含任何消息渠道相关的文件
