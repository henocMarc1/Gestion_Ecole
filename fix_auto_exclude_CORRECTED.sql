-- FIX: Fonction auto_exclude_students avec status INACTIVE (pas suspended)

CREATE OR REPLACE FUNCTION auto_exclude_students()
RETURNS INTEGER AS $$
DECLARE
    excluded_count INTEGER := 0;
BEGIN
    -- Mettre à jour le statut des étudiants avec 30+ jours de retard
    UPDATE students
    SET status = 'INACTIVE',
        updated_at = NOW()
    WHERE id IN (
        SELECT DISTINCT student_id
        FROM payment_reminders
        WHERE reminder_level = 3
        AND status = 'active'
    )
    AND status = 'ACTIVE';
    
    GET DIAGNOSTICS excluded_count = ROW_COUNT;
    
    RETURN excluded_count;
END;
$$ LANGUAGE plpgsql;
