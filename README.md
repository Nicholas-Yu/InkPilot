# InkPilot — AI Co-pilot for Novel Writing

> AI is the amplifier, not the voice. You have 30 points of writing skill, InkPilot amplifies it to 85+.

An Obsidian plugin designed for novelists, integrating AI capabilities to provide end-to-end writing assistance — from project planning, character design, and outline generation to chapter writing and consistency review.

## Design Philosophy

InkPilot's core philosophy is **"AI 80% + Human 20%"** — AI handles the heavy lifting like expanding, polishing, and scene filling, while you focus on core creativity, emotional depth, and de-AI-ifying the text. **AI is the amplifier, not the voice.**

### Why Not "Pure AI Novel Writing"?

Pure AI-generated novels have three fatal problems:

- **AI-flavored text** — Uniform sentence structures, even修辞, "correct" emotions, smooth transitions. Readers can increasingly spot it.
- **Long-form collapse** — After 100 chapters: contradictions, character OOC, forgotten foreshadowing.
- **Copyright risk** — Pure AI-generated content may not be copyright-protected in many jurisdictions.

### Our Approach

InkPilot is built around human-AI collaboration:

| Phase | AI Does | You Do |
|-------|---------|--------|
| **Planning** | Generate drafts of characters, foreshadowing, worldbuilding, outlines | Select, adjust, inject core creativity |
| **Writing** | Expand scenes, fill dialogue, polish prose | Control pacing, inject emotion, design twists |
| **Review** | Detect contradictions and AI-flavored traces | Decide which suggestions to accept, make final calls |
| **Iteration** | Rewrite, expand, continue based on instructions | Set direction, review quality, inject soul |

### Tool Positioning

InkPilot is not a "one-click novel generator" — it's a **writing workbench**:

- 📋 **Structured project management** — Characters, foreshadowing, worldbuilding, and outlines managed in separate modules. No long-form collapse.
- 🤖 **AI-assisted, not AI-replaced** — AI participates in every phase, but final decisions are yours.
- 🔍 **Quality control** — Consistency checking + AI-taste detection ensures output quality.
- 💰 **Cost transparency** — Precise token usage and cost tracking with configurable rates.

## Features

### Project Management
- Create and manage multiple novel projects
- Project-level independent folder structure
- AI-optimized project descriptions
- Knowledge base management (upload reference materials, AI extracts writing knowledge)

### Character Management
- Manually create characters (protagonist/supporting/antagonist/cameo)
- AI one-click character generation
- AI-optimized character descriptions

### Foreshadowing Tracking
- Record foreshadowing placement chapters and resolution status
- AI one-click foreshadowing generation
- Visual status indicators (🚩 unresolved / ✅ resolved)

### Worldbuilding
- Category-based management (power systems, geography, factions, history, etc.)
- AI one-click worldbuilding framework generation (selectable categories)
- AI-optimized setting content

### Chapter Outlines
- Create and manage chapter outlines
- AI one-click outline generation
- AI outline expansion

### Chapter Generation
- AI streaming chapter generation (real-time display)
- Multiple writing modes: generate, continue, rewrite, expand
- Brainstorming feature
- Conversational editing (adjust content via chat commands)
- Generation history management

### Chapter Review
- AI consistency checking (detect contradictions with previous chapters)
- AI-taste detection (identify AI-generated traces)
- Accept/reject suggestions individually

### Other Features
- **Multi-provider AI support**: OpenAI, Anthropic, custom API
- **Streaming output**: Real-time AI content display
- **Cost tracking**: Precise token usage and cost statistics (configurable rates)
- **Editor integration**: Right-click menu for AI rewrite/expand/continue
- **Keyboard shortcuts**: `Ctrl/Cmd+Shift+G` generate, `Ctrl/Cmd+Shift+R` review, `Ctrl/Cmd+Shift+B` brainstorm

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian → Settings → Community plugins → Browse
2. Search for **InkPilot**
3. Click Install and Enable

### From GitHub Release

1. Go to the [Releases page](https://github.com/Nicholas-Yu/InkPilot/releases) and download the latest version
2. Download these 3 files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Create the plugin directory in your Obsidian Vault:
   ```
   YourVault/.obsidian/plugins/inkpilot/
   ```
4. Place the 3 files in that directory
5. Open Obsidian → Settings → Community plugins → Find **InkPilot** and enable

### From Source

```bash
# Clone the repository
git clone https://github.com/Nicholas-Yu/InkPilot.git

# Enter the project directory
cd InkPilot

# Install dependencies
npm install

# Build
npm run build

# Create plugin directory and copy files
# macOS/Linux:
mkdir -p /path/to/your/vault/.obsidian/plugins/inkpilot
cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/inkpilot/

# Windows:
mkdir C:\path\to\your\vault\.obsidian\plugins\inkpilot
copy main.js manifest.json styles.css C:\path\to\your\vault\.obsidian\plugins\inkpilot\
```

### Development Mode

```bash
npm run dev
```

Development mode generates build output with sourcemaps for easier debugging.

## Configuration

After installation, find **InkPilot** in Obsidian Settings:

1. **API Settings**
   - API Provider: Choose OpenAI / Anthropic / Custom
   - API Key: Enter your API key
   - Custom API Base: Custom API endpoint (for proxies or compatible interfaces)

2. **Model Settings**
   - Outline model: For generating outlines, characters, foreshadowing, and other structured content
   - Writing model: For generating chapter text
   - Review model: For consistency checking and AI-taste detection
   - Each model can be independently configured with temperature, max tokens, and context length

3. **Cost Tracking**
   - Enable/disable cost statistics
   - Configurable rates per model ($/million tokens)
   - View cumulative token usage and costs

4. **Writing Style**
   - Preset styles: Serious literature, Light humor, Action-packed, Mystery/Thriller
   - Custom style description

## Quick Start

1. Open the InkPilot panel in the sidebar (pencil icon)
2. Create a new novel project in the "Projects" tab
3. Edit the project description (synopsis, worldbuilding, etc.) — AI needs this information to generate content
4. Use each module in sequence:
   - **Characters** → Create or AI-generate characters
   - **Foreshadowing** → Plan foreshadowing threads
   - **Worldbuilding** → Build your setting system
   - **Outlines** → Plan chapter structure
   - **Generate** → AI writes chapters
   - **Review** → Check consistency

### Knowledge Base

Click the "📚 Knowledge Base" button on a project card:
1. Select files to upload (supports .md/.txt, batch upload)
2. Files are immediately stored in the project directory
3. Click 🤖 to AI-extract a single file, or "Extract All" for batch processing
4. Extracted knowledge is used as context reference during writing

### Editor Integration

Select text in the editor and right-click for quick access:
- ✨ AI Rewrite selected text
- 📝 AI Expand selected text
- 📖 AI Continue writing

## Project Structure

```
inkpilot/
├── src/
│   ├── main.js                    # Plugin entry
│   ├── api/
│   │   ├── aiClient.js            # AI API call wrapper
│   │   └── aiManager.js           # AI business logic manager
│   ├── services/
│   │   └── novelService.js        # File system operations
│   ├── utils/
│   │   ├── promptTemplates.js     # AI prompt templates
│   │   ├── helpers.js             # Utility functions
│   │   ├── jsonParser.js          # JSON parser
│   │   ├── cache.js               # Cache manager
│   │   └── logger.js              # Logger utility
│   └── components/
│       ├── NovelAIWorkspaceView.js # Main view
│       ├── NovelAISettingTab.js    # Settings page
│       ├── Create*Modal.js         # Various creation modals
│       ├── shared/                 # Shared components
│       │   ├── AIGenerate.js       # AI one-click generation logic
│       │   ├── OptimizePanel.js    # AI optimization panel
│       │   ├── ProjectSelector.js  # Project selector
│       │   └── SuggestionCards.js  # Suggestion card component
│       └── tabs/                   # Tab modules
│           ├── ProjectsTab.js      # Project management
│           ├── CharactersTab.js    # Character management
│           ├── ForeshadowingTab.js # Foreshadowing tracking
│           ├── WorldSettingsTab.js # Worldbuilding
│           ├── OutlinesTab.js      # Outline management
│           ├── GenerateTab.js      # Chapter generation
│           └── ReviewTab.js        # Chapter review
├── templates/                      # Note templates
├── styles.css                      # Stylesheet
├── manifest.json                   # Obsidian plugin manifest
└── package.json
```

## File Storage Structure

The plugin creates the following directory structure in your vault:

```
novel/
├── templates/           # Note templates
└── projects/
    └── {project-name}/
        ├── {project-name}.md  # Project main file
        ├── characters/        # Character files
        ├── foreshadowings/    # Foreshadowing files
        ├── worldsettings/     # Worldbuilding files
        ├── outlines/          # Outline files
        ├── chapters/          # Chapter files
        └── knowledge/         # Knowledge base files
```

## Tech Stack

- **Runtime**: Obsidian Plugin API
- **Build Tool**: esbuild
- **Language**: JavaScript (ES2018)
- **AI Interface**: OpenAI / Anthropic / Compatible API

## License

MIT License

## Contributing

Issues and Pull Requests are welcome!

## Acknowledgments

Thanks to the Obsidian team for providing an excellent note-taking platform and plugin system.

---

# InkPilot（墨航）— AI 协作小说写作助手

> AI 是扩音器，不是发声器。你有 30 分的写作能力，InkPilot 帮你放大到 85 分+。

一款专为网文作者设计的 Obsidian 插件，集成 AI 能力，提供从项目规划、角色设定、大纲生成到章节写作、一致性审查的全流程写作辅助。

## 设计理念

InkPilot 的核心理念是 **"AI 80% + 人工 20%"**——AI 负责扩写、润色、场景填充等体力活，人负责核心创意、情感注入、反 AI 味改写。**AI 是扩音器，不是发声器。** 你本身有 30 分的写作能力，AI 帮你放大到 85 分+。

### 为什么不是"纯 AI 写小说"？

纯 AI 生成的小说有三个致命问题：

- **AI 味重**——句式工整、修辞均匀、情感"正确"、过渡平滑，读者越来越能识别
- **长篇崩盘**——写到 100 章后前后矛盾、角色 OOC、伏笔遗忘
- **版权风险**——纯 AI 生成内容在中国可能不受版权保护

### 我们的解法

InkPilot 的设计围绕"人机协作"展开：

| 环节 | AI 做什么 | 人做什么 |
|------|-----------|----------|
| **规划** | 生成角色、伏笔、世界观、大纲的初稿 | 筛选、调整、注入核心创意 |
| **写作** | 扩写场景、填充对话、润色文笔 | 把控节奏、注入情感、设计反转 |
| **审查** | 检测前后矛盾、AI 味痕迹 | 判断建议是否采纳、做最终决策 |
| **迭代** | 根据指令改写、扩写、续写 | 提出方向、审核质量、注入灵魂 |

### 工具定位

InkPilot 不是"一键生成小说"的工具，而是一个**写作工作台**：

- 📋 **结构化项目管理**——角色、伏笔、世界观、大纲分模块管理，长篇不崩盘
- 🤖 **AI 辅助而非替代**——每个环节都有 AI 参与，但最终决策权在人
- 🔍 **质量把控**——一致性审查 + AI 味检测，确保输出质量
- 💰 **成本透明**——精确追踪 Token 用量和费用，写作成本可控

## 功能特性

### 项目管理
- 创建和管理多个小说项目
- 项目级别的独立文件夹结构
- AI 优化项目描述
- 知识库管理（上传参考资料，AI 提取写作知识）

### 角色管理
- 手动创建角色（主角/配角/反派/客串）
- AI 一键生成角色设定
- AI 优化角色描述

### 伏笔追踪
- 记录伏笔埋设章节和回收状态
- AI 一键生成伏笔线索
- 可视化伏笔状态（🚩 未回收 / ✅ 已回收）

### 世界观设定
- 按类别管理（力量体系、地理设定、势力分布、历史背景等）
- AI 一键生成世界观框架（支持选择生成类别）
- AI 优化设定内容

### 章节大纲
- 创建和管理章节大纲
- AI 一键生成章节大纲
- AI 扩展大纲细节

### 章节生成
- AI 流式生成章节内容（实时显示生成过程）
- 支持多种写作模式：生成、续写、改写、扩写
- 头脑风暴功能
- 对话式修改（通过聊天指令调整内容）
- 生成历史管理

### 章节审查
- AI 一致性审查（检查前后文矛盾）
- AI 味检测（识别 AI 生成痕迹）
- 逐条建议接受/拒绝

### 其他特性
- **多 AI 提供商支持**：OpenAI、Anthropic、自定义 API
- **流式输出**：实时显示 AI 生成内容
- **成本追踪**：精确统计 Token 用量和费用（支持可配置费率）
- **编辑器集成**：右键菜单快速调用 AI 改写/扩写/续写
- **快捷键支持**：`Ctrl/Cmd+Shift+G` 生成、`Ctrl/Cmd+Shift+R` 审查、`Ctrl/Cmd+Shift+B` 头脑风暴

## 安装

### 从 Obsidian 社区插件安装（推荐）

1. 打开 Obsidian → 设置 → 第三方插件 → 社区插件市场
2. 搜索 **InkPilot**
3. 点击安装并启用

### 从 GitHub Release 安装

1. 前往 [Releases 页面](https://github.com/Nicholas-Yu/InkPilot/releases) 下载最新版本
2. 下载以下 3 个文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. 在你的 Obsidian Vault 中创建插件目录：
   ```
   你的Vault/.obsidian/plugins/inkpilot/
   ```
4. 将 3 个文件放入该目录
5. 打开 Obsidian → 设置 → 第三方插件 → 找到 **InkPilot** 并启用

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/Nicholas-Yu/InkPilot.git

# 进入项目目录
cd InkPilot

# 安装依赖
npm install

# 构建
npm run build

# 创建插件目录并复制文件
# macOS/Linux:
mkdir -p /path/to/your/vault/.obsidian/plugins/inkpilot
cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/inkpilot/

# Windows:
mkdir C:\path\to\your\vault\.obsidian\plugins\inkpilot
copy main.js manifest.json styles.css C:\path\to\your\vault\.obsidian\plugins\inkpilot\
```

### 开发模式

```bash
npm run dev
```

开发模式会生成带 sourcemap 的构建产物，方便调试。

## 配置

安装后在 Obsidian 设置中找到 **InkPilot** 进行配置：

1. **API 设置**
   - API Provider：选择 OpenAI / Anthropic / 自定义
   - API Key：填入你的 API 密钥
   - Custom API Base：自定义 API 地址（用于代理或兼容接口）

2. **模型设置**
   - 大纲模型：用于生成大纲、角色、伏笔等结构化内容
   - 写作模型：用于生成章节正文
   - 审查模型：用于一致性审查和 AI 味检测
   - 每个模型可独立配置温度、最大 Token 数、上下文长度

3. **成本追踪**
   - 启用/禁用成本统计
   - 可配置各模型的费率（$/百万 Token）
   - 查看累计 Token 用量和费用

4. **写作风格**
   - 预设风格：严肃文学、轻松幽默、热血爽文、悬疑推理
   - 自定义风格描述

## 使用指南

### 快速开始

1. 打开侧边栏的 InkPilot 面板（铅笔图标）
2. 在「项目」标签页创建新小说项目
3. 编辑项目描述（故事梗概、世界观等），AI 需要基于这些信息生成内容
4. 依次使用各功能模块：
   - **角色** → 创建或 AI 生成角色
   - **伏笔** → 规划伏笔线索
   - **世界观** → 构建设定体系
   - **大纲** → 规划章节结构
   - **生成** → AI 写作章节
   - **审查** → 检查一致性

### 知识库

在项目卡片上点击「📚 知识库」按钮：
1. 选择文件上传（支持 .md/.txt，可批量）
2. 文件立即存储到项目目录
3. 点击 🤖 按钮对单个文件进行 AI 提取，或点击「全部AI提取」批量处理
4. 提取的知识会在写作时作为上下文参考

### 编辑器集成

在编辑器中选中文本后右键，可快速调用：
- ✨ AI改写选中文字
- 📝 AI扩写选中文字
- 📖 AI续写

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

感谢 Obsidian 团队提供了优秀的笔记平台和插件系统。
