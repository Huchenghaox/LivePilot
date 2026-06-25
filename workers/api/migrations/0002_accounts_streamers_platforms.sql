ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN phone_verified_at TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;

CREATE TABLE IF NOT EXISTS sms_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  request_ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_phone_purpose_created ON sms_verification_codes(phone_normalized, purpose, created_at);

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(scope, subject_hash, window_start)
);

CREATE TABLE IF NOT EXISTS streamers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL,
  live_forms TEXT NOT NULL DEFAULT '[]',
  average_online_range TEXT NOT NULL DEFAULT '',
  usual_live_time TEXT NOT NULL DEFAULT '',
  improvement_goal TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_streamers_user_id ON streamers(user_id);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform TEXT NOT NULL DEFAULT 'douyin',
  display_name TEXT NOT NULL,
  account_handle TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT '个人账号',
  follower_range TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  connection_type TEXT NOT NULL DEFAULT 'manual',
  connection_status TEXT NOT NULL DEFAULT '已手动记录',
  authorization_status TEXT NOT NULL DEFAULT '未授权',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, platform, account_handle)
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);

CREATE TABLE IF NOT EXISTS streamer_platform_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  streamer_id INTEGER NOT NULL,
  platform_account_id INTEGER NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (streamer_id) REFERENCES streamers(id) ON DELETE CASCADE,
  FOREIGN KEY (platform_account_id) REFERENCES platform_accounts(id) ON DELETE CASCADE,
  UNIQUE(streamer_id, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_streamer_platform_user_id ON streamer_platform_accounts(user_id);

CREATE TABLE IF NOT EXISTS preparation_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  streamer_id INTEGER,
  platform_account_id INTEGER,
  topic TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  streamer_id INTEGER,
  platform_account_id INTEGER,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  live_session_id INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
