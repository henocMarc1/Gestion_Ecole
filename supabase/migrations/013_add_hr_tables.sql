-- Migration: HR Management System
-- Description: Tables for employee management, attendance tracking, and leave requests
-- Created: 2026-01-16

-- =====================================================
-- EMPLOYEES TABLE
-- =====================================================
DROP TABLE IF EXISTS employees CASCADE;

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to user account if exists
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('M', 'F', 'Autre')),
    address TEXT,
    
    -- Employment Information
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    position VARCHAR(100) NOT NULL, -- Enseignant, Secrétaire, Comptable, etc.
    department VARCHAR(100), -- Département/Service
    employment_type VARCHAR(50) CHECK (employment_type IN ('CDI', 'CDD', 'Stage', 'Vacation')),
    hire_date DATE NOT NULL,
    contract_end_date DATE, -- For CDD/Stage
    
    -- Salary Information
    base_salary DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'XOF',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended', 'terminated')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_employee_number_per_school UNIQUE (school_id, employee_number)
);

-- Index for common queries
DROP INDEX IF EXISTS idx_employees_school_id;
DROP INDEX IF EXISTS idx_employees_user_id;
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_position;

CREATE INDEX idx_employees_school_id ON employees(school_id);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_position ON employees(position);

-- =====================================================
-- ATTENDANCE_RECORDS TABLE (Pointage)
-- =====================================================
DROP TABLE IF EXISTS attendance_records CASCADE;

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Attendance Information
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
    
    -- Additional Information
    overtime_hours DECIMAL(4, 2) DEFAULT 0, -- Heures supplémentaires
    late_minutes INTEGER DEFAULT 0, -- Retard en minutes
    notes TEXT,
    
    -- Metadata
    recorded_by UUID REFERENCES users(id), -- Who recorded this
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
);

-- Indexes
DROP INDEX IF EXISTS idx_attendance_school_id;
DROP INDEX IF EXISTS idx_attendance_employee_id;
DROP INDEX IF EXISTS idx_attendance_date;
DROP INDEX IF EXISTS idx_attendance_status;

CREATE INDEX idx_attendance_school_id ON attendance_records(school_id);
CREATE INDEX idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_status ON attendance_records(status);

-- =====================================================
-- LEAVE_REQUESTS TABLE (Demandes de congés)
-- =====================================================
DROP TABLE IF EXISTS leave_requests CASCADE;

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Leave Information
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    
    -- Approval Information
    reviewed_by UUID REFERENCES users(id), -- Who approved/rejected
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_total_days CHECK (total_days > 0)
);

-- Indexes
DROP INDEX IF EXISTS idx_leave_requests_school_id;
DROP INDEX IF EXISTS idx_leave_requests_employee_id;
DROP INDEX IF EXISTS idx_leave_requests_status;
DROP INDEX IF EXISTS idx_leave_requests_dates;

CREATE INDEX idx_leave_requests_school_id ON leave_requests(school_id);
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- =====================================================
-- EMPLOYEE_DOCUMENTS TABLE (Documents RH)
-- =====================================================
DROP TABLE IF EXISTS employee_documents CASCADE;

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Document Information
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('contract', 'id_card', 'diploma', 'certificate', 'medical', 'other')),
    document_name VARCHAR(255) NOT NULL,
    file_url TEXT, -- URL to stored document
    file_size INTEGER, -- In bytes
    mime_type VARCHAR(100),
    
    -- Expiration (for documents like ID cards)
    expiration_date DATE,
    
    -- Metadata
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
DROP INDEX IF EXISTS idx_employee_documents_school_id;
DROP INDEX IF EXISTS idx_employee_documents_employee_id;
DROP INDEX IF EXISTS idx_employee_documents_type;

CREATE INDEX idx_employee_documents_school_id ON employee_documents(school_id);
CREATE INDEX idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX idx_employee_documents_type ON employee_documents(document_type);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- EMPLOYEES TABLE POLICIES
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- HR and ADMIN can view all employees in their school
CREATE POLICY "HR and ADMIN can view employees"
    ON employees FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can insert employees
CREATE POLICY "HR and ADMIN can insert employees"
    ON employees FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can update employees
CREATE POLICY "HR and ADMIN can update employees"
    ON employees FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can delete employees
CREATE POLICY "HR and ADMIN can delete employees"
    ON employees FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Employees can view their own record
CREATE POLICY "Employees can view their own record"
    ON employees FOR SELECT
    USING (user_id = auth.uid());

-- Authenticated users can view employees from their school (for app functionality)
CREATE POLICY "Authenticated users can view employees in their school"
    ON employees FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid()
        )
    );

-- ATTENDANCE_RECORDS TABLE POLICIES
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- HR and ADMIN can view all attendance records
CREATE POLICY "HR and ADMIN can view attendance records"
    ON attendance_records FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can insert attendance records
CREATE POLICY "HR and ADMIN can insert attendance records"
    ON attendance_records FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can update attendance records
CREATE POLICY "HR and ADMIN can update attendance records"
    ON attendance_records FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can delete attendance records
CREATE POLICY "HR and ADMIN can delete attendance records"
    ON attendance_records FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Employees can view their own attendance
CREATE POLICY "Employees can view their own attendance"
    ON attendance_records FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- LEAVE_REQUESTS TABLE POLICIES
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- HR and ADMIN can view all leave requests
CREATE POLICY "HR and ADMIN can view leave requests"
    ON leave_requests FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Employees can view their own leave requests
CREATE POLICY "Employees can view their own leave requests"
    ON leave_requests FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- Employees can create leave requests
CREATE POLICY "Employees can create leave requests"
    ON leave_requests FOR INSERT
    WITH CHECK (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- HR and ADMIN can update leave requests (for approval/rejection)
CREATE POLICY "HR and ADMIN can update leave requests"
    ON leave_requests FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Employees can update their pending leave requests
CREATE POLICY "Employees can update their pending leave requests"
    ON leave_requests FOR UPDATE
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        ) AND status = 'pending'
    );

-- HR and ADMIN can delete leave requests
CREATE POLICY "HR and ADMIN can delete leave requests"
    ON leave_requests FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- EMPLOYEE_DOCUMENTS TABLE POLICIES
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- HR and ADMIN can view all documents
CREATE POLICY "HR and ADMIN can view employee documents"
    ON employee_documents FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can insert documents
CREATE POLICY "HR and ADMIN can insert employee documents"
    ON employee_documents FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can update documents
CREATE POLICY "HR and ADMIN can update employee documents"
    ON employee_documents FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- HR and ADMIN can delete documents
CREATE POLICY "HR and ADMIN can delete employee documents"
    ON employee_documents FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- Employees can view their own documents
CREATE POLICY "Employees can view their own documents"
    ON employee_documents FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for employees
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_updated_at ON employees;
CREATE TRIGGER employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_employees_updated_at();

-- Update timestamp trigger for attendance_records
DROP TRIGGER IF EXISTS attendance_records_updated_at ON attendance_records;
CREATE TRIGGER attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_employees_updated_at();

-- Update timestamp trigger for leave_requests
DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_employees_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE employees IS 'Personnel et employés de l''école';
COMMENT ON TABLE attendance_records IS 'Pointage et présences du personnel';
COMMENT ON TABLE leave_requests IS 'Demandes de congés et absences';
COMMENT ON TABLE employee_documents IS 'Documents RH (contrats, diplômes, etc.)';
