/**
 * Widget compact (100 px) affiché sur le Dashboard du panel.
 * Manifeste : { "zone": "/", "path": "/widget/dashboard", "height": 100 }
 */
import { useEffect, useState } from 'react';
import { useAddon } from '../context';
import { useT, fmt } from '../i18n';
import { createApi } from '../lib/api';

interface Wallet { balance: number; currency: string; }

export default function DashboardWidget() {
  const { token, lang } = useAddon();
  const t   = useT();
  const api = createApi(token);

  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    if (!token) return;
    api.get<{ wallets: Wallet[] }>('wallet/all')
      .then(d => setWallets(d.wallets))
      .catch(() => {/* ignore : l'utilisateur n'est peut-être pas admin */});
  }, [token]);

  if (!wallets.length) return null;

  const total    = wallets.reduce((s, w) => s + w.balance, 0);
  const active   = wallets.filter(w => w.balance > 0).length;
  const avg      = active ? total / active : 0;
  const currency = wallets[0]?.currency ?? 'EUR';

  const stats = [
    { label: t('total'),          value: fmt(total,  currency, lang) },
    { label: t('activeAccounts'), value: String(active) },
    { label: t('avgBalance'),     value: fmt(avg, currency, lang) },
  ];

  return (
    <div className="grid-3 widget" style={{ height: '100%', alignItems: 'stretch' }}>
      {stats.map(s => (
        <div key={s.label} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{s.value}</div>
          <div className="stat-sub">Wallet addon</div>
        </div>
      ))}
    </div>
  );
}
