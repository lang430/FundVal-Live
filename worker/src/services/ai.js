/**
 * AI analysis service - replaces LangChain with direct OpenAI API calls
 */

import { decryptValue } from '../crypto.js';
import { LINUS_FINANCIAL_ANALYSIS_PROMPT } from './prompts.js';
import { getFundHistory, getFundIntraday, calculateTechnicalIndicators } from './fund.js';

/**
 * AI Service class
 */
export class AIService {
  /**
   * Get AI settings for a user
   */
  async getAISettings(db, env, userId) {
    const loadSettings = async (targetUserId) => {
      let rows = [];
      if (targetUserId == null) {
        const result = await db.prepare(
          'SELECT key, value, encrypted FROM settings WHERE user_id IS NULL'
        ).all();
        rows = result.results || [];
      } else {
        const result = await db.prepare(
          'SELECT key, value, encrypted FROM settings WHERE user_id = ?'
        ).bind(targetUserId).all();
        rows = result.results || [];
      }

      const settingsObj = {};
      for (const row of rows) {
        let value = row.value;
        if (row.encrypted && value) {
          value = await decryptValue(value, env);
        }
        settingsObj[row.key] = value;
      }
      return settingsObj;
    };

    const globalSettings = await loadSettings(null);
    let adminSettings = {};
    if (userId != null) {
      const adminRow = await db.prepare(
        'SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1'
      ).first();

      if (adminRow?.id && adminRow.id !== userId) {
        adminSettings = await loadSettings(adminRow.id);
      }
    }

    const userSettings = userId != null ? await loadSettings(userId) : {};
    const settings = { ...globalSettings, ...adminSettings, ...userSettings };

    return {
      apiBase: env.OPENAI_API_BASE || settings.OPENAI_API_BASE || 'https://integrate.api.nvidia.com/v1',
      apiKey: env.OPENAI_API_KEY || settings.OPENAI_API_KEY || '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',
      model: env.AI_MODEL_NAME || settings.AI_MODEL_NAME || 'deepseek-ai/deepseek-v3.2',
    };
  }

  /**
   * Get prompt template from database
   */
  async getPromptTemplate(db, promptId, userId) {
    let row;
    if (promptId) {
      if (userId == null) {
        row = await db.prepare(
          'SELECT system_prompt, user_prompt FROM ai_prompts WHERE id = ? AND user_id IS NULL'
        ).bind(promptId).first();
      } else {
        row = await db.prepare(
          'SELECT system_prompt, user_prompt FROM ai_prompts WHERE id = ? AND user_id = ?'
        ).bind(promptId, userId).first();
      }
    } else {
      if (userId == null) {
        row = await db.prepare(
          'SELECT system_prompt, user_prompt FROM ai_prompts WHERE is_default = 1 AND user_id IS NULL LIMIT 1'
        ).first();
      } else {
        row = await db.prepare(
          'SELECT system_prompt, user_prompt FROM ai_prompts WHERE is_default = 1 AND user_id = ? LIMIT 1'
        ).bind(userId).first();
      }
    }

    if (!row) return null;
    return { systemPrompt: row.system_prompt, userPrompt: row.user_prompt };
  }

  /**
   * Search news via DuckDuckGo
   */
  async searchNews(query) {
    try {
      const resp = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&t=fundval`,
        { headers: { 'User-Agent': 'FundVal-Live/1.0' } }
      );
      const data = await resp.json();

      if (!data.RelatedTopics || data.RelatedTopics.length === 0) {
        return '暂无相关近期新闻。';
      }

      return data.RelatedTopics
        .slice(0, 5)
        .map((t, i) => `${i + 1}. ${t.Text || ''}`)
        .join('\n');
    } catch {
      return '新闻搜索服务暂时不可用。';
    }
  }

  /**
   * Calculate simple indicators
   */
  calculateIndicators(history) {
    if (!history || history.length < 5) {
      return { status: '数据不足', desc: '新基金或数据缺失' };
    }

    const navs = history.map(h => h.nav);
    const current = navs[navs.length - 1];
    const max = Math.max(...navs);
    const min = Math.min(...navs);
    const avg = navs.reduce((a, b) => a + b, 0) / navs.length;

    const position = max > min ? (current - min) / (max - min) : 0.5;

    let status = '正常';
    if (position > 0.9) status = '高位';
    else if (position < 0.1) status = '低位';
    else if (current > avg * 1.05) status = '偏高';
    else if (current < avg * 0.95) status = '偏低';

    const posLabel = position > 0.8 ? '高位' : position < 0.2 ? '低位' : '中位';
    return {
      status,
      desc: `近30日最高${max.toFixed(4)}, 最低${min.toFixed(4)}, 现价处于${posLabel}区间 (${Math.round(position * 100)}%)`,
    };
  }

  /**
   * Analyze fund using LLM
   */
  async analyzeFund(db, env, fundInfo, promptId = null, userId = null) {
    const settings = await this.getAISettings(db, env, userId);

    if (!settings.apiKey) {
      return {
        markdown: '## 配置错误\n\n未配置 OpenAI API Key，请前往设置页面配置。',
        indicators: { status: '未知', desc: '无法分析' },
        timestamp: new Date().toTimeString().slice(0, 8),
      };
    }

    const fundId = fundInfo.id;
    const fundName = fundInfo.name || '未知基金';

    // 1. Gather data
    const fundDetail = await getFundIntraday(db, fundId);
    const techData = fundDetail.indicators?.technical || {};

    const history = await getFundHistory(db, fundId, 250);
    const indicators = this.calculateIndicators(
      history.length >= 30 ? history.slice(0, 30) : history
    );

    let historySummary = '暂无历史数据';
    if (history.length > 0) {
      const recent = history.slice(0, 30);
      historySummary = `近30日走势: 起始${recent[0].nav} -> 结束${recent[recent.length - 1].nav}. ${indicators.desc}`;
    }

    let holdingsStr = '';
    if (fundDetail.holdings && fundDetail.holdings.length > 0) {
      holdingsStr = fundDetail.holdings
        .slice(0, 10)
        .map(h => `- ${h.name}: ${h.percent}% (涨跌: ${h.change >= 0 ? '+' : ''}${h.change.toFixed(2)}%)`)
        .join('\n');
    }

    // 2. Build prompt
    const variables = {
      fund_code: fundId,
      fund_name: fundName,
      fund_type: fundDetail.type || '未知',
      manager: fundDetail.manager || '未知',
      nav: fundDetail.nav || '--',
      estimate: fundDetail.estimate || '--',
      est_rate: `${fundDetail.estRate || 0}%`,
      concentration: fundDetail.indicators?.concentration || '--',
      holdings: holdingsStr || '暂无持仓数据',
      sharpe: techData.sharpe || '--',
      volatility: techData.volatility || '--',
      max_drawdown: techData.max_drawdown || '--',
      annual_return: techData.annual_return || '--',
      history_summary: historySummary,
    };

    // Get custom or default prompt
    const customPrompt = await this.getPromptTemplate(db, promptId, userId);

    let messages;
    if (customPrompt && customPrompt.systemPrompt && customPrompt.userPrompt) {
      messages = [
        { role: 'system', content: this.replaceVariables(customPrompt.systemPrompt, variables) },
        { role: 'user', content: this.replaceVariables(customPrompt.userPrompt, variables) },
      ];
    } else {
      // Use default hardcoded prompt
      messages = LINUS_FINANCIAL_ANALYSIS_PROMPT(variables);
    }

    // 3. Call LLM
    try {
      const apiUrl = `${settings.apiBase.replace(/\/$/, '')}/chat/completions`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API returned ${resp.status}: ${errText}`);
      }

      const result = await resp.json();
      let markdown = result.choices?.[0]?.message?.content || '';

      // Clean up
      markdown = markdown.trim();
      if (markdown.includes('```markdown')) {
        markdown = markdown.split('```markdown')[1].split('```')[0].trim();
      } else if (markdown.startsWith('```') && markdown.endsWith('```')) {
        markdown = markdown.slice(3, -3).trim();
      }

      // Save history
      await this.saveAnalysisHistory(db, {
        userId,
        accountId: fundInfo.account_id || 1,
        fundCode: fundId,
        fundName,
        promptId,
        promptName: await this.getPromptName(db, promptId, userId),
        markdown,
        indicatorsJson: JSON.stringify(indicators),
        status: 'success',
      });

      return {
        markdown,
        indicators,
        timestamp: new Date().toTimeString().slice(0, 8),
      };
    } catch (e) {
      console.error(`AI Analysis Error: ${e.message}`);
      const errorMarkdown = `## 分析失败\n\nLLM 调用失败: ${e.message}\n\n请检查 API 配置和提示词格式。`;

      await this.saveAnalysisHistory(db, {
        userId,
        accountId: fundInfo.account_id || 1,
        fundCode: fundId,
        fundName,
        promptId,
        promptName: await this.getPromptName(db, promptId, userId),
        markdown: errorMarkdown,
        indicatorsJson: JSON.stringify(indicators),
        status: 'failed',
        errorMessage: e.message,
      });

      return {
        markdown: errorMarkdown,
        indicators,
        timestamp: new Date().toTimeString().slice(0, 8),
      };
    }
  }

  /**
   * Replace template variables in prompt
   */
  replaceVariables(template, variables) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  async getPromptName(db, promptId, userId) {
    if (!promptId) return '默认提示词';
    let row;
    if (userId == null) {
      row = await db.prepare('SELECT name FROM ai_prompts WHERE id = ? AND user_id IS NULL').bind(promptId).first();
    } else {
      row = await db.prepare('SELECT name FROM ai_prompts WHERE id = ? AND user_id = ?').bind(promptId, userId).first();
    }
    return row?.name || `Prompt #${promptId}`;
  }

  async saveAnalysisHistory(db, { userId, accountId, fundCode, fundName, promptId, promptName, markdown, indicatorsJson, status, errorMessage = null }) {
    try {
      await db.prepare(`
        INSERT INTO ai_analysis_history
        (user_id, account_id, fund_code, fund_name, prompt_id, prompt_name, markdown, indicators_json, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, accountId, fundCode, fundName, promptId, promptName, markdown, indicatorsJson, status, errorMessage).run();

      // Cleanup old records (keep last 50)
      await this.cleanupOldHistory(db, userId, accountId, fundCode);
    } catch (e) {
      console.error(`Failed to save analysis history: ${e.message}`);
    }
  }

  async cleanupOldHistory(db, userId, accountId, fundCode) {
    try {
      let countRow;
      if (userId == null) {
        countRow = await db.prepare(
          'SELECT COUNT(*) as cnt FROM ai_analysis_history WHERE user_id IS NULL AND account_id = ? AND fund_code = ?'
        ).bind(accountId, fundCode).first();
      } else {
        countRow = await db.prepare(
          'SELECT COUNT(*) as cnt FROM ai_analysis_history WHERE user_id = ? AND account_id = ? AND fund_code = ?'
        ).bind(userId, accountId, fundCode).first();
      }

      if (countRow.cnt > 50) {
        const toDelete = countRow.cnt - 50;
        if (userId == null) {
          await db.prepare(`
            DELETE FROM ai_analysis_history WHERE rowid IN (
              SELECT rowid FROM ai_analysis_history
              WHERE user_id IS NULL AND account_id = ? AND fund_code = ?
              ORDER BY created_at ASC LIMIT ?
            )
          `).bind(accountId, fundCode, toDelete).run();
        } else {
          await db.prepare(`
            DELETE FROM ai_analysis_history WHERE rowid IN (
              SELECT rowid FROM ai_analysis_history
              WHERE user_id = ? AND account_id = ? AND fund_code = ?
              ORDER BY created_at ASC LIMIT ?
            )
          `).bind(userId, accountId, fundCode, toDelete).run();
        }
      }
    } catch (e) {
      console.error(`Failed to cleanup history: ${e.message}`);
    }
  }
}

export const aiService = new AIService();
