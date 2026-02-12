/**
 * Fund data service - fetch valuations, history, holdings
 * Replaces Python fund.py (akshare + requests → fetch API)
 */

/**
 * Get fund type from database
 */
export function getFundType(type, name) {
  if (type) return type;
  // Fallback heuristics
  if (name.includes('债') || name.includes('纯债') || name.includes('固收')) return '债券';
  if (name.includes('QDII') || name.includes('纳斯达克') || name.includes('标普') || name.includes('恒生')) return 'QDII';
  if (name.includes('货币')) return '货币';
  return '未知';
}

/**
 * Map fund type to major category
 */
export function getFundCategory(fundType) {
  if (!fundType) return '未分类';
  if (fundType.startsWith('货币型') || fundType === '货币') return '货币类';

  const debtKeys = ['债券型-', '混合型-偏债', '混合型-绝对收益', 'QDII-纯债', 'QDII-混合债', '指数型-固收'];
  if (debtKeys.some(k => fundType.startsWith(k)) || fundType === '债券') return '偏债类';

  const commodityKeys = ['商品', 'QDII-商品', 'REITs', 'Reits', 'QDII-REITs'];
  if (commodityKeys.some(k => fundType.includes(k))) return '商品类';

  const equityKeys = ['股票型', '混合型-偏股', '混合型-平衡', '混合型-灵活', '指数型-股票', '指数型-海外股票', '指数型-其他', 'QDII-普通股票', 'QDII-混合偏股', 'QDII-混合平衡', 'QDII-混合灵活', 'FOF-', 'QDII-FOF'];
  if (equityKeys.some(k => fundType.startsWith(k) || fundType.includes(k))) return '偏股类';

  return '未分类';
}

/**
 * Fetch real-time valuation from Eastmoney API
 */
export async function getEastmoneyValuation(code) {
  const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!resp.ok) return {};
    const text = await resp.text();
    const match = text.match(/jsonpgz\((.*)\)/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      return {
        name: data.name,
        nav: parseFloat(data.dwjz || 0),
        estimate: parseFloat(data.gsz || 0),
        estRate: parseFloat(data.gszzl || 0),
        time: data.gztime,
      };
    }
  } catch (e) {
    console.warn(`Eastmoney API error for ${code}: ${e.message}`);
  }
  return {};
}

/**
 * Fetch valuation from Sina API (backup source)
 */
export async function getSinaValuation(code) {
  const url = `http://hq.sinajs.cn/list=fu_${code}`;
  try {
    const resp = await fetch(url, {
      headers: { 'Referer': 'http://finance.sina.com.cn' },
    });
    const text = await resp.text();
    const match = text.match(/="(.*)"/);
    if (match && match[1]) {
      const parts = match[1].split(',');
      if (parts.length >= 8) {
        return {
          estimate: parseFloat(parts[2]),
          nav: parseFloat(parts[3]),
          estRate: parseFloat(parts[6]),
          time: `${parts[7]} ${parts[1]}`,
        };
      }
    }
  } catch (e) {
    console.warn(`Sina API error for ${code}: ${e.message}`);
  }
  return {};
}

/**
 * Combined valuation with multi-source failover
 */
export async function getCombinedValuation(db, code) {
  // 1. Try Eastmoney
  let data = await getEastmoneyValuation(code);
  if (data.estimate && data.estimate > 0) return data;

  // 2. Fallback to Sina
  const sinaData = await getSinaValuation(code);
  if (sinaData.estimate && sinaData.estimate > 0) {
    if (data && Object.keys(data).length > 0) {
      return { ...data, ...sinaData };
    }
    return sinaData;
  }

  // 3. Try custom estimation
  const { estimateNav } = await import('./estimate.js');
  try {
    const history = await getFundHistory(db, code, 30);
    if (history && history.length >= 2) {
      const mlResult = estimateNav(code, history);
      if (mlResult) {
        const yesterdayNav = history[history.length - 1].nav;
        let fundName = data?.name || code;
        if (!fundName || fundName === code) {
          const row = await db.prepare('SELECT name FROM funds WHERE code = ?').bind(code).first();
          if (row) fundName = row.name;
        }
        return {
          code,
          name: fundName,
          nav: yesterdayNav,
          navDate: history[history.length - 1].date,
          estimate: mlResult.estimate,
          estRate: mlResult.est_rate,
          time: new Date().toTimeString().slice(0, 5),
          source: 'ml_estimate',
          confidence: mlResult.confidence || 0,
          method: mlResult.method || 'unknown',
        };
      }
    }
  } catch (e) {
    console.error(`Custom estimation failed for ${code}: ${e.message}`);
  }

  // 4. Fallback: return yesterday's NAV
  if (data && Object.keys(data).length > 0) return data;

  try {
    const history = await getFundHistory(db, code, 1);
    if (history && history.length > 0) {
      let fundName = code;
      const row = await db.prepare('SELECT name FROM funds WHERE code = ?').bind(code).first();
      if (row) fundName = row.name;
      return {
        code,
        name: fundName,
        nav: history[history.length - 1].nav,
        navDate: history[history.length - 1].date,
        estimate: history[history.length - 1].nav,
        estRate: 0.0,
        time: '--',
        source: 'fallback',
      };
    }
  } catch {}

  return { code, name: code, nav: 0, estimate: 0, estRate: 0 };
}

/**
 * Search funds in D1
 */
export async function searchFunds(db, q) {
  if (!q) return [];
  const qClean = q.trim();
  const pattern = `%${qClean}%`;
  const prefixPattern = `${qClean}%`;

  const result = await db.prepare(`
    SELECT code, name, type,
      CASE
        WHEN code = ? THEN 1
        WHEN code LIKE ? THEN 2
        WHEN name LIKE ? THEN 3
        ELSE 4
      END as relevance
    FROM funds
    WHERE code LIKE ? OR name LIKE ?
    ORDER BY relevance, code
    LIMIT 30
  `).bind(qClean, prefixPattern, pattern, pattern, pattern).all();

  return result.results.map(row => ({
    id: String(row.code),
    name: row.name,
    type: row.type || '未知',
  }));
}

/**
 * Get historical NAV with D1 caching
 */
export async function getFundHistory(db, code, limit = 30) {
  // 1. Try D1 cache
  let rows;
  if (limit >= 9999) {
    rows = await db.prepare(
      'SELECT date, nav, updated_at FROM fund_history WHERE code = ? ORDER BY date DESC'
    ).bind(code).all();
  } else {
    rows = await db.prepare(
      'SELECT date, nav, updated_at FROM fund_history WHERE code = ? ORDER BY date DESC LIMIT ?'
    ).bind(code, limit).all();
  }

  const results = rows.results;

  // Check cache validity
  if (results.length > 0) {
    const latestUpdate = results[0].updated_at;
    const latestNavDate = results[0].date;
    try {
      const updateTime = new Date(latestUpdate);
      const ageHours = (Date.now() - updateTime.getTime()) / (1000 * 60 * 60);
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentHour = now.getUTCHours() + 8; // CST approximation

      const minRows = limit < 9999 ? 10 : 100;

      let cacheValid;
      if (currentHour >= 16 && latestNavDate < todayStr) {
        cacheValid = false;
      } else {
        cacheValid = ageHours < 24 && results.length >= Math.min(limit, minRows);
      }

      if (cacheValid) {
        return results.reverse().map(r => ({ date: r.date, nav: r.nav }));
      }
    } catch {}
  }

  // 2. Fetch from Eastmoney API (replaces akshare)
  try {
    const history = await fetchFundHistoryFromApi(code, limit);
    if (!history || history.length === 0) return [];

    // Save to D1 cache
    for (const item of history) {
      await db.prepare(
        'INSERT OR REPLACE INTO fund_history (code, date, nav, updated_at) VALUES (?, ?, ?, datetime())'
      ).bind(code, item.date, item.nav).run();
    }

    return history;
  } catch (e) {
    console.error(`History fetch error for ${code}: ${e.message}`);
    // Return cached data even if stale
    if (results.length > 0) {
      return results.reverse().map(r => ({ date: r.date, nav: r.nav }));
    }
    return [];
  }
}

/**
 * Fetch fund history from Eastmoney PingZhong data
 * Replaces akshare fund_open_fund_info_em
 */
async function fetchFundHistoryFromApi(code, limit) {
  const url = `http://fund.eastmoney.com/pingzhongdata/${code}.js`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.ok) return [];
    const text = await resp.text();

    // Extract Data_netWorthTrend
    const match = text.match(/Data_netWorthTrend\s*=\s*(\[.+?\])\s*;/s);
    if (!match) return [];

    const rawHist = JSON.parse(match[1]);
    if (!rawHist || rawHist.length === 0) return [];

    let results = rawHist
      .filter(item => 'x' in item && 'y' in item)
      .map(item => ({
        date: new Date(item.x).toISOString().slice(0, 10),
        nav: parseFloat(item.y),
      }));

    // Sort ascending
    results.sort((a, b) => a.date.localeCompare(b.date));

    // Limit if needed
    if (limit < 9999) {
      results = results.slice(-limit);
    }

    return results;
  } catch (e) {
    console.error(`PingZhong history error for ${code}: ${e.message}`);
    return [];
  }
}

/**
 * Get Eastmoney PingZhong detailed data
 */
export async function getEastmoneyPingzhongData(code) {
  const url = `http://fund.eastmoney.com/pingzhongdata/${code}.js`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.ok) return {};
    const text = await resp.text();
    const data = {};

    // Fund name
    const nameMatch = text.match(/fS_name\s*=\s*"(.*?)";/);
    if (nameMatch) data.name = nameMatch[1];

    // Fund code
    const codeMatch = text.match(/fS_code\s*=\s*"(.*?)";/);
    if (codeMatch) data.code = codeMatch[1];

    // Manager
    const managerMatch = text.match(/Data_currentFundManager\s*=\s*(\[.+?\])\s*;\s*\/\*/);
    if (managerMatch) {
      try {
        const managers = JSON.parse(managerMatch[1]);
        if (managers && managers.length > 0) {
          data.manager = managers.map(m => m.name).join(', ');
        }
      } catch {}
    }

    // Performance metrics
    for (const key of ['syl_1n', 'syl_6y', 'syl_3y', 'syl_1y']) {
      const m = text.match(new RegExp(`${key}\\s*=\\s*"(.*?)";`));
      if (m) data[key] = m[1];
    }

    // Performance evaluation
    const perfMatch = text.match(/Data_performanceEvaluation\s*=\s*(\{.+?\})\s*;\s*\/\*/);
    if (perfMatch) {
      try {
        const perf = JSON.parse(perfMatch[1]);
        if (perf && perf.data && perf.categories) {
          data.performance = {};
          perf.categories.forEach((cat, i) => {
            data.performance[cat] = perf.data[i];
          });
        }
      } catch {}
    }

    // History (Data_netWorthTrend)
    const histMatch = text.match(/Data_netWorthTrend\s*=\s*(\[.+?\])\s*;/s);
    if (histMatch) {
      try {
        const rawHist = JSON.parse(histMatch[1]);
        if (rawHist && rawHist.length > 0) {
          data.history = rawHist
            .filter(item => 'x' in item && 'y' in item)
            .map(item => ({
              date: new Date(item.x).toISOString().slice(0, 10),
              nav: parseFloat(item.y),
            }));
        }
      } catch (e) {
        console.error(`Failed to parse history for ${code}: ${e.message}`);
      }
    }

    return data;
  } catch (e) {
    console.warn(`PingZhong API error for ${code}: ${e.message}`);
    return {};
  }
}

/**
 * Get fund info from D1
 */
async function getFundInfoFromDb(db, code) {
  try {
    const row = await db.prepare('SELECT name, type FROM funds WHERE code = ?').bind(code).first();
    if (row) return { name: row.name, type: row.type };
  } catch {}
  return {};
}

/**
 * Fetch stock prices from Sina API in batch
 */
export async function fetchStockSpotsSina(codes) {
  if (!codes || codes.length === 0) return {};

  const formatted = [];
  const codeMap = {};

  for (const c of codes) {
    if (!c) continue;
    const cStr = String(c).trim();
    let prefix = '';
    let cleanC = cStr;

    if (/^\d+$/.test(cStr)) {
      if (cStr.length === 6) {
        prefix = ['60', '68', '90', '11'].some(p => cStr.startsWith(p)) ? 'sh' : 'sz';
      } else if (cStr.length === 5) {
        prefix = 'hk';
      }
    } else if (/^[a-zA-Z]+$/.test(cStr)) {
      prefix = 'gb_';
      cleanC = cStr.toLowerCase();
    }

    if (prefix) {
      const sinaCode = `${prefix}${cleanC}`;
      formatted.push(sinaCode);
      codeMap[sinaCode] = cStr;
    }
  }

  if (formatted.length === 0) return {};

  const url = `http://hq.sinajs.cn/list=${formatted.join(',')}`;
  try {
    const resp = await fetch(url, {
      headers: { 'Referer': 'http://finance.sina.com.cn' },
    });
    const text = await resp.text();
    const results = {};

    for (const line of text.trim().split('\n')) {
      if (!line || !line.includes('=') || !line.includes('"')) continue;

      const lineKey = line.split('=')[0].split('_str_').pop();
      const originalCode = codeMap[lineKey];
      if (!originalCode) continue;

      const dataPart = line.split('"')[1];
      if (!dataPart) continue;
      const parts = dataPart.split(',');

      let change = 0.0;
      try {
        if (lineKey.startsWith('gb_')) {
          if (parts.length > 2) change = parseFloat(parts[2]);
        } else if (lineKey.startsWith('hk')) {
          if (parts.length > 6) {
            const prevClose = parseFloat(parts[3]);
            const last = parseFloat(parts[6]);
            if (prevClose > 0) change = Math.round((last - prevClose) / prevClose * 10000) / 100;
          }
        } else {
          if (parts.length > 3) {
            const prevClose = parseFloat(parts[2]);
            const last = parseFloat(parts[3]);
            if (prevClose > 0) change = Math.round((last - prevClose) / prevClose * 10000) / 100;
          }
        }
        results[originalCode] = change;
      } catch {}
    }

    return results;
  } catch (e) {
    console.warn(`Sina stock fetch failed: ${e.message}`);
    return {};
  }
}

/**
 * Calculate technical indicators (pure JS, replaces numpy)
 */
export function calculateTechnicalIndicators(history) {
  if (!history || history.length < 10) {
    return { sharpe: '--', volatility: '--', max_drawdown: '--', annual_return: '--' };
  }

  try {
    const navs = history.map(item => item.nav);

    // Daily returns
    const dailyReturns = [];
    for (let i = 1; i < navs.length; i++) {
      dailyReturns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
    }

    // Annualized return
    const totalReturn = (navs[navs.length - 1] - navs[0]) / navs[0];
    const years = history.length / 250.0;
    const annualReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

    // Annualized volatility
    const mean = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(250);

    // Sharpe ratio (rf = 2%)
    const rf = 0.02;
    const sharpe = volatility > 0 ? (annualReturn - rf) / volatility : 0;

    // Max drawdown
    let maxDrawdown = 0;
    let peak = navs[0];
    for (const nav of navs) {
      if (nav > peak) peak = nav;
      const drawdown = (nav - peak) / peak;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      sharpe: Math.round(sharpe * 100) / 100,
      volatility: `${Math.round(volatility * 10000) / 100}%`,
      max_drawdown: `${Math.round(maxDrawdown * 10000) / 100}%`,
      annual_return: `${Math.round(annualReturn * 10000) / 100}%`,
    };
  } catch (e) {
    console.error(`Indicator calculation error: ${e.message}`);
    return { sharpe: '--', volatility: '--', max_drawdown: '--', annual_return: '--' };
  }
}

/**
 * Get NAV on a specific date
 */
export async function getNavOnDate(db, code, dateStr) {
  const history = await getFundHistory(db, code, 90);
  for (const item of history) {
    if (item.date.slice(0, 10) === dateStr.slice(0, 10)) {
      return item.nav;
    }
  }
  return null;
}

/**
 * Get complete fund intraday data (main API response)
 */
export async function getFundIntraday(db, code) {
  // 1) Real-time valuation
  const emData = await getCombinedValuation(db, code);
  let name = emData.name;
  const nav = parseFloat(emData.nav || 0);
  const estimate = parseFloat(emData.estimate || 0);
  const estRate = parseFloat(emData.estRate || 0);
  const updateTime = emData.time || new Date().toTimeString().slice(0, 8);
  const source = emData.source;
  const method = emData.method;
  const confidence = emData.confidence;

  // 1.5) Enrich with detailed info
  const pzData = await getEastmoneyPingzhongData(code);
  const extraInfo = {};
  if (pzData.name) extraInfo.full_name = pzData.name;
  if (pzData.manager) extraInfo.manager = pzData.manager;
  for (const k of ['syl_1n', 'syl_6y', 'syl_3y', 'syl_1y']) {
    if (pzData[k]) extraInfo[k] = pzData[k];
  }

  const dbInfo = await getFundInfoFromDb(db, code);
  if (dbInfo.name && !extraInfo.full_name) extraInfo.full_name = dbInfo.name;
  if (dbInfo.type) extraInfo.official_type = dbInfo.type;

  if (!name) name = extraInfo.full_name || `基金 ${code}`;
  const manager = extraInfo.manager || '--';

  // 2) Technical indicators
  let historyData = pzData.history || [];
  let techIndicators;
  if (historyData.length > 0) {
    techIndicators = calculateTechnicalIndicators(historyData.slice(-250));
  } else {
    historyData = await getFundHistory(db, code, 250);
    techIndicators = calculateTechnicalIndicators(historyData);
  }

  // 3) Holdings
  let holdings = [];
  let concentrationRate = 0.0;
  try {
    holdings = await fetchFundHoldings(db, code);
    // Calculate concentration from top 10
    const top10 = holdings.slice(0, 10);
    concentrationRate = top10.reduce((sum, h) => sum + h.percent, 0);
    holdings = holdings.slice(0, 20);
  } catch {}

  // 4) Type
  const sector = getFundType(dbInfo.type, name);

  return {
    id: String(code),
    name,
    type: sector,
    manager,
    nav,
    estimate,
    estRate,
    time: updateTime,
    source,
    method,
    confidence,
    holdings,
    indicators: {
      returns: {
        '1M': extraInfo.syl_1y || '--',
        '3M': extraInfo.syl_3y || '--',
        '6M': extraInfo.syl_6y || '--',
        '1Y': extraInfo.syl_1n || '--',
      },
      concentration: Math.round(concentrationRate * 100) / 100,
      technical: techIndicators,
    },
  };
}

/**
 * Fetch fund holdings from Eastmoney
 * Replaces akshare fund_portfolio_hold_em
 */
async function fetchFundHoldings(db, code) {
  const currentYear = new Date().getFullYear();

  for (const year of [currentYear, currentYear - 1]) {
    try {
      const url = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=20&year=${year}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://fundf10.eastmoney.com/' },
      });
      if (!resp.ok) continue;
      const text = await resp.text();

      // Parse HTML table
      const holdings = parseHoldingsHtml(text);
      if (holdings.length > 0) {
        // Fetch stock spot prices
        const stockCodes = holdings.map(h => h.stockCode).filter(Boolean);
        const spotMap = await fetchStockSpotsSina(stockCodes);

        return holdings.map(h => ({
          name: h.name,
          percent: h.percent,
          change: spotMap[h.stockCode] || 0.0,
        }));
      }
    } catch {}
  }

  return [];
}

/**
 * Parse holdings HTML from Eastmoney
 */
function parseHoldingsHtml(html) {
  const holdings = [];

  // Extract table rows with regex (no DOM in Workers)
  // Pattern: <td>...</td> cells in sequence: 序号, 股票代码, 股票名称, 占净值比例, ...
  const tableMatch = html.match(/<table[^>]*class="w782 comm tzxq"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) {
    // Try alternative pattern
    const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    let seenCodes = new Set();

    for (const trMatch of trMatches) {
      const tdMatches = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
      if (tdMatches.length >= 4) {
        // Extract stock code from link or plain text
        const codeCell = tdMatches[1]?.[1] || '';
        const codeMatch = codeCell.match(/(\d{5,6})/);
        if (!codeMatch) continue;

        const stockCode = codeMatch[1];
        if (seenCodes.has(stockCode)) continue;

        // Extract name
        const nameCell = tdMatches[2]?.[1] || '';
        const nameMatch = nameCell.match(/>([^<]+)</);
        const name = nameMatch ? nameMatch[1].trim() : nameCell.replace(/<[^>]*>/g, '').trim();
        if (!name) continue;

        // Extract percent
        const percentCell = tdMatches[3]?.[1] || '';
        const percentStr = percentCell.replace(/<[^>]*>/g, '').replace('%', '').trim();
        const percent = parseFloat(percentStr);
        if (isNaN(percent) || percent < 0.01) continue;

        seenCodes.add(stockCode);
        holdings.push({ stockCode, name, percent });
      }
    }
  }

  // Sort by percent descending
  holdings.sort((a, b) => b.percent - a.percent);
  return holdings;
}

/**
 * Fetch and update fund list from Eastmoney
 * Replaces akshare fund_name_em
 */
export async function fetchAndUpdateFunds(db) {
  console.log('Starting fund list update...');
  try {
    const url = 'http://fund.eastmoney.com/js/fundcode_search.js';
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.ok) {
      console.warn('Failed to fetch fund list');
      return;
    }

    const text = await resp.text();
    // Format: var r = [["000001","HXCZHH","华夏成长混合","混合型-偏股","HUAXIACHENGZHANGHUNHE"],...]
    const match = text.match(/var\s+r\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      console.warn('Failed to parse fund list');
      return;
    }

    const fundList = JSON.parse(match[1]);
    let count = 0;

    // Batch insert (D1 has batch limit)
    const batchSize = 50;
    for (let i = 0; i < fundList.length; i += batchSize) {
      const batch = fundList.slice(i, i + batchSize);
      const stmts = batch.map(item =>
        db.prepare(
          'INSERT OR REPLACE INTO funds (code, name, type, updated_at) VALUES (?, ?, ?, datetime())'
        ).bind(item[0], item[2], item[3])
      );
      await db.batch(stmts);
      count += batch.length;
    }

    console.log(`Fund list updated. Total funds: ${count}`);
  } catch (e) {
    console.error(`Failed to update fund list: ${e.message}`);
  }
}
