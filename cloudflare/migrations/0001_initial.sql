PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_staff INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  professional_title TEXT NOT NULL DEFAULT 'Developer',
  introduction TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT NOT NULL DEFAULT '',
  visible_contacts TEXT NOT NULL DEFAULT '[]',
  country TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  work_modes TEXT NOT NULL DEFAULT '[]',
  palette TEXT NOT NULL DEFAULT 'ink',
  font TEXT NOT NULL DEFAULT 'sans',
  layout TEXT NOT NULL DEFAULT 'classic',
  alignment TEXT NOT NULL DEFAULT 'left',
  is_owner_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_owner_featured IN (0, 1)),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  is_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (is_reviewed IN (0, 1)),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE profile_skills (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, skill_id)
);

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  message TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX profiles_public_idx ON profiles(is_published, is_owner_featured, updated_at);
CREATE INDEX profile_skills_skill_idx ON profile_skills(skill_id, profile_id);
CREATE INDEX contact_messages_rate_idx ON contact_messages(source_hash, created_at);
CREATE INDEX sessions_token_idx ON sessions(token_hash, expires_at);

CREATE UNIQUE INDEX one_featured_profile ON profiles(is_owner_featured) WHERE is_owner_featured = 1;

INSERT INTO skills (name, slug) VALUES
  ('AWS', 'aws'), ('Docker', 'docker'), ('Django', 'django'), ('Git', 'git'),
  ('Java', 'java'), ('JavaScript', 'javascript'), ('Kubernetes', 'kubernetes'),
  ('Next.js', 'next-js'), ('Node.js', 'node-js'), ('PostgreSQL', 'postgresql'),
  ('Python', 'python'), ('React', 'react'), ('Spring Boot', 'spring-boot'),
  ('Tailwind CSS', 'tailwind-css'), ('TypeScript', 'typescript');
