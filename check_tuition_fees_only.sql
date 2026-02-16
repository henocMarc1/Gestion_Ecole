-- 🔍 DIAGNOSTIC SIMPLIFIÉ : Uniquement tuition_fees
-- Exécutez ce SQL dans Supabase SQL Editor

-- 1. Voir TOUTES les colonnes de tuition_fees
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'tuition_fees'
ORDER BY ordinal_position;

-- 2. Exemple de données pour voir la structure
SELECT *
FROM tuition_fees
LIMIT 3;
