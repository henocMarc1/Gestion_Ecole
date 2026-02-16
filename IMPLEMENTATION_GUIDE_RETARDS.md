# 📋 GUIDE D'IMPLÉMENTATION - Système Retards de Paiement

**Date**: 11 février 2026
**Pour**: Implémentation progressive du système amélioré de gestion des retards

---

## 🚀 ÉTAPES D'IMPLÉMENTATION

### ÉTAPE 1: Avant de tester (Préparation)

#### 1.1 Rencontrer la direction
```
Discuter:
- Politique sur les frais de retard (% ou montant fixe?)
- Seuils d'escalade (combien de jours avant niveau 2?)
- Blocs de documents (certificats oui/non?)
- Arrangements acceptables (oui/non?)
- Signalements ou suspensions d'inscrits possible?
- Approbation par le conseil d'école

Document à signer: Politique de retard de paiement
```

#### 1.2 Préparer les templates
```
Email Templates:
- Niveau 1: "Rappel amical" (j0-j5)
- Niveau 2: "Première relance" (j6-j15)
- Niveau 3: "Deuxième relance" (j16-j30)
- Niveau 4: "Ultimatum" (j31-j60)
- Niveau 5: "Mise en demeure" (j61+)

SMS Templates (max 160 caractères):
- [École] Rappel: facture échue. Payer avant DATE.

Configuration clé:
- Qui reçoit quoi? (comptable, directeur, etc.)
- Quelle langue? (Français ou plurilingue?)
- Quels canaux? (Email, SMS, Portail?)
```

#### 1.3 Décider de la politique de frais
```
Option A: FRAIS FIXES
- Frais fixes: 5000 XOF après 30 jours
- Avantage: Simple à comprendre
- Inconvénient: Inéquitable petits vs gros montants

Option B: POURCENTAGE
- 2% par mois de retard (max 15%)
- Avantage: Proportionnel au montant
- Inconvénient: Plus de calcul

Option C: PROGRESSIF (RECOMMANDÉ)
- Jour 30: +2000 XOF
- Jour 60: +4000 XOF
- Jour 90: +5000 XOF
- Avantage: Incitatif progressif

RECOMMANDATION: Progressif avec max de 15% du total
```

---

### ÉTAPE 2: Configuration initiale en base

#### 2.1 Exécuter la migration
```bash
# Terminer: Créer les 5 nouvelles tables
psql -h [host] -U [user] -d [database] -f 024_improved_late_payment_system.sql
```

#### 2.2 Insérer configuration de frais (exemples)
```sql
-- Pour école avec politique PROGRESSIVE
INSERT INTO late_payment_fee_settings (school_id, fee_type, progressive_tier_1_days, progressive_tier_1_fee, progressive_tier_2_days, progressive_tier_2_fee, progressive_tier_3_days, progressive_tier_3_fee, is_active)
SELECT 
    id, 
    'progressive',
    30, 2000, -- Après 30j: 2000 XOF
    60, 4000, -- Après 60j: +4000 XOF (total 6000)
    90, 5000, -- Après 90j: +5000 XOF (total 11000)
    TRUE
FROM schools
WHERE name = 'Votre École';
```

#### 2.3 Insérer niveaux d'escalade (5 niveaux)
```sql
-- NIVEAU 1: Avertissement doux (J0-J5)
INSERT INTO escalation_levels 
(school_id, level, level_name, level_description, days_overdue_min, days_overdue_max, send_email, send_sms, notify_accountant, notify_principal, block_documents, apply_late_fee, is_active, execution_order)
SELECT 
    id,
    1,
    'Avertissement doux',
    'Rappel amical lors des premiers jours de retard',
    0, 5,
    TRUE, FALSE,
    FALSE, FALSE,
    FALSE, FALSE,
    TRUE, 1
FROM schools
WHERE name = 'Votre École';

-- NIVEAU 2: 1ère Relance (J6-J15)
INSERT INTO escalation_levels 
(school_id, level, level_name, level_description, days_overdue_min, days_overdue_max, send_email, send_sms, notify_accountant, notify_principal, block_documents, apply_late_fee, is_active, execution_order)
SELECT 
    id,
    2,
    '1ère Relance officielle',
    'Relance officielle avec frais initiaux',
    6, 15,
    TRUE, TRUE,
    TRUE, FALSE,
    FALSE, TRUE, -- apply_late_fee = TRUE
    TRUE, 2
FROM schools
WHERE name = 'Votre École';

-- NIVEAU 3: 2ème Relance (J16-J30)
INSERT INTO escalation_levels 
(school_id, level, level_name, level_description, days_overdue_min, days_overdue_max, send_email, send_sms, notify_accountant, notify_principal, block_documents, apply_late_fee, is_active, execution_order)
SELECT 
    id,
    3,
    '2ème Relance avec frais',
    'Deuxième relance + frais additionnels',
    16, 30,
    TRUE, TRUE,
    TRUE, TRUE, -- notify_principal = TRUE
    FALSE, TRUE,
    TRUE, 3
FROM schools
WHERE name = 'Votre École';

-- NIVEAU 4: Ultimatum (J31-J60)
INSERT INTO escalation_levels 
(school_id, level, level_name, level_description, days_overdue_min, days_overdue_max, send_email, send_sms, notify_accountant, notify_principal, block_documents, apply_late_fee, is_active, execution_order)
SELECT 
    id,
    4,
    'Ultimatum avec blocage',
    'Ultimatum + blocage possible de documents',
    31, 60,
    TRUE, TRUE,
    TRUE, TRUE,
    TRUE, TRUE, -- block_documents = TRUE
    TRUE, 4
FROM schools
WHERE name = 'Votre École';

-- NIVEAU 5: Mise en demeure (J61+)
INSERT INTO escalation_levels 
(school_id, level, level_name, level_description, days_overdue_min, days_overdue_max, send_email, send_sms, notify_accountant, notify_principal, block_documents, apply_late_fee, is_active, execution_order)
SELECT 
    id,
    5,
    'Mise en demeure formelle',
    'Mise en demeure légale + signalement possible',
    61, 999,
    TRUE, TRUE,
    TRUE, TRUE,
    TRUE, TRUE,
    TRUE, 5
FROM schools
WHERE name = 'Votre École';
```

#### 2.4 Ajouter templates d'emails
```sql
-- Niveau 1
UPDATE escalation_levels
SET 
    email_subject = '⏰ Rappel - Facture en attente',
    email_template = '<body><p>Bonjour,</p><p>Nous remarquons que votre facture de scolarité pour [STUDENT_NAME] n''a pas encore été payée.</p><p><strong>Date d''échéance: [DUE_DATE]</strong></p><p>Merci de régulariser dans les meilleurs délais.</p><p>Cordialement,<br/>[SCHOOL_NAME]</p></body>',
    sms_template = '[SCHOOL] Rappel: Payer avant [DUE_DATE] pour [STUDENT]. Merci!'
WHERE level = 1;

-- Niveau 2
UPDATE escalation_levels
SET 
    email_subject = '⚠️ 1ère RELANCE - Facture en retard',
    email_template = '<body><p>Madame, Monsieur,</p><p>Malgré notre rappel précédent, la facture de [STUDENT_NAME] reste impayée.</p><p><strong>Montant: [AMOUNT] XOF</strong><br/><strong>Retard: [DAYS_OVERDUE] jours</strong><br/><strong>Frais de retard appliqués: [LATE_FEES] XOF</strong></p><p>⏰ <strong>Payer avant [PAYMENT_DEADLINE]</strong></p><p>Modes de paiement: [PAYMENT_METHODS]</p><p>En cas de difficultés, contactez-nous.</p></body>',
    sms_template = '[SCHOOL] 1ère relance: [AMOUNT]XOF dû. Payer avant [DATE]. Contactez: [PHONE]'
WHERE level = 2;

-- Niveau 3
UPDATE escalation_levels
SET 
    email_subject = '🚨 DEUXIÈME RELANCE - Action urgente requise',
    email_template = '<body><p>Madame, Monsieur,</p><p>Nous constatons que la facture de [STUDENT_NAME] reste impayée après 2 relances.</p><p><strong>MONTANT DÛ: [TOTAL_AMOUNT] XOF</strong> (+ frais: [LATE_FEES])</p><p>Cette situation peut affecter la scolarité de votre enfant.</p><p>⏰ <strong>DERNIER DÉLAI: [PAYMENT_DEADLINE]</strong></p><p>Contactez immédiatement le bureau du comptable.</p></body>',
    sms_template = '🚨 RELANCE FINALE: Payer [AMOUNT]XOF avant [DATE]. Risque d''exclusion!'
WHERE level = 3;

-- Niveau 4
UPDATE escalation_levels
SET 
    email_subject = '🔴 ULTIMATUM - Suspension de services',
    email_template = '<body><p>Madame, Monsieur,</p><p>La situation de votre compte n''a pas été régularisée malgré les relances précédentes.</p><p>À compter de cette date, l''accès aux documents scolaires est bloqué jusqu''au paiement intégral.</p><p><strong>MONTANT À PAYER DE TOUTE URGENCE: [TOTAL_AMOUNT] XOF</strong></p><p>Arrangements possibles - Contactez le directeur.</p></body>',
    sms_template = 'URGENT: Accès aux documents bloqué. Payer [AMOUNT] avant [DATE] ou contacter direction.'
WHERE level = 4;

-- Niveau 5
UPDATE escalation_levels
SET 
    email_subject = 'MISE EN DEMEURE - Procédure légale',
    email_template = '<body><p>Madame, Monsieur,</p><p>Malgré les relances répétées, votre obligation de paiement n''a pas été respectée.</p><p>[SCHOOL_NAME] engage une procédure légale pour le recouvrement de:</p><p><strong>[TOTAL_AMOUNT] XOF + frais légaux</strong></p><p>Vous avez 5 jours pour régulariser.</p></body>',
    sms_template = 'MISE EN DEMEURE: Procédure légale en cours. Contactez direction URGENCE.'
WHERE level = 5;
```

---

### ÉTAPE 3: Backend - Fonctions et triggers

#### 3.1 Fonction: Calculer frais de retard
```sql
CREATE OR REPLACE FUNCTION calculate_late_fees(
    p_invoice_id UUID,
    p_days_overdue INT
)
RETURNS DECIMAL AS $$
DECLARE
    v_school_id UUID;
    v_fee_settings RECORD;
    v_invoice RECORD;
    v_calculated_fee DECIMAL;
BEGIN
    -- Récupérer facture et paramètres
    SELECT school_id, total INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    SELECT * INTO v_fee_settings FROM late_payment_fee_settings WHERE school_id = v_invoice.school_id;
    
    v_calculated_fee := 0;
    
    -- Calculer selon type
    IF v_fee_settings.fee_type = 'flat_fee' THEN
        v_calculated_fee := v_fee_settings.flat_amount;
    
    ELSIF v_fee_settings.fee_type = 'percentage' THEN
        v_calculated_fee := (v_invoice.total * v_fee_settings.percentage_per_month / 100) * (p_days_overdue / 30.0);
        v_calculated_fee := LEAST(v_calculated_fee, v_invoice.total * v_fee_settings.max_percentage / 100);
    
    ELSIF v_fee_settings.fee_type = 'progressive' THEN
        IF p_days_overdue >= v_fee_settings.progressive_tier_3_days THEN
            v_calculated_fee := v_fee_settings.progressive_tier_1_fee + v_fee_settings.progressive_tier_2_fee + v_fee_settings.progressive_tier_3_fee;
        ELSIF p_days_overdue >= v_fee_settings.progressive_tier_2_days THEN
            v_calculated_fee := v_fee_settings.progressive_tier_1_fee + v_fee_settings.progressive_tier_2_fee;
        ELSIF p_days_overdue >= v_fee_settings.progressive_tier_1_days THEN
            v_calculated_fee := v_fee_settings.progressive_tier_1_fee;
        END IF;
    END IF;
    
    RETURN COALESCE(v_calculated_fee, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 3.2 Fonction: Vérifier et appliquer escalade
```sql
CREATE OR REPLACE FUNCTION check_and_apply_escalation(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
    v_days_overdue INT;
    v_escalation_level RECORD;
    v_invoice RECORD;
    v_current_level INT;
BEGIN
    -- Récupérer facture en retard
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND status = 'OVERDUE';
    IF v_invoice IS NULL THEN RETURN; END IF;
    
    -- Calculer jours de retard
    v_days_overdue := CURRENT_DATE - v_invoice.due_date;
    
    -- Trouver niveau d'escalade approprié
    SELECT * INTO v_escalation_level
    FROM escalation_levels
    WHERE school_id = v_invoice.school_id
    AND v_days_overdue BETWEEN days_overdue_min AND days_overdue_max
    AND is_active = TRUE;
    
    IF v_escalation_level IS NULL THEN RETURN; END IF;
    
    -- Avant escalade, vérifier qu'on ne l'a pas déjà fait
    IF v_invoice.current_escalation_level >= v_escalation_level.level THEN
        RETURN;
    END IF;
    
    -- Enregistrer escalade
    INSERT INTO escalation_history (
        school_id, student_id, invoice_id, escalation_level_id,
        at_days_overdue, escalated_by
    ) VALUES (
        v_invoice.school_id,
        v_invoice.student_id,
        v_invoice.id,
        v_escalation_level.id,
        v_days_overdue,
        NULL -- Système
    );
    
    -- Appliquer frais si nécessaire
    IF v_escalation_level.apply_late_fee THEN
        UPDATE invoices
        SET late_fees_applied = calculate_late_fees(p_invoice_id, v_days_overdue),
            current_escalation_level = v_escalation_level.level
        WHERE id = p_invoice_id;
    END IF;
    
    -- Bloquer documents si nécessaire
    IF v_escalation_level.block_documents THEN
        INSERT INTO document_access_restrictions (
            school_id, student_id, document_type, related_invoice_id,
            restriction_reason, blocked_by
        ) VALUES (
            v_invoice.school_id,
            v_invoice.student_id,
            'bulletin',
            v_invoice.id,
            'payment_overdue',
            NULL
        )
        ON CONFLICT DO NOTHING;
    END IF;
    
END;
$$ LANGUAGE plpgsql;
```

#### 3.3 Trigger: Auto-escalade quotidienne
```sql
-- Fonction wrapper pour trigger
CREATE OR REPLACE FUNCTION trigger_check_escalation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM check_and_apply_escalation(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur chaque facture OVERDUE
DROP TRIGGER IF EXISTS invoice_escalation_trigger ON invoices;
CREATE TRIGGER invoice_escalation_trigger
    AFTER UPDATE OR INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.status = 'OVERDUE')
    EXECUTE FUNCTION trigger_check_escalation();
```

---

### ÉTAPE 4: API Endpoints (Backend Next.js)

#### 4.1 GET: Voir niveaux d'escalade
```typescript
// app/api/accountant/escalation-levels/route.ts
import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { data, error } = await supabase
    .from('escalation_levels')
    .select('*')
    .eq('is_active', true)
    .order('level', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

#### 4.2 POST: Proposer arrangement
```typescript
// app/api/accountant/arrangements/propose/route.ts
export async function POST(request: NextRequest) {
  const { invoiceId, arrangement, justification } = await request.json();

  const { data, error } = await supabase
    .from('payment_arrangements')
    .insert({
      invoice_id: invoiceId,
      arrangement_type: arrangement.type, // 'partial_payment', 'installments', etc.
      num_installments: arrangement.installments,
      justification,
      status: 'proposed'
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // TODO: Notifier parent par email
  return NextResponse.json(data[0]);
}
```

#### 4.3 PUT: Bloquer documents
```typescript
// app/api/accountant/documents/block/route.ts
export async function PUT(request: NextRequest) {
  const { studentId, documentType, invoiceId, reason } = await request.json();

  const { data, error } = await supabase
    .from('document_access_restrictions')
    .insert({
      student_id: studentId,
      document_type: documentType,
      related_invoice_id: invoiceId,
      restriction_reason: reason
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data[0]);
}
```

---

### ÉTAPE 5: Interface Comptable - Améliorations UI

#### 5.1 Nouveau composant: Late Payment Dashboard
```
Location: src/app/dashboard/accountant/late-payments/page.tsx

Sections:
1. KPI Cards (4):
   - "MONTANT EN RETARD" (2.5M XOF) 🔴
   - "ÉTUDIANTS CONCERNÉS" (47) ⚠️
   - "JOURS DE RETARD MOYEN" (23 j)
   - "CAS CRITIQUES (90j+)" (8)

2. Filtres:
   - Par classe
   - Par montant (> 100k, 500k, 1M)
   - Par jours retard (0-15, 16-30, 31-60, 60+)
   - Par escalade (Niveau 1-5)

3. Tableau avec colonnes:
   - Étudiant
   - Classe
   - Montant dû
   - Dû depuis (jours)
   - Frais appliqués
   - Escalade (Niveau + Badge couleur)
   - Arrangement (Si accepté)
   - Documents bloqués (✓/✗)
   - Actions rapides (Relancer, Proposer plan, Bloquer docs)

4. Timeline d'escalade:
   - Afficher progression des niveaux
   - Dates d'escalade
   - Actions prises
```

#### 5.2 Nouveau composant: Arrangement Manager
```
Location: src/app/dashboard/accountant/arrangements/page.tsx

Sections:
1. Liste des arrangements:
   - Proposés (En attente parent)
   - Acceptés (En cours)
   - Termins (Payés)
   - Défaillants (Non respectés)

2. Détails arrangement:
   - Étudiant, montant
   - Type: échelonnement, report, paiement partiel
   - Dates importantes
   - Montants par tranche

3. Actions:
   - Renouveler
   - Déclarer défaillance
   - Annuler/Modifier
```

#### 5.3 Nouvel composant: Fee Configuration
```
Location: src/app/dashboard/accountant/settings/late-fees

Formulaire:
- Fee type (Radio: Flat / Percentage / Progressive)
- Montants/%, seuils, plafonds
- Toggle: Appliquer auto frais?
- Niveaux d'escalade (Tableau éditable)
- Templates emails/SMS

Tests:
- Simulateur: Montrer frais estimés pour différents retards
```

---

### ÉTAPE 6: Interface Parent - Notification

#### 6.1 Portal Parent: Voir retards
```
Pages à créer/modifier:

1. Dashboard Parent:
   - Card "Paiements en retard" si applicable
   - Bouton "Voir factures" → liste avec filtres

2. Détail Facture:
   - Status clair avec couleur (DRAFT/SENT/OVERDUE/PAID)
   - Si retard: Badge avec "X jours retard"
   - Montant + Frais de retard appliqués
   - Timeline des relances reçues
   - Lien pour proposer arrangement

3. Arrangement:
   - Si parent a arrangement proposé:
     - Bouton "Accepter" (avec confirmation)
     - Bouton "Proposer modification"
     - Voir le plan de paiement proposé

4. Notifications:
   - Toast quand relance reçue
   - Email avec lien direct
   - SMS court avec action urgente
```

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Phase 1: Database
- [ ] Migration 024 exécutée avec succès
- [ ] Données de test insérées (2-3 factures en retard)
- [ ] RLS policies testées
- [ ] Triggers vérifiés
- [ ] View `student_payment_status` fonctionnelle

### Phase 2: Backend API
- [ ] Endpoints GET escalation levels
- [ ] Endpoint POST propose arrangement
- [ ] Endpoint PUT block documents
- [ ] Endpoint GET payment status par étudiant
- [ ] Fonction calculate_late_fees testée
- [ ] Fonction check_and_apply_escalation testée

### Phase 3: Frontend Comptable
- [ ] Page `/accountant/late-payments` créée
- [ ] KPI cards affichant données correctes
- [ ] Tableau étudiants en retard fonctionnel
- [ ] Filtres opérationnels
- [ ] Actions rapides testées

### Phase 4: Frontend Parent
- [ ] Portal parent affiche retards
- [ ] Arrangements visibles par parent
- [ ] Notifications fonctionnelles
- [ ] Statuts factures clairs

### Phase 5: Testing
- [ ] Test: Facture devient OVERDUE → Frais auto-appliqués?
- [ ] Test: Jour 6 → Escalade niveau 2?
- [ ] Test: Escalade → Documents bloqués?
- [ ] Test: Parent accepte arrangement → Status mis à jour?
- [ ] Test: Parent paie → Frais annulés?

### Phase 6: Déploiement
- [ ] Accord direction sur politiques
- [ ] Formation staff comptable
- [ ] Notification parents (email + portail)
- [ ] Déploiement dev → staging → prod
- [ ] Monitoring premier mois

---

## ⚠️ ATTENTION - Points critiques

1. **Légalité**: Frais et intérêts doivent être conformes à la loi locale (Côte d'Ivoire)
2. **Équité**: Politique appliquée uniformément à tous (pas de discrimination)
3. **Communication**: Parents doivent connaître règles AVANT l'année scolaire
4. **Flexibilité**: Directeur peut annuler frais en cas de situation difficile
5. **Audit**: Tout tracé dans `escalation_history` et `payment_audit_log`
6. **Privacy**: Données sensibles (raisons retard) protégées par RLS

---

## 📞 SUPPORT & DOCUMENTATION

- Guide pour Comptable: `GUIDE_COMPTABLE_RETARDS.md` (À créer)
- Guide pour Parent: `GUIDE_PARENT_PAIEMENTS.md` (À créer)
- Troubleshooting: `TROUBLESHOOTING_RETARDS.md` (À créer)
