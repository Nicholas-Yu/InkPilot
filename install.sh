#!/bin/bash
VAULT="/Users/nicholasyu/Documents/Obsidian Vault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/novel-assistant"
TEMPLATE_DIR="$VAULT/novel/templates"
SRC="/Users/nicholasyu/Documents/novel-assistant"

mkdir -p "$PLUGIN_DIR"
cp "$SRC/main.js" "$PLUGIN_DIR/"
cp "$SRC/manifest.json" "$PLUGIN_DIR/"
cp "$SRC/styles.css" "$PLUGIN_DIR/"

mkdir -p "$TEMPLATE_DIR"
cp "$SRC/templates/"*.md "$TEMPLATE_DIR/"

echo "✅ Novel Assistant 安装完成！"
echo "插件目录: $PLUGIN_DIR"
echo "模板目录: $TEMPLATE_DIR"
echo ""
echo "请重启 Obsidian 并在设置中启用插件。"
