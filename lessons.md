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
