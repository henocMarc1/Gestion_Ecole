-- Migration: Improved Late Payment System
-- Description: Ajout de pénalités, arrangements de paiement, escalade, et blocage de documents
-- Created: 2026-02-11

-- =====================================================
-- PHASE 1: LATE PAYMENT FEES & ARRANGEMENTS
-- =====================================================

-- =====================================================
-- TABLE: late_payment_fee_settings
-- =====================================================
DROP TABLE IF EXISTS late_payment_fee_settings CASCADE;

CREATE TABLE late_payment_fee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Type de calcul des frais
    fee_type VARCHAR(50) NOT NULL CHECK (fee_type IN ('flat_fee', 'percentage', 'progressive')),
    
    -- Pour frais fixes
    flat_amount DECIMAL(10, 2) DEFAULT 0 CHECK (flat_amount >= 0), -- Ex: 5000 XOF
    
    -- Pour pourcentage
    percentage_per_month DECIMAL(5, 2) DEFAULT 0 CHECK (percentage_per_month >= 0), -- Ex: 2% par mois
    max_percentage DECIMAL(5, 2) DEFAULT 15 CHECK (max_percentage >= 0), -- Cap max: 15%
    
    -- Pour progressif (paliers de frais)
    progressive_tier_1_days INTEGER DEFAULT 30, -- Jours avant 1ère pénalité
    progressive_tier_1_fee DECIMAL(10, 2) DEFAULT 0, -- Montant tier 1
    
    progressive_tier_2_days INTEGER DEFAULT 60, -- Jours avant 2ème pénalité
    progressive_tier_2_fee DECIMAL(10, 2) DEFAULT 0, -- Montant tier 2
    
    progressive_tier_3_days INTEGER DEFAULT 90, -- Jours avant 3ème pénalité
    progressive_tier_3_fee DECIMAL(10, 2) DEFAULT 0, -- Montant tier 3
    
    -- Configuration
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id) -- Une seule config par école
);

CREATE INDEX idx_late_payment_fees_school ON late_payment_fee_settings(school_id);

COMMENT ON TABLE late_payment_fee_settings IS 'Configuration des frais de retard pour chaque école';
COMMENT ON COLUMN late_payment_fee_settings.fee_type IS 'Type: frais fixes, pourcentage, ou progressif';

-- =====================================================
-- TABLE: payment_arrangements
-- =====================================================
DROP TABLE IF EXISTS payment_arrangements CASCADE;

CREATE TABLE payment_arrangements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Dates
    original_due_date DATE NOT NULL,
    new_due_date DATE NOT NULL,
    
    -- Type d'arrangement
    arrangement_type VARCHAR(50) NOT NULL CHECK (arrangement_type IN ('full_defer', 'partial_payment', 'installments')),
    
    -- Pour échelonnement
    num_installments INTEGER,
    installment_amount DECIMAL(10, 2),
    first_installment_date DATE,
    
    -- Raison du retard
    justification TEXT,
    supporting_document_url TEXT, -- Preuve (photo, document, etc.)
    
    -- Statut
    status VARCHAR(50) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'completed', 'defaulted')),
    
    -- Dates importantes
    proposed_at TIMESTAMPTZ DEFAULT NOW(),
    proposed_by UUID REFERENCES users(id), -- Comptable qui propose
    accepted_at TIMESTAMPTZ,
    accepted_by_parent UUID REFERENCES users(id),
    accepted_by_student UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Parcours et notes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(invoice_id, status) -- Une seule par facture active
);

CREATE INDEX idx_payment_arrangements_school ON payment_arrangements(school_id);
CREATE INDEX idx_payment_arrangements_student ON payment_arrangements(student_id);
CREATE INDEX idx_payment_arrangements_invoice ON payment_arrangements(invoice_id);
CREATE INDEX idx_payment_arrangements_status ON payment_arrangements(status);

COMMENT ON TABLE payment_arrangements IS 'Plans de paiement échelonné ou différé proposés pour les retards';
COMMENT ON COLUMN payment_arrangements.arrangement_type IS 'full_defer: reporte date complet, partial_payment: paie une part now, installments: échelonne';

-- =====================================================
-- PHASE 2: ESCALATION SYSTEM
-- =====================================================

-- =====================================================
-- TABLE: escalation_levels
-- =====================================================
DROP TABLE IF EXISTS escalation_levels CASCADE;

CREATE TABLE escalation_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Paramètres d'escalade
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    level_name VARCHAR(100) NOT NULL, -- "Avertissement doux", "1ère relance", etc.
    level_description TEXT,
    
    -- Déclenchement
    days_overdue_min INTEGER NOT NULL CHECK (days_overdue_min >= 0), -- 0, 6, 16, 31, 61
    days_overdue_max INTEGER NOT NULL CHECK (days_overdue_max > days_overdue_min),
    
    -- Actions de communication
    send_email BOOLEAN DEFAULT TRUE,
    send_sms BOOLEAN DEFAULT FALSE,
    email_subject VARCHAR(255),
    email_template TEXT, -- HTML template
    sms_template TEXT, -- Max 160 chars
    
    -- Notifications internes
    notify_accountant BOOLEAN DEFAULT FALSE,
    notify_principal BOOLEAN DEFAULT FALSE,
    notify_admin BOOLEAN DEFAULT FALSE,
    
    -- Restrictions
    block_documents BOOLEAN DEFAULT FALSE, -- Bloquer certificats, bulletins
    block_portal_access BOOLEAN DEFAULT FALSE, -- Bloquer accès parent
    
    -- Frais supplémentaires
    apply_late_fee BOOLEAN DEFAULT FALSE,
    override_fee_amount DECIMAL(10, 2), -- Si défini, utiliser ce montant au lieu calcul
    
    -- Ordre de traitement
    execution_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id, level)
);

CREATE INDEX idx_escalation_levels_school ON escalation_levels(school_id);
CREATE INDEX idx_escalation_levels_active ON escalation_levels(is_active);

COMMENT ON TABLE escalation_levels IS 'Niveaux d''escalade définis par école pour gestion des retards';
COMMENT ON COLUMN escalation_levels.days_overdue_min IS 'Nombre minimum de jours de retard pour déclencher ce niveau';
COMMENT ON COLUMN escalation_levels.block_documents IS 'Si TRUE, empêcher accès bulletins, certificats, relevés';

-- =====================================================
-- TABLE: escalation_history
-- =====================================================
DROP TABLE IF EXISTS escalation_history CASCADE;

CREATE TABLE escalation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Entité affectée
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    escalation_level_id UUID NOT NULL REFERENCES escalation_levels(id),
    
    -- Timeline
    escalated_at TIMESTAMPTZ DEFAULT NOW(),
    escalated_by UUID REFERENCES users(id), -- Système ou manuel
    at_days_overdue INTEGER, -- Nombre de jours retard quand escaladé
    
    -- Actions exécutées
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    sms_sent BOOLEAN DEFAULT FALSE,
    sms_sent_at TIMESTAMPTZ,
    
    documents_blocked BOOLEAN DEFAULT FALSE,
    documents_blocked_at TIMESTAMPTZ,
    documents_block_id UUID, -- Référence à document_access_restrictions.id
    
    late_fee_applied BOOLEAN DEFAULT FALSE,
    late_fee_applied_at TIMESTAMPTZ,
    late_fee_amount DECIMAL(10, 2),
    
    -- Notifications internes envoyées
    notifications_sent_to TEXT[], -- Array d'emails de destinataires
    
    -- Résolution
    resolved_by_payment BOOLEAN DEFAULT FALSE,
    resolved_by_arrangement BOOLEAN DEFAULT FALSE,
    resolved_by_admin BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escalation_history_school ON escalation_history(school_id);
CREATE INDEX idx_escalation_history_student ON escalation_history(student_id);
CREATE INDEX idx_escalation_history_invoice ON escalation_history(invoice_id);
CREATE INDEX idx_escalation_history_escalated_at ON escalation_history(escalated_at);

COMMENT ON TABLE escalation_history IS 'Historique de chaque escalade appliquée avec actions prises';

-- =====================================================
-- TABLE: document_access_restrictions
-- =====================================================
DROP TABLE IF EXISTS document_access_restrictions CASCADE;

CREATE TABLE document_access_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Document restreint
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('bulletin', 'certificat_scolarite', 'releve_notes', 'diplome', 'attestation')),
    
    -- Document bloqueur
    related_invoice_id UUID REFERENCES invoices(id),
    
    -- Raison du blocage
    restriction_reason VARCHAR(100) NOT NULL CHECK (restriction_reason IN ('payment_overdue', 'unpaid_fees', 'disciplinary')),
    amount_due_at_blocking DECIMAL(10, 2),
    days_overdue_at_blocking INTEGER,
    
    -- Blocage
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_by UUID REFERENCES users(id),
    blocked_until_date DATE,
    
    -- Conditions de déblocage
    requires_payment BOOLEAN DEFAULT TRUE,
    payment_amount_required DECIMAL(10, 2),
    payment_method_required VARCHAR(50), -- Si non null, limiter à certaines méthodes
    
    -- Déblocage
    unblocked_at TIMESTAMPTZ,
    unblocked_by UUID REFERENCES users(id),
    unblock_reason TEXT, -- 'payment_received', 'director_override', 'dispute_resolved'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_restrictions_school ON document_access_restrictions(school_id);
CREATE INDEX idx_document_restrictions_student ON document_access_restrictions(student_id);
CREATE INDEX idx_document_restrictions_type ON document_access_restrictions(document_type);
CREATE INDEX idx_document_restrictions_active ON document_access_restrictions(blocked_at) WHERE unblocked_at IS NULL;

COMMENT ON TABLE document_access_restrictions IS 'Blocage d''accès aux documents en cas de retard de paiement';
COMMENT ON COLUMN document_access_restrictions.document_type IS 'Type de document restreint';

-- =====================================================
-- ALTER EXISTING TABLES
-- =====================================================

-- Ajouter colonnes à invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fees_applied DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fees_by_escalation DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS current_escalation_level INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS escalation_started_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS documents_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS blocked_document_count INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS arrangement_id UUID REFERENCES payment_arrangements(id);

-- Ajouter colonnes à reminder_history
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS escalation_level_id UUID REFERENCES escalation_levels(id);
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS escalation_level INTEGER;
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS parent_response TEXT;
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS parent_response_at TIMESTAMPTZ;
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS action_taken VARCHAR(100);
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ;
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS action_taken_by UUID REFERENCES users(id);

-- =====================================================
-- HELPER VIEW: Students with overdue and escalation status
-- =====================================================
DROP VIEW IF EXISTS student_payment_status CASCADE;

CREATE VIEW student_payment_status AS
SELECT
    s.id,
    s.school_id,
    s.first_name,
    s.last_name,
    c.id as class_id,
    c.name as class_name,
    
    -- Facturation
    COUNT(DISTINCT i.id) as invoice_count,
    SUM(CASE WHEN i.status IN ('SENT', 'OVERDUE') THEN i.total ELSE 0 END) as total_due,
    SUM(CASE WHEN i.status = 'OVERDUE' THEN i.total ELSE 0 END) as total_overdue,
    SUM(CASE WHEN i.status = 'PAID' THEN i.total ELSE 0 END) as total_paid,
    
    -- Retards
    MAX(CASE WHEN i.status = 'OVERDUE' THEN CURRENT_DATE - i.due_date ELSE 0 END) as max_days_overdue,
    AVG(CASE WHEN i.status = 'OVERDUE' THEN CURRENT_DATE - i.due_date ELSE NULL END) as avg_days_overdue,
    
    -- Frais appliqués
    SUM(COALESCE(i.late_fees_applied, 0)) as total_late_fees,
    
    -- Escalade
    MAX(i.current_escalation_level) as current_escalation_level,
    MIN(CASE WHEN i.documents_blocked THEN 1 ELSE 0 END) as has_blocked_documents,
    
    -- Arrangement
    MAX(CASE WHEN pa.status IN ('proposed', 'accepted') THEN 1 ELSE 0 END) as has_active_arrangement,
    
    -- Dernier événement
    GREATEST(
        COALESCE(MAX(i.updated_at), '1900-01-01'::TIMESTAMPTZ),
        COALESCE(MAX(eh.escalated_at), '1900-01-01'::TIMESTAMPTZ),
        COALESCE(MAX(pa.updated_at), '1900-01-01'::TIMESTAMPTZ)
    ) as last_activity
    
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN invoices i ON s.id = i.student_id
LEFT JOIN escalation_history eh ON i.id = eh.invoice_id
LEFT JOIN payment_arrangements pa ON i.id = pa.invoice_id
WHERE s.school_id = (SELECT school_id FROM users WHERE id = auth.uid() LIMIT 1)
GROUP BY s.id, s.school_id, s.first_name, s.last_name, c.id, c.name;

COMMENT ON VIEW student_payment_status IS 'Vue synthétique du statut de paiement de chaque étudiant avec escalade';

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- late_payment_fee_settings RLS
ALTER TABLE late_payment_fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN and ACCOUNTANT can view late fee settings"
    ON late_payment_fee_settings FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT')
        )
    );

CREATE POLICY "ADMIN can update late fee settings"
    ON late_payment_fee_settings FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- payment_arrangements RLS
ALTER TABLE payment_arrangements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ACCOUNTANT and ADMIN can view arrangements"
    ON payment_arrangements FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Parents can view their own arrangements"
    ON payment_arrangements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parents_students ps
            WHERE ps.student_id = payment_arrangements.student_id
            AND ps.parent_id = auth.uid()
        )
    );

CREATE POLICY "ACCOUNTANT can create arrangements"
    ON payment_arrangements FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Parent can accept arrangement"
    ON payment_arrangements FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM parents_students ps
            WHERE ps.student_id = payment_arrangements.student_id
            AND ps.parent_id = auth.uid()
        )
    );

-- escalation_levels RLS
ALTER TABLE escalation_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN can manage escalation levels"
    ON escalation_levels FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- escalation_history RLS
ALTER TABLE escalation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ACCOUNTANT and ADMIN can view escalation history"
    ON escalation_history FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

-- document_access_restrictions RLS
ALTER TABLE document_access_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ACCOUNTANT and ADMIN can view document restrictions"
    ON document_access_restrictions FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Parents can view their own restrictions"
    ON document_access_restrictions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parents_students ps
            WHERE ps.student_id = document_access_restrictions.student_id
            AND ps.parent_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS late_payment_fees_updated_at ON late_payment_fee_settings;
CREATE TRIGGER late_payment_fees_updated_at
    BEFORE UPDATE ON late_payment_fee_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS payment_arrangements_updated_at ON payment_arrangements;
CREATE TRIGGER payment_arrangements_updated_at
    BEFORE UPDATE ON payment_arrangements
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS escalation_levels_updated_at ON escalation_levels;
CREATE TRIGGER escalation_levels_updated_at
    BEFORE UPDATE ON escalation_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS document_restrictions_updated_at ON document_access_restrictions;
CREATE TRIGGER document_restrictions_updated_at
    BEFORE UPDATE ON document_access_restrictions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Afficher les tables créées
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'late_payment_fee_settings',
    'payment_arrangements',
    'escalation_levels',
    'escalation_history',
    'document_access_restrictions'
)
ORDER BY tablename;
