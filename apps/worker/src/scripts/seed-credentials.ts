import 'dotenv/config'
import { supabase } from '../lib/supabase'

async function seedCredentials() {
  const shopId = process.env.SHOP_ID
  if (!shopId) {
    throw new Error('SHOP_ID env var required')
  }

  // Shopify credentials
  const shopifyToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  const shopifyDomain = process.env.SHOPIFY_SHOP_DOMAIN

  if (shopifyToken && shopifyDomain) {
    const { error } = await supabase.schema('core_warehouse').from('shop_credentials').upsert(
      {
        shop_id: shopId,
        platform: 'SHOPIFY',
        access_token: shopifyToken,
        metadata: {
          shopify_domain: shopifyDomain,
        },
      },
      {
        onConflict: 'shop_id,platform',
      }
    )

    if (error) {
      console.error('Error seeding Shopify credentials:', error)
    } else {
      console.log('Shopify credentials seeded')
    }
  }

  // Meta credentials
  const metaToken = process.env.META_ACCESS_TOKEN
  const metaAdAccountId = process.env.META_AD_ACCOUNT_ID

  if (metaToken && metaAdAccountId) {
    const { error } = await supabase.schema('core_warehouse').from('shop_credentials').upsert(
      {
        shop_id: shopId,
        platform: 'META',
        access_token: metaToken,
        metadata: {
          ad_account_id: metaAdAccountId,
        },
      },
      {
        onConflict: 'shop_id,platform',
      }
    )

    if (error) {
      console.error('Error seeding Meta credentials:', error)
    } else {
      console.log('Meta credentials seeded')
    }
  }
}

seedCredentials()
  .then(() => {
    console.log('Seed complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
