# 🔄 Script Local - Vérification Quotidienne des Paiements

Ce script Node.js permet d'exécuter la vérification des paiements manuellement ou automatiquement via Windows Task Scheduler.

## 🚀 Installation

### 1. Installer les dépendances

```powershell
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

# Installer dotenv pour gérer les variables d'environnement
npm install dotenv

# Installer node-fetch si Node.js < 18
npm install node-fetch@2
```

### 2. Créer le fichier .env

```powershell
# Copier l'exemple
Copy-Item .env.example .env

# Éditer le fichier .env et remplacer les valeurs
notepad .env
```

**Contenu du .env** :
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Pour trouver ces valeurs** :
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet
- **Settings** > **API**
- Copiez **Project URL** et **anon public**

### 3. Tester le script

```powershell
node scripts/daily-payment-check.js
```

**Résultat attendu** :
```
========================================
🚀 Vérification quotidienne des paiements
========================================
📅 mardi 11 février 2026 à 08:00:00
----------------------------------------

📡 Connexion à Supabase...
📊 Réponse reçue:

{
  "success": true,
  "timestamp": "2026-02-11T08:00:00.000Z",
  "remindersCreated": 5,
  "studentsExcluded": 0,
  "notificationsSent": 5
}

✅ Vérification terminée avec succès!

📋 Résumé:
   📝 Rappels créés/mis à jour: 5
   🚫 Élèves exclus: 0
   📧 Notifications prêtes: 5

========================================
✅ Processus terminé avec succès
========================================
```

## ⏰ Automatisation avec Task Scheduler

### Méthode 1 : Interface graphique (Recommandé)

1. **Ouvrir Task Scheduler**
   - Appuyez sur `Win + R`
   - Tapez `taskschd.msc`
   - Appuyez sur Entrée

2. **Créer une tâche**
   - Clic droit sur "Task Scheduler Library"
   - **Create Basic Task...**

3. **Configuration** :
   - **Name** : `Vérification Quotidienne Paiements`
   - **Description** : `Vérifie les retards de paiement et exclut automatiquement les élèves`
   - **Trigger** : Daily
   - **Start** : Choisir la date
   - **Recur every** : 1 day
   - **Time** : 08:00:00

4. **Action** :
   - **Action** : Start a program
   - **Program/script** : `node`
   - **Add arguments** : `scripts/daily-payment-check.js`
   - **Start in** : `c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE`

5. **Finish**
   - Cocher "Open the Properties dialog"
   - Cliquez sur **Finish**

6. **Propriétés avancées** :
   - **General** :
     - ✅ Run whether user is logged on or not
     - ✅ Run with highest privileges
   - **Conditions** :
     - ❌ Start the task only if the computer is on AC power
     - ✅ Wake the computer to run this task (optionnel)
   - **Settings** :
     - ✅ Allow task to be run on demand
     - ❌ Stop the task if it runs longer than: 1 hour
     - If the task fails, restart every: 5 minutes
     - Attempt to restart up to: 3 times

7. **OK** → Entrez votre mot de passe Windows

### Méthode 2 : PowerShell (Avancé)

```powershell
# Créer la tâche planifiée
$action = New-ScheduledTaskAction `
  -Execute "node" `
  -Argument "scripts/daily-payment-check.js" `
  -WorkingDirectory "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

$trigger = New-ScheduledTaskTrigger -Daily -At 8am

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERNAME" `
  -LogonType S4U `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName "DailyPaymentCheck" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Vérifie les paiements en retard et exclut automatiquement les élèves"
```

### Vérifier la tâche

```powershell
# Lister la tâche
Get-ScheduledTask -TaskName "DailyPaymentCheck"

# Voir l'historique
Get-ScheduledTaskInfo -TaskName "DailyPaymentCheck"

# Tester manuellement
Start-ScheduledTask -TaskName "DailyPaymentCheck"
```

### Supprimer la tâche

```powershell
Unregister-ScheduledTask -TaskName "DailyPaymentCheck" -Confirm:$false
```

## 📊 Monitoring

### Voir les logs

Les logs s'affichent dans la console PowerShell si vous exécutez :
```powershell
node scripts/daily-payment-check.js
```

### Rediriger vers un fichier log

```powershell
# Créer un dossier logs
New-Item -ItemType Directory -Force -Path logs

# Exécuter avec logs
node scripts/daily-payment-check.js >> logs/payment-check.log 2>&1
```

### Modifier la tâche pour logger

**Arguments** : 
```
/c node scripts/daily-payment-check.js >> logs/payment-check-%date:~-4,4%%date:~-7,2%%date:~-10,2%.log 2>&1
```

**Program** : `cmd`

### Consulter les logs

```powershell
# Dernier log
Get-Content logs/*.log | Select-Object -Last 50

# Logs d'aujourd'hui
$today = Get-Date -Format "yyyyMMdd"
Get-Content "logs/payment-check-$today.log"
```

## 🔔 Ajouter des notifications

### Email via PowerShell

Modifiez le script pour envoyer un email en cas d'exclusion :

**Ajouter après la ligne `runDailyCheck();`** :

```javascript
async function sendEmailNotification(studentsExcluded) {
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: '"Système Ecole" <noreply@ecole.com>',
    to: 'admin@ecole.com',
    subject: `⚠️ ${studentsExcluded} élève(s) exclus`,
    text: `${studentsExcluded} élève(s) ont été exclus automatiquement pour 30+ jours de retard.`,
    html: `<h2>⚠️ Alerte Exclusion</h2><p><strong>${studentsExcluded}</strong> élève(s) ont été exclus automatiquement pour retard de paiement de 30+ jours.</p>`,
  });
}
```

**Installer nodemailer** :
```powershell
npm install nodemailer
```

**Ajouter au .env** :
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Notification Windows

```powershell
# Créer un script PowerShell : scripts/notify.ps1
@"
param([int]$excluded)
if ($excluded -gt 0) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "$excluded élève(s) ont été exclus pour retard de paiement",
        "Alerte Paiements",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
}
"@ | Out-File -FilePath scripts/notify.ps1 -Encoding UTF8

# Modifier la tâche pour appeler ce script après
```

## 🐛 Dépannage

### Erreur : "Cannot find module 'dotenv'"

```powershell
npm install dotenv
```

### Erreur : "Variables d'environnement manquantes"

Vérifiez que le fichier `.env` existe et contient les bonnes valeurs :
```powershell
Get-Content .env
```

### La tâche ne s'exécute pas

1. Vérifier dans Task Scheduler :
   - Onglet **History** (activer via View > Show History)
   - Voir les erreurs

2. Tester manuellement :
```powershell
Start-ScheduledTask -TaskName "DailyPaymentCheck"
```

3. Vérifier les permissions :
   - La tâche doit s'exécuter avec vos privilèges
   - Le PC doit être allumé

### Le script fonctionne manuellement mais pas via Task Scheduler

**Problème** : Le chemin du fichier .env n'est pas trouvé

**Solution** : Spécifier le chemin absolu dans le script

```javascript
// Au début du fichier
require('dotenv').config({
  path: 'c:\\Users\\AA\\OneDrive - PIGIER CÔTE D\'IVOIRE\\Bureau\\ECOLE\\.env'
});
```

## ⚠️ Limites

- ❌ **PC doit être allumé** : La tâche ne s'exécutera pas si le PC est éteint
- ❌ **Pas de redondance** : Si le PC plante, la vérification est manquée
- ❌ **Maintenance** : Nécessite de garder le PC opérationnel

**Recommandation** : Pour une solution en production, utilisez **GitHub Actions** ou **EasyCron** qui fonctionnent dans le cloud.

## ✅ Checklist

- [ ] Node.js installé
- [ ] Dépendances installées (`npm install`)
- [ ] Fichier .env créé avec les bonnes valeurs
- [ ] Script testé manuellement (`node scripts/daily-payment-check.js`)
- [ ] Tâche planifiée créée dans Task Scheduler
- [ ] Tâche testée (`Start-ScheduledTask`)
- [ ] Notifications configurées (optionnel)
- [ ] Logs configurés (optionnel)

---

**Pour une solution cloud sans maintenance, voir** : [ALTERNATIVE_CRON_SOLUTIONS.md](../ALTERNATIVE_CRON_SOLUTIONS.md)
