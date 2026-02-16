const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function applyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquent');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const migrationFile = path.join(__dirname, '../supabase/migrations/030_fix_employee_creation_rls.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    console.log('📋 Lecture du fichier de migration: 030_fix_employee_creation_rls.sql');
    console.log('🔄 Application de la migration...\n');

    const { error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    }).catch(() => {
      // Si exec_sql n'existe pas, on utilise une approche alternative
      return { error: 'rpc_method_not_found' };
    });

    if (error && error !== 'rpc_method_not_found') {
      throw error;
    }

    // Alternative: utiliser fetch directement avec l'API PostgreSQL
    if (error === 'rpc_method_not_found') {
      console.log('ℹ️  Utilisation de l\'API alternative pour exécuter le SQL...');
      
      // On va plutôt utiliser psql via le terminal
      console.log('❌ Vous devez exécuter cette migration manuellement via:');
      console.log('  1. Dashboard Supabase SQL Editor');
      console.log('  2. Ou via psql si vous avez accès');
      console.log('\n📝 Contenu de la migration:\n');
      console.log(sql);
      process.exit(1);
    }

    console.log('✅ Migration 030 appliquée avec succès!');
    console.log('✅ La fonction create_employee_on_user_creation utilise maintenant SECURITY DEFINER');
    console.log('✅ Le trigger contournera désormais les politiques RLS');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
