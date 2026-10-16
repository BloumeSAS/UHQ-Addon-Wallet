import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { copyText } from '../lib/format';
import { Icon, IconName } from './icons';

export function Card({ title, right, children, className = '', flush = false }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`}>
      {(title || right) && (
        <header className="card-head">
          <h3 className="card-title">{title}</h3>
          {right && <div className="row">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'primary' }) {
  return (
    <div className="card card-sm">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ tone = 'muted', children, title, icon }: { tone?: 'muted' | 'good' | 'bad' | 'warn' | 'info' | 'primary'; children: ReactNode; title?: string; icon?: IconName }) {
  return (
    <span className={`badge ${tone === 'muted' ? '' : `badge-${tone}`}`} title={title}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

/** Squelette de page (chargement initial) : évite le saut de mise en page d'un simple « Chargement… ». */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true">
      <div className="stat-grid">
        {[0, 1, 2].map((i) => <div key={i} className="card card-sm"><Skeleton height={10} width="45%" /><div style={{ height: 10 }} /><Skeleton height={24} width="70%" /></div>)}
      </div>
      <div className="card stack-sm">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} height={34} />)}</div>
    </div>
  );
}

export function Empty({ icon = 'info', title, text, action }: { icon?: IconName; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={24} /></div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; icon?: IconName }) {
  const def: Record<string, IconName> = { info: 'info', warn: 'alert', error: 'alert', success: 'check' };
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon ?? def[tone]} size={16} />
      <div className="grow">{children}</div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="alert alert-error row-between" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn btn-outline btn-sm" onClick={onRetry}>{t('ui.retry')}</button>}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label?: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="slider" />
    </label>
  );
}

export function Seg<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`seg-btn ${o.id === value ? 'active' : ''}`} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: IconName; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={tab.id === value} className={`tab ${tab.id === value ? 'active' : ''}`} onClick={() => onChange(tab.id)}>
          {tab.icon && <Icon name={tab.icon} size={15} />}
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="input-affix" style={{ minWidth: 200, flex: '1 1 220px' }}>
      <span className="affix"><Icon name="search" size={15} /></span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/** Fenêtre modale : Échap / clic sur le fond = fermer (sauf `busy`). Le focus est rendu au déclencheur à la fermeture. */
export function Modal({
  title, children, footer, onClose, busy = false, size = 'md', drawer = false,
}: { title: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean; size?: 'md' | 'lg'; drawer?: boolean }) {
  const t = useT();
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    prev.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (prev.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose, busy]);

  const inner = (
    <>
      <div className="modal-head">
        <h3>{title}</h3>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} disabled={busy} aria-label={t('ui.close')}><Icon name="x" /></button>
      </div>
      <div className="modal-body" style={drawer ? { flex: 1 } : undefined}>{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </>
  );
  if (drawer) {
    return (
      <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
        <aside className="drawer" role="dialog" aria-modal="true">{inner}</aside>
      </div>
    );
  }
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true">{inner}</div>
    </div>
  );
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

/** Remplace `window.confirm()` (bloqué dans certaines iframes) : `confirm(opts)` est async ; rendre `element` une fois dans le JSX. */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const t = useT();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);
  const settle = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };

  const element = opts && (
    <Modal
      title={opts.title}
      onClose={() => settle(false)}
      footer={
        <>
          <button className="btn btn-outline" onClick={() => settle(false)}>{t('ui.cancel')}</button>
          <button className={`btn ${opts.tone === 'primary' ? 'btn-primary' : 'btn-danger-solid'}`} onClick={() => settle(true)} autoFocus>{opts.confirmLabel ?? t('ui.confirm')}</button>
        </>
      }
    >
      <div className="text-sm">{opts.message}</div>
    </Modal>
  );
  return [confirm, element];
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.floor(offset / limit) + 1);
  if (total <= limit) return null;
  return (
    <div className="pager">
      <span className="text-xs text-muted">{t('ui.pageOf', { page, pages, total })}</span>
      <div className="row gap-2">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}><Icon name="chevronLeft" size={14} />{t('ui.prev')}</button>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>{t('ui.next')}<Icon name="chevronRight" size={14} /></button>
      </div>
    </div>
  );
}

export function CopyButton({ text, label, small = true }: { text: string; label?: string; small?: boolean }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-outline ${small ? 'btn-sm' : ''}`}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      aria-label={label ?? t('ui.copy')}
    >
      <Icon name={done ? 'check' : 'copy'} size={13} />
      <span aria-live="polite">{done ? t('ui.copied') : (label ?? t('ui.copy'))}</span>
    </button>
  );
}
