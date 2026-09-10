PRAGMA foreign_keys = ON;

ALTER TABLE profiles ADD COLUMN card_skills_configured INTEGER NOT NULL DEFAULT 0 CHECK (card_skills_configured IN (0, 1));

CREATE TABLE profile_card_skills (
  profile_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0 AND sort_order < 4),
  PRIMARY KEY (profile_id, skill_id),
  UNIQUE (profile_id, sort_order),
  FOREIGN KEY (profile_id, skill_id) REFERENCES profile_skills(profile_id, skill_id) ON DELETE CASCADE
);

CREATE INDEX profile_card_skills_order_idx ON profile_card_skills(profile_id, sort_order);
