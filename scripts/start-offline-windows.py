#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenClaw 启动脚本 - Windows 离线版本
"""

import os
import sys
import subprocess
import urllib.request
import json

def run_command(cmd):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        return result.returncode == 0, result.stdout, result.stderr, result.returncode
    except Exception as e:
        return False, "", str(e), 1

def main():
    """主函数"""
    # 设置环境变量
    os.environ['OPENCLAW_SKIP_CHANNELS'] = '1'
    os.environ['OPENCLAW_UPDATE_CHECK'] = '0'
    
    bind = "127.0.0.1"
    port = "18789"
    
    # 解析命令行参数
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--help', '-h']:
            print("用法: python start-offline-windows.py [--bind IP] [--port PORT] [--verbose]")
            print()
            print("选项:")
            print("  --bind IP    绑定地址（默认: 127.0.0.1）")
            print("  --port PORT  端口号（默认: 18789）")
            print("  --verbose     启用详细输出")
            return
    
    i = 1
    verbose = False
    while i < len(sys.argv):
        if sys.argv[i] == '--bind' and i + 1 < len(sys.argv):
            bind = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--port' and i + 1 < len(sys.argv):
            port = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--verbose':
            verbose = True
            i += 1
        else:
            i += 1
    
    print("=" * 40)
    print(" OpenClaw Gateway - 离线模式")
    print("=" * 40)
    print()
    print("配置信息：")
    print(f"  绑定地址: {bind}:{port}")
    print("  禁用渠道: OPENCLAW_SKIP_CHANNELS=1")
    print("  禁用更新: OPENCLAW_UPDATE_CHECK=0")
    print()
    
    # 检查本地 OpenAI 兼容接口
    print("检查本地 OpenAI 兼容接口...")
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/v1/models", timeout=2) as response:
            data = json.loads(response.read().decode())
            print("✓ 本地 OpenAI 兼容接口运行中")
    except:
        print("警告：本地 OpenAI 兼容接口未运行")
        print("请确保本地 LLM 服务已启动并监听 http://127.0.0.1:8000")
        print("API 格式需兼容 OpenAI (/v1/chat/completions)")
        print()
        response = input("是否继续？(y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # 启动 OpenClaw
    print("\n启动 OpenClaw Gateway...")
    print()
    
    args = ["gateway", "run", "--bind", bind, "--port", port]
    if verbose:
        args.append("--verbose")
    
    success, stdout, stderr, exit_code = run_command(f"openclaw {' '.join(args)}")
    
    if exit_code != 0:
        print()
        print("启动失败，请检查：")
        config_dir = os.path.join(os.path.expanduser('~'), '.openclaw')
        print(f"1. 配置文件是否正确: {config_dir}\\openclaw.json")
        print(f"2. 本地 LLM 服务是否运行: http://127.0.0.1:8000")
        print(f"3. 端口 {port} 是否被占用: netstat -an | findstr {port}")
        print("4. 详细错误: openclaw gateway run --verbose")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()