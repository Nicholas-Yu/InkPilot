const logger = require('../../utils/logger');

async function runAIGenerate(view, config) {
  const {
    tabId,
    btnEl,
    btnText,
    statusDiv,
    loadingText,
    emptyErrorText,
    successUnit,
    buildMessages,
    extractItems,
    saveItem,
    isValidItem
  } = config;

  if (!view.plugin.settings.apiKey) {
    statusDiv.empty();
    statusDiv.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' });
    return;
  }

  const desc = await view.plugin.novelService.getProjectDescription(view.currentProject);
  if (!desc || desc.trim().length < 10) {
    statusDiv.empty();
    statusDiv.createDiv({ cls: 'novel-ai-error', text: '请先完善项目说明（故事梗概、世界观等），AI需要基于项目信息生成内容' });
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = '⏳ AI正在思考...';
  statusDiv.empty();
  statusDiv.createDiv({ cls: 'novel-ai-loading', text: loadingText });
  view.markTabBusy(tabId, true);

  try {
    const projectContext = await view.plugin.novelService.collectProjectInfo(view.currentProject);
    const messages = await buildMessages(view, projectContext);

    const result = await view.plugin.aiManager.outlineForJSON(messages);
    const items = extractItems(result);

    if (items.length === 0) {
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-error', text: emptyErrorText });
      statusDiv.createDiv({ cls: 'novel-ai-preview novel-ai-selectable novel-ai-result-scroll' }).setText(result.raw);
    } else {
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-success', text: `✅ AI生成了 ${items.length} ${successUnit}，正在保存...` });

      let saved = 0;
      for (const item of items) {
        if (isValidItem && !isValidItem(item)) continue;
        try {
          await saveItem(item, view);
          saved++;
        } catch (err) {
          logger.warn(`保存失败:`, err.message);
        }
      }

      view.plugin.novelService.invalidateCache();

      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-success', text: `✅ 成功保存 ${saved}/${items.length} ${successUnit}！` });
      view.renderView();
    }
  } catch (err) {
    logger.error('AI生成失败:', err);
    statusDiv.empty();
    statusDiv.createDiv({ cls: 'novel-ai-error', text: `生成失败: ${err.message}` });
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = btnText;
    view.markTabBusy(tabId, false);
  }
}

module.exports = { runAIGenerate };
