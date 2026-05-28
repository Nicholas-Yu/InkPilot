const logger = require('../../utils/logger');
const JSONParser = require('../../utils/jsonParser');
const { renderSuggestionCards } = require('./SuggestionCards');

const OPTIMIZE_LABELS = {
  'novel-character': '角色',
  'novel-foreshadowing': '伏笔',
  'novel-worldsetting': '世界观'
};

async function runOptimize(view, cardEl, itemInfo, type, projectName) {
  const optBtn = cardEl.querySelector('.novel-ai-btn-optimize');

  let existingPanel = cardEl.querySelector('.novel-ai-optimize-panel');
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  if (!view.plugin.settings.apiKey) {
    showTempPanel(cardEl, 'novel-ai-error', '请先配置API Key');
    return;
  }

  optBtn.disabled = true;
  optBtn.textContent = '⏳ 分析中...';
  view.markTabBusy(view.activeTab, true);

  try {
    const body = await view.plugin.novelService.getFileContent(itemInfo);
    if (!body) throw new Error('无法读取文件内容');

    const reviewKey = type.replace('novel-', '');
    const systemPrompt = view.plugin.aiManager.prompts.review[reviewKey];
    const label = OPTIMIZE_LABELS[type] || '项目';

    const aiResult = await view.plugin.aiManager.reviewForJSON([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${label}名称: ${itemInfo.frontmatter.name || itemInfo.basename}\n\n内容:\n${body}` }
    ]);

    const suggestionData = JSONParser.ensureSuggestions(aiResult.json, aiResult.raw);

    optBtn.disabled = false;
    optBtn.textContent = '✨ AI优化';

    if (suggestionData.suggestions && suggestionData.suggestions.length > 0) {
      renderOptimizePanel(view, cardEl, suggestionData.suggestions, itemInfo);
    } else {
      showTempPanel(cardEl, 'novel-ai-success', '✨ 该设定已经很完善，无需优化！');
    }
  } catch (err) {
    logger.error('AI优化失败:', err);
    optBtn.disabled = false;
    optBtn.textContent = '✨ AI优化';
    showTempPanel(cardEl, 'novel-ai-error', `优化失败: ${err.message}`);
  } finally {
    view.markTabBusy(view.activeTab, false);
  }
}

function renderOptimizePanel(view, cardEl, suggestions, itemInfo) {
  const panel = cardEl.createDiv({ cls: 'novel-ai-optimize-panel' });
  const summary = panel.createDiv({ cls: 'novel-ai-optimize-summary' });
  summary.createSpan({ text: `AI优化建议 (${suggestions.length}条)` });

  const closeBtn = summary.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '✕ 关闭' });
  closeBtn.addEventListener('click', () => panel.remove());

  const applyFn = (s) => view.plugin.novelService.updateFileBody(itemInfo, s.original, s.replacement);
  renderSuggestionCards(view, panel, suggestions, applyFn);
}

function showTempPanel(cardEl, cls, message) {
  let existing = cardEl.querySelector('.novel-ai-optimize-panel');
  if (existing) existing.remove();
  const panel = cardEl.createDiv({ cls: 'novel-ai-optimize-panel' });
  panel.createDiv({ cls, text: message });
  setTimeout(() => panel.remove(), 3000);
}

module.exports = { runOptimize, renderOptimizePanel, showTempPanel };
