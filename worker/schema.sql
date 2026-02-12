-- FundVal-Live Database Schema for Cloudflare D1
-- Migrated from Python SQLite schema

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

CREATE TABLE IF NOT EXISTS funds (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_funds_name ON funds(name);

CREATE TABLE IF NOT EXISTS positions (
    account_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0.0,
    shares REAL NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, code),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id);

CREATE TABLE IF NOT EXISTS transactions (
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
);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(code);
CREATE INDEX IF NOT EXISTS idx_transactions_confirm_date ON transactions(confirm_date);

CREATE TABLE IF NOT EXISTS fund_history (
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    nav REAL NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code, date)
);
CREATE INDEX IF NOT EXISTS idx_fund_history_code ON fund_history(code);
CREATE INDEX IF NOT EXISTS idx_fund_history_date ON fund_history(date);

CREATE TABLE IF NOT EXISTS fund_intraday_snapshots (
    fund_code TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    estimate REAL NOT NULL,
    PRIMARY KEY (fund_code, date, time)
);

CREATE TABLE IF NOT EXISTS subscriptions (
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
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT NOT NULL,
    value TEXT,
    encrypted INTEGER DEFAULT 0,
    user_id INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (key, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

CREATE TABLE IF NOT EXISTS ai_prompts (
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
);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_user_id ON ai_prompts(user_id);

CREATE TABLE IF NOT EXISTS ai_analysis_history (
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
);
CREATE INDEX IF NOT EXISTS idx_analysis_history_main ON ai_analysis_history(user_id, account_id, fund_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_prompt ON ai_analysis_history(user_id, prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON ai_analysis_history(user_id, id);

-- Insert schema version
INSERT OR IGNORE INTO schema_version (version) VALUES (1);
