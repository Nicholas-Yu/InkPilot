#!/bin/bash

# InkPilot 安装脚本
# 用法: ./install.sh

set -e

VAULT="/Users/nicholasyu/Documents/Obsidian Vault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/inkpilot"
TEMPLATE_DIR="$VAULT/novel/templates"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 正在安装 InkPilot..."
echo ""

# 构建项目
echo "📦 构建项目..."
cd "$SRC"
npm run build

# 创建插件目录
echo "📁 创建插件目录..."
mkdir -p "$PLUGIN_DIR"

# 复制插件文件
echo "📋 复制插件文件..."
cp "$SRC/main.js" "$PLUGIN_DIR/"
cp "$SRC/manifest.json" "$PLUGIN_DIR/"
cp "$SRC/styles.css" "$PLUGIN_DIR/"

# 复制模板文件
echo "📄 复制模板文件..."
mkdir -p "$TEMPLATE_DIR"
cp "$SRC/templates/"*.md "$TEMPLATE_DIR/"

echo ""
echo "✅ InkPilot 安装完成！"
echo ""
echo "插件目录: $PLUGIN_DIR"
echo "模板目录: $TEMPLATE_DIR"
echo ""
echo "请重启 Obsidian 并在设置中启用插件。"
echo ""
echo "⚠️  注意："
echo "  - 如果之前安装了旧版 novel-assistant，请先在 Obsidian 中禁用并删除"
echo "  - 首次使用需要配置 API Key（设置 → InkPilot → API 设置）"
