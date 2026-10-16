import { Injectable, BadRequestException } from '@nestjs/common';
import { StoreService, WalletRecord, TransactionRecord } from './store.service';
import { randomUUID } from 'crypto';

export type TxType = 'all' | 'credit' | 'debit';

export interface TxQuery {
  limit?: number;
  offset?: number;
  type?: TxType;
  q?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class WalletService {
  constructor(private readonly store: StoreService) {}

  // ─── Wallet ──────────────────────────────────────────────────────────────────

  getOrCreate(userId: string): WalletRecord {
    if (!this.store.wallets[userId]) {
      const now = new Date().toISOString();
      this.store.setWallet({
        id:         randomUUID(),
        user_id:    userId,
        balance:    0,
        currency:   'EUR',
        created_at: now,
        updated_at: now,
      });
    }
    return this.store.wallets[userId];
  }

  /**
   * `panelUserIds` : tous les PanelUser connus côté panel (pas seulement
   * ceux qui ont déjà un wallet). On fusionne : wallet réel s'il existe,
   * sinon une entrée synthétique à 0 € (jamais persistée — un simple affichage).
   */
  getAll(panelUserIds: string[] = []): WalletRecord[] {
    const now = new Date().toISOString();
    const merged = new Map<string, WalletRecord>();
    for (const id of panelUserIds) {
      merged.set(id, {
        id: '', user_id: id, balance: 0, currency: 'EUR', created_at: now, updated_at: now,
      });
    }
    for (const wallet of Object.values(this.store.wallets)) {
      merged.set(wallet.user_id, wallet);
    }
    return Array.from(merged.values()).sort((a, b) => b.balance - a.balance);
  }

  // ─── Transactions ─────────────────────────────────────────────────────────────

  /** Transactions d'un wallet, du plus récent au plus ancien, filtrées + paginées. */
  queryTransactions(walletId: string, query: TxQuery = {}): { transactions: TransactionRecord[]; total: number } {
    const limit = Math.max(1, Math.min(200, Math.floor(query.limit ?? 20)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    const q = (query.q ?? '').trim().toLowerCase();
    let list = this.store.transactions.filter((tx) => tx.wallet_id === walletId);
    if (query.type === 'credit') list = list.filter((tx) => tx.amount > 0);
    else if (query.type === 'debit') list = list.filter((tx) => tx.amount < 0);
    if (q) list = list.filter((tx) => (tx.note ?? '').toLowerCase().includes(q) || tx.created_by.toLowerCase().includes(q));
    list = list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { transactions: list.slice(offset, offset + limit), total: list.length };
  }

  /** Cumuls d'un wallet (crédits / débits / nombre d'opérations) — toute la période conservée. */
  statsFor(walletId: string): { credited: number; spent: number; count: number } {
    let credited = 0;
    let spent = 0;
    let count = 0;
    for (const tx of this.store.transactions) {
      if (tx.wallet_id !== walletId) continue;
      count += 1;
      if (tx.amount > 0) credited += tx.amount;
      else spent += -tx.amount;
    }
    return { credited: round2(credited), spent: round2(spent), count };
  }

  /** Historique (borné) d'un wallet, du plus récent au plus ancien — graphique d'évolution et export. */
  allTransactionsFor(walletId: string, max = 1000): TransactionRecord[] {
    return this.store.transactions
      .filter((tx) => tx.wallet_id === walletId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, max);
  }

  walletOf(userId: string): WalletRecord | undefined {
    return this.store.wallets[userId];
  }

  /** Supprime des transactions par id (individuel ou bulk) — historique uniquement, le solde n'est jamais recalculé. */
  deleteTransactions(ids: string[]): number {
    return this.store.removeTransactions(ids);
  }

  /** Vide tout l'historique d'un utilisateur. */
  clearHistory(userId: string): number {
    const wallet = this.store.wallets[userId];
    if (!wallet) return 0;
    return this.store.clearTransactionsForWallet(wallet.id);
  }

  addFunds(userId: string, amount: number, note: string | null, createdBy: string): WalletRecord {
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('Montant invalide');
    const wallet = this.getOrCreate(userId);
    const newBalance = round2(wallet.balance + amount);

    if (newBalance < 0) {
      throw new BadRequestException('Solde insuffisant');
    }

    const updated: WalletRecord = {
      ...wallet,
      balance:    newBalance,
      updated_at: new Date().toISOString(),
    };
    this.store.setWallet(updated);

    const tx: TransactionRecord = {
      id:            randomUUID(),
      wallet_id:     wallet.id,
      amount:        round2(amount),
      note:          note?.trim() ? note.trim() : null,
      created_by:    createdBy,
      created_at:    new Date().toISOString(),
      balance_after: newBalance,
    };
    this.store.addTransaction(tx);

    return updated;
  }
}
