# 🔄 Solutions Alternatives au Cron pour les Rappels de Paiement

Plusieurs options pour automatiser l'exécution quotidienne sans utiliser pg_cron.

---

## 🏆 Solution 1 : GitHub Actions (RECOMMANDÉ)

### ✅ Avantages
- 🆓 **Gratuit** : 2000 min/mois (repos privés), illimité (repos publics)
- ⚡ **Facile** : Configuration en 5 minutes
- 📊 **Logs gratuits** : Interface graphique
- 🔔 **Notifications intégrées** : Email en cas d'erreur
- 🔄 **Déclenchement manuel** : Bouton "Run workflow"

### 📝 Configuration

**Fichier créé** : `.github/workflows/daily-payment-check.yml`

**Installation** :
1. Créer un repo GitHub
2. Pousser le code
3. Ajouter 2 secrets : `SUPABASE_URL` et `SUPABASE_ANON_KEY`
4. Le workflow s'exécute tous les jours à 8h00

**Voir** : [.github/workflows/README.md](.github/workflows/README.md)

---

## 🌐 Solution 2 : Service Cron Externe (EasyCron)

### ✅ Avantages
- 🆓 **Gratuit** : Jusqu'à 1 cron job
- 🌍 **Indépendant** : Pas besoin de GitHub
- 🎯 **Précis** : Exécution à la minute près
- 📧 **Alertes** : Email en cas d'échec

### 📝 Configuration

1. **Créer un compte** : https://www.easycron.com/user/register
2. **Créer un cron job** :
   - **Cron Expression** : `0 8 * * *` (tous les jours à 8h00)
   - **URL to call** : `https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-payment-check`
   - **HTTP Method** : POST
   - **HTTP Headers** :
     ```
     Authorization: Bearer YOUR-ANON-KEY
     Content-Type: application/json
     ```
3. **Sauvegarder**

### Alternatives similaires
- **cron-job.org** : https://cron-job.org (gratuit, illimité)
- **Cronitor** : https://cronitor.io (monitoring inclus)
- **Zapier Scheduler** : https://zapier.com (14 jours gratuits)

---

## 💻 Solution 3 : Script Node.js Local (Windows Task Scheduler)

### ✅ Avantages
- 💻 **Local** : Tourne sur votre PC
- 🔒 **Sécurisé** : Pas de services tiers
- 🆓 **Gratuit** : Aucun coût

### ⚠️ Inconvénients
- PC doit être allumé
- Pas de redondance

### 📝 Configuration

#### 1. Créer le script

**Fichier** : `scripts/daily-payment-check.js`

```javascript
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR-ANON-KEY';

async function runDailyCheck() {
  console.log('🚀 Starting daily payment check...', new Date());
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/daily-payment-check`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Success!');
      console.log(`📝 Reminders created: ${data.remindersCreated}`);
      console.log(`🚫 Students excluded: ${data.studentsExcluded}`);
      
      if (data.studentsExcluded > 0) {
        console.log(`⚠️ WARNING: ${data.studentsExcluded} student(s) excluded!`);
      }
    } else {
      console.error('❌ Error:', data.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

runDailyCheck();
```

#### 2. Installer les dépendances

```powershell
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"
npm install node-fetch@2
```

#### 3. Créer un fichier .env

```powershell
@"
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-KEY
"@ | Out-File -FilePath .env -Encoding UTF8
```

#### 4. Tester le script

```powershell
node scripts/daily-payment-check.js
```

#### 5. Planifier avec Windows Task Scheduler

**Méthode 1 : Interface graphique**
1. Ouvrir **Task Scheduler** (Planificateur de tâches)
2. Clic droit > **Create Basic Task**
3. **Name** : `Daily Payment Check`
4. **Trigger** : Daily, 8:00 AM
5. **Action** : Start a program
   - **Program** : `node`
   - **Arguments** : `scripts/daily-payment-check.js`
   - **Start in** : `c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE`
6. **Finish**

**Méthode 2 : PowerShell**
```powershell
$action = New-ScheduledTaskAction -Execute "node" `
  -Argument "scripts/daily-payment-check.js" `
  -WorkingDirectory "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

$trigger = New-ScheduledTaskTrigger -Daily -At 8am

Register-ScheduledTask -TaskName "DailyPaymentCheck" `
  -Action $action `
  -Trigger $trigger `
  -Description "Vérifie les paiements en retard chaque jour"
```

---

## 🔧 Solution 4 : Vercel Cron Jobs

### ✅ Avantages
- 🆓 **Gratuit** sur plan Hobby
- ⚡ **Simple** si déjà sur Vercel
- 🌍 **Serverless**

### 📝 Configuration

**Fichier** : `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-payment-check",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Fichier** : `pages/api/cron/daily-payment-check.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Vérifier le secret pour sécuriser
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily-payment-check`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

**Déployer** :
```powershell
vercel --prod
```

---

## 🤖 Solution 5 : n8n (Workflow Automation)

### ✅ Avantages
- 🎨 **Interface visuelle** : No-code
- 🔄 **Workflows complexes** : Conditions, boucles
- 📧 **Intégrations** : Email, SMS, Slack, etc.
- 🆓 **Version gratuite** : Auto-hébergé

### 📝 Configuration

1. **Installer n8n** :
```powershell
npm install -g n8n
n8n start
```

2. **Ouvrir** : http://localhost:5678

3. **Créer un workflow** :
   - **Trigger** : Cron (0 8 * * *)
   - **HTTP Request** : POST vers fonction Supabase
   - **IF Node** : Si exclusions > 0
   - **Send Email** : Notification admin

4. **Activer le workflow**

**Alternative cloud** : https://n8n.io (plan gratuit disponible)

---

## 📊 Comparaison des Solutions

| Solution | Prix | Précision | Installation | Maintenance | Logs | Recommandé pour |
|----------|------|-----------|--------------|-------------|------|-----------------|
| **GitHub Actions** | 🆓 | ±5-15 min | ⭐⭐⭐⭐⭐ | Aucune | ✅ Interface | Projets avec GitHub |
| **EasyCron** | 🆓 | ±1 min | ⭐⭐⭐⭐⭐ | Aucune | ✅ Dashboard | Sans GitHub |
| **Script Local** | 🆓 | ±1 min | ⭐⭐⭐ | PC allumé | ❌ Logs manuels | Tests locaux |
| **Vercel Cron** | 🆓 | ±1 min | ⭐⭐⭐⭐ | Aucune | ✅ Interface | App sur Vercel |
| **n8n** | 🆓/💰 | ±1 min | ⭐⭐ | Serveur requis | ✅ Interface | Workflows complexes |
| **pg_cron** | 🆓 | ±1 min | ⭐⭐ | Aucune | ❌ SQL | Maximum précision |

---

## 🎯 Recommandations

### Projet avec repo GitHub ?
➡️ **GitHub Actions** (le plus simple)

### Pas de GitHub ?
➡️ **EasyCron** ou **cron-job.org**

### Besoin de workflows avancés ?
➡️ **n8n** avec notifications complexes

### App déjà sur Vercel ?
➡️ **Vercel Cron Jobs**

### Tests locaux uniquement ?
➡️ **Script Node.js + Task Scheduler**

### Précision critique ?
➡️ **pg_cron** (malgré la complexité)

---

## 🚀 Ma recommandation : GitHub Actions

**Pourquoi ?**
1. ✅ Gratuit et illimité pour ce cas d'usage
2. ✅ Interface graphique avec logs
3. ✅ Notifications intégrées
4. ✅ Déclenchement manuel en 1 clic
5. ✅ Aucune infrastructure à maintenir
6. ✅ Configuration en 5 minutes

**Installation rapide** :
```powershell
# 1. Init Git
git init
git add .
git commit -m "Initial commit"

# 2. Créer repo sur GitHub.com

# 3. Push
git remote add origin https://github.com/YOUR-USERNAME/ecole-management.git
git push -u origin main

# 4. Ajouter secrets sur GitHub
# Settings > Secrets > New secret
# - SUPABASE_URL
# - SUPABASE_ANON_KEY

# 5. Tester dans Actions > Daily Payment Check > Run workflow
```

**C'est tout !** 🎉

---

Besoin d'aide pour configurer une solution spécifique ? 💬
