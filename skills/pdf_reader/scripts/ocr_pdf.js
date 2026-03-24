#!/usr/bin/env node

/**
 * PDF OCR (Optical Character Recognition)
 * 对扫描型 PDF 进行 OCR 文字识别
 */

const fs = require("fs");
const path = require("path");

// 尝试加载依赖
let Tesseract;
let pdfjsLib;
try {
  Tesseract = require("tesseract.js");
  pdfjsLib = require("pdfjs-dist");
} catch (error) {
  console.error("错误: 缺少依赖");
  console.error("");
  console.error("请运行以下命令安装依赖:");
  console.error("  cd /data/openclaw_mini/skills/pdf_reader/scripts");
  console.error("  npm install tesseract.js pdfjs-dist");
  process.exit(1);
}

// 命令行参数解析
function parseArgs(args) {
  const options = {
    filePath: null,
    page: null,
    pages: null,
    range: null,
    outputDir: null,
    language: "chi_sim+eng", // 默认：简体中文+英文
    password: null,
    info: false,
    imageFormat: "png",
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
      case "output-dir":
      case "outputDir":
        options.outputDir = value || args[++i];
        break;
      case "lang":
      case "language":
        options.language = value || args[++i];
        break;
      case "password":
        options.password = value || args[++i];
        break;
      case "info":
        options.info = true;
        break;
      case "format":
        options.imageFormat = value || args[++i];
        break;
    }
  }

  return options;
}

// 加载 PDF 文档
async function loadPDF(filePath, password = null) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({
      data: data,
      password: password,
    });
    return await loadingTask.promise;
  } catch (error) {
    if (error.message.includes("password")) {
      throw new Error("PDF 文件已加密，需要提供密码");
    }
    throw new Error(`加载 PDF 失败: ${error.message}`);
  }
}

// 渲染页面为图片
async function renderPageToImage(page, scale = 2.0, format = "png") {
  const viewport = page.getViewport({ scale });
  const canvas = require("canvas").createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return canvas.toBuffer(`image/${format}`);
}

// 使用 Tesseract 进行 OCR
async function performOCR(imageBuffer, language, pageNumber) {
  console.log(`  正在进行 OCR 识别 (第 ${pageNumber} 页)...`);

  const worker = await Tesseract.createWorker({
    logger: (m) => {
      if (m.status === "recognizing text") {
        process.stdout.write(`    进度: ${Math.round(m.progress * 100)}%\r`);
      }
    },
  });

  await worker.loadLanguage(language);
  await worker.initialize(language);

  const { data } = await worker.recognize(imageBuffer);

  await worker.terminate();
  console.log(`    完成`);

  return data;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // 验证文件路径
  if (!options.filePath) {
    console.error("错误: 请提供 PDF 文件路径");
    console.error("");
    console.error("用法: node ocr_pdf.js <文件路径> [选项]");
    console.error("");
    console.error("选项:");
    console.error("  --page <number>           处理指定页面");
    console.error("  --pages <1,2,3>           处理多个页面");
    console.error("  --range <1-5>             处理页面范围");
    console.error("  --output-dir <dir>        输出目录（默认: ./ocr_output）");
    console.error("  --lang <lang>             语言（默认: chi_sim+eng）");
    console.error("                           常用语言: chi_sim(简体), chi_tra(繁体), eng(英文)");
    console.error("  --password <pwd>          PDF 密码");
    console.error("  --info                    仅显示 PDF 信息");
    console.error("  --format <png|jpeg>       渲染格式（默认: png）");
    process.exit(1);
  }

  const filePath = path.resolve(options.filePath);

  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在: ${filePath}`);
    process.exit(1);
  }

  // 设置输出目录
  const outputDir = options.outputDir || path.join(path.dirname(filePath), "ocr_output");

  try {
    // 加载 PDF
    console.log("正在加载 PDF...");
    const doc = await loadPDF(filePath, options.password);
    console.log(`PDF 加载成功，共 ${doc.numPages} 页`);

    if (options.info) {
      // 仅显示 PDF 信息
      console.log("\n=== PDF 信息 ===");
      console.log(`文件路径: ${filePath}`);
      console.log(`总页数: ${doc.numPages}`);
      console.log(`OCR 语言: ${options.language}`);
      process.exit(0);
    }

    // 确定要处理的页面
    let pagesToProcess = [];
    if (options.page) {
      pagesToProcess = [options.page];
    } else if (options.pages) {
      pagesToProcess = options.pages;
    } else if (options.range) {
      const [start, end] = options.range;
      for (let i = start; i <= end; i++) {
        pagesToProcess.push(i);
      }
    } else {
      pagesToProcess = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    }

    // 过滤有效页面
    pagesToProcess = pagesToProcess.filter((p) => p >= 1 && p <= doc.numPages);

    if (pagesToProcess.length === 0) {
      console.error("错误: 没有有效的页面要处理");
      process.exit(1);
    }

    console.log(`处理页面: ${pagesToProcess.join(", ")}`);
    console.log(`OCR 语言: ${options.language}`);

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];

    // 处理每一页
    for (const pageNum of pagesToProcess) {
      console.log(`\n处理第 ${pageNum} 页...`);

      try {
        const page = await doc.getPage(pageNum);

        // 渲染页面为图片
        const imageBuffer = await renderPageToImage(page, 2.0, options.imageFormat);

        // 保存渲染的图片
        const ext = options.imageFormat === "jpeg" ? "jpg" : options.imageFormat;
        const imagePath = path.join(outputDir, `page_${pageNum}.${ext}`);
        fs.writeFileSync(imagePath, imageBuffer);
        console.log(`  已保存渲染图片: ${imagePath}`);

        // 进行 OCR 识别
        const ocrData = await performOCR(imageBuffer, options.language, pageNum);

        // 保存识别结果
        const textPath = path.join(outputDir, `page_${pageNum}.txt`);
        fs.writeFileSync(textPath, ocrData.text, "utf-8");
        console.log(`  已保存文本: ${textPath}`);

        results.push({
          pageNumber: pageNum,
          confidence: ocrData.confidence,
          text: ocrData.text,
          words: ocrData.words.length,
        });
      } catch (error) {
        console.error(`  处理第 ${pageNum} 页时出错: ${error.message}`);
      }
    }

    // 保存汇总结果
    const summaryPath = path.join(outputDir, "ocr_summary.json");
    const summary = {
      filePath: filePath,
      totalPages: doc.numPages,
      processedPages: results.length,
      language: options.language,
      pages: results.map((r) => ({
        pageNumber: r.pageNumber,
        confidence: r.confidence,
        wordCount: r.words,
        characterCount: r.text.length,
      })),
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    console.log(`\n=== OCR 完成 ===`);
    console.log(`汇总信息已保存: ${summaryPath}`);
    console.log(`总页数: ${doc.numPages}`);
    console.log(`已处理: ${results.length} 页`);

    // 显示置信度统计
    if (results.length > 0) {
      const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
      console.log(`平均置信度: ${avgConfidence.toFixed(2)}%`);

      const totalWords = results.reduce((sum, r) => sum + r.words, 0);
      console.log(`总识别字数: ${totalWords}`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`错误: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
main().catch((error) => {
  console.error("未预期的错误:", error);
  process.exit(1);
});
