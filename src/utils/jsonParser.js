const logger = require('./logger');

class JSONParser {
  static parseAIResponse(content) {
    if (!content || typeof content !== 'string') {
      return { success: false, error: '响应内容为空或格式无效', raw: content };
    }

    const strategies = [
      this.extractFromMarkdownCodeBlock,
      this.extractFromJSONOnly,
      this.extractFromMixedContent,
      this.extractFromPartialJSON
    ];

    for (const strategy of strategies) {
      const result = strategy(content);
      if (result.success) {
        return result;
      }
    }

    return { 
      success: false, 
      error: '无法解析为有效JSON', 
      raw: content,
      fallback: this.createFallbackJSON(content)
    };
  }

  static extractFromMarkdownCodeBlock(content) {
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/,
      /```\s*([\s\S]*?)\s*```/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1].trim());
          return { success: true, data: parsed, raw: content };
        } catch (e) {
          logger.log('Markdown代码块JSON解析失败，尝试下一个策略');
        }
      }
    }
    return { success: false };
  }

  static extractFromJSONOnly(content) {
    const trimmed = content.trim();
    if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const parsed = JSON.parse(trimmed);
        return { success: true, data: parsed, raw: content };
      } catch (e) {
        logger.log('直接JSON解析失败，尝试下一个策略');
      }
    }
    return { success: false };
  }

  static extractFromMixedContent(content) {
    const patterns = [
      /\{[\s\S]*"suggestions"[\s\S]*\}/,
      /\{[\s\S]*"content"[\s\S]*\}/,
      /\{[\s\S]*"result"[\s\S]*\}/,
      /\{[\s\S]*"title"[\s\S]*\}/,
      /\{[\s\S]*"text"[\s\S]*\}/,
      /\[([\s\S]*)\]/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return { success: true, data: parsed, raw: content };
        } catch (e) {
          logger.log('混合内容JSON解析失败，继续尝试');
        }
      }
    }
    return { success: false };
  }

  static extractFromPartialJSON(content) {
    const pairs = [
      { open: '{', close: '}' },
      { open: '[', close: ']' }
    ];

    for (const { open, close } of pairs) {
      let depth = 0;
      let startIdx = -1;
      let endIdx = -1;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < content.length; i++) {
        const ch = content[i];

        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === open) {
          if (depth === 0) startIdx = i;
          depth++;
        } else if (ch === close) {
          depth--;
          if (depth === 0 && startIdx !== -1) {
            endIdx = i + 1;
            break;
          }
        }
      }

      if (startIdx !== -1 && endIdx !== -1) {
        try {
          const jsonStr = content.slice(startIdx, endIdx);
          const parsed = JSON.parse(jsonStr);
          return { success: true, data: parsed, raw: content };
        } catch (e) {
          continue;
        }
      }
    }
    return { success: false };
  }

  static createFallbackJSON(content) {
    return {
      success: false,
      raw: content,
      text: content,
      suggestions: [],
      timestamp: Date.now()
    };
  }

  static ensureSuggestions(data, raw) {
    if (!data || typeof data !== 'object') {
      return { suggestions: [], raw };
    }

    if (data.suggestions && Array.isArray(data.suggestions)) {
      return { suggestions: data.suggestions, raw };
    }

    if (Array.isArray(data)) {
      return { suggestions: data, raw };
    }

    if (data.items && Array.isArray(data.items)) {
      return { suggestions: data.items, raw };
    }

    if (data.result && Array.isArray(data.result)) {
      return { suggestions: data.result, raw };
    }

    const fallbackSuggestion = {
      category: '通用',
      original: '',
      replacement: data.content || data.text || raw,
      reason: 'AI返回内容无法结构化解析，已保留原始文本'
    };
    return { suggestions: [fallbackSuggestion], raw };
  }

  static safeParse(content, fallback = null) {
    const result = this.parseAIResponse(content);
    return result.success ? result.data : fallback;
  }
}

module.exports = JSONParser;

