/** Réglages des recharges du solde (payées via les passerelles de l'addon Orders). */
export interface TopupOffer {
  id: string;
  /** Montant payé par le client. */
  amount: number;
  /** Bonus offert sur cette offre (en %) ; s'ajoute au meilleur palier uniquement s'il est supérieur (jamais cumulé). */
  bonus_percent: number;
  label: string;
  /** Mise en avant (« populaire »). */
  featured: boolean;
  enabled: boolean;
}

export interface TopupTier {
  /** À partir de ce montant payé… */
  min_amount: number;
  /** …le client reçoit ce bonus (en %). */
  bonus_percent: number;
}

export interface TopupSettings {
  /** Interrupteur général : désactivé = aucune recharge possible. */
  enabled: boolean;
  offers: TopupOffer[];
  /** Montant libre choisi par le client, entre `custom_min` et `custom_max`. */
  custom_enabled: boolean;
  custom_min: number;
  custom_max: number;
  /** Paliers de bonus (ex. +10 % dès 100 €) appliqués à toute recharge, offre ou montant libre. */
  tiers_enabled: boolean;
  tiers: TopupTier[];
  /** Autoriser un code promo « bonus de recharge » (addon Codes promo). */
  promo_enabled: boolean;
}

export const DEFAULT_TOPUP: TopupSettings = {
  enabled: false,
  offers: [
    { id: 'o10', amount: 10, bonus_percent: 0, label: '', featured: false, enabled: true },
    { id: 'o25', amount: 25, bonus_percent: 0, label: '', featured: false, enabled: true },
    { id: 'o50', amount: 50, bonus_percent: 5, label: '', featured: true, enabled: true },
    { id: 'o100', amount: 100, bonus_percent: 10, label: '', featured: false, enabled: true },
  ],
  custom_enabled: true,
  custom_min: 5,
  custom_max: 500,
  tiers_enabled: false,
  tiers: [{ min_amount: 100, bonus_percent: 10 }],
  promo_enabled: true,
};
