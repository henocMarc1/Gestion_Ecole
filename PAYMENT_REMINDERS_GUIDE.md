# 📋 Guide du Système de Rappels de Paiement Automatisés

## 📘 Vue d'ensemble

Le système de rappels de paiement permet de suivre automatiquement les retards de paiement et d'envoyer des rappels progressifs aux parents, avec exclusion automatique après 30 jours de retard.

---

## 🎯 Fonctionnalités principales

### ✅ Ce que fait le système

1. **Surveillance automatique** : Vérifie chaque jour les paiements en retard
2. **Rappels progressifs** : 3 niveaux d'escalade selon le retard
3. **Exclusion automatique** : Suspension des élèves après 30 jours
4. **Notifications** : Envoi d'alertes aux parents
5. **Statistiques** : Tableaux de bord pour admin et parents
6. **Historique** : Suivi de tous les rappels envoyés

---

## 🏗️ Architecture du système

### Base de données

#### Table `classes`
```sql
-- Nouvelle colonne ajoutée :
payment_due_day INTEGER DEFAULT 5
-- Jour du mois où le paiement est dû (1-31)
-- Exemple : 5 = le 5 de chaque mois
```

#### Table `payment_reminders`
```sql
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  parent_id UUID REFERENCES users(id),
  class_id UUID REFERENCES classes(id),
  school_id UUID REFERENCES schools(id),
  
  month INTEGER NOT NULL,              -- Mois (1-12)
  year INTEGER NOT NULL,               -- Année
  due_date DATE NOT NULL,              -- Date d'échéance
  
  days_overdue INTEGER DEFAULT 0,      -- Jours de retard
  reminder_level INTEGER NOT NULL,     -- Niveau (1, 2, 3)
  amount_due BIGINT DEFAULT 0,         -- Montant dû
  
  status TEXT DEFAULT 'sent',          -- sent, paid, ignored, excluded
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_method TEXT,            -- email, sms, both
  
  sent_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  excluded_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT unique_reminder UNIQUE(student_id, year, month, reminder_level)
);
```

### Fonctions SQL

#### 1. `calculate_days_overdue(due_date DATE)`
**Description** : Calcule le nombre de jours de retard
**Retour** : INTEGER
```sql
SELECT calculate_days_overdue('2024-01-05'::DATE);
-- Retourne : 20 (si aujourd'hui = 25 janvier 2024)
```

#### 2. `check_overdue_payments()`
**Description** : Liste tous les paiements en retard avec le niveau de rappel approprié
**Retour** : TABLE (student_id, parent_id, class_id, school_id, month, year, due_date, days_overdue, reminder_level, amount_due)
```sql
SELECT * FROM check_overdue_payments();
```

#### 3. `create_payment_reminders()`
**Description** : Crée ou met à jour automatiquement les rappels pour tous les retards
**Retour** : INTEGER (nombre de rappels créés/mis à jour)
```sql
SELECT create_payment_reminders();
-- Retourne : 15 (15 rappels créés/mis à jour)
```

#### 4. `auto_exclude_students()`
**Description** : Exclut automatiquement les élèves avec 30+ jours de retard
**Retour** : INTEGER (nombre d'élèves exclus)
```sql
SELECT auto_exclude_students();
-- Retourne : 3 (3 élèves suspendus)
```

#### 5. `send_payment_notifications()`
**Description** : Marque les rappels comme envoyés
**Retour** : INTEGER (nombre de notifications marquées)
```sql
SELECT send_payment_notifications();
-- Retourne : 12 (12 notifications marquées)
```

### Vues

#### `active_payment_reminders`
Vue complète avec toutes les données nécessaires pour l'affichage
```sql
SELECT * FROM active_payment_reminders 
WHERE reminder_level = 3;
```

#### `payment_overdue_stats`
Statistiques agrégées par classe
```sql
SELECT * FROM payment_overdue_stats 
ORDER BY students_overdue DESC;
```

---

## 📊 Logique des rappels

### Niveaux de rappel

| Retard | Niveau | Icône | Couleur | Action |
|--------|--------|-------|---------|--------|
| 1-14 jours | Niveau 1 | ⚠️ | Jaune | Premier rappel |
| 15-29 jours | Niveau 2 | 🔔 | Orange | Deuxième rappel |
| 30+ jours | Niveau 3 | ❌ | Rouge | **EXCLUSION** |

### Calcul de l'échéance

```sql
-- Exemple : Classe avec payment_due_day = 5
-- Mois actuel : Janvier 2024
-- Date d'échéance : 2024-01-05

-- Si aujourd'hui = 2024-01-20
-- Retard = 15 jours
-- Niveau = 2 (Deuxième rappel)
```

---

## 🖥️ Interfaces utilisateur

### 1. Page Admin : `/dashboard/admin/payment-reminders`

**Fonctionnalités :**
- 📊 **Statistiques globales** : Total, niveau 1, niveau 2, exclusions, montant total
- 🔧 **Actions automatiques** :
  - "Vérifier les retards" → Génère les rappels
  - "Envoyer notifications" → Marque comme envoyées
  - "Exclure automatiquement" → Suspend les élèves 30+ jours
- 🔍 **Filtres** : Par niveau et statut
- 📋 **Table des rappels** : Liste complète avec détails
- 📈 **Statistiques par classe** : Vue d'ensemble par classe

**Actions manuelles :**
- Marquer un rappel comme payé
- Voir les détails d'un élève
- Contacter les parents

### 2. Page Parent : `/dashboard/parent/payment-reminders`

**Fonctionnalités :**
- 🚨 **Alerte urgente** : Si niveau 3 (exclusion)
- 📊 **Statistiques** : Récapitulatif des rappels actifs
- 🔔 **Rappels actifs** : Cartes détaillées par enfant
- ✅ **Historique** : Paiements effectués
- 💡 **Guide** : Explications du système

**Actions disponibles :**
- Payer maintenant (bouton)
- Contacter l'école
- Consulter l'historique

---

## 🚀 Installation et configuration

### Étape 1 : Appliquer la migration

```bash
# Dans Supabase SQL Editor, exécuter :
supabase/migrations/024_payment_reminders_system.sql
```

**Vérifications post-migration :**
```sql
-- Vérifier la colonne payment_due_day
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'classes' AND column_name = 'payment_due_day';

-- Vérifier la table payment_reminders
SELECT * FROM information_schema.tables 
WHERE table_name = 'payment_reminders';

-- Vérifier les fonctions
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%payment%' OR routine_name LIKE '%exclude%';

-- Vérifier les vues
SELECT table_name FROM information_schema.views 
WHERE table_name LIKE '%payment%';
```

### Étape 2 : Configuration des classes

**Lors de la création d'une classe :**
1. Aller dans `/dashboard/admin/classes`
2. Cliquer sur "Créer une classe"
3. Remplir le formulaire
4. **Important** : Définir le "Jour d'échéance mensuel" (1-31)
   - Exemple : 5 = paiement dû le 5 de chaque mois
5. Enregistrer

**Pour les classes existantes :**
```sql
-- Mettre à jour le jour d'échéance pour toutes les classes
UPDATE classes SET payment_due_day = 5;

-- Ou par classe spécifique
UPDATE classes 
SET payment_due_day = 10 
WHERE name = 'CP1 A';
```

### Étape 3 : Automatisation quotidienne

Le système nécessite une tâche planifiée pour vérifier les retards chaque jour.

#### Option A : Supabase Edge Function (Recommandé)

1. **Créer la fonction** :
```bash
supabase functions new daily-payment-check
```

2. **Code de la fonction** (`supabase/functions/daily-payment-check/index.ts`) :
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Créer/mettre à jour les rappels
    const { data: remindersCreated } = await supabase
      .rpc('create_payment_reminders');

    // Exclure automatiquement les élèves 30+ jours
    const { data: studentsExcluded } = await supabase
      .rpc('auto_exclude_students');

    console.log(`Rappels créés : ${remindersCreated}`);
    console.log(`Élèves exclus : ${studentsExcluded}`);

    return new Response(
      JSON.stringify({
        success: true,
        remindersCreated,
        studentsExcluded,
        timestamp: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

3. **Déployer** :
```bash
supabase functions deploy daily-payment-check
```

4. **Créer un cron job dans Supabase** :
```sql
-- Dans Supabase Dashboard > Database > Cron Jobs
SELECT cron.schedule(
  'daily-payment-check',
  '0 8 * * *',  -- Tous les jours à 8h
  $$
  SELECT
    net.http_post(
      url:='YOUR_EDGE_FUNCTION_URL',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) as request_id;
  $$
);
```

#### Option B : Cron externe (Linux)

```bash
# Ajouter dans crontab -e
0 8 * * * psql -h your-db-host -U postgres -d your-db -c "SELECT create_payment_reminders(); SELECT auto_exclude_students();"
```

#### Option C : PgAgent (PostgreSQL)

Dans pgAdmin :
1. Create Job "Daily Payment Check"
2. Schedule : Tous les jours à 08:00
3. Steps : 
   - `SELECT create_payment_reminders();`
   - `SELECT auto_exclude_students();`

---

## 📧 Intégration des notifications

### Modifier la fonction d'envoi

**Fichier** : `src/app/dashboard/admin/payment-reminders/page.tsx`

```typescript
const handleSendNotifications = async () => {
  setIsSendingNotifications(true);
  try {
    // 1. Récupérer les rappels non envoyés
    const { data: reminders } = await supabase
      .from('active_payment_reminders')
      .select('*')
      .eq('notification_sent', false);

    if (!reminders || reminders.length === 0) {
      toast.info('Aucune notification à envoyer');
      return;
    }

    // 2. Envoyer les notifications
    for (const reminder of reminders) {
      const message = getReminderMessage(reminder);
      
      // EMAIL
      if (reminder.parent_email) {
        await fetch('/api/send-email', {
          method: 'POST',
          body: JSON.stringify({
            to: reminder.parent_email,
            subject: getReminderSubject(reminder.reminder_level),
            html: message,
          }),
        });
      }

      // SMS
      if (reminder.parent_phone) {
        await fetch('/api/send-sms', {
          method: 'POST',
          body: JSON.stringify({
            to: reminder.parent_phone,
            message: message,
          }),
        });
      }
    }

    // 3. Marquer comme envoyées
    const { data, error } = await supabase.rpc('send_payment_notifications');
    
    if (error) throw error;

    toast.success(`${data} notifications envoyées`);
    await loadData();
  } catch (error) {
    console.error('Erreur:', error);
    toast.error('Erreur lors de l\'envoi');
  } finally {
    setIsSendingNotifications(false);
  }
};

// Helper functions
function getReminderSubject(level: number): string {
  switch (level) {
    case 1:
      return '⚠️ Rappel de paiement - Échéance dépassée';
    case 2:
      return '🔔 2e Rappel URGENT - Paiement en retard';
    case 3:
      return '❌ EXCLUSION - Paiement requis immédiatement';
    default:
      return 'Rappel de paiement';
  }
}

function getReminderMessage(reminder: any): string {
  return `
    <h2>Bonjour,</h2>
    <p>Nous vous informons qu'un paiement pour votre enfant <strong>${reminder.student_name}</strong> 
    (Classe ${reminder.class_name}) est en retard.</p>
    
    <ul>
      <li><strong>Mois concerné :</strong> ${MONTHS[reminder.month - 1]} ${reminder.year}</li>
      <li><strong>Retard :</strong> ${reminder.days_overdue} jours</li>
      <li><strong>Montant dû :</strong> ${reminder.amount_due.toLocaleString()} XOF</li>
      <li><strong>Niveau :</strong> ${reminder.reminder_level === 1 ? 'Premier rappel' : reminder.reminder_level === 2 ? 'Deuxième rappel' : 'EXCLUSION'}</li>
    </ul>
    
    ${reminder.reminder_level === 3 ? '<p style="color: red; font-weight: bold;">⚠️ Votre enfant a été exclu de la classe. Régularisez immédiatement.</p>' : ''}
    
    <p>Merci de régulariser votre situation au plus vite.</p>
    <p>Cordialement,<br>L'Administration</p>
  `;
}
```

### APIs d'envoi (exemples)

#### Email (Resend)
```typescript
// src/app/api/send-email/route.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, subject, html } = await req.json();
  
  const { data, error } = await resend.emails.send({
    from: 'Ecole <admin@votre-ecole.com>',
    to,
    subject,
    html,
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ success: true, data });
}
```

#### SMS (Twilio)
```typescript
// src/app/api/send-sms/route.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: Request) {
  const { to, message } = await req.json();
  
  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });

  return Response.json({ success: true, sid: result.sid });
}
```

---

## 🧪 Tests et validation

### Test manuel initial

```sql
-- 1. Créer une classe avec payment_due_day = 5
INSERT INTO classes (school_id, name, level, capacity, year_id, payment_due_day)
VALUES ('your-school-id', 'Test CP1', 'CP', 30, 'your-year-id', 5);

-- 2. Vérifier qu'un élève est inscrit et a des frais non payés
SELECT s.id, s.first_name, s.last_name, t.amount, t.paid_amount
FROM students s
JOIN tuition_fees t ON t.student_id = s.id
WHERE t.paid_amount < t.amount
LIMIT 1;

-- 3. Simuler un retard en modifiant la date d'échéance
-- (Pour test uniquement - ne pas faire en production)
UPDATE tuition_fees 
SET month = 1, year = 2024
WHERE student_id = 'your-student-id';

-- 4. Exécuter la création de rappels
SELECT create_payment_reminders();

-- 5. Vérifier les rappels créés
SELECT * FROM active_payment_reminders;

-- 6. Tester l'exclusion automatique (si 30+ jours)
SELECT auto_exclude_students();

-- 7. Vérifier le statut de l'élève
SELECT id, first_name, last_name, status FROM students 
WHERE id = 'your-student-id';
```

### Tests dans l'interface

**Admin** :
1. Se connecter en tant qu'admin
2. Aller sur `/dashboard/admin/payment-reminders`
3. Cliquer sur "Vérifier les retards" → Vérifier le résultat
4. Appliquer les filtres (niveau 1, 2, 3)
5. Marquer un rappel comme payé
6. Vérifier les statistiques par classe

**Parent** :
1. Se connecter en tant que parent
2. Aller sur `/dashboard/parent/payment-reminders`
3. Vérifier que seuls ses rappels s'affichent
4. Tester les boutons "Payer maintenant" et "Contacter l'école"

---

## 📚 Cas d'usage

### Scénario 1 : Premier rappel (1-14 jours)

**Contexte** : Parent n'a pas payé au 5 du mois, aujourd'hui = 10

**Processus** :
1. Cron exécute `create_payment_reminders()` le 10
2. Système calcule : 10 - 5 = 5 jours de retard
3. Niveau = 1 (Premier rappel)
4. Création du rappel dans la base
5. Admin clique sur "Envoyer notifications"
6. Parent reçoit email/SMS de niveau 1
7. Parent voit rappel jaune sur son interface
8. Parent paie
9. Admin marque comme "Payé"

### Scénario 2 : Deuxième rappel (15-29 jours)

**Contexte** : Parent n'a toujours pas payé, aujourd'hui = 20

**Processus** :
1. Cron exécute `create_payment_reminders()` le 20
2. Système calcule : 20 - 5 = 15 jours
3. Niveau = 2 (Deuxième rappel)
4. Mise à jour du rappel (ou création si manquant)
5. Notification envoyée automatiquement
6. Parent voit rappel orange "URGENT"

### Scénario 3 : Exclusion automatique (30+ jours)

**Contexte** : Parent n'a toujours pas payé, aujourd'hui = 5 février (>30 jours)

**Processus** :
1. Cron exécute `create_payment_reminders()` le 5/02
2. Système calcule : >30 jours de retard
3. Niveau = 3 (Exclusion)
4. Création rappel niveau 3
5. Cron exécute `auto_exclude_students()`
6. Statut de l'élève passe à "suspended"
7. Parent voit alerte rouge "EXCLUSION"
8. Parents doit contacter l'école pour réintégrer l'enfant

---

## 🔧 Maintenance et monitoring

### Logs à surveiller

```sql
-- Rappels créés aujourd'hui
SELECT COUNT(*) FROM payment_reminders 
WHERE DATE(created_at) = CURRENT_DATE;

-- Élèves exclus ce mois
SELECT s.first_name, s.last_name, pr.excluded_at
FROM payment_reminders pr
JOIN students s ON s.id = pr.student_id
WHERE pr.reminder_level = 3 
AND DATE(pr.excluded_at) >= DATE_TRUNC('month', CURRENT_DATE);

-- Montant total en retard
SELECT SUM(amount_due) as total_overdue
FROM payment_reminders
WHERE status = 'sent';

-- Classes avec le plus de retards
SELECT class_name, students_overdue, total_amount_overdue
FROM payment_overdue_stats
ORDER BY students_overdue DESC;
```

### Tâches régulières

**Quotidiennes** :
- ✅ Vérifier que le cron s'est bien exécuté
- ✅ Consulter le nombre de nouveaux rappels
- ✅ Vérifier les exclusions automatiques

**Hebdomadaires** :
- 📊 Analyser les statistiques par classe
- 📧 Relancer les parents de niveau 2-3
- 💰 Calculer le montant total des impayés

**Mensuelles** :
- 🗑️ Archiver les rappels payés de plus de 6 mois
- 📈 Générer rapport mensuel pour la direction
- 🔧 Optimiser les indexes si nécessaire

---

## ⚙️ Configuration avancée

### Personnalisation des délais

Pour modifier les seuils de rappel, éditer la migration :

```sql
-- Dans check_overdue_payments() et create_payment_reminders()
CASE
  WHEN days_overdue BETWEEN 1 AND 14 THEN 1    -- Modifier 14
  WHEN days_overdue BETWEEN 15 AND 29 THEN 2   -- Modifier 15 et 29
  WHEN days_overdue >= 30 THEN 3                -- Modifier 30
END
```

### Gestion des jours spéciaux

**Problème** : Que faire si payment_due_day = 31 et mois = février ?

**Solution 1** : Système actuel
```sql
-- Le système utilise le dernier jour du mois
-- Si payment_due_day = 31 et février, échéance = 28/02 (ou 29)
```

**Solution 2** : Ajouter validation
```typescript
// Dans le formulaire de création de classe
const validateDueDay = (day: number, classLevel: string) => {
  if (day > 28) {
    toast.warning('Attention : certains mois ont moins de 31 jours');
  }
};
```

### Échéances multiples

Pour gérer plusieurs échéances par mois :

```sql
-- Ajouter colonnes à classes
ALTER TABLE classes ADD COLUMN payment_due_days INTEGER[];
-- Exemple : {5, 15, 25} = 3 échéances par mois

-- Modifier create_payment_reminders() pour boucler sur ces dates
```

---

## 🆘 Dépannage

### Problème : Aucun rappel ne se crée

**Diagnostic** :
```sql
-- Vérifier qu'il y a des paiements en retard
SELECT * FROM check_overdue_payments();

-- Vérifier les tuition_fees
SELECT * FROM tuition_fees 
WHERE paid_amount < amount;

-- Vérifier les classes ont payment_due_day
SELECT name, payment_due_day FROM classes WHERE payment_due_day IS NULL;
```

**Solution** :
```sql
-- Corriger les classes sans échéance
UPDATE classes SET payment_due_day = 5 WHERE payment_due_day IS NULL;
```

### Problème : Les parents ne voient pas leurs rappels

**Diagnostic** :
```sql
-- Vérifier les RLS policies
SELECT * FROM payment_reminders WHERE parent_id = 'parent-user-id';

-- Vérifier le parent_id est correct
SELECT pr.*, s.parent_id 
FROM payment_reminders pr
JOIN students s ON s.id = pr.student_id
WHERE pr.parent_id != s.parent_id;
```

**Solution** :
```sql
-- Mettre à jour les parent_id manquants
UPDATE payment_reminders pr
SET parent_id = s.parent_id
FROM students s
WHERE pr.student_id = s.id AND pr.parent_id IS NULL;
```

### Problème : Exclusions non appliquées

**Diagnostic** :
```sql
-- Vérifier les rappels niveau 3
SELECT * FROM payment_reminders 
WHERE reminder_level = 3 AND status != 'excluded';

-- Vérifier le statut des élèves
SELECT s.status, pr.reminder_level, pr.days_overdue
FROM students s
JOIN payment_reminders pr ON pr.student_id = s.id
WHERE pr.reminder_level = 3;
```

**Solution** :
```sql
-- Exécuter manuellement l'exclusion
SELECT auto_exclude_students();
```

---

## 📖 Documentation API

### Endpoints REST (via Supabase)

#### GET `/rest/v1/active_payment_reminders`
Récupère les rappels actifs

**Headers** :
```
Authorization: Bearer YOUR_JWT
apikey: YOUR_ANON_KEY
```

**Query params** :
- `reminder_level=eq.1` : Filtrer par niveau
- `parent_id=eq.UUID` : Filtrer par parent
- `status=eq.sent` : Filtrer par statut

**Exemple** :
```bash
curl 'https://your-project.supabase.co/rest/v1/active_payment_reminders?parent_id=eq.123' \
  -H 'Authorization: Bearer YOUR_JWT'
```

#### POST `/rest/v1/rpc/create_payment_reminders`
Crée/met à jour les rappels

```bash
curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/create_payment_reminders' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json'
```

**Response** :
```json
{
  "data": 15  // Nombre de rappels créés
}
```

---

## 🎓 Formation des utilisateurs

### Pour les administrateurs

**Formation initiale** :
1. Comprendre le système de rappels progressifs
2. Configurer les échéances lors de la création des classes
3. Utiliser le tableau de bord admin
4. Interpréter les statistiques
5. Envoyer des notifications
6. Gérer les cas d'exclusion

**Support quotidien** :
- Vérifier le tableau de bord chaque matin
- Relancer les parents de niveau 2-3
- Traiter les demandes de réintégration
- Marquer les paiements reçus

### Pour les parents

**Communication** :
- Email explicatif lors de l'inscription
- SMS de rappel avant l'échéance
- Guide accessible sur le portail parent

**Points clés** :
- Date d'échéance de leur classe
- 3 niveaux de rappel
- Risque d'exclusion à 30 jours
- Comment payer en ligne
- Contact en cas de difficulté

---

## 📞 Support

**Pour toute question ou problème** :
- 📧 Email : support@votre-ecole.com
- 📱 Téléphone : +225 XX XX XX XX XX
- 💬 Chat : Dans l'application admin

**Documentation technique** :
- Migration : `supabase/migrations/024_payment_reminders_system.sql`
- Page admin : `src/app/dashboard/admin/payment-reminders/page.tsx`
- Page parent : `src/app/dashboard/parent/payment-reminders/page.tsx`

---

## ✅ Checklist de déploiement

- [ ] Migration 024 appliquée dans Supabase
- [ ] Fonction `create_payment_reminders()` testée
- [ ] Fonction `auto_exclude_students()` testée
- [ ] Vue `active_payment_reminders` accessible
- [ ] Page admin fonctionnelle
- [ ] Page parent fonctionnelle
- [ ] Cron job configuré (quotidien à 8h)
- [ ] Intégration email configurée
- [ ] Intégration SMS configurée (optionnel)
- [ ] `payment_due_day` défini pour toutes les classes
- [ ] Tests avec données réelles effectués
- [ ] Formation des administrateurs effectuée
- [ ] Communication envoyée aux parents
- [ ] Documentation accessible à l'équipe
- [ ] Monitoring en place

---

**Dernière mise à jour** : Janvier 2024  
**Version** : 1.0
