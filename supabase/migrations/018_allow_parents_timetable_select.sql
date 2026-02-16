-- Allow parents to view timetable slots for their children
CREATE POLICY "timetable_select_parents"
  ON timetable_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      JOIN parents_students ps ON ps.parent_id = u.id
      JOIN students s ON s.id = ps.student_id
      WHERE u.id = auth.uid()
      AND u.school_id = s.school_id
      AND s.class_id = timetable_slots.class_id
    )
  );
