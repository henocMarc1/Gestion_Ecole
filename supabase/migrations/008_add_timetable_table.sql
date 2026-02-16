-- =====================================================
-- MIGRATION: Ajouter table emploi du temps (timetable)
-- =====================================================
-- Cette migration crée la table pour gérer les emplois
-- du temps des classes

-- TABLE: timetable_slots (Créneaux d'emploi du temps)
-- =====================================================
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=Lundi, 5=Vendredi
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject VARCHAR(100) NOT NULL,
  room VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_slots(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable_slots(day_of_week);

-- Commentaires
COMMENT ON TABLE timetable_slots IS 'Créneaux horaires de l''emploi du temps des classes';
COMMENT ON COLUMN timetable_slots.day_of_week IS 'Jour de la semaine (1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi)';
COMMENT ON COLUMN timetable_slots.start_time IS 'Heure de début du cours';
COMMENT ON COLUMN timetable_slots.end_time IS 'Heure de fin du cours';
COMMENT ON COLUMN timetable_slots.subject IS 'Matière enseignée';
COMMENT ON COLUMN timetable_slots.room IS 'Numéro de salle (optionnel)';

-- =====================================================
-- Politiques RLS pour timetable_slots
-- =====================================================

-- Activer RLS
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Les directeurs, secrétaires et enseignants peuvent voir les emplois du temps de leur école
CREATE POLICY "timetable_select_by_school"
  ON timetable_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.id = auth.uid()
      WHERE c.id = timetable_slots.class_id
      AND c.school_id = u.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'TEACHER', 'HR')
    )
  );

-- Policy: Les directeurs et secrétaires peuvent créer des créneaux
CREATE POLICY "timetable_insert_admin"
  ON timetable_slots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.id = auth.uid()
      WHERE c.id = timetable_slots.class_id
      AND c.school_id = u.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- Policy: Les directeurs et secrétaires peuvent modifier les créneaux
CREATE POLICY "timetable_update_admin"
  ON timetable_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.id = auth.uid()
      WHERE c.id = timetable_slots.class_id
      AND c.school_id = u.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );

-- Policy: Les directeurs et secrétaires peuvent supprimer les créneaux
CREATE POLICY "timetable_delete_admin"
  ON timetable_slots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.id = auth.uid()
      WHERE c.id = timetable_slots.class_id
      AND c.school_id = u.school_id
      AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARY')
    )
  );
