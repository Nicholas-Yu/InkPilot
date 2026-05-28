async function renderProjectSelector(view, content, title) {
  if (title) {
    content.createDiv({ cls: 'novel-ai-section-title', text: title });
  }

  const projects = await view.plugin.novelService.scanNotesByType('novel-project');

  const select = content.createEl('select', { cls: 'novel-ai-select' });
  select.createEl('option', { text: '-- 选择项目 --', value: '' });
  projects.forEach(p => {
    const name = p.frontmatter.title || p.basename;
    select.createEl('option', { text: name, value: name });
  });
  select.value = view.currentProject;
  select.addEventListener('change', ev => {
    view.currentProject = ev.target.value;
    view.renderView();
  });

  if (!view.currentProject) {
    content.createDiv({ cls: 'novel-ai-empty-state' })
      .createDiv({ cls: 'novel-ai-empty-state-text', text: '请先选择项目' });
    return { projects, selected: false };
  }

  return { projects, selected: true };
}

module.exports = { renderProjectSelector };
