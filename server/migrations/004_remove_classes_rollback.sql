-- Rollback for Migration 004
-- Restores class_id dependencies if needed

-- 1. Drop school-level roll number unique indexes
DROP INDEX IF EXISTS idx_students_school_roll;
DROP INDEX IF EXISTS idx_students_school_roll_number;

-- 2. Restore class-roll unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_roll ON students(class_id, roll_no);

-- 3. (Optional) Re-attach class foreign key constraint if classes exist
-- Note: Requires backfilling any NULL class_id with 'class_legacy' before executing:
-- UPDATE students SET class_id = 'class_legacy' WHERE class_id IS NULL;
-- ALTER TABLE students ALTER COLUMN class_id SET NOT NULL;
-- ALTER TABLE students ADD CONSTRAINT fk_students_class_school FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT;
