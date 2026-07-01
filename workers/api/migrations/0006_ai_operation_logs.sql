CREATE TABLE IF NOT EXISTS ai_operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  operation TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  model_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_operation_logs_created ON ai_operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_operation_logs_user_created ON ai_operation_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_operation_logs_operation ON ai_operation_logs(operation, status, created_at);
