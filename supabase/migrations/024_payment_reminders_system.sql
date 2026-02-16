-- Migration: Payment Reminders System
-- Description: Système de rappels de paiement avec exclusion automatique
-- Created: 2026-02-11

-- =====================================================
-- 1. AJOUTER CHAMP ÉCHÉANCE DANS LA TABLE CLASSES
-- =====================================================

-- Ajouter le jour d'échéance mensuel (1-31)
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT 5 CHECK (payment_due_day BETWEEN 1 AND 31);

COMMENT ON COLUMN classes.payment_due_day IS 'Jour du mois pour le paiement (ex: 5 = chaque 5 du mois)';

-- =====================================================
-- 2. TABLE PAYMENT_REMINDERS (Rappels de paiement)
-- =====================================================

DROP TABLE IF EXISTS payment_reminders CASCADE;

CREATE TABLE payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    
    -- Period Information
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    due_date DATE NOT NULL,
    
    -- Reminder Level
    reminder_level INTEGER NOT NULL CHECK (reminder_level IN (1, 2, 3)),
    -- 1 = Premier rappel (1-15 jours)
    -- 2 = Deuxième rappel (15-29 jours)
    -- 3 = Exclusion (30+ jours)
    
    days_overdue INTEGER NOT NULL DEFAULT 0,
    amount_due DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'paid', 'ignored', 'excluded')),
    
    -- Actions
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    excluded_at TIMESTAMPTZ,
    
    -- Notification
    notification_sent BOOLEAN DEFAULT false,
    notification_method VARCHAR(20), -- 'email', 'sms', 'app'
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte unique: un seul rappel par niveau par mois par étudiant
    UNIQUE(student_id, year, month, reminder_level)
);

-- Indexes
CREATE INDEX idx_payment_reminders_school ON payment_reminders(school_id);
CREATE INDEX idx_payment_reminders_student ON payment_reminders(student_id);
CREATE INDEX idx_payment_reminders_parent ON payment_reminders(parent_id);
CREATE INDEX idx_payment_reminders_class ON payment_reminders(class_id);
CREATE INDEX idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX idx_payment_reminders_level ON payment_reminders(reminder_level);
CREATE INDEX idx_payment_reminders_due_date ON payment_reminders(due_date);

-- =====================================================
-- 3. FONCTION: CALCULER LES JOURS DE RETARD
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_days_overdue(due_date DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN GREATEST(0, CURRENT_DATE - due_date);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FONCTION: VÉRIFIER LES PAIEMENTS EN RETARD
-- =====================================================

CREATE OR REPLACE FUNCTION check_overdue_payments()
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    parent_id UUID,
    parent_name TEXT,
    class_id UUID,
    class_name TEXT,
    school_id UUID,
    month INTEGER,
    year INTEGER,
    due_date DATE,
    days_overdue INTEGER,
    amount_due DECIMAL,
    reminder_level INTEGER,
    should_exclude BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS student_id,
        (s.first_name || ' ' || s.last_name) AS student_name,
        ps.parent_id,
        u.full_name AS parent_name,
        s.class_id,
        c.name AS class_name,
        s.school_id,
        EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS month,
        EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS year,
        (DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE AS due_date,
        calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) AS days_overdue,
        COALESCE(
            (SELECT amount - paid_amount 
             FROM tuition_fees 
             WHERE student_id = s.id 
             AND year_id = (SELECT id FROM years WHERE is_current = true LIMIT 1)
             LIMIT 1),
            0
        ) AS amount_due,
        CASE 
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) BETWEEN 1 AND 14 THEN 1
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) BETWEEN 15 AND 29 THEN 2
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) >= 30 THEN 3
            ELSE 0
        END AS reminder_level,
        calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) >= 30 AS should_exclude
    FROM students s
    INNER JOIN classes c ON s.class_id = c.id
    INNER JOIN parents_students ps ON s.id = ps.student_id AND ps.is_primary_contact = true
    INNER JOIN users u ON ps.parent_id = u.id
    LEFT JOIN tuition_fees tf ON s.id = tf.student_id 
        AND tf.year_id = (SELECT id FROM years WHERE is_current = true LIMIT 1)
    WHERE 
        s.deleted_at IS NULL
        AND s.status = 'active'
        AND calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) > 0
        AND (tf.paid_amount IS NULL OR tf.paid_amount < tf.amount);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. FONCTION: CRÉER LES RAPPELS AUTOMATIQUEMENT
-- =====================================================

CREATE OR REPLACE FUNCTION create_payment_reminders()
RETURNS INTEGER AS $$
DECLARE
    reminder_count INTEGER := 0;
    overdue_record RECORD;
BEGIN
    -- Parcourir tous les étudiants en retard
    FOR overdue_record IN SELECT * FROM check_overdue_payments()
    LOOP
        -- Insérer le rappel s'il n'existe pas déjà
        INSERT INTO payment_reminders (
            school_id,
            student_id,
            parent_id,
            class_id,
            month,
            year,
            due_date,
            reminder_level,
            days_overdue,
            amount_due,
            status,
            notification_sent
        )
        VALUES (
            overdue_record.school_id,
            overdue_record.student_id,
            overdue_record.parent_id,
            overdue_record.class_id,
            overdue_record.month,
            overdue_record.year,
            overdue_record.due_date,
            overdue_record.reminder_level,
            overdue_record.days_overdue,
            overdue_record.amount_due,
            CASE 
                WHEN overdue_record.should_exclude THEN 'excluded'
                ELSE 'sent'
            END,
            false
        )
        ON CONFLICT (student_id, year, month, reminder_level) DO UPDATE
        SET 
            days_overdue = overdue_record.days_overdue,
            amount_due = overdue_record.amount_due,
            status = CASE 
                WHEN overdue_record.should_exclude THEN 'excluded'
                ELSE payment_reminders.status
            END,
            excluded_at = CASE 
                WHEN overdue_record.should_exclude THEN NOW()
                ELSE payment_reminders.excluded_at
            END,
            updated_at = NOW();
        
        reminder_count := reminder_count + 1;
    END LOOP;
    
    RETURN reminder_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FONCTION: EXCLURE AUTOMATIQUEMENT LES ÉTUDIANTS
-- =====================================================

CREATE OR REPLACE FUNCTION auto_exclude_students()
RETURNS INTEGER AS $$
DECLARE
    excluded_count INTEGER := 0;
BEGIN
    -- Marquer les étudiants comme exclus après 30 jours
    UPDATE students
    SET 
        status = 'suspended',
        updated_at = NOW()
    WHERE id IN (
        SELECT DISTINCT student_id
        FROM payment_reminders
        WHERE reminder_level = 3
        AND status = 'excluded'
        AND excluded_at IS NOT NULL
    )
    AND status = 'active';
    
    GET DIAGNOSTICS excluded_count = ROW_COUNT;
    
    RETURN excluded_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. FONCTION: ENVOYER NOTIFICATIONS (À IMPLÉMENTER)
-- =====================================================

CREATE OR REPLACE FUNCTION send_payment_notifications()
RETURNS INTEGER AS $$
DECLARE
    notification_count INTEGER := 0;
BEGIN
    -- Cette fonction sera appelée par l'application pour envoyer les notifications
    -- Elle marque les rappels comme "notification envoyée"
    
    UPDATE payment_reminders
    SET 
        notification_sent = true,
        notification_method = 'app',
        updated_at = NOW()
    WHERE 
        notification_sent = false
        AND status = 'sent';
    
    GET DIAGNOSTICS notification_count = ROW_COUNT;
    
    RETURN notification_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. RLS POLICIES POUR PAYMENT_REMINDERS
-- =====================================================

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- Admin et HR peuvent tout voir
CREATE POLICY "Admin can view all payment reminders"
    ON payment_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'SECRETARY')
            AND (users.school_id = payment_reminders.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- Parents peuvent voir leurs propres rappels
CREATE POLICY "Parents can view their own reminders"
    ON payment_reminders FOR SELECT
    USING (parent_id = auth.uid());

-- Admin peut créer/modifier/supprimer
CREATE POLICY "Admin can manage payment reminders"
    ON payment_reminders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT')
            AND (users.school_id = payment_reminders.school_id OR users.role = 'SUPER_ADMIN')
        )
    );

-- =====================================================
-- 9. TRIGGER: AUTO-UPDATE TIMESTAMP
-- =====================================================

CREATE OR REPLACE FUNCTION update_payment_reminders_timestamp()
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
    EXECUTE FUNCTION update_payment_reminders_timestamp();

-- =====================================================
-- 10. VUES PRATIQUES
-- =====================================================

-- Vue: Rappels actifs
CREATE OR REPLACE VIEW active_payment_reminders AS
SELECT 
    pr.*,
    s.first_name || ' ' || s.last_name AS student_name,
    s.matricule AS student_matricule,
    u.full_name AS parent_name,
    u.email AS parent_email,
    u.phone AS parent_phone,
    c.name AS class_name,
    c.level AS class_level
FROM payment_reminders pr
INNER JOIN students s ON pr.student_id = s.id
INNER JOIN users u ON pr.parent_id = u.id
INNER JOIN classes c ON pr.class_id = c.id
WHERE pr.status IN ('sent', 'excluded')
ORDER BY pr.days_overdue DESC, pr.created_at DESC;

-- Vue: Statistiques de retard par classe
CREATE OR REPLACE VIEW payment_overdue_stats AS
SELECT 
    c.id AS class_id,
    c.name AS class_name,
    c.payment_due_day,
    COUNT(DISTINCT pr.student_id) AS students_overdue,
    COUNT(DISTINCT CASE WHEN pr.reminder_level = 1 THEN pr.student_id END) AS level_1_count,
    COUNT(DISTINCT CASE WHEN pr.reminder_level = 2 THEN pr.student_id END) AS level_2_count,
    COUNT(DISTINCT CASE WHEN pr.reminder_level = 3 THEN pr.student_id END) AS excluded_count,
    SUM(pr.amount_due) AS total_amount_due,
    AVG(pr.days_overdue) AS avg_days_overdue
FROM classes c
LEFT JOIN payment_reminders pr ON c.id = pr.class_id AND pr.status IN ('sent', 'excluded')
GROUP BY c.id, c.name, c.payment_due_day;

-- =====================================================
-- 11. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE payment_reminders IS 'Rappels de paiement automatiques avec système d''exclusion progressive';
COMMENT ON FUNCTION check_overdue_payments() IS 'Vérifie tous les étudiants en retard de paiement';
COMMENT ON FUNCTION create_payment_reminders() IS 'Crée automatiquement les rappels de paiement';
COMMENT ON FUNCTION auto_exclude_students() IS 'Exclut automatiquement les étudiants après 30 jours de retard';

-- =====================================================
-- 12. DONNÉES INITIALES (OPTIONNEL)
-- =====================================================

-- Définir l'échéance par défaut pour les classes existantes
UPDATE classes 
SET payment_due_day = 5 
WHERE payment_due_day IS NULL;

-- =====================================================
-- 13. TEST DE LA FONCTION
-- =====================================================

-- Pour tester manuellement:
-- SELECT * FROM check_overdue_payments();
-- SELECT create_payment_reminders();
-- SELECT auto_exclude_students();

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
