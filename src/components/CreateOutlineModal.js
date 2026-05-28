const obsidian = require('obsidian');

class CreateOutlineModal extends obsidian.Modal {
  constructor(app, plugin, projectName) {
    super(app);
    this.plugin = plugin;
    this.projectName = projectName;
    this.chapterNumber = 1;
    this.title = '';
    this.content = '';
  }

  onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.createEl('h2', { text: '创建章节大纲' });

    new obsidian.Setting(contentEl)
      .setName('章节编号')
      .addText(t => {
        t.setPlaceholder('1')
          .setValue('1')
          .onChange(v => { this.chapterNumber = parseInt(v) || 1; });
      });

    new obsidian.Setting(contentEl)
      .setName('章节标题')
      .addText(t => {
        t.setPlaceholder('例如: 初入江湖')
          .onChange(v => { this.title = v; });
      });

    new obsidian.Setting(contentEl)
      .setName('大纲内容')
      .addTextArea(t => {
        t.setPlaceholder('描述本章的主要剧情走向...')
          .onChange(v => { this.content = v; });
        t.inputEl.rows = 5;
        t.inputEl.style.width = '100%';
      });

    new obsidian.Setting(contentEl)
      .addButton(b => {
        b.setButtonText('创建')
          .setCta()
          .onClick(async () => {
            if (!this.title.trim()) {
              this.title = `第${this.chapterNumber}章`;
            }
            try {
              await this.plugin.novelService.createNoteFromTemplate(
                '大纲模板',
                this.plugin.novelService.getNovelPath('projects', this.projectName, 'outlines'),
                {
                  project: this.projectName,
                  chapter_number: this.chapterNumber,
                  title: this.title,
                  content: this.content,
                  status: 'draft',
                  created_date: window.moment().format('YYYY-MM-DD')
                }
              );
              this.plugin.novelService.invalidateCache();
              this.close();
              await new Promise(resolve => setTimeout(resolve, 300));
              this.plugin.refreshView();
            } catch (err) {
              new obsidian.Notice(`创建大纲失败: ${err.message}`);
            }
          });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = CreateOutlineModal;
