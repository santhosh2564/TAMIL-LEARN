-- Migration 003: Persistent Assessment Tracking & Admin Reporting
-- Safe, additive, idempotent migration.

-- â”€â”€ 1. Schools Table Extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_code TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill schools
UPDATE schools SET school_name = name WHERE school_name IS NULL;
UPDATE schools SET school_code = id WHERE school_code IS NULL;
UPDATE schools SET academic_year = (EXTRACT(YEAR FROM NOW())::text || '-' || (EXTRACT(YEAR FROM NOW()) + 1)::text) WHERE academic_year IS NULL;

-- Enforce school_code uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_code ON schools(school_code);

-- â”€â”€ 2. Students Table Extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'A';
ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill students
UPDATE students SET student_name = name WHERE student_name IS NULL;
UPDATE students SET roll_number = roll_no WHERE roll_number IS NULL;
UPDATE students SET is_active = (archived_at IS NULL) WHERE is_active IS NULL;

-- â”€â”€ 3. Assessment Sessions Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL CHECK (subject_id IN ('tamil', 'english')),
  module_id INT,
  session_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (session_status IN ('in_progress', 'completed', 'abandoned')),
  current_activity_id TEXT,
  current_question_id TEXT,
  current_question_index INT NOT NULL DEFAULT 0,
  activity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_student ON assessment_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_school ON assessment_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_class ON assessment_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status ON assessment_sessions(student_id, session_status);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_subject ON assessment_sessions(subject_id, module_id);

-- â”€â”€ 4. Question Attempts Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS question_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES assessment_sessions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL,
  module_id INT,
  activity_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  attempt_number INT NOT NULL CHECK (attempt_number >= 1),
  answer_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN NOT NULL,
  is_completed BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT UNIQUE NOT NULL
);

-- Monotonic attempt number constraint per question within a session
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_session_question_attempt
  ON question_attempts (session_id, question_id, attempt_number)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_question_attempts_session ON question_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_student ON question_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_school ON question_attempts(school_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_lookup ON question_attempts(student_id, subject_id, module_id, question_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_attempted_at ON question_attempts(attempted_at DESC);

-- â”€â”€ 5. Student Module Progress View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE VIEW student_module_progress AS
WITH question_stats AS (
  SELECT
    student_id,
    school_id,
    subject_id,
    COALESCE(module_id, 0) AS module_id,
    question_id,
    COUNT(*) AS attempts_count,
    BOOL_OR(is_completed) AS is_completed,
    (ARRAY_AGG(is_correct ORDER BY attempt_number ASC))[1] AS first_attempt_correct,
    (ARRAY_AGG(is_correct ORDER BY attempt_number DESC))[1] AS finally_correct,
    MAX(attempted_at) AS last_attempted_at,
    MAX(CASE WHEN is_completed THEN attempted_at ELSE NULL END) AS last_completed_at
  FROM question_attempts
  GROUP BY student_id, school_id, subject_id, COALESCE(module_id, 0), question_id
)
SELECT
  student_id,
  school_id,
  subject_id,
  module_id,
  COUNT(DISTINCT question_id)::int AS questions_attempted,
  SUM(attempts_count)::int AS total_attempts,
  COUNT(DISTINCT question_id) FILTER (WHERE attempts_count > 1)::int AS retried_questions,
  (SUM(attempts_count) - COUNT(DISTINCT question_id))::int AS total_retry_attempts,
  COUNT(DISTINCT question_id) FILTER (WHERE first_attempt_correct = TRUE)::int AS first_attempt_correct,
  COUNT(DISTINCT question_id) FILTER (WHERE finally_correct = TRUE)::int AS finally_correct,
  COUNT(DISTINCT question_id) FILTER (WHERE is_completed = TRUE)::int AS questions_completed,
  MAX(last_attempted_at) AS last_attempted_at,
  MAX(last_completed_at) AS last_completed_at
FROM question_stats
GROUP BY student_id, school_id, subject_id, module_id;
