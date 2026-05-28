const obsidian = require('obsidian');

class CreateForeshadowingModal extends obsidian.Modal {
  constructor(app, plugin, projectName, chapterNumber = 1) {
    super(app);
    this.plugin = plugin;
    this.projectName = projectName;
    this.content = '';
    this.chapterNumber = chapterNumber;
    this.description = '';
  }

  onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl('h2', { text: '添加伏笔' });

    new obsidian.Setting(contentEl)
      .setName('伏笔内容')
      .addText(t => {
        t.setPlaceholder('例如: 主角捡到一枚神秘玉佩')
          .onChange(v => { this.content = v; });
      });

    new obsidian.Setting(contentEl)
      .setName('埋设章节')
      .addText(t => {
        t.setPlaceholder(String(this.chapterNumber))
          .onChange(v => { this.chapterNumber = parseInt(v) || this.chapterNumber; });
      });

    new obsidian.Setting(contentEl)
      .setName('详细描述')
      .addTextArea(t => {
        t.setPlaceholder('描述伏笔的背景和预期回收方式...')
          .onChange(v => { this.description = v; });
      });

    new obsidian.Setting(contentEl)
      .addButton(b => {
        b.setButtonText('添加')
          .setCta()
          .onClick(async () => {
            if (!this.content.trim()) return;
            try {
              await this.plugin.novelService.createNoteFromTemplate(
                '伏笔模板',
                this.plugin.novelService.getNovelPath('projects', this.projectName, 'foreshadowings'),
                {
                  project: this.projectName,
                  content: this.content,
                  planted_chapter: this.chapterNumber,
                  description: this.description,
                  status: 'active',
                  status_display: '🚩 未回收',
                  created_date: window.moment().format('YYYY-MM-DD')
                }
              );
              this.plugin.novelService.invalidateCache();
              this.close();
              await new Promise(resolve => setTimeout(resolve, 300));
              this.plugin.refreshView();
            } catch (err) {
              new obsidian.Notice(`添加伏笔失败: ${err.message}`);
            }
          });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = CreateForeshadowingModal;