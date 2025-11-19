#!/bin/bash
# Quick deployment script - runs all deployment steps

set -e

echo "🚀 Starting deployment process..."
echo ""

# Step 1: Build packages
echo "📦 Building packages..."
pnpm build

# Step 2: Deploy Edge Functions
echo ""
echo "🔧 Deploying Edge Functions..."
supabase functions deploy shops
supabase functions deploy shop-metrics
supabase functions deploy shop-sync-status
supabase functions deploy shop-sync
supabase functions deploy shop-meta-connect

echo ""
echo "✅ Edge Functions deployed!"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy worker: cd apps/worker && railway up"
echo "   2. Deploy frontend: cd apps/web && vercel --prod"
echo ""
echo "🎉 Deployment complete!"

