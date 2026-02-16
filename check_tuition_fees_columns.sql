-- VÉRIFICATION : Structure de la table tuition_fees
-- Exécutez ce SQL dans Supabase pour voir les colonnes réelles

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'tuition_fees'
ORDER BY ordinal_position;
