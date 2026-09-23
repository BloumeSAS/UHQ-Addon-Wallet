import { Injectable, BadRequestException } from '@nestjs/common';
import { StoreService, WalletRecord, TransactionRecord } from './store.service';
import { randomUUID } from 'crypto';

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
   * ceux qui ont déjà un wallet). Un wallet n'est créé qu'à la première
   * visite de "Mon solde" ou au premier crédit — sans ça, un compte qui n'a
   * jamais fait ni l'un ni l'autre était invisible dans "Gestion des
   * soldes". On fusionne : wallet réel s'il existe, sinon une entrée
   * synthétique à 0€ (jamais persistée — un simple affichage).
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

  getTransactions(walletId: string, limit = 20): TransactionRecord[] {
    return this.store.transactions
      .filter((tx) => tx.wallet_id === walletId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  addFunds(userId: string, amount: number, note: string | null, createdBy: string): WalletRecord {
    const wallet = this.getOrCreate(userId);
    const newBalance = parseFloat((wallet.balance + amount).toFixed(6));

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
      id:         randomUUID(),
      wallet_id:  wallet.id,
      amount,
      note:       note ?? null,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };
    this.store.addTransaction(tx);

    return updated;
  }
}
