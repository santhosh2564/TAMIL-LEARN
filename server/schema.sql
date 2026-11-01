-- Neon Lakebase PostgreSQL Schema for Sara Learning Platform
-- All statements are idempotent and safe to run multiple times.

-- ── 1. Schools ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Legacy/Unassigned school for existing unassigned rows
INSERT INTO schools (id, name, created_at)
VALUES ('school_unassigned', 'Unassigned', NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 2. Admins ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'school_admin')),
  school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

ALTER TABLE admins ADD COLUMN IF NOT EXISTS school_id TEXT REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_admins_school ON admins(school_id);

-- ── 3. Classes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  class_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_code ON classes(class_code);

-- Seed Legacy class under Unassigned school for backfilling
INSERT INTO classes (id, school_id, name, grade, class_code, created_at)
VALUES ('class_legacy', 'school_unassigned', 'Legacy', 'Class 2-3', 'LEGACY', NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 4. Students ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new columns as nullable first for safe migration
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id TEXT REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id TEXT REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS failed_pin_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Backfill existing rows without school / class / roll_no / avatar
UPDATE students SET school_id = 'school_unassigned' WHERE school_id IS NULL;
UPDATE students SET class_id = 'class_legacy' WHERE class_id IS NULL;
UPDATE students SET roll_no = id WHERE roll_no IS NULL;
UPDATE students SET avatar = 'avatar_default' WHERE avatar IS NULL;

-- Enforce NOT NULL on required columns
ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN class_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN roll_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_roll ON students(class_id, roll_no);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- ── 5. Learning Sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_sessions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (subject IN ('tamil', 'english')),
  category_or_module TEXT NOT NULL,
  activity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_school ON learning_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_student ON learning_sessions(student_id);

-- At most ONE active session per student+subject+category
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session_per_student
ON learning_sessions (student_id, subject, category_or_module)
WHERE status = 'active';

-- ── 6. Activity Progress ──────────────────────────────────────────────────────
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

-- Add school_id as nullable first
ALTER TABLE activity_progress ADD COLUMN IF NOT EXISTS school_id TEXT REFERENCES schools(id) ON DELETE CASCADE;

-- Backfill from student or fallback to Unassigned school
UPDATE activity_progress ap
SET school_id = s.school_id
FROM students s
WHERE ap.student_id = s.id AND ap.school_id IS NULL;

UPDATE activity_progress SET school_id = 'school_unassigned' WHERE school_id IS NULL;

-- Enforce NOT NULL on school_id
ALTER TABLE activity_progress ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_progress_school ON activity_progress(school_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_student ON activity_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_student_activity ON activity_progress(student_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_category ON activity_progress(student_id, category);

-- ── 7. Attempts ───────────────────────────────────────────────────────────────
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

-- Add school_id as nullable first
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS school_id TEXT REFERENCES schools(id) ON DELETE CASCADE;

-- Backfill from student or fallback to Unassigned school
UPDATE attempts a
SET school_id = s.school_id
FROM students s
WHERE a.student_id = s.id AND a.school_id IS NULL;

UPDATE attempts SET school_id = 'school_unassigned' WHERE school_id IS NULL;

-- Enforce NOT NULL on school_id
ALTER TABLE attempts ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_school ON attempts(school_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, activity_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_student_activity ON attempts(student_id, activity_id);

-- ── 8. Phase 2.1: ON DELETE RESTRICT, Composite School Consistency, and Archival ──
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 8.1 Add archived_at TIMESTAMPTZ NULL to schools, classes, students
  ALTER TABLE schools ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
  ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

  -- 8.2 classes: UNIQUE (id, school_id) & ON DELETE RESTRICT on school_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_classes_id_school') THEN
    ALTER TABLE classes ADD CONSTRAINT uq_classes_id_school UNIQUE (id, school_id);
  END IF;

  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'classes'::regclass AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE classes DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE classes ADD CONSTRAINT fk_classes_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT;

  -- 8.3 students: UNIQUE (id, school_id), FK (school_id) RESTRICT, and composite FK (class_id, school_id) RESTRICT
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_id_school') THEN
    ALTER TABLE students ADD CONSTRAINT uq_students_id_school UNIQUE (id, school_id);
  END IF;

  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'students'::regclass AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE students DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE students ADD CONSTRAINT fk_students_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT;
  ALTER TABLE students ADD CONSTRAINT fk_students_class_school
    FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT;

  -- 8.4 learning_sessions: composite FK (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'learning_sessions'::regclass AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE learning_sessions DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE learning_sessions ADD CONSTRAINT fk_learning_sessions_student_school
    FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT;

  -- 8.5 activity_progress: composite FK (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'activity_progress'::regclass AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE activity_progress DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE activity_progress ADD CONSTRAINT fk_activity_progress_student_school
    FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT;

  -- 8.6 attempts: composite FK (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'attempts'::regclass AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE attempts DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE attempts ADD CONSTRAINT fk_attempts_student_school
    FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT;

  -- 8.7 admins: ON DELETE RESTRICT on school_id and role/school_id CHECK constraint
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'admins'::regclass AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE admins DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE admins ADD CONSTRAINT fk_admins_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT;

  ALTER TABLE admins DROP CONSTRAINT IF EXISTS chk_admins_role_school;
  ALTER TABLE admins ADD CONSTRAINT chk_admins_role_school
    CHECK ((role = 'super_admin' AND school_id IS NULL) OR (role = 'school_admin' AND school_id IS NOT NULL));

END $$;

-- ── 9. Phase 3: Class Lookup Rate Limits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_lookup_rate_limits (
  ip TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'invalid',
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, kind, window_start)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'class_lookup_rate_limits' AND column_name = 'kind'
  ) THEN
    DROP TABLE IF EXISTS class_lookup_rate_limits;
    CREATE TABLE class_lookup_rate_limits (
      ip TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'invalid',
      window_start TIMESTAMPTZ NOT NULL,
      count INT NOT NULL DEFAULT 1,
      PRIMARY KEY (ip, kind, window_start)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_lookup_limits_ip_kind ON class_lookup_rate_limits (ip, kind, window_start);

-- ── 10. Attempt metadata (subject / module_id / grade) ────────────────────────
-- Derived server-side from the content manifests by activity_id (server/activityCatalog.ts).
-- Additive and nullable: activity ids missing from the manifests keep NULLs.
-- Existing rows are backfilled by server/migrations/attempts_metadata_backfill.sql.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS module_id INT;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS grade INT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_attempts_subject') THEN
    ALTER TABLE attempts ADD CONSTRAINT chk_attempts_subject
      CHECK (subject IS NULL OR subject IN ('tamil', 'english'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attempts_subject_module ON attempts(subject, module_id);
