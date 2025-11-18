import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  // First, try to get DB connection string from environment
  let connectionString = process.env.SUPABASE_DB_URL
  
  if (!connectionString) {
    // Build from components
    const url = process.env.SUPABASE_URL
    const projectRef = url?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]
    
    if (!projectRef) {
      console.error('❌ Need either SUPABASE_DB_URL or valid SUPABASE_URL')
      console.error('Get your database password from: https://supabase.com/dashboard/project/' + projectRef + '/settings/database')
      console.error('Then set: SUPABASE_DB_URL=postgresql://postgres.[PASSWORD]@db.[PROJECT].supabase.com:5432/postgres')
      process.exit(1)
    }
    
    console.log(`\n📝 To apply migrations, get your database password from:`)
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/settings/database`)
    console.log(`\nThen run:`)
    console.log(`   $env:SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.${projectRef}.supabase.com:5432/postgres"`)
    console.log(`   npx tsx src/scripts/bootstrap-and-migrate.ts`)
    process.exit(1)
  }

  console.log('🔌 Connecting to database...')
  const pool = new Pool({ connectionString })

  try {
    await pool.query('SELECT 1')
    console.log('✓ Connected\n')

    const migrations = [
      '20251111123000_expand_shopify_ingestion.sql',
      '20251112090000_add_scheduler_functions.sql',
      '20251112101500_meta_comprehensive_schema_reapply.sql',
      '20251112103000_meta_transformation_rpcs_reapply.sql',
      '20251112104000_meta_transform_breakdowns.sql',
    ]

    for (const migration of migrations) {
      const filePath = resolve(__dirname, '../../../supabase/migrations', migration)
      const sql = readFileSync(filePath, 'utf8')
      
      console.log(`📝 Applying ${migration}...`)
      
      try {
        await pool.query(sql)
        console.log(`✓ Applied ${migration}\n`)
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Already exists, skipping\n`)
        } else {
          throw error
        }
      }
    }

    console.log('✅ All migrations applied!')
    console.log('\nℹ️  Run `pnpm --filter @dashboard/worker exec tsx src/scripts/run-historical-sync.ts` to backfill data.')
  } catch (error: any) {
    console.error('❌ Failed:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()




