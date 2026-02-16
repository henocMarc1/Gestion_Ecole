-- 🔍 DIAGNOSTIC COMPLET : Trouver la bonne table et les bonnes colonnes
-- Exécutez ce SQL dans Supabase SQL Editor pour identifier votre structure

-- 1. Vérifier si la table tuition_fees existe
SELECT 'tuition_fees' as table_name, COUNT(*) as row_count
FROM tuition_fees
UNION ALL
-- 2. Vérifier si la table fee_payments existe
SELECT 'fee_payments' as table_name, COUNT(*) as row_count
FROM fee_payments;

-- 3. Colonnes de tuition_fees (si elle existe)
SELECT 
    'tuition_fees' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'tuition_fees'
  AND column_name IN ('amount', 'total_amount', 'fee_amount', 'paid_amount', 'amount_paid')
ORDER BY column_name;

-- 4. Colonnes de fee_payments (si elle existe)
SELECT 
    'fee_payments' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'fee_payments'
  AND column_name IN ('amount', 'total_amount', 'fee_amount', 'paid_amount', 'amount_paid', 'status')
ORDER BY column_name;

-- 5. Exemple de données pour comprendre la structure
SELECT 
    'tuition_fees SAMPLE' as info,
    *
FROM tuition_fees
LIMIT 1;

SELECT 
    'fee_payments SAMPLE' as info,
    *
FROM fee_payments
LIMIT 1;
