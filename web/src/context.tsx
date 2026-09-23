import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface AddonCtx {
  token: string;
  lang:  'fr' | 'en';
  theme: 'dark' | 'light';
  role:  string;
}

const AddonContext = createContext<AddonCtx>({
  token: '',
  lang:  'fr',
  theme: 'dark',
  role:  'USER',
});

/**
 * Mappe les variables du panel (format brut "H S% L%", cf. tailwind/shadcn —
 * voir web/src/pages/admin/Settings.tsx DEFAULT_THEME côté panel) vers les
 * variables de CE addon (format "hsl(H, S%, L%)", utilisées telles quelles
 * comme couleur dans index.css). Seules les variables ayant un équivalent
 * sémantique ici sont reprises — pas de vert/ambre côté panel (pas de
 * notion de succès/avertissement dans son système de couleurs).
 */
const PANEL_TO_ADDON_VAR: Record<string, string> = {
  background: 'bg',
  foreground: 'fg',
  muted: 'bg2',
  'muted-foreground': 'fg2',
  border: 'border',
  primary: 'primary',
  destructive: 'red',
};

function toHsl(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 3) return raw;
  const [h, s, l] = parts;
  return `hsl(${h}, ${s}, ${l})`;
}

/**
 * Va chercher le thème custom du panel (couleurs personnalisées depuis
 * Paramètres → Thème) via l'API de CET addon (jamais directement le panel
 * depuis le navigateur — CORS en déploiement externe, cf. theme.controller.ts
 * côté API) et injecte les variables CSS correspondantes. Sans thème custom
 * (palette par défaut du panel) ou en cas d'échec réseau, ne touche à rien —
 * la palette tangerine codée en dur dans index.css reste le repli.
 */
function applyPanelTheme(mode: 'light' | 'dark') {
  fetch('/api/theme')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { themeColors: { light: Record<string, string>; dark: Record<string, string> } | null } | null) => {
      const colors = data?.themeColors?.[mode];
      if (!colors) return;
      const root = document.documentElement.style;
      for (const [panelKey, addonKey] of Object.entries(PANEL_TO_ADDON_VAR)) {
        const value = colors[panelKey];
        if (value) root.setProperty(`--${addonKey}`, toHsl(value));
      }
    })
    .catch(() => {
      // Silencieux — repli sur la palette par défaut, pas d'erreur visible
      // pour un simple habillage cosmétique.
    });
}

export function AddonProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();

  const ctx: AddonCtx = {
    token: params.get('token') ?? '',
    lang:  (params.get('lang')  ?? 'fr') as 'fr' | 'en',
    theme: (params.get('theme') ?? 'dark') as 'dark' | 'light',
    role:  params.get('role')  ?? 'USER',
  };

  // Applique le thème sur <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', ctx.theme);
    applyPanelTheme(ctx.theme);
  }, [ctx.theme]);

  return (
    <AddonContext.Provider value={ctx}>
      {children}
    </AddonContext.Provider>
  );
}

export const useAddon = () => useContext(AddonContext);
