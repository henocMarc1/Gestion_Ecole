-- =====================================================
-- POLITIQUES RLS POUR LE RÔLE RH
-- =====================================================
-- Politiques de sécurité pour le rôle Ressources Humaines
-- RH peut gérer le personnel, les affectations et les présences
-- mais n'a pas accès aux finances

-- =====================================================
-- POLITIQUES MISES À JOUR: users (pour RH)
-- =====================================================
-- RH peut voir les utilisateurs de son école (sauf les parents)

CREATE POLICY "users_select_hr_staff"
  ON users FOR SELECT
  USING (
    (school_id = auth.user_school_id() AND auth.is_hr() AND deleted_at IS NULL AND role != 'PARENT')
    OR id = auth.uid()
    OR auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
  );

-- Super Admin et Directeur peuvent créer des utilisateurs HR
-- RH peut créer d'autres personnel
CREATE POLICY "users_insert_hr"
  ON users FOR INSERT
  WITH CHECK (
    auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
    OR (school_id = auth.user_school_id() AND auth.is_hr() AND role IN ('TEACHER', 'SECRETARY', 'ACCOUNTANT'))
    OR (school_id = auth.user_school_id() AND auth.is_school_admin() AND role = 'HR')
  );

-- Super Admin et Directeur peuvent modifier les utilisateurs RH
-- RH peut modifier le personnel (sauf RH eux-mêmes)
CREATE POLICY "users_update_hr"
  ON users FOR UPDATE
  USING (
    id = auth.uid()
    OR auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
    OR (school_id = auth.user_school_id() AND auth.is_hr() AND role != 'PARENT' AND deleted_at IS NULL)
  );

-- Super Admin et Directeur peuvent supprimer les utilisateurs RH
-- RH peut supprimer (soft delete) le personnel (sauf RH eux-mêmes)
CREATE POLICY "users_delete_hr"
  ON users FOR DELETE
  USING (
    auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
    OR (school_id = auth.user_school_id() AND auth.is_hr() AND role != 'PARENT' AND deleted_at IS NULL)
  );

-- =====================================================
-- POLITIQUES: attendance (Présences)
-- =====================================================
-- RH peut voir et mettre à jour les présences de son école

CREATE POLICY "attendance_select_hr"
  ON attendance FOR SELECT
  USING (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = attendance.student_id
        AND s.school_id = auth.user_school_id()
        AND s.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
    OR (
      EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = attendance.class_id
        AND c.school_id = auth.user_school_id()
        AND c.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );

CREATE POLICY "attendance_insert_hr"
  ON attendance FOR INSERT
  WITH CHECK (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = attendance.class_id
        AND c.school_id = auth.user_school_id()
        AND c.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );

CREATE POLICY "attendance_update_hr"
  ON attendance FOR UPDATE
  USING (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = attendance.class_id
        AND c.school_id = auth.user_school_id()
        AND c.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );

-- =====================================================
-- RESTRICTIONS RLS: RH ne peut pas accéder aux finances
-- =====================================================
-- Ces politiques restreignent l'accès aux tables finances

CREATE POLICY "fees_deny_hr"
  ON fees FOR SELECT
  USING (
    NOT auth.is_hr()
  );

CREATE POLICY "invoices_deny_hr"
  ON invoices FOR SELECT
  USING (
    NOT auth.is_hr()
  );

CREATE POLICY "payments_deny_hr"
  ON payments FOR SELECT
  USING (
    NOT auth.is_hr()
  );

-- =====================================================
-- POLITIQUE: teacher_classes (RH peut voir les affectations)
-- =====================================================

CREATE POLICY "teacher_classes_select_hr"
  ON teacher_classes FOR SELECT
  USING (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = teacher_classes.teacher_id
        AND u.school_id = auth.user_school_id()
        AND u.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );

CREATE POLICY "teacher_classes_insert_hr"
  ON teacher_classes FOR INSERT
  WITH CHECK (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = teacher_classes.teacher_id
        AND u.school_id = auth.user_school_id()
        AND u.role = 'TEACHER'
        AND u.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );

CREATE POLICY "teacher_classes_update_hr"
  ON teacher_classes FOR UPDATE
  USING (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = teacher_classes.teacher_id
        AND u.school_id = auth.user_school_id()
        AND u.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );

CREATE POLICY "teacher_classes_delete_hr"
  ON teacher_classes FOR DELETE
  USING (
    auth.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = teacher_classes.teacher_id
        AND u.school_id = auth.user_school_id()
        AND u.deleted_at IS NULL
      )
      AND auth.is_hr()
    )
  );
