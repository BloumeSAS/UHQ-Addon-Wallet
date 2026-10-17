import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StoreService } from './store.service';
import { WalletService } from './wallet.service';
import { PeersClient } from './peers.client';
import { DEFAULT_TOPUP, TopupOffer, TopupSettings, TopupTier } from './topup.types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const HARD_MAX = 100_000;

export interface Quote {
  amount: number;
  bonus_percent: number;
  /** Crédit avant code promo : montant + bonus de l'offre / du palier. */
  base_credit: number;
  promo?: { valid: boolean; reason?: string; code?: string; label?: string; effect?: number };
  /** Crédit final affiché au client (avec le bonus du code promo s'il est valide). */
  credit: number;
  bonus: number;
}

@Injectable()
export class TopupService {
  private readonly misses = new Map<string, { n: number; since: number }>();

  constructor(
    private readonly store: StoreService,
    private readonly wallets: WalletService,
    private readonly peers: PeersClient,
  ) {}

  // ─── Réglages (admin) ────────────────────────────────────────────────────────

  get settings(): TopupSettings {
    return this.store.topup;
  }

  /** Valide et enregistre les réglages (bornes, doublons, tri) — jamais de valeur négative ni de bonus aberrant. */
  saveSettings(input: Partial<TopupSettings>): TopupSettings {
    const cur = this.store.topup;
    const num = (v: unknown, min: number, max: number, d: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
    };
    const offersIn = Array.isArray(input.offers) ? input.offers : cur.offers;
    const offers: TopupOffer[] = [];
    const seen = new Set<number>();
    for (const o of offersIn.slice(0, 12)) {
      const amount = round2(num(o?.amount, 0, HARD_MAX, 0));
      if (amount < 0.5 || seen.has(amount)) continue;
      seen.add(amount);
      offers.push({
        id: String(o?.id || randomUUID()).slice(0, 40),
        amount,
        bonus_percent: round2(num(o?.bonus_percent, 0, 100, 0)),
        label: String(o?.label ?? '').slice(0, 40),
        featured: !!o?.featured,
        enabled: o?.enabled !== false,
      });
    }
    offers.sort((a, b) => a.amount - b.amount);
    const tiersIn = Array.isArray(input.tiers) ? input.tiers : cur.tiers;
    const tiers: TopupTier[] = [];
    const seenT = new Set<number>();
    for (const t of tiersIn.slice(0, 10)) {
      const min = round2(num(t?.min_amount, 0, HARD_MAX, 0));
      if (min <= 0 || seenT.has(min)) continue;
      seenT.add(min);
      tiers.push({ min_amount: min, bonus_percent: round2(num(t?.bonus_percent, 0, 100, 0)) });
    }
    tiers.sort((a, b) => a.min_amount - b.min_amount);
    const customMin = round2(num(input.custom_min ?? cur.custom_min, 0.5, HARD_MAX, 5));
    const customMax = round2(num(input.custom_max ?? cur.custom_max, 0, HARD_MAX, 500));
    if (customMax > 0 && customMax < customMin) throw new BadRequestException('Le montant maximum doit dépasser le minimum.');
    const next: TopupSettings = {
      enabled: input.enabled ?? cur.enabled,
      offers,
      custom_enabled: input.custom_enabled ?? cur.custom_enabled,
      custom_min: customMin,
      custom_max: customMax,
      tiers_enabled: input.tiers_enabled ?? cur.tiers_enabled,
      tiers,
      promo_enabled: input.promo_enabled ?? cur.promo_enabled,
    };
    this.store.setTopup(next);
    return next;
  }

  // ─── Calculs ─────────────────────────────────────────────────────────────────

  /** Montant payé → (montant contrôlé, offre éventuelle). Refuse tout montant hors offres / hors bornes. */
  resolveAmount(input: { amount?: number; offer_id?: string }): { amount: number; offer?: TopupOffer } {
    const s = this.store.topup;
    if (!s.enabled) throw new BadRequestException('TOPUP_DISABLED');
    if (input.offer_id) {
      const offer = s.offers.find((o) => o.id === input.offer_id && o.enabled);
      if (!offer) throw new BadRequestException('OFFER_UNKNOWN');
      return { amount: offer.amount, offer };
    }
    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('AMOUNT_INVALID');
    // Un montant égal à celui d'une offre active bénéficie du bonus de cette offre.
    const same = s.offers.find((o) => o.enabled && o.amount === amount);
    if (same) return { amount, offer: same };
    if (!s.custom_enabled) throw new BadRequestException('CUSTOM_DISABLED');
    if (amount < s.custom_min) throw new BadRequestException('AMOUNT_TOO_LOW');
    if (s.custom_max > 0 && amount > s.custom_max) throw new BadRequestException('AMOUNT_TOO_HIGH');
    return { amount };
  }

  bonusPercent(amount: number, offer?: TopupOffer): number {
    const s = this.store.topup;
    let best = offer?.bonus_percent ?? 0;
    if (s.tiers_enabled) for (const t of s.tiers) if (amount >= t.min_amount && t.bonus_percent > best) best = t.bonus_percent;
    return best;
  }

  async quote(user: { id: string; email: string }, input: { amount?: number; offer_id?: string; promo_code?: string }): Promise<Quote> {
    const { amount, offer } = this.resolveAmount(input);
    const pct = this.bonusPercent(amount, offer);
    const base = round2(amount * (1 + pct / 100));
    const q: Quote = { amount, bonus_percent: pct, base_credit: base, credit: base, bonus: round2(base - amount) };
    if (input.promo_code?.trim()) {
      if (!this.store.topup.promo_enabled) throw new BadRequestException('PROMO_DISABLED');
      this.checkMiss(user.id);
      let r: any;
      try {
        r = await this.peers.promoValidate({ code: input.promo_code, user_id: user.id, user_email: user.email, context: 'topup', amount });
      } catch (e) {
        throw e;
      }
      if (!r.valid) {
        this.recordMiss(user.id);
        q.promo = { valid: false, reason: r.reason };
      } else {
        q.promo = { valid: true, code: r.code, label: r.label, effect: r.effect };
        q.credit = round2(base + (r.effect ?? 0));
        q.bonus = round2(q.credit - amount);
      }
    }
    return q;
  }

  private checkMiss(userId: string) {
    const m = this.misses.get(userId);
    if (m && Date.now() - m.since < 10 * 60_000 && m.n >= 10) throw new BadRequestException('TOO_MANY_ATTEMPTS');
  }

  private recordMiss(userId: string) {
    const m = this.misses.get(userId);
    if (!m || Date.now() - m.since >= 10 * 60_000) this.misses.set(userId, { n: 1, since: Date.now() });
    else m.n += 1;
  }

  /** Lance une recharge : le Wallet contrôle montant + bonus, Orders crée la commande et la passerelle. */
  async checkout(
    user: { id: string; email: string },
    input: { amount?: number; offer_id?: string; promo_code?: string; method: 'stripe' | 'nowpayments' | 'paypal'; successUrl?: string; cancelUrl?: string },
  ) {
    const { amount, offer } = this.resolveAmount(input);
    const pct = this.bonusPercent(amount, offer);
    const base = round2(amount * (1 + pct / 100));
    if (input.promo_code?.trim() && !this.store.topup.promo_enabled) throw new BadRequestException('PROMO_DISABLED');
    const r = await this.peers.createTopupOrder({
      user_id: user.id, user_email: user.email, amount, base_credit: base,
      promo_code: input.promo_code?.trim() || undefined, paymentMethod: input.method,
      successUrl: input.successUrl, cancelUrl: input.cancelUrl, currency: this.wallets.getOrCreate(user.id).currency,
    });
    return { order_id: r.order_id, checkoutUrl: r.checkoutUrl, paypal: r.paypal, total: r.total, credit: r.credit, bonus: r.bonus };
  }

  // ─── Code cadeau (crédit) appliqué sur la page « Mon solde » ─────────────────

  async redeemGift(user: { id: string; email: string }, code: string) {
    this.checkMiss(user.id);
    const ref = `redeem:${randomUUID()}`;
    const r = await this.peers.promoConsume({ code, user_id: user.id, user_email: user.email, context: 'redeem', ref });
    if (!r.valid) {
      this.recordMiss(user.id);
      throw new BadRequestException(r.reason ?? 'unknown');
    }
    try {
      const w = this.wallets.addFunds(user.id, r.effect, `Code promo ${r.code}`, 'promo');
      this.peers.mail('promo.redeemed', user.email, { code: String(r.code), benefit: `+${r.effect} (solde)` });
      return { credited: r.effect, code: r.code, label: r.label ?? '', balance: w.balance };
    } catch (e) {
      await this.peers.promoRelease(ref);
      throw e;
    }
  }
}
