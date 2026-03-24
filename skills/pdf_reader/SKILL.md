---
name: pdf_reader
description: 使用 Node.js 读取和解析 PDF 文件内容，支持提取文本、获取页面信息、处理加密 PDF 等功能。适用于需要从 PDF 文档中提取文本内容、分析文档结构、批量处理 PDF 文件的场景。
---

# PDF Reader

## Overview

使用 Node.js 读取和解析 PDF 文件，提取文本内容、页面信息和元数据。

## Quick Start

### 读取 PDF 文本内容

读取 PDF 文件的所有文本内容：

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf
```

### OCR 识别扫描型 PDF

对扫描型 PDF 进行文字识别：

```bash
cd {baseDir}/scripts
node ocr_pdf.js /path/to/scanned.pdf
```

### 提取 PDF 中的图片

提取 PDF 文件中的所有图片：

```bash
cd {baseDir}/scripts
node extract_images.js /path/to/document.pdf
```

### 读取指定页面

读取 PDF 的指定页面文本：

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf --page 1
```

### 获取 PDF 元数据

获取 PDF 文件的元信息：

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf --metadata
```

### 处理加密 PDF

使用密码读取加密的 PDF：

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/encrypted.pdf --password "your-password"
```

## Core Capabilities

### 1. 提取 PDF 文本

提取 PDF 中的所有文本内容，支持：

- 完整文本提取
- 按页面提取文本
- 保留基本的文本格式
- 处理中文字符

### 2. OCR 文字识别

使用 Tesseract OCR 引擎识别扫描型 PDF 中的文字：

- 支持多语言识别（简体中文、繁体中文、英文等）
- 批量处理多页 PDF
- 输出识别文本和置信度
- 保存渲染的页面图片

### 3. 提取 PDF 图片

从 PDF 文件中提取图片：

- 渲染 PDF 页面为高质量图片
- 支持指定页面或页面范围
- 支持 PNG 和 JPEG 格式
- 获取图片信息和元数据

### 4. 获取页面信息

获取 PDF 的页面信息：

- 总页数
- 指定页面的文本内容
- 页面尺寸信息

### 5. PDF 元数据

提取 PDF 的元数据：

- 标题
- 作者
- 创建日期
- 修改日期
- PDF 版本

### 6. 加密 PDF 支持

支持使用密码读取受密码保护的 PDF 文件

## Usage

### 基本用法

**读取完整 PDF 文本**:

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf
```

**读取指定页面**:

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf --page 1
```

**读取多个页面**:

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf --page 1,2,3
```

**获取元数据**:

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf --metadata
```

**处理加密 PDF**:

```bash
cd {baseDir}/scripts
node read_pdf.js /path/to/document.pdf --password "secret"
```

### 输出格式

脚本返回 JSON 格式的数据：

```json
{
  "success": true,
  "metadata": {
    "pages": 10,
    "title": "Document Title",
    "author": "Author Name",
    "creator": "Creator",
    "producer": "Producer",
    "creationDate": "2026-03-24T00:00:00.000Z",
    "modificationDate": "2026-03-24T00:00:00.000Z"
  },
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page 1 text content...",
      "charCount": 1250
    }
  ]
}
```

## Command Options

| 选项                  | 说明                      | 示例                   |
| --------------------- | ------------------------- | ---------------------- |
| `--page <number>`     | 读取指定页面（从 1 开始） | `--page 1`             |
| `--pages <range>`     | 读取多个页面（逗号分隔）  | `--pages 1,3,5`        |
| `--range <start-end>` | 读取页面范围              | `--range 1-5`          |
| `--metadata`          | 仅显示元数据，不提取文本  | `--metadata`           |
| `--password <pwd>`    | PDF 密码（加密文件）      | `--password "secret"`  |
| `--output <file>`     | 输出到文件（JSON 格式）   | `--output result.json` |
| `--format <type>`     | 输出格式：json 或 text    | `--format text`        |

## Examples

### 示例 1：读取完整 PDF

**用户请求**: "读取这个 PDF 文件的内容 /path/to/report.pdf"

**执行步骤**:

1. 使用脚本调用: `node read_pdf.js /path/to/report.pdf`
2. 脚本解析 PDF 并提取所有页面的文本
3. 返回完整文本内容

**示例输出**:

```json
{
  "success": true,
  "pages": 5,
  "text": "Page 1 content...\n\nPage 2 content..."
}
```

### 示例 2：读取指定页面

**用户请求**: "只读取 PDF 的第一页 /path/to/document.pdf"

**执行步骤**:

1. 使用脚本调用: `node read_pdf.js /path/to/document.pdf --page 1`
2. 脚本只提取第 1 页的内容
3. 返回单页文本

### 示例 3：获取 PDF 信息

**用户请求**: "获取这个 PDF 的基本信息 /path/to/file.pdf"

**执行步骤**:

1. 使用脚本调用: `node read_pdf.js /path/to/file.pdf --metadata`
2. 脚本提取 PDF 元数据
3. 返回文件信息

**示例输出**:

```json
{
  "success": true,
  "pages": 10,
  "title": "Annual Report 2025",
  "author": "Company Inc.",
  "creationDate": "2025-12-31T00:00:00.000Z"
}
```

### 示例 4：处理加密 PDF

**用户请求**: "读取加密的 PDF /path/to/secret.pdf，密码是 abc123"

**执行步骤**:

1. 使用脚本调用: `node read_pdf.js /path/to/secret.pdf --password "abc123"`
2. 脚本使用密码解密并读取内容
3. 返回解密后的文本

## Notes

- 支持大多数标准的 PDF 文件格式
- 对于扫描的 PDF（图片），需要先进行 OCR 处理
- 某些复杂的 PDF 格式（如表单、富文本）可能无法完全提取
- 大文件处理可能需要较长时间
- 中文字符支持良好，使用 UTF-8 编码

## Troubleshooting

### 无法读取 PDF

- 检查文件路径是否正确
- 确认文件是否为有效的 PDF 格式
- 检查文件权限

### 文本提取不完整

- 某些 PDF 使用特殊编码，可能导致文本无法提取
- 扫描型 PDF（图片）需要使用 OCR 工具
- 尝试使用不同的页面范围

### 中文乱码

- 确保使用 UTF-8 编码处理输出
- 检查 PDF 的字体编码

### 内存不足

- 对于大文件，尝试分页处理
- 使用 `--page` 或 `--range` 选项分批读取

## Dependencies

这个技能依赖以下 Node.js 包：

- `pdf-parse`: 用于解析 PDF 文件和提取文本
- `tesseract.js`: 用于 OCR 文字识别
- `pdfjs-dist`: 用于高级 PDF 处理（图片提取、页面渲染）

## Resources

### scripts/

- `read_pdf.js`: Node.js 脚本，用于读取和解析 PDF 文件
  - 输入: PDF 文件路径
  - 输出: JSON 格式的文本内容和元数据

- `ocr_pdf.js`: OCR 文字识别脚本
  - 输入: PDF 文件路径
  - 输出: 识别的文本文件和 JSON 汇总
  - 选项:
    - `--lang <language>`: OCR 语言（默认: chi_sim+eng）
    - `--page <number>`: 处理指定页面
    - `--range <start-end>`: 处理页面范围
    - `--format <png|jpeg>`: 渲染格式（默认: png）

- `extract_images.js`: 图片提取脚本
  - 输入: PDF 文件路径
  - 输出: 渲染的页面图片
  - 选项:
    - `--page <number>`: 处理指定页面
    - `--range <start-end>`: 处理页面范围
    - `--format <png|jpeg>`: 图片格式（默认: png）
    - `--info`: 仅显示图片信息

### 安装依赖

在技能目录中安装依赖：

```bash
cd /data/openclaw_mini/skills/pdf_reader/scripts
npm init -y
npm install pdf-parse tesseract.js pdfjs-dist
```

## OCR 使用示例

### 识别完整扫描型 PDF

```bash
cd {baseDir}/scripts
node ocr_pdf.js /path/to/scanned.pdf
```

**输出**:

- `ocr_output/page_1.png` - 第 1 页渲染图片
- `ocr_output/page_1.txt` - 第 1 页识别文本
- `ocr_output/page_2.png` - 第 2 页渲染图片
- `ocr_output/page_2.txt` - 第 2 页识别文本
- ...
- `ocr_output/ocr_summary.json` - 汇总信息

### 识别指定页面

```bash
node ocr_pdf.js /path/to/scanned.pdf --page 1
```

### 使用不同语言

```bash
# 英文
node ocr_pdf.js /path/to/scanned.pdf --lang eng

# 繁体中文
node ocr_pdf.js /path/to/scanned.pdf --lang chi_tra

# 中英文混合（默认）
node ocr_pdf.js /path/to/scanned.pdf --lang chi_sim+eng
```

## 图片提取使用示例

### 提取所有页面的图片

```bash
cd {baseDir}/scripts
node extract_images.js /path/to/document.pdf
```

### 提取指定页面的图片

```bash
node extract_images.js /path/to/document.pdf --page 1
```

### 提取页面范围的图片

```bash
node extract_images.js /path/to/document.pdf --range 1-5
```

### 查看 PDF 图片信息

```bash
node extract_images.js /path/to/document.pdf --info
```

**输出示例**:

```json
[
  {
    "pageNumber": 1,
    "imageCount": 3,
    "images": [
      {
        "name": "img1",
        "width": 800,
        "height": 600,
        "size": 45632
      },
      {
        "name": "img2",
        "width": 1200,
        "height": 800,
        "size": 98765
      }
    ]
  }
]
```
