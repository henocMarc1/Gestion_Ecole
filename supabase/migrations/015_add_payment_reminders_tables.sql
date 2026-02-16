-- Migration: Payment Reminders System (Relances)
-- Description: Tables for automated payment reminders and tracking
-- Created: 2026-01-16

-- =====================================================
-- PAYMENT_REMINDERS TABLE
-- =====================================================
DROP TABLE IF EXISTS payment_reminders CASCADE;

CREATE TABLE payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Configuration
    reminder_name VARCHAR(255) NOT NULL, -- Ex: "Relance 1ère échéance"
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('email', 'sms', 'both')),
    
    -- Targeting
    days_before_due INTEGER, -- Nombre de jours avant la date limite (-7 = 7 jours avant)
    target_amount_type VARCHAR(50) DEFAULT 'overdue' CHECK (target_amount_type IN ('due_soon', 'overdue', 'not_paid')),
    
    -- Template
    email_subject VARCHAR(255),
    email_template TEXT, -- HTML email template
    sms_template TEXT, -- SMS template (max 160 chars per message)
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_reminders_school_id ON payment_reminders(school_id);
CREATE INDEX idx_payment_reminders_active ON payment_reminders(is_active);

-- =====================================================
-- REMINDER_HISTORY TABLE
-- =====================================================
DROP TABLE IF EXISTS reminder_history CASCADE;

CREATE TABLE reminder_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    reminder_id UUID REFERENCES payment_reminders(id) ON DELETE SET NULL,
    
    -- Target Information
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tuition_fee_id UUID REFERENCES tuition_fees(id) ON DELETE SET NULL,
    
    -- Amount Information
    amount_due DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'XOF',
    
    -- Communication Details
    contact_type VARCHAR(20) CHECK (contact_type IN ('email', 'sms', 'both')),
    email_address VARCHAR(255),
    phone_number VARCHAR(20),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Response Tracking
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Payment Result
    payment_received_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reminder_history_school_id ON reminder_history(school_id);
CREATE INDEX idx_reminder_history_reminder_id ON reminder_history(reminder_id);
CREATE INDEX idx_reminder_history_parent_id ON reminder_history(parent_id);
CREATE INDEX idx_reminder_history_student_id ON reminder_history(student_id);
CREATE INDEX idx_reminder_history_status ON reminder_history(status);
CREATE INDEX idx_reminder_history_sent_at ON reminder_history(sent_at);
CREATE INDEX idx_reminder_history_payment_received_at ON reminder_history(payment_received_at);

-- =====================================================
-- UNPAID_INVOICES VIEW
-- =====================================================
DROP VIEW IF EXISTS unpaid_invoices_summary CASCADE;

CREATE VIEW unpaid_invoices_summary AS
SELECT
    i.id,
    i.school_id,
    i.student_id,
    ps.parent_id,
    s.first_name AS student_first_name,
    s.last_name AS student_last_name,
    u.email AS parent_email,
    u.phone AS parent_phone,
    i.total AS amount_due,
    i.due_date,
    CURRENT_DATE - i.due_date AS days_overdue,
    CASE
        WHEN CURRENT_DATE > i.due_date THEN 'overdue'
        WHEN CURRENT_DATE = i.due_date THEN 'due_today'
        WHEN CURRENT_DATE + INTERVAL '7 days' >= i.due_date THEN 'due_soon'
        ELSE 'not_due'
    END AS payment_status,
    (SELECT COUNT(*) FROM reminder_history 
     WHERE reminder_history.student_id = i.student_id 
     AND reminder_history.tuition_fee_id IS NOT NULL) AS reminder_count
FROM invoices i
JOIN students s ON i.student_id = s.id
LEFT JOIN parents_students ps ON ps.student_id = s.id AND ps.is_primary_contact = TRUE
LEFT JOIN users u ON ps.parent_id = u.id
WHERE i.status IN ('DRAFT', 'SENT', 'OVERDUE')
ORDER BY i.due_date ASC;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- PAYMENT_REMINDERS TABLE POLICIES
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- ACCOUNTANT and ADMIN can view reminders
CREATE POLICY "ACCOUNTANT and ADMIN can view reminders"
    ON payment_reminders FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can create reminders
CREATE POLICY "ACCOUNTANT and ADMIN can create reminders"
    ON payment_reminders FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can update reminders
CREATE POLICY "ACCOUNTANT and ADMIN can update reminders"
    ON payment_reminders FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can delete reminders
CREATE POLICY "ACCOUNTANT and ADMIN can delete reminders"
    ON payment_reminders FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- REMINDER_HISTORY TABLE POLICIES
ALTER TABLE reminder_history ENABLE ROW LEVEL SECURITY;

-- ACCOUNTANT and ADMIN can view history
CREATE POLICY "ACCOUNTANT and ADMIN can view reminder history"
    ON reminder_history FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can create history
CREATE POLICY "ACCOUNTANT and ADMIN can create reminder history"
    ON reminder_history FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- ACCOUNTANT and ADMIN can update history
CREATE POLICY "ACCOUNTANT and ADMIN can update reminder history"
    ON reminder_history FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- PARENTS can view their reminder history
CREATE POLICY "Parents can view their reminder history"
    ON reminder_history FOR SELECT
    USING (parent_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for payment_reminders
CREATE OR REPLACE FUNCTION update_payment_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_reminders_updated_at ON payment_reminders;
CREATE TRIGGER payment_reminders_updated_at
    BEFORE UPDATE ON payment_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_reminders_updated_at();

-- Update timestamp trigger for reminder_history
DROP TRIGGER IF EXISTS reminder_history_updated_at ON reminder_history;
CREATE TRIGGER reminder_history_updated_at
    BEFORE UPDATE ON reminder_history
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_reminders_updated_at();

-- Auto-update payment_received_at when payment is made
CREATE OR REPLACE FUNCTION check_payment_on_reminder_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all pending reminders for this student if full payment received
    UPDATE reminder_history
    SET payment_received_at = NOW(),
        status = 'delivered'
    WHERE student_id = NEW.student_id
    AND tuition_fee_id IS NOT NULL
    AND status IN ('sent', 'delivered');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_payment_trigger ON payments;
CREATE TRIGGER check_payment_trigger
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION check_payment_on_reminder_history();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE payment_reminders IS 'Configuration des relances de paiement automatiques';
COMMENT ON TABLE reminder_history IS 'Historique des relances envoyées';
COMMENT ON VIEW unpaid_invoices_summary IS 'Résumé des factures impayées avec statut de paiement';
