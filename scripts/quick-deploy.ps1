# Quick deployment script for PowerShell

Write-Host "🚀 Starting deployment process..." -ForegroundColor Green
Write-Host ""

# Step 1: Build packages
Write-Host "📦 Building packages..." -ForegroundColor Yellow
pnpm build

# Step 2: Deploy Edge Functions
Write-Host ""
Write-Host "🔧 Deploying Edge Functions..." -ForegroundColor Yellow
supabase functions deploy shops
supabase functions deploy shop-metrics
supabase functions deploy shop-sync-status
supabase functions deploy shop-sync
supabase functions deploy shop-meta-connect

Write-Host ""
Write-Host "✅ Edge Functions deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Deploy worker: cd apps/worker; railway up" -ForegroundColor White
Write-Host "   2. Deploy frontend: cd apps/web; vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green

