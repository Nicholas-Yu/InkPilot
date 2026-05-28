const obsidian = require('obsidian');
const { NovelAIWorkspaceView, VIEW_TYPE } = require('./components/NovelAIWorkspaceView');
const NovelAISettingTab = require('./components/NovelAISettingTab');
const NovelService = require('./services/novelService');
const AIClient = require('./api/aiClient');
const AIManager = require('./api/aiManager');
const logger = require('./utils/logger');
const { debounce } = require('./utils/helpers');

const DEFAULT_SETTINGS = {
  apiProvider: 'openai',
  apiKey: '',
  outlineModel: 'gpt-4o-mini',
  writingModel: 'gpt-4o',
  reviewModel: 'gpt-4o-mini',
  novelFolderPath: 'novel',
  costTrackingEnabled: true,
  customApiBase: '',
  totalCost: 0,
  totalTokens: 0,
  writingStyle: 'serious',
  customStyleDesc: '',
  autoReviewAfterGenerate: false,
  chatMaxRounds: 5,
  outlineMaxTokens: 4096,
  outlineTemperature: 0.9,
  outlineContextChars: 8000,
  writingMaxTokens: 4096,
  writingTemperature: 0.85,
  writingContextChars: 8000,
  reviewMaxTokens: 4096,
  reviewTemperature: 0.3,
  reviewContextChars: 8000,
  costRates: {
    'gpt-4o-mini': 0.15,
    'gpt-4o': 5,
    'gpt-4.1': 2,
    'gpt-4.1-mini': 0.4,
    'gpt-4.1-nano': 0.1,
    'claude-sonnet-4-20250514': 3,
    'claude-opus-4-20250514': 15,
    'deepseek-chat': 0.27,
    'deepseek-reasoner': 0.55,
    '_default': 2
  }
};

class InkPilotPlugin extends obsidian.Plugin {
  async onload() {
    logger.log('InkPilot 加载中...');
    
    await this.loadSettings();
    
    this.novelService = new NovelService(this.app, this.settings);
    this.aiClient = new AIClient(this.settings);
    this.aiManager = new AIManager(this);

    this.registerView(VIEW_TYPE, leaf => new NovelAIWorkspaceView(leaf, this));

    this.addRibbonIcon('pencil', 'InkPilot', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open',
      name: '打开 InkPilot',
      callback: () => {
        this.activateView();
      }
    });

    this.addCommand({
      id: 'generate',
      name: '生成章节',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'G' }],
      callback: () => {
        this.activateView();
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (leaves.length > 0 && leaves[0].view) {
          leaves[0].view.switchTab('generate');
        }
      }
    });

    this.addCommand({
      id: 'review',
      name: '审查章节',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'R' }],
      callback: () => {
        this.activateView();
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (leaves.length > 0 && leaves[0].view) {
          leaves[0].view.switchTab('review');
        }
      }
    });

    this.addCommand({
      id: 'brainstorm',
      name: '头脑风暴',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'B' }],
      callback: () => {
        this.activateView();
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (leaves.length > 0 && leaves[0].view) {
          leaves[0].view.switchTab('generate');
        }
      }
    });

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const selection = editor.getSelection();
        if (!selection || !selection.trim()) return;

        menu.addItem(item => {
          item.setTitle('✨ AI改写选中文字')
            .setIcon('pencil')
            .onClick(async () => {
              await this.runEditorAI('rewrite', editor, selection);
            });
        });

        menu.addItem(item => {
          item.setTitle('📝 AI扩写选中文字')
            .setIcon('file-text')
            .onClick(async () => {
              await this.runEditorAI('expand', editor, selection);
            });
        });

        menu.addItem(item => {
          item.setTitle('📖 AI续写')
            .setIcon('book-open')
            .onClick(async () => {
              await this.runEditorAI('continue', editor, selection);
            });
        });
      })
    );

    this.addSettingTab(new NovelAISettingTab(this.app, this));

    const debouncedInvalidate = debounce(() => {
      this.novelService.invalidateCache();
      this.aiManager.invalidateCache();
    }, 2000);
    this.registerEvent(
      this.app.vault.on('modify', debouncedInvalidate)
    );

    logger.log('InkPilot 加载完成');
  }

  onunload() {
    logger.log('InkPilot 卸载中...');
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    this.settings.costRates = Object.assign({}, DEFAULT_SETTINGS.costRates, saved?.costRates);
    if (this.aiClient) {
      this.aiClient.settings = this.settings;
    }
    if (this.novelService) {
      this.novelService.settings = this.settings;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.aiClient) {
      this.aiClient.settings = this.settings;
    }
    if (this.novelService) {
      this.novelService.settings = this.settings;
    }
  }

  async activateView() {
    const workspace = this.app.workspace;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]);
    } else {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: VIEW_TYPE, active: true });
        workspace.revealLeaf(rightLeaf);
      }
    }
  }

  refreshView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    leaves.forEach(leaf => {
      if (leaf.view && leaf.view.refreshAllTabs) {
        leaf.view.refreshAllTabs();
      } else if (leaf.view && leaf.view.renderView) {
        leaf.view.renderView();
      }
    });
  }

  async runEditorAI(mode, editor, selection) {
    if (!this.settings.apiKey) {
      new obsidian.Notice('请先在 InkPilot 设置中配置 API Key');
      return;
    }

    const modeLabels = { rewrite: '改写', expand: '扩写', continue: '续写' };
    const label = modeLabels[mode] || mode;

    let contextInfo = '';
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        const cache = this.app.metadataCache.getFileCache(activeFile);
        const fm = cache?.frontmatter;
        if (fm?.project) {
          const ctx = await this.novelService.collectContext(fm.project, fm.chapter_number || 1, this.settings.writingContextChars);
          contextInfo = `\n\n${this.aiManager.buildWritingSystemPrompt(fm.project, ctx, this.settings)}`;
        }
      }
    } catch (e) {
      logger.warn('编辑器AI获取上下文失败:', e.message);
    }

    const systemPrompt = this.aiManager.buildEditorPrompt(mode, contextInfo);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: selection }
    ];

    const noticeEl = new obsidian.Notice(`正在AI${label}...（流式输出中）`, 0);

    try {
      const cursor = editor.getCursor('from');
      let inserted = false;

      const result = await this.aiManager.writingStream(
        messages,
        (chunk, fullText) => {
          if (!inserted) {
            editor.replaceSelection(fullText);
            inserted = true;
          } else {
            const endCursor = editor.getCursor('to');
            const startPos = { line: cursor.line, ch: cursor.ch };
            editor.replaceRange(fullText, startPos, endCursor);
          }
        }
      );

      noticeEl.hide();

      if (result.aborted) {
        new obsidian.Notice(`AI${label}已停止，已保留已输入的内容`);
      } else {
        new obsidian.Notice(`AI${label}完成！`);
      }
    } catch (err) {
      noticeEl.hide();
      logger.error(`AI${label}失败:`, err);
      new obsidian.Notice(`AI${label}失败: ${err.message}`);
    }
  }
}

module.exports = InkPilotPlugin;