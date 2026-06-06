import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  providers: [StoreService, WalletService],
  controllers: [WalletController],
  exports: [StoreService],
})
export class WalletModule {}
