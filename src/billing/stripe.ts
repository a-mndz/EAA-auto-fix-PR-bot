/**
 * Stripe metered-billing client. Guarded on STRIPE_SECRET_KEY — when the key
 * is absent (dev / self-host without billing), every call is a no-op so the
 * scan/fix pipeline never blocks on billing. Mirrors the GitHub/LLM clients.
 */

import Stripe from 'stripe';
import { config } from '../config.js';

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(config.billing.secretKey);
}

function getClient(): Stripe {
  if (!client) {
    if (!config.billing.secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured; billing disabled');
    }
    client = new Stripe(config.billing.secretKey);
  }
  return client;
}

export interface MeterEvent {
  /** Stripe meter event name (configured in the dashboard). */
  eventName: string;
  /** Stripe customer id the usage belongs to. */
  customerId: string;
  quantity: number;
  /** Unix seconds; omitted to use Stripe's receive time. */
  timestamp?: number;
}

/** Send a single usage event to a Stripe meter. No-op when billing is disabled. */
export async function sendMeterEvent(ev: MeterEvent): Promise<void> {
  if (!stripeEnabled()) return;
  await getClient().billing.meterEvents.create({
    event_name: ev.eventName,
    payload: {
      stripe_customer_id: ev.customerId,
      value: String(ev.quantity),
      ...(ev.timestamp ? { timestamp: String(ev.timestamp) } : {}),
    },
  });
}

/** Map an internal usage kind to its Stripe meter event + quantity. */
export async function emitUsage(
  kind: 'merged_fix' | 'page_scanned',
  customerId: string,
  quantity = 1,
): Promise<void> {
  const eventName = kind === 'merged_fix' ? config.billing.meterFixes : config.billing.meterPages;
  await sendMeterEvent({ eventName, customerId, quantity });
}

/** Lazily create (or fetch) the Stripe customer for a GitHub installation. */
export async function getOrCreateStripeCustomer(
  installationId: number,
  accountLogin: string,
  lookup: () => Promise<string | null>,
  store: (id: string) => Promise<void>,
): Promise<string | null> {
  if (!stripeEnabled()) return null;
  const existing = await lookup();
  if (existing) return existing;
  const created = await getClient().customers.create({
    name: accountLogin,
    metadata: { github_installation_id: String(installationId) },
  });
  await store(created.id);
  return created.id;
}

export async function createCheckoutSession(params: {
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Array<{ price: string; quantity?: number }>;
}): Promise<string | null> {
  if (!stripeEnabled()) return null;
  const session = await getClient().checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: params.lineItems.map((li) => ({ price: li.price, quantity: li.quantity ?? 1 })),
  });
  return session.url;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string | null> {
  if (!stripeEnabled()) return null;
  const session = await getClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
