const obsidian = require('obsidian');

class CreateCharacterModal extends obsidian.Modal {
  constructor(app, plugin, projectName) {
    super(app);
    this.plugin = plugin;
    this.projectName = projectName;
    this.characterName = '';
    this.characterType = 'main';
  }

  onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl('h2', { text: '创建新角色' });

    new obsidian.Setting(contentEl)
      .setName('角色名称')
      .addText(t => {
        t.setPlaceholder('例如: 林夜')
          .onChange(v => { this.characterName = v; });
      });

    new obsidian.Setting(contentEl)
      .setName('角色类型')
      .addDropdown(d => {
        d.addOption('main', '主角')
          .addOption('support', '配角')
          .addOption('villain', '反派')
          .addOption('guest', '客串')
          .setValue('main')
          .onChange(v => { this.characterType = v; });
      });

    new obsidian.Setting(contentEl)
      .addButton(b => {
        b.setButtonText('创建')
          .setCta()
          .onClick(async () => {
            if (!this.characterName.trim()) return;
            try {
              await this.plugin.novelService.createNoteFromTemplate(
                '角色模板',
                this.plugin.novelService.getNovelPath('projects', this.projectName, 'characters'),
                {
                  project: this.projectName,
                  name: this.characterName,
                  role: this.characterType,
                  created_date: window.moment().format('YYYY-MM-DD')
                }
              );
              this.plugin.novelService.invalidateCache();
              this.close();
              await new Promise(resolve => setTimeout(resolve, 300));
              this.plugin.refreshView();
            } catch (err) {
              new obsidian.Notice(`创建角色失败: ${err.message}`);
            }
          });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = CreateCharacterModal;