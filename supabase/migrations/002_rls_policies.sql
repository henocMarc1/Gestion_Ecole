-- =====================================================
-- POLITIQUES RLS (ROW LEVEL SECURITY) - SUPABASE
-- =====================================================
-- Politiques de sécurité renforcées par rôle pour l'école
-- unique (school_id de l'utilisateur) avec filtrage des
-- enregistrements supprimés logiquement (deleted_at IS NULL)
-- et séparation stricte des responsabilités.
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FONCTIONS HELPER POUR RLS
-- =====================================================

-- Récupérer le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Récupérer le school_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth.user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Vérifier une appartenance à un ensemble de rôles
CREATE OR REPLACE FUNCTION auth.has_role(p_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = ANY(p_roles);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'SUPER_ADMIN';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_school_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() IN ('SUPER_ADMIN', 'ADMIN');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_secretary()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'SECRETARY';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_accountant()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'ACCOUNTANT';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'TEACHER';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_hr()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'HR';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_parent()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'PARENT';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Vérifier si l'utilisateur appartient à la même école
CREATE OR REPLACE FUNCTION auth.same_school(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_school_id = auth.user_school_id() OR auth.is_super_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- POLITIQUES: schools
-- =====================================================

CREATE POLICY "schools_select_by_scope"
  ON schools FOR SELECT
  USING (
    auth.is_super_admin()
    OR (id = auth.user_school_id() AND deleted_at IS NULL)
  );

CREATE POLICY "schools_insert_super_admin"
  ON schools FOR INSERT
  WITH CHECK (auth.is_super_admin());

CREATE POLICY "schools_update_admin"
  ON schools FOR UPDATE
  USING (
    auth.is_super_admin()
    OR (id = auth.user_school_id() AND auth.is_school_admin())
  );

CREATE POLICY "schools_delete_super_admin"
  ON schools FOR DELETE
  USING (auth.is_super_admin());

-- =====================================================
-- POLITIQUES: users
-- =====================================================

CREATE POLICY "users_select_self_or_admin"
  ON users FOR SELECT
  USING (
    id = auth.uid()
    OR auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND deleted_at IS NULL AND auth.is_school_admin())
  );

CREATE POLICY "users_insert_admin"
  ON users FOR INSERT
  WITH CHECK (
    auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
  );

CREATE POLICY "users_update_self_or_admin"
  ON users FOR UPDATE
  USING (
    id = auth.uid()
    OR auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
  );

CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  USING (
    auth.is_super_admin()
    OR (school_id = auth.user_school_id() AND auth.is_school_admin())
  );

-- =====================================================
-- POLITIQUES: years
-- =====================================================

CREATE POLICY "years_select_same_school"
  ON years FOR SELECT
  USING (auth.same_school(school_id) AND deleted_at IS NULL);

CREATE POLICY "years_insert_admin"
  ON years FOR INSERT
  WITH CHECK (auth.same_school(school_id) AND auth.is_school_admin());

CREATE POLICY "years_update_admin"
  ON years FOR UPDATE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

CREATE POLICY "years_delete_admin"
  ON years FOR DELETE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

-- =====================================================
-- POLITIQUES: classes
-- =====================================================

CREATE POLICY "classes_select_by_role"
  ON classes FOR SELECT
  USING (
    (auth.same_school(school_id) AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM teacher_classes tc
      WHERE tc.class_id = classes.id AND tc.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM students s
      JOIN parents_students ps ON ps.student_id = s.id
      WHERE s.class_id = classes.id AND ps.parent_id = auth.uid()
    )
  );

CREATE POLICY "classes_insert_admin_or_secretary"
  ON classes FOR INSERT
  WITH CHECK (auth.same_school(school_id) AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','SECRETARY']));

CREATE POLICY "classes_update_admin_or_secretary"
  ON classes FOR UPDATE
  USING (auth.same_school(school_id) AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','SECRETARY']));

CREATE POLICY "classes_delete_admin"
  ON classes FOR DELETE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

-- =====================================================
-- POLITIQUES: teacher_classes
-- =====================================================

CREATE POLICY "teacher_classes_select_by_scope"
  ON teacher_classes FOR SELECT
  USING (
    auth.is_school_admin()
    OR teacher_id = auth.uid()
  );

CREATE POLICY "teacher_classes_manage_admin"
  ON teacher_classes FOR ALL
  USING (auth.is_school_admin());

-- =====================================================
-- POLITIQUES: students
-- =====================================================

CREATE POLICY "students_select_by_role"
  ON students FOR SELECT
  USING (
    (auth.same_school(school_id) AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM teacher_classes tc
      WHERE tc.class_id = students.class_id AND tc.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parents_students ps
      WHERE ps.student_id = students.id AND ps.parent_id = auth.uid()
    )
  );

CREATE POLICY "students_insert_admin_or_secretary"
  ON students FOR INSERT
  WITH CHECK (auth.same_school(school_id) AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','SECRETARY']));

CREATE POLICY "students_update_admin_or_secretary"
  ON students FOR UPDATE
  USING (auth.same_school(school_id) AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','SECRETARY']));

CREATE POLICY "students_delete_admin"
  ON students FOR DELETE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

-- =====================================================
-- POLITIQUES: parents_students
-- =====================================================

CREATE POLICY "parents_students_select_parent_or_admin"
  ON parents_students FOR SELECT
  USING (
    auth.is_school_admin()
    OR parent_id = auth.uid()
  );

CREATE POLICY "parents_students_manage_admin_or_secretary"
  ON parents_students FOR ALL
  USING (auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','SECRETARY']));

-- =====================================================
-- POLITIQUES: attendance
-- =====================================================

CREATE POLICY "attendance_select_by_role"
  ON attendance FOR SELECT
  USING (
    auth.is_school_admin()
    OR EXISTS (
      SELECT 1 FROM teacher_classes tc
      WHERE tc.class_id = attendance.class_id AND tc.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parents_students ps
      WHERE ps.student_id = attendance.student_id AND ps.parent_id = auth.uid()
    )
  );

CREATE POLICY "attendance_insert_teacher_or_admin"
  ON attendance FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM teacher_classes tc
        JOIN classes c ON c.id = tc.class_id
        JOIN students s ON s.class_id = tc.class_id
        WHERE tc.class_id = attendance.class_id
          AND s.id = attendance.student_id
          AND tc.teacher_id = auth.uid()
          AND (CURRENT_DATE - attendance.date) <= 2
          AND c.school_id = auth.user_school_id()
      )
    )
    OR (auth.is_school_admin())
  );

CREATE POLICY "attendance_update_teacher_within_window_or_admin"
  ON attendance FOR UPDATE
  USING (
    (
      EXISTS (
        SELECT 1 FROM teacher_classes tc
        JOIN classes c ON c.id = tc.class_id
        WHERE tc.class_id = attendance.class_id
          AND tc.teacher_id = auth.uid()
          AND (CURRENT_DATE - attendance.date) <= 2
          AND c.school_id = auth.user_school_id()
      )
    )
    OR auth.is_school_admin()
  );

CREATE POLICY "attendance_delete_admin"
  ON attendance FOR DELETE
  USING (auth.is_school_admin());

-- =====================================================
-- POLITIQUES: fees
-- =====================================================

CREATE POLICY "fees_select_same_school"
  ON fees FOR SELECT
  USING (auth.same_school(school_id) AND deleted_at IS NULL);

CREATE POLICY "fees_insert_finance_or_admin"
  ON fees FOR INSERT
  WITH CHECK (auth.same_school(school_id) AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT']));

CREATE POLICY "fees_update_finance_or_admin"
  ON fees FOR UPDATE
  USING (auth.same_school(school_id) AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT']));

CREATE POLICY "fees_delete_admin"
  ON fees FOR DELETE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

-- =====================================================
-- POLITIQUES: invoices
-- =====================================================

CREATE POLICY "invoices_select_by_role"
  ON invoices FOR SELECT
  USING (
    (auth.same_school(school_id) AND deleted_at IS NULL AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY']))
    OR EXISTS (
      SELECT 1 FROM parents_students ps
      WHERE ps.student_id = invoices.student_id AND ps.parent_id = auth.uid()
    )
  );

CREATE POLICY "invoices_insert_finance_or_secretary"
  ON invoices FOR INSERT
  WITH CHECK (
    auth.same_school(school_id)
    AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY'])
  );

CREATE POLICY "invoices_update_finance_or_secretary"
  ON invoices FOR UPDATE
  USING (
    auth.same_school(school_id)
    AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY'])
  );

CREATE POLICY "invoices_delete_admin"
  ON invoices FOR DELETE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

-- =====================================================
-- POLITIQUES: invoice_items
-- =====================================================

CREATE POLICY "invoice_items_select_by_invoice_scope"
  ON invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          (auth.same_school(inv.school_id) AND inv.deleted_at IS NULL AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY']))
          OR EXISTS (
            SELECT 1 FROM parents_students ps
            WHERE ps.student_id = inv.student_id AND ps.parent_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "invoice_items_manage_finance_or_secretary"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND auth.same_school(inv.school_id)
        AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY'])
    )
  );

-- =====================================================
-- POLITIQUES: payments
-- =====================================================

CREATE POLICY "payments_select_by_role"
  ON payments FOR SELECT
  USING (
    (auth.same_school(school_id) AND deleted_at IS NULL AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY']))
    OR EXISTS (
      SELECT 1 FROM parents_students ps
      WHERE ps.student_id = payments.student_id AND ps.parent_id = auth.uid()
    )
  );

CREATE POLICY "payments_insert_finance_or_secretary"
  ON payments FOR INSERT
  WITH CHECK (
    auth.same_school(school_id)
    AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT','SECRETARY'])
  );

CREATE POLICY "payments_update_finance"
  ON payments FOR UPDATE
  USING (
    auth.same_school(school_id)
    AND auth.has_role(ARRAY['SUPER_ADMIN','ADMIN','ACCOUNTANT'])
  );

CREATE POLICY "payments_delete_admin"
  ON payments FOR DELETE
  USING (auth.same_school(school_id) AND auth.is_school_admin());

-- =====================================================
-- POLITIQUES: messages
-- =====================================================

CREATE POLICY "messages_select_by_participant"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (auth.same_school(school_id) AND auth.is_school_admin())
  );

CREATE POLICY "messages_insert_same_school"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND auth.same_school(school_id)
  );

CREATE POLICY "messages_update_draft_or_read"
  ON messages FOR UPDATE
  USING (
    (sender_id = auth.uid() AND status = 'DRAFT')
    OR recipient_id = auth.uid()
    OR (auth.same_school(school_id) AND auth.is_school_admin())
  );

CREATE POLICY "messages_delete_draft"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid() AND status = 'DRAFT'
  );

-- =====================================================
-- POLITIQUES: audit_logs
-- =====================================================

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  USING (
    auth.is_super_admin()
    OR (auth.same_school(school_id) AND auth.is_school_admin())
  );

CREATE POLICY "audit_logs_insert_system"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Pas de politique UPDATE/DELETE => interdit

-- =====================================================
-- FONCTION D'AUDIT AUTOMATIQUE
-- =====================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    metadata
  ) VALUES (
    auth.user_school_id(),
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS D'AUDIT SUR LES TABLES SENSIBLES
-- =====================================================

CREATE OR REPLACE FUNCTION audit_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('CREATE_PAYMENT', 'PAYMENT', NEW.id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event('UPDATE_PAYMENT', 'PAYMENT', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event('DELETE_PAYMENT', 'PAYMENT', OLD.id, to_jsonb(OLD), NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_payments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_payments();

CREATE OR REPLACE FUNCTION audit_users()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('CREATE_USER', 'USER', NEW.id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event('UPDATE_USER', 'USER', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event('DELETE_USER', 'USER', OLD.id, to_jsonb(OLD), NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_users();

CREATE OR REPLACE FUNCTION audit_fees()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('CREATE_FEE', 'FEE', NEW.id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event('UPDATE_FEE', 'FEE', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event('DELETE_FEE', 'FEE', OLD.id, to_jsonb(OLD), NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_fees_trigger
  AFTER INSERT OR UPDATE OR DELETE ON fees
  FOR EACH ROW EXECUTE FUNCTION audit_fees();
