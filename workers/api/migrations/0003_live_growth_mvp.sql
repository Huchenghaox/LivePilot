ALTER TABLE preparation_plans ADD COLUMN goal TEXT NOT NULL DEFAULT '';
ALTER TABLE preparation_plans ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 90;
ALTER TABLE preparation_plans ADD COLUMN live_form TEXT NOT NULL DEFAULT '';
ALTER TABLE preparation_plans ADD COLUMN has_cohost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE preparation_plans ADD COLUMN has_ecommerce INTEGER NOT NULL DEFAULT 0;
ALTER TABLE preparation_plans ADD COLUMN special_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE preparation_plans ADD COLUMN plan_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE preparation_plans ADD COLUMN is_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE preparation_plans ADD COLUMN used_at TEXT;
ALTER TABLE preparation_plans ADD COLUMN source_review_id INTEGER;
ALTER TABLE preparation_plans ADD COLUMN source_report_id INTEGER;
ALTER TABLE preparation_plans ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE live_sessions ADD COLUMN preparation_plan_id INTEGER;
ALTER TABLE live_sessions ADD COLUMN platform TEXT NOT NULL DEFAULT 'douyin';
ALTER TABLE live_sessions ADD COLUMN data_source TEXT NOT NULL DEFAULT 'manual_input';
ALTER TABLE live_sessions ADD COLUMN live_date TEXT;
ALTER TABLE live_sessions ADD COLUMN session_topic TEXT NOT NULL DEFAULT '';
ALTER TABLE live_sessions ADD COLUMN main_goal TEXT NOT NULL DEFAULT '';
ALTER TABLE live_sessions ADD COLUMN has_paid_promotion INTEGER;
ALTER TABLE live_sessions ADD COLUMN has_cohost INTEGER;
ALTER TABLE live_sessions ADD COLUMN self_review TEXT NOT NULL DEFAULT '';
ALTER TABLE live_sessions ADD COLUMN main_problem TEXT NOT NULL DEFAULT '';
ALTER TABLE live_sessions ADD COLUMN duration_minutes REAL;
ALTER TABLE live_sessions ADD COLUMN peak_online REAL;
ALTER TABLE live_sessions ADD COLUMN average_online REAL;
ALTER TABLE live_sessions ADD COLUMN new_followers REAL;
ALTER TABLE live_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE review_reports ADD COLUMN streamer_id INTEGER;
ALTER TABLE review_reports ADD COLUMN platform_account_id INTEGER;
ALTER TABLE review_reports ADD COLUMN report_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE review_reports ADD COLUMN quality_status TEXT NOT NULL DEFAULT 'unchecked';
ALTER TABLE review_reports ADD COLUMN quality_warnings TEXT NOT NULL DEFAULT '[]';
ALTER TABLE review_reports ADD COLUMN model_name TEXT NOT NULL DEFAULT '';
ALTER TABLE review_reports ADD COLUMN prompt_version TEXT NOT NULL DEFAULT 'worker-mvp-v1';
ALTER TABLE review_reports ADD COLUMN rule_snapshot TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS review_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  live_session_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  raw_value TEXT,
  normalized_value REAL,
  unit TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual_input',
  source_upload_id INTEGER,
  source_text TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT 'manual',
  comparison_json TEXT NOT NULL DEFAULT '{}',
  is_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_metrics_session ON review_metrics(user_id, live_session_id);
CREATE INDEX IF NOT EXISTS idx_review_metrics_key ON review_metrics(user_id, live_session_id, key);

CREATE TABLE IF NOT EXISTS live_session_screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  live_session_id INTEGER NOT NULL,
  streamer_id INTEGER NOT NULL,
  platform_account_id INTEGER,
  r2_object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  recognition_status TEXT NOT NULL DEFAULT 'uploaded',
  recognition_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_session_screenshots_session ON live_session_screenshots(user_id, live_session_id);

CREATE TABLE IF NOT EXISTS recognition_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  live_session_id INTEGER NOT NULL,
  upload_id INTEGER NOT NULL,
  document_type TEXT NOT NULL DEFAULT '',
  raw_json TEXT NOT NULL,
  normalized_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_confirmation',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_id) REFERENCES live_session_screenshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recognition_results_session ON recognition_results(user_id, live_session_id);

CREATE TABLE IF NOT EXISTS report_diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  report_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  impact_level TEXT NOT NULL DEFAULT 'medium',
  priority INTEGER NOT NULL DEFAULT 1,
  requires_validation INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_diagnoses_report ON report_diagnoses(user_id, report_id);

CREATE TABLE IF NOT EXISTS report_action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  report_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  timing TEXT NOT NULL,
  script_example TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  baseline_value REAL,
  expected_direction TEXT NOT NULL DEFAULT 'up',
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_action_items_report ON report_action_items(user_id, report_id);

CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  streamer_id INTEGER NOT NULL,
  source_report_id INTEGER,
  next_plan_id INTEGER,
  hypothesis TEXT NOT NULL,
  action TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  baseline_value REAL,
  target_value REAL,
  target_direction TEXT NOT NULL DEFAULT 'up',
  result_value REAL,
  result_status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_streamer ON experiments(user_id, streamer_id);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  streamer_id INTEGER,
  platform_account_id INTEGER,
  live_session_id INTEGER,
  report_id INTEGER,
  feedback_type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '运营经验',
  platform TEXT NOT NULL DEFAULT 'douyin',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  content TEXT NOT NULL,
  recommended_action TEXT NOT NULL DEFAULT '',
  prohibited_action TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT 'LivePilot',
  source_url TEXT NOT NULL DEFAULT '',
  effective_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_scope ON rules(user_id, platform, status);

CREATE TABLE IF NOT EXISTS rule_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  report_id INTEGER NOT NULL,
  rule_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  effective_date TEXT,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rule_snapshots_report ON rule_snapshots(user_id, report_id);

INSERT INTO rules (user_id, title, category, platform, risk_level, content, recommended_action, prohibited_action, source_name, status)
SELECT NULL, '不要把不确定推断说成平台官方规则', '系统提示', 'douyin', 'high',
  '当报告仅基于截图数据时，必须区分数据事实、AI推断和需要主播补充的信息。',
  '使用“可能”“需要下一场验证”等谨慎表达，并说明依据来源。',
  '禁止写成“平台明确要求”或“必然导致限流”。',
  'LivePilot内置规则', 'active'
WHERE NOT EXISTS (SELECT 1 FROM rules WHERE title='不要把不确定推断说成平台官方规则' AND user_id IS NULL);

INSERT INTO rules (user_id, title, category, platform, risk_level, content, recommended_action, prohibited_action, source_name, status)
SELECT NULL, '直播话术避免绝对化承诺', '平台规则摘要', 'douyin', 'medium',
  '直播标题、开场和转化话术应避免保证收益、保证涨粉、绝不违规等绝对化表述。',
  '使用可验证目标和过程建议，例如“本场重点观察停留和评论变化”。',
  '禁止承诺平台结果或诱导用户相信确定收益。',
  'LivePilot内置规则', 'active'
WHERE NOT EXISTS (SELECT 1 FROM rules WHERE title='直播话术避免绝对化承诺' AND user_id IS NULL);
