-- =====================================================
-- MIGRATION: Ajouter tables frais de scolarité
-- =====================================================
-- Cette migration crée les tables pour gérer les frais
-- de scolarité par classe et les échéanciers mensuels

-- TABLE: tuition_fees (Frais de scolarité par classe)
-- =====================================================
CREATE TABLE IF NOT EXISTS tuition_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year VARCHAR(20) NOT NULL, -- ex: "2025-2026"
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  registration_fee DECIMAL(10, 2) DEFAULT 0 CHECK (registration_fee >= 0),
  other_fees DECIMAL(10, 2) DEFAULT 0 CHECK (other_fees >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, academic_year) -- Un tarif par classe par année scolaire
);

-- TABLE: payment_schedules (Échéanciers de paiement)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tuition_fee_id UUID NOT NULL REFERENCES tuition_fees(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  due_month INTEGER NOT NULL CHECK (due_month BETWEEN 1 AND 12), -- 1=Janvier, 12=Décembre
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  description VARCHAR(100), -- ex: "1ère tranche", "2ème tranche"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tuition_fee_id, installment_number)
);

-- INDEX pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_tuition_fees_school ON tuition_fees(school_id);
CREATE INDEX IF NOT EXISTS idx_tuition_fees_class ON tuition_fees(class_id);
CREATE INDEX IF NOT EXISTS idx_tuition_fees_year ON tuition_fees(academic_year);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_tuition ON payment_schedules(tuition_fee_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_month ON payment_schedules(due_month);

-- Commentaires
COMMENT ON TABLE tuition_fees IS 'Frais de scolarité définis par classe et année scolaire';
COMMENT ON COLUMN tuition_fees.academic_year IS 'Année scolaire (ex: 2025-2026)';
COMMENT ON COLUMN tuition_fees.total_amount IS 'Montant total annuel de la scolarité';
COMMENT ON COLUMN tuition_fees.registration_fee IS 'Frais d''inscription';
COMMENT ON COLUMN tuition_fees.other_fees IS 'Autres frais (assurance, fournitures, etc.)';

COMMENT ON TABLE payment_schedules IS 'Échéanciers de paiement mensuel pour les frais de scolarité';
COMMENT ON COLUMN payment_schedules.installment_number IS 'Numéro de la tranche (1, 2, 3, etc.)';
COMMENT ON COLUMN payment_schedules.due_month IS 'Mois d''échéance (1-12)';
COMMENT ON COLUMN payment_schedules.amount IS 'Montant de la tranche';

-- =====================================================
-- Politiques RLS pour tuition_fees
-- =====================================================

ALTER TABLE tuition_fees ENABLE ROW LEVEL SECURITY;

-- Les comptables et admins voient les frais de leur école
CREATE POLICY "tuition_fees_select"
  ON tuition_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = tuition_fees.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SECRETARY')
    )
  );

-- Les parents voient les frais des classes de leurs enfants
CREATE POLICY "tuition_fees_parent_select"
  ON tuition_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents_students ps
      INNER JOIN students s ON s.id = ps.student_id
      INNER JOIN users parent_user ON parent_user.id = ps.parent_id
      WHERE parent_user.id = auth.uid()
      AND s.class_id = tuition_fees.class_id
    )
  );

-- Les comptables et admins peuvent créer des frais
CREATE POLICY "tuition_fees_insert"
  ON tuition_fees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = tuition_fees.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
    )
  );

-- Les comptables et admins peuvent modifier les frais
CREATE POLICY "tuition_fees_update"
  ON tuition_fees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = tuition_fees.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
    )
  );

-- Les comptables et admins peuvent supprimer les frais
CREATE POLICY "tuition_fees_delete"
  ON tuition_fees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_id = tuition_fees.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
    )
  );

-- =====================================================
-- Politiques RLS pour payment_schedules
-- =====================================================

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

-- Les comptables et admins voient les échéanciers de leur école
CREATE POLICY "payment_schedules_select"
  ON payment_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tuition_fees tf
      INNER JOIN users u ON u.school_id = tf.school_id
      WHERE tf.id = payment_schedules.tuition_fee_id
      AND u.id = auth.uid()
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SECRETARY')
    )
  );

-- Les parents voient les échéanciers des classes de leurs enfants
CREATE POLICY "payment_schedules_parent_select"
  ON payment_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tuition_fees tf
      INNER JOIN parents_students ps ON ps.student_id IN (
        SELECT id FROM students WHERE class_id = tf.class_id
      )
      INNER JOIN users parent_user ON parent_user.id = ps.parent_id
      WHERE tf.id = payment_schedules.tuition_fee_id
      AND parent_user.id = auth.uid()
    )
  );

-- Les comptables et admins peuvent créer des échéanciers
CREATE POLICY "payment_schedules_insert"
  ON payment_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tuition_fees tf
      INNER JOIN users u ON u.school_id = tf.school_id
      WHERE tf.id = payment_schedules.tuition_fee_id
      AND u.id = auth.uid()
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
    )
  );

-- Les comptables et admins peuvent modifier les échéanciers
CREATE POLICY "payment_schedules_update"
  ON payment_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tuition_fees tf
      INNER JOIN users u ON u.school_id = tf.school_id
      WHERE tf.id = payment_schedules.tuition_fee_id
      AND u.id = auth.uid()
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
    )
  );

-- Les comptables et admins peuvent supprimer les échéanciers
CREATE POLICY "payment_schedules_delete"
  ON payment_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tuition_fees tf
      INNER JOIN users u ON u.school_id = tf.school_id
      WHERE tf.id = payment_schedules.tuition_fee_id
      AND u.id = auth.uid()
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
    )
  );

-- =====================================================
-- TRIGGERS pour updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_tuition_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tuition_fees_updated_at_trigger
BEFORE UPDATE ON tuition_fees
FOR EACH ROW
EXECUTE FUNCTION update_tuition_fees_updated_at();

CREATE OR REPLACE FUNCTION update_payment_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_schedules_updated_at_trigger
BEFORE UPDATE ON payment_schedules
FOR EACH ROW
EXECUTE FUNCTION update_payment_schedules_updated_at();

-- =====================================================
-- FONCTION: Valider la cohérence des échéanciers
-- =====================================================

CREATE OR REPLACE FUNCTION validate_payment_schedule_total()
RETURNS TRIGGER AS $$
DECLARE
  v_tuition_total DECIMAL(10,2);
  v_schedule_total DECIMAL(10,2);
BEGIN
  -- Récupérer le montant total de la scolarité
  SELECT total_amount INTO v_tuition_total
  FROM tuition_fees
  WHERE id = NEW.tuition_fee_id;

  -- Calculer le total des échéanciers
  SELECT COALESCE(SUM(amount), 0) INTO v_schedule_total
  FROM payment_schedules
  WHERE tuition_fee_id = NEW.tuition_fee_id;

  -- Vérifier que le total ne dépasse pas le montant de la scolarité
  IF v_schedule_total > v_tuition_total THEN
    RAISE EXCEPTION 'Le total des échéanciers (%) dépasse le montant de la scolarité (%)', 
      v_schedule_total, v_tuition_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_schedule_trigger
BEFORE INSERT OR UPDATE ON payment_schedules
FOR EACH ROW
EXECUTE FUNCTION validate_payment_schedule_total();
