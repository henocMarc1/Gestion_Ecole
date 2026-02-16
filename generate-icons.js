#!/usr/bin/env node

/**
 * Script pour générer les icônes PWA
 * Crée des SVG simples pour les différentes tailles
 */

const fs = require('fs');
const path = require('path');

// Créer le dossier s'il n'existe pas
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG simple avec le logo de l'école (orange et blanc)
const createSVG = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#f0701d"/>
  
  <!-- Building/School icon -->
  <g transform="translate(${size * 0.2}, ${size * 0.15}) scale(${size / 100})">
    <!-- Main building -->
    <rect x="10" y="20" width="80" height="70" fill="white" stroke="none"/>
    
    <!-- Roof -->
    <polygon points="10,20 50,0 90,20" fill="white"/>
    
    <!-- Door -->
    <rect x="40" y="60" width="20" height="30" fill="#f0701d"/>
    <circle cx="58" cy="75" r="2" fill="white"/>
    
    <!-- Windows -->
    <rect x="15" y="25" width="15" height="15" fill="#f0701d"/>
    <rect x="35" y="25" width="15" height="15" fill="#f0701d"/>
    <rect x="55" y="25" width="15" height="15" fill="#f0701d"/>
    <rect x="75" y="25" width="10" height="15" fill="#f0701d"/>
    
    <rect x="15" y="45" width="15" height="15" fill="#f0701d"/>
    <rect x="35" y="45" width="15" height="15" fill="#f0701d"/>
    <rect x="75" y="45" width="10" height="15" fill="#f0701d"/>
  </g>
  
  <!-- Decorative circle -->
  <circle cx="${size * 0.85}" cy="${size * 0.15}" r="${size * 0.08}" fill="white" opacity="0.3"/>
</svg>`;
};

// Tailles d'icônes à générer
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Générer les icônes SVG
sizes.forEach(size => {
  const fileName = `icon-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, fileName);
  const svg = createSVG(size);
  
  fs.writeFileSync(filePath, svg, 'utf8');
  console.log(`✓ Créé: ${fileName}`);
});

// Créer aussi des versions PNG basiques (en base64 pour tester)
// Pour une production real, utiliser sharp ou ImageMagick
const createPNG = (size) => {
  // Créer une image PNG simple avec canvas
  // Pour maintenant, créer une version texte de base
  const canvas = Buffer.alloc(size * size * 4);
  
  // Remplir avec la couleur orange (#f0701d)
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = 240;     // R
    canvas[i + 1] = 112; // G
    canvas[i + 2] = 29;  // B
    canvas[i + 3] = 255; // A
  }
  
  return canvas;
};

console.log('✓ Icônes PWA générées avec succès!');
console.log('  Note: Pour les fichiers PNG finals, utilisez:');
console.log('  npm install -g sharp');
console.log('  node generate-icons.js (avec support sharp)');
