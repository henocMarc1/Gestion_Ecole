-- Migration: Add Payrolls Table
-- Description: Table for managing employee payroll/salary information
-- Created: 2026-02-10

-- =====================================================
-- PAYROLLS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    
    -- Period Information
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    
    -- Salary Components
    base_salary DECIMAL(12, 2) DEFAULT 0,
    bonuses DECIMAL(12, 2) DEFAULT 0,
    deductions DECIMAL(12, 2) DEFAULT 0,
    net_salary DECIMAL(12, 2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROCESSED', 'PAID')),
    payment_date TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_payroll UNIQUE (school_id, employee_id, period)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payrolls_school_id ON payrolls(school_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_employee_id ON payrolls(employee_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_period ON payrolls(period);
CREATE INDEX IF NOT EXISTS idx_payrolls_status ON payrolls(status);
CREATE INDEX IF NOT EXISTS idx_payrolls_school_period ON payrolls(school_id, period);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

-- ACCOUNTANT and ADMIN can view payrolls for their school
CREATE POLICY "ACCOUNTANT and ADMIN can view payrolls"
    ON payrolls FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can insert payrolls
CREATE POLICY "ACCOUNTANT and ADMIN can insert payrolls"
    ON payrolls FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can update payrolls
CREATE POLICY "ACCOUNTANT and ADMIN can update payrolls"
    ON payrolls FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    )
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can delete payrolls
CREATE POLICY "ACCOUNTANT and ADMIN can delete payrolls"
    ON payrolls FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- SUPER_ADMIN can do anything with payrolls
CREATE POLICY "SUPER_ADMIN can do anything with payrolls"
    ON payrolls FOR ALL
    USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');
