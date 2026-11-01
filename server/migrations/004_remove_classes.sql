-- Migration 004: Remove Classes & Sections Architecture Correction
-- Non-destructive: preserves existing classes table, preserves historical IDs and data,
-- decouples students, learning_sessions, and assessment_sessions from mandatory class hierarchy.

-- 1. Make class_id and section nullable on students
ALTER TABLE students ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE students ALTER COLUMN section DROP NOT NULL;

-- 2. Drop class-dependent foreign key constraints and class-roll unique index on students
ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_class_school;
DROP INDEX IF EXISTS idx_students_class_roll;

-- 3. Enforce roll number uniqueness within each school (active students only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_roll
  ON students (school_id, roll_no)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_roll_number
  ON students (school_id, roll_number)
  WHERE archived_at IS NULL AND roll_number IS NOT NULL;

-- 4. Make class_id nullable on assessment_sessions and drop foreign key constraint
ALTER TABLE assessment_sessions ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_class_id_fkey;

-- 5. Make class_id nullable on learning_sessions if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_sessions' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE learning_sessions ALTER COLUMN class_id DROP NOT NULL;
  END IF;
END $$;
