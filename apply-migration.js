#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://yxbthgncjpimkslputso.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2NjQ2NiwiZXhwIjoyMDc3ODQyNDY2fQ.MIsSGYSL8lQlZwUNXM57WxVCnQe8XiWdXGXINndZTLI';

console.log('🚀 Applying Expanded Shopify Data Migration');
console.log('===========================================\n');

// Read migration file
const migration = fs.readFileSync('supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql', 'utf8');

// Split into individual function creations
const statements = migration
  .split(/;\s*\n/)
  .filter(stmt => stmt.trim().length > 0)
  .map(stmt => stmt.trim() + ';');

console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'yxbthgncjpimkslputso.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          resolve({ success: false, statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
}

async function applyMigration() {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const funcName = stmt.match(/CREATE OR REPLACE FUNCTION (\w+)/)?.[1] || `Statement ${i + 1}`;
    
    process.stdout.write(`  [${i + 1}/${statements.length}] ${funcName}... `);
    
    try {
      const result = await executeSQL(stmt);
      if (result.success) {
        console.log('✅');
        successCount++;
      } else {
        console.log(`❌ (HTTP ${result.statusCode})`);
        console.log(`      ${result.body}`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Results: ${successCount} succeeded, ${failCount} failed\n`);
  
  if (failCount === 0) {
    console.log('✅ Migration applied successfully!\n');
    return true;
  } else {
    console.log('⚠️  Some statements failed. Trying alternative approach...\n');
    return false;
  }
}

applyMigration().then(success => {
  if (!success) {
    console.log('Please apply the migration manually in Supabase Dashboard:');
    console.log('  1. Go to: https://supabase.com/dashboard/project/yxbthgncjpimkslputso/sql');
    console.log('  2. Copy contents of: supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql');
    console.log('  3. Paste and click "Run"\n');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
