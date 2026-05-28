const logger = require('../../utils/logger');
const JSONParser = require('../../utils/jsonParser');
const { renderSuggestionCards } = require('../shared/SuggestionCards');
const { renderProjectSelector } = require('../shared/ProjectSelector');

function parseReviewJSON(text) {
  const parsed = JSONParser.parseAIResponse(text);
  return parsed.success ? parsed.data : null;
}

async function render(view, content) {
  const { selected } = await renderProjectSelector(view, content, '章节审查');
  if (!selected) return;

  const numGroup = content.createDiv({ cls: 'novel-ai-form-group' });
  numGroup.createDiv({ cls: 'novel-ai-form-label', text: '章节编号' });
  const numInput = numGroup.createEl('input', { cls: 'novel-ai-input', type: 'number' });
  numInput.setAttribute('placeholder', '1');
  numInput.setAttribute('min', '1');
  if (view.reviewChapterNumber) numInput.value = String(view.reviewChapterNumber);

  const btnGroup = content.createDiv({ cls: 'novel-ai-btn-group' });
  const conBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '🔍 一致性审查' });
  const aiBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '🤖 AI味检测' });

  content.createDiv({ cls: 'novel-ai-section-title', text: '审查结果' });
  const results = content.createDiv({ cls: 'novel-ai-review-results' });

  const chapterApplyFn = (s) => view.plugin.novelService.replaceInChapter(view.currentProject, view.reviewChapterNumber, s.original, s.replacement);

  if (view.reviewResults && view.reviewResults.length > 0) {
    renderSuggestionCards(view, results, view.reviewResults, chapterApplyFn);
  } else if (view.reviewRawText) {
    results.createDiv({ cls: 'novel-ai-preview novel-ai-selectable' }).setText(view.reviewRawText);
  } else {
    results.createDiv({ cls: 'novel-ai-preview' })
      .createDiv({ cls: 'novel-ai-preview-empty', text: '点击审查按钮开始...（结果可鼠标选中复制）' });
  }

  async function runReview(systemPrompt, userContent, chapterNum) {
    view.reviewChapterNumber = chapterNum;
    view.reviewResults = null;
    view.reviewRawText = null;
    results.empty();
    results.createDiv({ cls: 'novel-ai-loading', text: '正在审查...' });
    view.markTabBusy('review', true);

    try {
      const aiResult = await view.plugin.aiManager.reviewForJSON([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]);

      const parsed = parseReviewJSON(aiResult.raw);

      const applyFn = (s) => view.plugin.novelService.replaceInChapter(view.currentProject, chapterNum, s.original, s.replacement);

      if (parsed && parsed.suggestions && parsed.suggestions.length > 0) {
        view.reviewResults = parsed.suggestions;
        results.empty();
        renderSuggestionCards(view, results, parsed.suggestions, applyFn);
      } else if (aiResult.json) {
        const suggestionData = JSONParser.ensureSuggestions(aiResult.json, aiResult.raw);
        if (suggestionData.suggestions && suggestionData.suggestions.length > 0) {
          view.reviewResults = suggestionData.suggestions;
          results.empty();
          renderSuggestionCards(view, results, suggestionData.suggestions, applyFn);
        } else {
          view.reviewRawText = aiResult.raw;
          results.empty();
          results.createDiv({ cls: 'novel-ai-preview novel-ai-selectable' }).setText(aiResult.raw);
        }
      } else {
        view.reviewRawText = aiResult.raw;
        results.empty();
        results.createDiv({ cls: 'novel-ai-preview novel-ai-selectable' }).setText(aiResult.raw);
      }
    } catch (err) {
      logger.error('审查失败:', err);
      results.empty();
      results.createDiv({ cls: 'novel-ai-error', text: `失败: ${err.message}` });
    } finally {
      view.markTabBusy('review', false);
    }
  }

  conBtn.addEventListener('click', async () => {
    const num = parseInt(numInput.value);
    if (!num || num < 1) { results.empty(); results.createDiv({ cls: 'novel-ai-error', text: '请填写有效的章节编号（大于0）' }); return; }
    if (!view.plugin.settings.apiKey) { results.empty(); results.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' }); return; }

    const ch = await view.plugin.novelService.getChapterContent(view.currentProject, num);
    if (!ch) { results.empty(); results.createDiv({ cls: 'novel-ai-error', text: `找不到第${num}章` }); return; }

    const ctx = await view.plugin.novelService.collectContext(view.currentProject, num, view.plugin.settings.reviewContextChars);
    const consistencyPrompt = view.plugin.aiManager.prompts.review.consistency;
    await runReview(
      consistencyPrompt,
      `项目: ${view.currentProject}\n第${num}章\n参考上下文:\n${ctx}\n\n正文:\n${ch}`,
      num
    );
  });

  aiBtn.addEventListener('click', async () => {
    const num = parseInt(numInput.value);
    if (!num || num < 1) { results.empty(); results.createDiv({ cls: 'novel-ai-error', text: '请填写有效的章节编号（大于0）' }); return; }
    if (!view.plugin.settings.apiKey) { results.empty(); results.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' }); return; }

    const ch = await view.plugin.novelService.getChapterContent(view.currentProject, num);
    if (!ch) { results.empty(); results.createDiv({ cls: 'novel-ai-error', text: `找不到第${num}章` }); return; }

    const aiTastePrompt = view.plugin.aiManager.prompts.review.aiTaste;
    await runReview(aiTastePrompt, `分析以下章节的AI味:\n${ch}`, num);
  });
}

module.exports = { render };
