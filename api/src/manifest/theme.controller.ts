import { Controller, Get, Logger } from '@nestjs/common';

interface PanelThemeColors {
  light: Record<string, string>;
  dark: Record<string, string>;
}

const CACHE_TTL_MS = 60_000;

/**
 * Relaie le thème custom (couleurs) du panel UHQ Panel OS — appelé côté
 * serveur (pas directement par le navigateur) pour fonctionner à la fois :
 *   - embarqué (proxifié sous /addon-proxy/wallet/, même origine que le
 *     panel — mais le fetch reste ici pour un point d'entrée UNIQUE, pas
 *     de logique dupliquée selon le mode de déploiement) ;
 *   - en déploiement externe (autre domaine — un fetch direct depuis le
 *     navigateur se heurterait à CORS, celui-ci est serveur-à-serveur).
 * Mis en cache brièvement pour ne pas taper le panel à chaque chargement de page.
 */
@Controller('api/theme')
export class ThemeController {
  private readonly logger = new Logger(ThemeController.name);
  private cache: { data: PanelThemeColors | null; fetchedAt: number } | null = null;

  @Get()
  async getTheme(): Promise<{ themeColors: PanelThemeColors | null }> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return { themeColors: this.cache.data };
    }
    const panelUrl = (process.env.PANEL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${panelUrl}/api/panel/setup/status`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      const themeColors: PanelThemeColors | null = json?.themeColors ?? null;
      this.cache = { data: themeColors, fetchedAt: Date.now() };
      return { themeColors };
    } catch (err: any) {
      this.logger.warn(`Impossible de récupérer le thème du panel (${panelUrl}) : ${err?.message ?? err}`);
      // Fail-open : l'addon retombe sur sa palette par défaut côté front.
      this.cache = { data: null, fetchedAt: Date.now() };
      return { themeColors: null };
    }
  }
}
