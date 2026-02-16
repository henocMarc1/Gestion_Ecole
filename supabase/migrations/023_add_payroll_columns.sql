-- Migration: Add notes and deductions columns to payrolls table
-- Description: Add notes field, CNPS and IRPP automatic deductions
-- Created: 2026-02-12

ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS cnps DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS irpp DECIMAL(12, 2) DEFAULT 0;
