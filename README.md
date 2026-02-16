# École Management System 🎓

Système complet de gestion d'école maternelle et primaire, développé avec Next.js 14, TypeScript, Tailwind CSS et Supabase.

## 🚀 Fonctionnalités

### Authentification & Sécurité
- ✅ Connexion unique avec redirection automatique selon le rôle
- ✅ Row Level Security (RLS) complète sur Supabase
- ✅ 6 rôles utilisateurs : Super Admin, Admin, Secrétaire, Comptable, Enseignant, Parent
- ✅ Audit logs sur toutes les actions sensibles

### Gestion des Élèves
- ✅ Inscription et gestion complète des élèves
- ✅ Affectation aux classes
- ✅ Liaison parents-enfants
- ✅ Historique académique

### Gestion des Présences
- ✅ Marquage quotidien par les enseignants
- ✅ Fenêtre de modification de 48h
- ✅ Exports CSV
- ✅ Statistiques de présence

### Gestion Financière
- ✅ Création et gestion des frais de scolarité
- ✅ Génération automatique de factures
- ✅ Traitement des paiements (Cash, Mobile Money, Virement)
- ✅ Génération de reçus PDF
- ✅ Historique immuable des paiements
- ✅ Rapports financiers

### Communication
- ✅ Système de messages internes
- ✅ Notifications (préparé pour SMS/Email)
- ✅ Tableau de bord personnalisé par rôle

## 📋 Prérequis

- Node.js >= 18.0.0
- npm >= 9.0.0
- Compte Supabase (gratuit)

## 🛠️ Installation

### 1. Cloner le projet

```bash
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration Supabase

#### 3.1. Créer un projet Supabase
1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Notez l'URL et les clés API

#### 3.2. Configurer les variables d'environnement

Copiez `.env.local.example` vers `.env.local` :

```bash
cp .env.local.example .env.local
```

Remplissez les variables :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3.3. Exécuter les migrations SQL

Dans le Dashboard Supabase, allez dans **SQL Editor** et exécutez dans l'ordre :

1. `supabase/migrations/001_initial_schema.sql` - Crée toutes les tables
2. `supabase/migrations/002_rls_policies.sql` - Configure les politiques de sécurité

#### 3.4. Créer les comptes utilisateurs

Dans Supabase, allez dans **Authentication** > **Users** et créez les comptes suivants :

**Important** : Utilisez les UUID exacts du seed data pour que les relations fonctionnent !

| Email | UUID | Password |
|-------|------|----------|
| superadmin@ecole.ci | 11111111-1111-1111-1111-111111111111 | Test123456! |
| admin@ecole-etoiles.ci | 22222222-2222-2222-2222-222222222222 | Test123456! |
| comptable@ecole-etoiles.ci | 33333333-3333-3333-3333-333333333333 | Test123456! |
| secretaire@ecole-etoiles.ci | 44444444-4444-4444-4444-444444444444 | Test123456! |
| enseignant1@ecole-etoiles.ci | 55555555-5555-5555-5555-555555555555 | Test123456! |
| enseignant2@ecole-etoiles.ci | 66666666-6666-6666-6666-666666666666 | Test123456! |
| parent.yao@gmail.com | 77777777-7777-7777-7777-777777777777 | Test123456! |
| parent.sekou@yahoo.fr | 88888888-8888-8888-8888-888888888888 | Test123456! |
| parent.konan@outlook.com | 99999999-9999-9999-9999-999999999999 | Test123456! |

#### 3.5. Charger les données de test

Dans **SQL Editor**, exécutez :

```sql
-- Contenu de supabase/seeds/001_test_data.sql
```

### 4. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 🧪 Tests

### Tests unitaires

```bash
npm test
```

### Tests E2E

```bash
npm run test:e2e
```

## 🏗️ Structure du projet

```
ECOLE/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── login/             # Page de connexion
│   │   ├── dashboard/         # Dashboards par rôle
│   │   └── api/               # API Routes
│   ├── components/
│   │   ├── ui/                # Composants UI de base
│   │   ├── auth/              # Composants d'authentification
│   │   └── layout/            # Layouts (AppShell, Sidebar)
│   ├── hooks/                 # Custom hooks (useAuth, etc.)
│   ├── lib/                   # Configuration (Supabase client)
│   ├── types/                 # Types TypeScript
│   └── utils/                 # Fonctions utilitaires
├── supabase/
│   ├── migrations/            # Migrations SQL
│   └── seeds/                 # Données de test
├── e2e/                       # Tests E2E Playwright
├── public/                    # Assets statiques
└── [fichiers de config]
```

## 🎨 Guide de Design (Figma)

### Tokens de Design → Tailwind CSS

Le fichier [DESIGN_GUIDE.md](./DESIGN_GUIDE.md) contient le mapping complet.

#### Palette de couleurs

```javascript
// tailwind.config.ts
colors: {
  primary: { 
    500: '#f0701d' // Orange chaleureux
  },
  secondary: { 
    500: '#0ea5e9' // Bleu ciel
  },
  accent: { 
    500: '#d946ef' // Violet
  }
}
```

#### Typographie

- **UI** : Inter (système)
- **Accents** : Merriweather (serif)

#### Breakpoints

- Mobile : 375px
- Tablet : 768px  
- Desktop : 1024px

### Composants Figma

Le système utilise des composants avec variants :

- **Buttons** : primary, secondary, outline, ghost (sm, md, lg)
- **Inputs** : normal, error, disabled
- **Cards** : default, hover, selected
- **Badges** : success, warning, danger, info

### Prototype Interactif

Le prototype Figma démontre les flows suivants :

1. **Login** → Redirection selon rôle
2. **Enseignant** : Marquer présence
3. **Parent** : Consulter factures
4. **Comptable** : Créer paiement → Générer reçu PDF

## 📱 Pages Implémentées

### Authentification
- ✅ `/login` - Page de connexion unique

### Dashboards
- ✅ `/dashboard/super-admin` - Dashboard Super Admin
- ✅ `/dashboard/admin` - Dashboard Admin École
- ✅ `/dashboard/secretary` - Dashboard Secrétariat
- ✅ `/dashboard/accountant` - Dashboard Comptable
- ✅ `/dashboard/teacher` - Dashboard Enseignant
- ✅ `/dashboard/parent` - Dashboard Parent

### Pages Métier
- ✅ `/dashboard/students` - Liste des élèves
- ✅ `/dashboard/students/[id]` - Fiche élève
- ✅ `/dashboard/classes` - Gestion des classes
- ✅ `/dashboard/attendance` - Marquage de présence
- ✅ `/dashboard/payments` - Gestion des paiements
- ✅ `/dashboard/messages` - Messagerie
- ✅ `/dashboard/reports` - Rapports

## 🔒 Sécurité & RLS

### Politiques par Rôle

#### Super Admin
- Accès total à toutes les données
- Peut gérer plusieurs écoles
- Peut créer/modifier/supprimer tous les utilisateurs

#### Admin École
- Accès à toutes les données de son école
- Peut gérer utilisateurs, classes, élèves
- Accès aux rapports complets

#### Secrétariat
- Peut créer/modifier élèves
- Peut créer factures
- Lecture des paiements

#### Comptable
- Accès complet aux finances (frais, factures, paiements)
- Peut générer des reçus
- Pas d'accès aux modifications pédagogiques

#### Enseignant
- Voit uniquement ses classes
- Peut marquer les présences (48h)
- Pas d'accès aux finances

#### Parent
- Voit uniquement ses enfants
- Accès aux factures de ses enfants
- Peut consulter les présences

### Audit Logs

Toutes les actions sensibles sont loggées :
- Création/modification/suppression d'utilisateurs
- Opérations financières (paiements, frais)
- Modifications de données sensibles

## 📊 API Routes

### Génération de Reçus PDF

```typescript
POST /api/invoices/generate-receipt
Body: { paymentId: string }
Response: { pdf: string, filename: string }
```

### Webhooks de Paiement

```typescript
POST /api/payments/webhook
Body: { /* provider data */ }
```

## 🚢 Déploiement

### Vercel (Recommandé)

1. Connectez votre repo GitHub
2. Configurez les variables d'environnement
3. Déployez automatiquement

```bash
npm install -g vercel
vercel --prod
```

### Variables d'environnement en production

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # À garder secret !
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

## ✅ Checklist QA

### Flow: Login & Redirection
- [ ] Login avec email/password correct fonctionne
- [ ] Login avec mauvais identifiants échoue
- [ ] Super Admin redirigé vers `/dashboard/super-admin`
- [ ] Enseignant redirigé vers `/dashboard/teacher`
- [ ] Parent redirigé vers `/dashboard/parent`

### Flow: Enseignant - Marquer Présence
- [ ] Enseignant voit uniquement ses classes
- [ ] Peut marquer présence pour aujourd'hui
- [ ] Peut modifier présence dans les 48h
- [ ] Ne peut pas modifier présence > 48h (sauf Admin)
- [ ] Export CSV fonctionne

### Flow: Parent - Consulter Factures
- [ ] Parent voit uniquement ses enfants
- [ ] Voit les factures liées à ses enfants
- [ ] Ne voit pas les données d'autres élèves
- [ ] Peut consulter l'historique de paiements

### Flow: Comptable - Créer Paiement & Reçu
- [ ] Peut créer un nouveau paiement
- [ ] Génération du numéro de paiement automatique
- [ ] Peut générer un reçu PDF
- [ ] Le reçu contient toutes les informations correctes
- [ ] Paiement marqué comme COMPLETED

### Sécurité RLS
- [ ] Enseignant ne peut pas voir d'autres classes
- [ ] Parent ne peut pas voir d'autres enfants
- [ ] Les modifications non autorisées sont rejetées
- [ ] Audit logs enregistrés correctement

## 🤝 Contribution

Ce projet suit les conventions :
- **Commits** : Conventional Commits
- **Branches** : feature/*, fix/*, chore/*
- **Code** : ESLint + Prettier

## 📄 Licence

Propriétaire - Tous droits réservés

## 📞 Support

Pour toute question :
- Email : support@ecole.ci
- Documentation : [docs.ecole.ci](https://docs.ecole.ci)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2026
#   G e s t i o n E c o l e  
 