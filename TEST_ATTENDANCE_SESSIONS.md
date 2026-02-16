# Test Manuel : Appels Matin/Après-midi

## 1️⃣ Préparer la base de données

### Étape 1 : Appliquer la migration SQL
1. Allez sur [Supabase Dashboard](https://dashboard.supabase.io) → Votre Projet
2. Ouvrez **SQL Editor** (gauche: "SQL Editor")
3. Créez une nouvelle requête
4. Copiez le contenu de `DEPLOYMENT_ATTENDANCE_SESSIONS.sql`
5. Exécutez (Ctrl+Enter ou Cmd+Enter)

**Résultat attendu :** ✅ "Success" (pas d'erreur)

---

## 2️⃣ Récupérer les IDs de test

Dans SQL Editor, exécutez :

```sql
-- Voir une classe
SELECT id, name FROM classes WHERE school_id IS NOT NULL LIMIT 1;

-- Voir les élèves de cette classe
SELECT id, first_name, last_name, class_id 
FROM students 
WHERE class_id = 'PASTE-CLASS-ID-HERE' 
LIMIT 3;

-- Voir votre school_id
SELECT DISTINCT school_id FROM users WHERE id = auth.uid();
```

Notez les valeurs :
- `class_id` : ___________________
- `student_id` (un élève) : ___________________
- `school_id` : ___________________

---

## 3️⃣ Tester via l'application

### Scénario : Un élève absent le matin, présent l'après-midi

#### Chez l'**Enseignant** :
1. Connectez-vous en tant qu'enseignant
2. Allez à **Tableau de bord > Marquage de présence**
3. Sélectionnez :
   - **Classe** : (votre classe de test)
   - **Date** : 18 janvier 2026 (ou aujourd'hui)
   - **Séance** : **Matin** ← Important !
4. Marquez un élève en **ABSENT** (cliquez sur le bouton pour basculer à "Absent")
5. Cliquez **Sauvegarder**
6. Changez à **Séance : Après-midi**
7. Marquez le **même élève en PRÉSENT**
8. Cliquez **Sauvegarder**

#### Chez le **Parent** :
1. Déconnectez-vous, connectez-vous en tant que parent
2. Allez à **Tableau de bord > Présences et absences**
3. Sélectionnez l'enfant
4. Naviguez au mois courant (janvier 2026)
5. **Regardez le 18 janvier :**
   - La case doit être **ROUGE** (absence matin)
   - Passez la souris dessus → Tooltip : **"Matin: Absent | Après-midi: Présent"**

---

## 4️⃣ Cas de test supplémentaires

### Cas A : Présent toute la journée
- Matin : Présent
- Après-midi : Présent
- **Résultat** : Case **VERTE**, Tooltip: "Matin: Présent | Après-midi: Présent"

### Cas B : Absent toute la journée
- Matin : Absent
- Après-midi : Absent
- **Résultat** : Case **ROUGE**, Tooltip: "Matin: Absent | Après-midi: Absent"

### Cas C : Données anciennes (avant migration)
- Si un enregistrement existant n'a pas `session` → par défaut **MORNING**
- Il doit encore apparaître dans le calendrier parent

---

## 5️⃣ Dépannage

### ❌ "Erreur lors de la sauvegarde" chez l'enseignant
- Vérifiez que la migration SQL a été appliquée sans erreur
- Vérifiez la console browser (F12 > Console) pour le message d'erreur exact
- Essayez de rafraîchir (F5)

### ❌ Les absences n'apparaissent pas chez le parent
- Vérifiez que vous avez sauvegardé l'appel (toast vert "Présence sauvegardée")
- Rafraîchissez la page parent (F5)
- Vérifiez que le date/mois sélectionné inclut le 18 janvier
- Ouvrez la console (F12 > Network) et cherchez une erreur sur `/attendance`

### ❌ Tooltip vide ou mal formaté
- C'est un affichage cosmétique — l'important est la couleur (rouge = absent, vert = présent)
- Rechargez la page si le tooltip ne s'affiche pas

---

## ✅ Succès
Une fois les tests passés :
- ✅ L'enseignant peut marquer matin/après-midi indépendamment
- ✅ Les absences matin/après-midi apparaissent chez le parent
- ✅ Le calendrier affiche les absences en rouge
- ✅ Le tooltip détaille les deux séances

**Aucune action supplémentaire requise.** Le système est prêt ! 🎉
