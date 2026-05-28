const logger = require('../../utils/logger');
const { runOptimize } = require('../shared/OptimizePanel');
const { renderProjectSelector } = require('../shared/ProjectSelector');
const { runAIGenerate } = require('../shared/AIGenerate');

const CATEGORIES = [
  { value: 'power', label: '力量体系' },
  { value: 'geography', label: '地理设定' },
  { value: 'faction', label: '势力分布' },
  { value: 'history', label: '历史背景' },
  { value: 'rule', label: '世界规则' },
  { value: 'culture', label: '文化习俗' },
  { value: 'other', label: '其他' }
];

const CATEGORY_LABELS = {};
CATEGORIES.forEach(c => { CATEGORY_LABELS[c.value] = c.label; });

async function render(view, content) {
  const { selected, projects } = await renderProjectSelector(view, content, '世界观设定');
  if (!selected) return;

  const btnGroup = content.createDiv({ cls: 'novel-ai-btn-group' });
  const addBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '+ 添加设定' });
  const aiGenBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '🤖 AI一键生成世界观' });

  const quickAddPanel = content.createDiv({ cls: 'novel-ai-quick-add-panel' });
  quickAddPanel.style.display = 'none';

  const nameRow = quickAddPanel.createDiv({ cls: 'novel-ai-form-group' });
  nameRow.createDiv({ cls: 'novel-ai-form-label', text: '设定名称' });
  const nameInput = nameRow.createEl('input', { cls: 'novel-ai-input', type: 'text' });
  nameInput.setAttribute('placeholder', '例如: 修炼体系、大陆地理...');

  const catRow = quickAddPanel.createDiv({ cls: 'novel-ai-form-group' });
  catRow.createDiv({ cls: 'novel-ai-form-label', text: '设定类别' });
  const catSelect = catRow.createEl('select', { cls: 'novel-ai-select' });
  CATEGORIES.forEach(c => catSelect.createEl('option', { text: c.label, value: c.value }));

  const descRow = quickAddPanel.createDiv({ cls: 'novel-ai-form-group' });
  descRow.createDiv({ cls: 'novel-ai-form-label', text: '简要描述（可选，AI会根据描述扩展）' });
  const descInput = descRow.createEl('textarea', { cls: 'novel-ai-textarea' });
  descInput.setAttribute('placeholder', '简单描述设定要点，留空则创建空白设定...');
  descInput.setAttribute('rows', '2');

  const actionRow = quickAddPanel.createDiv({ cls: 'novel-ai-btn-group' });
  const confirmBtn = actionRow.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '✅ 确认添加' });
  const cancelBtn = actionRow.createEl('button', { cls: 'novel-ai-btn', text: '✕ 取消' });

  addBtn.addEventListener('click', () => {
    quickAddPanel.style.display = quickAddPanel.style.display === 'none' ? '' : 'none';
    nameInput.value = '';
    descInput.value = '';
    catSelect.value = 'power';
    if (quickAddPanel.style.display !== 'none') {
      nameInput.focus();
    }
  });

  cancelBtn.addEventListener('click', () => {
    quickAddPanel.style.display = 'none';
  });

  confirmBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = 'var(--text-error)';
      setTimeout(() => { nameInput.style.borderColor = ''; }, 2000);
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ 创建中...';

    try {
      await view.plugin.novelService.createNoteFromTemplate(
        '世界观模板',
        view.plugin.novelService.getNovelPath('projects', view.currentProject, 'worldsettings'),
        {
          project: view.currentProject,
          name: name,
          category: catSelect.value,
          description: descInput.value.trim(),
          created_date: window.moment().format('YYYY-MM-DD')
        }
      );
      view.plugin.novelService.invalidateCache();
      quickAddPanel.style.display = 'none';
      view.renderView();
    } catch (err) {
      logger.error('创建设定失败:', err);
      confirmBtn.disabled = false;
      confirmBtn.textContent = '✅ 确认添加';
    }
  });

  const aiGenPanel = content.createDiv({ cls: 'novel-ai-ai-gen-panel' });
  aiGenPanel.style.display = 'none';

  aiGenPanel.createDiv({ cls: 'novel-ai-form-label', text: 'AI一键生成世界观' });
  aiGenPanel.createDiv({ cls: 'novel-ai-card-desc', text: 'AI将根据项目类型和已有设定，自动生成完整的世界观框架。你可以选择要生成的类别：' });

  const catCheckGroup = aiGenPanel.createDiv({ cls: 'novel-ai-cat-checks' });
  CATEGORIES.filter(c => c.value !== 'other').forEach(c => {
    const label = catCheckGroup.createEl('label', { cls: 'novel-ai-cat-check' });
    const cb = label.createEl('input', { type: 'checkbox' });
    cb.checked = true;
    cb.setAttribute('data-cat', c.value);
    label.appendText(c.label);
  });

  const aiHintRow = aiGenPanel.createDiv({ cls: 'novel-ai-form-group' });
  aiHintRow.style.marginTop = '8px';
  aiHintRow.createDiv({ cls: 'novel-ai-form-label', text: '补充要求（可选）' });
  const aiHintInput = aiHintRow.createEl('textarea', { cls: 'novel-ai-textarea' });
  aiHintInput.setAttribute('placeholder', '例如：偏向东方玄幻风格、需要包含三大帝国...');
  aiHintInput.setAttribute('rows', '2');

  const aiActionRow = aiGenPanel.createDiv({ cls: 'novel-ai-btn-group' });
  aiActionRow.style.marginTop = '8px';
  const aiConfirmBtn = aiActionRow.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '🤖 开始生成' });
  const aiCancelBtn = aiActionRow.createEl('button', { cls: 'novel-ai-btn', text: '✕ 取消' });

  const aiStatusDiv = aiGenPanel.createDiv({ cls: 'novel-ai-ai-status' });
  aiStatusDiv.style.display = 'none';

  aiGenBtn.addEventListener('click', async () => {
    if (!view.plugin.settings.apiKey) {
      const panel = content.createDiv({ cls: 'novel-ai-error' });
      panel.textContent = '请先配置API Key';
      setTimeout(() => panel.remove(), 3000);
      return;
    }

    const desc = await view.plugin.novelService.getProjectDescription(view.currentProject);
    if (!desc || desc.trim().length < 10) {
      const panel = content.createDiv({ cls: 'novel-ai-error' });
      panel.textContent = '请先完善项目说明（故事梗概、世界观等），AI需要基于项目信息生成世界观';
      setTimeout(() => panel.remove(), 5000);
      return;
    }

    aiGenPanel.style.display = aiGenPanel.style.display === 'none' ? '' : 'none';
    aiStatusDiv.style.display = 'none';
  });

  aiCancelBtn.addEventListener('click', () => {
    aiGenPanel.style.display = 'none';
  });

  aiConfirmBtn.addEventListener('click', () => {
    const selectedCats = [];
    catCheckGroup.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.checked) selectedCats.push(cb.getAttribute('data-cat'));
    });

    if (selectedCats.length === 0) {
      aiStatusDiv.style.display = '';
      aiStatusDiv.empty();
      aiStatusDiv.createDiv({ cls: 'novel-ai-error', text: '请至少选择一个类别' });
      return;
    }

    aiStatusDiv.style.display = '';
    const hint = aiHintInput.value.trim();
    const projectInfo = projects.find(p => (p.frontmatter.title || p.basename) === view.currentProject);
    const genre = projectInfo?.frontmatter?.genre || '玄幻';
    const catNames = selectedCats.map(c => CATEGORY_LABELS[c]).join('、');

    runAIGenerate(view, {
      tabId: 'worldsettings',
      btnEl: aiConfirmBtn,
      btnText: '🤖 开始生成',
      statusDiv: aiStatusDiv,
      loadingText: '🤖 AI正在生成世界观框架...',
      emptyErrorText: 'AI未返回有效设定，请重试',
      successUnit: '条设定',
      async buildMessages(v, projectContext) {
        const existing = await v.plugin.novelService.scanNotesByType('novel-worldsetting', v.currentProject);
        const names = existing.map(i => i.frontmatter.name || i.basename).join('、');
        return [
          { role: 'system', content: v.plugin.aiManager.prompts.outline.worldsetting(selectedCats.join('/')) },
          { role: 'user', content: `项目: ${v.currentProject}\n类型: ${genre}\n需要生成的类别: ${catNames}\n已有世界观设定: ${names || '暂无'}\n${hint ? `补充要求: ${hint}` : ''}\n\n${projectContext ? `=== 项目已有信息 ===\n${projectContext}` : ''}\n\n请基于以上信息生成世界观设定。` }
        ];
      },
      extractItems(result) {
        const data = result.json || result.parsed?.data;
        return data?.settings || data?.items || (Array.isArray(data) ? data : []);
      },
      isValidItem(item) { return !!item.name; },
      async saveItem(item, v) {
        await v.plugin.novelService.createNoteFromTemplate('世界观模板',
          v.plugin.novelService.getNovelPath('projects', v.currentProject, 'worldsettings'),
          { project: v.currentProject, name: item.name, category: item.category || selectedCats[0], created_date: window.moment().format('YYYY-MM-DD') }
        );
      }
    }).then(() => {
      aiGenPanel.style.display = 'none';
    });
  });

  const items = await view.plugin.novelService.scanNotesByType('novel-worldsetting', view.currentProject);

  if (items.length === 0) {
    content.createDiv({ cls: 'novel-ai-empty-state' })
      .createDiv({ cls: 'novel-ai-empty-state-text', text: '还没有世界观设定，点击上方按钮添加或使用AI一键生成' });
    return;
  }

  const grouped = {};
  items.forEach(ws => {
    const cat = ws.frontmatter.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ws);
  });

  CATEGORIES.forEach(catDef => {
    const catItems = grouped[catDef.value];
    if (!catItems || catItems.length === 0) return;

    content.createDiv({ cls: 'novel-ai-section-title', text: `${catDef.label} (${catItems.length})` });

    catItems.forEach(ws => {
      const card = content.createDiv({ cls: 'novel-ai-card' });
      const header = card.createDiv({ cls: 'novel-ai-card-header' });
      header.createDiv({ cls: 'novel-ai-card-title', text: ws.frontmatter.name || ws.basename });

      const optBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-optimize', text: '✨ AI优化' });
      optBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        runOptimize(view, card, ws, 'novel-worldsetting', view.currentProject);
      });

      const delBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-delete', text: '🗑' });
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`确定删除世界观设定「${ws.frontmatter.name || ws.basename}」？`)) {
          await view.plugin.novelService.deleteFile(ws.path);
          view.renderView();
        }
      });

      card.addEventListener('click', () => {
        view.app.workspace.openLinkText(ws.path, '', true);
      });
    });
  });
}

module.exports = { render };
