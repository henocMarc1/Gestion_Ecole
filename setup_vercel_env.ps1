# Script to add environment variables to Vercel
$env:NODE_OPTIONS = ""

# Add NEXT_PUBLIC_SUPABASE_URL
Write-Host "Adding NEXT_PUBLIC_SUPABASE_URL..."
$url = "https://eukkzsbmsyxgklzzhiej.supabase.co"
$null = (echo $url | vercel env add NEXT_PUBLIC_SUPABASE_URL production 2>&1)

# Add NEXT_PUBLIC_SUPABASE_ANON_KEY
Write-Host "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a2t6c2Jtc3l4Z2tzenpoaWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwOTksImV4cCI6MjA4NDAxMzA5OX0.8Uw3bToIk4w7zstUEQglPGxzBSdmFRmLS_2dnQTavC8"
$null = (echo $anonKey | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production 2>&1)

# Add SUPABASE_SERVICE_ROLE_KEY  
Write-Host "Adding SUPABASE_SERVICE_ROLE_KEY..."
$serviceRole = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a2t6c2Jtc3l4Z2tzenpoaWVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA5OSwiZXhwIjoyMDg0MDEzMDk5fQ.lP5JgbszlSDrdgMd1GWFV2JX6bCxGcjsnrRMz2t_PdM"
$null = (echo $serviceRole | vercel env add SUPABASE_SERVICE_ROLE_KEY production 2>&1)

Write-Host "Done!"
vercel env ls
