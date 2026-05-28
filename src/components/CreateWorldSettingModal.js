const obsidian = require('obsidian');

class CreateWorldSettingModal extends obsidian.Modal {
  constructor(app, plugin, projectName) {
    super(app);
    this.plugin = plugin;
    this.projectName = projectName;
    this.settingName = '';
    this.category = 'power';
  }

  onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl('h2', { text: '添加世界观设定' });

    new obsidian.Setting(contentEl)
      .setName('设定名称')
      .addText(t => {
        t.setPlaceholder('例如: 修炼体系')
          .onChange(v => { this.settingName = v; });
      });

    new obsidian.Setting(contentEl)
      .setName('设定类别')
      .addDropdown(d => {
        d.addOption('power', '力量体系')
          .addOption('geography', '地理设定')
          .addOption('faction', '势力分布')
          .addOption('history', '历史背景')
          .addOption('rule', '世界规则')
          .addOption('culture', '文化习俗')
          .addOption('other', '其他')
          .setValue('power')
          .onChange(v => { this.category = v; });
      });

    new obsidian.Setting(contentEl)
      .addButton(b => {
        b.setButtonText('创建')
          .setCta()
          .onClick(async () => {
            if (!this.settingName.trim()) return;
            try {
              await this.plugin.novelService.createNoteFromTemplate(
                '世界观模板',
                this.plugin.novelService.getNovelPath('projects', this.projectName, 'worldsettings'),
                {
                  project: this.projectName,
                  name: this.settingName,
                  category: this.category,
                  created_date: window.moment().format('YYYY-MM-DD')
                }
              );
              this.plugin.novelService.invalidateCache();
              this.close();
              await new Promise(resolve => setTimeout(resolve, 300));
              this.plugin.refreshView();
            } catch (err) {
              new obsidian.Notice(`创建设定失败: ${err.message}`);
            }
          });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = CreateWorldSettingModal;
