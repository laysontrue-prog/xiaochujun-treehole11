// 简单的敏感词过滤器
// 在实际生产环境中，建议使用更专业的库如 bad-words 或 mint-filter，并配合更大的词库
class SensitiveFilter {
  constructor() {
    // 基础敏感词库 - 仅作示例
    this.words = [
      '暴力', '色情', '赌博', '诈骗', '傻逼', '白痴', '死全家', 
      '去死', '垃圾', '废物', '弱智', '脑残'
    ];
  }

  /**
   * 检查文本是否包含敏感词
   * @param {string} text 待检查文本
   * @returns {Object} { hasSensitive: boolean, words: string[] }
   */
  check(text) {
    if (!text) return { hasSensitive: false, words: [] };
    
    const foundWords = [];
    this.words.forEach(word => {
      if (text.includes(word)) {
        foundWords.push(word);
      }
    });

    return {
      hasSensitive: foundWords.length > 0,
      words: foundWords
    };
  }

  /**
   * 添加自定义敏感词
   * @param {string|string[]} words 
   */
  addWords(words) {
    if (Array.isArray(words)) {
      this.words.push(...words);
    } else {
      this.words.push(words);
    }
  }
}

module.exports = new SensitiveFilter();
