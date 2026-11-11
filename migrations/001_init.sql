CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cv', 'portfolio', 'presentation', 'certificate', 'other')),
  path TEXT NOT NULL,
  extracted_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  url TEXT,
  job_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'in_process', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  sent_at TEXT,
  match_pct REAL,
  missing_keywords TEXT,
  cv_path TEXT,
  letter_path TEXT,
  tailored_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE status_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN ('draft', 'sent', 'in_process', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_applications_status ON applications (status);
CREATE INDEX idx_applications_sent_at ON applications (sent_at);
CREATE INDEX idx_status_history_application ON status_history (application_id);
