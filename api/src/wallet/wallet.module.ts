import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { StoreService } from './store.service';
import { PanelAuthService } from '../auth/panel-auth.service';
import { TopupController } from './topup.controller';
import { TopupService } from './topup.service';
import { PeersClient } from './peers.client';

@Module({
  controllers: [WalletController, TopupController],
  providers: [WalletService, StoreService, PanelAuthService, TopupService, PeersClient],
  exports: [StoreService, PanelAuthService],
})
export class WalletModule {}
