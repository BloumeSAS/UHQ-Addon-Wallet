import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { StoreService } from './store.service';
import { PanelAuthService } from '../auth/panel-auth.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, StoreService, PanelAuthService],
  exports: [StoreService, PanelAuthService],
})
export class WalletModule {}
