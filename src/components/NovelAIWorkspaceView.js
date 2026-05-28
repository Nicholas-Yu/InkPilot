const obsidian = require('obsidian');
const logger = require('../utils/logger');
const JSONParser = require('../utils/jsonParser');
const ProjectsTab = require('./tabs/ProjectsTab');
const CharactersTab = require('./tabs/CharactersTab');
const ForeshadowingTab = require('./tabs/ForeshadowingTab');
const WorldSettingsTab = require('./tabs/WorldSettingsTab');
const OutlinesTab = require('./tabs/OutlinesTab');
const GenerateTab = require('./tabs/GenerateTab');
const ReviewTab = require('./tabs/ReviewTab');

const VIEW_TYPE = 'inkpilot-workspace';

const TAB_MODULES = {
  projects: ProjectsTab,
  characters: CharactersTab,
  foreshadowing: ForeshadowingTab,
  worldsettings: WorldSettingsTab,
  outlines: OutlinesTab,
  generate: GenerateTab,
  review: ReviewTab,
};

const TAB_DEFS = [
  { id: 'projects', text: '📖 项目' },
  { id: 'characters', text: '👤 角色' },
  { id: 'foreshadowing', text: '🔗 伏笔' },
  { id: 'worldsettings', text: '🌍 世界观' },
  { id: 'outlines', text: '📋 大纲' },
  { id: 'generate', text: '✍️ 生成' },
  { id: 'review', text: '🔍 审查' },
];

class NovelAIWorkspaceView extends obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.activeTab = 'projects';
    this.currentProject = '';
    this.generatedResults = [];
    this.currentDisplayIndex = -1;
    this.generatedChapterNumber = null;
    this.generatedOutline = '';
    this.reviewResults = null;
    this.reviewRawText = null;
    this.reviewChapterNumber = null;
    this._tabContainers = {};
    this._tabRendered = {};
    this._activeOperations = new Set();
    this._tabBarEl = null;
    this._contentEl = null;
    this._chatVisible = false;
    this._conversationHistory = [];
    this._chatMessages = [];
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'InkPilot'; }
  getIcon() { return 'pencil'; }

  onOpen() {
    this.containerEl.addClass('novel-ai-workspace');
    this.contentEl.empty();
    this.contentEl.addClass('novel-ai-content-inner');

    this._tabBarEl = this.contentEl.createDiv({ cls: 'novel-ai-tabs' });
    this._contentEl = this.contentEl.createDiv({ cls: 'novel-ai-content' });

    TAB_DEFS.forEach(tab => {
      const container = this._contentEl.createDiv({ cls: 'novel-ai-tab-panel' });
      container.style.display = 'none';
      this._tabContainers[tab.id] = container;
    });

    this.renderTabBar();
    this.switchTab(this.activeTab);
  }

  onClose() {
    this.contentEl.empty();
    this._tabContainers = {};
    this._tabRendered = {};
  }

  renderTabBar() {
    this._tabBarEl.empty();
    const self = this;

    TAB_DEFS.forEach(tab => {
      const el = this._tabBarEl.createDiv({
        cls: `novel-ai-tab ${self.activeTab === tab.id ? 'active' : ''}`,
        text: tab.text
      });

      if (self._activeOperations.has(tab.id)) {
        el.createSpan({ cls: 'novel-ai-tab-badge' });
      }

      el.addEventListener('click', () => {
        self.switchTab(tab.id);
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    Object.entries(this._tabContainers).forEach(([id, container]) => {
      container.style.display = id === tabId ? '' : 'none';
    });

    this.renderTabBar();

    if (!this._tabRendered[tabId]) {
      this._tabRendered[tabId] = true;
      const container = this._tabContainers[tabId];
      container.empty();
      const tabModule = TAB_MODULES[tabId];
      if (tabModule) {
        tabModule.render(this, container);
      }
    }
  }

  renderView() {
    this._tabRendered[this.activeTab] = false;
    const container = this._tabContainers[this.activeTab];
    if (container) {
      container.empty();
      const tabModule = TAB_MODULES[this.activeTab];
      if (tabModule) {
        tabModule.render(this, container);
      }
    }
    this.renderTabBar();
  }

  refreshAllTabs() {
    Object.keys(this._tabRendered).forEach(tabId => {
      this._tabRendered[tabId] = false;
    });
    this.renderView();
  }

  markTabBusy(tabId, busy) {
    if (busy) {
      this._activeOperations.add(tabId);
    } else {
      this._activeOperations.delete(tabId);
    }
    this.renderTabBar();
  }

  async runAutoReview(content, chapterNum) {
    this.markTabBusy('review', true);

    try {
      const ctx = await this.plugin.novelService.collectContext(this.currentProject, chapterNum, this.plugin.settings.reviewContextChars);

      const aiResult = await this.plugin.aiManager.reviewForJSON([
        { role: 'system', content: this.plugin.aiManager.prompts.review.consistency },
        { role: 'user', content: `项目: ${this.currentProject}\n第${chapterNum}章\n参考上下文:\n${ctx}\n\n正文:\n${content}` }
      ]);

      const parsed = JSONParser.parseAIResponse(aiResult.raw);
      const data = parsed.success ? parsed.data : null;

      if (data && data.suggestions && data.suggestions.length > 0) {
        this.reviewResults = data.suggestions;
        this.renderView();
        new obsidian.Notice(`自动审查完成，发现 ${data.suggestions.length} 条建议`);
      } else {
        new obsidian.Notice('自动审查完成，未发现问题！');
      }
    } catch (err) {
      logger.error('自动审查失败:', err);
      new obsidian.Notice(`自动审查失败: ${err.message}`);
    } finally {
      this.markTabBusy('review', false);
    }
  }
}

module.exports = { NovelAIWorkspaceView, VIEW_TYPE };
