PRAGMA foreign_keys = ON;

CREATE TABLE profile_experiences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  description TEXT NOT NULL DEFAULT '',
  technologies TEXT NOT NULL DEFAULT '[]',
  UNIQUE (profile_id, sort_order)
);

CREATE TABLE profile_languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  language TEXT NOT NULL DEFAULT '',
  proficiency TEXT NOT NULL DEFAULT '',
  UNIQUE (profile_id, sort_order)
);

CREATE TABLE profile_education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  institution TEXT NOT NULL DEFAULT '',
  degree TEXT NOT NULL DEFAULT '',
  field TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  UNIQUE (profile_id, sort_order)
);

CREATE INDEX profile_experiences_order_idx ON profile_experiences(profile_id, sort_order);
CREATE INDEX profile_languages_order_idx ON profile_languages(profile_id, sort_order);
CREATE INDEX profile_education_order_idx ON profile_education(profile_id, sort_order);
