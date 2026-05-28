const obsidian = require('obsidian');
const logger = require('../../utils/logger');
const { renderProjectSelector } = require('../shared/ProjectSelector');

const TYPE_MAP = { chapter: '📝 章节', brainstorm: '💡 风暴', continue: '📖 续写', rewrite: '🔄 改写', expand: '📝 扩写', chat: '💬 对话' };
const LABEL_TO_TYPE = { '生成章节': 'chapter', '头脑风暴': 'brainstorm', '续写': 'continue', '改写': 'rewrite', '扩写': 'expand' };
function labelToType(label) { return LABEL_TO_TYPE[label] || label; }

async function render(view, content) {
  if (view.currentProject && view.generatedResults.length === 0) {
    const history = await view.plugin.novelService.loadGenerateHistory(view.currentProject);
    if (history.length > 0) {
      view.generatedResults = history;
      view.currentDisplayIndex = history.length - 1;
    }
  }

  const { selected } = await renderProjectSelector(view, content, '章节生成');
  if (!selected) return;

  const numGroup = content.createDiv({ cls: 'novel-ai-form-group' });
  numGroup.createDiv({ cls: 'novel-ai-form-label', text: '章节编号' });
  const numInput = numGroup.createEl('input', { cls: 'novel-ai-input', type: 'number' });
  numInput.setAttribute('placeholder', '1');
  numInput.setAttribute('min', '1');
  if (view.generatedChapterNumber) numInput.value = String(view.generatedChapterNumber);

  const outlineGroup = content.createDiv({ cls: 'novel-ai-form-group' });
  outlineGroup.createDiv({ cls: 'novel-ai-form-label', text: '章节大纲' });
  const outlineArea = outlineGroup.createEl('textarea', { cls: 'novel-ai-textarea' });
  outlineArea.setAttribute('placeholder', '输入本章大纲或剧情要点...');
  outlineArea.setAttribute('rows', '3');
  if (view.generatedOutline) outlineArea.value = view.generatedOutline;

  const btnGroup = content.createDiv({ cls: 'novel-ai-btn-group' });
  const genBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '✍️ 生成章节' });
  const bsBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '💡 头脑风暴' });
  const continueBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '📖 续写' });
  const rewriteBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '🔄 改写' });
  const expandBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '📝 扩写' });
  const stopBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-stop', text: '⏹ 停止' });
  stopBtn.style.display = 'none';
  const saveBtn = btnGroup.createEl('button', { cls: 'novel-ai-btn', text: '💾 保存章节' });
  saveBtn.disabled = true;
  saveBtn.style.opacity = '0.5';
  saveBtn.style.cursor = 'not-allowed';

  if (view.generatedResults.some(r => r.type === 'chapter' || r.type === 'chat')) {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    saveBtn.style.cursor = 'pointer';
  }

  if (view.generatedResults.length > 0) {
    content.createDiv({ cls: 'novel-ai-section-title', text: '历史结果' });
    const cardsContainer = content.createDiv({ cls: 'novel-ai-result-cards' });
    view.generatedResults.forEach((r, idx) => {
      const typeLabel = TYPE_MAP[r.type] || r.type;
      const card = cardsContainer.createDiv({ cls: `novel-ai-result-card ${view.currentDisplayIndex === idx ? 'active' : ''}` });
      card.createDiv({ cls: 'novel-ai-result-card-type', text: typeLabel });
      card.createDiv({ cls: 'novel-ai-result-card-preview', text: r.content.substring(0, 50) + '...' });

      const delBtn = card.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-delete', text: '🗑' });
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`确定删除此条${typeLabel}结果？`)) {
          view.generatedResults.splice(idx, 1);
          if (view.currentDisplayIndex >= view.generatedResults.length) {
            view.currentDisplayIndex = view.generatedResults.length - 1;
          }
          view.plugin.novelService.saveGenerateHistory(view.currentProject, view.generatedResults);
          view.renderView();
        }
      });

      card.addEventListener('click', () => {
        view.currentDisplayIndex = idx;
        view.renderView();
      });
    });
  }

  content.createDiv({ cls: 'novel-ai-section-title', text: '生成结果' });
  const preview = content.createDiv({ cls: 'novel-ai-preview novel-ai-selectable' });

  if (view.currentDisplayIndex >= 0 && view.currentDisplayIndex < view.generatedResults.length) {
    preview.setText(view.generatedResults[view.currentDisplayIndex].content);
  } else {
    preview.createDiv({ cls: 'novel-ai-preview-empty', text: '点击生成按钮开始...（可鼠标选中复制）' });
  }

  const chatSection = content.createDiv({ cls: 'novel-ai-chat-container' });
  chatSection.style.display = view._chatVisible ? '' : 'none';

  const chatMessages = chatSection.createDiv({ cls: 'novel-ai-chat-messages' });
  const chatInputRow = chatSection.createDiv({ cls: 'novel-ai-chat-input-row' });
  const chatInput = chatInputRow.createEl('textarea', { cls: 'novel-ai-chat-input' });
  chatInput.setAttribute('placeholder', '输入修改要求，如：增加更多对话、改变结局走向...');
  chatInput.setAttribute('rows', '1');
  const chatSendBtn = chatInputRow.createEl('button', { cls: 'novel-ai-chat-send-btn', text: '发送' });

  let currentStream = null;
  let conversationHistory = view._conversationHistory || [];

  if (view._chatMessages && view._chatMessages.length > 0) {
    view._chatMessages.forEach(msg => {
      const msgDiv = chatMessages.createDiv({ cls: `novel-ai-chat-msg novel-ai-chat-msg-${msg.role}` });
      msgDiv.textContent = msg.text;
    });
    setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
  }

  function trimHistory(history, maxRounds) {
    const maxMessages = maxRounds * 2;
    if (history.length <= maxMessages) return history;
    return history.slice(history.length - maxMessages);
  }

  function saveChatState() {
    view._chatVisible = chatSection.style.display !== 'none';
    view._conversationHistory = conversationHistory;
    const msgs = chatMessages.querySelectorAll('.novel-ai-chat-msg');
    view._chatMessages = Array.from(msgs).map(el => ({
      role: el.classList.contains('novel-ai-chat-msg-user') ? 'user' : 'ai',
      text: el.textContent
    }));
  }

  function addResult(type, text) {
    view.generatedResults.push({ type, content: text, timestamp: Date.now() });
    view.currentDisplayIndex = view.generatedResults.length - 1;
    view.plugin.novelService.saveGenerateHistory(view.currentProject, view.generatedResults);
    saveChatState();
    view.renderView();
  }

  function setStreaming(active) {
    if (active) {
      stopBtn.style.display = '';
      view.markTabBusy('generate', true);
      [genBtn, bsBtn, continueBtn, rewriteBtn, expandBtn].forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
    } else {
      stopBtn.style.display = 'none';
      view.markTabBusy('generate', false);
      [genBtn, bsBtn, continueBtn, rewriteBtn, expandBtn].forEach(b => { b.disabled = false; b.style.opacity = '1'; });
      currentStream = null;
    }
  }

  stopBtn.addEventListener('click', () => {
    if (currentStream && currentStream.abort) {
      currentStream.abort();
    }
  });

  async function streamAI(type, messages, label) {
    preview.empty();
    preview.createDiv({ cls: 'novel-ai-loading', text: `正在${label}...（流式输出中）` });

    showChat();
    setStreaming(true);
    let partialContent = '';

    try {
      let previewTextEl = null;

      const streamFn = type === 'outline' ? view.plugin.aiManager.outlineStream.bind(view.plugin.aiManager) : view.plugin.aiManager.writingStream.bind(view.plugin.aiManager);
      currentStream = streamFn(messages, (chunk, fullText) => {
        partialContent = fullText;
        if (!previewTextEl) {
          preview.empty();
          previewTextEl = preview.createDiv({ cls: 'novel-ai-stream-text' });
        }
        previewTextEl.textContent = fullText;
        preview.scrollTop = preview.scrollHeight;
      });

      const result = await currentStream;
      setStreaming(false);

      if (result.aborted && partialContent) {
        preview.empty();
        const stoppedDiv = preview.createDiv({ cls: 'novel-ai-stream-text' });
        stoppedDiv.textContent = partialContent;
        preview.createDiv({ cls: 'novel-ai-success', text: '⏹ 已停止生成，已保留当前内容（结果可能不完整，请自行判断是否保留或删除）' });
        addResult(labelToType(label), partialContent);
        return { content: partialContent, tokens: result.tokens, cost: result.cost };
      }

      if (result.aborted) return null;

      addResult(labelToType(label), result.content);

      return result;
    } catch (err) {
      setStreaming(false);
      logger.error(`${label}失败:`, err);

      if (partialContent) {
        preview.empty();
        const stoppedDiv = preview.createDiv({ cls: 'novel-ai-stream-text' });
        stoppedDiv.textContent = partialContent;
        preview.createDiv({ cls: 'novel-ai-success', text: '⏹ 已停止，已保留已生成的内容（结果可能不完整，请自行判断是否保留）' });
        addResult(labelToType(label), partialContent);
        return { content: partialContent, tokens: 0, cost: 0 };
      }

      preview.empty();
      preview.createDiv({ cls: 'novel-ai-error', text: `失败: ${err.message}` });
      return null;
    }
  }

  function showChat() {
    chatSection.style.display = '';
    view._chatVisible = true;
    saveChatState();
  }

  function addChatMessage(role, text) {
    const msgDiv = chatMessages.createDiv({ cls: `novel-ai-chat-msg novel-ai-chat-msg-${role}` });
    msgDiv.textContent = text;

    if (role === 'ai' && text) {
      const actions = chatMessages.createDiv({ cls: 'novel-ai-chat-msg-actions' });
      const copyBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '📋 复制' });
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = '✅ 已复制';
          setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 1500);
        } catch (e) {}
      });

      const applyBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm novel-ai-btn-primary', text: '✅ 应用到结果' });
      applyBtn.addEventListener('click', () => {
        addResult('chat', text);
        applyBtn.textContent = '✅ 已应用';
        applyBtn.disabled = true;
      });
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
    saveChatState();
  }

  chatSendBtn.addEventListener('click', async () => {
    const userMsg = chatInput.value.trim();
    if (!userMsg || !view.plugin.settings.apiKey) return;

    chatInput.value = '';
    addChatMessage('user', userMsg);
    conversationHistory.push({ role: 'user', content: userMsg });

    chatSendBtn.disabled = true;
    view.markTabBusy('generate', true);

    const thinkingEl = chatMessages.createDiv({ cls: 'novel-ai-chat-msg novel-ai-chat-msg-ai novel-ai-chat-thinking' });
    thinkingEl.createSpan({ cls: 'novel-ai-thinking-dots', text: '●●●' });
    thinkingEl.appendText(' AI正在思考中...');
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const currentResult = view.currentDisplayIndex >= 0 ? view.generatedResults[view.currentDisplayIndex] : null;
    const baseContent = currentResult ? currentResult.content : '';

    const systemMsg = {
      role: 'system',
      content: `${view.plugin.aiManager.prompts.writing.chat}\n\n当前内容：\n${baseContent}`
    };

    const messages = [systemMsg, ...trimHistory(conversationHistory, view.plugin.settings.chatMaxRounds)];

    let aiMsgEl = null;
    let partialContent = '';

    try {
      currentStream = view.plugin.aiManager.writingStream(
        messages,
        (chunk, fullText) => {
          partialContent = fullText;
          if (!aiMsgEl) {
            thinkingEl.remove();
            aiMsgEl = chatMessages.createDiv({ cls: 'novel-ai-chat-msg novel-ai-chat-msg-ai' });
          }
          aiMsgEl.textContent = fullText;
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      );

      const result = await currentStream;
      currentStream = null;
      view.markTabBusy('generate', false);
      chatSendBtn.disabled = false;

      if (result.aborted && partialContent) {
        if (thinkingEl.parentNode) thinkingEl.remove();
        if (!aiMsgEl) {
          aiMsgEl = chatMessages.createDiv({ cls: 'novel-ai-chat-msg novel-ai-chat-msg-ai' });
        }
        aiMsgEl.textContent = partialContent + '\n\n[已停止]';
        conversationHistory.push({ role: 'assistant', content: partialContent });
        addResult('chat', partialContent);
      } else if (!result.aborted) {
        if (thinkingEl.parentNode) thinkingEl.remove();
        conversationHistory.push({ role: 'assistant', content: result.content });
        addResult('chat', result.content);
      }
    } catch (err) {
      currentStream = null;
      view.markTabBusy('generate', false);
      chatSendBtn.disabled = false;

      if (thinkingEl.parentNode) thinkingEl.remove();

      if (partialContent) {
        if (!aiMsgEl) {
          aiMsgEl = chatMessages.createDiv({ cls: 'novel-ai-chat-msg novel-ai-chat-msg-ai' });
        }
        aiMsgEl.textContent = partialContent + '\n\n[已停止，内容可能不完整]';
        conversationHistory.push({ role: 'assistant', content: partialContent });
        addResult('chat', partialContent);
      } else {
        addChatMessage('ai', `错误: ${err.message}`);
      }
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatSendBtn.click();
    }
  });

  genBtn.addEventListener('click', async () => {
    const num = parseInt(numInput.value);
    const outline = outlineArea.value;

    if (!num || num < 1) { preview.empty(); preview.createDiv({ cls: 'novel-ai-error', text: '请填写有效的章节编号（大于0）' }); return; }
    if (!outline.trim()) { preview.empty(); preview.createDiv({ cls: 'novel-ai-error', text: '请填写章节大纲' }); return; }
    if (!view.plugin.settings.apiKey) { preview.empty(); preview.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' }); return; }

    view.generatedOutline = outline;
    view.generatedChapterNumber = num;

    const ctx = await view.plugin.novelService.collectContext(view.currentProject, num, view.plugin.settings.writingContextChars);
    const result = await streamAI(
      'writing',
      [
        { role: 'system', content: view.plugin.aiManager.buildWritingSystemPrompt(view.currentProject, ctx, view.plugin.settings) },
        { role: 'user', content: `生成第${num}章：\n${outline}` }
      ],
      '生成章节'
    );

    if (result) {
      if (view.plugin.settings.autoReviewAfterGenerate) {
        new obsidian.Notice('章节生成完成，正在自动审查...');
        view.reviewChapterNumber = num;
        setTimeout(() => {
          view.switchTab('review');
          view.runAutoReview(result.content, num);
        }, 500);
      }
    }
  });

  bsBtn.addEventListener('click', async () => {
    const num = parseInt(numInput.value) || 1;
    if (!view.plugin.settings.apiKey) { preview.empty(); preview.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' }); return; }

    view.generatedOutline = outlineArea.value;
    const ctx = await view.plugin.novelService.collectContext(view.currentProject, num, view.plugin.settings.outlineContextChars);
    const result = await streamAI(
      'outline',
      [
        { role: 'system', content: view.plugin.aiManager.prompts.outline.brainstorm },
        { role: 'user', content: `项目: ${view.currentProject}\n第${num}章\n${ctx}` }
      ],
      '头脑风暴'
    );
    if (result) showChat();
  });

  function getSelectedText() {
    const sel = window.getSelection();
    return sel ? sel.toString().trim() : '';
  }

  async function runEditMode(mode, num) {
    if (!view.plugin.settings.apiKey) { preview.empty(); preview.createDiv({ cls: 'novel-ai-error', text: '请先配置API Key' }); return; }

    const selected = getSelectedText();
    const currentResult = view.currentDisplayIndex >= 0 ? view.generatedResults[view.currentDisplayIndex] : null;
    const existingContent = currentResult ? currentResult.content : await view.plugin.novelService.getChapterContent(view.currentProject, num);

    const modeConfig = {
      continue: {
        label: '续写',
        system: view.plugin.aiManager.prompts.writing.continue,
        user: selected
          ? `基于以下内容续写：\n\n${existingContent ? existingContent.substring(existingContent.length - 500) : ''}\n\n请从"${selected}"之后继续写：`
          : `基于以下章节内容续写下一段：\n\n${existingContent || '（暂无内容）'}`
      },
      rewrite: {
        label: '改写',
        system: view.plugin.aiManager.prompts.writing.rewrite,
        user: selected
          ? `请改写以下文本：\n\n${selected}\n\n上下文：\n${existingContent ? existingContent.substring(0, 300) : ''}`
          : `请改写以下章节（全文改写）：\n\n${existingContent || '（暂无内容）'}`
      },
      expand: {
        label: '扩写',
        system: view.plugin.aiManager.prompts.writing.expand,
        user: selected
          ? `请扩写以下文本，增加更多细节：\n\n${selected}\n\n上下文：\n${existingContent ? existingContent.substring(0, 300) : ''}`
          : `请扩写以下章节，增加更多细节描写：\n\n${existingContent || '（暂无内容）'}`
      }
    };

    const config = modeConfig[mode];
    if (!config) return;

    if (mode !== 'continue' && !selected && !existingContent) {
      preview.empty();
      preview.createDiv({ cls: 'novel-ai-error', text: `请先选中要${config.label}的文字，或确保已有章节内容` });
      return;
    }

    const ctx = await view.plugin.novelService.collectContext(view.currentProject, num, view.plugin.settings.writingContextChars);
    const result = await streamAI(
      'writing',
      [
        { role: 'system', content: `${config.system}\n\n${view.plugin.aiManager.buildWritingSystemPrompt(view.currentProject, ctx, view.plugin.settings)}` },
        { role: 'user', content: config.user }
      ],
      config.label
    );
    if (result) showChat();
  }

  continueBtn.addEventListener('click', () => runEditMode('continue', parseInt(numInput.value) || 1));
  rewriteBtn.addEventListener('click', () => runEditMode('rewrite', parseInt(numInput.value) || 1));
  expandBtn.addEventListener('click', () => runEditMode('expand', parseInt(numInput.value) || 1));

  saveBtn.addEventListener('click', async () => {
    const chapterResults = view.generatedResults.filter(r => r.type === 'chapter' || r.type === 'chat');
    if (chapterResults.length === 0 || !view.generatedChapterNumber) return;

    const currentResult = view.currentDisplayIndex >= 0
      ? view.generatedResults[view.currentDisplayIndex]
      : chapterResults[chapterResults.length - 1];

    if (!currentResult || (currentResult.type !== 'chapter' && currentResult.type !== 'chat')) {
      preview.empty();
      preview.createDiv({ cls: 'novel-ai-error', text: '请先选择一个章节结果' });
      return;
    }

    try {
      const folder = view.plugin.novelService.getNovelPath('projects', view.currentProject, 'chapters');
      await view.plugin.novelService.createNoteFromTemplate('章节模板', folder, {
        project: view.currentProject,
        chapter_number: view.generatedChapterNumber,
        content_body: currentResult.content,
        created_date: window.moment().format('YYYY-MM-DD')
      });

      view.plugin.novelService.invalidateCache();
      preview.empty();
      preview.createDiv({ cls: 'novel-ai-success', text: `✅ 第${view.generatedChapterNumber}章已保存！` });
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.5';
      saveBtn.style.cursor = 'not-allowed';
    } catch (err) {
      logger.error('保存章节失败:', err);
      preview.empty();
      preview.createDiv({ cls: 'novel-ai-error', text: `保存失败: ${err.message}` });
    }
  });
}

module.exports = { render };
