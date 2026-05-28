function renderSuggestionCards(view, container, suggestions, applyFn) {
  let accepted = 0;
  const total = suggestions.length;

  const summary = container.createDiv({ cls: 'novel-ai-review-summary' });
  summary.createDiv({ cls: 'novel-ai-review-summary-text', text: `共 ${total} 条修改建议` });
  const acceptAllBtn = summary.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary', text: '✅ 全部接受' });

  acceptAllBtn.addEventListener('click', async () => {
    const pending = container.querySelectorAll('.novel-ai-suggestion-card[data-status="pending"]');
    for (const card of pending) {
      const idx = parseInt(card.getAttribute('data-index'));
      const s = suggestions[idx];
      try {
        await applyFn(s);
        card.setAttribute('data-status', 'accepted');
        card.querySelector('.novel-ai-suggestion-status').textContent = '✅ 已应用';
        card.querySelector('.novel-ai-suggestion-actions').style.display = 'none';
        accepted++;
      } catch (err) {
        card.setAttribute('data-status', 'failed');
        card.querySelector('.novel-ai-suggestion-status').textContent = `❌ ${err.message}`;
      }
    }
    summary.querySelector('.novel-ai-review-summary-text').textContent = `已应用 ${accepted}/${total} 条建议`;
    acceptAllBtn.disabled = true;
    acceptAllBtn.style.opacity = '0.5';
  });

  suggestions.forEach((s, idx) => {
    const card = container.createDiv({ cls: 'novel-ai-suggestion-card' });
    card.setAttribute('data-index', String(idx));
    card.setAttribute('data-status', 'pending');

    if (s.category) card.createDiv({ cls: 'novel-ai-suggestion-category', text: s.category });
    if (s.reason) card.createDiv({ cls: 'novel-ai-suggestion-reason', text: s.reason });

    const origGroup = card.createDiv({ cls: 'novel-ai-suggestion-block' });
    origGroup.createDiv({ cls: 'novel-ai-suggestion-label', text: '原文：' });
    origGroup.createDiv({ cls: 'novel-ai-suggestion-original', text: s.original });

    const replGroup = card.createDiv({ cls: 'novel-ai-suggestion-block' });
    replGroup.createDiv({ cls: 'novel-ai-suggestion-label', text: '建议修改为：' });
    replGroup.createDiv({ cls: 'novel-ai-suggestion-replacement', text: s.replacement });

    const footer = card.createDiv({ cls: 'novel-ai-suggestion-footer' });
    const statusEl = footer.createDiv({ cls: 'novel-ai-suggestion-status' });
    const actions = footer.createDiv({ cls: 'novel-ai-suggestion-actions' });

    const acceptBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-primary novel-ai-btn-sm', text: '✅ 接受' });
    const rejectBtn = actions.createEl('button', { cls: 'novel-ai-btn novel-ai-btn-sm', text: '❌ 忽略' });

    acceptBtn.addEventListener('click', async () => {
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
      statusEl.textContent = '⏳ 正在应用...';
      try {
        await applyFn(s);
        card.setAttribute('data-status', 'accepted');
        statusEl.textContent = '✅ 已应用';
        actions.style.display = 'none';
        accepted++;
        summary.querySelector('.novel-ai-review-summary-text').textContent = `已应用 ${accepted}/${total} 条建议`;
        if (accepted === total) {
          acceptAllBtn.disabled = true;
          acceptAllBtn.style.opacity = '0.5';
        }
      } catch (err) {
        card.setAttribute('data-status', 'failed');
        statusEl.textContent = `❌ ${err.message}`;
        acceptBtn.disabled = true;
      }
    });

    rejectBtn.addEventListener('click', () => {
      card.setAttribute('data-status', 'rejected');
      statusEl.textContent = '已忽略';
      actions.style.display = 'none';
      card.style.opacity = '0.5';
    });
  });
}

module.exports = { renderSuggestionCards };
