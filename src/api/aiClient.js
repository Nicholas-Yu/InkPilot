const obsidian = require('obsidian');
const logger = require('../utils/logger');
const { formatCost } = require('../utils/helpers');
const JSONParser = require('../utils/jsonParser');

class AIClient {
  constructor(settings) {
    this.settings = settings;
    this.timeout = 60000;
  }

  async callAI(model, messages, options = {}) {
    const { apiProvider } = this.settings;
    const { url, headers, body } = this.buildRequestConfig(model, messages, options);

    logger.log(`请求: ${url}, 模型: ${model}`);

    let response;
    try {
      response = await obsidian.requestUrl({
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        throw: false
      });
    } catch (error) {
      logger.error('网络请求异常:', error.message);
      throw new Error(`网络请求失败: ${error.message}`);
    }

    if (response.status < 200 || response.status >= 300) {
      let errorDetail = '';
      try {
        const errData = response.json;
        errorDetail = errData.error?.message || errData.message || JSON.stringify(errData);
      } catch {
        errorDetail = response.text || `HTTP ${response.status}`;
      }
      logger.error(`API返回错误 [${response.status}]: ${errorDetail}`);
      throw new Error(`[${response.status}] ${errorDetail}`);
    }

    const data = response.json;
    let content = '', tokens = 0;

    if (apiProvider === 'openai' || apiProvider === 'custom') {
      if (!data.choices || !data.choices[0]) {
        throw new Error(`响应格式异常: ${JSON.stringify(data).substring(0, 200)}`);
      }
      content = data.choices[0].message.content;
      tokens = data.usage ? data.usage.total_tokens : 0;
    } else if (apiProvider === 'anthropic') {
      if (!data.content || !data.content[0]) {
        throw new Error(`响应格式异常: ${JSON.stringify(data).substring(0, 200)}`);
      }
      content = data.content[0].text;
      tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    }

    const cost = formatCost(tokens, model, this.settings);
    logger.log(`AI调用成功: ${model}, tokens: ${tokens}, cost: $${cost.toFixed(4)}`);

    return { content, tokens, cost };
  }

  async testConnection(model) {
    try {
      const result = await this.callAI(model, [{ role: 'user', content: '你好' }]);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async callAIForJSON(model, messages, options = {}) {
    const result = await this.callAI(model, messages, options);
    const parsed = JSONParser.parseAIResponse(result.content);
    
    return {
      ...result,
      json: parsed.success ? parsed.data : null,
      raw: result.content,
      parsed: parsed
    };
  }

  buildRequestConfig(model, messages, options = {}, stream = false) {
    const { apiProvider, apiKey, customApiBase } = this.settings;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 4096;

    if (!apiKey) throw new Error('请先配置API Key');

    let url, headers, body;

    if (apiProvider === 'openai' || apiProvider === 'custom') {
      let base = apiProvider === 'custom' ? customApiBase : 'https://api.openai.com/v1';
      base = base.replace(/\/+$/, '');
      url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
      body = { model, messages, max_tokens: maxTokens, temperature };
      if (stream) {
        body.stream = true;
        body.stream_options = { include_usage: true };
      }
    } else if (apiProvider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      };
      const sys = messages.find(m => m.role === 'system');
      const usr = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
      body = { model, max_tokens: maxTokens, temperature, system: sys ? sys.content : '', messages: usr };
      if (stream) body.stream = true;
    } else {
      throw new Error(`不支持的API提供商: ${apiProvider}`);
    }

    return { url, headers, body };
  }

  callAIStream(model, messages, onChunk, options = {}) {
    const { apiProvider } = this.settings;
    const settings = this.settings;
    const { url, headers, body } = this.buildRequestConfig(model, messages, options, true);
    const controller = new AbortController();

    logger.log(`流式请求: ${url}, 模型: ${model}`);

    const promise = (async () => {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (error) {
        if (error.name === 'AbortError') return { content: '', tokens: 0, cost: 0, aborted: true };
        throw new Error(`网络请求失败: ${error.message}`);
      }

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errData = await response.json();
          errorDetail = errData.error?.message || errData.message || JSON.stringify(errData);
        } catch {
          errorDetail = await response.text().catch(() => `HTTP ${response.status}`);
        }
        throw new Error(`[${response.status}] ${errorDetail}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let usageTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (apiProvider === 'openai' || apiProvider === 'custom') {
                if (parsed.usage) {
                  usageTokens = parsed.usage.total_tokens || 0;
                }
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  onChunk(delta, fullContent);
                }
              } else if (apiProvider === 'anthropic') {
                if (parsed.type === 'message_start' && parsed.message?.usage) {
                  usageTokens = (parsed.message.usage.input_tokens || 0);
                }
                if (parsed.type === 'message_delta' && parsed.usage) {
                  usageTokens += (parsed.usage.output_tokens || 0);
                }
                if (parsed.type === 'content_block_delta') {
                  const delta = parsed.delta?.text;
                  if (delta) {
                    fullContent += delta;
                    onChunk(delta, fullContent);
                  }
                }
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (readError) {
        if (readError.name === 'AbortError' || controller.signal.aborted) {
          try { reader.cancel(); } catch {}
          const tokens = usageTokens || Math.ceil(fullContent.length / 2);
          const cost = formatCost(tokens, model, settings);
          logger.log(`流式AI调用已中止: ${model}, 已接收内容: ${fullContent.length}字符`);
          return { content: fullContent, tokens, cost, aborted: true };
        }
        throw readError;
      }

      const tokens = usageTokens || Math.ceil(fullContent.length / 2);
      const cost = formatCost(tokens, model, settings);
      logger.log(`流式AI调用成功: ${model}, tokens: ${tokens}${usageTokens ? '' : '(估算)'}`);

      return { content: fullContent, tokens, cost, aborted: false };
    })();

    promise.abort = () => controller.abort();
    return promise;
  }
}

module.exports = AIClient;