-- Rechercher les tables de paiements
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%payment%'
ORDER BY table_name;

-- Rechercher les tables qui pourraient contenir les paiements des étudiants
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%payment%' 
    OR table_name LIKE '%transaction%'
    OR table_name LIKE '%invoice%'
    OR table_name LIKE '%receipt%'
  )
ORDER BY table_name;
