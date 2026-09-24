import { useCallback, useRef, useState } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
}

/**
 * Remplace `window.confirm()` par une modale cohérente avec le thème de
 * l'addon. `confirm(opts)` est async, comme un `window.confirm()` ;
 * `modalElement` doit être rendu une fois dans le JSX du composant appelant.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    setOpts(null);
  };

  const modal = opts && (
    <div className="modal-overlay" onClick={() => settle(false)}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="modal-header">
          <span className="text-bold">{opts.title}</span>
          <button type="button" className="modal-close" onClick={() => settle(false)} aria-label="Annuler">✕</button>
        </div>
        <p className="text-sm" style={{ marginBottom: '1rem' }}>{opts.message}</p>
        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={() => settle(false)}>Annuler</button>
          <button type="button" className="btn btn-danger" onClick={() => settle(true)}>Confirmer</button>
        </div>
      </div>
    </div>
  );

  return [confirm, modal];
}
