import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PanelAuthService } from '../auth/panel-auth.service';
import { TopupService } from './topup.service';
import { PeersClient } from './peers.client';
import { WalletService } from './wallet.service';

class OfferDto {
  @IsOptional() @IsString() @MaxLength(40) id?: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) amount!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) bonus_percent!: number;
  @IsOptional() @IsString() @MaxLength(40) label?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

class TierDto {
  @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) min_amount!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) bonus_percent!: number;
}

class TopupSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OfferDto) offers?: OfferDto[];
  @IsOptional() @IsBoolean() custom_enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) custom_min?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) custom_max?: number;
  @IsOptional() @IsBoolean() tiers_enabled?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TierDto) tiers?: TierDto[];
  @IsOptional() @IsBoolean() promo_enabled?: boolean;
}

class QuoteDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) amount?: number;
  @IsOptional() @IsString() @MaxLength(40) offer_id?: string;
  @IsOptional() @IsString() @MaxLength(60) promo_code?: string;
}

class CheckoutDto extends QuoteDto {
  @IsIn(['stripe', 'nowpayments', 'paypal']) method!: 'stripe' | 'nowpayments' | 'paypal';
  @IsOptional() @IsString() @MaxLength(2000) successUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) cancelUrl?: string;
}

class RedeemDto {
  @IsString() @MaxLength(60) code!: string;
}

/** Recharge du solde (via les passerelles d'Orders), réglages des offres et codes cadeau. */
@Controller('api/topup')
export class TopupController {
  constructor(
    private readonly topup: TopupService,
    private readonly peers: PeersClient,
    private readonly auth: PanelAuthService,
    private readonly wallets: WalletService,
  ) {}

  /** GET /api/topup/config — ce que le client peut faire : offres, bornes, moyens de paiement, code promo. */
  @Get('config')
  async config(@Req() req: Request) {
    const user = await this.auth.authenticate(req);
    const s = this.topup.settings;
    const ordersUp = await this.peers.ordersAvailable();
    const methods = ordersUp ? await this.peers.paymentMethods(user.token) : { stripe: false, nowpayments: false, paypal: false };
    const anyMethod = methods.stripe || methods.nowpayments || methods.paypal;
    const promoUp = s.promo_enabled ? await this.peers.promoAvailable() : false;
    return {
      available: s.enabled && ordersUp && anyMethod,
      reason: !s.enabled ? 'disabled' : !ordersUp ? 'orders' : !anyMethod ? 'methods' : null,
      currency: this.wallets.getOrCreate(user.id).currency,
      offers: s.offers.filter((o) => o.enabled).map((o) => ({ id: o.id, amount: o.amount, bonus_percent: this.topup.bonusPercent(o.amount, o), label: o.label, featured: o.featured })),
      custom: s.custom_enabled ? { min: s.custom_min, max: s.custom_max } : null,
      tiers: s.tiers_enabled ? s.tiers : [],
      methods,
      promo: promoUp,
      gift: await this.peers.promoAvailable(),
    };
  }

  @Post('quote')
  @HttpCode(200)
  async quote(@Req() req: Request, @Body() dto: QuoteDto) {
    const user = await this.auth.authenticate(req);
    return this.topup.quote({ id: user.id, email: user.email }, dto);
  }

  @Post('checkout')
  @HttpCode(200)
  async checkout(@Req() req: Request, @Body() dto: CheckoutDto) {
    const user = await this.auth.authenticate(req);
    return this.topup.checkout({ id: user.id, email: user.email }, dto);
  }

  @Get('status/:id')
  async status(@Req() req: Request, @Param('id') id: string) {
    const user = await this.auth.authenticate(req);
    return this.peers.topupStatus(id, user.id);
  }

  /** POST /api/topup/redeem — applique un code cadeau (crédit) sur le solde. */
  @Post('redeem')
  @HttpCode(200)
  async redeem(@Req() req: Request, @Body() dto: RedeemDto) {
    const user = await this.auth.authenticate(req);
    return { success: true, ...(await this.topup.redeemGift({ id: user.id, email: user.email }, dto.code)) };
  }

  // ─── Administration ──────────────────────────────────────────────────────────

  @Get('settings')
  async getSettings(@Req() req: Request) {
    await this.auth.requireAdmin(req);
    return this.topup.settings;
  }

  @Put('settings')
  async putSettings(@Req() req: Request, @Body() dto: TopupSettingsDto) {
    await this.auth.requireAdmin(req);
    return this.topup.saveSettings(dto as any);
  }
}
