#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenClaw 离线安装脚本 - Windows 版本
用途：银行内网环境，无外部网络依赖
"""

import os
import sys
import json
import subprocess
import shutil
from pathlib import Path

def run_command(cmd, check=True):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=check,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def check_admin():
    """检查管理员权限"""
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def check_node():
    """检查 Node.js"""
    success, stdout, stderr = run_command("node --version")
    if success:
        print("✓ Node.js 版本:", stdout.strip())
        return True
    else:
        print("错误：未找到 Node.js")
        print("请先安装 Node.js 22+ https://nodejs.org/")
        return False

def check_npm():
    """检查 npm"""
    success, stdout, stderr = run_command("npm --version")
    if success:
        print("✓ npm 版本:", stdout.strip())
        return True
    else:
        print("错误：未找到 npm")
        return False

def install_openclaw():
    """安装 OpenClaw"""
    print("\n安装 OpenClaw...")
    success, stdout, stderr = run_command("npm install -g openclaw@latest")
    if success:
        print("✓ OpenClaw 安装成功")
        return True
    else:
        print("错误：OpenClaw 安装失败")
        print(stderr)
        return False

def check_local_llm():
    """检查本地 OpenAI 兼容接口"""
    print("\n检查本地 OpenAI 兼容接口...")
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8000/v1/models", timeout=2) as response:
            data = json.loads(response.read().decode())
            print("✓ 本地 OpenAI 兼容接口运行中")
            return True
    except:
        print("警告：未找到本地 OpenAI 兼容接口")
        print("请确保本地 LLM 服务已启动并监听 http://127.0.0.1:8000")
        print("配置文件中的 baseUrl 可以根据实际情况修改")
        return False

def copy_config():
    """复制配置文件"""
    print("\n配置 OpenClaw...")
    
    config_dir = Path.home() / ".openclaw"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    script_dir = Path(__file__).parent
    config_file = script_dir / ".." / "configs" / "offline-bank.json"
    
    if config_file.exists():
        dest_file = config_dir / "openclaw.json"
        shutil.copy2(config_file, dest_file)
        print(f"✓ 配置文件已复制到: {dest_file}")
        return True
    else:
        print("警告：未找到配置文件，使用默认配置")
        print(f"配置文件路径: {config_file}")
        return False

def create_windows_service():
    """创建 Windows 服务"""
    print("\n创建 Windows 服务...")
    
    # 检查 NSSM 是否存在
    success, stdout, stderr = run_command("where nssm", check=False)
    if not success:
        print("警告：未找到 NSSM")
        print("请手动安装 NSSM: https://nssm.cc/download")
        print("\n手动创建服务命令：")
        print("nssm install OpenClawGateway node.exe C:\\Users\\YourUser\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs gateway run --bind 127.0.0.1 --port 18789")
        return False
    
    # 获取 node.exe 路径
    success, stdout, stderr = run_command("where node")
    if not success:
        print("错误：未找到 node.exe 路径")
        return False
    node_path = stdout.strip().split('\n')[0]
    
    # 获取 openclaw.mjs 路径
    appdata_roaming = os.environ.get('APPDATA', '')
    if not appdata_roaming:
        print("错误：未找到 APPDATA 环境变量")
        return False
    openclaw_path = Path(appdata_roaming) / "npm" / "node_modules" / "openclaw" / "openclaw.mjs"
    
    if not openclaw_path.exists():
        print(f"错误：未找到 openclaw.mjs: {openclaw_path}")
        return False
    
    serviceName = "OpenClawGateway"
    
    # 检查服务是否已存在
    success, stdout, stderr = run_command(f"sc query {serviceName}", check=False)
    if success:
        print("警告：服务已存在，停止并删除...")
        run_command(f"nssm stop {serviceName}", check=False)
        run_command(f"nssm remove {serviceName} confirm", check=False)
    
    # 创建新服务
    app_dir = Path(node_path).parent
    cmd = f'nssm install {serviceName} "{node_path}" "{openclaw_path}" gateway run --bind 127.0.0.1 --port 18789'
    run_command(cmd)
    
    run_command(f'nssm set {serviceName} AppDirectory "{app_dir}"')
    run_command(f'nssm set {serviceName} DisplayName "OpenClaw Gateway"')
    run_command(f'nssm set {serviceName} Description "OpenClaw AI Gateway - Local Offline Mode"')
    run_command(f'nssm set {serviceName} Start SERVICE_AUTO_START')
    
    print(f"✓ Windows 服务已创建: {serviceName}")
    print(f"  启动服务: Start-Service {serviceName}")
    print(f"  停止服务: Stop-Service {serviceName}")
    return True

def main():
    """主函数"""
    print("=" * 40)
    print(" OpenClaw 离线安装 - 银行内网版本")
    print("=" * 40)
    print()
    
    # 检查管理员权限
    if not check_admin():
        print("错误：需要管理员权限运行此脚本")
        print("请右键点击 Python，选择'以管理员身份运行'")
        sys.exit(1)
    
    # 检查 Node.js
    print("[1/5] 检查 Node.js...")
    if not check_node():
        sys.exit(1)
    
    # 检查 npm
    print("[2/5] 检查 npm...")
    if not check_npm():
        sys.exit(1)
    
    # 安装 OpenClaw
    print("[3/5] 安装 OpenClaw...")
    if not install_openclaw():
        sys.exit(1)
    
    # 检查本地 LLM
    print("[4/5] 检查本地 OpenAI 兼容接口...")
    check_local_llm()
    
    # 复制配置文件
    print("[5/5] 配置 OpenClaw...")
    copy_config()
    
    # 创建 Windows 服务
    print("[6/6] 创建 Windows 服务...")
    create_windows_service()
    
    # 完成
    print()
    print("=" * 40)
    print(" 安装完成！")
    print("=" * 40)
    print()
    print("后续步骤：")
    print("1. 确保本地 LLM 服务已启动：")
    print("   监听地址: http://127.0.0.1:8000")
    print("   API 格式: OpenAI 兼容 (/v1/chat/completions)")
    print()
    print("2. 修改配置文件中的模型名称（如需要）：")
    config_dir = Path.home() / ".openclaw"
    print(f"   {config_dir / 'openclaw.json'}")
    print("   修改 agent.model 和 models.providers.local-openai.models[0].id")
    print()
    print("3. 启动 OpenClaw Gateway：")
    print("   openclaw gateway run --bind 127.0.0.1 --port 18789")
    print()
    print("4. 访问 Web UI：")
    print("   http://127.0.0.1:18789/webchat")
    print()
    print("5. 测试 AI 代理：")
    print("   openclaw agent --message '列出当前目录'")
    print()
    print("配置文件位置：")
    print(f"   {config_dir / 'openclaw.json'}")
    print()

if __name__ == "__main__":
    main()