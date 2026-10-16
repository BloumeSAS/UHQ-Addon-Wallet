/**
 * Widget compact (100 px) affiché sur le Dashboard du panel.
 * Manifeste : { "zone": "/", "path": "/widget/dashboard", "height": 100 }
 *  - Admin : total des soldes, comptes actifs, solde moyen.
 *  - Autre utilisateur : son propre solde.
 */
import { useAddon } from '../context';
import { useT } from '../i18n';
import { useFetch } from '../lib/api';
import { fmtMoney } from '../lib/format';

interface Wallet { balance: number; currency: string }

export default function DashboardWidget() {
  const { token, lang, role } = useAddon();
  const t = useT();
  const isAdmin = role === 'ADMIN';
  const all = useFetch<{ wallets: Wallet[] }>(token && isAdmin ? 'wallet/all' : null);
  const mine = useFetch<{ balance: number; currency: string }>(token && !isAdmin ? 'wallet/balance' : null);

  let stats: { label: string; value: string; sub: string }[] = [];
  if (isAdmin) {
    const wallets = all.data?.wallets ?? [];
    if (!wallets.length) return null;
    const total = wallets.reduce((s, w) => s + w.balance, 0);
    const active = wallets.filter((w) => w.balance > 0).length;
    const cur = wallets[0]?.currency ?? 'EUR';
    stats = [
      { label: t('total'), value: fmtMoney(total, cur, lang), sub: t('acrossAccounts', { n: wallets.length }) },
      { label: t('activeAccounts'), value: String(active), sub: t('withBalance') },
      { label: t('avgBalance'), value: fmtMoney(active ? total / active : 0, cur, lang), sub: t('avgBalanceSub') },
    ];
  } else {
    if (!mine.data) return null;
    stats = [{ label: t('myWallet'), value: fmtMoney(mine.data.balance, mine.data.currency, lang), sub: 'Wallet' }];
  }

  return (
    <div className="grid widget" style={{ height: '100%', alignItems: 'stretch', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
      {stats.map((s) => (
        <div key={s.label} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>{s.value}</div>
          <div className="stat-sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
