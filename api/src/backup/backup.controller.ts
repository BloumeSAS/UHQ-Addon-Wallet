import {
  Controller, Get, Post, Body, Headers, ForbiddenException, Logger,
} from '@nestjs/common';
import { StoreService } from '../wallet/store.service';

/**
 * Backup Controller — intégration avec le système de backup du panel UHQ.
 *
 * Le panel appelle ces endpoints lors de ses sauvegardes/restaurations.
 * Auth : header X-Panel-Key contenant la clé API du panel.
 *
 * Déclarer dans uhq-manifest.json :
 *   "backup": {
 *     "exportEndpoint":  "/api/backup/export",
 *     "importEndpoint":  "/api/backup/import",
 *     "authHeader":      "X-Panel-Key"
 *   }
 */
@Controller('api/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly store: StoreService) {}

  private checkAuth(key: string | undefined) {
    const expected = process.env.PANEL_API_KEY;
    if (!expected) {
      this.logger.warn('PANEL_API_KEY non configuré — backup non protégé');
      return; // permissif si non configuré (dev)
    }
    if (key !== expected) throw new ForbiddenException('Clé API invalide');
  }

  /**
   * GET /api/backup/export
   * Retourne toutes les données du wallet (wallets + transactions).
   * Appelé par le panel lors d'un backup.
   */
  @Get('export')
  export(@Headers('x-panel-key') key: string) {
    this.checkAuth(key);
    const data = {
      wallets:      Object.values(this.store.wallets),
      transactions: this.store.transactions,
      exportedAt:   new Date().toISOString(),
    };
    this.logger.log(`Backup export: ${data.wallets.length} wallets, ${data.transactions.length} transactions`);
    return data;
  }

  /**
   * POST /api/backup/import
   * Restaure les données du wallet depuis un backup.
   * Appelé par le panel lors d'une restauration.
   */
  @Post('import')
  import(
    @Headers('x-panel-key') key: string,
    @Body() body: { wallets?: any[]; transactions?: any[] },
  ) {
    this.checkAuth(key);

    const wallets: Record<string, any> = {};
    for (const w of body.wallets ?? []) wallets[w.user_id] = w;

    this.store.restoreData({
      wallets,
      transactions: body.transactions ?? [],
    });

    this.logger.log(
      `Backup import: ${Object.keys(wallets).length} wallets, ${(body.transactions ?? []).length} transactions`,
    );

    return { success: true, restored: Object.keys(wallets).length };
  }
}
