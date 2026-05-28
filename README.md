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

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/nicholasyu/inkpilot.git

# 进入项目目录
cd inkpilot

# 安装依赖
npm install

# 构建
npm run build

# 复制到 Obsidian 插件目录（文件夹名必须保持 novel-assistant 以兼容旧版）
# macOS/Linux:
cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/novel-assistant/

# Windows:
copy main.js manifest.json styles.css C:\path\to\your\vault\.obsidian\plugins\novel-assistant\
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

## 项目结构

```
inkpilot/
├── src/
│   ├── main.js                    # 插件入口
│   ├── api/
│   │   ├── aiClient.js            # AI API 调用封装
│   │   └── aiManager.js           # AI 业务逻辑管理
│   ├── services/
│   │   └── novelService.js        # 文件系统操作服务
│   ├── utils/
│   │   ├── promptTemplates.js     # AI 提示词模板
│   │   ├── helpers.js             # 工具函数
│   │   ├── jsonParser.js          # JSON 解析器
│   │   ├── cache.js               # 缓存管理
│   │   └── logger.js              # 日志工具
│   └── components/
│       ├── NovelAIWorkspaceView.js # 主视图
│       ├── NovelAISettingTab.js    # 设置页面
│       ├── Create*Modal.js         # 各类创建弹窗
│       ├── shared/                 # 共享组件
│       │   ├── AIGenerate.js       # AI 一键生成通用逻辑
│       │   ├── OptimizePanel.js    # AI 优化面板
│       │   ├── ProjectSelector.js  # 项目选择器
│       │   └── SuggestionCards.js  # 建议卡片组件
│       └── tabs/                   # 标签页模块
│           ├── ProjectsTab.js      # 项目管理
│           ├── CharactersTab.js    # 角色管理
│           ├── ForeshadowingTab.js # 伏笔追踪
│           ├── WorldSettingsTab.js # 世界观设定
│           ├── OutlinesTab.js      # 大纲管理
│           ├── GenerateTab.js      # 章节生成
│           └── ReviewTab.js        # 章节审查
├── templates/                      # 笔记模板
├── styles.css                      # 样式文件
├── manifest.json                   # Obsidian 插件清单
└── package.json
```

## 文件存储结构

插件在 vault 中创建以下目录结构：

```
novel/
├── templates/           # 笔记模板
└── projects/
    └── {项目名}/
        ├── {项目名}.md  # 项目主文件
        ├── characters/  # 角色文件
        ├── foreshadowings/ # 伏笔文件
        ├── worldsettings/  # 世界观设定
        ├── outlines/    # 大纲文件
        ├── chapters/    # 章节文件
        └── knowledge/   # 知识库文件
```

## 技术栈

- **运行时**：Obsidian Plugin API
- **构建工具**：esbuild
- **语言**：JavaScript (ES2018)
- **AI 接口**：OpenAI / Anthropic / 兼容 API

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

感谢 Obsidian 团队提供了优秀的笔记平台和插件系统。
