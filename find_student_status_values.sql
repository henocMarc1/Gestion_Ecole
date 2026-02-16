-- Trouver les valeurs valides pour l'enum student_status
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'student_status'
)
ORDER BY enumsortorder;

-- Alternative : voir toutes les valeurs d'enum
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname LIKE '%status%'
ORDER BY t.typname, e.enumsortorder;
