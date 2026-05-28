class Logger {
  constructor(prefix = '[NovelAI]') {
    this.prefix = prefix;
    this.enabled = true;
    this.debugEnabled = false;
  }

  log(...args) {
    if (this.enabled) {
      console.log(this.prefix, ...args);
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn(this.prefix, ...args);
    }
  }

  error(...args) {
    console.error(this.prefix, ...args);
  }

  debug(...args) {
    if (this.debugEnabled) {
      console.debug(this.prefix, ...args);
    }
  }

  setDebug(enabled) {
    this.debugEnabled = enabled;
  }
}

module.exports = new Logger();