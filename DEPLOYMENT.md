# Instructions de Déploiement - École Management System

## 📋 Prérequis

- Compte Vercel (gratuit)
- Compte Supabase (gratuit)
- Compte GitHub
- Node.js 18+ installé localement

## 🚀 Déploiement Initial

### 1. Configuration Supabase

#### 1.1. Créer un Projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Choisissez une région proche (ex: Frankfurt pour l'Europe)
4. Notez le mot de passe de la base de données

#### 1.2. Exécuter les Migrations

Dans le **SQL Editor** de Supabase :

1. Exécutez `supabase/migrations/001_initial_schema.sql`
2. Exécutez `supabase/migrations/002_rls_policies.sql`
3. Vérifiez qu'il n'y a pas d'erreurs

#### 1.3. Créer les Comptes Auth

Dans **Authentication** > **Users** :

Créez les 9 comptes test avec leurs UUID spécifiques (voir README.md section "Créer les comptes utilisateurs").

**Important** : Les UUID doivent correspondre exactement au seed data.

#### 1.4. Charger les Seed Data

Dans le **SQL Editor**, exécutez :
```sql
-- Contenu de supabase/seeds/001_test_data.sql
```

#### 1.5. Récupérer les Clés API

Dans **Settings** > **API** :
- URL du projet : `https://xxx.supabase.co`
- `anon` key (publique)
- `service_role` key (privée, à ne JAMAIS exposer)

### 2. Configuration GitHub

#### 2.1. Créer un Repository

```bash
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"
git init
git add .
git commit -m "Initial commit - École Management System"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/ecole-management.git
git push -u origin main
```

#### 2.2. Secrets GitHub Actions

Dans **Settings** > **Secrets and variables** > **Actions**, ajoutez :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
VERCEL_PROJECT_ID=xxx
```

### 3. Configuration Vercel

#### 3.1. Importer le Projet

1. Allez sur [vercel.com](https://vercel.com)
2. Cliquez sur **Add New** > **Project**
3. Importez votre repository GitHub
4. Sélectionnez le framework : **Next.js**
5. Ne lancez pas le build tout de suite

#### 3.2. Variables d'Environnement

Dans **Settings** > **Environment Variables**, ajoutez :

**Production** :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://votre-app.vercel.app
```

**Preview** (identique mais avec URL de preview) :
```
NEXT_PUBLIC_APP_URL=https://votre-app-git-develop.vercel.app
```

**Development** (local) :
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3.3. Paramètres Build

- **Build Command** : `npm run build`
- **Output Directory** : `.next`
- **Install Command** : `npm install`
- **Development Command** : `npm run dev`

#### 3.4. Premier Déploiement

1. Cliquez sur **Deploy**
2. Attendez la fin du build (3-5 min)
3. Testez votre application

### 4. Configuration du Domaine (Optionnel)

#### 4.1. Ajouter un Domaine Personnalisé

Dans Vercel > **Settings** > **Domains** :

1. Ajoutez votre domaine (ex: `ecole.votre-domaine.com`)
2. Suivez les instructions pour configurer les DNS
3. Attendez la propagation DNS (quelques minutes à 24h)

#### 4.2. Mettre à Jour les URLs

Mettez à jour `NEXT_PUBLIC_APP_URL` avec votre nouveau domaine dans Vercel et Supabase.

Dans Supabase > **Authentication** > **URL Configuration** :
- **Site URL** : `https://ecole.votre-domaine.com`
- **Redirect URLs** : `https://ecole.votre-domaine.com/**`

## 🔒 Sécurité en Production

### Checklist Sécurité

- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurée UNIQUEMENT sur le serveur (pas dans `NEXT_PUBLIC_`)
- [ ] HTTPS activé (automatique avec Vercel)
- [ ] RLS activé sur toutes les tables Supabase
- [ ] Variables d'environnement séparées par environnement
- [ ] Politique CORS configurée dans Supabase
- [ ] Rate limiting activé (via Vercel ou Cloudflare)

### Supabase Security Checklist

Dans Supabase > **Settings** > **API** :

1. **JWT Expiry** : 3600 seconds (1h)
2. **Enable email confirmations** : ✅ (en production)
3. **Restrict email domains** : Optionnel (ex: @votre-ecole.ci)

## 🔄 Workflow de Développement

### Branches

```
main           → Production (auto-deploy)
develop        → Staging (preview deployment)
feature/*      → Feature branches (preview)
fix/*          → Bug fixes (preview)
```

### Process

1. **Développer** : Créer une branche `feature/xxx`
2. **Tester** : Vercel déploie automatiquement un preview
3. **PR** : Ouvrir une Pull Request vers `develop`
4. **Review** : Tests automatiques via GitHub Actions
5. **Merge** : Fusionner vers `develop` puis `main`
6. **Deploy** : Déploiement automatique en production

## 📊 Monitoring

### Vercel Analytics

Activez **Analytics** dans Vercel pour :
- Web Vitals (performance)
- Real User Monitoring
- Error tracking

### Supabase Logs

Dans Supabase > **Logs** :
- **API Logs** : Requêtes et erreurs
- **Database Logs** : Requêtes lentes
- **Auth Logs** : Tentatives de connexion

## 🚨 Troubleshooting

### Erreur : "CORS policy"

**Solution** : Vérifiez que l'URL de votre app est dans **Supabase** > **Authentication** > **URL Configuration**.

### Erreur : "RLS Policy violation"

**Solution** : Vérifiez que les politiques RLS sont bien appliquées et que l'utilisateur a les bons rôles.

### Erreur : Build Failed

**Solutions** :
1. Vérifiez les variables d'environnement
2. Testez le build localement : `npm run build`
3. Consultez les logs Vercel

### Erreur : "Cannot connect to Supabase"

**Solutions** :
1. Vérifiez que les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont correctes
2. Testez la connexion : `curl https://xxx.supabase.co/rest/v1/`
3. Vérifiez que le projet Supabase est actif

## 🔧 Maintenance

### Sauvegardes Base de Données

Supabase sauvegarde automatiquement, mais vous pouvez :

1. **Export manuel** : Supabase > **Database** > **Backups**
2. **Automatiser** : Script de backup vers S3/Cloud Storage

### Mises à Jour

```bash
# Mettre à jour les dépendances
npm update

# Vérifier les vulnérabilités
npm audit

# Corriger les vulnérabilités
npm audit fix
```

### Monitoring des Erreurs (Recommandé)

Intégrez Sentry pour le tracking d'erreurs :

```bash
npm install @sentry/nextjs
```

Configurez dans `next.config.js` et ajoutez `SENTRY_DSN` aux variables d'environnement.

## 📈 Scaling

### Performance

1. **CDN** : Déjà activé avec Vercel
2. **Image Optimization** : Utiliser `next/image`
3. **ISR** : Implémenter Incremental Static Regeneration pour les pages lentes

### Base de Données

Supabase gratuit supporte :
- 500 MB de stockage
- 2 GB de bande passante

Pour plus, upgrader vers le plan Pro ($25/mois).

## 📞 Support

- **Documentation Vercel** : [vercel.com/docs](https://vercel.com/docs)
- **Documentation Supabase** : [supabase.com/docs](https://supabase.com/docs)
- **Next.js** : [nextjs.org/docs](https://nextjs.org/docs)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2026
