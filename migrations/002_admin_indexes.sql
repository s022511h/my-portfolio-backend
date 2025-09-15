CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_consent_user_type ON consent_ledger(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_created_at ON consent_ledger(created_at);

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  template TEXT,
  subject TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);