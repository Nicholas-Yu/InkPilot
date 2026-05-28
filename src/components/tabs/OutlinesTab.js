const logger = require('../../utils/logger');
const CreateOutlineModal = require('../CreateOutlineModal');
const { renderProjectSelector } = require('../shared/ProjectSelector');
const { runAIGenerate } = require('../shared/AIGenerate');

const STATUS_LABELS = { draft: '📝 草稿', ready: '✅ 就绪', done: '✔️ 已完成' };

async function render(view, content) {
  const { selected } = await renderProjectSelector(view, content, '章节大纲');
  if (!selected) return;

  const btnGroup = content.createDiv({ cls: 'novel-ai-btn-group' });
  btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '+ 新建大纲' })
    .addEventListener('click', () => {
      new CreateOutlineModal(view.app, view.plugin, view.currentProject).open();
    });

  const aiGenBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '🤖 AI一键生成大纲' });
  const aiStatusDiv = content.createDiv({ cls: 'novel-ai-ai-status' });

  aiGenBtn.addEventListener('click', () => runAIGenerate(view, {
    tabId: 'outlines',
    btnEl: aiGenBtn,
    btnText: '🤖 AI一键生成大纲',
    statusDiv: aiStatusDiv,
    loadingText: '🤖 AI正在根据项目信息生成章节大纲...',
    emptyErrorText: 'AI未返回有效大纲，请重试',
    successUnit: '个大纲',
    async buildMessages(v, projectContext) {
      const existing = await v.plugin.novelService.scanNotesByType('novel-outline', v.currentProject);
      existing.sort((a, b) => (a.frontmatter.chapter_number || 0) - (b.frontmatter.chapter_number || 0));
      const list = existing.map(o => `第${o.frontmatter.chapter_number || '?'}章: ${o.frontmatter.title || ''}`).join('\n');
      return [
        { role: 'system', content: v.plugin.aiManager.prompts.outline.generate() },
        { role: 'user', content: `项目: ${v.currentProject}\n已有大纲:\n${list || '暂无'}\n${projectContext}\n\n请生成新的章节大纲。` }
      ];
    },
    extractItems(result) {
      const data = result.json || result.parsed?.data;
      return data?.outlines || (Array.isArray(data) ? data : []);
    },
    isValidItem(item) { return !!(item.title || item.chapter_number); },
    async saveItem(item, v) {
      await v.plugin.novelService.createNoteFromTemplate('大纲模板',
        v.plugin.novelService.getNovelPath('projects', v.currentProject, 'outlines'),
        { project: v.currentProject, chapter_number: item.chapter_number || '', title: item.title || '', status: 'draft', content: [item.summary, item.scenes, item.characters, item.highlights, item.hook].filter(Boolean).join('\n\n'), created_date: window.moment().format('YYYY-MM-DD') }
      );
    }
  }));

  const items = await view.plugin.novelService.scanNotesByType('novel-outline', view.currentProject);
  items.sort((a, b) => (a.frontmatter.chapter_number || 0) - (b.frontmatter.chapter_number || 0));

  if (items.length === 0) {
    content.createDiv({ cls: 'novel-ai-empty-state' })
      .createDiv({ cls: 'novel-ai-empty-state-text', text: '还没有大纲，点击上方按钮创建或使用AI一键生成' });
    return;
  }

  items.forEach(ol => {
    const card = content.createDiv({ cls: 'novel-ai-card' });
    const header = card.createDiv({ cls: 'novel-ai-card-header' });
    const chNum = ol.frontmatter.chapter_number || '?';
    header.createDiv({ cls: 'novel-ai-card-title', text: `第${chNum}章 ${ol.frontmatter.title || ''}` });

    const expandBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-optimize', text: '✨ AI扩展' });
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      expandOutline(view, card, ol);
    });

    const delBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-delete', text: '🗑' });
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`确定删除大纲「第${chNum}章 ${ol.frontmatter.title || ''}」？`)) {
        await view.plugin.novelService.deleteFile(ol.path);
        view.renderView();
      }
    });

    const status = ol.frontmatter.status || 'draft';
    card.createDiv({ cls: 'novel-ai-card-desc', text: STATUS_LABELS[status] || status });
    card.addEventListener('click', () => {
      view.app.workspace.openLinkText(ol.path, '', true);
    });
  });
}

async function expandOutline(view, cardEl, outlineInfo) {
  const expandBtn = cardEl.querySelector('.novel-ai-btn-optimize');

  let existingPanel = cardEl.querySelector('.novel-ai-optimize-panel');
  if (existingPanel) { existingPanel.remove(); return; }

  if (!view.plugin.settings.apiKey) {
    const panel = cardEl.createDiv({ cls: 'novel-ai-optimize-panel' });
    panel.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' });
    setTimeout(() => panel.remove(), 3000);
    return;
  }

  expandBtn.disabled = true;
  expandBtn.textContent = '⏳ 扩展中...';
  view.markTabBusy('outlines', true);

  try {
    const body = await view.plugin.novelService.getFileContent(outlineInfo);
    if (!body) throw new Error('无法读取大纲内容');

    const aiResult = await view.plugin.aiManager.outline([
      { role: 'system', content: view.plugin.aiManager.prompts.outline.expand },
      { role: 'user', content: `项目: ${outlineInfo.frontmatter.project}\n章节: 第${outlineInfo.frontmatter.chapter_number}章 ${outlineInfo.frontmatter.title || ''}\n\n当前大纲:\n${body}` }
    ]);

    expandBtn.disabled = false;
    expandBtn.textContent = '✨ AI扩展';

    const panel = cardEl.createDiv({ cls: 'novel-ai-optimize-panel' });
    panel.createDiv({ cls: 'novel-ai-optimize-summary' }).createSpan({ text: 'AI扩展结果' });

    const previewDiv = panel.createDiv({ cls: 'novel-ai-preview novel-ai-selectable novel-ai-result-scroll' });
    previewDiv.setText(aiResult.content);

    const actions = panel.createDiv({ cls: 'novel-ai-suggestion-actions' });
    actions.style.marginTop = '8px';
    const copyBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '📋 复制' });
    const closeBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '✕ 关闭' });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(aiResult.content);
        copyBtn.textContent = '✅ 已复制';
        setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 1500);
      } catch (err) { logger.error('复制失败:', err); }
    });
    closeBtn.addEventListener('click', () => panel.remove());
  } catch (err) {
    logger.error('AI扩展失败:', err);
    expandBtn.disabled = false;
    expandBtn.textContent = '✨ AI扩展';
    const panel = cardEl.createDiv({ cls: 'novel-ai-optimize-panel' });
    panel.createDiv({ cls: 'novel-ai-error', text: `扩展失败: ${err.message}` });
    setTimeout(() => panel.remove(), 3000);
  } finally {
    view.markTabBusy('outlines', false);
  }
}

module.exports = { render };
