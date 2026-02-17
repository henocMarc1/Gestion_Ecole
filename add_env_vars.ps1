# Script pour ajouter les variables d'environnement à Vercel
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a2t6c2Jtc3l4Z2tzenpoaWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwOTksImV4cCI6MjA4NDAxMzA5OX0.8Uw3bToIk4w7zstUEQglPGxzBSdmFRmLS_2dnQTavC8"

Write-Host "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
Write-Output $anonKey | vercel env add "NEXT_PUBLIC_SUPABASE_ANON_KEY" "production"

Write-Host "Done!"
