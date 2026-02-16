# Guide de Design - École Management System

## 🎨 Design System

Ce document décrit le système de design complet et son mapping vers Tailwind CSS.

## Principes de Design

### 1. Sobre et Professionnel
- Design épuré, chaleureux mais corporate
- Espaces généreux pour la lisibilité
- Hiérarchie visuelle claire

### 2. Accessible (WCAG AA)
- Contraste minimum 4.5:1 pour le texte
- Tailles de police ≥ 14px pour le corps
- Focus states visibles
- Navigation au clavier

### 3. Mobile First
- Design responsive dès la conception
- Touch targets ≥ 44x44px
- Navigation adaptée mobile

### 4. Micro-asymétries
- Légères variations pour humaniser
- Pas de grille parfaite partout
- Illustrations SVG "papier découpé"

## 🎨 Palette de Couleurs

### Couleurs Primaires

```css
/* Orange chaleureux - Principal */
primary-50:  #fef6ee
primary-100: #fdecd7
primary-200: #fad5ad
primary-300: #f7b779
primary-400: #f38f43
primary-500: #f0701d  ← Couleur principale
primary-600: #e15513
primary-700: #bb4112
primary-800: #953517
primary-900: #782e16
```

### Couleurs Secondaires

```css
/* Bleu ciel - Secondaire */
secondary-50:  #f0f9ff
secondary-100: #e0f2fe
secondary-200: #bae6fd
secondary-300: #7dd3fc
secondary-400: #38bdf8
secondary-500: #0ea5e9  ← Couleur secondaire
secondary-600: #0284c7
secondary-700: #0369a1
secondary-800: #075985
secondary-900: #0c4a6e
```

### Couleurs d'Accent

```css
/* Violet - Accent */
accent-500: #d946ef
```

### Couleurs Sémantiques

```css
/* Success */
success-500: #22c55e
success-100: #dcfce7  (backgrounds)
success-700: #15803d  (text)

/* Warning */
warning-500: #f59e0b
warning-100: #fef3c7
warning-700: #b45309

/* Danger */
danger-500: #ef4444
danger-100: #fee2e2
danger-700: #b91c1c

/* Info */
info-500: #0ea5e9
info-100: #e0f2fe
info-700: #0369a1
```

### Neutrals

```css
neutral-50:  #fafafa  (backgrounds)
neutral-100: #f5f5f5
neutral-200: #e5e5e5  (borders)
neutral-300: #d4d4d4
neutral-400: #a3a3a3
neutral-500: #737373  (text secondaire)
neutral-600: #525252
neutral-700: #404040  (text principal)
neutral-800: #262626
neutral-900: #171717  (headings)
```

## 📝 Typographie

### Familles de Polices

```css
/* Interface UI */
font-sans: 'Inter', system-ui, -apple-system, sans-serif

/* Accents/Titres */
font-serif: 'Merriweather', Georgia, serif
```

### Échelle Typographique

| Token | Tailwind Class | Size | Line Height | Usage |
|-------|---------------|------|-------------|-------|
| xs | text-xs | 12px | 16px | Labels, captions |
| sm | text-sm | 14px | 20px | Body small, secondary |
| base | text-base | 16px | 24px | Body text |
| lg | text-lg | 18px | 28px | Leads, subtitles |
| xl | text-xl | 20px | 28px | H4 |
| 2xl | text-2xl | 24px | 32px | H3 |
| 3xl | text-3xl | 30px | 36px | H2 |
| 4xl | text-4xl | 36px | 40px | H1 |

### Poids de Police

- Regular : 400 (body text)
- Medium : 500 (emphasis)
- Semibold : 600 (headings)
- Bold : 700 (strong emphasis)

## 📏 Espacements

### Échelle d'Espacement

| Token | Tailwind | Size | Usage |
|-------|----------|------|-------|
| 1 | p-1 | 4px | Micro-spacing |
| 2 | p-2 | 8px | Tight spacing |
| 3 | p-3 | 12px | Small padding |
| 4 | p-4 | 16px | Base padding |
| 6 | p-6 | 24px | Medium padding |
| 8 | p-8 | 32px | Large padding |
| 12 | p-12 | 48px | XL padding |
| 16 | p-16 | 64px | Section spacing |

### Grille & Layout

```css
/* Conteneurs */
max-w-7xl: 1280px  (Dashboard main)
max-w-md:  448px   (Forms, modals)
max-w-4xl: 896px   (Content reading)

/* Gaps */
gap-4: 16px  (Cards grid)
gap-6: 24px  (Sections)
gap-8: 32px  (Major divisions)
```

## 🔲 Composants

### Boutons

#### Variants

```tsx
// Primary
<Button variant="primary">
  className="bg-primary-500 text-white hover:bg-primary-600"
</Button>

// Secondary
<Button variant="secondary">
  className="bg-secondary-500 text-white hover:bg-secondary-600"
</Button>

// Outline
<Button variant="outline">
  className="border-2 border-primary-500 text-primary-600 hover:bg-primary-50"
</Button>

// Ghost
<Button variant="ghost">
  className="text-neutral-700 hover:bg-neutral-100"
</Button>
```

#### Sizes

```tsx
<Button size="sm">   px-3 py-1.5 text-xs
<Button size="md">   px-4 py-2 text-sm   (default)
<Button size="lg">   px-6 py-3 text-base
```

### Inputs

```tsx
<Input className="input-base">
  block w-full rounded-lg border border-neutral-300 
  px-4 py-2 text-sm
  focus:border-primary-500 focus:ring-2 focus:ring-primary-500
</Input>
```

### Cards

```tsx
<Card className="card">
  bg-white rounded-lg shadow-soft border border-neutral-200
</Card>

<Card hover>  // Avec effet hover
  hover:shadow-soft-lg hover:-translate-y-1
</Card>
```

### Badges

```tsx
<Badge variant="success">
  bg-success-100 text-success-700 px-2.5 py-0.5 text-xs rounded-full
</Badge>
```

## 🎯 États Interactifs

### Focus States

```css
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
}
```

### Hover States

```css
/* Boutons */
hover:bg-primary-600

/* Cards */
hover:shadow-soft-lg hover:-translate-y-1

/* Links */
hover:text-primary-600 hover:underline
```

### Transitions

```css
.transition-base {
  @apply transition-all duration-200 ease-in-out;
}
```

## 📐 Breakpoints

### Mobile First

```css
/* Default : Mobile (< 768px) */
px-4 text-sm

/* Tablet (≥ 768px) */
md:px-6 md:text-base

/* Desktop (≥ 1024px) */
lg:px-8 lg:text-lg
```

### Grilles Responsives

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
```

## 🎨 Shadows

```css
/* Soft shadow - Cards */
shadow-soft: 0 2px 15px -3px rgba(0,0,0,0.07)

/* Soft-lg - Hover, modals */
shadow-soft-lg: 0 10px 40px -10px rgba(0,0,0,0.1)
```

## 📱 Icons

Utiliser la bibliothèque `Icons` du projet :

```tsx
import { Icons } from '@/components/ui/Icons';

<Icons.Home className="h-5 w-5" />
<Icons.Student size={24} className="text-primary-500" />
```

### Tailles d'Icônes

- Small: 16px (w-4 h-4)
- Default: 20px (w-5 h-5)
- Medium: 24px (w-6 h-6)
- Large: 32px (w-8 h-8)

## 🎭 Animations

```css
/* Fade in */
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

/* Slide up */
.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}
```

## 🖼️ Illustrations SVG

Utiliser des illustrations simples style "papier découpé" :

- Formes géométriques arrondies
- Palette de couleurs du design system
- Style flat avec ombres légères
- Pas de dégradés complexes

## 📋 Exemples de Layouts

### Dashboard Card

```tsx
<Card className="p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-neutral-600">Total Élèves</p>
      <p className="mt-2 text-3xl font-bold text-neutral-900">245</p>
    </div>
    <div className="p-3 bg-primary-100 rounded-lg">
      <Icons.Student className="h-6 w-6 text-primary-600" />
    </div>
  </div>
</Card>
```

### Form Layout

```tsx
<form className="space-y-6">
  <Input label="Nom complet" required />
  <Input label="Email" type="email" required />
  <div className="flex gap-4">
    <Button variant="ghost">Annuler</Button>
    <Button variant="primary">Enregistrer</Button>
  </div>
</form>
```

## 🎨 Export Figma

### Structure du Fichier Figma

```
📁 École Management - Design System
  ├── 📄 Cover (Présentation)
  ├── 🎨 Design Tokens
  │   ├── Colors
  │   ├── Typography
  │   └── Spacing
  ├── 🧩 Components
  │   ├── Buttons
  │   ├── Inputs
  │   ├── Cards
  │   ├── Badges
  │   └── Icons
  ├── 📱 Templates
  │   ├── Login
  │   ├── Dashboard Teacher
  │   ├── Dashboard Parent
  │   └── Student List
  └── 🔗 Prototype
      └── Interactive Flows
```

### Conventions de Nommage Figma

```
Composant/Variant/State

Exemples:
- Button/Primary/Default
- Button/Primary/Hover
- Button/Primary/Disabled
- Input/Text/Default
- Input/Text/Error
- Card/Default/Normal
- Card/Default/Hover
```

### Auto-Layout Configuration

- **Padding** : Utiliser les tokens (8, 16, 24px)
- **Gap** : 4, 8, 12, 16, 24px
- **Alignment** : Top-left par défaut
- **Resizing** : Hug/Fill selon le cas

### Exports Figma → Code

1. Sélectionner le frame
2. Exporter en SVG pour les icônes
3. Copier les styles CSS depuis l'inspecteur
4. Mapper vers les classes Tailwind

---

## 📦 Livrables Design

- [ ] Fichier Figma avec Design System complet
- [ ] Composants avec tous les variants
- [ ] 3 breakpoints (375/768/1024)
- [ ] Prototype cliquable des flows principaux
- [ ] Documentation des tokens (ce fichier)
- [ ] Exports SVG des icônes
- [ ] Guide d'utilisation pour les développeurs

---

**Version Design** : 1.0.0  
**Compatible avec** : Tailwind CSS 3.4+
