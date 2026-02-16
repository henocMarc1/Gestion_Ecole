# Guide de démarrage rapide - École Management

## 🚀 Première utilisation

### Étape 1 : Créer le compte Super Admin

1. Ouvrez l'application dans votre navigateur
2. Cliquez sur **"Créer un compte"** sur la page d'accueil
3. Remplissez le formulaire :
   - Nom complet
   - Email (sera votre identifiant)
   - Mot de passe (minimum 8 caractères)
4. Cliquez sur **"Créer mon compte SuperAdmin"**
5. Une fois créé, vous serez redirigé vers la page de connexion

### Étape 2 : Se connecter

1. Utilisez l'email et le mot de passe que vous venez de créer
2. Vous serez automatiquement redirigé vers le tableau de bord Super Admin

### Étape 3 : Créer votre école

⚠️ **Important** : Créez d'abord votre école avant de créer les autres utilisateurs !

1. Sur le dashboard Super Admin, cliquez sur **"Gérer les écoles"**
2. Cliquez sur **"Nouvelle école"**
3. Remplissez les informations :
   - **Nom de l'école** * (obligatoire)
   - **Code unique** * (ex: EPM-001, lettres majuscules et chiffres uniquement)
   - Email de contact (optionnel)
   - Téléphone (optionnel)
   - Adresse (optionnel)
4. Cliquez sur **"Créer l'école"**

### Étape 4 : Créer les utilisateurs essentiels

Retournez au tableau de bord Super Admin et créez les comptes suivants dans cet ordre :

#### 1. Directeur d'École (ADMIN)
- Gère l'école, les utilisateurs et les rapports
- **Important** : Associez-le à l'école que vous venez de créer

#### 2. Comptable (ACCOUNTANT)
- Gère les finances, factures et paiements
- Mot de passe par défaut : `Test123456!`

#### 3. Secrétaire (SECRETARY)
- Gère les inscriptions, élèves et documentation
- Mot de passe par défaut : `Test123456!`

#### 4. Enseignant(e)s (TEACHER)
- Marquent les présences et gèrent leurs classes
- Créez au moins 1-2 enseignants pour commencer
- Mot de passe par défaut : `Test123456!`

#### 5. Parents (PARENT)
- Consultent les factures et la scolarité de leurs enfants
- Vous pouvez en créer quelques-uns pour les tests
- Mot de passe par défaut : `Test123456!`

### Étape 5 : Configuration de l'école (Directeur)

Une fois le compte Directeur créé :

1. Déconnectez-vous du compte Super Admin
2. Connectez-vous avec le compte Directeur
3. Créez l'année scolaire en cours
4. Créez les classes (CP1, CP2, CE1, CE2, CM1, CM2, etc.)
5. Assignez les enseignants aux classes
6. Créez les élèves
7. Liez les parents aux élèves
8. Configurez les frais de scolarité

## 📋 Ordre recommandé de création des données

```
1. Super Admin (compte initial)
   ↓
2. École(s)
   ↓
3. Utilisateurs (Directeur, Comptable, Secrétaire, Enseignants, Parents)
   ↓
4. Année scolaire
   ↓
5. Classes
   ↓
6. Affectation Enseignants → Classes
   ↓
7. Élèves
   ↓
8. Liens Parents → Élèves
   ↓
9. Frais de scolarité
   ↓
10. Factures et paiements
```

## 🔐 Sécurité

- **Mot de passe par défaut** : `Test123456!`
- ⚠️ Demandez aux utilisateurs de changer leur mot de passe lors de la première connexion
- Le Super Admin n'est pas lié à une école spécifique (school_id = NULL)
- Tous les autres utilisateurs DOIVENT être associés à une école

## 🎯 Accès rapides

- **Page d'accueil** : `/`
- **Connexion** : `/login`
- **Inscription Super Admin** : `/signup`
- **Dashboard Super Admin** : `/dashboard/super-admin`
- **Gestion des écoles** : `/dashboard/super-admin/schools`
- **Dashboard Directeur** : `/dashboard/admin`
- **Dashboard Comptable** : `/dashboard/accountant`
- **Dashboard Secrétaire** : `/dashboard/secretary`
- **Dashboard Enseignant** : `/dashboard/teacher`
- **Dashboard Parent** : `/dashboard/parent`

## 🆘 Problèmes courants

### "Erreur lors de la création de l'utilisateur"
- Vérifiez que l'email n'est pas déjà utilisé
- Vérifiez que vous avez créé une école avant de créer les utilisateurs (sauf Super Admin)

### "RLS policy violation"
- Assurez-vous d'avoir appliqué les migrations Supabase
- Vérifiez que les politiques RLS sont activées

### "Cannot read properties of null (school_id)"
- Créez d'abord une école avant de créer des utilisateurs autres que Super Admin
- Le Super Admin est le seul compte sans school_id

## 📞 Support

Pour toute question ou problème, consultez la documentation technique dans `/docs`
