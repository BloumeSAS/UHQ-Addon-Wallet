import {
  Controller, Get, Post, Body, Query,
  Req, Res, UnauthorizedException, ForbiddenException,
  HttpCode,
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

  /** GET /api/wallet/all — tous les wallets (ADMIN uniquement) */
  @Get('all')
  getAllWallets(@Req() req: Request) {
    const payload = authenticate(req);
    if (payload.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');
    return { wallets: this.walletService.getAll() };
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
}
