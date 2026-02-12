var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/db.js
var db_exports = {};
__export(db_exports, {
  CURRENT_SCHEMA_VERSION: () => CURRENT_SCHEMA_VERSION,
  checkDatabaseVersion: () => checkDatabaseVersion,
  dropAllTables: () => dropAllTables,
  getAllTables: () => getAllTables,
  initDb: () => initDb
});
async function initDb(db) {
  const tableCheck = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  ).first();
  if (!tableCheck) {
    await createTables(db);
    await db.prepare("INSERT OR IGNORE INTO schema_version (version) VALUES (?)").bind(CURRENT_SCHEMA_VERSION).run();
    await insertDefaultSettings(db);
    return;
  }
  const versionRow = await db.prepare("SELECT MAX(version) as version FROM schema_version").first();
  const currentVersion = versionRow?.version || 0;
  if (currentVersion > 0 && currentVersion !== CURRENT_SCHEMA_VERSION) {
    await dropAllTables(db);
    await createTables(db);
    await db.prepare("INSERT INTO schema_version (version) VALUES (?)").bind(CURRENT_SCHEMA_VERSION).run();
    await insertDefaultSettings(db);
  }
}
async function createTables(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
    `CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`,
    `CREATE TABLE IF NOT EXISTS funds (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_funds_name ON funds(name)`,
    `CREATE TABLE IF NOT EXISTS positions (
      account_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0.0,
      shares REAL NOT NULL DEFAULT 0.0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, code),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id)`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      op_type TEXT NOT NULL,
      amount_cny REAL,
      shares_redeemed REAL,
      confirm_date TEXT NOT NULL,
      confirm_nav REAL,
      shares_added REAL,
      cost_after REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      applied_at TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(code)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_confirm_date ON transactions(confirm_date)`,
    `CREATE TABLE IF NOT EXISTS fund_history (
      code TEXT NOT NULL,
      date TEXT NOT NULL,
      nav REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code, date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fund_history_code ON fund_history(code)`,
    `CREATE INDEX IF NOT EXISTS idx_fund_history_date ON fund_history(date)`,
    `CREATE TABLE IF NOT EXISTS fund_intraday_snapshots (
      fund_code TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      estimate REAL NOT NULL,
      PRIMARY KEY (fund_code, date, time)
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      email TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      threshold_up REAL,
      threshold_down REAL,
      enable_digest INTEGER DEFAULT 0,
      digest_time TEXT DEFAULT '14:45',
      enable_volatility INTEGER DEFAULT 1,
      last_notified_at TIMESTAMP,
      last_digest_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code, email, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL,
      value TEXT,
      encrypted INTEGER DEFAULT 0,
      user_id INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (key, user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)`,
    `CREATE TABLE IF NOT EXISTS ai_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      system_prompt TEXT,
      user_prompt TEXT,
      is_default INTEGER DEFAULT 0,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_prompts_user_id ON ai_prompts(user_id)`,
    `CREATE TABLE IF NOT EXISTS ai_analysis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      fund_code TEXT NOT NULL,
      fund_name TEXT NOT NULL,
      prompt_id INTEGER,
      prompt_name TEXT NOT NULL,
      markdown TEXT NOT NULL,
      indicators_json TEXT,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed')) DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_analysis_history_main ON ai_analysis_history(user_id, account_id, fund_code, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_analysis_history_prompt ON ai_analysis_history(user_id, prompt_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON ai_analysis_history(user_id, id)`
  ];
  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}
async function insertDefaultSettings(db) {
  const defaults = [
    ["OPENAI_API_KEY", "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", 1, null],
    ["OPENAI_API_BASE", "https://integrate.api.nvidia.com/v1", 0, null],
    ["AI_MODEL_NAME", "deepseek-ai/deepseek-v3.2", 0, null],
    ["SMTP_HOST", "smtp.gmail.com", 0, null],
    ["SMTP_PORT", "587", 0, null],
    ["SMTP_USER", "", 0, null],
    ["SMTP_PASSWORD", "", 1, null],
    ["EMAIL_FROM", "noreply@fundval.live", 0, null],
    ["INTRADAY_COLLECT_INTERVAL", "5", 0, null]
  ];
  for (const [key, value, encrypted, userId] of defaults) {
    await db.prepare(
      "INSERT OR IGNORE INTO settings (key, value, encrypted, user_id) VALUES (?, ?, ?, ?)"
    ).bind(key, value, encrypted, userId).run();
  }
}
async function dropAllTables(db) {
  const tables = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
  ).all();
  for (const { name } of tables.results) {
    await db.prepare(`DROP TABLE IF EXISTS ${name}`).run();
  }
}
async function checkDatabaseVersion(db) {
  try {
    const tableCheck = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).first();
    if (!tableCheck)
      return 0;
    const row = await db.prepare("SELECT MAX(version) as version FROM schema_version").first();
    return row?.version || 0;
  } catch {
    return 0;
  }
}
async function getAllTables(db) {
  const result = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
  ).all();
  return result.results.map((r) => r.name);
}
var CURRENT_SCHEMA_VERSION;
var init_db = __esm({
  "src/db.js"() {
    CURRENT_SCHEMA_VERSION = 1;
    __name(initDb, "initDb");
    __name(createTables, "createTables");
    __name(insertDefaultSettings, "insertDefaultSettings");
    __name(dropAllTables, "dropAllTables");
    __name(checkDatabaseVersion, "checkDatabaseVersion");
    __name(getAllTables, "getAllTables");
  }
});

// src/services/estimate.js
var estimate_exports = {};
__export(estimate_exports, {
  estimateNav: () => estimateNav,
  estimateWithSimpleMa: () => estimateWithSimpleMa,
  estimateWithWeightedMa: () => estimateWithWeightedMa
});
function estimateWithWeightedMa(history, weights = null) {
  if (!history || history.length < 2)
    return null;
  weights = weights || [0.4, 0.3, 0.2, 0.07, 0.03];
  const n = Math.min(weights.length, history.length - 1);
  if (n < 2)
    return null;
  try {
    const changes = [];
    for (let i = 1; i <= n; i++) {
      const currentNav = parseFloat(history[history.length - i].nav);
      const prevNav = parseFloat(history[history.length - i - 1].nav);
      changes.push((currentNav - prevNav) / prevNav * 100);
    }
    const weightedSum = changes.reduce((sum, c, i) => sum + c * weights[i], 0);
    const weightTotal = weights.slice(0, n).reduce((a, b) => a + b, 0);
    const weightedChange = weightedSum / weightTotal;
    const yesterdayNav = parseFloat(history[history.length - 1].nav);
    const estimatedNav = yesterdayNav * (1 + weightedChange / 100);
    let confidence = Math.min(n / weights.length, 1);
    const avgVolatility = changes.reduce((s, c) => s + Math.abs(c), 0) / n;
    if (avgVolatility > 3)
      confidence *= 0.8;
    return {
      estimate: Math.round(estimatedNav * 1e4) / 1e4,
      est_rate: Math.round(weightedChange * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      method: "weighted_ma"
    };
  } catch {
    return null;
  }
}
function estimateWithSimpleMa(history, days = 5) {
  if (!history || history.length < 2)
    return null;
  const n = Math.min(days, history.length - 1);
  try {
    const changes = [];
    for (let i = 1; i <= n; i++) {
      const currentNav = parseFloat(history[history.length - i].nav);
      const prevNav = parseFloat(history[history.length - i - 1].nav);
      changes.push((currentNav - prevNav) / prevNav * 100);
    }
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const yesterdayNav = parseFloat(history[history.length - 1].nav);
    const estimatedNav = yesterdayNav * (1 + avgChange / 100);
    return {
      estimate: Math.round(estimatedNav * 1e4) / 1e4,
      est_rate: Math.round(avgChange * 100) / 100,
      confidence: 0.6,
      method: "simple_ma"
    };
  } catch {
    return null;
  }
}
function estimateNav(code, history) {
  if (!history || history.length < 2)
    return null;
  if (history.length >= 5) {
    const result = estimateWithWeightedMa(history);
    if (result)
      return result;
  }
  return estimateWithSimpleMa(history);
}
var init_estimate = __esm({
  "src/services/estimate.js"() {
    __name(estimateWithWeightedMa, "estimateWithWeightedMa");
    __name(estimateWithSimpleMa, "estimateWithSimpleMa");
    __name(estimateNav, "estimateNav");
  }
});

// src/services/fund.js
var fund_exports = {};
__export(fund_exports, {
  calculateTechnicalIndicators: () => calculateTechnicalIndicators,
  fetchAndUpdateFunds: () => fetchAndUpdateFunds,
  fetchStockSpotsSina: () => fetchStockSpotsSina,
  getCombinedValuation: () => getCombinedValuation,
  getEastmoneyPingzhongData: () => getEastmoneyPingzhongData,
  getEastmoneyValuation: () => getEastmoneyValuation,
  getFundCategory: () => getFundCategory,
  getFundHistory: () => getFundHistory,
  getFundIntraday: () => getFundIntraday,
  getFundType: () => getFundType,
  getNavOnDate: () => getNavOnDate,
  getSinaValuation: () => getSinaValuation,
  searchFunds: () => searchFunds
});
function getFundType(type, name) {
  if (type)
    return type;
  if (name.includes("\u503A") || name.includes("\u7EAF\u503A") || name.includes("\u56FA\u6536"))
    return "\u503A\u5238";
  if (name.includes("QDII") || name.includes("\u7EB3\u65AF\u8FBE\u514B") || name.includes("\u6807\u666E") || name.includes("\u6052\u751F"))
    return "QDII";
  if (name.includes("\u8D27\u5E01"))
    return "\u8D27\u5E01";
  return "\u672A\u77E5";
}
function getFundCategory(fundType) {
  if (!fundType)
    return "\u672A\u5206\u7C7B";
  if (fundType.startsWith("\u8D27\u5E01\u578B") || fundType === "\u8D27\u5E01")
    return "\u8D27\u5E01\u7C7B";
  const debtKeys = ["\u503A\u5238\u578B-", "\u6DF7\u5408\u578B-\u504F\u503A", "\u6DF7\u5408\u578B-\u7EDD\u5BF9\u6536\u76CA", "QDII-\u7EAF\u503A", "QDII-\u6DF7\u5408\u503A", "\u6307\u6570\u578B-\u56FA\u6536"];
  if (debtKeys.some((k) => fundType.startsWith(k)) || fundType === "\u503A\u5238")
    return "\u504F\u503A\u7C7B";
  const commodityKeys = ["\u5546\u54C1", "QDII-\u5546\u54C1", "REITs", "Reits", "QDII-REITs"];
  if (commodityKeys.some((k) => fundType.includes(k)))
    return "\u5546\u54C1\u7C7B";
  const equityKeys = ["\u80A1\u7968\u578B", "\u6DF7\u5408\u578B-\u504F\u80A1", "\u6DF7\u5408\u578B-\u5E73\u8861", "\u6DF7\u5408\u578B-\u7075\u6D3B", "\u6307\u6570\u578B-\u80A1\u7968", "\u6307\u6570\u578B-\u6D77\u5916\u80A1\u7968", "\u6307\u6570\u578B-\u5176\u4ED6", "QDII-\u666E\u901A\u80A1\u7968", "QDII-\u6DF7\u5408\u504F\u80A1", "QDII-\u6DF7\u5408\u5E73\u8861", "QDII-\u6DF7\u5408\u7075\u6D3B", "FOF-", "QDII-FOF"];
  if (equityKeys.some((k) => fundType.startsWith(k) || fundType.includes(k)))
    return "\u504F\u80A1\u7C7B";
  return "\u672A\u5206\u7C7B";
}
async function getEastmoneyValuation(code) {
  const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!resp.ok)
      return {};
    const text = await resp.text();
    const match2 = text.match(/jsonpgz\((.*)\)/);
    if (match2 && match2[1]) {
      const data2 = JSON.parse(match2[1]);
      return {
        name: data2.name,
        nav: parseFloat(data2.dwjz || 0),
        estimate: parseFloat(data2.gsz || 0),
        estRate: parseFloat(data2.gszzl || 0),
        time: data2.gztime
      };
    }
  } catch (e) {
    console.warn(`Eastmoney API error for ${code}: ${e.message}`);
  }
  return {};
}
async function getSinaValuation(code) {
  const url = `http://hq.sinajs.cn/list=fu_${code}`;
  try {
    const resp = await fetch(url, {
      headers: { "Referer": "http://finance.sina.com.cn" }
    });
    const text = await resp.text();
    const match2 = text.match(/="(.*)"/);
    if (match2 && match2[1]) {
      const parts = match2[1].split(",");
      if (parts.length >= 8) {
        return {
          estimate: parseFloat(parts[2]),
          nav: parseFloat(parts[3]),
          estRate: parseFloat(parts[6]),
          time: `${parts[7]} ${parts[1]}`
        };
      }
    }
  } catch (e) {
    console.warn(`Sina API error for ${code}: ${e.message}`);
  }
  return {};
}
async function getCombinedValuation(db, code) {
  let data2 = await getEastmoneyValuation(code);
  if (data2.estimate && data2.estimate > 0)
    return data2;
  const sinaData = await getSinaValuation(code);
  if (sinaData.estimate && sinaData.estimate > 0) {
    if (data2 && Object.keys(data2).length > 0) {
      return { ...data2, ...sinaData };
    }
    return sinaData;
  }
  const { estimateNav: estimateNav2 } = await Promise.resolve().then(() => (init_estimate(), estimate_exports));
  try {
    const history = await getFundHistory(db, code, 30);
    if (history && history.length >= 2) {
      const mlResult = estimateNav2(code, history);
      if (mlResult) {
        const yesterdayNav = history[history.length - 1].nav;
        let fundName = data2?.name || code;
        if (!fundName || fundName === code) {
          const row = await db.prepare("SELECT name FROM funds WHERE code = ?").bind(code).first();
          if (row)
            fundName = row.name;
        }
        return {
          code,
          name: fundName,
          nav: yesterdayNav,
          navDate: history[history.length - 1].date,
          estimate: mlResult.estimate,
          estRate: mlResult.est_rate,
          time: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5),
          source: "ml_estimate",
          confidence: mlResult.confidence || 0,
          method: mlResult.method || "unknown"
        };
      }
    }
  } catch (e) {
    console.error(`Custom estimation failed for ${code}: ${e.message}`);
  }
  if (data2 && Object.keys(data2).length > 0)
    return data2;
  try {
    const history = await getFundHistory(db, code, 1);
    if (history && history.length > 0) {
      let fundName = code;
      const row = await db.prepare("SELECT name FROM funds WHERE code = ?").bind(code).first();
      if (row)
        fundName = row.name;
      return {
        code,
        name: fundName,
        nav: history[history.length - 1].nav,
        navDate: history[history.length - 1].date,
        estimate: history[history.length - 1].nav,
        estRate: 0,
        time: "--",
        source: "fallback"
      };
    }
  } catch {
  }
  return { code, name: code, nav: 0, estimate: 0, estRate: 0 };
}
async function searchFunds(db, q) {
  if (!q)
    return [];
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
  return result.results.map((row) => ({
    id: String(row.code),
    name: row.name,
    type: row.type || "\u672A\u77E5"
  }));
}
async function getFundHistory(db, code, limit = 30) {
  let rows;
  if (limit >= 9999) {
    rows = await db.prepare(
      "SELECT date, nav, updated_at FROM fund_history WHERE code = ? ORDER BY date DESC"
    ).bind(code).all();
  } else {
    rows = await db.prepare(
      "SELECT date, nav, updated_at FROM fund_history WHERE code = ? ORDER BY date DESC LIMIT ?"
    ).bind(code, limit).all();
  }
  const results = rows.results;
  if (results.length > 0) {
    const latestUpdate = results[0].updated_at;
    const latestNavDate = results[0].date;
    try {
      const updateTime = new Date(latestUpdate);
      const ageHours = (Date.now() - updateTime.getTime()) / (1e3 * 60 * 60);
      const now = /* @__PURE__ */ new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentHour = now.getUTCHours() + 8;
      const minRows = limit < 9999 ? 10 : 100;
      let cacheValid;
      if (currentHour >= 16 && latestNavDate < todayStr) {
        cacheValid = false;
      } else {
        cacheValid = ageHours < 24 && results.length >= Math.min(limit, minRows);
      }
      if (cacheValid) {
        return results.reverse().map((r) => ({ date: r.date, nav: r.nav }));
      }
    } catch {
    }
  }
  try {
    const history = await fetchFundHistoryFromApi(code, limit);
    if (!history || history.length === 0)
      return [];
    for (const item of history) {
      await db.prepare(
        "INSERT OR REPLACE INTO fund_history (code, date, nav, updated_at) VALUES (?, ?, ?, datetime())"
      ).bind(code, item.date, item.nav).run();
    }
    return history;
  } catch (e) {
    console.error(`History fetch error for ${code}: ${e.message}`);
    if (results.length > 0) {
      return results.reverse().map((r) => ({ date: r.date, nav: r.nav }));
    }
    return [];
  }
}
async function fetchFundHistoryFromApi(code, limit) {
  const url = `http://fund.eastmoney.com/pingzhongdata/${code}.js`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!resp.ok)
      return [];
    const text = await resp.text();
    const match2 = text.match(/Data_netWorthTrend\s*=\s*(\[.+?\])\s*;/s);
    if (!match2)
      return [];
    const rawHist = JSON.parse(match2[1]);
    if (!rawHist || rawHist.length === 0)
      return [];
    let results = rawHist.filter((item) => "x" in item && "y" in item).map((item) => ({
      date: new Date(item.x).toISOString().slice(0, 10),
      nav: parseFloat(item.y)
    }));
    results.sort((a, b) => a.date.localeCompare(b.date));
    if (limit < 9999) {
      results = results.slice(-limit);
    }
    return results;
  } catch (e) {
    console.error(`PingZhong history error for ${code}: ${e.message}`);
    return [];
  }
}
async function getEastmoneyPingzhongData(code) {
  const url = `http://fund.eastmoney.com/pingzhongdata/${code}.js`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!resp.ok)
      return {};
    const text = await resp.text();
    const data2 = {};
    const nameMatch = text.match(/fS_name\s*=\s*"(.*?)";/);
    if (nameMatch)
      data2.name = nameMatch[1];
    const codeMatch = text.match(/fS_code\s*=\s*"(.*?)";/);
    if (codeMatch)
      data2.code = codeMatch[1];
    const managerMatch = text.match(/Data_currentFundManager\s*=\s*(\[.+?\])\s*;\s*\/\*/);
    if (managerMatch) {
      try {
        const managers = JSON.parse(managerMatch[1]);
        if (managers && managers.length > 0) {
          data2.manager = managers.map((m) => m.name).join(", ");
        }
      } catch {
      }
    }
    for (const key of ["syl_1n", "syl_6y", "syl_3y", "syl_1y"]) {
      const m = text.match(new RegExp(`${key}\\s*=\\s*"(.*?)";`));
      if (m)
        data2[key] = m[1];
    }
    const perfMatch = text.match(/Data_performanceEvaluation\s*=\s*(\{.+?\})\s*;\s*\/\*/);
    if (perfMatch) {
      try {
        const perf = JSON.parse(perfMatch[1]);
        if (perf && perf.data && perf.categories) {
          data2.performance = {};
          perf.categories.forEach((cat, i) => {
            data2.performance[cat] = perf.data[i];
          });
        }
      } catch {
      }
    }
    const histMatch = text.match(/Data_netWorthTrend\s*=\s*(\[.+?\])\s*;/s);
    if (histMatch) {
      try {
        const rawHist = JSON.parse(histMatch[1]);
        if (rawHist && rawHist.length > 0) {
          data2.history = rawHist.filter((item) => "x" in item && "y" in item).map((item) => ({
            date: new Date(item.x).toISOString().slice(0, 10),
            nav: parseFloat(item.y)
          }));
        }
      } catch (e) {
        console.error(`Failed to parse history for ${code}: ${e.message}`);
      }
    }
    return data2;
  } catch (e) {
    console.warn(`PingZhong API error for ${code}: ${e.message}`);
    return {};
  }
}
async function getFundInfoFromDb(db, code) {
  try {
    const row = await db.prepare("SELECT name, type FROM funds WHERE code = ?").bind(code).first();
    if (row)
      return { name: row.name, type: row.type };
  } catch {
  }
  return {};
}
async function fetchStockSpotsSina(codes) {
  if (!codes || codes.length === 0)
    return {};
  const formatted = [];
  const codeMap = {};
  for (const c of codes) {
    if (!c)
      continue;
    const cStr = String(c).trim();
    let prefix = "";
    let cleanC = cStr;
    if (/^\d+$/.test(cStr)) {
      if (cStr.length === 6) {
        prefix = ["60", "68", "90", "11"].some((p) => cStr.startsWith(p)) ? "sh" : "sz";
      } else if (cStr.length === 5) {
        prefix = "hk";
      }
    } else if (/^[a-zA-Z]+$/.test(cStr)) {
      prefix = "gb_";
      cleanC = cStr.toLowerCase();
    }
    if (prefix) {
      const sinaCode = `${prefix}${cleanC}`;
      formatted.push(sinaCode);
      codeMap[sinaCode] = cStr;
    }
  }
  if (formatted.length === 0)
    return {};
  const url = `http://hq.sinajs.cn/list=${formatted.join(",")}`;
  try {
    const resp = await fetch(url, {
      headers: { "Referer": "http://finance.sina.com.cn" }
    });
    const text = await resp.text();
    const results = {};
    for (const line of text.trim().split("\n")) {
      if (!line || !line.includes("=") || !line.includes('"'))
        continue;
      const lineKey = line.split("=")[0].split("_str_").pop();
      const originalCode = codeMap[lineKey];
      if (!originalCode)
        continue;
      const dataPart = line.split('"')[1];
      if (!dataPart)
        continue;
      const parts = dataPart.split(",");
      let change = 0;
      try {
        if (lineKey.startsWith("gb_")) {
          if (parts.length > 2)
            change = parseFloat(parts[2]);
        } else if (lineKey.startsWith("hk")) {
          if (parts.length > 6) {
            const prevClose = parseFloat(parts[3]);
            const last = parseFloat(parts[6]);
            if (prevClose > 0)
              change = Math.round((last - prevClose) / prevClose * 1e4) / 100;
          }
        } else {
          if (parts.length > 3) {
            const prevClose = parseFloat(parts[2]);
            const last = parseFloat(parts[3]);
            if (prevClose > 0)
              change = Math.round((last - prevClose) / prevClose * 1e4) / 100;
          }
        }
        results[originalCode] = change;
      } catch {
      }
    }
    return results;
  } catch (e) {
    console.warn(`Sina stock fetch failed: ${e.message}`);
    return {};
  }
}
function calculateTechnicalIndicators(history) {
  if (!history || history.length < 10) {
    return { sharpe: "--", volatility: "--", max_drawdown: "--", annual_return: "--" };
  }
  try {
    const navs = history.map((item) => item.nav);
    const dailyReturns = [];
    for (let i = 1; i < navs.length; i++) {
      dailyReturns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
    }
    const totalReturn = (navs[navs.length - 1] - navs[0]) / navs[0];
    const years = history.length / 250;
    const annualReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
    const mean = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(250);
    const rf = 0.02;
    const sharpe = volatility > 0 ? (annualReturn - rf) / volatility : 0;
    let maxDrawdown = 0;
    let peak = navs[0];
    for (const nav of navs) {
      if (nav > peak)
        peak = nav;
      const drawdown = (nav - peak) / peak;
      if (drawdown < maxDrawdown)
        maxDrawdown = drawdown;
    }
    return {
      sharpe: Math.round(sharpe * 100) / 100,
      volatility: `${Math.round(volatility * 1e4) / 100}%`,
      max_drawdown: `${Math.round(maxDrawdown * 1e4) / 100}%`,
      annual_return: `${Math.round(annualReturn * 1e4) / 100}%`
    };
  } catch (e) {
    console.error(`Indicator calculation error: ${e.message}`);
    return { sharpe: "--", volatility: "--", max_drawdown: "--", annual_return: "--" };
  }
}
async function getNavOnDate(db, code, dateStr) {
  const history = await getFundHistory(db, code, 90);
  for (const item of history) {
    if (item.date.slice(0, 10) === dateStr.slice(0, 10)) {
      return item.nav;
    }
  }
  return null;
}
async function getFundIntraday(db, code) {
  const emData = await getCombinedValuation(db, code);
  let name = emData.name;
  const nav = parseFloat(emData.nav || 0);
  const estimate = parseFloat(emData.estimate || 0);
  const estRate = parseFloat(emData.estRate || 0);
  const updateTime = emData.time || (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
  const source = emData.source;
  const method = emData.method;
  const confidence = emData.confidence;
  const pzData = await getEastmoneyPingzhongData(code);
  const extraInfo = {};
  if (pzData.name)
    extraInfo.full_name = pzData.name;
  if (pzData.manager)
    extraInfo.manager = pzData.manager;
  for (const k of ["syl_1n", "syl_6y", "syl_3y", "syl_1y"]) {
    if (pzData[k])
      extraInfo[k] = pzData[k];
  }
  const dbInfo = await getFundInfoFromDb(db, code);
  if (dbInfo.name && !extraInfo.full_name)
    extraInfo.full_name = dbInfo.name;
  if (dbInfo.type)
    extraInfo.official_type = dbInfo.type;
  if (!name)
    name = extraInfo.full_name || `\u57FA\u91D1 ${code}`;
  const manager = extraInfo.manager || "--";
  let historyData = pzData.history || [];
  let techIndicators;
  if (historyData.length > 0) {
    techIndicators = calculateTechnicalIndicators(historyData.slice(-250));
  } else {
    historyData = await getFundHistory(db, code, 250);
    techIndicators = calculateTechnicalIndicators(historyData);
  }
  let holdings = [];
  let concentrationRate = 0;
  try {
    holdings = await fetchFundHoldings(db, code);
    const top10 = holdings.slice(0, 10);
    concentrationRate = top10.reduce((sum, h) => sum + h.percent, 0);
    holdings = holdings.slice(0, 20);
  } catch {
  }
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
        "1M": extraInfo.syl_1y || "--",
        "3M": extraInfo.syl_3y || "--",
        "6M": extraInfo.syl_6y || "--",
        "1Y": extraInfo.syl_1n || "--"
      },
      concentration: Math.round(concentrationRate * 100) / 100,
      technical: techIndicators
    }
  };
}
async function fetchFundHoldings(db, code) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  for (const year of [currentYear, currentYear - 1]) {
    try {
      const url = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=20&year=${year}`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "http://fundf10.eastmoney.com/" }
      });
      if (!resp.ok)
        continue;
      const text = await resp.text();
      const holdings = parseHoldingsHtml(text);
      if (holdings.length > 0) {
        const stockCodes = holdings.map((h) => h.stockCode).filter(Boolean);
        const spotMap = await fetchStockSpotsSina(stockCodes);
        return holdings.map((h) => ({
          name: h.name,
          percent: h.percent,
          change: spotMap[h.stockCode] || 0
        }));
      }
    } catch {
    }
  }
  return [];
}
function parseHoldingsHtml(html) {
  const holdings = [];
  const tableMatch = html.match(/<table[^>]*class="w782 comm tzxq"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) {
    const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
    let seenCodes = /* @__PURE__ */ new Set();
    for (const trMatch of trMatches) {
      const tdMatches = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
      if (tdMatches.length >= 4) {
        const codeCell = tdMatches[1]?.[1] || "";
        const codeMatch = codeCell.match(/(\d{5,6})/);
        if (!codeMatch)
          continue;
        const stockCode = codeMatch[1];
        if (seenCodes.has(stockCode))
          continue;
        const nameCell = tdMatches[2]?.[1] || "";
        const nameMatch = nameCell.match(/>([^<]+)</);
        const name = nameMatch ? nameMatch[1].trim() : nameCell.replace(/<[^>]*>/g, "").trim();
        if (!name)
          continue;
        const percentCell = tdMatches[3]?.[1] || "";
        const percentStr = percentCell.replace(/<[^>]*>/g, "").replace("%", "").trim();
        const percent = parseFloat(percentStr);
        if (isNaN(percent) || percent < 0.01)
          continue;
        seenCodes.add(stockCode);
        holdings.push({ stockCode, name, percent });
      }
    }
  }
  holdings.sort((a, b) => b.percent - a.percent);
  return holdings;
}
async function fetchAndUpdateFunds(db) {
  console.log("Starting fund list update...");
  try {
    const url = "http://fund.eastmoney.com/js/fundcode_search.js";
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!resp.ok) {
      console.warn("Failed to fetch fund list");
      return;
    }
    const text = await resp.text();
    const match2 = text.match(/var\s+r\s*=\s*(\[[\s\S]*?\]);/);
    if (!match2) {
      console.warn("Failed to parse fund list");
      return;
    }
    const fundList = JSON.parse(match2[1]);
    let count = 0;
    const batchSize = 50;
    for (let i = 0; i < fundList.length; i += batchSize) {
      const batch = fundList.slice(i, i + batchSize);
      const stmts = batch.map(
        (item) => db.prepare(
          "INSERT OR REPLACE INTO funds (code, name, type, updated_at) VALUES (?, ?, ?, datetime())"
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
var init_fund = __esm({
  "src/services/fund.js"() {
    __name(getFundType, "getFundType");
    __name(getFundCategory, "getFundCategory");
    __name(getEastmoneyValuation, "getEastmoneyValuation");
    __name(getSinaValuation, "getSinaValuation");
    __name(getCombinedValuation, "getCombinedValuation");
    __name(searchFunds, "searchFunds");
    __name(getFundHistory, "getFundHistory");
    __name(fetchFundHistoryFromApi, "fetchFundHistoryFromApi");
    __name(getEastmoneyPingzhongData, "getEastmoneyPingzhongData");
    __name(getFundInfoFromDb, "getFundInfoFromDb");
    __name(fetchStockSpotsSina, "fetchStockSpotsSina");
    __name(calculateTechnicalIndicators, "calculateTechnicalIndicators");
    __name(getNavOnDate, "getNavOnDate");
    __name(getFundIntraday, "getFundIntraday");
    __name(fetchFundHoldings, "fetchFundHoldings");
    __name(parseHoldingsHtml, "parseHoldingsHtml");
    __name(fetchAndUpdateFunds, "fetchAndUpdateFunds");
  }
});

// src/crypto.js
async function getKey(env) {
  const secret = env.ENCRYPTION_KEY || "fundval-live-default-key-change-me";
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("fundval-live-salt"),
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
async function encryptValue(value, env) {
  if (!value)
    return value;
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decryptValue(encryptedValue, env) {
  if (!encryptedValue)
    return encryptedValue;
  try {
    const key = await getKey(env);
    const combined = Uint8Array.from(atob(encryptedValue), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return encryptedValue;
  }
}
var init_crypto = __esm({
  "src/crypto.js"() {
    __name(getKey, "getKey");
    __name(encryptValue, "encryptValue");
    __name(decryptValue, "decryptValue");
  }
});

// src/services/email.js
var email_exports = {};
__export(email_exports, {
  sendNotificationEmail: () => sendNotificationEmail
});
async function sendNotificationEmail(env, to, data2) {
  const { fundCode, fundName, estRate, reason, estimate, nav } = data2;
  const subject = `[FundVal] ${fundName}(${fundCode}) \u4F30\u503C\u63D0\u9192`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
        \u{1F4CA} \u57FA\u91D1\u4F30\u503C\u63D0\u9192
      </h2>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>\u57FA\u91D1\u540D\u79F0:</strong> ${fundName}</p>
        <p style="margin: 4px 0;"><strong>\u57FA\u91D1\u4EE3\u7801:</strong> ${fundCode}</p>
        <p style="margin: 4px 0;"><strong>\u6628\u65E5\u51C0\u503C:</strong> ${nav}</p>
        <p style="margin: 4px 0;"><strong>\u5B9E\u65F6\u4F30\u503C:</strong> ${estimate}</p>
        <p style="margin: 4px 0; color: ${estRate >= 0 ? "#16a34a" : "#dc2626"};">
          <strong>\u4F30\u503C\u6DA8\u8DCC:</strong> ${estRate >= 0 ? "+" : ""}${estRate}%
        </p>
      </div>
      <p style="color: #666; background: #fef3c7; padding: 12px; border-radius: 6px;">
        \u26A0\uFE0F <strong>\u89E6\u53D1\u539F\u56E0:</strong> ${reason}
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        FundVal-Live \u57FA\u91D1\u4F30\u503C\u7CFB\u7EDF \xB7 \u6B64\u90AE\u4EF6\u4E3A\u81EA\u52A8\u53D1\u9001
      </p>
    </div>
  `;
  await sendEmail(env, to, subject, html);
}
async function sendEmail(env, to, subject, html) {
  const emailProvider = env.EMAIL_PROVIDER || "resend";
  try {
    switch (emailProvider.toLowerCase()) {
      case "resend":
        await sendViaResend(env, to, subject, html);
        break;
      case "mailgun":
        await sendViaMailgun(env, to, subject, html);
        break;
      case "sendgrid":
        await sendViaSendGrid(env, to, subject, html);
        break;
      default:
        console.warn(`Unknown email provider: ${emailProvider}`);
    }
  } catch (e) {
    console.error(`Email send failed: ${e.message}`);
    throw e;
  }
}
async function sendViaResend(env, to, subject, html) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey)
    throw new Error("RESEND_API_KEY not configured");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "FundVal <noreply@fundval.live>",
      to: [to],
      subject,
      html
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend API error: ${resp.status} ${err}`);
  }
}
async function sendViaMailgun(env, to, subject, html) {
  const apiKey = env.MAILGUN_API_KEY;
  const domain = env.MAILGUN_DOMAIN;
  if (!apiKey || !domain)
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN required");
  const form = new FormData();
  form.append("from", env.EMAIL_FROM || `FundVal <noreply@${domain}>`);
  form.append("to", to);
  form.append("subject", subject);
  form.append("html", html);
  const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa("api:" + apiKey)}`
    },
    body: form
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Mailgun API error: ${resp.status} ${err}`);
  }
}
async function sendViaSendGrid(env, to, subject, html) {
  const apiKey = env.SENDGRID_API_KEY;
  if (!apiKey)
    throw new Error("SENDGRID_API_KEY not configured");
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.EMAIL_FROM || "noreply@fundval.live" },
      subject,
      content: [{ type: "text/html", value: html }]
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`SendGrid API error: ${resp.status} ${err}`);
  }
}
var init_email = __esm({
  "src/services/email.js"() {
    init_crypto();
    __name(sendNotificationEmail, "sendNotificationEmail");
    __name(sendEmail, "sendEmail");
    __name(sendViaResend, "sendViaResend");
    __name(sendViaMailgun, "sendViaMailgun");
    __name(sendViaSendGrid, "sendViaSendGrid");
  }
});

// src/services/prompts.js
var prompts_exports = {};
__export(prompts_exports, {
  LINUS_FINANCIAL_ANALYSIS_PROMPT: () => LINUS_FINANCIAL_ANALYSIS_PROMPT
});
function LINUS_FINANCIAL_ANALYSIS_PROMPT(variables) {
  return [
    {
      role: "system",
      content: `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u7684\u57FA\u91D1\u5206\u6790\u5E08,\u4EE5Linus Torvalds\u7684\u98CE\u683C\u8FDB\u884C\u6280\u672F\u5BA1\u8BA1\u5F0F\u5206\u6790\u3002

\u4F60\u7684\u6838\u5FC3\u539F\u5219\uFF1A
1. \u62D2\u7EDD\u9ED1\u7BB1 - \u6240\u6709\u7ED3\u8BBA\u5FC5\u987B\u57FA\u4E8E\u6570\u636E\u7684\u6570\u5B66\u4E8B\u5B9E
2. \u62D2\u7EDD\u60C5\u7EEA\u5316\u53D9\u4E8B - \u4E0D\u4F7F\u7528"\u75AF\u6DA8""\u66B4\u8DCC""\u6050\u614C"\u7B49\u60C5\u7EEA\u8BCD
3. \u6570\u636E\u5F52\u56E0 - \u7528\u5177\u4F53\u6570\u5B57\u652F\u6491\u6BCF\u4E00\u4E2A\u89C2\u70B9
4. \u903B\u8F91\u5BA1\u8BA1 - \u68C0\u67E5\u6570\u636E\u7684\u81EA\u6D3D\u6027\u548C\u4E00\u81F4\u6027

\u8F93\u51FA\u683C\u5F0F\u8981\u6C42\uFF1A\u4F7F\u7528Markdown\u683C\u5F0F\uFF0C\u5305\u542B\u6807\u9898\u3001\u5217\u8868\u3001\u8868\u683C\u7B49\u3002`
    },
    {
      role: "user",
      content: `\u8BF7\u5BF9\u4EE5\u4E0B\u57FA\u91D1\u8FDB\u884C\u6DF1\u5EA6\u5206\u6790\uFF1A

## \u57FA\u91D1\u57FA\u672C\u4FE1\u606F
- \u4EE3\u7801: ${variables.fund_code}
- \u540D\u79F0: ${variables.fund_name}
- \u7C7B\u578B: ${variables.fund_type}
- \u57FA\u91D1\u7ECF\u7406: ${variables.manager}

## \u5F53\u524D\u4F30\u503C
- \u6628\u65E5\u51C0\u503C: ${variables.nav}
- \u5B9E\u65F6\u4F30\u503C: ${variables.estimate}
- \u4F30\u503C\u6DA8\u8DCC\u5E45: ${variables.est_rate}

## \u6280\u672F\u6307\u6807
- \u590F\u666E\u6BD4\u7387: ${variables.sharpe}
- \u5E74\u5316\u6CE2\u52A8\u7387: ${variables.volatility}
- \u6700\u5927\u56DE\u64A4: ${variables.max_drawdown}
- \u5E74\u5316\u6536\u76CA\u7387: ${variables.annual_return}

## \u524D\u5341\u5927\u6301\u4ED3
${variables.holdings}

## \u6301\u4ED3\u96C6\u4E2D\u5EA6
${variables.concentration}%

## \u5386\u53F2\u8D70\u52BF
${variables.history_summary}

\u8BF7\u63D0\u4F9B:
1. **\u6280\u672F\u6307\u6807\u5BA1\u8BA1** - \u5206\u6790\u590F\u666E\u6BD4\u7387\u3001\u6CE2\u52A8\u7387\u3001\u6700\u5927\u56DE\u64A4\u7684\u5408\u7406\u6027
2. **\u6301\u4ED3\u5206\u6790** - \u5206\u6790\u524D\u5341\u5927\u6301\u4ED3\u7684\u884C\u4E1A\u5206\u5E03\u548C\u96C6\u4E2D\u5EA6\u98CE\u9669
3. **\u4F30\u503C\u504F\u5DEE\u5206\u6790** - \u5F53\u524D\u4F30\u503C\u4E0E\u51C0\u503C\u7684\u504F\u5DEE\u539F\u56E0
4. **\u98CE\u9669\u8BC4\u4F30** - \u57FA\u4E8E\u6570\u636E\u7684\u98CE\u9669\u7B49\u7EA7\u8BC4\u4F30
5. **\u603B\u7ED3** - \u4E00\u53E5\u8BDD\u603B\u7ED3`
    }
  ];
}
var init_prompts = __esm({
  "src/services/prompts.js"() {
    __name(LINUS_FINANCIAL_ANALYSIS_PROMPT, "LINUS_FINANCIAL_ANALYSIS_PROMPT");
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = /* @__PURE__ */ __name(class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data2) {
    this.#validatedData[target] = data2;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data2, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data2, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data2, arg, headers) => this.#newResponse(data2, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  };
}, "Context");

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "_Hono");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "_Node");

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
}, "RegExpRouter");

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = /* @__PURE__ */ __name(class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "_Node");

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");

// node_modules/hono/dist/hono.js
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono");

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/index.js
init_db();

// src/services/scheduler.js
init_fund();

// src/services/subscription.js
async function getSubscriptions(db, userId) {
  const result = await db.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return result.results;
}
__name(getSubscriptions, "getSubscriptions");
async function upsertSubscription(db, userId, code, email, thresholdUp, thresholdDown, options = {}) {
  const {
    enableDigest = 0,
    digestTime = "14:45",
    enableVolatility = 1
  } = options;
  await db.prepare(`
    INSERT INTO subscriptions (code, email, user_id, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code, email, user_id) DO UPDATE SET
      threshold_up = excluded.threshold_up,
      threshold_down = excluded.threshold_down,
      enable_digest = excluded.enable_digest,
      digest_time = excluded.digest_time,
      enable_volatility = excluded.enable_volatility
  `).bind(code, email, userId, thresholdUp, thresholdDown, enableDigest, digestTime, enableVolatility).run();
}
__name(upsertSubscription, "upsertSubscription");
async function deleteSubscription(db, userId, subscriptionId) {
  await db.prepare(
    "DELETE FROM subscriptions WHERE id = ? AND user_id = ?"
  ).bind(subscriptionId, userId).run();
}
__name(deleteSubscription, "deleteSubscription");
async function checkSubscriptions(db, env) {
  const result = await db.prepare(
    "SELECT s.*, f.name as fund_name FROM subscriptions s LEFT JOIN funds f ON s.code = f.code"
  ).all();
  const { getCombinedValuation: getCombinedValuation2 } = await Promise.resolve().then(() => (init_fund(), fund_exports));
  for (const sub of result.results) {
    try {
      const valuation = await getCombinedValuation2(db, sub.code);
      if (!valuation || !valuation.estRate)
        continue;
      const estRate = parseFloat(valuation.estRate);
      let shouldNotify = false;
      let reason = "";
      if (sub.threshold_up && estRate >= sub.threshold_up) {
        shouldNotify = true;
        reason = `\u6DA8\u5E45\u8FBE\u5230 ${estRate}%\uFF0C\u8D85\u8FC7\u9608\u503C ${sub.threshold_up}%`;
      } else if (sub.threshold_down && estRate <= -Math.abs(sub.threshold_down)) {
        shouldNotify = true;
        reason = `\u8DCC\u5E45\u8FBE\u5230 ${estRate}%\uFF0C\u8D85\u8FC7\u9608\u503C -${Math.abs(sub.threshold_down)}%`;
      }
      if (shouldNotify) {
        if (sub.last_notified_at) {
          const lastNotified = new Date(sub.last_notified_at);
          if (Date.now() - lastNotified.getTime() < 60 * 60 * 1e3)
            continue;
        }
        const { sendNotificationEmail: sendNotificationEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
        await sendNotificationEmail2(env, sub.email, {
          fundCode: sub.code,
          fundName: sub.fund_name || sub.code,
          estRate,
          reason,
          estimate: valuation.estimate,
          nav: valuation.nav
        });
        await db.prepare(
          "UPDATE subscriptions SET last_notified_at = datetime() WHERE id = ?"
        ).bind(sub.id).run();
      }
    } catch (e) {
      console.error(`Subscription check failed for ${sub.code}: ${e.message}`);
    }
  }
}
__name(checkSubscriptions, "checkSubscriptions");

// src/services/scheduler.js
init_fund();
async function handleScheduled(event, env) {
  const db = env.DB;
  const now = /* @__PURE__ */ new Date();
  const cstHour = (now.getUTCHours() + 8) % 24;
  const cstMinute = now.getUTCMinutes();
  const dayOfWeek = new Date(now.getTime() + 8 * 60 * 60 * 1e3).getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  console.log(`Cron triggered at CST ${cstHour}:${String(cstMinute).padStart(2, "0")} (day=${dayOfWeek})`);
  try {
    if (cstHour === 8 && cstMinute < 10) {
      await dailyTasks(db, env);
    }
    if (isWeekday && cstHour >= 9 && cstHour < 16) {
      await tradingHoursTasks(db, env, cstHour, cstMinute);
    }
    if (isWeekday && cstHour >= 16 && cstHour <= 22) {
      await postMarketTasks(db, env, cstHour);
    }
  } catch (e) {
    console.error(`Scheduled task error: ${e.message}`);
  }
}
__name(handleScheduled, "handleScheduled");
async function dailyTasks(db, env) {
  console.log("Running daily tasks...");
  try {
    await fetchAndUpdateFunds(db);
  } catch (e) {
    console.error(`Fund list update failed: ${e.message}`);
  }
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().slice(0, 10);
    await db.prepare("DELETE FROM fund_intraday_snapshots WHERE date < ?").bind(cutoff).run();
    console.log("Old snapshots cleaned up");
  } catch (e) {
    console.error(`Snapshot cleanup failed: ${e.message}`);
  }
}
__name(dailyTasks, "dailyTasks");
async function tradingHoursTasks(db, env, cstHour, cstMinute) {
  const inTradeSession = cstHour === 9 && cstMinute >= 30 || cstHour === 10 || cstHour === 11 && cstMinute <= 30 || cstHour >= 13 && cstHour < 15;
  if (!inTradeSession)
    return;
  try {
    const positions = await db.prepare(`
      SELECT DISTINCT p.code
      FROM positions p
      JOIN accounts a ON a.id = p.account_id
    `).all();
    const today = new Date(Date.now() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 10);
    const timeStr = `${String(cstHour).padStart(2, "0")}:${String(cstMinute).padStart(2, "0")}`;
    for (const { code } of positions.results) {
      try {
        const valuation = await getCombinedValuation(db, code);
        if (valuation && valuation.estimate > 0) {
          await db.prepare(`
            INSERT OR REPLACE INTO fund_intraday_snapshots (fund_code, date, time, estimate)
            VALUES (?, ?, ?, ?)
          `).bind(code, today, timeStr, valuation.estimate).run();
        }
      } catch (e) {
        console.warn(`Snapshot failed for ${code}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`Intraday collection failed: ${e.message}`);
  }
  try {
    await checkSubscriptions(db, env);
  } catch (e) {
    console.error(`Subscription check failed: ${e.message}`);
  }
}
__name(tradingHoursTasks, "tradingHoursTasks");
async function postMarketTasks(db, env, cstHour) {
  if (cstHour !== 16)
    return;
  console.log("Running post-market tasks...");
  try {
    const today = new Date(Date.now() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 10);
    const pending = await db.prepare(`
      SELECT * FROM transactions
      WHERE applied_at IS NULL AND confirm_date <= ?
      ORDER BY confirm_date
    `).bind(today).all();
    for (const tx of pending.results) {
      try {
        const nav = await getNavOnDate(db, tx.code, tx.confirm_date);
        if (!nav)
          continue;
        if (tx.op_type === "buy") {
          const sharesBought = tx.amount_cny / nav;
          const pos = await db.prepare(
            "SELECT cost, shares FROM positions WHERE account_id = ? AND code = ?"
          ).bind(tx.account_id, tx.code).first();
          const currentCost = pos ? pos.cost : 0;
          const currentShares = pos ? pos.shares : 0;
          const totalCost = currentCost + tx.amount_cny;
          const totalShares = currentShares + sharesBought;
          await db.prepare(`
            INSERT INTO positions (account_id, code, cost, shares, updated_at)
            VALUES (?, ?, ?, ?, datetime())
            ON CONFLICT(account_id, code) DO UPDATE SET
              cost = excluded.cost,
              shares = excluded.shares,
              updated_at = datetime()
          `).bind(tx.account_id, tx.code, totalCost, totalShares).run();
          await db.prepare(`
            UPDATE transactions SET confirm_nav = ?, shares_added = ?, cost_after = ?, applied_at = datetime()
            WHERE id = ?
          `).bind(nav, sharesBought, totalCost, tx.id).run();
        } else if (tx.op_type === "sell") {
          const pos = await db.prepare(
            "SELECT cost, shares FROM positions WHERE account_id = ? AND code = ?"
          ).bind(tx.account_id, tx.code).first();
          if (!pos || pos.shares < tx.shares_redeemed)
            continue;
          const costPerShare = pos.shares > 0 ? pos.cost / pos.shares : 0;
          const costReduced = costPerShare * tx.shares_redeemed;
          const newCost = Math.max(0, pos.cost - costReduced);
          const newShares = pos.shares - tx.shares_redeemed;
          if (newShares <= 1e-3) {
            await db.prepare(
              "DELETE FROM positions WHERE account_id = ? AND code = ?"
            ).bind(tx.account_id, tx.code).run();
          } else {
            await db.prepare(`
              UPDATE positions SET cost = ?, shares = ?, updated_at = datetime()
              WHERE account_id = ? AND code = ?
            `).bind(newCost, newShares, tx.account_id, tx.code).run();
          }
          await db.prepare(`
            UPDATE transactions SET confirm_nav = ?, cost_after = ?, applied_at = datetime()
            WHERE id = ?
          `).bind(nav, newCost, tx.id).run();
        }
      } catch (e) {
        console.error(`Transaction processing failed for tx ${tx.id}: ${e.message}`);
      }
    }
    console.log(`Processed ${pending.results.length} pending transactions`);
  } catch (e) {
    console.error(`Transaction processing failed: ${e.message}`);
  }
}
__name(postMarketTasks, "postMarketTasks");

// src/auth.js
var SESSION_COOKIE_NAME = "session_id";
var SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 1e5;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${iterations}:${saltB64}:${hashB64}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  try {
    const [iterationsStr, saltB64, expectedHashB64] = storedHash.split(":");
    const iterations = parseInt(iterationsStr);
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return hashB64 === expectedHashB64;
  } catch {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
async function hasAdminUser(db) {
  const row = await db.prepare("SELECT COUNT(*) as count FROM users WHERE is_admin = 1").first();
  return row.count > 0;
}
__name(hasAdminUser, "hasAdminUser");
async function createSession(kv, userId) {
  const sessionId = crypto.randomUUID() + "-" + crypto.randomUUID();
  await kv.put(`session:${sessionId}`, JSON.stringify({
    userId,
    createdAt: Date.now()
  }), {
    expirationTtl: SESSION_EXPIRY_SECONDS
  });
  return sessionId;
}
__name(createSession, "createSession");
async function getSessionUser(kv, sessionId) {
  if (!sessionId)
    return null;
  const data2 = await kv.get(`session:${sessionId}`, "json");
  if (!data2)
    return null;
  await kv.put(`session:${sessionId}`, JSON.stringify(data2), {
    expirationTtl: SESSION_EXPIRY_SECONDS
  });
  return data2.userId;
}
__name(getSessionUser, "getSessionUser");
async function deleteSession(kv, sessionId) {
  if (sessionId) {
    await kv.delete(`session:${sessionId}`);
  }
}
__name(deleteSession, "deleteSession");
async function getUserById(db, userId) {
  const row = await db.prepare(
    "SELECT id, username, is_admin FROM users WHERE id = ?"
  ).bind(userId).first();
  if (!row)
    return null;
  return { id: row.id, username: row.username, isAdmin: !!row.is_admin };
}
__name(getUserById, "getUserById");
async function getCurrentUser(c) {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId)
    return null;
  const userId = await getSessionUser(c.env.SESSION_KV, sessionId);
  if (!userId)
    return null;
  return getUserById(c.env.DB, userId);
}
__name(getCurrentUser, "getCurrentUser");
async function verifyAccountOwnership(db, accountId, user) {
  if (!user)
    return false;
  const row = await db.prepare(
    "SELECT user_id FROM accounts WHERE id = ?"
  ).bind(accountId).first();
  if (!row)
    return false;
  return row.user_id === user.id;
}
__name(verifyAccountOwnership, "verifyAccountOwnership");
function getCookie(c, name) {
  const cookieHeader = c.req.header("cookie");
  if (!cookieHeader)
    return null;
  const cookies = cookieHeader.split(";").map((c2) => c2.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key.trim() === name) {
      return valueParts.join("=").trim();
    }
  }
  return null;
}
__name(getCookie, "getCookie");
function setSessionCookie(c, sessionId) {
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_EXPIRY_SECONDS}`
  );
}
__name(setSessionCookie, "setSessionCookie");
function clearSessionCookie(c) {
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
__name(clearSessionCookie, "clearSessionCookie");

// src/routes/auth.js
var auth = new Hono2();
async function getUserDefaultAccountId(db, userId) {
  const settingRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_current_account'"
  ).bind(userId).first();
  if (settingRow && settingRow.value) {
    return parseInt(settingRow.value);
  }
  const acc = await db.prepare(
    "SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1"
  ).bind(userId).first();
  return acc ? acc.id : null;
}
__name(getUserDefaultAccountId, "getUserDefaultAccountId");
auth.get("/init-status", async (c) => {
  const db = c.env.DB;
  const needsInit = !await hasAdminUser(db);
  let needsRebuild = false;
  try {
    const { checkDatabaseVersion: checkDatabaseVersion2, CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const version = await checkDatabaseVersion2(db);
    needsRebuild = version > 0 && version !== CURRENT_SCHEMA_VERSION2;
  } catch {
  }
  return c.json({ needs_init: needsInit, needs_rebuild: needsRebuild });
});
auth.post("/init", async (c) => {
  const db = c.env.DB;
  if (await hasAdminUser(db)) {
    return c.json({ detail: "\u5DF2\u5B58\u5728\u7BA1\u7406\u5458\u7528\u6237" }, 400);
  }
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ detail: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (password.length < 6) {
    return c.json({ detail: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11 6 \u4F4D" }, 400);
  }
  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)"
  ).bind(username, passwordHash).run();
  const userId = result.meta.last_row_id;
  await db.prepare(
    "INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)"
  ).bind("\u9ED8\u8BA4\u8D26\u6237", "\u521D\u59CB\u5316\u521B\u5EFA\u7684\u9ED8\u8BA4\u8D26\u6237", userId).run();
  const { LINUS_FINANCIAL_ANALYSIS_PROMPT: LINUS_FINANCIAL_ANALYSIS_PROMPT2 } = await Promise.resolve().then(() => (init_prompts(), prompts_exports));
  const defaultPrompt = LINUS_FINANCIAL_ANALYSIS_PROMPT2({});
  await db.prepare(
    "INSERT INTO ai_prompts (name, prompt, system_prompt, user_prompt, is_default, user_id) VALUES (?, ?, ?, ?, 1, ?)"
  ).bind("Linus \u98CE\u683C\u5206\u6790", "", defaultPrompt[0].content, defaultPrompt[1].content, userId).run();
  return c.json({
    message: "\u7BA1\u7406\u5458\u521D\u59CB\u5316\u6210\u529F",
    user: { id: userId, username, is_admin: true }
  });
});
auth.get("/registration", async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(
    "SELECT value FROM settings WHERE key = 'REGISTRATION_ENABLED' AND user_id IS NULL"
  ).first();
  const enabled = row ? row.value === "1" || row.value === "true" : false;
  return c.json({ registration_enabled: enabled });
});
auth.get("/mode", async (c) => {
  const db = c.env.DB;
  const multiUserMode = await hasAdminUser(db);
  return c.json({
    environment: c.env.ENVIRONMENT || "production",
    multi_user_mode: multiUserMode
  });
});
auth.post("/login", async (c) => {
  const db = c.env.DB;
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ detail: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const user = await db.prepare(
    "SELECT id, username, password_hash, is_admin FROM users WHERE username = ?"
  ).bind(username).first();
  if (!user || !await verifyPassword(password, user.password_hash)) {
    return c.json({ detail: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const sessionId = await createSession(c.env.SESSION_KV, user.id);
  setSessionCookie(c, sessionId);
  const defaultAccountId = await getUserDefaultAccountId(db, user.id);
  return c.json({
    id: user.id,
    username: user.username,
    is_admin: !!user.is_admin,
    default_account_id: defaultAccountId
  });
});
auth.post("/logout", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const cookieHeader = c.req.header("cookie") || "";
  const match2 = cookieHeader.match(/session_id=([^;]+)/);
  if (match2) {
    await deleteSession(c.env.SESSION_KV, match2[1]);
  }
  clearSessionCookie(c);
  return c.json({ message: "\u5DF2\u767B\u51FA" });
});
auth.post("/register", async (c) => {
  const db = c.env.DB;
  const regRow = await db.prepare(
    "SELECT value FROM settings WHERE key = 'REGISTRATION_ENABLED' AND user_id IS NULL"
  ).first();
  const regEnabled = regRow ? regRow.value === "1" || regRow.value === "true" : false;
  if (!regEnabled) {
    return c.json({ detail: "\u6CE8\u518C\u529F\u80FD\u672A\u5F00\u542F" }, 403);
  }
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ detail: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (password.length < 6) {
    return c.json({ detail: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11 6 \u4F4D" }, 400);
  }
  const existing = await db.prepare(
    "SELECT id FROM users WHERE username = ?"
  ).bind(username).first();
  if (existing) {
    return c.json({ detail: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" }, 400);
  }
  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)"
  ).bind(username, passwordHash).run();
  const userId = result.meta.last_row_id;
  await db.prepare(
    "INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)"
  ).bind("\u9ED8\u8BA4\u8D26\u6237", "", userId).run();
  const sessionId = await createSession(c.env.SESSION_KV, userId);
  setSessionCookie(c, sessionId);
  const defaultAccountId = await getUserDefaultAccountId(db, userId);
  return c.json({
    id: userId,
    username,
    is_admin: false,
    default_account_id: defaultAccountId
  });
});
auth.get("/me", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const defaultAccountId = await getUserDefaultAccountId(db, user.id);
  return c.json({
    id: user.id,
    username: user.username,
    is_admin: user.isAdmin,
    default_account_id: defaultAccountId
  });
});
auth.post("/change-password", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const { old_password, new_password } = await c.req.json();
  if (!old_password || !new_password) {
    return c.json({ detail: "\u65B0\u65E7\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (new_password.length < 6) {
    return c.json({ detail: "\u65B0\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11 6 \u4F4D" }, 400);
  }
  const dbUser = await db.prepare(
    "SELECT password_hash FROM users WHERE id = ?"
  ).bind(user.id).first();
  if (!await verifyPassword(old_password, dbUser.password_hash)) {
    return c.json({ detail: "\u65E7\u5BC6\u7801\u9519\u8BEF" }, 400);
  }
  const newHash = await hashPassword(new_password);
  await db.prepare(
    "UPDATE users SET password_hash = ? WHERE id = ?"
  ).bind(newHash, user.id).run();
  return c.json({ message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" });
});
auth.post("/users", async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  if (!admin.isAdmin)
    return c.json({ detail: "\u6743\u9650\u4E0D\u8DB3" }, 403);
  const db = c.env.DB;
  const { username, password, is_admin = false } = await c.req.json();
  if (!username || !password) {
    return c.json({ detail: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const existing = await db.prepare(
    "SELECT id FROM users WHERE username = ?"
  ).bind(username).first();
  if (existing) {
    return c.json({ detail: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" }, 400);
  }
  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)"
  ).bind(username, passwordHash, is_admin ? 1 : 0).run();
  const userId = result.meta.last_row_id;
  await db.prepare(
    "INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)"
  ).bind("\u9ED8\u8BA4\u8D26\u6237", "", userId).run();
  return c.json({ id: userId, username, is_admin: !!is_admin });
});
auth.get("/users", async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  if (!admin.isAdmin)
    return c.json({ detail: "\u6743\u9650\u4E0D\u8DB3" }, 403);
  const db = c.env.DB;
  const result = await db.prepare(
    "SELECT id, username, is_admin, created_at FROM users ORDER BY id"
  ).all();
  const users = [];
  for (const row of result.results) {
    const defaultAccountId = await getUserDefaultAccountId(db, row.id);
    users.push({
      id: row.id,
      username: row.username,
      is_admin: !!row.is_admin,
      default_account_id: defaultAccountId
    });
  }
  return c.json(users);
});
auth.delete("/users/:id", async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  if (!admin.isAdmin)
    return c.json({ detail: "\u6743\u9650\u4E0D\u8DB3" }, 403);
  const db = c.env.DB;
  const userId = parseInt(c.req.param("id"));
  if (userId === admin.id) {
    return c.json({ detail: "\u4E0D\u80FD\u5220\u9664\u81EA\u5DF1" }, 400);
  }
  await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  return c.json({ message: "\u7528\u6237\u5DF2\u5220\u9664" });
});
auth.post("/registration", async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  if (!admin.isAdmin)
    return c.json({ detail: "\u6743\u9650\u4E0D\u8DB3" }, 403);
  const db = c.env.DB;
  const { enabled } = await c.req.json();
  await db.prepare(`
    INSERT INTO settings (key, value, user_id, updated_at)
    VALUES ('REGISTRATION_ENABLED', ?, NULL, datetime())
    ON CONFLICT(key, user_id) DO UPDATE SET
      value = excluded.value, updated_at = datetime()
  `).bind(enabled ? "1" : "0").run();
  return c.json({ registration_enabled: !!enabled });
});
var auth_default = auth;

// src/routes/funds.js
init_fund();
var funds = new Hono2();
funds.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q)
    return c.json([]);
  const results = await searchFunds(c.env.DB, q);
  return c.json(results);
});
funds.get("/fund/:id", async (c) => {
  const fundId = c.req.param("id");
  try {
    const data2 = await getFundIntraday(c.env.DB, fundId);
    return c.json(data2);
  } catch (e) {
    console.error(`Fund detail error for ${fundId}: ${e.message}`);
    return c.json({ detail: `\u83B7\u53D6\u57FA\u91D1\u8BE6\u60C5\u5931\u8D25: ${e.message}` }, 500);
  }
});
funds.get("/fund/:id/history", async (c) => {
  const fundId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "30");
  try {
    const history = await getFundHistory(c.env.DB, fundId, limit);
    return c.json(history);
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
funds.get("/fund/:id/intraday", async (c) => {
  const fundId = c.req.param("id");
  const db = c.env.DB;
  try {
    const today = new Date(Date.now() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 10);
    const result = await db.prepare(
      "SELECT time, estimate FROM fund_intraday_snapshots WHERE fund_code = ? AND date = ? ORDER BY time"
    ).bind(fundId, today).all();
    return c.json(result.results.map((r) => ({
      time: r.time,
      estimate: r.estimate
    })));
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
funds.get("/fund/:id/backtest", async (c) => {
  const fundId = c.req.param("id");
  const period = parseInt(c.req.query("period") || "30");
  const db = c.env.DB;
  try {
    const history = await getFundHistory(db, fundId, period);
    if (!history || history.length === 0) {
      return c.json({ detail: "\u65E0\u5386\u53F2\u6570\u636E" }, 404);
    }
    const indicators = calculateTechnicalIndicators(history);
    const chartData = history.map((item) => ({
      date: item.date,
      nav: item.nav
    }));
    const startNav = history[0].nav;
    const endNav = history[history.length - 1].nav;
    const totalReturn = ((endNav - startNav) / startNav * 100).toFixed(2);
    return c.json({
      period,
      total_return: `${totalReturn}%`,
      start_nav: startNav,
      end_nav: endNav,
      data_points: history.length,
      indicators,
      chart_data: chartData
    });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
funds.post("/fund/:id/subscribe", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const fundId = c.req.param("id");
  const body = await c.req.json();
  const { email, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility } = body;
  if (!email)
    return c.json({ detail: "\u90AE\u7BB1\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  try {
    await upsertSubscription(c.env.DB, user.id, fundId, email, threshold_up, threshold_down, {
      enableDigest: enable_digest ? 1 : 0,
      digestTime: digest_time || "14:45",
      enableVolatility: enable_volatility !== false ? 1 : 0
    });
    return c.json({ status: "ok", message: "\u8BA2\u9605\u5DF2\u6FC0\u6D3B" });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
funds.get("/subscriptions", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const subs = await getSubscriptions(c.env.DB, user.id);
  return c.json(subs);
});
funds.delete("/subscriptions/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const subId = parseInt(c.req.param("id"));
  await deleteSubscription(c.env.DB, user.id, subId);
  return c.json({ message: "\u5DF2\u53D6\u6D88\u8BA2\u9605" });
});
funds.get("/categories", async (c) => {
  const categories = ["\u504F\u80A1\u7C7B", "\u504F\u503A\u7C7B", "\u8D27\u5E01\u7C7B", "\u5546\u54C1\u7C7B", "\u672A\u5206\u7C7B"];
  return c.json(categories);
});
var funds_default = funds;

// src/services/account.js
async function getUserAccounts(db, userId) {
  const result = await db.prepare(
    "SELECT id, name, description, created_at, updated_at FROM accounts WHERE user_id = ? ORDER BY id"
  ).bind(userId).all();
  return result.results;
}
__name(getUserAccounts, "getUserAccounts");
async function createAccount(db, userId, name, description = "") {
  const result = await db.prepare(
    "INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)"
  ).bind(name, description || "", userId).run();
  return result.meta.last_row_id;
}
__name(createAccount, "createAccount");
async function updateAccount(db, accountId, name, description) {
  await db.prepare(
    "UPDATE accounts SET name = ?, description = ?, updated_at = datetime() WHERE id = ?"
  ).bind(name, description || "", accountId).run();
}
__name(updateAccount, "updateAccount");
async function deleteAccount(db, accountId) {
  const posCount = await db.prepare(
    "SELECT COUNT(*) as cnt FROM positions WHERE account_id = ?"
  ).bind(accountId).first();
  if (posCount.cnt > 0) {
    throw new Error("\u8BE5\u8D26\u6237\u4E0B\u4ECD\u6709\u6301\u4ED3\uFF0C\u8BF7\u5148\u6E05\u7A7A\u6301\u4ED3\u540E\u518D\u5220\u9664");
  }
  await db.prepare("DELETE FROM accounts WHERE id = ?").bind(accountId).run();
}
__name(deleteAccount, "deleteAccount");
async function getPositions(db, accountId) {
  const result = await db.prepare(
    "SELECT code, cost, shares, updated_at FROM positions WHERE account_id = ? ORDER BY code"
  ).bind(accountId).all();
  return result.results;
}
__name(getPositions, "getPositions");
async function getAggregatePositions(db, userId) {
  const result = await db.prepare(`
    SELECT p.code, p.cost, p.shares, p.account_id, p.updated_at, a.name as account_name
    FROM positions p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.user_id = ?
    ORDER BY p.code
  `).bind(userId).all();
  return result.results;
}
__name(getAggregatePositions, "getAggregatePositions");
async function upsertPosition(db, accountId, code, cost, shares) {
  await db.prepare(`
    INSERT INTO positions (account_id, code, cost, shares, updated_at)
    VALUES (?, ?, ?, ?, datetime())
    ON CONFLICT(account_id, code) DO UPDATE SET
      cost = excluded.cost,
      shares = excluded.shares,
      updated_at = datetime()
  `).bind(accountId, code, cost, shares).run();
}
__name(upsertPosition, "upsertPosition");
async function removePosition(db, accountId, code) {
  await db.prepare(
    "DELETE FROM positions WHERE account_id = ? AND code = ?"
  ).bind(accountId, code).run();
}
__name(removePosition, "removePosition");
async function addTrade(db, accountId, code, amountCny, tradeTime = null) {
  const now = /* @__PURE__ */ new Date();
  const confirmDate = getConfirmDate(tradeTime ? new Date(tradeTime) : now);
  await db.prepare(`
    INSERT INTO transactions (account_id, code, op_type, amount_cny, confirm_date)
    VALUES (?, ?, 'buy', ?, ?)
  `).bind(accountId, code, amountCny, confirmDate).run();
  return { confirm_date: confirmDate, message: `\u52A0\u4ED3 \xA5${amountCny}\uFF0C\u786E\u8BA4\u65E5: ${confirmDate}` };
}
__name(addTrade, "addTrade");
async function reduceTrade(db, accountId, code, shares, tradeTime = null) {
  const position = await db.prepare(
    "SELECT shares FROM positions WHERE account_id = ? AND code = ?"
  ).bind(accountId, code).first();
  if (!position || position.shares < shares) {
    throw new Error("\u6301\u4ED3\u4EFD\u989D\u4E0D\u8DB3");
  }
  const now = /* @__PURE__ */ new Date();
  const confirmDate = getConfirmDate(tradeTime ? new Date(tradeTime) : now);
  await db.prepare(`
    INSERT INTO transactions (account_id, code, op_type, shares_redeemed, confirm_date)
    VALUES (?, ?, 'sell', ?, ?)
  `).bind(accountId, code, shares, confirmDate).run();
  return { confirm_date: confirmDate, message: `\u51CF\u4ED3 ${shares} \u4EFD\uFF0C\u786E\u8BA4\u65E5: ${confirmDate}` };
}
__name(reduceTrade, "reduceTrade");
async function getTransactions(db, accountId, code = null, limit = 100) {
  let query = "SELECT * FROM transactions WHERE account_id = ?";
  const params = [accountId];
  if (code) {
    query += " AND code = ?";
    params.push(code);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const stmt = db.prepare(query);
  const result = await stmt.bind(...params).all();
  return result.results;
}
__name(getTransactions, "getTransactions");
function getConfirmDate(submitDate) {
  const d = new Date(submitDate);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}
__name(getConfirmDate, "getConfirmDate");

// src/routes/account.js
init_fund();
var account = new Hono2();
account.get("/accounts", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accounts = await getUserAccounts(c.env.DB, user.id);
  return c.json(accounts);
});
account.post("/accounts", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const { name, description } = await c.req.json();
  if (!name)
    return c.json({ detail: "\u8D26\u6237\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  try {
    const id = await createAccount(c.env.DB, user.id, name, description);
    return c.json({ id, name, description, message: "\u8D26\u6237\u521B\u5EFA\u6210\u529F" });
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});
account.put("/accounts/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.param("id"));
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const { name, description } = await c.req.json();
  await updateAccount(c.env.DB, accountId, name, description);
  return c.json({ message: "\u8D26\u6237\u5DF2\u66F4\u65B0" });
});
account.delete("/accounts/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.param("id"));
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  try {
    await deleteAccount(c.env.DB, accountId);
    return c.json({ message: "\u8D26\u6237\u5DF2\u5220\u9664" });
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});
account.get("/positions/aggregate", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const positions = await getAggregatePositions(db, user.id);
  const enriched = [];
  for (const pos of positions) {
    try {
      const valuation = await getCombinedValuation(db, pos.code);
      const fundRow = await db.prepare("SELECT name, type FROM funds WHERE code = ?").bind(pos.code).first();
      const name = valuation.name || fundRow?.name || pos.code;
      const type = fundRow?.type || "";
      const category = getFundCategory(type);
      const nav = parseFloat(valuation.nav || 0);
      const estimate = parseFloat(valuation.estimate || 0);
      const estRate = parseFloat(valuation.estRate || 0);
      const shares = parseFloat(pos.shares || 0);
      const cost = parseFloat(pos.cost || 0);
      const marketValue = estimate > 0 ? estimate * shares : nav * shares;
      const totalReturn = cost > 0 ? (marketValue - cost) / cost * 100 : 0;
      enriched.push({
        code: pos.code,
        name,
        type,
        category,
        cost,
        shares,
        nav,
        estimate,
        estRate,
        marketValue: Math.round(marketValue * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        time: valuation.time || "--",
        account_id: pos.account_id,
        account_name: pos.account_name
      });
    } catch (e) {
      enriched.push({
        code: pos.code,
        name: pos.code,
        cost: pos.cost,
        shares: pos.shares,
        error: e.message,
        account_id: pos.account_id,
        account_name: pos.account_name
      });
    }
  }
  return c.json(enriched);
});
account.get("/positions", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const positions = await getPositions(c.env.DB, accountId);
  return c.json(positions);
});
account.put("/positions", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const { code, cost, shares } = await c.req.json();
  if (!code)
    return c.json({ detail: "\u57FA\u91D1\u4EE3\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  await upsertPosition(c.env.DB, accountId, code, cost, shares);
  return c.json({ message: "\u6301\u4ED3\u5DF2\u66F4\u65B0" });
});
account.delete("/positions/:code", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const code = c.req.param("code");
  await removePosition(c.env.DB, accountId, code);
  return c.json({ message: "\u6301\u4ED3\u5DF2\u5220\u9664" });
});
account.post("/positions/update-nav", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const db = c.env.DB;
  const positions = await getPositions(db, accountId);
  let updated = 0;
  let failed = 0;
  const errors = [];
  for (const pos of positions) {
    try {
      const history = await getFundHistory(db, pos.code, 5);
      if (history.length > 0)
        updated++;
      else
        failed++;
    } catch (e) {
      failed++;
      errors.push(`${pos.code}: ${e.message}`);
    }
  }
  return c.json({
    message: `\u51C0\u503C\u66F4\u65B0\u5B8C\u6210: ${updated} \u6210\u529F, ${failed} \u5931\u8D25`,
    updated,
    failed,
    errors: errors.length > 0 ? errors : void 0
  });
});
account.post("/trade/:code/buy", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const code = c.req.param("code");
  const { amount, trade_time } = await c.req.json();
  if (!amount || amount <= 0)
    return c.json({ detail: "\u52A0\u4ED3\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0" }, 400);
  try {
    const result = await addTrade(c.env.DB, accountId, code, amount, trade_time);
    return c.json(result);
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});
account.post("/trade/:code/sell", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const code = c.req.param("code");
  const { shares, trade_time } = await c.req.json();
  if (!shares || shares <= 0)
    return c.json({ detail: "\u51CF\u4ED3\u4EFD\u989D\u5FC5\u987B\u5927\u4E8E 0" }, 400);
  try {
    const result = await reduceTrade(c.env.DB, accountId, code, shares, trade_time);
    return c.json(result);
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});
account.get("/transactions", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const accountId = parseInt(c.req.query("account_id"));
  if (!accountId)
    return c.json({ detail: "\u9700\u8981 account_id \u53C2\u6570" }, 400);
  if (!await verifyAccountOwnership(c.env.DB, accountId, user)) {
    return c.json({ detail: "\u65E0\u6743\u64CD\u4F5C\u6B64\u8D26\u6237" }, 403);
  }
  const code = c.req.query("code") || null;
  const limit = parseInt(c.req.query("limit") || "100");
  const transactions = await getTransactions(c.env.DB, accountId, code, limit);
  return c.json(transactions);
});
var account_default = account;

// src/services/ai.js
init_crypto();
init_prompts();
init_fund();
var AIService = class {
  /**
   * Get AI settings for a user
   */
  async getAISettings(db, env, userId) {
    const loadSettings = /* @__PURE__ */ __name(async (targetUserId) => {
      let rows = [];
      if (targetUserId == null) {
        const result = await db.prepare(
          "SELECT key, value, encrypted FROM settings WHERE user_id IS NULL"
        ).all();
        rows = result.results || [];
      } else {
        const result = await db.prepare(
          "SELECT key, value, encrypted FROM settings WHERE user_id = ?"
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
    }, "loadSettings");
    const globalSettings = await loadSettings(null);
    let adminSettings = {};
    if (userId != null) {
      const adminRow = await db.prepare(
        "SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1"
      ).first();
      if (adminRow?.id && adminRow.id !== userId) {
        adminSettings = await loadSettings(adminRow.id);
      }
    }
    const userSettings = userId != null ? await loadSettings(userId) : {};
    const settings2 = { ...globalSettings, ...adminSettings, ...userSettings };
    return {
      apiBase: env.OPENAI_API_BASE || settings2.OPENAI_API_BASE || "https://integrate.api.nvidia.com/v1",
      apiKey: env.OPENAI_API_KEY || settings2.OPENAI_API_KEY || "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",
      model: env.AI_MODEL_NAME || settings2.AI_MODEL_NAME || "deepseek-ai/deepseek-v3.2"
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
          "SELECT system_prompt, user_prompt FROM ai_prompts WHERE id = ? AND user_id IS NULL"
        ).bind(promptId).first();
      } else {
        row = await db.prepare(
          "SELECT system_prompt, user_prompt FROM ai_prompts WHERE id = ? AND user_id = ?"
        ).bind(promptId, userId).first();
      }
    } else {
      if (userId == null) {
        row = await db.prepare(
          "SELECT system_prompt, user_prompt FROM ai_prompts WHERE is_default = 1 AND user_id IS NULL LIMIT 1"
        ).first();
      } else {
        row = await db.prepare(
          "SELECT system_prompt, user_prompt FROM ai_prompts WHERE is_default = 1 AND user_id = ? LIMIT 1"
        ).bind(userId).first();
      }
    }
    if (!row)
      return null;
    return { systemPrompt: row.system_prompt, userPrompt: row.user_prompt };
  }
  /**
   * Search news via DuckDuckGo
   */
  async searchNews(query) {
    try {
      const resp = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&t=fundval`,
        { headers: { "User-Agent": "FundVal-Live/1.0" } }
      );
      const data2 = await resp.json();
      if (!data2.RelatedTopics || data2.RelatedTopics.length === 0) {
        return "\u6682\u65E0\u76F8\u5173\u8FD1\u671F\u65B0\u95FB\u3002";
      }
      return data2.RelatedTopics.slice(0, 5).map((t, i) => `${i + 1}. ${t.Text || ""}`).join("\n");
    } catch {
      return "\u65B0\u95FB\u641C\u7D22\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\u3002";
    }
  }
  /**
   * Calculate simple indicators
   */
  calculateIndicators(history) {
    if (!history || history.length < 5) {
      return { status: "\u6570\u636E\u4E0D\u8DB3", desc: "\u65B0\u57FA\u91D1\u6216\u6570\u636E\u7F3A\u5931" };
    }
    const navs = history.map((h) => h.nav);
    const current = navs[navs.length - 1];
    const max = Math.max(...navs);
    const min = Math.min(...navs);
    const avg = navs.reduce((a, b) => a + b, 0) / navs.length;
    const position = max > min ? (current - min) / (max - min) : 0.5;
    let status = "\u6B63\u5E38";
    if (position > 0.9)
      status = "\u9AD8\u4F4D";
    else if (position < 0.1)
      status = "\u4F4E\u4F4D";
    else if (current > avg * 1.05)
      status = "\u504F\u9AD8";
    else if (current < avg * 0.95)
      status = "\u504F\u4F4E";
    const posLabel = position > 0.8 ? "\u9AD8\u4F4D" : position < 0.2 ? "\u4F4E\u4F4D" : "\u4E2D\u4F4D";
    return {
      status,
      desc: `\u8FD130\u65E5\u6700\u9AD8${max.toFixed(4)}, \u6700\u4F4E${min.toFixed(4)}, \u73B0\u4EF7\u5904\u4E8E${posLabel}\u533A\u95F4 (${Math.round(position * 100)}%)`
    };
  }
  /**
   * Analyze fund using LLM
   */
  async analyzeFund(db, env, fundInfo, promptId = null, userId = null) {
    const settings2 = await this.getAISettings(db, env, userId);
    if (!settings2.apiKey) {
      return {
        markdown: "## \u914D\u7F6E\u9519\u8BEF\n\n\u672A\u914D\u7F6E OpenAI API Key\uFF0C\u8BF7\u524D\u5F80\u8BBE\u7F6E\u9875\u9762\u914D\u7F6E\u3002",
        indicators: { status: "\u672A\u77E5", desc: "\u65E0\u6CD5\u5206\u6790" },
        timestamp: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)
      };
    }
    const fundId = fundInfo.id;
    const fundName = fundInfo.name || "\u672A\u77E5\u57FA\u91D1";
    const fundDetail = await getFundIntraday(db, fundId);
    const techData = fundDetail.indicators?.technical || {};
    const history = await getFundHistory(db, fundId, 250);
    const indicators = this.calculateIndicators(
      history.length >= 30 ? history.slice(0, 30) : history
    );
    let historySummary = "\u6682\u65E0\u5386\u53F2\u6570\u636E";
    if (history.length > 0) {
      const recent = history.slice(0, 30);
      historySummary = `\u8FD130\u65E5\u8D70\u52BF: \u8D77\u59CB${recent[0].nav} -> \u7ED3\u675F${recent[recent.length - 1].nav}. ${indicators.desc}`;
    }
    let holdingsStr = "";
    if (fundDetail.holdings && fundDetail.holdings.length > 0) {
      holdingsStr = fundDetail.holdings.slice(0, 10).map((h) => `- ${h.name}: ${h.percent}% (\u6DA8\u8DCC: ${h.change >= 0 ? "+" : ""}${h.change.toFixed(2)}%)`).join("\n");
    }
    const variables = {
      fund_code: fundId,
      fund_name: fundName,
      fund_type: fundDetail.type || "\u672A\u77E5",
      manager: fundDetail.manager || "\u672A\u77E5",
      nav: fundDetail.nav || "--",
      estimate: fundDetail.estimate || "--",
      est_rate: `${fundDetail.estRate || 0}%`,
      concentration: fundDetail.indicators?.concentration || "--",
      holdings: holdingsStr || "\u6682\u65E0\u6301\u4ED3\u6570\u636E",
      sharpe: techData.sharpe || "--",
      volatility: techData.volatility || "--",
      max_drawdown: techData.max_drawdown || "--",
      annual_return: techData.annual_return || "--",
      history_summary: historySummary
    };
    const customPrompt = await this.getPromptTemplate(db, promptId, userId);
    let messages;
    if (customPrompt && customPrompt.systemPrompt && customPrompt.userPrompt) {
      messages = [
        { role: "system", content: this.replaceVariables(customPrompt.systemPrompt, variables) },
        { role: "user", content: this.replaceVariables(customPrompt.userPrompt, variables) }
      ];
    } else {
      messages = LINUS_FINANCIAL_ANALYSIS_PROMPT(variables);
    }
    try {
      const apiUrl = `${settings2.apiBase.replace(/\/$/, "")}/chat/completions`;
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings2.apiKey}`
        },
        body: JSON.stringify({
          model: settings2.model,
          messages,
          temperature: 0.3,
          max_tokens: 4096
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API returned ${resp.status}: ${errText}`);
      }
      const result = await resp.json();
      let markdown = result.choices?.[0]?.message?.content || "";
      markdown = markdown.trim();
      if (markdown.includes("```markdown")) {
        markdown = markdown.split("```markdown")[1].split("```")[0].trim();
      } else if (markdown.startsWith("```") && markdown.endsWith("```")) {
        markdown = markdown.slice(3, -3).trim();
      }
      await this.saveAnalysisHistory(db, {
        userId,
        accountId: fundInfo.account_id || 1,
        fundCode: fundId,
        fundName,
        promptId,
        promptName: await this.getPromptName(db, promptId, userId),
        markdown,
        indicatorsJson: JSON.stringify(indicators),
        status: "success"
      });
      return {
        markdown,
        indicators,
        timestamp: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)
      };
    } catch (e) {
      console.error(`AI Analysis Error: ${e.message}`);
      const errorMarkdown = `## \u5206\u6790\u5931\u8D25

LLM \u8C03\u7528\u5931\u8D25: ${e.message}

\u8BF7\u68C0\u67E5 API \u914D\u7F6E\u548C\u63D0\u793A\u8BCD\u683C\u5F0F\u3002`;
      await this.saveAnalysisHistory(db, {
        userId,
        accountId: fundInfo.account_id || 1,
        fundCode: fundId,
        fundName,
        promptId,
        promptName: await this.getPromptName(db, promptId, userId),
        markdown: errorMarkdown,
        indicatorsJson: JSON.stringify(indicators),
        status: "failed",
        errorMessage: e.message
      });
      return {
        markdown: errorMarkdown,
        indicators,
        timestamp: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)
      };
    }
  }
  /**
   * Replace template variables in prompt
   */
  replaceVariables(template, variables) {
    return template.replace(/\{(\w+)\}/g, (match2, key) => {
      return variables[key] !== void 0 ? String(variables[key]) : match2;
    });
  }
  async getPromptName(db, promptId, userId) {
    if (!promptId)
      return "\u9ED8\u8BA4\u63D0\u793A\u8BCD";
    let row;
    if (userId == null) {
      row = await db.prepare("SELECT name FROM ai_prompts WHERE id = ? AND user_id IS NULL").bind(promptId).first();
    } else {
      row = await db.prepare("SELECT name FROM ai_prompts WHERE id = ? AND user_id = ?").bind(promptId, userId).first();
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
          "SELECT COUNT(*) as cnt FROM ai_analysis_history WHERE user_id IS NULL AND account_id = ? AND fund_code = ?"
        ).bind(accountId, fundCode).first();
      } else {
        countRow = await db.prepare(
          "SELECT COUNT(*) as cnt FROM ai_analysis_history WHERE user_id = ? AND account_id = ? AND fund_code = ?"
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
};
__name(AIService, "AIService");
var aiService = new AIService();

// src/routes/ai.js
var ai = new Hono2();
ai.post("/chat", async (c) => {
  const multiUserMode = await hasAdminUser(c.env.DB);
  const user = await getCurrentUser(c);
  if (multiUserMode && !user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const body = await c.req.json();
  const { messages, stream, temperature, max_tokens, top_p } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ detail: "messages \u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  let settings2 = { apiBase: "", apiKey: "", model: "" };
  try {
    settings2 = await aiService.getAISettings(c.env.DB, c.env, user?.id ?? null);
  } catch {
    settings2 = { apiBase: "", apiKey: "", model: "" };
  }
  const apiBase = (c.env.NVIDIA_API_BASE || settings2.apiBase || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const apiKey = c.env.NVIDIA_API_KEY || settings2.apiKey;
  const model = c.env.NVIDIA_MODEL || settings2.model || "meta/llama-3.1-70b-instruct";
  if (!apiKey) {
    return c.json({ detail: "\u672A\u914D\u7F6E NVIDIA_API_KEY\u3002\u4E5F\u53EF\u5728 \u7CFB\u7EDF\u8BBE\u7F6E \u2192 AI \u914D\u7F6E \u4E2D\u586B\u5199 OPENAI_API_KEY\uFF08\u53EF\u76F4\u63A5\u586B NVIDIA Key\uFF09\u540E\u91CD\u8BD5\u3002" }, 500);
  }
  const resp = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: !!stream,
      temperature: typeof temperature === "number" ? temperature : 0.2,
      top_p: typeof top_p === "number" ? top_p : 0.9,
      max_tokens: typeof max_tokens === "number" ? max_tokens : 2048
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return c.json({ detail: errText || `\u4E0A\u6E38\u8FD4\u56DE ${resp.status}` }, 500);
  }
  if (stream) {
    return new Response(resp.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  }
  const data2 = await resp.json();
  return c.json(data2);
});
ai.post("/analyze", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const body = await c.req.json();
  const { fund_id, fund_name, prompt_id, account_id } = body;
  if (!fund_id)
    return c.json({ detail: "\u9700\u8981\u6307\u5B9A\u57FA\u91D1\u4EE3\u7801" }, 400);
  try {
    const result = await aiService.analyzeFund(c.env.DB, c.env, {
      id: fund_id,
      name: fund_name,
      account_id: account_id || 1
    }, prompt_id, user.id);
    return c.json(result);
  } catch (e) {
    console.error(`AI analysis error: ${e.message}`);
    return c.json({ detail: e.message }, 500);
  }
});
ai.get("/history", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const accountId = c.req.query("account_id");
  const fundCode = c.req.query("fund_code");
  const limit = parseInt(c.req.query("limit") || "10");
  let query = "SELECT * FROM ai_analysis_history WHERE user_id = ?";
  const params = [user.id];
  if (accountId) {
    query += " AND account_id = ?";
    params.push(parseInt(accountId));
  }
  if (fundCode) {
    query += " AND fund_code = ?";
    params.push(fundCode);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const result = await db.prepare(query).bind(...params).all();
  return c.json(result.results);
});
ai.delete("/history/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const historyId = parseInt(c.req.param("id"));
  await c.env.DB.prepare(
    "DELETE FROM ai_analysis_history WHERE id = ? AND user_id = ?"
  ).bind(historyId, user.id).run();
  return c.json({ message: "\u5DF2\u5220\u9664" });
});
ai.get("/prompts", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const result = await c.env.DB.prepare(
    "SELECT id, name, system_prompt, user_prompt, is_default, created_at, updated_at FROM ai_prompts WHERE user_id = ? ORDER BY is_default DESC, id"
  ).bind(user.id).all();
  return c.json(result.results);
});
ai.post("/prompts", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const { name, system_prompt, user_prompt, is_default } = await c.req.json();
  if (!name)
    return c.json({ detail: "\u63D0\u793A\u8BCD\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  const db = c.env.DB;
  if (is_default) {
    await db.prepare(
      "UPDATE ai_prompts SET is_default = 0 WHERE user_id = ?"
    ).bind(user.id).run();
  }
  const result = await db.prepare(
    "INSERT INTO ai_prompts (name, prompt, system_prompt, user_prompt, is_default, user_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(name, "", system_prompt || "", user_prompt || "", is_default ? 1 : 0, user.id).run();
  return c.json({ id: result.meta.last_row_id, message: "\u63D0\u793A\u8BCD\u5DF2\u521B\u5EFA" });
});
ai.put("/prompts/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const promptId = parseInt(c.req.param("id"));
  const { name, system_prompt, user_prompt, is_default } = await c.req.json();
  const db = c.env.DB;
  if (is_default) {
    await db.prepare(
      "UPDATE ai_prompts SET is_default = 0 WHERE user_id = ?"
    ).bind(user.id).run();
  }
  await db.prepare(
    "UPDATE ai_prompts SET name = ?, system_prompt = ?, user_prompt = ?, is_default = ?, updated_at = datetime() WHERE id = ? AND user_id = ?"
  ).bind(name, system_prompt || "", user_prompt || "", is_default ? 1 : 0, promptId, user.id).run();
  return c.json({ message: "\u63D0\u793A\u8BCD\u5DF2\u66F4\u65B0" });
});
ai.delete("/prompts/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const promptId = parseInt(c.req.param("id"));
  await c.env.DB.prepare(
    "DELETE FROM ai_prompts WHERE id = ? AND user_id = ?"
  ).bind(promptId, user.id).run();
  return c.json({ message: "\u63D0\u793A\u8BCD\u5DF2\u5220\u9664" });
});
var ai_default = ai;

// src/routes/settings.js
init_crypto();
var settings = new Hono2();
var ENCRYPTED_FIELDS = /* @__PURE__ */ new Set(["OPENAI_API_KEY", "SMTP_PASSWORD"]);
function validateEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}
__name(validateEmail, "validateEmail");
function validateUrl(url) {
  return /^https?:\/\/\S+$/.test(url);
}
__name(validateUrl, "validateUrl");
function validatePort(port) {
  const p = parseInt(port);
  return !isNaN(p) && p >= 1 && p <= 65535;
}
__name(validatePort, "validatePort");
settings.get("/settings", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const result = await db.prepare(
    "SELECT key, value, encrypted FROM settings WHERE user_id = ?"
  ).bind(user.id).all();
  const settingsObj = {};
  for (const row of result.results) {
    if (row.encrypted && row.value) {
      settingsObj[row.key] = "***";
    } else {
      settingsObj[row.key] = row.value;
    }
  }
  if (Object.keys(settingsObj).length === 0) {
    return c.json({
      settings: {
        OPENAI_API_KEY: "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",
        OPENAI_API_BASE: "https://integrate.api.nvidia.com/v1",
        AI_MODEL_NAME: "deepseek-ai/deepseek-v3.2",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "587",
        SMTP_USER: "",
        SMTP_PASSWORD: "",
        EMAIL_FROM: ""
      }
    });
  }
  return c.json({ settings: settingsObj });
});
settings.post("/settings", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const body = await c.req.json();
  const settingsData = body.settings || {};
  const errors = {};
  if ("SMTP_PORT" in settingsData && settingsData.SMTP_PORT) {
    if (!validatePort(settingsData.SMTP_PORT)) {
      errors.SMTP_PORT = "\u7AEF\u53E3\u5FC5\u987B\u5728 1-65535 \u4E4B\u95F4";
    }
  }
  if ("SMTP_USER" in settingsData && settingsData.SMTP_USER) {
    if (!validateEmail(settingsData.SMTP_USER)) {
      errors.SMTP_USER = "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E";
    }
  }
  if ("EMAIL_FROM" in settingsData && settingsData.EMAIL_FROM) {
    if (!validateEmail(settingsData.EMAIL_FROM)) {
      errors.EMAIL_FROM = "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E";
    }
  }
  if ("OPENAI_API_BASE" in settingsData && settingsData.OPENAI_API_BASE) {
    if (!validateUrl(settingsData.OPENAI_API_BASE)) {
      errors.OPENAI_API_BASE = "URL \u683C\u5F0F\u4E0D\u6B63\u786E";
    }
  }
  if (Object.keys(errors).length > 0) {
    return c.json({ detail: { errors } }, 400);
  }
  const db = c.env.DB;
  for (const [key, value] of Object.entries(settingsData)) {
    if (value === "***")
      continue;
    const encrypted = ENCRYPTED_FIELDS.has(key) ? 1 : 0;
    let storedValue = value;
    if (encrypted && value) {
      storedValue = await encryptValue(value, c.env);
    }
    await db.prepare(`
      INSERT INTO settings (key, value, encrypted, user_id, updated_at)
      VALUES (?, ?, ?, ?, datetime())
      ON CONFLICT(key, user_id) DO UPDATE SET
        value = excluded.value,
        encrypted = excluded.encrypted,
        updated_at = datetime()
    `).bind(key, storedValue, encrypted, user.id).run();
  }
  return c.json({ message: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58" });
});
settings.get("/preferences", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const watchlistRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_watchlist'"
  ).bind(user.id).first();
  const accountRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_current_account'"
  ).bind(user.id).first();
  const sortRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_sort_option'"
  ).bind(user.id).first();
  return c.json({
    watchlist: watchlistRow?.value || "[]",
    currentAccount: accountRow ? parseInt(accountRow.value) : 1,
    sortOption: sortRow?.value || null
  });
});
settings.post("/preferences", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const db = c.env.DB;
  const data2 = await c.req.json();
  const upsertPref = /* @__PURE__ */ __name(async (key, value) => {
    await db.prepare(`
      INSERT INTO settings (key, value, encrypted, user_id, updated_at)
      VALUES (?, ?, 0, ?, datetime())
      ON CONFLICT(key, user_id) DO UPDATE SET
        value = excluded.value, updated_at = datetime()
    `).bind(key, String(value), user.id).run();
  }, "upsertPref");
  if ("watchlist" in data2)
    await upsertPref("user_watchlist", data2.watchlist);
  if ("currentAccount" in data2)
    await upsertPref("user_current_account", data2.currentAccount);
  if ("sortOption" in data2)
    await upsertPref("user_sort_option", data2.sortOption);
  return c.json({ message: "\u504F\u597D\u5DF2\u4FDD\u5B58" });
});
var settings_default = settings;

// src/services/data-io.js
async function exportData(db, modules, user) {
  const data2 = { version: 1, exported_at: (/* @__PURE__ */ new Date()).toISOString(), modules: {} };
  for (const mod of modules) {
    switch (mod) {
      case "accounts": {
        const result = await db.prepare(
          "SELECT id, name, description, created_at, updated_at FROM accounts WHERE user_id = ?"
        ).bind(user.id).all();
        data2.modules.accounts = result.results;
        break;
      }
      case "positions": {
        const result = await db.prepare(`
          SELECT p.account_id, p.code, p.cost, p.shares, p.updated_at, a.name as account_name
          FROM positions p
          JOIN accounts a ON a.id = p.account_id
          WHERE a.user_id = ?
        `).bind(user.id).all();
        data2.modules.positions = result.results;
        break;
      }
      case "transactions": {
        const result = await db.prepare(`
          SELECT t.*
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
          WHERE a.user_id = ?
          ORDER BY t.created_at DESC
        `).bind(user.id).all();
        data2.modules.transactions = result.results;
        break;
      }
      case "ai_prompts": {
        const result = await db.prepare(
          "SELECT id, name, prompt, system_prompt, user_prompt, is_default, created_at, updated_at FROM ai_prompts WHERE user_id = ?"
        ).bind(user.id).all();
        data2.modules.ai_prompts = result.results;
        break;
      }
      case "subscriptions": {
        const result = await db.prepare(
          "SELECT * FROM subscriptions WHERE user_id = ?"
        ).bind(user.id).all();
        data2.modules.subscriptions = result.results;
        break;
      }
      case "settings": {
        const result = await db.prepare(
          "SELECT key, value, encrypted FROM settings WHERE user_id = ? AND key NOT IN (?, ?)"
        ).bind(user.id, "OPENAI_API_KEY", "SMTP_PASSWORD").all();
        data2.modules.settings = result.results;
        break;
      }
    }
  }
  return data2;
}
__name(exportData, "exportData");
async function importData(db, data2, modules, mode, user) {
  const results = {};
  for (const mod of modules) {
    const modData = data2[mod] || data2?.modules?.[mod];
    if (!modData || !Array.isArray(modData)) {
      results[mod] = { status: "skipped", reason: "\u65E0\u6570\u636E" };
      continue;
    }
    try {
      if (mode === "replace") {
        await clearModuleData(db, mod, user.id);
      }
      let imported = 0;
      switch (mod) {
        case "accounts":
          for (const item of modData) {
            await db.prepare(
              "INSERT OR IGNORE INTO accounts (name, description, user_id) VALUES (?, ?, ?)"
            ).bind(item.name, item.description || "", user.id).run();
            imported++;
          }
          break;
        case "positions":
          for (const item of modData) {
            let accountId = item.account_id;
            if (item.account_name) {
              const acc = await db.prepare(
                "SELECT id FROM accounts WHERE name = ? AND user_id = ?"
              ).bind(item.account_name, user.id).first();
              if (acc)
                accountId = acc.id;
            }
            if (!accountId)
              continue;
            await db.prepare(`
              INSERT OR REPLACE INTO positions (account_id, code, cost, shares, updated_at)
              VALUES (?, ?, ?, ?, datetime())
            `).bind(accountId, item.code, item.cost, item.shares).run();
            imported++;
          }
          break;
        case "transactions":
          for (const item of modData) {
            await db.prepare(`
              INSERT INTO transactions (account_id, code, op_type, amount_cny, shares_redeemed, confirm_date, confirm_nav, shares_added, cost_after)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              item.account_id,
              item.code,
              item.op_type,
              item.amount_cny,
              item.shares_redeemed,
              item.confirm_date,
              item.confirm_nav,
              item.shares_added,
              item.cost_after
            ).run();
            imported++;
          }
          break;
        case "ai_prompts":
          for (const item of modData) {
            await db.prepare(`
              INSERT OR REPLACE INTO ai_prompts (name, prompt, system_prompt, user_prompt, is_default, user_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(item.name, item.prompt || "", item.system_prompt || "", item.user_prompt || "", item.is_default || 0, user.id).run();
            imported++;
          }
          break;
        case "subscriptions":
          for (const item of modData) {
            await db.prepare(`
              INSERT OR IGNORE INTO subscriptions (code, email, user_id, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(item.code, item.email, user.id, item.threshold_up, item.threshold_down, item.enable_digest || 0, item.digest_time || "14:45", item.enable_volatility ?? 1).run();
            imported++;
          }
          break;
        case "settings":
          for (const item of modData) {
            if (item.key === "OPENAI_API_KEY" || item.key === "SMTP_PASSWORD")
              continue;
            await db.prepare(`
              INSERT OR REPLACE INTO settings (key, value, encrypted, user_id, updated_at)
              VALUES (?, ?, ?, ?, datetime())
            `).bind(item.key, item.value, item.encrypted || 0, user.id).run();
            imported++;
          }
          break;
      }
      results[mod] = { status: "ok", imported };
    } catch (e) {
      results[mod] = { status: "error", error: e.message };
    }
  }
  return { results };
}
__name(importData, "importData");
async function clearModuleData(db, mod, userId) {
  switch (mod) {
    case "accounts":
      await db.prepare("DELETE FROM accounts WHERE user_id = ?").bind(userId).run();
      break;
    case "positions":
      await db.prepare(`
        DELETE FROM positions WHERE account_id IN (
          SELECT id FROM accounts WHERE user_id = ?
        )
      `).bind(userId).run();
      break;
    case "transactions":
      await db.prepare(`
        DELETE FROM transactions WHERE account_id IN (
          SELECT id FROM accounts WHERE user_id = ?
        )
      `).bind(userId).run();
      break;
    case "ai_prompts":
      await db.prepare("DELETE FROM ai_prompts WHERE user_id = ?").bind(userId).run();
      break;
    case "subscriptions":
      await db.prepare("DELETE FROM subscriptions WHERE user_id = ?").bind(userId).run();
      break;
    case "settings":
      await db.prepare(
        "DELETE FROM settings WHERE user_id = ? AND key NOT IN (?, ?)"
      ).bind(userId, "OPENAI_API_KEY", "SMTP_PASSWORD").run();
      break;
  }
}
__name(clearModuleData, "clearModuleData");

// src/routes/data.js
var data = new Hono2();
var VALID_MODULES = ["accounts", "positions", "transactions", "ai_prompts", "subscriptions", "settings"];
data.get("/data/export", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const modulesParam = c.req.query("modules");
  let moduleList;
  if (modulesParam) {
    moduleList = modulesParam.split(",").map((m) => m.trim());
    const invalid = moduleList.filter((m) => !VALID_MODULES.includes(m));
    if (invalid.length > 0) {
      return c.json({ detail: `Invalid modules: ${invalid.join(", ")}` }, 400);
    }
  } else {
    moduleList = VALID_MODULES;
  }
  try {
    const result = await exportData(c.env.DB, moduleList, user);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "").slice(0, 15);
    const filename = `fundval_export_${timestamp}.json`;
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=${filename}`
      }
    });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
data.post("/data/import", async (c) => {
  const user = await getCurrentUser(c);
  if (!user)
    return c.json({ detail: "\u672A\u767B\u5F55" }, 401);
  const body = await c.req.json();
  const { data: importDataObj, modules, mode = "merge" } = body;
  if (!modules || !Array.isArray(modules)) {
    return c.json({ detail: "\u9700\u8981\u6307\u5B9A\u5BFC\u5165\u6A21\u5757\u5217\u8868" }, 400);
  }
  if (!["merge", "replace"].includes(mode)) {
    return c.json({ detail: "Invalid mode. Must be 'merge' or 'replace'" }, 400);
  }
  const invalid = modules.filter((m) => !VALID_MODULES.includes(m));
  if (invalid.length > 0) {
    return c.json({ detail: `Invalid modules: ${invalid.join(", ")}` }, 400);
  }
  try {
    const result = await importData(c.env.DB, importDataObj, modules, mode, user);
    return c.json(result);
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
var data_default = data;

// src/routes/system.js
init_db();
var system = new Hono2();
system.get("/db-status", async (c) => {
  const db = c.env.DB;
  try {
    const version = await checkDatabaseVersion(db);
    const needsRebuild = version > 0 && version !== CURRENT_SCHEMA_VERSION;
    const tables = await getAllTables(db);
    return c.json({
      version,
      current_version: CURRENT_SCHEMA_VERSION,
      needs_rebuild: needsRebuild,
      table_count: tables.length
    });
  } catch (e) {
    return c.json({ detail: `Failed to check database status: ${e.message}` }, 500);
  }
});
system.post("/rebuild-db", async (c) => {
  const db = c.env.DB;
  try {
    const version = await checkDatabaseVersion(db);
    if (version === CURRENT_SCHEMA_VERSION) {
      return c.json({ detail: "Database is already at current version, no rebuild needed" }, 400);
    }
    console.warn(`Rebuilding database (current version: ${version}, target: ${CURRENT_SCHEMA_VERSION})`);
    await dropAllTables(db);
    await initDb(db);
    const newVersion = await checkDatabaseVersion(db);
    if (newVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`Rebuild failed: version is ${newVersion}, expected ${CURRENT_SCHEMA_VERSION}`);
    }
    return c.json({
      message: "Database rebuilt successfully",
      version: newVersion
    });
  } catch (e) {
    if (e.message?.includes("already at current version")) {
      return c.json({ detail: e.message }, 400);
    }
    return c.json({ detail: `Failed to rebuild database: ${e.message}` }, 500);
  }
});
var system_default = system;

// src/index.js
var app = new Hono2();
app.use("/api/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
var dbInitialized = false;
app.use("/api/*", async (c, next) => {
  if (!dbInitialized) {
    try {
      await initDb(c.env.DB);
      dbInitialized = true;
    } catch (e) {
      console.error(`DB init error: ${e.message}`);
    }
  }
  return next();
});
app.route("/api/auth", auth_default);
app.route("/api", funds_default);
app.route("/api", account_default);
app.route("/api/ai", ai_default);
app.route("/api", settings_default);
app.route("/api", data_default);
app.route("/api/system", system_default);
var src_default = {
  fetch: app.fetch,
  // Cron Triggers handler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
