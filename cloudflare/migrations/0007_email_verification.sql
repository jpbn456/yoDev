ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Preserve access for every account created before email verification existed.
UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP);

CREATE TABLE email_verification_tokens (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX email_verification_expiry_idx ON email_verification_tokens(expires_at);
