-- Create certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  certificate_type VARCHAR(50) NOT NULL, -- 'ENROLLMENT', 'COMPLETION', 'TRANSCRIPT', etc.
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ISSUED'
  request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  issue_date TIMESTAMP WITH TIME ZONE,
  issued_by UUID REFERENCES users(id),
  certificate_number VARCHAR(100),
  academic_year VARCHAR(20),
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_certificates_school ON certificates(school_id);
CREATE INDEX idx_certificates_student ON certificates(student_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_request_date ON certificates(request_date);

-- Enable RLS
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certificates
-- Admin can do everything
CREATE POLICY "Admin full access to certificates"
  ON certificates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.school_id = certificates.school_id
      AND users.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Secretary can manage certificates
CREATE POLICY "Secretary can manage certificates"
  ON certificates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.school_id = certificates.school_id
      AND users.role = 'SECRETARY'
    )
  );

-- Teachers can view certificates of their students
CREATE POLICY "Teachers can view certificates"
  ON certificates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN teacher_classes ON teacher_classes.teacher_id = users.id
      JOIN students ON students.class_id = teacher_classes.class_id
      WHERE users.id = auth.uid()
      AND users.school_id = certificates.school_id
      AND students.id = certificates.student_id
    )
  );

-- Parents can view certificates of their children
CREATE POLICY "Parents can view certificates"
  ON certificates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN parents_students ON parents_students.parent_id = users.id
      WHERE users.id = auth.uid()
      AND users.school_id = certificates.school_id
      AND parents_students.student_id = certificates.student_id
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
