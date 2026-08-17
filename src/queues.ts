import { Queue, type ConnectionOptions } from 'bullmq';
import { config } from './config.js';

const connection: ConnectionOptions = { url: config.redisUrl };

export interface ScanJob {
  kind: 'baseline' | 'scheduled' | 'premerge' | 'postmerge';
  githubRepoId: number;
  fullRepo: string;
  branch?: string;
  triggeredBy: string;
}

export interface FixJob {
  githubRepoId: number;
  fullRepo: string;
  branch: string;
  scanId: number;
}

export interface RescanJob {
  githubRepoId: number;
  fullRepo: string;
  prNumber: number;
}

export const scanQueue = new Queue<ScanJob>('scan', { connection });
export const fixQueue = new Queue<FixJob>('fix', { connection });
export const rescanQueue = new Queue<RescanJob>('rescan', { connection });

export async function closeQueues(): Promise<void> {
  await Promise.all([scanQueue.close(), fixQueue.close(), rescanQueue.close()]);
}
