-- Intellitask initial schema.
-- The app is single-user today but the `users` table exists so multi-user
-- support can be added later without a structural rewrite (see README).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_provider TEXT NOT NULL DEFAULT 'mock',
  ai_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
  allow_web_research INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deadline TEXT,
  location TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_quick_task INTEGER NOT NULL DEFAULT 0,
  project_summary TEXT,
  assumptions TEXT NOT NULL DEFAULT '[]',
  questions TEXT NOT NULL DEFAULT '[]',
  risks TEXT NOT NULL DEFAULT '[]',
  missing_information TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_deadline ON projects(deadline);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  start_date TEXT,
  estimated_effort TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  ai_generated INTEGER NOT NULL DEFAULT 0,
  research_supported INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  task_type TEXT NOT NULL DEFAULT 'task',
  item_state TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  reason TEXT,
  requires_research INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, depends_on_task_id)
);
CREATE INDEX idx_task_deps_task_id ON task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends_on ON task_dependencies(depends_on_task_id);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'user',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_milestones_due_date ON milestones(due_date);

CREATE TABLE context_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_context_entries_category ON context_entries(category);

CREATE TABLE research_sources (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  extract TEXT NOT NULL,
  researched_at TEXT NOT NULL DEFAULT (datetime('now')),
  provider_name TEXT NOT NULL
);

CREATE TABLE project_research (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  research_source_id TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_project_research_project_id ON project_research(project_id);
CREATE INDEX idx_project_research_task_id ON project_research(task_id);

CREATE TABLE ai_runs (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  success INTEGER NOT NULL,
  error_message TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ai_runs_project_id ON ai_runs(project_id);
CREATE INDEX idx_ai_runs_created_at ON ai_runs(created_at);

CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  suggested_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  suggested_parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  suggestion_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX idx_inbox_items_status ON inbox_items(status);
