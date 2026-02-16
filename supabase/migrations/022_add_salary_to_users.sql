-- Add salary column to users table for employee salary base
ALTER TABLE users ADD COLUMN salary DECIMAL(12, 2) DEFAULT 0;

-- Create index for quick lookup
CREATE INDEX idx_users_salary ON users(school_id, role) WHERE deleted_at IS NULL AND salary > 0;
