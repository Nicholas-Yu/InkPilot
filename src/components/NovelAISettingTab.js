const obsidian = require('obsidian');
const logger = require('../utils/logger');

class NovelAISettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this._testResultBox = null;
    this._expandedModel = null;
  }

  display() {
    const el = this.containerEl;
    const p = this.plugin;
    const self = this;
    el.empty();
    el.createEl('h2', { text: 'Novel AI Writing Assistant 设置' });

    new obsidian.Setting(el)
      .setName('API 提供商')
      .setDesc('选择AI API提供商')
      .addDropdown(d => {
        d.addOption('openai', 'OpenAI')
          .addOption('anthropic', 'Anthropic')
          .addOption('custom', '自定义')
          .setValue(p.settings.apiProvider)
          .onChange(async v => {
            p.settings.apiProvider = v;
            await p.saveSettings();
            self.display();
          });
      });

    const apiKeySetting = new obsidian.Setting(el)
      .setName('API Key')
      .setDesc('输入API Key（加密显示）')
      .addText(t => {
        t.setPlaceholder('sk-...')
          .setValue(p.settings.apiKey)
          .onChange(async v => {
            p.settings.apiKey = v;
            await p.saveSettings();
          });
        t.inputEl.type = 'password';
        t.inputEl.addClass('novel-ai-api-key-input');
      });

    const apiKeyInput = apiKeySetting.controlEl.querySelector('.novel-ai-api-key-input');
    if (apiKeyInput) {
      const toggleBtn = apiKeySetting.controlEl.createEl('button', { cls: 'novel-ai-toggle-vis-btn', text: '👁' });
      toggleBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
          apiKeyInput.type = 'text';
          toggleBtn.textContent = '🔒';
        } else {
          apiKeyInput.type = 'password';
          toggleBtn.textContent = '👁';
        }
      });
    }

    if (p.settings.apiProvider === 'custom') {
      new obsidian.Setting(el)
        .setName('自定义 API Base URL')
        .addText(t => {
          t.setPlaceholder('https://api.example.com/v1')
            .setValue(p.settings.customApiBase)
            .onChange(async v => {
              p.settings.customApiBase = v;
              await p.saveSettings();
            });
        });
    }

    self.renderModelSetting(el, 'outline', '大纲模型', '用于头脑风暴、大纲生成、世界观生成', 'gpt-4o-mini', {
      maxTokens: { key: 'outlineMaxTokens', default: 4096, desc: '最大输出 Token 数' },
      temperature: { key: 'outlineTemperature', default: 0.9, desc: '温度（0.9-1.0 推荐，越高越有想象力）' },
      contextChars: { key: 'outlineContextChars', default: 8000, desc: '上下文最大字符数' }
    });

    self.renderModelSetting(el, 'writing', '写作模型', '用于章节生成、续写、改写、扩写', 'gpt-4o', {
      maxTokens: { key: 'writingMaxTokens', default: 4096, desc: '最大输出 Token 数' },
      temperature: { key: 'writingTemperature', default: 0.85, desc: '温度（0.8-0.95 推荐，越高越有创意）' },
      contextChars: { key: 'writingContextChars', default: 8000, desc: '上下文最大字符数' }
    });

    self.renderModelSetting(el, 'review', '审查模型', '用于一致性审查、AI味检测、AI优化建议', 'gpt-4o-mini', {
      maxTokens: { key: 'reviewMaxTokens', default: 4096, desc: '最大输出 Token 数' },
      temperature: { key: 'reviewTemperature', default: 0.3, desc: '温度（0.2-0.4 推荐，越低越严谨）' },
      contextChars: { key: 'reviewContextChars', default: 8000, desc: '上下文最大字符数' }
    });

    el.createEl('h3', { text: '写作风格' });

    const { STYLES } = require('../utils/promptTemplates');

    new obsidian.Setting(el)
      .setName('文风预设')
      .setDesc('选择写作风格，影响AI生成的文字风格')
      .addDropdown(d => {
        Object.entries(STYLES).forEach(([key, val]) => {
          d.addOption(key, `${val.label} - ${val.desc}`);
        });
        d.setValue(p.settings.writingStyle)
          .onChange(async v => {
            p.settings.writingStyle = v;
            await p.saveSettings();
            self.display();
          });
      });

    if (p.settings.writingStyle === 'custom') {
      new obsidian.Setting(el)
        .setName('自定义风格描述')
        .setDesc('描述你想要的写作风格')
        .addTextArea(t => {
          t.setPlaceholder('例如：古风仙侠，语言飘逸出尘，多用四字句，注重意境营造...')
            .setValue(p.settings.customStyleDesc)
            .onChange(async v => {
              p.settings.customStyleDesc = v;
              await p.saveSettings();
            });
          t.inputEl.rows = 3;
          t.inputEl.style.width = '100%';
        });
    }

    el.createEl('h3', { text: '通用设置' });

    new obsidian.Setting(el)
      .setName('对话最大轮数')
      .setDesc('生成模块对话框保留的最大对话轮数，超出后自动截断早期对话以节省 Token')
      .addText(t => {
        t.setPlaceholder('5')
          .setValue(String(p.settings.chatMaxRounds))
          .onChange(async v => {
            const num = parseInt(v);
            if (num > 0) {
              p.settings.chatMaxRounds = num;
              await p.saveSettings();
            }
          });
      });

    new obsidian.Setting(el)
      .setName('生成后自动审查')
      .setDesc('章节生成完成后自动触发一致性审查')
      .addToggle(t => {
        t.setValue(p.settings.autoReviewAfterGenerate)
          .onChange(async v => {
            p.settings.autoReviewAfterGenerate = v;
            await p.saveSettings();
          });
      });

    new obsidian.Setting(el)
      .setName('小说文件夹')
      .setDesc('存放小说项目的文件夹路径，默认: novel')
      .addText(t => {
        t.setPlaceholder('novel')
          .setValue(p.settings.novelFolderPath)
          .onChange(async v => {
            p.settings.novelFolderPath = v;
            await p.saveSettings();
            p.novelService.invalidateCache();
          });
      });

    new obsidian.Setting(el)
      .setName('成本追踪')
      .addToggle(t => {
        t.setValue(p.settings.costTrackingEnabled)
          .onChange(async v => {
            p.settings.costTrackingEnabled = v;
            await p.saveSettings();
            self.display();
          });
      });

    if (p.settings.costTrackingEnabled) {
      el.createDiv({ cls: 'novel-ai-cost-display' })
        .appendText(`Token: ${p.settings.totalTokens.toLocaleString()} | 成本: $${p.settings.totalCost.toFixed(4)}`);
      new obsidian.Setting(el)
        .setName('重置成本统计')
        .addButton(b => {
          b.setButtonText('重置')
            .onClick(async () => {
              p.settings.totalCost = 0;
              p.settings.totalTokens = 0;
              await p.saveSettings();
              self.display();
            });
        });

      el.createEl('h3', { text: '模型费率配置' });
      el.createDiv({ cls: 'setting-item-description', text: '设置各模型的费率（美元/百万Token），用于成本估算。未列出的模型将使用默认费率。' });

      const configuredModels = [
        { key: p.settings.outlineModel, label: '大纲模型' },
        { key: p.settings.writingModel, label: '写作模型' },
        { key: p.settings.reviewModel, label: '审查模型' }
      ];

      const seen = new Set();
      for (const { key, label } of configuredModels) {
        if (!key || seen.has(key)) continue;
        seen.add(key);
        self.renderRateSetting(el, key, `${label} (${key})`);
      }

      self.renderRateSetting(el, '_default', '未列出模型的默认费率');

      new obsidian.Setting(el)
        .setName('添加自定义模型费率')
        .setDesc('为其他模型添加费率配置')
        .addText(t => {
          t.setPlaceholder('模型名称，如 gpt-4o')
            .setValue(self._newRateModel || '')
            .onChange(v => { self._newRateModel = v; });
        })
        .addText(t => {
          t.setPlaceholder('费率 $/M Token')
            .setValue(self._newRateValue || '')
            .onChange(v => { self._newRateValue = v; });
        })
        .addButton(b => {
          b.setButtonText('添加')
            .onClick(async () => {
              const model = (self._newRateModel || '').trim();
              const rate = parseFloat(self._newRateValue || '');
              if (!model || isNaN(rate) || rate < 0) return;
              p.settings.costRates[model] = rate;
              await p.saveSettings();
              self._newRateModel = '';
              self._newRateValue = '';
              self.display();
            });
        });
    }

    const testSection = el.createDiv({ cls: 'novel-ai-test-result-section' });
    testSection.createEl('h3', { text: '联通测试结果' });
    const testBox = testSection.createEl('textarea', { cls: 'novel-ai-test-result-box' });
    testBox.setAttribute('readonly', 'true');
    testBox.setAttribute('rows', '4');
    testBox.setAttribute('placeholder', '点击「测试」按钮查看结果...');
    testBox.style.width = '100%';
    testBox.style.minHeight = '80px';
    testBox.style.fontFamily = 'monospace';
    testBox.style.fontSize = '13px';
    testBox.style.resize = 'vertical';
    self._testResultBox = testBox;
  }

  renderModelSetting(el, modelId, name, desc, placeholder, advanced) {
    const p = this.plugin;
    const self = this;

    const setting = new obsidian.Setting(el)
      .setName(name)
      .setDesc(desc);

    setting.addText(t => {
      t.setPlaceholder(placeholder)
        .setValue(p.settings[`${modelId}Model`])
        .onChange(async v => {
          p.settings[`${modelId}Model`] = v;
          await p.saveSettings();
        });
    });

    setting.addButton(b => {
      b.setButtonText('测试')
        .onClick(() => {
          self.testModelConnection(p.settings[`${modelId}Model`]);
        });
    });

    setting.addButton(b => {
      const isExpanded = self._expandedModel === modelId;
      b.setButtonText(isExpanded ? '收起设置 ▲' : '高级设置 ▼')
        .setTooltip('展开/收起模型高级参数')
        .onClick(() => {
          self._expandedModel = self._expandedModel === modelId ? null : modelId;
          self.display();
        });
    });

    if (self._expandedModel === modelId) {
      const advDiv = el.createDiv({ cls: 'novel-ai-model-advanced' });

      const summaryParts = [];
      summaryParts.push(`输出: ${p.settings[advanced.maxTokens.key]}`);
      summaryParts.push(`温度: ${p.settings[advanced.temperature.key]}`);
      summaryParts.push(`上下文: ${p.settings[advanced.contextChars.key]}字符`);
      advDiv.createDiv({ cls: 'novel-ai-model-advanced-summary', text: `当前配置: ${summaryParts.join(' | ')}` });

      new obsidian.Setting(advDiv)
        .setName(advanced.maxTokens.desc)
        .setDesc('AI 单次回复的最大 token 数，大上下文模型可调高')
        .addText(t => {
          t.setPlaceholder(String(advanced.maxTokens.default))
            .setValue(String(p.settings[advanced.maxTokens.key]))
            .onChange(async v => {
              const num = parseInt(v);
              if (num > 0) {
                p.settings[advanced.maxTokens.key] = num;
                await p.saveSettings();
              }
            });
        });

      new obsidian.Setting(advDiv)
        .setName(advanced.temperature.desc)
        .setDesc('控制输出的随机性，范围 0-2')
        .addText(t => {
          t.setPlaceholder(String(advanced.temperature.default))
            .setValue(String(p.settings[advanced.temperature.key]))
            .onChange(async v => {
              const num = parseFloat(v);
              if (num >= 0 && num <= 2) {
                p.settings[advanced.temperature.key] = num;
                await p.saveSettings();
              }
            });
        });

      new obsidian.Setting(advDiv)
        .setName(advanced.contextChars.desc)
        .setDesc('生成时收集的上下文信息最大字符数，越大信息越丰富但 Token 消耗越多')
        .addText(t => {
          t.setPlaceholder(String(advanced.contextChars.default))
            .setValue(String(p.settings[advanced.contextChars.key]))
            .onChange(async v => {
              const num = parseInt(v);
              if (num > 0) {
                p.settings[advanced.contextChars.key] = num;
                await p.saveSettings();
              }
            });
        });
    }
  }

  renderRateSetting(el, modelKey, label) {
    const p = this.plugin;
    const currentRate = p.settings.costRates[modelKey] ?? p.settings.costRates['_default'] ?? 2;

    const setting = new obsidian.Setting(el)
      .setName(label)
      .setDesc(`当前: $${currentRate}/百万Token`);

    setting.addText(t => {
      t.setPlaceholder(String(currentRate))
        .setValue(String(currentRate))
        .onChange(async v => {
          const num = parseFloat(v);
          if (!isNaN(num) && num >= 0) {
            p.settings.costRates[modelKey] = num;
            await p.saveSettings();
          }
        });
    });

    if (modelKey !== '_default') {
      setting.addButton(b => {
        b.setButtonText('🗑')
          .setTooltip('删除此模型费率（将使用默认费率）')
          .onClick(async () => {
            delete p.settings.costRates[modelKey];
            await p.saveSettings();
            this.display();
          });
      });
    }
  }

  async testModelConnection(model) {
    const box = this._testResultBox;
    if (!box) return;
    const p = this.plugin;
    
    if (!p.settings.apiKey) {
      box.value = '❌ 请先填写 API Key';
      return;
    }

    let testUrl = '';
    if (p.settings.apiProvider === 'custom') {
      let base = (p.settings.customApiBase || '').replace(/\/+$/, '');
      testUrl = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    } else if (p.settings.apiProvider === 'openai') {
      testUrl = 'https://api.openai.com/v1/chat/completions';
    } else if (p.settings.apiProvider === 'anthropic') {
      testUrl = 'https://api.anthropic.com/v1/messages';
    }

    box.value = `⏳ 测试 ${model}...\n请求地址: ${testUrl}`;
    
    try {
      const result = await p.aiClient.testConnection(model);
      if (result.success) {
        box.value = `✅ 联通成功!\n模型: ${model}\n地址: ${testUrl}\n回复: ${result.content}\nToken: ${result.tokens}\n成本: $${result.cost.toFixed(6)}`;
      } else {
        box.value = `❌ 联通失败!\n模型: ${model}\n地址: ${testUrl}\n错误: ${result.error}\n\n请检查:\n1. API Base URL 是否正确\n2. API Key 是否有效\n3. 模型名称是否支持\n4. 网络是否通畅`;
      }
    } catch (error) {
      logger.error('测试连接失败:', error);
      box.value = `❌ 测试异常!\n模型: ${model}\n地址: ${testUrl}\n错误: ${error.message}`;
    }
  }
}

module.exports = NovelAISettingTab;
