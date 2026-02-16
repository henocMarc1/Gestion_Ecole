#!/usr/bin/env node

/**
 * PDF Service Installation & Configuration Checker
 * Vérifies that all PDF generation dependencies and files are properly configured
 */

const fs = require('fs')
const path = require('path')

const checks = []
const errors = []

console.log('\n📋 VÉRIFICATION DE L\'INSTALLATION PDF SERVICE\n')
console.log('=' .repeat(60))

// Check 1: PDFKit installation
console.log('\n1️⃣  Vérification PDFKit...')
try {
  const pdfkit = require('pdfkit')
  const pkgPath = path.join(process.cwd(), 'node_modules/pdfkit/package.json')
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  checks.push({
    name: 'PDFKit Module',
    status: '✓',
    version: pkgData.version,
    details: 'Installed successfully'
  })
  console.log(`   ✓ pdfkit@${pkgData.version} loaded`)
} catch (error) {
  errors.push(`PDFKit not found: ${error.message}`)
  checks.push({
    name: 'PDFKit Module',
    status: '✗',
    version: 'N/A',
    details: error.message
  })
  console.log(`   ✗ PDFKit failed: ${error.message}`)
}

// Check 2: TypeScript types
console.log('\n2️⃣  Vérification Types TypeScript...')
try {
  const typesPath = path.join(process.cwd(), 'node_modules/@types/pdfkit/package.json')
  if (fs.existsSync(typesPath)) {
    const pkgData = JSON.parse(fs.readFileSync(typesPath, 'utf8'))
    checks.push({
      name: '@types/pdfkit',
      status: '✓',
      version: pkgData.version,
      details: 'Installed successfully'
    })
    console.log(`   ✓ @types/pdfkit@${pkgData.version} found`)
  } else {
    throw new Error('Package.json not found')
  }
} catch (error) {
  errors.push(`@types/pdfkit not found: ${error.message}`)
  checks.push({
    name: '@types/pdfkit',
    status: '✗',
    version: 'N/A',
    details: error.message
  })
  console.log(`   ✗ @types/pdfkit failed: ${error.message}`)
}

// Check 3: Service PDF file
console.log('\n3️⃣  Vérification Service PDF...')
const serviceFile = path.join(process.cwd(), 'src/lib/services/pdf.ts')
if (fs.existsSync(serviceFile)) {
  const stats = fs.statSync(serviceFile)
  checks.push({
    name: 'PDF Service File',
    status: '✓',
    path: 'src/lib/services/pdf.ts',
    size: `${(stats.size / 1024).toFixed(2)} KB`
  })
  console.log(`   ✓ src/lib/services/pdf.ts exists (${(stats.size / 1024).toFixed(2)} KB)`)
} else {
  errors.push('PDF service file not found')
  checks.push({
    name: 'PDF Service File',
    status: '✗',
    path: 'src/lib/services/pdf.ts',
    details: 'File not found'
  })
  console.log(`   ✗ src/lib/services/pdf.ts not found`)
}

// Check 4: API Routes
console.log('\n4️⃣  Vérification API Routes...')
const routes = [
  { name: 'Bulletin', path: 'src/app/api/pdf/bulletin/route.ts' },
  { name: 'Certificate', path: 'src/app/api/pdf/certificate/route.ts' },
  { name: 'Invoice', path: 'src/app/api/pdf/invoice/route.ts' }
]

routes.forEach((route) => {
  const fullPath = path.join(process.cwd(), route.path)
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath)
    console.log(`   ✓ ${route.name}: ${route.path}`)
    checks.push({
      name: `API Route: ${route.name}`,
      status: '✓',
      path: route.path,
      size: `${(stats.size / 1024).toFixed(2)} KB`
    })
  } else {
    console.log(`   ✗ ${route.name}: ${route.path} NOT FOUND`)
    errors.push(`API Route ${route.name} not found at ${route.path}`)
    checks.push({
      name: `API Route: ${route.name}`,
      status: '✗',
      path: route.path,
      details: 'File not found'
    })
  }
})

// Check 5: Admin Page
console.log('\n5️⃣  Vérification Page Admin...')
const adminPage = path.join(process.cwd(), 'src/app/dashboard/admin/documents/page.tsx')
if (fs.existsSync(adminPage)) {
  const stats = fs.statSync(adminPage)
  checks.push({
    name: 'Admin Documents Page',
    status: '✓',
    path: 'src/app/dashboard/admin/documents/page.tsx',
    size: `${(stats.size / 1024).toFixed(2)} KB`
  })
  console.log(`   ✓ Admin page exists (${(stats.size / 1024).toFixed(2)} KB)`)
} else {
  errors.push('Admin documents page not found')
  checks.push({
    name: 'Admin Documents Page',
    status: '✗',
    path: 'src/app/dashboard/admin/documents/page.tsx',
    details: 'File not found'
  })
  console.log(`   ✗ Admin page not found`)
}

// Check 6: package.json
console.log('\n6️⃣  Vérification package.json...')
const pkgJsonPath = path.join(process.cwd(), 'package.json')
try {
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
  const hasPdfkit = 'pdfkit' in pkgJson.dependencies
  const hasTypes = '@types/pdfkit' in pkgJson.devDependencies

  if (hasPdfkit && hasTypes) {
    console.log(`   ✓ pdfkit@${pkgJson.dependencies.pdfkit}`)
    console.log(`   ✓ @types/pdfkit@${pkgJson.devDependencies['@types/pdfkit']}`)
    checks.push({
      name: 'package.json dependencies',
      status: '✓',
      pdfkit: pkgJson.dependencies.pdfkit,
      typesPdfkit: pkgJson.devDependencies['@types/pdfkit']
    })
  } else {
    throw new Error(`Missing: ${!hasPdfkit ? 'pdfkit' : ''} ${!hasTypes ? '@types/pdfkit' : ''}`)
  }
} catch (error) {
  errors.push(`package.json error: ${error.message}`)
  checks.push({
    name: 'package.json dependencies',
    status: '✗',
    details: error.message
  })
  console.log(`   ✗ package.json error: ${error.message}`)
}

// Summary
console.log('\n' + '='.repeat(60))
console.log('\n📊 RÉSUMÉ')
console.log('=' .repeat(60))

const successCount = checks.filter((c) => c.status === '✓').length
const failCount = checks.filter((c) => c.status === '✗').length

console.log(`\n✓ Réussis: ${successCount}/${checks.length}`)
if (failCount > 0) {
  console.log(`✗ Échoués: ${failCount}/${checks.length}`)
}

if (errors.length > 0) {
  console.log('\n⚠️  ERREURS DÉTECTÉES:')
  errors.forEach((error, idx) => {
    console.log(`   ${idx + 1}. ${error}`)
  })
}

console.log('\n' + '='.repeat(60))

if (errors.length === 0) {
  console.log('\n✅ TOUT EST PRÊT POUR GÉNÉRER DES PDFs!\n')
  process.exit(0)
} else {
  console.log('\n❌ CONFIGURATION INCOMPLÈTE - VEUILLEZ CORRIGER LES ERREURS\n')
  console.log('Pour installer les dépendances manquantes:')
  console.log('  npm install pdfkit @types/pdfkit\n')
  process.exit(1)
}
