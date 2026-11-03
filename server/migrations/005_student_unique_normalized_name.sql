-- Migration 005: Enforce Unique Normalized Student Name per School
-- Prevents duplicate student creation across concurrent serverless invocations

-- 1. Deduplicate any pre-existing duplicates in active students by archiving later duplicates
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY school_id, LOWER(TRIM(name))
           ORDER BY created_at ASC, id ASC
         ) as rn
  FROM students
  WHERE archived_at IS NULL
)
UPDATE students
SET archived_at = NOW()
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- 2. Create unique index on active students
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_normalized_name
  ON students (school_id, LOWER(TRIM(name)))
  WHERE archived_at IS NULL;
