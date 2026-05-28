const logger = require('../../utils/logger');
const CreateProjectModal = require('../CreateProjectModal');
const JSONParser = require('../../utils/jsonParser');
const { renderSuggestionCards } = require('../shared/SuggestionCards');
const { showTempPanel } = require('../shared/OptimizePanel');

async function render(view, content) {
  content.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '+ 新建项目' })
    .addEventListener('click', () => {
      new CreateProjectModal(view.app, view.plugin).open();
    });

  content.createDiv({ cls: 'novel-ai-section-title', text: '小说项目列表' });

  const projects = await view.plugin.novelService.scanNotesByType('novel-project');

  if (projects.length === 0) {
    content.createDiv({ cls: 'novel-ai-empty-state' })
      .createDiv({ cls: 'novel-ai-empty-state-text', text: '还没有小说项目，点击上方按钮创建' });
    return;
  }

  for (const p of projects) {
    const projectName = p.frontmatter.title || p.basename;
    const card = content.createDiv({ cls: 'novel-ai-card' });
    const header = card.createDiv({ cls: 'novel-ai-card-header' });
    header.createDiv({ cls: 'novel-ai-card-title', text: projectName });

    const optBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-optimize', text: '✨ AI优化' });
    optBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      optimizeProject(view, card, p, projectName);
    });

    const kbBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '📚 知识库' });
    kbBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleKnowledgeBase(view, card, projectName);
    });

    const delBtn = header.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-delete', text: '🗑' });
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`确定删除项目「${projectName}」及其所有相关文件（章节、角色、大纲等）？此操作不可撤销！`)) {
        const folder = view.plugin.novelService.getNovelPath('projects', projectName);
        const folderFile = view.app.vault.getAbstractFileByPath(folder);
        if (folderFile) {
          await view.app.vault.delete(folderFile, true);
        } else {
          await view.plugin.novelService.deleteFile(p.path);
        }
        view.plugin.novelService.invalidateCache();
        view.renderView();
      }
    });

    if (p.frontmatter.genre) {
      card.createDiv({ cls: 'novel-ai-card-desc', text: `类型: ${p.frontmatter.genre}` });
    }

    card.addEventListener('click', () => {
      view.currentProject = projectName;
      view.app.workspace.openLinkText(p.path, '', false);
    });
  }
}

async function optimizeProject(view, card, projectInfo, projectName) {
  const optBtn = card.querySelector('.novel-ai-btn-optimize');

  let existingPanel = card.querySelector('.novel-ai-optimize-panel');
  if (existingPanel) { existingPanel.remove(); return; }

  if (!view.plugin.settings.apiKey) {
    showTempPanel(card, 'novel-ai-error', '请先配置API Key');
    return;
  }

  optBtn.disabled = true;
  optBtn.textContent = '⏳ 分析中...';
  view.markTabBusy('projects', true);

  try {
    const body = await view.plugin.novelService.getProjectDescription(projectName);
    if (!body || body.trim().length < 10) {
      optBtn.disabled = false;
      optBtn.textContent = '✨ AI优化';
      showTempPanel(card, 'novel-ai-error', '项目描述内容太少，请先编辑项目描述');
      return;
    }

    const aiResult = await view.plugin.aiManager.reviewForJSON([
      { role: 'system', content: view.plugin.aiManager.prompts.review.project },
      { role: 'user', content: `项目名称: ${projectName}\n\n项目描述:\n${body}` }
    ]);

    const suggestionData = JSONParser.ensureSuggestions(aiResult.json, aiResult.raw);

    optBtn.disabled = false;
    optBtn.textContent = '✨ AI优化';

    if (suggestionData.suggestions && suggestionData.suggestions.length > 0) {
      renderProjectOptimizePanel(view, card, suggestionData.suggestions, projectInfo);
    } else {
      showTempPanel(card, 'novel-ai-success', '✨ 项目描述已经很完善，无需优化！');
    }
  } catch (err) {
    logger.error('AI优化项目失败:', err);
    optBtn.disabled = false;
    optBtn.textContent = '✨ AI优化';
    showTempPanel(card, 'novel-ai-error', `优化失败: ${err.message}`);
  } finally {
    view.markTabBusy('projects', false);
  }
}

function renderProjectOptimizePanel(view, cardEl, suggestions, projectInfo) {
  const panel = cardEl.createDiv({ cls: 'novel-ai-optimize-panel' });
  panel.addEventListener('click', (e) => { e.stopPropagation(); });

  const summary = panel.createDiv({ cls: 'novel-ai-optimize-summary' });
  summary.createSpan({ text: `AI优化建议 (${suggestions.length}条)` });
  const closeBtn = summary.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '✕ 关闭' });
  closeBtn.addEventListener('click', () => panel.remove());

  const applyFn = (s) => view.plugin.novelService.updateFileBody(projectInfo, s.original, s.replacement);
  renderSuggestionCards(view, panel, suggestions, applyFn);
}

async function toggleKnowledgeBase(view, card, projectName) {
  let existing = card.querySelector('.novel-ai-kb-panel');
  if (existing) { existing.remove(); return; }

  const panel = card.createDiv({ cls: 'novel-ai-kb-panel' });
  panel.addEventListener('click', (e) => { e.stopPropagation(); });
  panel.createDiv({ cls: 'novel-ai-kb-title', text: '📚 项目知识库' });
  panel.createDiv({ cls: 'novel-ai-kb-hint', text: '选择文件后立即存储到知识库。点击 🤖 按钮对单个文件进行 AI 提取摘要。' });

  const fileList = panel.createDiv({ cls: 'novel-ai-kb-files' });
  await renderKBFiles(view, fileList, projectName);

  const uploadRow = panel.createDiv({ cls: 'novel-ai-kb-upload-row' });
  const fileInput = uploadRow.createEl('input', { type: 'file', cls: 'novel-ai-kb-file-input' });
  fileInput.setAttribute('accept', '.md,.txt');
  fileInput.setAttribute('multiple', 'true');

  const extractAllBtn = uploadRow.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary novel-ai-btn-sm', text: '🤖 全部AI提取' });
  const statusDiv = panel.createDiv({ cls: 'novel-ai-kb-status' });

  fileInput.addEventListener('change', async () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    statusDiv.empty();
    statusDiv.createDiv({ cls: 'novel-ai-loading', text: `正在上传 ${files.length} 个文件...` });

    try {
      const folder = view.plugin.novelService.getNovelPath('projects', projectName, 'knowledge');
      const folderFile = view.app.vault.getAbstractFileByPath(folder);
      if (!folderFile) {
        try { await view.app.vault.createFolder(folder); } catch (e) {}
      }

      let uploaded = 0;
      for (const file of files) {
        const text = await file.text();
        if (!text.trim()) continue;

        const fileName = file.name.replace(/\.[^.]+$/, '');
        const filePath = `${folder}/${fileName}.md`;

        const existingFile = view.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
          await view.app.vault.delete(existingFile);
        }

        const kbContent = `---
type: novel-knowledge
project: ${projectName}
source: ${file.name}
status: raw
created_date: ${window.moment().format('YYYY-MM-DD')}
---

${text}
`;
        await view.app.vault.create(filePath, kbContent);
        uploaded++;
      }

      view.plugin.novelService.invalidateCache();
      await new Promise(resolve => setTimeout(resolve, 300));
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-success', text: `✅ 成功上传 ${uploaded} 个文件！` });
      await renderKBFiles(view, fileList, projectName);
      fileInput.value = '';
    } catch (err) {
      logger.error('知识库上传失败:', err);
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-error', text: `上传失败: ${err.message}` });
    }
  });

  extractAllBtn.addEventListener('click', async () => {
    if (!view.plugin.settings.apiKey) {
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-error', text: '请先配置 API Key' });
      return;
    }

    const kbFiles = await view.plugin.novelService.getKnowledgeFiles(projectName);
    const rawFiles = kbFiles.filter(f => {
      const fm = view.app.metadataCache.getFileCache(f)?.frontmatter || {};
      return fm.status === 'raw' || !fm.status;
    });

    if (rawFiles.length === 0) {
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-success', text: '所有文件已提取，无需重复操作' });
      return;
    }

    extractAllBtn.disabled = true;
    extractAllBtn.textContent = '⏳ 提取中...';
    statusDiv.empty();
    statusDiv.createDiv({ cls: 'novel-ai-loading', text: `正在AI提取 ${rawFiles.length} 个文件...` });
    view.markTabBusy('projects', true);

    try {
      let extracted = 0;
      for (const f of rawFiles) {
        const txt = await view.app.vault.read(f);
        const body = txt.replace(/^---[\s\S]*?---\n/, '');
        const fm = view.app.metadataCache.getFileCache(f)?.frontmatter || {};
        const source = fm.source || f.basename;

        const summary = await extractWritingKnowledge(view, body, source);

        const newContent = `---
type: novel-knowledge
project: ${projectName}
source: ${source}
status: extracted
created_date: ${fm.created_date || window.moment().format('YYYY-MM-DD')}
updated_date: ${window.moment().format('YYYY-MM-DD')}
---

# ${f.basename} - 写作知识提取

${summary}
`;
        await view.app.vault.modify(f, newContent);
        extracted++;
      }

      view.plugin.novelService.invalidateCache();
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-success', text: `✅ 成功提取 ${extracted} 个文件！` });
      await renderKBFiles(view, fileList, projectName);
    } catch (err) {
      logger.error('批量AI提取失败:', err);
      statusDiv.empty();
      statusDiv.createDiv({ cls: 'novel-ai-error', text: `提取失败: ${err.message}` });
    } finally {
      extractAllBtn.disabled = false;
      extractAllBtn.textContent = '🤖 全部AI提取';
      view.markTabBusy('projects', false);
    }
  });
}

async function renderKBFiles(view, container, projectName) {
  container.empty();
  const files = await view.plugin.novelService.getKnowledgeFiles(projectName);

  if (files.length === 0) {
    container.createDiv({ cls: 'novel-ai-kb-empty', text: '暂无知识库文件，请通过上方「选择文件」上传' });
    return;
  }

  for (const f of files) {
    const fm = view.app.metadataCache.getFileCache(f)?.frontmatter || {};
    const isRaw = fm.status === 'raw' || !fm.status;

    const row = container.createDiv({ cls: 'novel-ai-kb-file-row' });
    const statusIcon = isRaw ? '📄' : '✅';
    const nameDiv = row.createDiv({ cls: 'novel-ai-kb-file-name', text: `${statusIcon} ${f.basename}` });
    nameDiv.style.cursor = 'pointer';
    nameDiv.style.flex = '1';

    if (isRaw) {
      row.createDiv({ cls: 'novel-ai-kb-status-badge', text: '待提取' });
    }

    const actions = row.createDiv({ cls: 'novel-ai-kb-file-actions' });

    const viewBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '👁' });
    viewBtn.setAttribute('title', '查看文件内容');

    const extractBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '🤖' });
    extractBtn.setAttribute('title', isRaw ? 'AI提取摘要' : '重新AI提取');

    const delBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '🗑' });
    delBtn.setAttribute('title', '删除');

    const detailPanel = container.createDiv({ cls: 'novel-ai-kb-detail-panel' });
    detailPanel.style.display = 'none';

    viewBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (detailPanel.style.display === 'none') {
        detailPanel.style.display = '';
        detailPanel.empty();
        detailPanel.createDiv({ cls: 'novel-ai-loading', text: '加载中...' });
        try {
          const txt = await view.app.vault.read(f);
          const body = txt.replace(/^---[\s\S]*?---\n/, '');
          detailPanel.empty();
          const contentDiv = detailPanel.createDiv({ cls: 'novel-ai-kb-detail-content' });
          contentDiv.setText(body);
        } catch (err) {
          detailPanel.empty();
          detailPanel.createDiv({ cls: 'novel-ai-error', text: `读取失败: ${err.message}` });
        }
      } else {
        detailPanel.style.display = 'none';
      }
    });

    extractBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!view.plugin.settings.apiKey) {
        alert('请先配置 API Key');
        return;
      }

      extractBtn.disabled = true;
      extractBtn.textContent = '⏳';

      try {
        const txt = await view.app.vault.read(f);
        const body = txt.replace(/^---[\s\S]*?---\n/, '');
        const source = fm.source || f.basename;

        const summary = await extractWritingKnowledge(view, body, source);

        const newContent = `---
type: novel-knowledge
project: ${projectName}
source: ${source}
status: extracted
created_date: ${fm.created_date || window.moment().format('YYYY-MM-DD')}
updated_date: ${window.moment().format('YYYY-MM-DD')}
---

# ${f.basename} - 写作知识提取

${summary}
`;
        await view.app.vault.modify(f, newContent);
        view.plugin.novelService.invalidateCache();

        extractBtn.textContent = '✅';
        setTimeout(() => { extractBtn.textContent = '🤖'; extractBtn.disabled = false; }, 1500);

        if (detailPanel.style.display !== 'none') {
          detailPanel.empty();
          const contentDiv = detailPanel.createDiv({ cls: 'novel-ai-kb-detail-content' });
          contentDiv.setText(summary);
        }

        nameDiv.textContent = `✅ ${f.basename}`;
        const badge = row.querySelector('.novel-ai-kb-status-badge');
        if (badge) badge.remove();
      } catch (err) {
        logger.error('AI提取失败:', err);
        extractBtn.textContent = '❌';
        setTimeout(() => { extractBtn.textContent = '🤖'; extractBtn.disabled = false; }, 1500);
      }
    });

    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`确定删除知识文件「${f.basename}」？`)) {
        await view.plugin.novelService.deleteFile(f.path);
        await new Promise(resolve => setTimeout(resolve, 200));
        await renderKBFiles(view, container, projectName);
      }
    });
  }
}

async function extractWritingKnowledge(view, text, fileName) {
  const truncated = text.substring(0, 6000);

  const result = await view.plugin.aiManager.outline([
    { role: 'system', content: view.plugin.aiManager.prompts.outline.knowledge },
    { role: 'user', content: `文件名: ${fileName}\n\n内容:\n${truncated}` }
  ]);

  return result.content;
}

module.exports = { render };
