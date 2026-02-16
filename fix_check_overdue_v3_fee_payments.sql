-- FIX: Fonction check_overdue_payments - VERSION SIMPLIFIÉE
-- Cette version évite complètement tuition_fees et utilise fee_payments à la place

CREATE OR REPLACE FUNCTION check_overdue_payments()
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    parent_id UUID,
    parent_name TEXT,
    class_id UUID,
    class_name TEXT,
    school_id UUID,
    month INTEGER,
    year INTEGER,
    due_date DATE,
    days_overdue INTEGER,
    amount_due DECIMAL,
    reminder_level INTEGER,
    should_exclude BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS student_id,
        (s.first_name || ' ' || s.last_name) AS student_name,
        ps.parent_id,
        u.full_name AS parent_name,
        s.class_id,
        c.name AS class_name,
        s.school_id,
        EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS month,
        EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS year,
        (DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE AS due_date,
        calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) AS days_overdue,
        
        -- Calculer le montant dû directement depuis fee_payments
        COALESCE(
            (SELECT SUM(fp.amount) - SUM(COALESCE(fp.paid_amount, 0))
             FROM fee_payments fp
             WHERE fp.student_id = s.id 
             AND fp.year_id = (SELECT id FROM years WHERE is_current = true LIMIT 1)
             AND fp.status != 'paid'),
            0
        ) AS amount_due,
        
        CASE 
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) BETWEEN 1 AND 14 THEN 1
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) BETWEEN 15 AND 29 THEN 2
            WHEN calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) >= 30 THEN 3
            ELSE 0
        END AS reminder_level,
        
        calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) >= 30 AS should_exclude
    FROM students s
    INNER JOIN classes c ON s.class_id = c.id
    INNER JOIN parents_students ps ON s.id = ps.student_id AND ps.is_primary_contact = true
    INNER JOIN users u ON ps.parent_id = u.id
    WHERE 
        s.deleted_at IS NULL
        AND s.status = 'active'
        AND calculate_days_overdue((DATE_TRUNC('month', CURRENT_DATE) + (c.payment_due_day - 1) * INTERVAL '1 day')::DATE) > 0
        AND EXISTS (
            SELECT 1 FROM fee_payments fp_check
            WHERE fp_check.student_id = s.id
            AND fp_check.year_id = (SELECT id FROM years WHERE is_current = true LIMIT 1)
            AND fp_check.status != 'paid'
        );
END;
$$ LANGUAGE plpgsql;

-- Test
SELECT * FROM check_overdue_payments() LIMIT 5;
