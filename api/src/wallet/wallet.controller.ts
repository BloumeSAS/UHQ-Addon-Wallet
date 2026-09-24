import {
  Controller, Get, Post, Body, Query, Headers,
  Req, Res, UnauthorizedException, ForbiddenException,
  HttpCode, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WalletService } from './wallet.service';
import { AddFundsDto } from './dto/wallet.dto';

// ─── Helpers JWT ─────────────────────────────────────────────────────────────

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function extractToken(req: Request): string {
  const auth = req.headers['authorization'] ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return (req.query['token'] as string) ?? '';
}

function authenticate(req: Request): JwtPayload {
  const token = extractToken(req);
  if (!token) throw new UnauthorizedException('Token manquant');

  const payload = decodeJwt(token);
  if (!payload?.sub) throw new UnauthorizedException('Token invalide');

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new UnauthorizedException('Token expiré');
  }

  return payload;
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller('api/wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);
  constructor(private readonly walletService: WalletService) {}

  /** GET /api/wallet — solde + historique de l'utilisateur courant */
  @Get()
  getMyWallet(@Req() req: Request) {
    const { sub } = authenticate(req);
    const wallet = this.walletService.getOrCreate(sub);
    const transactions = this.walletService.getTransactions(wallet.id);
    return { wallet, transactions };
  }

  /** GET /api/wallet/balance — solde (utilisateur ou admin ciblé) */
  @Get('balance')
  getBalance(@Req() req: Request, @Query('userId') targetId?: string) {
    const payload = authenticate(req);
    const userId = targetId ?? payload.sub;

    if (userId !== payload.sub && payload.role !== 'ADMIN') {
      throw new ForbiddenException('Accès refusé');
    }

    const wallet = this.walletService.getOrCreate(userId);
    return { balance: wallet.balance, currency: wallet.currency };
  }

  /**
   * GET /api/wallet/all — tous les wallets (ADMIN uniquement).
   * Fusionne avec la liste complète des comptes panel (pas seulement ceux
   * qui ont déjà un wallet — cf. WalletService.getAll) en réutilisant le
   * JWT admin déjà présent sur CETTE requête pour interroger le panel :
   * l'admin qui charge "Gestion des soldes" a forcément les droits, pas
   * besoin d'une clé API séparée pour ça.
   */
  @Get('all')
  async getAllWallets(@Req() req: Request) {
    const payload = authenticate(req);
    if (payload.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');

    const panelUsers = await this.fetchPanelUsers(extractToken(req));
    const emails = Object.fromEntries(panelUsers.map((u) => [u.id, u.email ?? '']));
    const wallets = this.walletService.getAll(panelUsers.map((u) => u.id));
    return { wallets: wallets.map((w) => ({ ...w, email: emails[w.user_id] ?? '' })) };
  }

  private async fetchPanelUsers(adminToken: string): Promise<{ id: string; email?: string }[]> {
    const panelUrl = (process.env.PANEL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${panelUrl}/api/panel/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      return (json?.data ?? []).filter((u: any) => u?.id);
    } catch (err: any) {
      this.logger.warn(`Impossible de récupérer la liste des comptes panel : ${err?.message ?? err}`);
      // Fail-open : au pire on retombe sur le comportement d'avant (wallets déjà créés seulement).
      return [];
    }
  }

  /** GET /api/wallet/transactions?userId=X — historique complet d'un utilisateur (ADMIN). */
  @Get('transactions')
  getUserTransactions(@Req() req: Request, @Query('userId') userId: string) {
    const payload = authenticate(req);
    if (payload.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');
    return { transactions: this.walletService.getTransactionsForUser(userId) };
  }

  /** POST /api/wallet/transactions/delete — supprime une ou plusieurs transactions de l'historique (ADMIN). N'affecte jamais le solde. */
  @Post('transactions/delete')
  @HttpCode(200)
  deleteTransactions(@Req() req: Request, @Body() body: { ids: string[] }) {
    const payload = authenticate(req);
    if (payload.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');
    const removed = this.walletService.deleteTransactions(Array.isArray(body.ids) ? body.ids : []);
    return { success: true, removed };
  }

  /** POST /api/wallet/transactions/clear — vide tout l'historique d'un utilisateur (ADMIN). N'affecte jamais le solde. */
  @Post('transactions/clear')
  @HttpCode(200)
  clearHistory(@Req() req: Request, @Body() body: { userId: string }) {
    const payload = authenticate(req);
    if (payload.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');
    const removed = this.walletService.clearHistory(body.userId);
    return { success: true, removed };
  }

  /** POST /api/wallet/add — créditer / débiter un wallet (ADMIN) */
  @Post('add')
  @HttpCode(200)
  addFunds(@Req() req: Request, @Body() dto: AddFundsDto) {
    const payload = authenticate(req);
    if (payload.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');

    const wallet = this.walletService.addFunds(
      dto.userId,
      dto.amount,
      dto.note ?? null,
      payload.sub,
    );

    return { success: true, balance: wallet.balance };
  }

  /**
   * POST /api/wallet/internal/add
   *
   * Endpoint interne réservé aux autres addons UHQ (ex : Orders).
   * Auth : header X-Panel-Key contenant la clé API du panel (PANEL_API_KEY).
   * Permet de débiter / créditer un wallet sans token JWT admin.
   *
   * Body : { userId, amount, note? }  — même shape que /api/wallet/add
   */
  @Post('internal/add')
  @HttpCode(200)
  internalAdd(
    @Headers('x-panel-key') key: string | undefined,
    @Body() dto: AddFundsDto,
  ) {
    const expected = process.env.PANEL_API_KEY;
    if (!expected) {
      // Aucune clé configurée → autorisé en dev (même comportement que le backup)
      this.logger.warn('PANEL_API_KEY non configuré — internal/add non protégé');
    } else if (key !== expected) {
      throw new ForbiddenException('Clé API invalide');
    }

    // Auteur système = 'addon-orders' (pas de sub JWT ici)
    const wallet = this.walletService.addFunds(
      dto.userId,
      dto.amount,
      dto.note ?? null,
      'addon-orders',
    );

    return { success: true, balance: wallet.balance };
  }
}
