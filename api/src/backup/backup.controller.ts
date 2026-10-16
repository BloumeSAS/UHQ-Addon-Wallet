import { Controller, Get, Post, Body, Headers, Logger } from '@nestjs/common';
import { StoreService } from '../wallet/store.service';
import { PanelAuthService } from '../auth/panel-auth.service';

/**
 * Backup Controller — intégration avec le système de backup du panel UHQ.
 *
 * Le panel appelle ces endpoints lors de ses sauvegardes/restaurations.
 * Auth : header X-Panel-Key contenant la clé API du panel (comparaison à temps constant ; REFUSÉ si la clé n'est pas configurée).
 *
 * Déclaré dans uhq-manifest.json :
 *   "backup": {
 *     "exportEndpoint":  "/api/backup/export",
 *     "importEndpoint":  "/api/backup/import",
 *     "authHeader":      "X-Panel-Key"
 *   }
 */
@Controller('api/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(
    private readonly store: StoreService,
    private readonly auth: PanelAuthService,
  ) {}

  /** GET /api/backup/export — toutes les données du wallet (wallets + transactions). */
  @Get('export')
  export(@Headers('x-panel-key') key: string) {
    this.auth.requirePanelKey(key);
    const data = {
      wallets:      Object.values(this.store.wallets),
      transactions: this.store.transactions,
      exportedAt:   new Date().toISOString(),
    };
    this.logger.log(`Backup export: ${data.wallets.length} wallets, ${data.transactions.length} transactions`);
    return data;
  }

  /** POST /api/backup/import — restaure les données du wallet depuis un backup. */
  @Post('import')
  import(
    @Headers('x-panel-key') key: string,
    @Body() body: { wallets?: any[]; transactions?: any[] },
  ) {
    this.auth.requirePanelKey(key);

    const wallets: Record<string, any> = {};
    for (const w of Array.isArray(body?.wallets) ? body.wallets : []) {
      if (w && typeof w.user_id === 'string') wallets[w.user_id] = w;
    }

    this.store.restoreData({
      wallets,
      transactions: Array.isArray(body?.transactions) ? body.transactions : [],
    });

    this.logger.log(
      `Backup import: ${Object.keys(wallets).length} wallets, ${(Array.isArray(body?.transactions) ? body.transactions : []).length} transactions`,
    );

    return { success: true, restored: Object.keys(wallets).length };
  }
}
