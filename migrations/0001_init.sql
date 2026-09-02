-- Intellitask initial schema (Postgres / Neon).
-- The app is single-user today but the `users` table exists so multi-user
-- support can be added later without a structural rewrite (see README).
--
-- Timestamps are stored as TEXT (ISO 8601 strings, e.g. from
-- `new Date().toISOString()`) rather than native TIMESTAMP columns: the
-- application always supplies them explicitly on write, and keeping them as
-- text avoids timezone-conversion surprises between the app and the DB.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_provider TEXT NOT NULL DEFAULT 'mock',
  ai_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
  allow_web_research BOOLEAN NOT NULL DEFAULT FALSE,
  theme TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL
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
  is_quick_task BOOLEAN NOT NULL DEFAULT FALSE,
  project_summary TEXT,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  research_supported BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  task_type TEXT NOT NULL DEFAULT 'task',
  item_state TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  requires_research BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
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
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'user',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_milestones_due_date ON milestones(due_date);

CREATE TABLE context_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_context_entries_category ON context_entries(category);

CREATE TABLE research_sources (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  extract TEXT NOT NULL,
  researched_at TEXT NOT NULL,
  provider_name TEXT NOT NULL
);

CREATE TABLE project_research (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  research_source_id TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
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
  success BOOLEAN NOT NULL,
  error_message TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
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
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX idx_inbox_items_status ON inbox_items(status);
