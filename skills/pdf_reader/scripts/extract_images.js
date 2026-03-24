#!/usr/bin/env node

/**
 * PDF Image Extractor
 * 从 PDF 文件中提取图片
 */

const fs = require("fs");
const path = require("path");

// 尝试加载 pdfjs-dist
let pdfjsLib;
try {
  pdfjsLib = require("pdfjs-dist");
} catch (error) {
  console.error("错误: 缺少 pdfjs-dist 依赖");
  console.error("");
  console.error("请运行以下命令安装依赖:");
  console.error("  cd /data/openclaw_mini/skills/pdf_reader/scripts");
  console.error("  npm install pdfjs-dist");
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
    format: "png",
    password: null,
    info: false,
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
      case "format":
        options.format = value || args[++i];
        break;
      case "password":
        options.password = value || args[++i];
        break;
      case "info":
        options.info = true;
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

// 获取页面中的图片信息
async function getPageImages(page) {
  const ops = await page.getOperatorList();
  const images = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    // 查找图片操作符
    if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintJpegXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObject
    ) {
      const imgName = args[0];

      // 获取图片
      try {
        const image = await page.objs.get(imgName);
        if (image) {
          images.push({
            name: imgName,
            width: image.width,
            height: image.height,
            bytes: image.data,
          });
        }
      } catch (e) {
        // 忽略无法获取的图片
      }
    }
  }

  return images;
}

// 渲染页面为图片
async function renderPageToImage(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvas = require("canvas").createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return canvas.toBuffer();
}

// 保存图片
function saveImage(buffer, outputDir, pageIndex, imageIndex, format) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const ext = format === "jpeg" ? "jpg" : format;
  const filename = `page_${pageIndex}_image_${imageIndex}.${ext}`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, buffer);

  return filepath;
}

// 获取图片信息
async function getImageInfo(doc) {
  const info = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const images = await getPageImages(page);

    if (images.length > 0) {
      info.push({
        pageNumber: i,
        imageCount: images.length,
        images: images.map((img) => ({
          name: img.name,
          width: img.width,
          height: img.height,
          size: img.bytes.length,
        })),
      });
    }
  }

  return info;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // 验证文件路径
  if (!options.filePath) {
    console.error("错误: 请提供 PDF 文件路径");
    console.error("");
    console.error("用法: node extract_images.js <文件路径> [选项]");
    console.error("");
    console.error("选项:");
    console.error("  --page <number>           处理指定页面");
    console.error("  --pages <1,2,3>           处理多个页面");
    console.error("  --range <1-5>             处理页面范围");
    console.error("  --output-dir <dir>        输出目录（默认: ./extracted_images）");
    console.error("  --format <png|jpeg>       图片格式（默认: png）");
    console.error("  --password <pwd>          PDF 密码");
    console.error("  --info                    仅显示图片信息，不提取");
    process.exit(1);
  }

  const filePath = path.resolve(options.filePath);

  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在: ${filePath}`);
    process.exit(1);
  }

  // 设置输出目录
  const outputDir = options.outputDir || path.join(path.dirname(filePath), "extracted_images");

  try {
    // 加载 PDF
    const doc = await loadPDF(filePath, options.password);
    console.log(`PDF 加载成功，共 ${doc.numPages} 页`);

    if (options.info) {
      // 仅显示图片信息
      const info = await getImageInfo(doc);
      console.log("\n图片信息:");
      console.log(JSON.stringify(info, null, 2));
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

    let totalImages = 0;

    // 处理每一页
    for (const pageNum of pagesToProcess) {
      console.log(`\n处理第 ${pageNum} 页...`);

      try {
        const page = await doc.getPage(pageNum);
        const images = await getPageImages(page);

        if (images.length === 0) {
          console.log(`  第 ${pageNum} 页没有找到图片`);
          continue;
        }

        console.log(`  第 ${pageNum} 页找到 ${images.length} 张图片`);

        // 渲染页面并保存为图片
        const canvas = await renderPageToImage(page, 2.0);
        const filepath = saveImage(canvas, outputDir, pageNum, 0, options.format);
        console.log(`  已保存: ${filepath}`);
        totalImages++;
      } catch (error) {
        console.error(`  处理第 ${pageNum} 页时出错: ${error.message}`);
      }
    }

    console.log(`\n完成！共提取 ${totalImages} 张图片`);
    console.log(`输出目录: ${outputDir}`);

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
