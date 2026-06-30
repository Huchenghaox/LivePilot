CREATE TABLE IF NOT EXISTS model_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL DEFAULT '',
  api_key_iv TEXT NOT NULL DEFAULT '',
  api_key_last_four TEXT NOT NULL DEFAULT '',
  encryption_version TEXT NOT NULL DEFAULT 'aes-gcm-v1',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_test_status TEXT NOT NULL DEFAULT 'untested',
  last_test_message TEXT NOT NULL DEFAULT '',
  last_tested_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_model_providers_enabled ON model_providers(enabled, updated_at);

CREATE TABLE IF NOT EXISTS provider_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  capability TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_id, capability);

CREATE TABLE IF NOT EXISTS model_assignments (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_text_provider_id INTEGER,
  default_text_model_name TEXT NOT NULL DEFAULT '',
  default_vision_provider_id INTEGER,
  default_vision_model_name TEXT NOT NULL DEFAULT '',
  report_provider_id INTEGER,
  report_model_name TEXT NOT NULL DEFAULT '',
  preparation_provider_id INTEGER,
  preparation_model_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER
);

INSERT OR IGNORE INTO model_assignments (
  id,
  default_text_model_name,
  default_vision_model_name,
  report_model_name,
  preparation_model_name
) VALUES (1, '', '', '', '');

INSERT OR IGNORE INTO model_providers (
  id,
  name,
  base_url,
  api_key_ciphertext,
  api_key_iv,
  api_key_last_four,
  enabled,
  last_test_status,
  last_test_message,
  last_tested_at,
  created_at,
  updated_at,
  updated_by
)
SELECT
  1,
  provider_name,
  base_url,
  api_key_ciphertext,
  api_key_iv,
  api_key_last_four,
  enabled,
  last_test_status,
  last_test_message,
  last_tested_at,
  created_at,
  updated_at,
  updated_by
FROM system_model_configs
WHERE enabled = 1
ORDER BY updated_at DESC, id DESC
LIMIT 1;

UPDATE model_assignments
SET
  default_text_provider_id = COALESCE(default_text_provider_id, (SELECT id FROM model_providers WHERE enabled = 1 ORDER BY updated_at DESC, id DESC LIMIT 1)),
  default_text_model_name = COALESCE(NULLIF(default_text_model_name, ''), (SELECT text_model_name FROM system_model_configs WHERE enabled = 1 ORDER BY updated_at DESC, id DESC LIMIT 1), ''),
  default_vision_provider_id = CASE
    WHEN COALESCE(NULLIF(default_vision_model_name, ''), '') = '' THEN NULL
    ELSE default_vision_provider_id
  END,
  default_vision_model_name = CASE
    WHEN lower(COALESCE((SELECT vision_model_name FROM system_model_configs WHERE enabled = 1 ORDER BY updated_at DESC, id DESC LIMIT 1), '')) IN ('glm-5.1', 'glm5.1', 'qwen-plus') THEN ''
    WHEN COALESCE(NULLIF(default_vision_model_name, ''), '') = '' THEN COALESCE((SELECT vision_model_name FROM system_model_configs WHERE enabled = 1 ORDER BY updated_at DESC, id DESC LIMIT 1), '')
    ELSE default_vision_model_name
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;
