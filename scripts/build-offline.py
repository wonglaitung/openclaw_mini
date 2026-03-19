#!/usr/bin/env python3
"""
OpenClaw 离线构建脚本
用于构建不包含消息渠道的最小化版本
"""

import os
import subprocess
import shutil
import sys


def print_header(text: str) -> None:
    """打印标题"""
    print(f"\n🔨 {text}")
    print()


def print_step(text: str) -> None:
    """打印步骤"""
    print(f"  {text}")


def print_success(text: str) -> None:
    """打印成功消息"""
    print(f"✅ {text}")


def print_error(text: str) -> None:
    """打印错误消息"""
    print(f"❌ {text}", file=sys.stderr)


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """运行命令"""
    try:
        return subprocess.run(
            cmd,
            check=check,
            text=True,
            capture_output=False,
        )
    except subprocess.CalledProcessError as e:
        print_error(f"命令执行失败: {' '.join(cmd)}")
        print_error(f"错误信息: {e.stderr}")
        sys.exit(1)


def main() -> int:
    """主函数"""
    print_header("开始构建 OpenClaw 离线版本...")

    # 设置环境变量
    os.environ["OPENCLAW_INCLUDE_OPTIONAL_BUNDLED"] = "0"
    os.environ["OPENCLAW_BUILD_PROFILE"] = "offline"

    print("📋 构建配置：")
    print_step("OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0")
    print_step("OPENCLAW_BUILD_PROFILE=offline")
    print()

    # 清理旧的构建产物
    print("🧹 清理旧构建产物...")
    dist_dir = "dist"
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    print_success("清理完成")
    print()

    # 运行完整构建
    print("🏗️  开始构建...")
    run_command(["pnpm", "build"])

    print()
    print_success("构建完成！")
    print()

    print("📦 构建产物位置：")
    print_step("dist/")
    print()

    print("📊 离线版本特点：")
    print_success("不包含任何消息渠道")
    print_success("不包含可选插件")
    print_success("最小化依赖")
    print_success("适合银行内网部署")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())