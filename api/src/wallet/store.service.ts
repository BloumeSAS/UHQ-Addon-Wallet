import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface WalletRecord {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionRecord {
  id: string;
  wallet_id: string;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
}

interface StoreData {
  wallets: Record<string, WalletRecord>;
  transactions: TransactionRecord[];
}

/**
 * Service de persistance JSON — zéro dépendance native.
 * Écriture atomique via fichier temporaire.
 */
@Injectable()
export class StoreService implements OnModuleInit {
  private readonly logger = new Logger(StoreService.name);
  private readonly dbPath: string;
  private data: StoreData = { wallets: {}, transactions: [] };

  constructor() {
    // Racine de l'addon = deux niveaux au-dessus de api/
    // dist/wallet/ → dist/ → api/ → wallet/ → wallet-data.json
    const defaultDb = path.resolve(__dirname, '..', '..', '..', 'wallet-data.json');
    this.dbPath = path.resolve(process.env.DB_PATH ?? defaultDb);
  }

  onModuleInit() {
    try {
      if (fs.existsSync(this.dbPath)) {
        this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        this.logger.log(`Données chargées depuis ${this.dbPath}`);
      } else {
        this.persist();
        this.logger.log(`Nouveau fichier créé : ${this.dbPath}`);
      }
    } catch (err) {
      this.logger.warn(`Impossible de lire ${this.dbPath} — démarrage avec données vides`);
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  get wallets(): Record<string, WalletRecord> {
    return this.data.wallets;
  }

  get transactions(): TransactionRecord[] {
    return this.data.transactions;
  }

  // ─── Mutations ────────────────────────────────────────────────────────────────

  setWallet(record: WalletRecord): void {
    this.data.wallets[record.user_id] = record;
    this.persist();
  }

  addTransaction(tx: TransactionRecord): void {
    this.data.transactions.push(tx);
    // Garde uniquement les 10 000 dernières transactions en mémoire
    if (this.data.transactions.length > 10_000) {
      this.data.transactions = this.data.transactions.slice(-10_000);
    }
    this.persist();
  }

  /** Restaure toutes les données depuis un backup. */
  restoreData(snapshot: { wallets: Record<string, WalletRecord>; transactions: TransactionRecord[] }): void {
    this.data.wallets      = snapshot.wallets;
    this.data.transactions = snapshot.transactions;
    this.persist();
  }

  // ─── Persistance ─────────────────────────────────────────────────────────────

  private persist(): void {
    const tmp = this.dbPath + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.dbPath);
    } catch (err) {
      this.logger.error('Erreur de persistance :', err);
    }
  }
}
