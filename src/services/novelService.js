const logger = require('../utils/logger');
const Cache = require('../utils/cache');

class NovelService {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.cache = new Cache({ ttl: 60000 });
  }

  getNovelPath(...args) {
    return [this.settings.novelFolderPath, ...args].join('/');
  }

  async scanNotesByType(type, projectFilter = null) {
    const cacheKey = `scan_${type}_${projectFilter || 'all'}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const novelPath = this.settings.novelFolderPath;
    const files = this.app.vault.getMarkdownFiles();
    const results = [];

    for (const file of files) {
      if (!file.path.startsWith(novelPath)) continue;
      if (file.path.includes('/templates/')) continue;

      let frontmatter = {};
      try {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache && cache.frontmatter) {
          frontmatter = cache.frontmatter;
        }
      } catch (e) {
        continue;
      }

      if (frontmatter.type !== type) continue;

      if (projectFilter) {
        if (frontmatter.project !== projectFilter) {
          const parts = file.path.split('/');
          const idx = parts.indexOf('projects');
          if (idx >= 0 && parts[idx + 1] !== projectFilter) continue;
        }
      }

      results.push({
        path: file.path,
        basename: file.basename,
        frontmatter
      });
    }

    this.cache.set(cacheKey, results);
    return results;
  }

  async createNoteFromTemplate(templateName, folderPath, overrides = {}) {
    const templatePath = this.getNovelPath('templates', `${templateName}.md`);
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    
    if (!templateFile) {
      throw new Error(`找不到模板: ${templatePath}`);
    }

    let content = await this.app.vault.read(templateFile);
    const dateStr = overrides.created_date || window.moment().format('YYYY-MM-DD');

    content = content.replace(/\{\{date\}\}/g, dateStr);
    content = content.replace(/\{\{title\}\}/g, overrides.title || '');
    content = content.replace(/\{\{name\}\}/g, overrides.name || '');
    content = content.replace(/\{\{chapter_number\}\}/g, overrides.chapter_number || '');
    content = content.replace(/\{\{description\}\}/g, overrides.description || '');
    content = content.replace(/\{\{content_body\}\}/g, overrides.content_body || '');
    content = content.replace(/\{\{content\}\}/g, overrides.content || '');
    content = content.replace(/\{\{planted_chapter\}\}/g, overrides.planted_chapter || '');
    content = content.replace(/\{\{status_display\}\}/g, overrides.status_display || '');

    const handled = new Set(['created_date', 'title', 'name', 'chapter_number', 'description', 'content_body', 'content', 'planted_chapter', 'status_display']);
    for (const key in overrides) {
      if (handled.has(key)) continue;
      if (overrides[key] !== undefined && overrides[key] !== '') {
        const regex = new RegExp(`^${key}:\\s*(.*)$`, 'm');
        const val = typeof overrides[key] === 'object' 
          ? JSON.stringify(overrides[key]) 
          : overrides[key];
        content = content.replace(regex, `${key}: ${val}`);
      }
    }

    const fileName = overrides.title || overrides.name || (`第${overrides.chapter_number}章`);
    const filePath = `${folderPath}/${fileName}.md`;

    let existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!existingFolder) {
      try {
        await this.app.vault.createFolder(folderPath);
      } catch (e) {
        logger.warn('创建文件夹失败:', e.message);
      }
    }

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing) return existing;

    return await this.app.vault.create(filePath, content);
  }

  async getChapterFile(projectName, chapterNumber) {
    const title = `第${chapterNumber}章`;
    const folder = this.getNovelPath('projects', projectName, 'chapters');
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (!file.path.startsWith(folder)) continue;

      let fm = {};
      try {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache && cache.frontmatter) fm = cache.frontmatter;
      } catch (e) {
        continue;
      }

      if (fm.chapter_number === chapterNumber || file.basename === title) {
        return file;
      }
    }
    return null;
  }

  async getChapterContent(projectName, chapterNumber) {
    const file = await this.getChapterFile(projectName, chapterNumber);
    if (!file) return null;

    const txt = await this.app.vault.read(file);
    const body = txt.replace(/^---[\s\S]*?---\n/, '');
    const m = body.match(/## 正文\n([\s\S]*?)(?=## 章节复盘|$)/);
    if (m) return m[1].trim();
    return body;
  }

  async replaceInChapter(projectName, chapterNumber, original, replacement) {
    const file = await this.getChapterFile(projectName, chapterNumber);
    if (!file) throw new Error(`找不到第${chapterNumber}章`);

    const txt = await this.app.vault.read(file);
    if (!txt.includes(original)) throw new Error('原文在章节中未找到，可能已被修改');

    const updated = txt.replace(original, replacement);
    await this.app.vault.modify(file, updated);
    this.invalidateCache();
    return true;
  }

  async getFileByPath(projectName, type, name) {
    const items = await this.scanNotesByType(type, projectName);
    return items.find(i => (i.frontmatter.name || i.basename) === name) || null;
  }

  async updateFileBody(fileInfo, original, replacement) {
    const file = this.app.vault.getAbstractFileByPath(fileInfo.path);
    if (!file) throw new Error('文件不存在');

    const txt = await this.app.vault.read(file);
    if (!txt.includes(original)) throw new Error('原文在文件中未找到，可能已被修改');

    const updated = txt.replace(original, replacement);
    await this.app.vault.modify(file, updated);
    this.invalidateCache();
    return true;
  }

  async getFileContent(fileInfo) {
    const file = this.app.vault.getAbstractFileByPath(fileInfo.path);
    if (!file) return null;
    const txt = await this.app.vault.read(file);
    return txt.replace(/^---[\s\S]*?---\n/, '');
  }

  async collectContext(projectName, chapterNumber, maxCharsOverride) {
    const ctxCacheKey = `ctx_${projectName}_${chapterNumber}_${maxCharsOverride || 'default'}`;
    if (this.cache.has(ctxCacheKey)) {
      return this.cache.get(ctxCacheKey);
    }

    const maxChars = maxCharsOverride || this.settings.writingContextChars || 8000;
    const sections = [];
    let totalChars = 0;

    const chars = await this.scanNotesByType('novel-character', projectName);
    if (chars.length > 0) {
      let charSection = '\n=== 角色档案 ===\n';
      for (const c of chars) {
        const f = this.app.vault.getAbstractFileByPath(c.path);
        if (f) {
          const txt = await this.app.vault.read(f);
          const body = txt.replace(/^---[\s\S]*?---\n/, '');
          charSection += `\n【${c.frontmatter.name || c.basename}】\n${body.substring(0, 500)}\n`;
        }
      }
      sections.push({ priority: 1, text: charSection });
      totalChars += charSection.length;
    }

    const knowledgeSummary = await this.getKnowledgeSummaries(projectName, 1500);
    if (knowledgeSummary) {
      const kbSection = '\n=== 写作知识库 ===\n' + knowledgeSummary + '\n';
      sections.push({ priority: 2, text: kbSection });
      totalChars += kbSection.length;
    }

    const fsList = await this.scanNotesByType('novel-foreshadowing', projectName);
    const active = fsList.filter(f => f.frontmatter.status === 'active');
    if (active.length > 0) {
      let fsSection = '\n=== 未回收伏笔 ===\n';
      for (const f of active) {
        fsSection += `- ${f.frontmatter.content || f.basename}（第${f.frontmatter.planted_chapter || '?'}章）\n`;
      }
      sections.push({ priority: 3, text: fsSection });
      totalChars += fsSection.length;
    }

    const wsList = await this.scanNotesByType('novel-worldsetting', projectName);
    if (wsList.length > 0) {
      let wsSection = '\n=== 世界观 ===\n';
      for (const ws of wsList) {
        const wf = this.app.vault.getAbstractFileByPath(ws.path);
        if (wf) {
          const wtxt = await this.app.vault.read(wf);
          const wbody = wtxt.replace(/^---[\s\S]*?---\n/, '');
          wsSection += `\n【${ws.frontmatter.name || ws.basename}】\n${wbody.substring(0, 300)}\n`;
        }
      }
      sections.push({ priority: 4, text: wsSection });
      totalChars += wsSection.length;
    }

    const prevChapters = [];
    for (let k = Math.max(1, chapterNumber - 3); k < chapterNumber; k++) {
      const ch = await this.getChapterContent(projectName, k);
      if (ch) {
        prevChapters.push({ k, ch });
      }
    }
    if (prevChapters.length > 0) {
      let chSection = '\n=== 前文回顾 ===\n';
      for (const { k, ch } of prevChapters) {
        chSection += `\n第${k}章: ${ch.substring(0, 300)}...\n`;
      }
      sections.push({ priority: 5, text: chSection });
      totalChars += chSection.length;
    }

    sections.sort((a, b) => a.priority - b.priority);

    let context = '';
    let budget = maxChars;
    for (const section of sections) {
      if (section.text.length <= budget) {
        context += section.text;
        budget -= section.text.length;
      } else {
        context += section.text.substring(0, budget) + '\n...(内容已截断)';
        break;
      }
    }

    this.cache.set(ctxCacheKey, context);
    return context;
  }

  invalidateCache() {
    this.cache.clear();
  }

  async saveGenerateHistory(projectName, results) {
    const folder = this.getNovelPath('projects', projectName);
    const filePath = `${folder}/.generate-history.json`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    const data = JSON.stringify(results.slice(-20), null, 2);

    if (file) {
      await this.app.vault.modify(file, data);
    } else {
      try {
        await this.app.vault.create(filePath, data);
      } catch (e) {
        logger.warn('保存生成历史失败:', e.message);
      }
    }
  }

  async loadGenerateHistory(projectName) {
    const folder = this.getNovelPath('projects', projectName);
    const filePath = `${folder}/.generate-history.json`;
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file) return [];

    try {
      const content = await this.app.vault.read(file);
      return JSON.parse(content);
    } catch (e) {
      logger.warn('加载生成历史失败:', e.message);
      return [];
    }
  }

  async getKnowledgeFiles(projectName) {
    const folder = this.getNovelPath('projects', projectName, 'knowledge');
    const files = this.app.vault.getFiles();
    return files.filter(f => f.path.startsWith(folder + '/') && (f.extension === 'md' || f.extension === 'txt'));
  }

  async getKnowledgeSummaries(projectName, maxChars = 2000) {
    const files = await this.getKnowledgeFiles(projectName);
    if (files.length === 0) return '';

    let combined = '';
    for (const f of files) {
      try {
        const txt = await this.app.vault.read(f);
        const body = txt.replace(/^---[\s\S]*?---\n/, '');
        combined += `\n【${f.basename}】\n${body.substring(0, 500)}\n`;
        if (combined.length > maxChars) break;
      } catch (e) {
        continue;
      }
    }
    return combined.substring(0, maxChars);
  }

  async getProjectFile(projectName) {
    const projects = await this.scanNotesByType('novel-project');
    return projects.find(p => (p.frontmatter.title || p.basename) === projectName) || null;
  }

  async getProjectDescription(projectName) {
    const proj = await this.getProjectFile(projectName);
    if (!proj) return null;
    const pf = this.app.vault.getAbstractFileByPath(proj.path);
    if (!pf) return null;
    const ptxt = await this.app.vault.read(pf);
    return ptxt.replace(/^---[\s\S]*?---\n/, '').trim();
  }

  async checkProjectExists(projectName) {
    const proj = await this.getProjectFile(projectName);
    return !!proj;
  }

  async collectProjectInfo(projectName) {
    let info = '';

    const proj = await this.getProjectFile(projectName);
    if (proj) {
      const pbody = await this.getProjectDescription(projectName);
      if (pbody) {
        info += `\n=== 项目描述 ===\n${pbody.substring(0, 800)}\n`;
      }
    }

    const chars = await this.scanNotesByType('novel-character', projectName);
    if (chars.length > 0) {
      info += '\n=== 角色档案 ===\n';
      for (const c of chars) {
        const f = this.app.vault.getAbstractFileByPath(c.path);
        if (f) {
          const txt = await this.app.vault.read(f);
          const body = txt.replace(/^---[\s\S]*?---\n/, '');
          info += `\n【${c.frontmatter.name || c.basename}】\n${body.substring(0, 400)}\n`;
        }
      }
    }

    const fsList = await this.scanNotesByType('novel-foreshadowing', projectName);
    if (fsList.length > 0) {
      info += '\n=== 伏笔设定 ===\n';
      for (const f of fsList) {
        info += `- ${f.frontmatter.content || f.basename}（第${f.frontmatter.planted_chapter || '?'}章，状态: ${f.frontmatter.status || 'active'}）\n`;
      }
    }

    const wsList = await this.scanNotesByType('novel-worldsetting', projectName);
    if (wsList.length > 0) {
      info += '\n=== 已有世界观 ===\n';
      for (const ws of wsList) {
        info += `- ${ws.frontmatter.name || ws.basename}（${ws.frontmatter.category || 'other'}）\n`;
      }
    }

    return info;
  }

  async deleteFile(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.vault.delete(file);
      this.invalidateCache();
      return true;
    }
    return false;
  }
}

module.exports = NovelService;