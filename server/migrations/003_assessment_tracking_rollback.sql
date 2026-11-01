-- Rollback 003: Persistent Assessment Tracking & Admin Reporting
-- WARNING: Executing this will drop the assessment tracking views and tables.

DROP VIEW IF EXISTS student_module_progress CASCADE;
DROP TABLE IF EXISTS question_attempts CASCADE;
DROP TABLE IF EXISTS assessment_sessions CASCADE;

-- Optional column cleanups if completely rolling back:
-- ALTER TABLE students DROP COLUMN IF EXISTS student_name;
-- ALTER TABLE students DROP COLUMN IF EXISTS section;
-- ALTER TABLE students DROP COLUMN IF EXISTS roll_number;
-- ALTER TABLE students DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE students DROP COLUMN IF EXISTS updated_at;

-- ALTER TABLE schools DROP COLUMN IF EXISTS school_name;
-- ALTER TABLE schools DROP COLUMN IF EXISTS school_code;
-- ALTER TABLE schools DROP COLUMN IF EXISTS address;
-- ALTER TABLE schools DROP COLUMN IF EXISTS academic_year;
-- ALTER TABLE schools DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE schools DROP COLUMN IF EXISTS updated_at;
