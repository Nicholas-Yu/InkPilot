const CreateCharacterModal = require('../CreateCharacterModal');
const { runOptimize } = require('../shared/OptimizePanel');
const { renderProjectSelector } = require('../shared/ProjectSelector');
const { runAIGenerate } = require('../shared/AIGenerate');

async function render(view, content) {
  const { selected } = await renderProjectSelector(view, content, '角色列表');
  if (!selected) return;

  const btnGroup = content.createDiv({ cls: 'novel-ai-btn-group' });
  btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '+ 新建角色' })
    .addEventListener('click', () => {
      new CreateCharacterModal(view.app, view.plugin, view.currentProject).open();
    });

  const aiGenBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '🤖 AI一键生成角色' });
  const aiStatusDiv = content.createDiv({ cls: 'novel-ai-ai-status' });

  aiGenBtn.addEventListener('click', () => runAIGenerate(view, {
    tabId: 'characters',
    btnEl: aiGenBtn,
    btnText: '🤖 AI一键生成角色',
    statusDiv: aiStatusDiv,
    loadingText: '🤖 AI正在根据项目信息生成角色...',
    emptyErrorText: 'AI未返回有效角色，请重试',
    successUnit: '个角色',
    async buildMessages(v, projectContext) {
      const existing = await v.plugin.novelService.scanNotesByType('novel-character', v.currentProject);
      const names = existing.map(c => c.frontmatter.name || c.basename).join('、');
      return [
        { role: 'system', content: v.plugin.aiManager.prompts.outline.character },
        { role: 'user', content: `项目: ${v.currentProject}\n已有角色: ${names || '暂无'}\n${projectContext}\n\n请生成新角色。` }
      ];
    },
    extractItems(result) {
      const data = result.json || result.parsed?.data;
      return data?.characters || (Array.isArray(data) ? data : []);
    },
    isValidItem(item) { return !!item.name; },
    async saveItem(item, v) {
      await v.plugin.novelService.createNoteFromTemplate('角色模板',
        v.plugin.novelService.getNovelPath('projects', v.currentProject, 'characters'),
        { project: v.currentProject, name: item.name, role: item.role || 'support', created_date: window.moment().format('YYYY-MM-DD') }
      );
    }
  }));

  const chars = await view.plugin.novelService.scanNotesByType('novel-character', view.currentProject);

  if (chars.length === 0) {
    content.createDiv({ cls: 'novel-ai-empty-state' })
      .createDiv({ cls: 'novel-ai-empty-state-text', text: '还没有角色，点击上方按钮创建或使用AI一键生成' });
    return;
  }

  chars.forEach(c => {
    const card = content.createDiv({ cls: 'novel-ai-card' });
    const header = card.createDiv({ cls: 'novel-ai-card-header' });
    header.createDiv({ cls: 'novel-ai-card-title', text: c.frontmatter.name || c.basename });

    const optBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-optimize', text: '✨ AI优化' });
    optBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runOptimize(view, card, c, 'novel-character', view.currentProject);
    });

    const delBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-delete', text: '🗑' });
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`确定删除角色「${c.frontmatter.name || c.basename}」？`)) {
        await view.plugin.novelService.deleteFile(c.path);
        view.renderView();
      }
    });

    if (c.frontmatter.role) {
      const typeLabels = { main: '主角', support: '配角', villain: '反派', guest: '客串' };
      card.createDiv({ cls: 'novel-ai-card-desc', text: `身份: ${typeLabels[c.frontmatter.role] || c.frontmatter.role}` });
    }
    card.addEventListener('click', () => {
      view.app.workspace.openLinkText(c.path, '', true);
    });
  });
}

module.exports = { render };
