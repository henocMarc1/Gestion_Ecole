# Guide du Directeur d'École - Gestion des Emplois du Temps

## 🎯 Résumé des Fonctionnalités

En tant que Directeur (rôle ADMIN), vous avez accès complet à la gestion de votre école, y compris :

### ✅ Gestion des Emplois du Temps
- **Créer** des créneaux horaires pour chaque classe
- **Assigner** des enseignants aux matières
- **Modifier** les horaires existants
- **Supprimer** des créneaux
- **Visualiser** l'emploi du temps complet de chaque classe

---

## 📋 Accès à l'Emploi du Temps

1. Connectez-vous avec votre compte Directeur
2. Dans le menu de navigation, cliquez sur **"Emploi du temps"**
3. Vous serez redirigé vers `/dashboard/admin/timetable`

---

## 🔧 Création d'un Créneau Horaire

### Étapes :

1. **Sélectionnez une classe** dans le menu déroulant en haut de la page
2. Cliquez sur le bouton **"Ajouter un créneau"**
3. Remplissez le formulaire :
   - **Jour** : Lundi à Vendredi (1-5)
   - **Heure de début** : 08:00 à 18:00
   - **Heure de fin** : 08:00 à 18:00
   - **Matière** : Ex: Mathématiques, Français, Sciences...
   - **Enseignant** : Sélectionnez dans la liste (uniquement les enseignants actifs)
   - **Salle** (optionnel) : Ex: A101, B205
4. Cliquez sur **"Créer"**

### Validations :
- L'heure de fin doit être après l'heure de début
- Un enseignant ne peut pas avoir 2 créneaux en même temps
- Tous les champs obligatoires (*) doivent être remplis

---

## 📊 Visualisation de l'Emploi du Temps

L'emploi du temps est organisé par **jour de la semaine** :

```
┌─────────────────────────────────────────┐
│ 🗓️  LUNDI                               │
├─────────────────────────────────────────┤
│ 08:00 - 09:00  Mathématiques            │
│ Enseignant: M. Dupont | Salle: A101     │
├─────────────────────────────────────────┤
│ 09:00 - 10:00  Français                 │
│ Enseignant: Mme Martin | Salle: A102    │
└─────────────────────────────────────────┘
```

### Informations affichées :
- ⏰ Horaires (début - fin)
- 📚 Matière enseignée
- 👨‍🏫 Nom de l'enseignant
- 🚪 Numéro de salle (si renseigné)
- 🗑️ Bouton de suppression

---

## ✏️ Modification d'un Créneau

Pour l'instant, la modification directe n'est pas disponible. Pour modifier un créneau :

1. **Supprimez** l'ancien créneau
2. **Créez** un nouveau créneau avec les informations mises à jour

---

## 🗑️ Suppression d'un Créneau

1. Localisez le créneau à supprimer
2. Cliquez sur l'icône **poubelle** (🗑️) à droite du créneau
3. Confirmez la suppression dans la boîte de dialogue
4. Le créneau sera supprimé immédiatement

---

## 🔐 Permissions du Directeur

En tant que Directeur, vous avez les permissions suivantes :

### ✅ Vous POUVEZ :
- Créer, modifier et supprimer des emplois du temps
- Gérer toutes les classes de votre école
- Assigner n'importe quel enseignant de votre école
- Consulter tous les emplois du temps
- Gérer les années académiques
- Gérer les élèves et les utilisateurs
- Accéder aux finances et rapports

### ❌ Limitations :
- Vous ne pouvez gérer que votre école (assignée via `school_id`)
- Vous ne pouvez assigner que les enseignants de votre école
- Vous ne pouvez pas modifier les données d'autres écoles

---

## 📅 Structure de la Semaine

Le système utilise une semaine de **5 jours** :

| Numéro | Jour       |
|--------|-----------|
| 1      | Lundi     |
| 2      | Mardi     |
| 3      | Mercredi  |
| 4      | Jeudi     |
| 5      | Vendredi  |

---

## 🔄 Migration Base de Données

### ⚠️ IMPORTANT : Migration à Appliquer

Avant d'utiliser la fonctionnalité d'emploi du temps, vous devez appliquer la migration :

**Fichier:** `supabase/migrations/008_add_timetable_table.sql`

**Étapes :**
1. Allez sur [supabase.co](https://supabase.co)
2. Sélectionnez votre projet
3. **SQL Editor** → **New query**
4. Copiez-collez le contenu de `008_add_timetable_table.sql`
5. Cliquez sur **"Run"** (ou Ctrl+Enter)

**Ce que fait cette migration :**
- ✅ Crée la table `timetable_slots`
- ✅ Ajoute les index de performance
- ✅ Configure les politiques RLS (Row Level Security)
- ✅ Garantit que les directeurs ne peuvent gérer que leur école

---

## 🎨 Exemples d'Utilisation

### Exemple 1 : Créer l'emploi du temps d'une classe CP1

```
Classe : CP1 A

Lundi :
  08:00 - 09:00 | Mathématiques  | M. Dupont    | Salle A101
  09:00 - 10:00 | Français       | Mme Martin   | Salle A102
  10:30 - 11:30 | Sciences       | M. Bernard   | Salle Lab1

Mardi :
  08:00 - 09:00 | Français       | Mme Martin   | Salle A102
  09:00 - 10:00 | Histoire-Géo   | Mme Dubois   | Salle A103
  10:30 - 11:30 | Mathématiques  | M. Dupont    | Salle A101
```

### Exemple 2 : Emploi du temps avec salles spécialisées

```
Classe : CE2 B

Mercredi :
  08:00 - 09:00 | Sport          | M. Koné      | Gymnase
  09:00 - 10:00 | Informatique   | Mme Traoré   | Salle Info
  10:30 - 11:30 | Arts Plastiques| Mme Bamba    | Atelier Arts
```

---

## ❓ FAQ - Foire Aux Questions

### Q1 : Comment savoir si j'ai bien créé un créneau ?
**R :** Un message de succès s'affiche en haut à droite : "Créneau ajouté avec succès". Le créneau apparaît immédiatement dans l'emploi du temps.

### Q2 : Puis-je créer des créneaux pour le week-end ?
**R :** Non, le système ne permet que les jours de semaine (Lundi à Vendredi).

### Q3 : Que se passe-t-il si je supprime un enseignant ?
**R :** Tous les créneaux de cet enseignant seront automatiquement supprimés (CASCADE).

### Q4 : Puis-je assigner le même enseignant à plusieurs classes en même temps ?
**R :** Techniquement oui, mais ce n'est pas recommandé. Une validation future empêchera les conflits d'horaires.

### Q5 : Comment imprimer l'emploi du temps ?
**R :** Utilisez la fonction d'impression de votre navigateur (Ctrl+P ou Cmd+P). Une fonctionnalité d'export PDF sera ajoutée prochainement.

### Q6 : Les enseignants peuvent-ils voir leur emploi du temps ?
**R :** Oui, grâce aux politiques RLS, les enseignants peuvent consulter (mais pas modifier) les emplois du temps.

### Q7 : Comment gérer les récréations et pauses déjeuner ?
**R :** Vous n'avez pas besoin de créer de créneaux pour les pauses. Laissez simplement des trous dans l'emploi du temps (ex: 10:00-10:30 pour la récréation).

---

## 🐛 Dépannage

### Problème : "Aucune classe disponible"
**Solution :** Assurez-vous d'avoir créé des classes via le menu "Classes" avant de créer des emplois du temps.

### Problème : "Aucun enseignant dans la liste"
**Solution :** Vérifiez que vous avez des utilisateurs avec le rôle "TEACHER" et qu'ils sont actifs (`is_active = true`).

### Problème : "Erreur lors de la création du créneau"
**Solutions possibles :**
1. Vérifiez que la migration 008 a été appliquée
2. Vérifiez que l'heure de fin est après l'heure de début
3. Vérifiez que tous les champs obligatoires sont remplis
4. Consultez les logs du navigateur (F12 → Console)

### Problème : "Je ne vois pas le menu Emploi du temps"
**Solution :** Assurez-vous d'être connecté avec un compte Directeur (rôle ADMIN). Les autres rôles n'ont pas accès à cette fonctionnalité en modification.

---

## 📞 Support

Pour toute question ou problème :

1. **Logs du navigateur** : Appuyez sur F12 → Console
2. **Logs Supabase** : Dashboard Supabase → Logs
3. **Documentation Next.js** : https://nextjs.org/docs
4. **Documentation Supabase** : https://supabase.com/docs

---

## 🚀 Améliorations Futures

Fonctionnalités prévues :

- [ ] Modification en ligne des créneaux (sans suppression)
- [ ] Détection des conflits d'horaires enseignants
- [ ] Export PDF de l'emploi du temps
- [ ] Vue calendrier hebdomadaire
- [ ] Duplication d'emploi du temps (copier d'une classe à l'autre)
- [ ] Historique des modifications
- [ ] Notifications aux enseignants lors de changements

---

**Version du guide :** 1.0  
**Dernière mise à jour :** 15 janvier 2026  
**Fichier de migration :** `008_add_timetable_table.sql`
