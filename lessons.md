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
