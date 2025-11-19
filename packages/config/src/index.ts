export enum Platform {
  SHOPIFY = 'SHOPIFY',
  META = 'META',
}

export enum JobType {
  HISTORICAL_INIT = 'HISTORICAL_INIT',
  HISTORICAL_REBUILD = 'HISTORICAL_REBUILD',
  INCREMENTAL = 'INCREMENTAL',
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export interface SyncJob {
  id: string
  shop_id: string
  platform: Platform
  job_type: JobType
  status: JobStatus
  error: Record<string, unknown> | null
  records_synced: number | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface SyncCursor {
  id: string
  shop_id: string
  platform: Platform
  watermark: Record<string, unknown> | null
  last_success_at: string | null
  created_at: string
  updated_at: string
}

export interface ShopCredentials {
  id: string
  shop_id: string
  platform: Platform
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ErrorPayload {
  code: string
  message: string
  task?: string
  stack?: string
}
