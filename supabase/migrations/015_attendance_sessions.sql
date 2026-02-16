-- Add AM/PM sessions to attendance
DO $$
BEGIN
  -- Create enum type if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_session') THEN
    CREATE TYPE attendance_session AS ENUM ('MORNING', 'AFTERNOON');
  END IF;
END$$;

-- Add column session with default MORNING
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session attendance_session NOT NULL DEFAULT 'MORNING';

-- Drop existing unique constraint on (student_id, date)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_student_id_date_key'
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_date_key;
  END IF;
END$$;

-- Add new unique constraint including session
ALTER TABLE attendance
  ADD CONSTRAINT attendance_student_date_session_key UNIQUE (student_id, date, session);

-- Optional index on session
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session);

-- Note: RLS policies remain valid; they don't depend on session.
