#!/usr/bin/env node

/**
 * PDF Reader Script
 * 使用 Node.js 读取和解析 PDF 文件内容
 */

const fs = require("fs");
const path = require("path");

// 尝试加载 pdf-parse，如果不存在则提示安装
let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (error) {
  console.error("错误: 缺少 pdf-parse 依赖");
  console.error("");
  console.error("请运行以下命令安装依赖:");
  console.error("  cd /data/openclaw_mini/skills/pdf_reader/scripts");
  console.error("  npm install pdf-parse");
  process.exit(1);
}

// 命令行参数解析
function parseArgs(args) {
  const options = {
    filePath: null,
    page: null,
    pages: null,
    range: null,
    metadata: false,
    password: null,
    output: null,
    format: "json",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("--")) {
      options.filePath = arg;
      continue;
    }

    const [key, value] = arg.substring(2).split("=");

    switch (key) {
      case "page":
        options.page = parseInt(value || args[++i]);
        break;
      case "pages":
        options.pages = (value || args[++i]).split(",").map(Number);
        break;
      case "range":
        options.range = (value || args[++i]).split("-").map(Number);
        break;
      case "metadata":
        options.metadata = true;
        break;
      case "password":
        options.password = value || args[++i];
        break;
      case "output":
        options.output = value || args[++i];
        break;
      case "format":
        options.format = value || args[++i];
        break;
    }
  }

  return options;
}

// 读取 PDF 文件
async function readPDF(filePath, password = null) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const options = {};

    if (password) {
      options.password = password;
    }

    const data = await pdfParse(dataBuffer, options);
    return data;
  } catch (error) {
    if (error.message.includes("password")) {
      throw new Error("PDF 文件已加密，需要提供密码");
    }
    throw new Error(`读取 PDF 失败: ${error.message}`);
  }
}

// 分割文本为页面
function splitTextIntoPages(text, totalPages) {
  // pdf-parse 不直接提供分页，这里做一个简单的分割
  // 实际应用中可能需要更复杂的逻辑
  const pages = [];

  // 尝试按分页符分割
  let pageTexts = text.split("\f");

  // 如果没有分页符，尝试按换页字符或特定模式分割
  if (pageTexts.length === 1) {
    // 简单的启发式分割：按段落分割，然后分配到页面
    const paragraphs = text.split(/\n\s*\n/);
    const paragraphsPerPage = Math.ceil(paragraphs.length / totalPages);

    for (let i = 0; i < totalPages; i++) {
      const start = i * paragraphsPerPage;
      const end = start + paragraphsPerPage;
      pages.push({
        pageNumber: i + 1,
        text: paragraphs.slice(start, end).join("\n\n"),
        charCount: paragraphs.slice(start, end).join("\n\n").length,
      });
    }
  } else {
    pages.push(
      ...pageTexts.map((txt, idx) => ({
        pageNumber: idx + 1,
        text: txt.trim(),
        charCount: txt.trim().length,
      })),
    );
  }

  return pages;
}

// 格式化输出
function formatOutput(data, options, pages) {
  if (options.metadata) {
    // 仅返回元数据
    return {
      success: true,
      metadata: {
        pages: data.numpages,
        title: data.info?.Title || "",
        author: data.info?.Author || "",
        subject: data.info?.Subject || "",
        keywords: data.info?.Keywords || "",
        creator: data.info?.Creator || "",
        producer: data.info?.Producer || "",
        creationDate: data.info?.CreationDate || "",
        modificationDate: data.info?.ModDate || "",
        pdfVersion: data.info?.PDFFormatVersion || "",
      },
    };
  }

  // 返回文本内容
  const result = {
    success: true,
    metadata: {
      pages: data.numpages,
      title: data.info?.Title || "",
      author: data.info?.Author || "",
      creationDate: data.info?.CreationDate || "",
    },
  };

  if (options.page) {
    // 单页
    const pageData = pages.find((p) => p.pageNumber === options.page);
    if (pageData) {
      result.pages = [pageData];
      result.selectedPage = options.page;
    } else {
      result.success = false;
      result.error = `页面 ${options.page} 不存在`;
    }
  } else if (options.pages) {
    // 多页
    result.pages = pages.filter((p) => options.pages.includes(p.pageNumber));
    result.selectedPages = options.pages;
  } else if (options.range) {
    // 页面范围
    const [start, end] = options.range;
    result.pages = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
    result.selectedRange = `${start}-${end}`;
  } else {
    // 所有页面
    result.pages = pages;
  }

  return result;
}

// 输出为文本格式
function outputAsText(result) {
  let output = "";

  if (result.metadata && !result.pages) {
    output += "=== PDF 元数据 ===\n";
    output += `总页数: ${result.metadata.pages}\n`;
    if (result.metadata.title) output += `标题: ${result.metadata.title}\n`;
    if (result.metadata.author) output += `作者: ${result.metadata.author}\n`;
    if (result.metadata.creationDate) output += `创建日期: ${result.metadata.creationDate}\n`;
  } else if (result.pages) {
    result.pages.forEach((page) => {
      output += `\n=== 第 ${page.pageNumber} 页 ===\n`;
      output += `${page.text}\n`;
    });
  }

  return output;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // 验证文件路径
  if (!options.filePath) {
    console.error("错误: 请提供 PDF 文件路径");
    console.error("");
    console.error("用法: node read_pdf.js <文件路径> [选项]");
    console.error("");
    console.error("选项:");
    console.error("  --page <number>           读取指定页面（从 1 开始）");
    console.error("  --pages <1,2,3>           读取多个页面（逗号分隔）");
    console.error("  --range <1-5>             读取页面范围");
    console.error("  --metadata               仅显示元数据");
    console.error("  --password <pwd>          PDF 密码");
    console.error("  --output <file>          输出到文件");
    console.error("  --format <json|text>     输出格式（默认: json）");
    process.exit(1);
  }

  const filePath = path.resolve(options.filePath);

  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在: ${filePath}`);
    process.exit(1);
  }

  try {
    // 读取 PDF
    const data = await readPDF(filePath, options.password);

    // 分割文本为页面
    const pages = splitTextIntoPages(data.text, data.numpages);

    // 格式化输出
    const result = formatOutput(data, options, pages);

    // 输出
    let output;
    if (options.format === "text") {
      output = outputAsText(result);
    } else {
      output = JSON.stringify(result, null, 2);
    }

    if (options.output) {
      fs.writeFileSync(options.output, output, "utf-8");
      console.log(`输出已保存到: ${options.output}`);
    } else {
      console.log(output);
    }

    process.exit(0);
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

// 运行
main().catch((error) => {
  console.error("未预期的错误:", error);
  process.exit(1);
});
