const obsidian = require('obsidian');

class CreateProjectModal extends obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.projectName = '';
    this.genre = '玄幻';
  }

  onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl('h2', { text: '创建新小说项目' });

    new obsidian.Setting(contentEl)
      .setName('项目名称')
      .addText(t => {
        t.setPlaceholder('例如: 星辰大帝')
          .onChange(v => { this.projectName = v; });
      });

    new obsidian.Setting(contentEl)
      .setName('小说类型')
      .addDropdown(d => {
        d.addOption('玄幻', '玄幻')
          .addOption('都市', '都市')
          .addOption('科幻', '科幻')
          .addOption('悬疑', '悬疑')
          .addOption('言情', '言情')
          .addOption('历史', '历史')
          .addOption('武侠', '武侠')
          .addOption('其他', '其他')
          .setValue('玄幻')
          .onChange(v => { this.genre = v; });
      });

    new obsidian.Setting(contentEl)
      .addButton(b => {
        b.setButtonText('创建')
          .setCta()
          .onClick(async () => {
            if (!this.projectName.trim()) return;
            try {
              const file = await this.plugin.novelService.createNoteFromTemplate(
                '项目模板',
                this.plugin.novelService.getNovelPath('projects', this.projectName),
                {
                  title: this.projectName,
                  genre: this.genre,
                  created_date: window.moment().format('YYYY-MM-DD')
                }
              );
              this.plugin.novelService.invalidateCache();
              this.close();
              await new Promise(resolve => setTimeout(resolve, 300));
              this.plugin.refreshView();
              if (file) {
                this.app.workspace.openLinkText(file.path, '', false);
              }
            } catch (err) {
              new obsidian.Notice(`创建项目失败: ${err.message}`);
            }
          });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = CreateProjectModal;