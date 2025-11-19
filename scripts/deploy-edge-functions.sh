#!/bin/bash
# Deploy all Supabase Edge Functions

set -e

echo "Deploying Supabase Edge Functions..."

# Deploy shops function
echo "Deploying shops function..."
supabase functions deploy shops

# Deploy shop-metrics
echo "Deploying shop-metrics function..."
supabase functions deploy shop-metrics

# Deploy shop-sync-status
echo "Deploying shop-sync-status function..."
supabase functions deploy shop-sync-status

# Deploy shop-sync
echo "Deploying shop-sync function..."
supabase functions deploy shop-sync

# Deploy shop-meta-connect
echo "Deploying shop-meta-connect function..."
supabase functions deploy shop-meta-connect

echo "All Edge Functions deployed successfully!"

