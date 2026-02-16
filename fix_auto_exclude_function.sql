-- Fonction manquante qui cause l'erreur 500
-- À exécuter dans Supabase SQL Editor: https://supabase.com/dashboard/project/eukkzsbmsyxgklzzhiej/sql/new

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
