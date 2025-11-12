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

interface InsightRow {
  entityId?: string
  data: any
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

const HISTORICAL_CHUNK_DAYS = 30
const DEFAULT_HISTORICAL_YEARS = 5
const INCREMENTAL_CHUNK_DAYS = 14
const INCREMENTAL_OVERLAP_DAYS = 3
const INSIGHT_INSERT_BATCH_SIZE = 200

export class MetaComprehensiveClient {
  private config: MetaConfig
  private supabase: SupabaseClient
  private baseUrl: string
  private tempDir: string
  private accountCreatedTime?: string

  private readonly insightBatchSize = INSIGHT_INSERT_BATCH_SIZE

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
      if (jobType === JobType.HISTORICAL) {
        console.log('[Meta] Historical run requested – resetting staging tables...')
        await this.resetStagingForHistorical(shopId)
      }

      // Step 1: Fetch entity hierarchy (account → campaigns → adsets → ads → creatives)
      console.log('[Meta] Step 1: Fetching entity hierarchy...')
      stats.entities = await this.syncEntities(shopId, jobType)

      // Step 2: Fetch insights at all levels
      console.log('[Meta] Step 2: Fetching insights...')
      const insightResult = await this.syncInsights(shopId, jobType)
      stats.insights = insightResult.count

      await this.updateCursor(shopId, insightResult.latestDate)

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
    if (account?.created_time || account?.createdTime) {
      this.accountCreatedTime = (account.created_time ?? account.createdTime) as string
    }
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
  private async syncInsights(
    shopId: string,
    jobType: JobType
  ): Promise<{ count: number; latestDate: string | null }> {
    const ranges = await this.buildInsightDateRanges(jobType, shopId)
    console.log(`[Meta] Fetching insights across ${ranges.length} date windows`)

    let totalInsights = 0
    let latestDate: string | null = null

    const levels: InsightLevel[] = ['campaign', 'adset', 'ad']

    for (const range of ranges) {
      console.log(`[Meta] Processing insights from ${range.startDate} to ${range.endDate}`)

      for (const level of levels) {
        console.log(`[Meta] Fetching ${level}-level insights (${range.startDate} → ${range.endDate})`)

        const baseInsights = await this.fetchInsights(level, range.startDate, range.endDate)
        await this.sleep(150)
        latestDate = this.updateLatestDate(latestDate, baseInsights)
        totalInsights += baseInsights.length
        await this.stageInsightsBatch(
          shopId,
          level,
          null,
          baseInsights.map((insight) => ({
            entityId: insight.id || insight.campaign_id || insight.adset_id || insight.ad_id,
            data: insight,
          })),
          jobType
        )

        // Age & Gender breakdown
        try {
          const ageGenderInsights = await this.fetchInsights(
            level,
            range.startDate,
            range.endDate,
            ['age', 'gender']
          )
          await this.sleep(150)
          latestDate = this.updateLatestDate(latestDate, ageGenderInsights)
          totalInsights += ageGenderInsights.length
          await this.stageInsightsBatch(
            shopId,
            level,
            'age_gender',
            ageGenderInsights.map((insight) => ({
              entityId: insight.id || insight.campaign_id || insight.adset_id || insight.ad_id,
              data: insight,
            })),
            jobType
          )
        } catch (error) {
          console.error(`[Meta] Age/gender breakdown failed for ${level}:`, error)
        }

        // Device/Platform breakdown
        try {
          const deviceInsights = await this.fetchInsights(
            level,
            range.startDate,
            range.endDate,
            ['device_platform', 'publisher_platform', 'platform_position']
          )
          await this.sleep(150)
          latestDate = this.updateLatestDate(latestDate, deviceInsights)
          totalInsights += deviceInsights.length
          await this.stageInsightsBatch(
            shopId,
            level,
            'device',
            deviceInsights.map((insight) => ({
              entityId: insight.id || insight.campaign_id || insight.adset_id || insight.ad_id,
              data: insight,
            })),
            jobType
          )
        } catch (error) {
          console.error(`[Meta] Device breakdown failed for ${level}:`, error)
        }

        // Geographic breakdown
        try {
          const geoInsights = await this.fetchInsights(
            level,
            range.startDate,
            range.endDate,
            ['country']
          )
          await this.sleep(150)
          latestDate = this.updateLatestDate(latestDate, geoInsights)
          totalInsights += geoInsights.length
          await this.stageInsightsBatch(
            shopId,
            level,
            'geo',
            geoInsights.map((insight) => ({
              entityId: insight.id || insight.campaign_id || insight.adset_id || insight.ad_id,
              data: insight,
            })),
            jobType
          )
        } catch (error) {
          console.error(`[Meta] Geo breakdown failed for ${level}:`, error)
        }
      }
    }

    await this.transformInsights(shopId)

    return { count: totalInsights, latestDate }
  }

  private async resetStagingForHistorical(shopId: string): Promise<void> {
    const tables = ['meta_entities_raw', 'meta_insights_raw']

    for (const table of tables) {
      const { error } = await this.supabase.from(table).delete().eq('shop_id', shopId)
      if (error) {
        throw new Error(`Failed to reset ${table} for historical run: ${error.message}`)
      }
    }
  }

  private async buildInsightDateRanges(
    jobType: JobType,
    shopId: string
  ): Promise<Array<{ startDate: string; endDate: string }>> {
    const end = new Date()
    end.setUTCHours(0, 0, 0, 0)
    end.setUTCDate(end.getUTCDate() - 1) // Meta data typically lags by one day

    if (jobType === JobType.HISTORICAL) {
      let start: Date
      if (this.accountCreatedTime) {
        start = new Date(this.accountCreatedTime)
      } else {
        start = new Date(end)
        start.setUTCFullYear(start.getUTCFullYear() - DEFAULT_HISTORICAL_YEARS)
      }
      start.setUTCHours(0, 0, 0, 0)

      if (start > end) {
        start = new Date(end)
      }

      return this.chunkDateRange(start, end, HISTORICAL_CHUNK_DAYS)
    }

    const cursor = await this.getExistingCursor(shopId)
    let start = cursor ? new Date(cursor) : new Date(end)
    start.setUTCHours(0, 0, 0, 0)

    if (cursor) {
      start.setUTCDate(start.getUTCDate() - INCREMENTAL_OVERLAP_DAYS)
    } else {
      start.setUTCDate(start.getUTCDate() - INCREMENTAL_CHUNK_DAYS)
    }

    if (start > end) {
      start = new Date(end)
    }

    return this.chunkDateRange(start, end, INCREMENTAL_CHUNK_DAYS)
  }

  private chunkDateRange(start: Date, end: Date, chunkDays: number): Array<{ startDate: string; endDate: string }> {
    const ranges: Array<{ startDate: string; endDate: string }> = []

    if (chunkDays <= 0) {
      ranges.push({ startDate: this.formatDate(start), endDate: this.formatDate(end) })
      return ranges
    }

    let cursor = new Date(start)

    while (cursor <= end) {
      const chunkEnd = new Date(cursor)
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1)
      if (chunkEnd > end) {
        chunkEnd.setTime(end.getTime())
      }

      ranges.push({
        startDate: this.formatDate(cursor),
        endDate: this.formatDate(chunkEnd),
      })

      cursor = new Date(chunkEnd)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return ranges
  }

  private formatDate(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private async stageInsightsBatch(
    shopId: string,
    insightLevel: InsightLevel,
    breakdownType: BreakdownType,
    rows: InsightRow[],
    jobType: JobType
  ): Promise<void> {
    if (rows.length === 0) {
      return
    }

    const chunks: InsightRow[][] = []
    for (let i = 0; i < rows.length; i += this.insightBatchSize) {
      chunks.push(rows.slice(i, i + this.insightBatchSize))
    }

    for (const chunk of chunks) {
      const payload = chunk
        .filter((row) => row.entityId)
        .map((row) => ({
          shop_id: shopId,
          insight_level: insightLevel,
          breakdown_type: breakdownType,
          entity_id: row.entityId,
          data: row.data,
          job_type: jobType,
        }))

      if (payload.length === 0) continue

      const { error } = await this.supabase.from('meta_insights_raw').insert(payload)
      if (error) {
        throw new Error(`Failed to stage ${insightLevel} insights (${breakdownType ?? 'base'}): ${error.message}`)
      }
    }
  }

  private updateLatestDate(current: string | null, insights: any[]): string | null {
    let latest = current
    for (const insight of insights) {
      const candidate = typeof insight.date_stop === 'string' ? insight.date_stop : insight.date_start
      if (candidate && (!latest || candidate > latest)) {
        latest = candidate
      }
    }
    return latest
  }

  private async updateCursor(shopId: string, lastDate: string | null): Promise<void> {
    if (!lastDate) {
      return
    }

    const { error } = await this.supabase.rpc('update_sync_cursor_with_date', {
      p_shop_id: shopId,
      p_platform: 'META',
      p_last_date: lastDate,
    })

    if (error) {
      throw new Error(`Failed to update Meta cursor: ${error.message}`)
    }
  }

  private async getExistingCursor(shopId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('get_sync_cursor', {
      p_shop_id: shopId,
      p_platform: 'META',
    })

    if (error) {
      console.warn('[Meta] Failed to read existing cursor:', error)
      return null
    }

    if (!data) {
      return null
    }

    try {
      const cursor = data as {
        last_synced_date?: string
        watermark?: Record<string, unknown>
      }

      const watermarkValue = cursor?.watermark?.['insights_date'] ?? cursor?.watermark?.['meta_latest_date']
      if (typeof watermarkValue === 'string') {
        return new Date(watermarkValue).toISOString()
      }

      if (typeof cursor?.last_synced_date === 'string') {
        return new Date(cursor.last_synced_date).toISOString()
      }
    } catch (err) {
      console.warn('[Meta] Unable to parse cursor payload:', err)
    }

    return null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Download creative assets (images and videos)
   */
  private async downloadAssets(shopId: string): Promise<number> {
    let downloadCount = 0

    // Get pending images
    const { data: pendingImages, error: imgError } = await this.supabase
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
