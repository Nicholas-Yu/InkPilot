const logger = require('../utils/logger');
const { PROMPTS, getStyleInstruction } = require('../utils/promptTemplates');

class AIManager {
  constructor(plugin) {
    this.plugin = plugin;
    this._cache = new Map();
  }

  get settings() { return this.plugin.settings; }
  get aiClient() { return this.plugin.aiClient; }

  _getOptions(type) {
    const s = this.settings;
    if (type === 'writing') return { temperature: s.writingTemperature, maxTokens: s.writingMaxTokens };
    if (type === 'outline') return { temperature: s.outlineTemperature, maxTokens: s.outlineMaxTokens };
    if (type === 'review') return { temperature: s.reviewTemperature, maxTokens: s.reviewMaxTokens };
    return {};
  }

  _getModel(type) {
    const s = this.settings;
    if (type === 'writing') return s.writingModel;
    if (type === 'outline') return s.outlineModel;
    if (type === 'review') return s.reviewModel;
    return s.writingModel;
  }

  async _trackCost(result) {
    if (!this.settings.costTrackingEnabled || !result) return;
    this.settings.totalTokens += result.tokens || 0;
    this.settings.totalCost += result.cost || 0;
    await this.plugin.saveSettings();
  }

  _cacheKey(model, messages) {
    const content = messages.map(m => m.content).join('|');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
    }
    return `${model}_${hash}`;
  }

  async _cached(key, ttl, fn) {
    const cached = this._cache.get(key);
    if (cached && Date.now() - cached.time < ttl) {
      logger.log('AIManager 缓存命中:', key);
      return cached.data;
    }
    const result = await fn();
    this._cache.set(key, { data: result, time: Date.now() });
    return result;
  }

  invalidateCache() {
    this._cache.clear();
  }

  async writing(messages, options = {}) {
    const opts = { ...this._getOptions('writing'), ...options };
    const result = await this.aiClient.callAI(this._getModel('writing'), messages, opts);
    await this._trackCost(result);
    return result;
  }

  _streamWrapper(type, messages, onChunk, options) {
    const opts = { ...this._getOptions(type), ...options };
    const stream = this.aiClient.callAIStream(this._getModel(type), messages, onChunk, opts);
    const originalAbort = stream.abort;
    const self = this;
    const wrappedPromise = (async () => {
      const result = await stream;
      if (!result.aborted) await self._trackCost(result);
      return result;
    })();
    wrappedPromise.abort = originalAbort;
    return wrappedPromise;
  }

  writingStream(messages, onChunk, options = {}) {
    return this._streamWrapper('writing', messages, onChunk, options);
  }

  async writingForJSON(messages, options = {}) {
    const opts = { ...this._getOptions('writing'), ...options };
    const result = await this.aiClient.callAIForJSON(this._getModel('writing'), messages, opts);
    await this._trackCost(result);
    return result;
  }

  async outline(messages, options = {}) {
    const opts = { ...this._getOptions('outline'), ...options };
    const result = await this.aiClient.callAI(this._getModel('outline'), messages, opts);
    await this._trackCost(result);
    return result;
  }

  outlineStream(messages, onChunk, options = {}) {
    return this._streamWrapper('outline', messages, onChunk, options);
  }

  async outlineForJSON(messages, options = {}) {
    const opts = { ...this._getOptions('outline'), ...options };
    const key = this._cacheKey(this._getModel('outline'), messages);
    return this._cached(key, 120000, async () => {
      const result = await this.aiClient.callAIForJSON(this._getModel('outline'), messages, opts);
      await this._trackCost(result);
      return result;
    });
  }

  async review(messages, options = {}) {
    const opts = { ...this._getOptions('review'), ...options };
    const result = await this.aiClient.callAI(this._getModel('review'), messages, opts);
    await this._trackCost(result);
    return result;
  }

  async reviewForJSON(messages, options = {}) {
    const opts = { ...this._getOptions('review'), ...options };
    const key = this._cacheKey(this._getModel('review'), messages);
    return this._cached(key, 120000, async () => {
      const result = await this.aiClient.callAIForJSON(this._getModel('review'), messages, opts);
      await this._trackCost(result);
      return result;
    });
  }

  get prompts() { return PROMPTS; }

  buildWritingSystemPrompt(projectName, context, settings) {
    const style = getStyleInstruction(settings);
    return PROMPTS.writing.base(projectName, style) + `\n\n上下文:\n${context}`;
  }

  buildEditorPrompt(mode, contextInfo) {
    const promptMap = {
      rewrite: PROMPTS.writing.editorRewrite,
      expand: PROMPTS.writing.editorExpand,
      continue: PROMPTS.writing.editorContinue
    };
    return (promptMap[mode] || '') + contextInfo;
  }
}

module.exports = AIManager;
