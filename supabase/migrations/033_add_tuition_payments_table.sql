-- =====================================================
-- MIGRATION 033: Add missing tuition_payments table
-- =====================================================
-- Crée la table tuition_payments utilisée par l'application
-- Cette table enregistre les paiements effectués par les étudiants

CREATE TABLE IF NOT EXISTS tuition_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    tuition_fee_id UUID REFERENCES tuition_fees(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'check', 'transfer', 'online'
    reference VARCHAR(100), -- Numéro de chèque, référence virement, etc.
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes pour optimiser les requêtes
CREATE INDEX idx_tuition_payments_school ON tuition_payments(school_id);
CREATE INDEX idx_tuition_payments_student ON tuition_payments(student_id);
CREATE INDEX idx_tuition_payments_tuition_fee ON tuition_payments(tuition_fee_id);
CREATE INDEX idx_tuition_payments_date ON tuition_payments(payment_date);

-- =====================================================
-- RLS Policies pour tuition_payments
-- =====================================================

ALTER TABLE tuition_payments ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs de l'école peuvent voir les paiements
CREATE POLICY "tuition_payments_select"
    ON tuition_payments FOR SELECT
    USING (
        school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    );

-- Les secrétaires et comptables peuvent enregistrer les paiements
CREATE POLICY "tuition_payments_insert"
    ON tuition_payments FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SECRETARY')
        )
    );

-- Les secrétaires et comptables peuvent modifier les paiements
CREATE POLICY "tuition_payments_update"
    ON tuition_payments FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SECRETARY')
        )
    );

-- Les comptables peuvent supprimer les paiements
CREATE POLICY "tuition_payments_delete"
    ON tuition_payments FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM users 
            WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
        )
    );

-- Commentaires
COMMENT ON TABLE tuition_payments IS 'Enregistrement des paiements effectués par les étudiants';
COMMENT ON COLUMN tuition_payments.payment_method IS 'Méthode de paiement: cash, check, transfer, online';
COMMENT ON COLUMN tuition_payments.reference IS 'Numéro de chèque, référence virement, ou autre identifiant';
