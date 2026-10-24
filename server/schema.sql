-- Neon Lakebase PostgreSQL Schema for Sara Learning Platform

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_progress (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  category TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  correct BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  correct_attempts INT NOT NULL DEFAULT 0,
  incorrect_attempts INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  first_attempt_correct BOOLEAN,
  final_correct BOOLEAN,
  last_completed_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_progress_student 
  ON activity_progress(student_id);

CREATE INDEX IF NOT EXISTS idx_activity_progress_category 
  ON activity_progress(student_id, category);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  category TEXT,
  attempt_number INT NOT NULL,
  result TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_student 
  ON attempts(student_id, activity_id, timestamp DESC);
