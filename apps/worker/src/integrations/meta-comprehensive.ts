/**
 * META ADS COMPREHENSIVE ETL CLIENT
 *
 * Fetches ALL metadata from Meta Marketing API:
 * - Ad Accounts, Campaigns, AdSets, Ads, Creatives
 * - Images and Videos (downloads assets)
 * - Insights at all levels (campaign, adset, ad)
 * - Breakdown insights (age/gender, device, geo)
 * - Multiple attribution windows
 */

import { JobType } from '@dashboard/config'
import { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createStorageClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

interface MetaConfig {
  accessToken: string
  adAccountId: string
  apiVersion: string
}

type EntityType = 'account' | 'campaign' | 'adset' | 'ad' | 'creative' | 'image' | 'video'
type InsightLevel = 'account' | 'campaign' | 'adset' | 'ad'
type BreakdownType = 'age_gender' | 'device' | 'geo' | null

interface MetaAPIResponse<T> {
  data: T[]
  paging?: {
    cursors?: {
      before: string
      after: string
    }
    next?: string
  }
  error?: {
    message: string
    type: string
    code: number
  }
}

// Meta API Field Configurations
const ENTITY_FIELDS = {
  account: [
    'id', 'account_id', 'name', 'currency', 'timezone_name',
    'business_name', 'business', 'account_status', 'disable_reason',
    'amount_spent', 'balance', 'created_time',
    'min_campaign_group_spend_cap', 'min_daily_budget'
  ].join(','),

  campaign: [
    'id', 'name', 'status', 'objective', 'buying_type', 'bid_strategy',
    'budget_remaining', 'daily_budget', 'lifetime_budget', 'spend_cap',
    'special_ad_categories', 'start_time', 'stop_time',
    'created_time', 'updated_time', 'account_id'
  ].join(','),

  adset: [
    'id', 'name', 'status', 'campaign_id', 'account_id',
    'optimization_goal', 'billing_event', 'bid_amount', 'bid_strategy',
    'daily_budget', 'lifetime_budget', 'budget_remaining',
    'start_time', 'end_time', 'created_time', 'updated_time',
    'targeting', 'destination_type', 'promoted_object', 'attribution_spec'
  ].join(','),

  ad: [
    'id', 'name', 'status', 'adset_id', 'campaign_id', 'account_id',
    'creative{id}', 'tracking_specs', 'conversion_specs',
    'created_time', 'updated_time'
  ].join(','),

  creative: [
    'id', 'name', 'title', 'body', 'link_url', 'call_to_action_type',
    'image_hash', 'image_url', 'video_id', 'thumbnail_url',
    'object_type', 'object_story_spec', 'asset_feed_spec',
    'product_set_id', 'effective_object_story_id',
    'instagram_actor_id', 'instagram_permalink_url', 'status'
  ].join(','),

  image: [
    'id', 'hash', 'url', 'permalink_url', 'width', 'height'
  ].join(','),

  video: [
    'id', 'title', 'description', 'source', 'permalink_url',
    'length', 'picture', 'format', 'updated_time', 'created_time'
  ].join(','),
}

const INSIGHTS_FIELDS = [
  // Date
  'date_start', 'date_stop',

  // Core metrics
  'spend', 'impressions', 'clicks', 'reach', 'frequency',

  // Cost metrics
  'cpm', 'cpc', 'ctr', 'cpp',

  // Conversion actions
  'actions', 'action_values',

  // Engagement
  'post_engagement', 'post_reactions_by_type_total',

  // Video metrics
  'video_30_sec_watched_actions', 'video_p25_watched_actions',
  'video_p50_watched_actions', 'video_p75_watched_actions',
  'video_p100_watched_actions', 'video_avg_time_watched_actions',

  // Link clicks
  'outbound_clicks', 'outbound_clicks_ctr',

  // Cost per action
  'cost_per_action_type', 'cost_per_unique_action_type',

  // Unique metrics
  'unique_clicks', 'unique_ctr', 'unique_link_clicks_ctr',

  // Attribution
  'purchase_roas'
].join(',')

export class MetaComprehensiveClient {
  private config: MetaConfig
  private supabase: SupabaseClient
  private baseUrl: string
  private tempDir: string

  constructor(config: MetaConfig, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}`
    this.tempDir = path.join(os.tmpdir(), 'meta-assets')

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * Main sync orchestrator - fetches all entities and insights
   */
  async sync(shopId: string, jobType: JobType): Promise<{
    entities: number
    insights: number
    assets: number
  }> {
    console.log(`[Meta Comprehensive] Starting ${jobType} sync for shop ${shopId}`)

    const stats = {
      entities: 0,
      insights: 0,
      assets: 0
    }

    try {
      // Step 1: Fetch entity hierarchy (account → campaigns → adsets → ads → creatives)
      console.log('[Meta] Step 1: Fetching entity hierarchy...')
      stats.entities = await this.syncEntities(shopId, jobType)

      // Step 2: Fetch insights at all levels
      console.log('[Meta] Step 2: Fetching insights...')
      stats.insights = await this.syncInsights(shopId, jobType)

      // Step 3: Download creative assets (images & videos)
      console.log('[Meta] Step 3: Downloading creative assets...')
      stats.assets = await this.downloadAssets(shopId)

      console.log('[Meta Comprehensive] Sync complete:', stats)
      return stats

    } catch (error) {
      console.error('[Meta Comprehensive] Sync failed:', error)
      throw error
    }
  }

  /**
   * Fetch all entity metadata (accounts, campaigns, adsets, ads, creatives)
   */
  private async syncEntities(shopId: string, jobType: JobType): Promise<number> {
    let totalEntities = 0

    // 1. Fetch ad account metadata
    const account = await this.fetchAdAccount()
    await this.stageEntity(shopId, 'account', this.config.adAccountId, account, jobType)
    totalEntities++

    // 2. Fetch campaigns
    const campaigns = await this.fetchAllPaginated<any>(
      `act_${this.config.adAccountId}/campaigns`,
      { fields: ENTITY_FIELDS.campaign }
    )
    console.log(`[Meta] Fetched ${campaigns.length} campaigns`)

    for (const campaign of campaigns) {
      await this.stageEntity(shopId, 'campaign', campaign.id, campaign, jobType)
      totalEntities++
    }

    // 3. Fetch ad sets
    const adsets = await this.fetchAllPaginated<any>(
      `act_${this.config.adAccountId}/adsets`,
      { fields: ENTITY_FIELDS.adset }
    )
    console.log(`[Meta] Fetched ${adsets.length} ad sets`)

    for (const adset of adsets) {
      await this.stageEntity(shopId, 'adset', adset.id, adset, jobType)
      totalEntities++
    }

    // 4. Fetch ads
    const ads = await this.fetchAllPaginated<any>(
      `act_${this.config.adAccountId}/ads`,
      { fields: ENTITY_FIELDS.ad }
    )
    console.log(`[Meta] Fetched ${ads.length} ads`)

    const creativeIds = new Set<string>()

    for (const ad of ads) {
      await this.stageEntity(shopId, 'ad', ad.id, ad, jobType)
      totalEntities++

      // Extract creative ID
      if (ad.creative?.id) {
        creativeIds.add(ad.creative.id)
      }
    }

    // 5. Fetch creatives
    console.log(`[Meta] Fetching ${creativeIds.size} unique creatives`)

    for (const creativeId of creativeIds) {
      try {
        const creative = await this.fetchCreative(creativeId)
        await this.stageEntity(shopId, 'creative', creativeId, creative, jobType)
        totalEntities++
      } catch (error) {
        console.error(`[Meta] Failed to fetch creative ${creativeId}:`, error)
      }
    }

    // 6. Transform staged entities to warehouse tables
    await this.transformEntities(shopId)

    return totalEntities
  }

  /**
   * Fetch insights at all levels with breakdowns
   */
  private async syncInsights(shopId: string, jobType: JobType): Promise<number> {
    const { startDate, endDate } = this.getDateRange(jobType, shopId)
    console.log(`[Meta] Fetching insights from ${startDate} to ${endDate}`)

    let totalInsights = 0

    // Fetch insights at each level
    const levels: InsightLevel[] = ['campaign', 'adset', 'ad']

    for (const level of levels) {
      console.log(`[Meta] Fetching ${level}-level insights...`)

      // Base insights (no breakdown)
      const insights = await this.fetchInsights(level, startDate, endDate)

      for (const insight of insights) {
        await this.stageInsight(shopId, level, null, insight.id || insight.campaign_id || insight.adset_id || insight.ad_id, insight, jobType)
        totalInsights++
      }

      // Age & Gender breakdown
      try {
        console.log(`[Meta] Fetching ${level}-level age/gender breakdown...`)
        const ageGenderInsights = await this.fetchInsights(
          level,
          startDate,
          endDate,
          ['age', 'gender']
        )

        for (const insight of ageGenderInsights) {
          await this.stageInsight(shopId, level, 'age_gender', insight.id || insight.campaign_id || insight.adset_id || insight.ad_id, insight, jobType)
          totalInsights++
        }
      } catch (error) {
        console.error(`[Meta] Age/gender breakdown failed for ${level}:`, error)
      }

      // Device/Platform breakdown
      try {
        console.log(`[Meta] Fetching ${level}-level device breakdown...`)
        const deviceInsights = await this.fetchInsights(
          level,
          startDate,
          endDate,
          ['device_platform', 'publisher_platform', 'platform_position']
        )

        for (const insight of deviceInsights) {
          await this.stageInsight(shopId, level, 'device', insight.id || insight.campaign_id || insight.adset_id || insight.ad_id, insight, jobType)
          totalInsights++
        }
      } catch (error) {
        console.error(`[Meta] Device breakdown failed for ${level}:`, error)
      }

      // Geographic breakdown
      try {
        console.log(`[Meta] Fetching ${level}-level geo breakdown...`)
        const geoInsights = await this.fetchInsights(
          level,
          startDate,
          endDate,
          ['country']
        )

        for (const insight of geoInsights) {
          await this.stageInsight(shopId, level, 'geo', insight.id || insight.campaign_id || insight.adset_id || insight.ad_id, insight, jobType)
          totalInsights++
        }
      } catch (error) {
        console.error(`[Meta] Geo breakdown failed for ${level}:`, error)
      }
    }

    // Transform insights to warehouse tables
    await this.transformInsights(shopId)

    return totalInsights
  }

  /**
   * Download creative assets (images and videos)
   */
  private async downloadAssets(shopId: string): Promise<number> {
    let downloadCount = 0

    // Get pending images
    const { data: pendingImages, error: imgError } = await this.supabase
      .schema('core_warehouse')
      .from('meta_adimages')
      .select('*')
      .eq('shop_id', shopId)
      .eq('download_status', 'PENDING')
      .limit(100) // Limit to avoid overwhelming storage

    if (imgError) {
      console.error('[Meta] Failed to fetch pending images:', imgError)
    } else if (pendingImages && pendingImages.length > 0) {
      console.log(`[Meta] Downloading ${pendingImages.length} images...`)

      for (const image of pendingImages) {
        try {
          await this.downloadImage(shopId, image)
          downloadCount++
        } catch (error) {
          console.error(`[Meta] Failed to download image ${image.image_hash}:`, error)
        }
      }
    }

    // Get pending videos
    const { data: pendingVideos, error: vidError } = await this.supabase
      .schema('core_warehouse')
      .from('meta_advideos')
      .select('*')
      .eq('shop_id', shopId)
      .eq('download_status', 'PENDING')
      .limit(50) // Videos are larger, limit more aggressively

    if (vidError) {
      console.error('[Meta] Failed to fetch pending videos:', vidError)
    } else if (pendingVideos && pendingVideos.length > 0) {
      console.log(`[Meta] Downloading ${pendingVideos.length} videos...`)

      for (const video of pendingVideos) {
        try {
          await this.downloadVideo(shopId, video)
          downloadCount++
        } catch (error) {
          console.error(`[Meta] Failed to download video ${video.video_id}:`, error)
        }
      }
    }

    return downloadCount
  }

  // ============================================================================
  // META API CALLS
  // ============================================================================

  /**
   * Fetch ad account metadata
   */
  private async fetchAdAccount(): Promise<any> {
    return this.fetchAPI(`act_${this.config.adAccountId}`, {
      fields: ENTITY_FIELDS.account
    })
  }

  /**
   * Fetch creative by ID
   */
  private async fetchCreative(creativeId: string): Promise<any> {
    return this.fetchAPI(creativeId, {
      fields: ENTITY_FIELDS.creative
    })
  }

  /**
   * Fetch insights with optional breakdowns
   */
  private async fetchInsights(
    level: InsightLevel,
    startDate: string,
    endDate: string,
    breakdowns?: string[]
  ): Promise<any[]> {
    const params: Record<string, string> = {
      fields: INSIGHTS_FIELDS,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      time_increment: '1', // Daily
      level,
    }

    if (breakdowns && breakdowns.length > 0) {
      params.breakdowns = breakdowns.join(',')
    }

    return this.fetchAllPaginated<any>(
      `act_${this.config.adAccountId}/insights`,
      params
    )
  }

  /**
   * Generic Meta API fetch with error handling
   */
  private async fetchAPI(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = `${this.baseUrl}/${endpoint}`
    const searchParams = new URLSearchParams({
      access_token: this.config.accessToken,
      ...params
    })

    const response = await fetch(`${url}?${searchParams.toString()}`)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Meta API error: ${response.status} ${error}`)
    }

    const data = await response.json() as MetaAPIResponse<any>

    if (data.error) {
      throw new Error(`Meta API error: ${JSON.stringify(data.error)}`)
    }

    // If response has data array, return first item, otherwise return full response
    return data.data ? data.data[0] : data
  }

  /**
   * Fetch all pages of paginated results
   */
  private async fetchAllPaginated<T>(
    endpoint: string,
    params: Record<string, string> = {},
    maxPages: number = 1000
  ): Promise<T[]> {
    const results: T[] = []
    let url: string | null = `${this.baseUrl}/${endpoint}`
    let pageCount = 0

    const searchParams = new URLSearchParams({
      access_token: this.config.accessToken,
      limit: '500', // Max per page
      ...params
    })

    while (url && pageCount < maxPages) {
      const fetchUrl = pageCount === 0
        ? `${url}?${searchParams.toString()}`
        : url // Use paging.next URL for subsequent pages

      const response = await fetch(fetchUrl)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Meta API error: ${response.status} ${error}`)
      }

      const data = await response.json() as MetaAPIResponse<T>

      if (data.error) {
        throw new Error(`Meta API error: ${JSON.stringify(data.error)}`)
      }

      results.push(...(data.data || []))

      // Check for next page
      url = data.paging?.next || null
      pageCount++

      // Rate limiting: wait 100ms between pages
      if (url) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  // ============================================================================
  // STAGING OPERATIONS
  // ============================================================================

  private async stageEntity(
    shopId: string,
    entityType: EntityType,
    entityId: string,
    data: any,
    jobType: JobType
  ) {
    const { error } = await this.supabase
      .schema('staging_ingest')
      .from('meta_entities_raw')
      .insert({
        shop_id: shopId,
        entity_type: entityType,
        entity_id: entityId,
        data,
        job_type: jobType
      })

    if (error) {
      console.error(`[Meta] Failed to stage ${entityType} ${entityId}:`, error)
    }
  }

  private async stageInsight(
    shopId: string,
    insightLevel: InsightLevel,
    breakdownType: BreakdownType,
    entityId: string,
    data: any,
    jobType: JobType
  ) {
    const { error } = await this.supabase
      .schema('staging_ingest')
      .from('meta_insights_raw')
      .insert({
        shop_id: shopId,
        insight_level: insightLevel,
        breakdown_type: breakdownType,
        entity_id: entityId,
        data,
        job_type: jobType
      })

    if (error) {
      console.error(`[Meta] Failed to stage insight:`, error)
    }
  }

  // ============================================================================
  // TRANSFORMATION (call RPC functions)
  // ============================================================================

  private async transformEntities(shopId: string): Promise<void> {
    const { error } = await this.supabase.rpc('transform_meta_entities', {
      p_shop_id: shopId
    })

    if (error) {
      throw new Error(`Failed to transform entities: ${error.message}`)
    }
  }

  private async transformInsights(shopId: string): Promise<void> {
    const { error } = await this.supabase.rpc('transform_meta_insights', {
      p_shop_id: shopId
    })

    if (error) {
      throw new Error(`Failed to transform insights: ${error.message}`)
    }
  }

  // ============================================================================
  // ASSET DOWNLOAD
  // ============================================================================

  private async downloadImage(shopId: string, imageRecord: any): Promise<void> {
    try {
      if (!imageRecord.url) {
        throw new Error('No URL available for image')
      }

      // Download image
      const response = await fetch(imageRecord.url)
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const ext = this.getExtensionFromMimeType(response.headers.get('content-type') || 'image/jpeg')
      const filename = `${imageRecord.image_hash}${ext}`
      const storagePath = `${shopId}/images/${filename}`

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from('meta-creatives')
        .upload(storagePath, buffer, {
          contentType: response.headers.get('content-type') || 'image/jpeg',
          upsert: true
        })

      if (error) {
        throw error
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('meta-creatives')
        .getPublicUrl(storagePath)

      // Update record
      await this.supabase
        .schema('core_warehouse')
        .from('meta_adimages')
        .update({
          storage_path: storagePath,
          storage_url: urlData.publicUrl,
          file_size_bytes: buffer.length,
          mime_type: response.headers.get('content-type') || 'image/jpeg',
          download_status: 'DOWNLOADED',
          downloaded_at: new Date().toISOString()
        })
        .eq('shop_id', shopId)
        .eq('image_hash', imageRecord.image_hash)

      console.log(`[Meta] Downloaded image ${imageRecord.image_hash}`)
    } catch (error) {
      // Mark as failed
      await this.supabase
        .schema('core_warehouse')
        .from('meta_adimages')
        .update({
          download_status: 'FAILED',
          download_error: error instanceof Error ? error.message : String(error)
        })
        .eq('shop_id', shopId)
        .eq('image_hash', imageRecord.image_hash)

      throw error
    }
  }

  private async downloadVideo(shopId: string, videoRecord: any): Promise<void> {
    try {
      if (!videoRecord.source) {
        throw new Error('No source URL available for video')
      }

      // Download video
      const response = await fetch(videoRecord.source)
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const ext = this.getExtensionFromMimeType(response.headers.get('content-type') || 'video/mp4')
      const filename = `${videoRecord.video_id}${ext}`
      const storagePath = `${shopId}/videos/${filename}`

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from('meta-creatives')
        .upload(storagePath, buffer, {
          contentType: response.headers.get('content-type') || 'video/mp4',
          upsert: true
        })

      if (error) {
        throw error
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('meta-creatives')
        .getPublicUrl(storagePath)

      // Download thumbnail if available
      let thumbnailPath = null
      let thumbnailUrl = null

      if (videoRecord.picture_url) {
        try {
          const thumbResponse = await fetch(videoRecord.picture_url)
          if (thumbResponse.ok) {
            const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())
            thumbnailPath = `${shopId}/videos/thumbnails/${videoRecord.video_id}.jpg`

            await this.supabase.storage
              .from('meta-creatives')
              .upload(thumbnailPath, thumbBuffer, {
                contentType: 'image/jpeg',
                upsert: true
              })

            const { data: thumbUrlData } = this.supabase.storage
              .from('meta-creatives')
              .getPublicUrl(thumbnailPath)

            thumbnailUrl = thumbUrlData.publicUrl
          }
        } catch (thumbError) {
          console.error(`[Meta] Failed to download thumbnail for video ${videoRecord.video_id}:`, thumbError)
        }
      }

      // Update record
      await this.supabase
        .schema('core_warehouse')
        .from('meta_advideos')
        .update({
          storage_path: storagePath,
          storage_url: urlData.publicUrl,
          thumbnail_storage_path: thumbnailPath,
          thumbnail_storage_url: thumbnailUrl,
          file_size_bytes: buffer.length,
          mime_type: response.headers.get('content-type') || 'video/mp4',
          download_status: 'DOWNLOADED',
          downloaded_at: new Date().toISOString()
        })
        .eq('shop_id', shopId)
        .eq('video_id', videoRecord.video_id)

      console.log(`[Meta] Downloaded video ${videoRecord.video_id}`)
    } catch (error) {
      // Mark as failed
      await this.supabase
        .schema('core_warehouse')
        .from('meta_advideos')
        .update({
          download_status: 'FAILED',
          download_error: error instanceof Error ? error.message : String(error)
        })
        .eq('shop_id', shopId)
        .eq('video_id', videoRecord.video_id)

      throw error
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
    }

    return mimeMap[mimeType.toLowerCase()] || '.bin'
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getDateRange(
    jobType: JobType,
    shopId: string
  ): { startDate: string; endDate: string } {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() - 1) // Yesterday (Meta data has 1-day delay)

    if (jobType === JobType.HISTORICAL) {
      // Fetch last 90 days
      const start = new Date(endDate)
      start.setDate(start.getDate() - 90)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    } else {
      // Incremental: last 7 days (to catch delayed conversions)
      const start = new Date(endDate)
      start.setDate(start.getDate() - 7)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    }
  }
}
