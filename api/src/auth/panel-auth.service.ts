import { ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export interface AuthUser {
  /** Identifiant du compte panel (PanelUser.id). */
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPPORT' | 'USER' | string;
  /** Jeton d'origine : sert à rappeler le panel AU NOM de l'utilisateur (liste des comptes, etc.). */
  token: string;
}

/**
 * Authentification des appels : le jeton est VÉRIFIÉ PAR LE PANEL (`/api/panel/security/me` contrôle la signature
 * et l'expiration), jamais simplement décodé ici. Un jeton forgé (`{"role":"ADMIN"}` non signé) est donc refusé.
 * Résultat mémorisé 30 s (clé = empreinte du jeton COMPLET). Jeton lu UNIQUEMENT dans l'en-tête Authorization
 * (jamais en query string : une URL finit dans les journaux). Si le panel est injoignable : 503 (jamais « on laisse passer »).
 */
@Injectable()
export class PanelAuthService {
  private readonly logger = new Logger(PanelAuthService.name);
  private readonly cache = new Map<string, { at: number; user: Omit<AuthUser, 'token'> }>();

  get panelUrl(): string {
    return (process.env.PANEL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
  }

  async authenticate(req: Request): Promise<AuthUser> {
    const header = String(req.headers['authorization'] ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Token manquant');

    const key = createHash('sha256').update(token).digest('hex');
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return { ...hit.user, token };

    let res: Response;
    try {
      res = await fetch(`${this.panelUrl}/api/panel/security/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
    } catch (e: any) {
      this.logger.warn(`Panel injoignable pour vérifier le jeton : ${e?.message ?? e}`);
      throw new ServiceUnavailableException('Panel injoignable');
    }
    if (res.status === 401 || res.status === 403) throw new UnauthorizedException('Token invalide ou expiré');
    if (!res.ok) throw new ServiceUnavailableException('Panel indisponible');

    const body: any = await res.json().catch(() => ({}));
    const u = body?.data;
    if (!u?.id) throw new UnauthorizedException('Token invalide ou expiré');

    const user = { id: String(u.id), email: String(u.email ?? ''), role: String(u.role ?? 'USER') };
    this.cache.set(key, { at: Date.now(), user });
    if (this.cache.size > 300) {
      const cutoff = Date.now() - 30_000;
      for (const [k, v] of this.cache) if (v.at < cutoff) this.cache.delete(k);
    }
    return { ...user, token };
  }

  async requireAdmin(req: Request): Promise<AuthUser> {
    const user = await this.authenticate(req);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Accès refusé');
    return user;
  }

  /**
   * Clé API du panel (`X-Panel-Key`) pour les appels entre addons et la sauvegarde. REFUSE tout si la clé n'est pas
   * configurée (avant : « autorisé en dev » — un déploiement sans clé laissait tout ouvert) ; comparaison à temps constant.
   */
  requirePanelKey(key: string | undefined): void {
    const expected = process.env.PANEL_API_KEY ?? '';
    const a = Buffer.from(String(key ?? ''));
    const b = Buffer.from(expected);
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('Clé API invalide');
  }

  /** Comptes du panel (id + e-mail), lus avec le jeton d'un ADMIN. Vide si le panel ne répond pas. */
  async listPanelUsers(adminToken: string): Promise<{ id: string; email: string }[]> {
    try {
      const res = await fetch(`${this.panelUrl}/api/panel/users`, {
        headers: { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      return (json?.data ?? []).filter((u: any) => u?.id).map((u: any) => ({ id: String(u.id), email: String(u.email ?? '') }));
    } catch (err: any) {
      this.logger.warn(`Liste des comptes du panel indisponible : ${err?.message ?? err}`);
      return [];
    }
  }
}
