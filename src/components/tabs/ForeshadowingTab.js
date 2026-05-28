const CreateForeshadowingModal = require('../CreateForeshadowingModal');
const { runOptimize } = require('../shared/OptimizePanel');
const { renderProjectSelector } = require('../shared/ProjectSelector');
const { runAIGenerate } = require('../shared/AIGenerate');

async function render(view, content) {
  const { selected } = await renderProjectSelector(view, content, '伏笔追踪');
  if (!selected) return;

  const btnGroup = content.createDiv({ cls: 'novel-ai-btn-group' });
  btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '+ 添加伏笔' })
    .addEventListener('click', () => {
      new CreateForeshadowingModal(view.app, view.plugin, view.currentProject).open();
    });

  const aiGenBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '🤖 AI一键生成伏笔' });
  const aiStatusDiv = content.createDiv({ cls: 'novel-ai-ai-status' });

  aiGenBtn.addEventListener('click', () => runAIGenerate(view, {
    tabId: 'foreshadowing',
    btnEl: aiGenBtn,
    btnText: '🤖 AI一键生成伏笔',
    statusDiv: aiStatusDiv,
    loadingText: '🤖 AI正在根据项目信息生成伏笔...',
    emptyErrorText: 'AI未返回有效伏笔，请重试',
    successUnit: '条伏笔',
    async buildMessages(v, projectContext) {
      const existing = await v.plugin.novelService.scanNotesByType('novel-foreshadowing', v.currentProject);
      const list = existing.map(f => f.frontmatter.content || f.basename).join('、');
      return [
        { role: 'system', content: v.plugin.aiManager.prompts.outline.foreshadowing },
        { role: 'user', content: `项目: ${v.currentProject}\n已有伏笔: ${list || '暂无'}\n${projectContext}\n\n请生成新伏笔。` }
      ];
    },
    extractItems(result) {
      const data = result.json || result.parsed?.data;
      return data?.foreshadowings || (Array.isArray(data) ? data : []);
    },
    isValidItem(item) { return !!item.content; },
    async saveItem(item, v) {
      await v.plugin.novelService.createNoteFromTemplate('伏笔模板',
        v.plugin.novelService.getNovelPath('projects', v.currentProject, 'foreshadowings'),
        { project: v.currentProject, content: item.content, planted_chapter: item.planted_chapter || 1, status: 'active', description: item.description || '', created_date: window.moment().format('YYYY-MM-DD') }
      );
    }
  }));

  const items = await view.plugin.novelService.scanNotesByType('novel-foreshadowing', view.currentProject);

  if (items.length === 0) {
    content.createDiv({ cls: 'novel-ai-empty-state' })
      .createDiv({ cls: 'novel-ai-empty-state-text', text: '还没有伏笔记录，点击上方按钮添加或使用AI一键生成' });
    return;
  }

  items.forEach(f => {
    const card = content.createDiv({ cls: 'novel-ai-card' });
    const header = card.createDiv({ cls: 'novel-ai-card-header' });
    const status = f.frontmatter.status || 'active';
    const statusBadge = status === 'active' ? '🚩' : '✅';
    header.createDiv({ cls: 'novel-ai-card-title', text: `${statusBadge} ${f.frontmatter.content || f.basename}` });

    const optBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-optimize', text: '✨ AI优化' });
    optBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runOptimize(view, card, f, 'novel-foreshadowing', view.currentProject);
    });

    const delBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-delete', text: '🗑' });
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`确定删除伏笔「${f.frontmatter.content || f.basename}」？`)) {
        await view.plugin.novelService.deleteFile(f.path);
        view.renderView();
      }
    });

    if (f.frontmatter.planted_chapter) {
      card.createDiv({ cls: 'novel-ai-card-desc', text: `埋设章节: 第${f.frontmatter.planted_chapter}章` });
    }
    card.addEventListener('click', () => {
      view.app.workspace.openLinkText(f.path, '', true);
    });
  });
}

module.exports = { render };
