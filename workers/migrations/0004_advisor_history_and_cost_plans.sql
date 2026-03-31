PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS advisor_threads (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS advisor_messages (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES advisor_threads(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_advisor_threads_user_id ON advisor_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_threads_user_id_updated_at ON advisor_threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisor_messages_thread_id_created_at ON advisor_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_advisor_messages_user_id ON advisor_messages(user_id);

CREATE TRIGGER IF NOT EXISTS trg_advisor_threads_updated_at
AFTER UPDATE ON advisor_threads
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE advisor_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_advisor_threads_touch_on_message_insert
AFTER INSERT ON advisor_messages
FOR EACH ROW
BEGIN
  UPDATE advisor_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.thread_id;
END;

CREATE TABLE IF NOT EXISTS cost_cutter_plans (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  user_id TEXT NOT NULL,
  analysis TEXT NOT NULL,
  model_used TEXT NOT NULL,
  monthly_income REAL NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
  monthly_expenses REAL NOT NULL DEFAULT 0 CHECK (monthly_expenses >= 0),
  remaining_balance REAL NOT NULL DEFAULT 0,
  expense_ratio REAL NOT NULL DEFAULT 0 CHECK (expense_ratio >= 0),
  financial_health_score INTEGER NOT NULL DEFAULT 0 CHECK (financial_health_score >= 0 AND financial_health_score <= 100),
  target_monthly_savings REAL NOT NULL DEFAULT 0 CHECK (target_monthly_savings >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS cost_cutter_plan_milestones (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  plan_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  due_label TEXT,
  target_amount REAL NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES cost_cutter_plans(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS cost_cutter_plan_steps (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  milestone_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  target_amount REAL NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (milestone_id) REFERENCES cost_cutter_plan_milestones(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cost_cutter_plans_user_id_created_at ON cost_cutter_plans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_cutter_plan_milestones_plan_id_order ON cost_cutter_plan_milestones(plan_id, order_index);
CREATE INDEX IF NOT EXISTS idx_cost_cutter_plan_steps_milestone_id_order ON cost_cutter_plan_steps(milestone_id, order_index);
CREATE INDEX IF NOT EXISTS idx_cost_cutter_plan_steps_completed ON cost_cutter_plan_steps(is_completed);

CREATE TRIGGER IF NOT EXISTS trg_cost_cutter_plans_updated_at
AFTER UPDATE ON cost_cutter_plans
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE cost_cutter_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_cost_cutter_plan_milestones_updated_at
AFTER UPDATE ON cost_cutter_plan_milestones
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE cost_cutter_plan_milestones SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_cost_cutter_plan_steps_updated_at
AFTER UPDATE ON cost_cutter_plan_steps
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE cost_cutter_plan_steps SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
