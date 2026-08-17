/**
 * Best-effort metered-usage emission. Resolves the Stripe customer for an
 * installation and sends a meter event. Failures are logged + audited but never
 * block the scan/fix pipeline (billing is secondary to the core fix flow).
 */

import { audit, getStripeCustomerId } from '../db/repositories.js';
import type { Db } from '../db/pool.js';
import { emitUsage } from './stripe.js';

export async function emitMeteredUsage(
  db: Db,
  repoId: number,
  installationDbId: number,
  kind: 'merged_fix' | 'page_scanned',
  quantity = 1,
): Promise<void> {
  try {
    const customerId = await getStripeCustomerId(db, installationDbId);
    if (!customerId) return;
    await emitUsage(kind, customerId, quantity);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[billing] meter event failed (${kind}): ${message}`);
    try {
      await audit(db, repoId, 'billing', 'meter_event_failed', { kind, error: message });
    } catch {
      /* auditing failure must not surface */
    }
  }
}
