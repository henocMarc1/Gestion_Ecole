# 🔧 RÉVISION SYSTÈME - GESTION DES RETARDS DE PAIEMENT

**Date**: 11 février 2026
**Objectif**: Améliorer le système de fonctionnement pour les retards de paiement des frais de scolarité

---

## 📋 ÉTAT ACTUEL DU SYSTÈME

### ✅ Ce qui existe déjà
1. **Tables de base**
   - `invoices` - Factures des frais de scolarité
   - `payments` - Enregistrement des paiements
   - `tuition_fees` - Montants par classe/année
   - `payment_schedules` - Échéanciers (3 versements: Oct, Jan, Avr)

2. **Système de relances**
   - `payment_reminders` - Configuration des relances (email/SMS)
   - `reminder_history` - Historique d'envoi des relances
   - `unpaid_invoices_summary` - Vue synthétique des impayés

3. **Interface comptable**
   - Page `/dashboard/accountant/payment-reminders` - Pour voir et gérer les relances
   - Statistiques: En retard, Montant dû, Jours moyens retard, Taux succès
   - Possibilité d'envoyer relances manuelles

4. **Politiques RLS**
   - Comptables/Admin: Accès complet aux relances
   - Parents: Peuvent voir leur historique de relances

---

## ⚠️ PROBLÈMES IDENTIFIÉS

### 1. **Absence d'intérêts/pénalités sur les retards**
- ❌ Pas de calcul automatique d'intérêts composés
- ❌ Pas de frais administratifs pour retard
- ❌ Pas de dégradation progressive du montant dû

### 2. **Processus d'escalade insuffisant**
- ❌ Pas de niveaux de relance (1ère, 2ème, 3ème relance)
- ❌ Pas de délais entre les relances
- ❌ Pas d'action finale (suspension, signalement)
- ❌ Pas d'escalade vers la direction

### 3. **Gestion incomplète du statut des paiements**
- ❌ Pas de paiments partiels avec suivi détaillé
- ❌ Statuts d'invoice limités (DRAFT, SENT, OVERDUE)
- ❌ Pas de champ pour paiement échelonné accepté

### 4. **Conformité et traçabilité**
- ❌ Pas de piste d'audit complète des retards
- ❌ Pas de justificatifs de rétention de documents
- ❌ Pas de notation/scoring des parents
- ❌ Pas d'historique des arrangements de paiement

### 5. **Communication insuffisante**
- ❌ Pas de notification au principal/directeur
- ❌ Pas de communication parent bidirectionnelle
- ❌ Pas de plan de paiement proposé automatiquement
- ❌ Pas d'alertes en temps réel au comptable

### 6. **Reporting et analyses**
- ❌ Pas de tableau de bord des retards par classe
- ❌ Pas d'analyse de risque par étudiant
- ❌ Pas de tendances de paiement
- ❌ Pas de prévision des retards futurs

### 7. **Restrictions documentaires**
- ❌ Pas de blocage des documents (certificats, bulletins) en cas de retard
- ❌ Pas de gestion des droits d'accès basée sur paiement
- ❌ Pas de notifications avant restriction

---

## 🎯 RECOMMANDATIONS - PLAN D'AMÉLIORATION

### **PHASE 1: Système de pénalités et intérêts (Haute priorité)**

#### 1.1 Nouvelle table: `late_payment_fees`
```sql
CREATE TABLE late_payment_fees (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  
  -- Configuration des pénalités
  fee_type VARCHAR(50) CHECK ('flat_fee', 'percentage', 'progressive'),
  
  -- Pour frais fixes: 5000 XOF
  flat_amount DECIMAL(10, 2),
  
  -- Pour pourcentage: 2% par mois
  percentage_per_month DECIMAL(5, 2),
  max_percentage DECIMAL(5, 2), -- Cap max: 15%
  
  -- Pour progressif: j'ajoute plus après 30j, 60j, 90j
  after_days_1 INTEGER, -- 30 jours
  fee_after_days_1 DECIMAL(10, 2), -- 2000 XOF
  
  after_days_2 INTEGER, -- 60 jours
  fee_after_days_2 DECIMAL(10, 2), -- 5000 XOF
  
  after_days_3 INTEGER, -- 90 jours
  fee_after_days_3 DECIMAL(10, 2), -- 10000 XOF
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 1.2 Nouvelle table: `payment_arrangements`
```sql
CREATE TABLE payment_arrangements (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  student_id UUID REFERENCES students(id),
  invoice_id UUID REFERENCES invoices(id),
  
  -- Plan de paiement négocié
  original_due_date DATE,
  new_due_date DATE,
  
  -- Versements échelonnés
  arrangement_type VARCHAR(50) ('full_defer', 'partial_payment', 'installment'),
  num_installments INTEGER,
  installment_amount DECIMAL(10, 2),
  
  -- Statut
  status VARCHAR(50) ('proposed', 'accepted', 'rejected', 'completed', 'defaulted'),
  proposed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_parent UUID REFERENCES users(id),
  
  -- Documents
  justification TEXT, -- Raison du retard
  supporting_document_url TEXT, -- Pièce justificative
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

### **PHASE 2: Processus d'escalade amélioré (Haute priorité)**

#### 2.1 Niveaux de relance définis
```
Jour 1-5 après échéance: 
  → Email doux au parent ("Rappel amical")
  
Jour 6-15:
  → 1ère Relance officielle (Email + SMS)
  → Notification au comptable/secrétaire
  
Jour 16-30:
  → 2ème Relance avec frais additionnels
  → Proposition plan de paiement
  → Notification au directeur
  
Jour 31-60:
  → 3ème Relance avec mise en demeure
  → Blocage accès aux bulletins de notes
  → Notification à la direction générale
  
Jour 61+:
  → Mise en demeure formelle
  → Signalement possible
  → Nécessite paiement pour réinscription
```

#### 2.2 Nouvelle table: `escalation_levels`
```sql
CREATE TABLE escalation_levels (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  
  level INTEGER CHECK (level BETWEEN 1 AND 5),
  level_name VARCHAR(100), -- "Avertissement", "1ère relance", etc.
  
  days_overdue_min INTEGER, -- 0 jours
  days_overdue_max INTEGER, -- 5 jours
  
  -- Actions
  send_email BOOLEAN DEFAULT TRUE,
  send_sms BOOLEAN DEFAULT FALSE,
  notify_principal BOOLEAN DEFAULT FALSE,
  notify_admin BOOLEAN DEFAULT FALSE,
  
  -- Restrictions
  block_documents BOOLEAN DEFAULT FALSE, -- Bloquer certificats, bulletins
  block_services BOOLEAN DEFAULT FALSE, -- Bloquer accès portail
  
  -- Frais
  add_late_fee BOOLEAN DEFAULT FALSE,
  late_fee_amount DECIMAL(10, 2),
  
  email_template TEXT,
  sms_template TEXT,
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

### **PHASE 3: Gestion des documents et accès (Moyenne priorité)**

#### 3.1 Nouvelle table: `document_access_restrictions`
```sql
CREATE TABLE document_access_restrictions (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  school_id UUID REFERENCES schools(id),
  
  -- Document bloqué
  document_type VARCHAR(50) ('bulletin', 'certificat_scolarite', 'relevé', 'diplôme'),
  
  -- Raison du blocage
  reason VARCHAR(100) ('payment_overdue', 'unpaid_fees', 'exclusion'),
  trigger_amount_due DECIMAL(10, 2),
  days_overdue_at_blocking INTEGER,
  
  -- Blocage
  blocked_at TIMESTAMPTZ,
  blocked_until_date DATE,
  can_unblock BOOLEAN DEFAULT TRUE,
  unblock_amount DECIMAL(10, 2), -- Montant à payer pour débloquer
  
  -- Déblocage
  unblocked_at TIMESTAMPTZ,
  unblocked_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 3.2 Politique RLS: Empêcher accès documents si retard
- Vérifier `document_access_restrictions` avant d'autoriser accès
- Parents ne peuvent accéder bulletins/certificats que si paiement à jour

---

### **PHASE 4: Scoring et analyse de risque (Moyenne priorité)**

#### 4.1 Nouvelle table: `payment_risk_scoring`
```sql
CREATE TABLE payment_risk_scoring (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  school_id UUID REFERENCES schools(id),
  
  -- Facteurs de risque
  payment_history SMALLINT, -- 0-100 (100 = parfait, 0 = jamais payé)
  avg_days_overdue SMALLINT, -- Moyenne jours de retard
  num_late_payments INTEGER, -- Nombre de retards historiques
  num_escalations INTEGER, -- Nombre d'escalades
  
  -- Score global
  risk_score SMALLINT CHECK (risk_score BETWEEN 0 AND 100), -- 0=bas, 100=très élevé
  risk_level VARCHAR(20) ('low', 'medium', 'high', 'critical'),
  
  -- Recommandations
  recommended_action VARCHAR(100),
  
  calculated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 4.2 Vue: Tableau de bord par classe
```sql
CREATE VIEW class_payment_analysis AS
SELECT
  c.id, c.name,
  COUNT(DISTINCT s.id) total_students,
  SUM(CASE WHEN i.status = 'OVERDUE' THEN 1 ELSE 0 END) students_with_overdue,
  SUM(CASE WHEN i.status = 'OVERDUE' THEN i.total ELSE 0 END) total_overdue_amount,
  AVG(CASE WHEN i.status = 'OVERDUE' THEN CURRENT_DATE - i.due_date ELSE 0 END) avg_days_overdue
FROM classes c
LEFT JOIN students s ON c.id = s.class_id
LEFT JOIN invoices i ON s.id = i.student_id
GROUP BY c.id, c.name;
```

---

### **PHASE 5: Notification au directeur/principal (Moyenne priorité)**

#### 5.1 Nouvelle table: `principal_alerts`
```sql
CREATE TABLE principal_alerts (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  
  -- Alerte
  alert_type VARCHAR(50) ('high_overdue_amount', 'high_overdue_count', 'critical_case'),
  
  -- Paramètres
  threshold_amount DECIMAL(10, 2), -- Alerte si total > 1M XOF
  threshold_count INTEGER, -- Alerte si > 30 étudiants
  threshold_days INTEGER, -- Alerte si > 90 jours
  
  -- Destinataire
  sent_to_user_id UUID REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  
  -- Contenu
  message TEXT,
  details JSONB, -- Détails de l'alerte
  
  -- Statut
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  action_taken TEXT,
  
  created_at TIMESTAMPTZ
);
```

#### 5.2 Fonction: Trigger pour alertes
- Si total montant en retard > 1M XOF → Email au directeur
- Si > 30 inscrits en retard → Email au directeur
- Si paiement > 90 jours → Email escalade

---

### **PHASE 6: Audit trail complète (Faible priorité)**

#### 6.1 Nouvelle table: `payment_audit_log`
```sql
CREATE TABLE payment_audit_log (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES schools(id),
  
  -- Entité affectée
  entity_type VARCHAR(50) ('invoice', 'payment', 'reminder', 'arrangement', 'restriction'),
  entity_id UUID,
  
  -- Action
  action VARCHAR(50) ('created', 'updated', 'sent', 'blocked', 'unblocked'),
  old_values JSONB,
  new_values JSONB,
  
  -- Acteur
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ,
  
  -- Raison
  reason TEXT,
  
  created_at TIMESTAMPTZ
);
```

---

## 📊 RESTRUCTURATION DES TABLES EXISTANTES

### Modification: Table `invoices`
```sql
-- Ajouter colonnes manquantes
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS:
  -- Pénalités
  base_amount DECIMAL(10, 2), -- Montant original
  late_fees DECIMAL(10, 2) DEFAULT 0, -- Frais de retard ajoutés
  arrangement_id UUID REFERENCES payment_arrangements(id),
  
  -- Blocages
  documents_blocked BOOLEAN DEFAULT FALSE,
  blocked_reason VARCHAR(100),
  blocked_at TIMESTAMPTZ,
  
  -- Notes
  payment_notes TEXT,
  principal_notification_sent BOOLEAN DEFAULT FALSE,
  principal_notified_at TIMESTAMPTZ;
```

### Modification: Table `reminder_history`
```sql
-- Améliorer le suivi
ALTER TABLE reminder_history ADD COLUMN IF NOT EXISTS:
  -- Contexte de la relance
  escalation_level INTEGER,
  escalation_level_name VARCHAR(100),
  
  -- Réponse du parent
  parent_response TEXT,
  response_at TIMESTAMPTZ,
  
  -- Actions prises
  action_taken VARCHAR(100),
  action_taken_at TIMESTAMPTZ;
```

---

## 🔑 POINTS CLÉS D'IMPLÉMENTATION

### 1️⃣ **Automatisation des frais**
- Trigger sur `invoices` pour calculer frais au jour 5, 30, 60, 90
- Fonction pour appliquer frais progressifs ou pourcentage

### 2️⃣ **Processus d'escalade automatique**
- Cron job ou trigger pour vérifier chaque jour
- Appliquer niveau d'escalade approprié
- Envoyer notifications/relances
- Mettre à jour statuts

### 3️⃣ **Blocage de documents**
- Avant accès bulletin/certificat: vérifier `document_access_restrictions`
- Middleware/fonction RLS pour bloquer
- Proposer paiement ou plan avant déblocage

### 4️⃣ **Tableau de bord comptable amélioré**
- Cards: Total retard, Étudiants concernés, Montant/jours moyens, Cas critiques
- Table: Apprenants en retard avec escalade, frais calculés, prochaine action
- Filtres: Par classe, par montant, par jours de retard
- Actions: Envoyer relance, Proposer plan, Écrire note, Bloquer documents

### 5️⃣ **Interface parent**
- Voir facture avec frais calculés
- Voir historique relances
- Proposer/accepter plan de paiement
- Télécharger/joindre justificatifs

### 6️⃣ **Rapports**
- Liste en retard avec frais calculés
- Analyse par classe/trim
- Prévision basée risque
- Récapitulatif pour direction

---

## 💾 MIGRATION PROPOSÉE: `024_improved_late_payment_system.sql`

Créer une migration complète qui ajoute:
1. Tables de pénalités et arrangements
2. Niveaux d'escalade configurables
3. Restrictions d'accès aux documents
4. Scoring de risque
5. Audit trail des paiements
6. Modifications aux tables existantes

---

## 📈 AVANTAGES DE CES AMÉLIORATIONS

✅ **Légalité**: Respect des lois (frais et intérêts conformes)
✅ **Efficacité**: Escalade automatique réduit travail manuel
✅ **Conformité**: Audit trail pour la responsabilité
✅ **Récupération**: Plans de paiement flexibles augmentent taux de recouvrement
✅ **Discipline**: Restrictions documentaires incitent au paiement
✅ **Prévention**: Scoring de risque identifie problèmes tôt
✅ **Transparence**: Parents informés à chaque étape
✅ **Reporting**: Données pour simulation budgétaire

---

## 🚀 ORDRE D'IMPLÉMENTATION

1. **SEMAINE 1**: Phase 1 - Tables pénalités + Arrangement
2. **SEMAINE 2**: Phase 2 - Escalade + Triggers
3. **SEMAINE 3**: Phase 3 - Blocage documents + RLS
4. **SEMAINE 4**: Phase 4 + 5 - Scoring + Alerts directeur
5. **SEMAINE 5**: Phase 6 - Audit + Reporting
6. **SEMAINE 6**: Tests + Déploiement

---

## 📝 NOTES IMPORTANTES

> ⚠️ **Légalité**: Vérifier avec l'école que les frais de retard et intérêts sont:
> - Conformes aux contrats signés par parents
> - Autorisés par la loi locale (Côte d'Ivoire)
> - Communiqués clairement aux parents

> 📢 **Communication**: 
> - Avant implémentation, tenir assemblée parents
> - Publier guide avec taux et calendrier
> - Offrir plans de paiement dès début d'année

> 💡 **Flexibilité**:
> - Permettre directeur d'annuler frais (cas humanitaires)
> - Accepter justificatifs (problème médical, chômage, etc.)
> - Proposer arrangements/délais négociables

---

## 📋 CHECKLIST DE VALIDATION

- [ ] Accord avec direction sur politique de frais
- [ ] Architecture SQL finalisée et testée
- [ ] API endpoints pour gestion arrangements
- [ ] Pages UI pour comptable, parent, directeur
- [ ] Emails/SMS templates configurables
- [ ] Tests unitaires sur calcul frais
- [ ] Processus d'escalade testé
- [ ] Rapport audit trail complet
- [ ] Formation staff
- [ ] Documentation pour utilisateurs
- [ ] Déploiement progressif (test → prod)
