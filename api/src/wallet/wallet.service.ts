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

  getAll(): WalletRecord[] {
    return Object.values(this.store.wallets).sort((a, b) => b.balance - a.balance);
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
