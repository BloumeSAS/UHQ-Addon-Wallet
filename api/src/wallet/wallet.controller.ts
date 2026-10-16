import {
  Controller, Get, Post, Body, Query, Headers, Req, HttpCode, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { WalletService, TxType } from './wallet.service';
import { AddFundsDto, ClearHistoryDto, DeleteTransactionsDto } from './dto/wallet.dto';
import { PanelAuthService } from '../auth/panel-auth.service';
import { TransactionRecord } from './store.service';

const USER_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

function toInt(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : def;
}
function toType(v: unknown): TxType {
  return v === 'credit' || v === 'debit' ? v : 'all';
}
function checkUserId(v: unknown): string {
  if (typeof v !== 'string' || !USER_ID_RE.test(v)) throw new BadRequestException('userId invalide');
  return v;
}

/**
 * Évolution du solde (du plus ancien au plus récent) reconstruite à partir de l'historique : on remonte depuis le
 * solde actuel en retranchant chaque opération — fonctionne aussi pour les transactions antérieures à `balance_after`.
 */
function balanceSeries(current: number, txsDesc: TransactionRecord[], maxPoints = 200): { t: string; balance: number }[] {
  const points: { t: string; balance: number }[] = [];
  let bal = current;
  for (const tx of txsDesc) {
    points.push({ t: tx.created_at, balance: Math.round(bal * 100) / 100 });
    bal -= tx.amount;
  }
  points.reverse();
  return points.length > maxPoints ? points.slice(points.length - maxPoints) : points;
}

@Controller('api/wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly auth: PanelAuthService,
  ) {}

  /** GET /api/wallet — solde, cumuls, courbe et historique (filtré / paginé) de l'utilisateur courant. */
  @Get()
  async getMyWallet(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
  ) {
    const user = await this.auth.authenticate(req);
    const wallet = this.walletService.getOrCreate(user.id);
    const { transactions, total } = this.walletService.queryTransactions(wallet.id, {
      limit: toInt(limit, 20),
      offset: toInt(offset, 0),
      type: toType(type),
      q: typeof q === 'string' ? q.slice(0, 100) : undefined,
    });
    const stats = this.walletService.statsFor(wallet.id);
    const series = balanceSeries(wallet.balance, this.walletService.allTransactionsFor(wallet.id, 400));
    return { wallet, transactions, total, stats, series };
  }

  /** GET /api/wallet/balance — solde (utilisateur, ou compte ciblé pour un admin). */
  @Get('balance')
  async getBalance(@Req() req: Request, @Query('userId') targetId?: string) {
    const user = await this.auth.authenticate(req);
    const userId = targetId ? checkUserId(targetId) : user.id;
    if (userId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Accès refusé');
    }
    const wallet = this.walletService.getOrCreate(userId);
    return { balance: wallet.balance, currency: wallet.currency };
  }

  /**
   * GET /api/wallet/all — tous les wallets (ADMIN). Fusionne avec la liste complète des comptes panel (pas seulement ceux
   * qui ont déjà un wallet) en réutilisant le JWT admin de CETTE requête pour interroger le panel.
   */
  @Get('all')
  async getAllWallets(@Req() req: Request) {
    const admin = await this.auth.requireAdmin(req);
    const panelUsers = await this.auth.listPanelUsers(admin.token);
    const emails = Object.fromEntries(panelUsers.map((u) => [u.id, u.email]));
    const wallets = this.walletService.getAll(panelUsers.map((u) => u.id));
    return { wallets: wallets.map((w) => ({ ...w, email: emails[w.user_id] ?? '' })) };
  }

  /** GET /api/wallet/transactions?userId=X — historique d'un utilisateur (ADMIN), filtré / paginé ; `all=1` = jusqu'à 1000 (export). */
  @Get('transactions')
  async getUserTransactions(
    @Req() req: Request,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
    @Query('all') all?: string,
  ) {
    await this.auth.requireAdmin(req);
    const wallet = this.walletService.walletOf(checkUserId(userId));
    if (!wallet) return { transactions: [], total: 0 };
    if (all === '1') {
      const list = this.walletService.allTransactionsFor(wallet.id, 1000);
      return { transactions: list, total: list.length };
    }
    return this.walletService.queryTransactions(wallet.id, {
      limit: toInt(limit, 25),
      offset: toInt(offset, 0),
      type: toType(type),
      q: typeof q === 'string' ? q.slice(0, 100) : undefined,
    });
  }

  /** POST /api/wallet/transactions/delete — supprime des transactions de l'historique (ADMIN). N'affecte jamais le solde. */
  @Post('transactions/delete')
  @HttpCode(200)
  async deleteTransactions(@Req() req: Request, @Body() body: DeleteTransactionsDto) {
    await this.auth.requireAdmin(req);
    return { success: true, removed: this.walletService.deleteTransactions(body.ids) };
  }

  /** POST /api/wallet/transactions/clear — vide l'historique d'un utilisateur (ADMIN). N'affecte jamais le solde. */
  @Post('transactions/clear')
  @HttpCode(200)
  async clearHistory(@Req() req: Request, @Body() body: ClearHistoryDto) {
    await this.auth.requireAdmin(req);
    return { success: true, removed: this.walletService.clearHistory(body.userId) };
  }

  /** POST /api/wallet/add — créditer / débiter un wallet (ADMIN). Le compte doit exister dans le panel. */
  @Post('add')
  @HttpCode(200)
  async addFunds(@Req() req: Request, @Body() dto: AddFundsDto) {
    const admin = await this.auth.requireAdmin(req);

    // Évite de créer des wallets fantômes (faute de frappe sur l'identifiant). Si le panel ne répond pas, on ne bloque pas.
    const users = await this.auth.listPanelUsers(admin.token);
    if (users.length > 0 && !users.some((u) => u.id === dto.userId)) {
      throw new BadRequestException('Compte inconnu dans le panel');
    }

    const wallet = this.walletService.addFunds(dto.userId, dto.amount, dto.note ?? null, admin.email || admin.id);
    return { success: true, balance: wallet.balance };
  }

  /**
   * POST /api/wallet/internal/add — réservé aux autres addons UHQ (ex. Orders) : en-tête X-Panel-Key = clé API du panel.
   * Refuse tout si la clé n'est pas configurée. Même forme que /api/wallet/add.
   */
  @Post('internal/add')
  @HttpCode(200)
  internalAdd(@Headers('x-panel-key') key: string | undefined, @Body() dto: AddFundsDto) {
    this.auth.requirePanelKey(key);
    const wallet = this.walletService.addFunds(dto.userId, dto.amount, dto.note ?? null, 'addon-orders');
    return { success: true, balance: wallet.balance };
  }

  /** GET /api/wallet/internal/balance?userId=X — solde d'un utilisateur pour les autres addons (X-Panel-Key). */
  @Get('internal/balance')
  internalBalance(@Headers('x-panel-key') key: string | undefined, @Query('userId') userId: string) {
    this.auth.requirePanelKey(key);
    const wallet = this.walletService.getOrCreate(checkUserId(userId));
    return { balance: wallet.balance, currency: wallet.currency };
  }
}
