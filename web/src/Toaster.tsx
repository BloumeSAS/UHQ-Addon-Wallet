import { Toaster as Sonner } from 'sonner';

/**
 * Notifications (sonner) thémées sur les variables CSS de l'addon (index.css)
 * — pas de Tailwind ici, sonner expose ses propres CSS vars de theming.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      style={
        {
          '--success-bg': 'color-mix(in srgb, var(--green) 14%, var(--bg))',
          '--success-text': 'var(--green)',
          '--success-border': 'var(--border)',
          '--error-bg': 'color-mix(in srgb, var(--red) 14%, var(--bg))',
          '--error-text': 'var(--red)',
          '--error-border': 'var(--border)',
          '--normal-bg': 'var(--bg)',
          '--normal-text': 'var(--fg)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      toastOptions={{
        style: { borderRadius: 'var(--radius)' },
      }}
    />
  );
}
