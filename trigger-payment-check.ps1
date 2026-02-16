# Script PowerShell pour Windows Task Scheduler
# Fichier: trigger-payment-check.ps1

$supabaseUrl = "https://eukkzsbmsyxgklzzhiej.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a2t6c2Jtc3l4Z2tsenpoaWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwOTksImV4cCI6MjA4NDAxMzA5OX0.8Uw3bToIk4w7zstUEQglPGxzBSdmFRmLS_2dnQTavC8"

$logFile = "C:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE\payment-check.log"

try {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] Starting payment check..."
    
    $headers = @{
        Authorization = "Bearer $supabaseKey"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "$supabaseUrl/functions/v1/daily-payment-check" `
        -Headers $headers `
        -Body "{}"
    
    Add-Content -Path $logFile -Value "[$timestamp] SUCCESS: $($response | ConvertTo-Json -Compress)"
    
} catch {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] ERROR: $($_.Exception.Message)"
}
