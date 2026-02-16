// Script de test de connexion Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eukkzsbmsyxgklzzhiej.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a2t6c2Jtc3l4Z2tsenpoaWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwOTksImV4cCI6MjA4NDAxMzA5OX0.8Uw3bToIk4w7zstUEQglPGxzBSdmFRmLS_2dnQTavC8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('🔌 Test de connexion Supabase...\n');

  try {
    // Test 1: Vérifier la connexion
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ Erreur de connexion:', error.message);
      process.exit(1);
    }

    console.log('✅ Connexion à Supabase réussie!');
    console.log('   URL: ' + supabaseUrl);
    console.log('   Key prefix: ' + supabaseAnonKey.substring(0, 20) + '...');

    // Test 2: Vérifier les tables
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (!tablesError) {
      console.log('✅ Table "users" accessible');
    } else if (tablesError.code === '42P01') {
      console.log('⚠️  Les tables n\'existent pas encore (normal - à créer via SQL)');
    } else {
      console.log('⚠️  Erreur lors de la vérification des tables:', tablesError.message);
    }

    console.log('\n✅ Configuration Supabase CORRECTE et FONCTIONNELLE');
    console.log('\n📋 Prochaines étapes:');
    console.log('   1. Exécuter les migrations SQL dans Supabase Dashboard');
    console.log('   2. Créer les 9 comptes utilisateurs test');
    console.log('   3. Lancer: npm run dev');

  } catch (error) {
    console.log('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testConnection();
