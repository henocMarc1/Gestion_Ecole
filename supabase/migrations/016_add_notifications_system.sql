-- Migration: Notifications System
-- Description: Push notifications with targeted recipients selection
-- Created: 2026-01-17

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Notification Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('info', 'alert', 'reminder', 'announcement', 'urgent')),
    
    -- Targeting
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('all', 'parents', 'employees', 'teachers', 'class', 'custom')),
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- For class-specific notifications
    
    -- Priority and Scheduling
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    scheduled_at TIMESTAMPTZ, -- NULL for immediate send
    sent_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_school_id ON notifications(school_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_target_type ON notifications(target_type);
CREATE INDEX idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX idx_notifications_created_by ON notifications(created_by);

-- =====================================================
-- NOTIFICATION_RECIPIENTS TABLE (for custom targeting)
-- =====================================================
DROP TABLE IF EXISTS notification_recipients CASCADE;

CREATE TABLE notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Delivery Status
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_notification_recipient UNIQUE(notification_id, user_id)
);

-- Indexes
CREATE INDEX idx_notification_recipients_notification_id ON notification_recipients(notification_id);
CREATE INDEX idx_notification_recipients_user_id ON notification_recipients(user_id);
CREATE INDEX idx_notification_recipients_status ON notification_recipients(status);
CREATE INDEX idx_notification_recipients_read_at ON notification_recipients(read_at);

-- =====================================================
-- NOTIFICATION_PREFERENCES TABLE (user preferences)
-- =====================================================
DROP TABLE IF EXISTS notification_preferences CASCADE;

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Preferences by type
    receive_announcements BOOLEAN DEFAULT TRUE,
    receive_alerts BOOLEAN DEFAULT TRUE,
    receive_reminders BOOLEAN DEFAULT TRUE,
    receive_info BOOLEAN DEFAULT TRUE,
    
    -- Channels
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    
    -- Quiet hours
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_preferences UNIQUE(user_id, school_id)
);

-- Indexes
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_school_id ON notification_preferences(school_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- NOTIFICATIONS TABLE POLICIES
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view all notifications for their school
CREATE POLICY "Admins can view notifications"
    ON notifications FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Admins can create notifications
CREATE POLICY "Admins can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (
        created_by = auth.uid() AND
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Admins can update their notifications
CREATE POLICY "Admins can update notifications"
    ON notifications FOR UPDATE
    USING (
        created_by = auth.uid() AND
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Admins can delete their notifications
CREATE POLICY "Admins can delete notifications"
    ON notifications FOR DELETE
    USING (
        created_by = auth.uid() AND
        school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- NOTIFICATION_RECIPIENTS TABLE POLICIES
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification recipients
CREATE POLICY "Users can view their notifications"
    ON notification_recipients FOR SELECT
    USING (user_id = auth.uid());

-- Admins can view all recipients for their school's notifications
CREATE POLICY "Admins can view recipients"
    ON notification_recipients FOR SELECT
    USING (
        notification_id IN (
            SELECT id FROM notifications
            WHERE school_id IN (
                SELECT school_id FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
            )
        )
    );

-- System can insert recipients (via function/trigger)
CREATE POLICY "System can create recipients"
    ON notification_recipients FOR INSERT
    WITH CHECK (true);

-- Users can update their own notification status (mark as read)
CREATE POLICY "Users can update their notifications"
    ON notification_recipients FOR UPDATE
    USING (user_id = auth.uid());

-- NOTIFICATION_PREFERENCES TABLE POLICIES
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

-- Users can create their preferences
CREATE POLICY "Users can create preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their preferences
CREATE POLICY "Users can update preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to automatically create recipients when notification is sent
CREATE OR REPLACE FUNCTION create_notification_recipients()
RETURNS TRIGGER AS $$
DECLARE
    recipient_user_id UUID;
BEGIN
    -- Only create recipients when status changes to 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        
        -- Handle different target types
        IF NEW.target_type = 'all' THEN
            -- Send to all users in school
            INSERT INTO notification_recipients (notification_id, user_id)
            SELECT NEW.id, id FROM users WHERE school_id = NEW.school_id
            ON CONFLICT (notification_id, user_id) DO NOTHING;
            
        ELSIF NEW.target_type = 'parents' THEN
            -- Send to all parents
            INSERT INTO notification_recipients (notification_id, user_id)
            SELECT NEW.id, id FROM users WHERE school_id = NEW.school_id AND role = 'PARENT'
            ON CONFLICT (notification_id, user_id) DO NOTHING;
            
        ELSIF NEW.target_type = 'employees' THEN
            -- Send to all employees (HR, teachers, secretary, accountant)
            INSERT INTO notification_recipients (notification_id, user_id)
            SELECT NEW.id, id FROM users 
            WHERE school_id = NEW.school_id 
            AND role IN ('TEACHER', 'HR', 'SECRETARY', 'ACCOUNTANT', 'ADMIN')
            ON CONFLICT (notification_id, user_id) DO NOTHING;
            
        ELSIF NEW.target_type = 'teachers' THEN
            -- Send to all teachers
            INSERT INTO notification_recipients (notification_id, user_id)
            SELECT NEW.id, id FROM users WHERE school_id = NEW.school_id AND role = 'TEACHER'
            ON CONFLICT (notification_id, user_id) DO NOTHING;
            
        ELSIF NEW.target_type = 'class' AND NEW.target_class_id IS NOT NULL THEN
            -- Send to parents of students in specific class
            INSERT INTO notification_recipients (notification_id, user_id)
            SELECT DISTINCT NEW.id, ps.parent_id
            FROM students s
            JOIN parents_students ps ON s.id = ps.student_id
            WHERE s.class_id = NEW.target_class_id
            ON CONFLICT (notification_id, user_id) DO NOTHING;
        END IF;
        
        -- Update sent_at timestamp
        NEW.sent_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_notification_recipients ON notifications;
CREATE TRIGGER trigger_create_notification_recipients
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_recipients();

-- Function to auto-update read_at when status changes to 'read'
CREATE OR REPLACE FUNCTION update_notification_read_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'read' AND (OLD.status IS NULL OR OLD.status != 'read') THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_read_status ON notification_recipients;
CREATE TRIGGER trigger_update_notification_read_status
    BEFORE UPDATE ON notification_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_read_status();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_updated_at ON notifications;
CREATE TRIGGER notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE notifications IS 'Notifications push avec ciblage des destinataires';
COMMENT ON TABLE notification_recipients IS 'Destinataires et statut de livraison des notifications';
COMMENT ON TABLE notification_preferences IS 'Préférences utilisateur pour les notifications';

COMMENT ON COLUMN notifications.target_type IS 'Type de ciblage: all, parents, employees, teachers, class, custom';
COMMENT ON COLUMN notifications.priority IS 'Priorité: low, normal, high, urgent';
COMMENT ON COLUMN notifications.status IS 'Statut: draft, scheduled, sent, failed';
