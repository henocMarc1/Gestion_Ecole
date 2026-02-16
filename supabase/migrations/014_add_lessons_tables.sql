-- Migration: Lesson Management System (Cahier de texte)
-- Description: Tables for lessons, homework, and teacher resources
-- Created: 2026-01-16

-- =====================================================
-- LESSONS TABLE (Cours)
-- =====================================================
DROP TABLE IF EXISTS lessons CASCADE;

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lesson Information
    subject VARCHAR(100) NOT NULL, -- Matière (Français, Mathématiques, etc.)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT, -- Contenu détaillé du cours
    
    -- Scheduling
    lesson_date DATE NOT NULL,
    lesson_time TIME,
    duration_minutes INTEGER DEFAULT 60, -- Durée en minutes
    
    -- Resources
    resources_url TEXT, -- URL de ressources externes
    
    -- Metadata
    created_by UUID REFERENCES users(id), -- Teacher who created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lessons_school_id ON lessons(school_id);
CREATE INDEX idx_lessons_class_id ON lessons(class_id);
CREATE INDEX idx_lessons_teacher_id ON lessons(teacher_id);
CREATE INDEX idx_lessons_date ON lessons(lesson_date);
CREATE INDEX idx_lessons_subject ON lessons(subject);

-- =====================================================
-- HOMEWORK TABLE (Devoirs)
-- =====================================================
DROP TABLE IF EXISTS homework CASCADE;

CREATE TABLE homework (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Homework Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    
    -- Scheduling
    assigned_date DATE NOT NULL,
    due_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'graded', 'cancelled')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_due_date CHECK (due_date >= assigned_date)
);

-- Indexes
CREATE INDEX idx_homework_school_id ON homework(school_id);
CREATE INDEX idx_homework_lesson_id ON homework(lesson_id);
CREATE INDEX idx_homework_class_id ON homework(class_id);
CREATE INDEX idx_homework_teacher_id ON homework(teacher_id);
CREATE INDEX idx_homework_due_date ON homework(due_date);
CREATE INDEX idx_homework_status ON homework(status);

-- =====================================================
-- HOMEWORK_SUBMISSIONS TABLE
-- =====================================================
DROP TABLE IF EXISTS homework_submissions CASCADE;

CREATE TABLE homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Submission
    submitted_at TIMESTAMPTZ,
    submission_file_url TEXT,
    submission_notes TEXT,
    
    -- Grading
    grade DECIMAL(5, 2),
    max_grade DECIMAL(5, 2),
    feedback TEXT,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES users(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'not_submitted' CHECK (status IN ('not_submitted', 'submitted', 'graded', 'late')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_homework_submissions_school_id ON homework_submissions(school_id);
CREATE INDEX idx_homework_submissions_homework_id ON homework_submissions(homework_id);
CREATE INDEX idx_homework_submissions_student_id ON homework_submissions(student_id);
CREATE INDEX idx_homework_submissions_status ON homework_submissions(status);

-- =====================================================
-- TEACHER_RESOURCES TABLE (Ressources pédagogiques)
-- =====================================================
DROP TABLE IF EXISTS teacher_resources CASCADE;

CREATE TABLE teacher_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id), -- NULL for shared resources
    
    -- Resource Information
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('document', 'video', 'link', 'image', 'exercise', 'other')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Content
    file_url TEXT,
    file_size INTEGER, -- In bytes
    mime_type VARCHAR(100),
    
    -- Subject and Category
    subject VARCHAR(100),
    category VARCHAR(100),
    
    -- Sharing
    is_shared BOOLEAN DEFAULT FALSE, -- Shared with other teachers
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teacher_resources_school_id ON teacher_resources(school_id);
CREATE INDEX idx_teacher_resources_teacher_id ON teacher_resources(teacher_id);
CREATE INDEX idx_teacher_resources_class_id ON teacher_resources(class_id);
CREATE INDEX idx_teacher_resources_type ON teacher_resources(resource_type);
CREATE INDEX idx_teacher_resources_subject ON teacher_resources(subject);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- LESSONS TABLE POLICIES
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Teachers can view lessons of their classes
CREATE POLICY "Teachers can view their lessons"
    ON lessons FOR SELECT
    USING (teacher_id = auth.uid());

-- Teachers and parents can view lessons
CREATE POLICY "Parents can view class lessons"
    ON lessons FOR SELECT
    USING (
        class_id IN (
            SELECT class_id FROM students
            WHERE id IN (
                SELECT student_id FROM parents_students
                WHERE parent_id = (SELECT id FROM users WHERE id = auth.uid() LIMIT 1)
            )
        )
    );

-- Only teachers can create lessons
CREATE POLICY "Teachers can create lessons"
    ON lessons FOR INSERT
    WITH CHECK (teacher_id = auth.uid());

-- Only lesson creator can update
CREATE POLICY "Teachers can update their lessons"
    ON lessons FOR UPDATE
    USING (teacher_id = auth.uid());

-- Only lesson creator can delete
CREATE POLICY "Teachers can delete their lessons"
    ON lessons FOR DELETE
    USING (teacher_id = auth.uid());

-- HOMEWORK TABLE POLICIES
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;

-- Teachers can view all homework
CREATE POLICY "Teachers can view homework"
    ON homework FOR SELECT
    USING (teacher_id = auth.uid());

-- Parents can view homework for their children's classes
CREATE POLICY "Parents can view homework"
    ON homework FOR SELECT
    USING (
        class_id IN (
            SELECT class_id FROM students WHERE id IN (
                SELECT student_id FROM parents_students
                WHERE parent_id = (SELECT id FROM users WHERE id = auth.uid() LIMIT 1)
            )
        )
    );

-- Only teachers can create homework
CREATE POLICY "Teachers can create homework"
    ON homework FOR INSERT
    WITH CHECK (teacher_id = auth.uid());

-- Only teacher can update homework
CREATE POLICY "Teachers can update homework"
    ON homework FOR UPDATE
    USING (teacher_id = auth.uid());

-- HOMEWORK_SUBMISSIONS TABLE POLICIES
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

-- Teachers can view submissions for their homework
CREATE POLICY "Teachers can view submissions"
    ON homework_submissions FOR SELECT
    USING (
        homework_id IN (
            SELECT id FROM homework WHERE teacher_id = auth.uid()
        )
    );

-- Students can view their submissions
CREATE POLICY "Students can view their submissions"
    ON homework_submissions FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE id = student_id
        )
    );

-- Parents can view their children's submissions
CREATE POLICY "Parents can view children submissions"
    ON homework_submissions FOR SELECT
    USING (
        student_id IN (
            SELECT student_id FROM parents_students
            WHERE parent_id = (SELECT id FROM users WHERE id = auth.uid() LIMIT 1)
        )
    );

-- Students can create/update submissions (via parent account or direct access)
CREATE POLICY "Students can submit homework"
    ON homework_submissions FOR INSERT
    WITH CHECK (
        student_id = student_id
    );

CREATE POLICY "Students can update submissions"
    ON homework_submissions FOR UPDATE
    USING (
        student_id = student_id AND status != 'graded'
    );

-- Teachers can grade submissions
CREATE POLICY "Teachers can grade submissions"
    ON homework_submissions FOR UPDATE
    USING (
        homework_id IN (
            SELECT id FROM homework WHERE teacher_id = auth.uid()
        )
    );

-- TEACHER_RESOURCES TABLE POLICIES
ALTER TABLE teacher_resources ENABLE ROW LEVEL SECURITY;

-- Teachers can view their resources
CREATE POLICY "Teachers can view their resources"
    ON teacher_resources FOR SELECT
    USING (teacher_id = auth.uid());

-- Teachers can view shared resources
CREATE POLICY "Teachers can view shared resources"
    ON teacher_resources FOR SELECT
    USING (is_shared = true AND school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
    ));

-- Parents can view resources for their children's classes
CREATE POLICY "Parents can view class resources"
    ON teacher_resources FOR SELECT
    USING (
        class_id IN (
            SELECT class_id FROM students
            WHERE id IN (
                SELECT student_id FROM parents_students
                WHERE parent_id = (SELECT id FROM users WHERE id = auth.uid() LIMIT 1)
            )
        )
    );

-- Teachers can create resources
CREATE POLICY "Teachers can create resources"
    ON teacher_resources FOR INSERT
    WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their resources
CREATE POLICY "Teachers can update resources"
    ON teacher_resources FOR UPDATE
    USING (teacher_id = auth.uid());

-- Teachers can delete their resources
CREATE POLICY "Teachers can delete resources"
    ON teacher_resources FOR DELETE
    USING (teacher_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for lessons
CREATE OR REPLACE FUNCTION update_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lessons_updated_at ON lessons;
CREATE TRIGGER lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_lessons_updated_at();

-- Update timestamp trigger for homework
DROP TRIGGER IF EXISTS homework_updated_at ON homework;
CREATE TRIGGER homework_updated_at
    BEFORE UPDATE ON homework
    FOR EACH ROW
    EXECUTE FUNCTION update_lessons_updated_at();

-- Update timestamp trigger for homework_submissions
DROP TRIGGER IF EXISTS homework_submissions_updated_at ON homework_submissions;
CREATE TRIGGER homework_submissions_updated_at
    BEFORE UPDATE ON homework_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_lessons_updated_at();

-- Update timestamp trigger for teacher_resources
DROP TRIGGER IF EXISTS teacher_resources_updated_at ON teacher_resources;
CREATE TRIGGER teacher_resources_updated_at
    BEFORE UPDATE ON teacher_resources
    FOR EACH ROW
    EXECUTE FUNCTION update_lessons_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE lessons IS 'Cours et leçons';
COMMENT ON TABLE homework IS 'Devoirs assignés';
COMMENT ON TABLE homework_submissions IS 'Remises de devoirs par élèves';
COMMENT ON TABLE teacher_resources IS 'Ressources pédagogiques partagées';
