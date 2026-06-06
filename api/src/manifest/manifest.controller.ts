import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';

/**
 * Sert /uhq-manifest.json depuis la racine de l'addon.
 * Ce fichier est lu par le panel UHQ lors de la connexion d'un addon.
 */
@Controller()
export class ManifestController {
  @Get('uhq-manifest.json')
  getManifest(@Res() res: Response) {
    // api/src/manifest/ → ../../../uhq-manifest.json (racine de l'addon)
    // dist/manifest/ → dist/ → api/ → wallet/ → uhq-manifest.json
    const manifestPath = path.resolve(__dirname, '..', '..', '..', 'uhq-manifest.json');
    res.sendFile(manifestPath);
  }
}
