require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('Créez un fichier .env avec:');
  console.error('SUPABASE_URL=https://your-project.supabase.co');
  console.error('SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

async function runDailyCheck() {
  const timestamp = new Date().toLocaleString('fr-FR', { 
    timeZone: 'Africa/Abidjan',
    dateStyle: 'full',
    timeStyle: 'medium'
  });
  
  console.log('\n========================================');
  console.log('🚀 Vérification quotidienne des paiements');
  console.log('========================================');
  console.log(`📅 ${timestamp}`);
  console.log('----------------------------------------\n');
  
  try {
    console.log('📡 Connexion à Supabase...');
    
    // Utilisation de fetch natif (Node.js 18+) ou node-fetch
    const fetchModule = globalThis.fetch || (await import('node-fetch')).default;
    
    const response = await fetchModule(
      `${SUPABASE_URL}/functions/v1/daily-payment-check`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('📊 Réponse reçue:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    if (data.success) {
      console.log('✅ Vérification terminée avec succès!\n');
      
      console.log('📋 Résumé:');
      console.log(`   📝 Rappels créés/mis à jour: ${data.remindersCreated || 0}`);
      console.log(`   🚫 Élèves exclus: ${data.studentsExcluded || 0}`);
      console.log(`   📧 Notifications prêtes: ${data.notificationsSent || 0}`);
      
      if (data.studentsExcluded > 0) {
        console.log('\n⚠️  ALERTE: ' + data.studentsExcluded + ' élève(s) ont été exclus pour 30+ jours de retard!');
      }
      
      if (data.details) {
        console.log('\n📈 Détails:');
        console.log(`   Rappels: ${data.details.reminders?.message || 'N/A'}`);
        console.log(`   Exclusions: ${data.details.exclusions?.message || 'N/A'}`);
        console.log(`   Notifications: ${data.details.notifications?.message || 'N/A'}`);
      }
      
      console.log('\n========================================');
      console.log('✅ Processus terminé avec succès');
      console.log('========================================\n');
      
    } else {
      console.error('\n❌ Erreur lors de la vérification:');
      console.error(`   ${data.error || 'Erreur inconnue'}`);
      console.log('\n========================================');
      console.log('❌ Processus terminé avec erreur');
      console.log('========================================\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Erreur fatale:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Vérifiez:');
      console.error('   - Votre connexion Internet');
      console.error('   - L\'URL Supabase dans le fichier .env');
    } else if (error.message.includes('401')) {
      console.error('\n💡 Vérifiez:');
      console.error('   - La clé SUPABASE_ANON_KEY dans le fichier .env');
    } else if (error.message.includes('404')) {
      console.error('\n💡 Vérifiez:');
      console.error('   - La fonction Edge est bien déployée');
      console.error('   - L\'URL de la fonction est correcte');
    }
    
    console.log('\n========================================');
    console.log('❌ Processus interrompu');
    console.log('========================================\n');
    process.exit(1);
  }
}

// Exécuter
runDailyCheck();
