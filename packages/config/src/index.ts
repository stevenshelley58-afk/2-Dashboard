export enum RunStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export enum JobType {
  HISTORICAL = 'HISTORICAL',
  INCREMENTAL = 'INCREMENTAL',
}

export enum Platform {
  SHOPIFY = 'SHOPIFY',
  META = 'META',
  GA4 = 'GA4',
  KLAVIYO = 'KLAVIYO',
}

export interface ErrorPayload {
  code: string;
  message: string;
  service: string;
  task: string;
  stack_trace?: string;
}

export interface SyncRequest {
  shop_id: string;
  job_type: JobType;
  platform: Platform;
}

export interface SyncResponse {
  run_id: string;
}

export interface ETLRun {
  id: string;
  shop_id: string;
  status: RunStatus;
  job_type: JobType;
  platform: Platform;
  error?: ErrorPayload;
  records_synced?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export * from './shop';
