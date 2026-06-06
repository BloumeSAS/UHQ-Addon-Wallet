import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import * as fs from 'fs';
import { WalletModule } from './wallet/wallet.module';
import { ManifestController } from './manifest/manifest.controller';
import { BackupController } from './backup/backup.controller';

/** Résout le chemin du build React (web/dist) depuis n'importe où. */
function resolveWebDist(): string {
  // api/dist/main.js  →  ../../web/dist
  // api/src/main.ts   →  ../../web/dist  (ts-node, même profondeur)
  const candidate = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(candidate)) return candidate;
  // Fallback : chemin absolu depuis cwd
  return path.join(process.cwd(), '..', 'web', 'dist');
}

@Module({
  imports: [
    // Sert le build React (SPA fallback vers index.html)
    ServeStaticModule.forRoot({
      rootPath: resolveWebDist(),
      exclude: ['/api/(.*)'],
      serveStaticOptions: { index: false }, // pas de double fallback
    }),
    WalletModule,
  ],
  controllers: [ManifestController, BackupController],
})
export class AppModule {}
