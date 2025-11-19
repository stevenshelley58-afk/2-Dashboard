# Deploy all Supabase Edge Functions (PowerShell)

Write-Host "Deploying Supabase Edge Functions..." -ForegroundColor Green

# Deploy shops function
Write-Host "Deploying shops function..." -ForegroundColor Yellow
supabase functions deploy shops

# Deploy shop-metrics
Write-Host "Deploying shop-metrics function..." -ForegroundColor Yellow
supabase functions deploy shop-metrics

# Deploy shop-sync-status
Write-Host "Deploying shop-sync-status function..." -ForegroundColor Yellow
supabase functions deploy shop-sync-status

# Deploy shop-sync
Write-Host "Deploying shop-sync function..." -ForegroundColor Yellow
supabase functions deploy shop-sync

# Deploy shop-meta-connect
Write-Host "Deploying shop-meta-connect function..." -ForegroundColor Yellow
supabase functions deploy shop-meta-connect

Write-Host "All Edge Functions deployed successfully!" -ForegroundColor Green

