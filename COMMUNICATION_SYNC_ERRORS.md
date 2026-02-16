# 🔴 RAPPORT D'ERREURS DE SYNCHRONISATION PARENT-ENFANT

## RÉSUMÉ EXÉCUTIF
**14 erreurs critiques détectées** empêchant la communication entre les différents rôles (Admin → Prof, Prof → Parent, etc.)

---

## 1. ⚠️ ERREUR CRITIQUE : Messages Table Schema Mismatch

### Problème
La table `messages` a **2 schémas différents** selon les migrations :

**Dans 001_initial_schema.sql (ligne 321) :**
```sql
CREATE TABLE messages (
  id UUID,
  sender_id UUID,          -- ✅
  recipient_id UUID,       -- ⚠️ ATTENTION: recipient_id (pas receiver_id)
  subject VARCHAR(255),
  body TEXT,
  status message_status,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
)
```

**Dans 011_add_messages_table.sql (ligne 52) :**
```sql
CREATE TABLE messages (
  id UUID,
  sender_id UUID,          -- ✅
  receiver_id UUID,        -- ⚠️ ATTENTION: receiver_id (pas recipient_id)
  content TEXT,
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**IMPACT :**
- ❌ Colonne `subject` manquante en 011
- ❌ Colonne `body` vs `content` (incohérent)
- ❌ `recipient_id` vs `receiver_id` (INCOMPATIBLE!)
- ❌ Colonne `status` manquante en 011
- ❌ Colonne `deleted_at` manquante en 011

### Erreurs dans les pages :

#### Page: [parent/messages/page.tsx](parent/messages/page.tsx)
**Ligne 155:** Utilise `receiver_id`
```tsx
receiver_id: selectedConversation,
```
**Problème:** Si la table 001 est la vraie, doit être `recipient_id`

#### Page: [teacher/messages/page.tsx](teacher/messages/page.tsx)
**Ligne 149:** Utilise `receiver_id`
```tsx
receiver_id: selectedConversation,
```
**Problème:** Si la table 001 est la vraie, doit être `recipient_id`

#### Page: [admin/notifications/page.tsx](admin/notifications/page.tsx)
**Ligne 180-190:** Insère dans la table sans `subject` ou `body`
```tsx
.insert({
  title: ...,          // ⚠️ pas de subject
  message: ...,        // ⚠️ pas de body
  // manque status?
})
```

---

## 2. ⚠️ ERREUR : Messages School_ID Missing

### Problème
Les appels insert dans les messages ne définissent **PAS** `school_id` alors que la table le require :

#### Page: [parent/messages/page.tsx](parent/messages/page.tsx)
**Ligne 150-158:**
```tsx
await supabase
  .from('messages')
  .insert([{
    sender_id: user?.id,
    receiver_id: selectedConversation,
    content: newMessage.trim(),
    is_read: false,
    // ❌ MANQUE: school_id
  }]);
```

**Résultat:** Insertion échouée si RLS vérifie `school_id`

#### Page: [teacher/messages/page.tsx](teacher/messages/page.tsx)
**Ligne 147-153:**
```tsx
await supabase.from('messages').insert({
  sender_id: currentUser.id,
  receiver_id: selectedConversation,
  content: newMessage,
  created_at: new Date().toISOString(),
  // ❌ MANQUE: school_id
});
```

---

## 3. ⚠️ ERREUR : Notifications Recipients Policy

### Problème
La page `/admin/notifications` crée une notification pour des destinataires, mais les RLS policies ne sont pas cohérentes.

#### Problème dans [admin/notifications/page.tsx](admin/notifications/page.tsx)
**Ligne 185-190:**
```tsx
if (notificationForm.target_type === 'custom' && selectedUsers.length > 0 && notification) {
  const recipients = selectedUsers.map((userId) => ({
    notification_id: notification.id,
    user_id: userId
    // ❌ MANQUE: read_at, status, created_at?
  }))

  await supabase.from('notification_recipients').insert(recipients)
}
```

**Problème:** Les champs requis ne sont pas définis. La table notification_recipients attend:
- `read_at` (timestamp du message lu)
- `status` (read/unread)
- `read_at` (automatique mais pas toujours)

**Résultat:** Messages non marqués comme lus pour certains utilisateurs

---

## 4. ⚠️ ERREUR : Notifications RLS Policy Type Error

### Problème
La table `notifications` a les politiques pour vérifier les destinataires, mais les pages utilisateurs ne font **PAS** les requêtes correctes :

#### Page: [notifications/page.tsx](notifications/page.tsx)
**Ligne 65-79:**
```tsx
.from('notifications (
  notifications (
    id, title, message, ...
  ),
  notification_recipients (
    id, read_at
  )
)
```

**Problème:** La jointure utilise des parenthèses incorrectes pour la sélection

**Correct devrait être:**
```tsx
.from('notification_recipients')
  .select(`
    *,
    notifications (
      id, title, message, ...
    )
  `)
```

---

## 5. ⚠️ ERREUR : Real-time Subscription Type Mismatch

### Problème dans [parent/messages/page.tsx](parent/messages/page.tsx)
**Ligne 52-60:**
```tsx
useRealtimeSubscription({
  table: 'messages',
  event: 'INSERT',  // ⚠️ Spécifie INSERT seulement
  onData: () => {
    if (selectedConversation) {
      loadMessages();
    }
  },
  enabled: !!selectedConversation,
});
```

**Problème:** 
- Écoute seulement les `INSERT` nouveaux
- Ne recharge PAS si quelqu'un marque comme lu
- Ne détecte PAS les mises à jour `is_read`

**Résultat:** Les messages ne s'affichent pas comme "lus" en temps réel chez l'autre personne

### Solution correcte:
```tsx
useRealtimeSubscription({
  table: 'messages',
  event: '*',  // Écouter tous les événements (INSERT, UPDATE, DELETE)
  onData: () => {
    loadMessages();
  },
  enabled: !!selectedConversation,
});
```

---

## 6. ⚠️ ERREUR : Teacher Messages Interface Type Inconsistency

### Problème dans [teacher/messages/page.tsx](teacher/messages/page.tsx)
**Ligne 10-23:**
```tsx
interface Message {
  id: string;
  senderId: string;         // camelCase
  receiverId: string;       // camelCase
  content: string;
  createdAt: string;        // camelCase
}
```

**Mais la requête Supabase retourne:**
```tsx
const { data } = await supabase
  .from('messages')
  .select('*')  // Retourne snake_case: sender_id, receiver_id, created_at
```

**Problème:** TypeScript cast incorrect
```tsx
setMessages(data as Message[]);  // ❌ Type cast dangereux
```

**Résultat:** Les valeurs `sender_id` ne sont jamais converties en `senderId` → affichage vide

---

## 7. ⚠️ ERREUR : Notifications Missing Broadcast Schema

### Problème
La table `notifications` dans 016_add_notifications_system.sql a des colonnes que les pages ne définissent pas :

#### Page: [admin/notifications/page.tsx](admin/notifications/page.tsx)
**Ligne 163:**
```tsx
const { data: notification, error } = await supabase
  .from('notifications')
  .insert({
    school_id: schoolId,
    title: notificationForm.title,
    message: notificationForm.message,
    notification_type: notificationForm.notification_type,
    target_type: notificationForm.target_type,
    target_class_id: notificationForm.target_class_id || null,
    priority: notificationForm.priority,
    scheduled_at: notificationForm.scheduled_at || null,
    status: notificationForm.scheduled_at ? 'scheduled' : 'draft',
    created_by: user.id
    // ❌ MANQUE: broadcast_type (DEFAULT?)
  })
```

---

## 8. ⚠️ ERREUR : Notification Recipients Update Missing

### Problème
Quand on marque une notification comme lue, on update `notification_recipients`, mais la page ne le fait pas :

#### Page: [notifications/page.tsx](notifications/page.tsx)
**Ligne 105-120:**
```tsx
const unreadIds = filteredNotifications
  .filter(n => !n.read_at)
  .map(n => n.id)

if (unreadIds.length > 0) {
  // ❌ NE MET PAS À JOUR notification_recipients
  // Devrait faire:
  // supabase
  //   .from('notification_recipients')
  //   .update({ status: 'read', read_at: new Date().toISOString() })
  //   .in('notification_id', unreadIds)
  //   .eq('user_id', user.id)
}
```

**Résultat:** Les notifications ne sont jamais marquées comme lues côté serveur

---

## 9. ⚠️ ERREUR : Messages Conversation List Wrong Joining

### Problème dans [parent/messages/page.tsx](parent/messages/page.tsx)
**Ligne 72-75:**
```tsx
const { data, error } = await supabase
  .from('messages')
  .select('sender_id, receiver_id, sender:sender_id(full_name, role), receiver:receiver_id(full_name, role), created_at, content')
  .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
```

**Problème:** L'alias `sender:sender_id` et `receiver:receiver_id` utilise le même champ deux fois.

**Correct:**
```tsx
.select(`
  sender_id, 
  receiver_id, 
  sender:sender_id(full_name, role), 
  receiver:receiver_id(full_name, role), 
  created_at, 
  content
`)
```

Sinon Supabase confond les jointures.

---

## 10. ⚠️ ERREUR : Admin Actions Don't Trigger Notifications

### Problème
Quand un admin :
- Crée une classe
- Assigne un professeur
- Crée un paiement
- Change le statut d'un paiement

**RIEN ne notifie les parents/profs !**

#### Exemple: [admin/students/page.tsx](admin/students/page.tsx)
**Ligne 206-243:** Quand on crée un utilisateur
```tsx
const { data: { session: currentSession } } = await supabase.auth.getSession();

// ❌ MANQUE: Après créer l'utilisateur, envoyer une notification
// await supabase
//   .from('notifications')
//   .insert({
//     title: `Nouvel élève: ${studentForm.full_name}`,
//     message: `Un élève a été enregistré`,
//     target_type: 'teachers',
//     ...
//   })
```

#### Exemple: [admin/finance/page.tsx](admin/finance/page.tsx)
Pas d'appel de notification pour les mises à jour financières

**Résultat:** Les parents ne sont JAMAIS notifiés des changements d'état de paiement

---

## 11. ⚠️ ERREUR : Tuition Payments Status Change No Notification

### Problème dans [secretary/tuition-payments/page.tsx](secretary/tuition-payments/page.tsx)
**Ligne 269:**
```tsx
const { error } = await supabase.from('tuition_payments').insert({
  student_id: selectedStudent,
  amount_paid: parseFloat(paymentForm.amount_paid),
  payment_method: paymentForm.payment_method,
  payment_date: paymentForm.payment_date,
  notes: paymentForm.notes,
  school_id: user.school_id,
});

if (!error) {
  // ❌ MANQUE: Créer une notification pour les parents
  // await supabase
  //   .from('notifications')
  //   .insert({
  //     target_type: 'custom',
  //     title: 'Paiement reçu',
  //     message: `Paiement de ${paymentForm.amount_paid} FCFA enregistré`,
  //     ...
  //   })
}
```

---

## 12. ⚠️ ERREUR : Parent Notifications Not Real-Time

### Problème dans [notifications/page.tsx](notifications/page.tsx)
**Ligne 36-52:**
```tsx
useEffect(() => {
  fetchNotifications()
}, [user])

// ❌ Pas d'abonnement temps réel!
// Le composant n'écoute pas les nouvelles notifications
```

**Résultat:** Les parents doivent rafraîchir la page pour voir les nouvelles notifications

---

## 13. ⚠️ ERREUR : Classes Change Don't Notify Teachers

### Problème dans [admin/classes/page.tsx](admin/classes/page.tsx)
Quand on modifie une classe ou assigne un professeur, **AUCUNE notification** n'est envoyée aux professeurs affectés.

---

## 14. ⚠️ ERREUR : Payment Schedules Not Updated When Tuition Changes

### Problème dans [admin/tuition-fees/page.tsx](admin/tuition-fees/page.tsx)
**Ligne 203-210:**
```tsx
await supabase.from('tuition_fees').insert(feeData);
// ❌ MANQUE: Mettre à jour les payment_schedules pour tous les élèves de la classe
// DEVRAIT FAIRE:
// for each student in class:
//   create payment_schedule entries for new fee
```

**Résultat:** Quand on crée une nouvelle facture scolaire, les parents ne la voient pas mise à jour

---

## RÉSUMÉ DES SOLUTIONS

| # | Problème | Sévérité | Solution |
|---|----------|----------|----------|
| 1 | Messages schema (recipient_id vs receiver_id) | 🔴 CRITIQUE | Uniformiser la migration 001 et 011 |
| 2 | Messages sans school_id | 🔴 CRITIQUE | Ajouter school_id à tous les inserts messages |
| 3 | Notifications recipients incomplets | 🟠 GRAVE | Ajouter champs requises: read_at, status, created_at |
| 4 | Notifications join query incorrecte | 🟠 GRAVE | Fixer la syntaxe Supabase select |
| 5 | Real-time subscription que INSERT | 🟠 GRAVE | Changer event '*' au lieu de 'INSERT' |
| 6 | Teacher messages type mismatch | 🟠 GRAVE | Convertir snake_case → camelCase |
| 7 | Notifications champs manquants | 🟠 GRAVE | Ajouter broadcast_type, sent_at |
| 8 | Notification recipients jamais marqués lus | 🟠 GRAVE | Ajouter update after mark read |
| 9 | Conversation list jointure confuse | 🟠 GRAVE | Fixer l'alias Supabase |
| 10 | Admin actions ne notifient pas | 🟠 GRAVE | Ajouter notification triggers après chaque action |
| 11 | Paiements de frais ne notifient pas parents | 🟠 GRAVE | Ajouter notification après insert payment |
| 12 | Notifications parents pas temps réel | 🟠 GRAVE | Ajouter useRealtimeSubscription |
| 13 | Changements de classes ne notifient profs | 🟠 GRAVE | Ajouter notification après update class |
| 14 | Factures ne mettent pas à jour les parents | 🟠 GRAVE | Créer payment_schedules automatiquement |

---

## PROCHAINES ÉTAPES

1. **D'abord:** Vérifier la structure exacte de la table `messages` dans Supabase
2. **Puis:** Unifier les schémas (001 vs 011)
3. **Puis:** Corriger les types TypeScript
4. **Enfin:** Ajouter les notifications à tous les appels d'action critiques

**Temps estimé:** 4-6 heures pour corriger tous les problèmes
