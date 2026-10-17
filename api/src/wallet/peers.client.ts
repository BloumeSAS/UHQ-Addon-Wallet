import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Appels vers les autres addons : Orders (paiement des recharges) et Codes promo — URLs et clé API du panel fournies par l'environnement. */
@Injectable()
export class PeersClient {
  private readonly logger = new Logger(PeersClient.name);
  private readonly orders = (process.env.ORDERS_URL ?? '').replace(/\/+$/, '');
  private readonly promo = (process.env.PROMO_URL ?? '').replace(/\/+$/, '');
  private readonly panelUrl = (process.env.PANEL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
  private readonly key = process.env.PANEL_API_KEY ?? '';

  private async probe(base: string, name: RegExp): Promise<boolean> {
    if (!base) return false;
    try {
      const res = await fetch(`${base}/uhq-manifest.json`, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) return false;
      const m: any = await res.json().catch(() => ({}));
      return name.test(String(m?.name ?? ''));
    } catch {
      return false;
    }
  }

  ordersAvailable() { return this.probe(this.orders, /orders/i); }
  promoAvailable() { return this.probe(this.promo, /promo/i); }

  private async post(base: string, path: string, body: unknown, what: string): Promise<any> {
    if (!base) throw new ServiceUnavailableException(`${what}_UNAVAILABLE`);
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'X-Panel-Key': this.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e: any) {
      this.logger.warn(`${what} injoignable (${path}) : ${e?.message ?? e}`);
      throw new ServiceUnavailableException(`${what}_UNAVAILABLE`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any)?.message ?? `HTTP ${res.status}`;
      throw new BadRequestException(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
    return data;
  }

  /** Moyens de paiement actifs côté Orders (lus AU NOM de l'utilisateur : Orders vérifie le jeton auprès du panel). */
  async paymentMethods(userToken: string): Promise<{ stripe: boolean; nowpayments: boolean; paypal: boolean }> {
    if (!this.orders) return { stripe: false, nowpayments: false, paypal: false };
    try {
      const res = await fetch(`${this.orders}/api/payments/methods`, { headers: { Authorization: `Bearer ${userToken}` }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: any = await res.json();
      return { stripe: !!j?.stripe?.enabled, nowpayments: !!j?.nowpayments?.enabled, paypal: !!j?.paypal?.enabled };
    } catch {
      return { stripe: false, nowpayments: false, paypal: false };
    }
  }

  /** Crée la recharge côté Orders (commande « recharge » + passerelle). */
  createTopupOrder(input: Record<string, unknown>) { return this.post(this.orders, '/api/internal/topup', input, 'ORDERS'); }

  async topupStatus(orderId: string, userId: string): Promise<any> {
    if (!this.orders) throw new ServiceUnavailableException('ORDERS_UNAVAILABLE');
    const res = await fetch(`${this.orders}/api/internal/topup/${encodeURIComponent(orderId)}?user_id=${encodeURIComponent(userId)}`, {
      headers: { 'X-Panel-Key': this.key }, signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res || !res.ok) throw new BadRequestException('Recharge introuvable');
    return res.json();
  }

  promoValidate(input: Record<string, unknown>): Promise<any> { return this.post(this.promo, '/api/internal/validate', input, 'PROMO'); }
  promoConsume(input: Record<string, unknown>): Promise<any> { return this.post(this.promo, '/api/internal/consume', input, 'PROMO'); }
  async promoRelease(ref: string): Promise<void> { try { await this.post(this.promo, '/api/internal/release', { ref }, 'PROMO'); } catch { /* best effort */ } }

  /** E-mail via le panel (modèle géré dans Paramètres → SMTP & e-mails). Silencieux en cas d'échec. */
  mail(template: string, to: string | undefined, vars: Record<string, string>): void {
    if (!this.key || !to) return;
    void fetch(`${this.panelUrl}/api/v1/mail/send`, {
      method: 'POST', headers: { 'X-API-Key': this.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, to, vars }), signal: AbortSignal.timeout(8000),
    }).catch(() => undefined);
  }

  static round2 = round2;
}
