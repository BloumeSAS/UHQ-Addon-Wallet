import { useEffect, useState } from 'react';
import { useAddon } from '../context';
import { useT, fmt } from '../i18n';
import { createApi } from '../lib/api';

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

/**
 * Ligne d'évolution du solde à partir de l'historique (SVG inline, sans lib).
 * `txs` est trié du plus récent au plus ancien (comme renvoyé par l'API) —
 * on reconstruit le solde cumulé en remontant depuis le solde actuel.
 */
function BalanceChart({ wallet, txs }: { wallet: Wallet; txs: Transaction[] }) {
  if (txs.length < 2) return null;
  const chronological = [...txs].reverse(); // plus ancien → plus récent
  let running = wallet.balance;
  const points: number[] = [running];
  for (let i = chronological.length - 1; i >= 0; i--) {
    running -= chronological[i].amount;
    points.unshift(running);
  }
  const w = 600, h = 120, pad = 8;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0.01);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const areaPath = `M${pad},${h - pad} L${coords.join(' L')} L${pad + (points.length - 1) * step},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 120 }} preserveAspectRatio="none">
      <path d={areaPath} fill="var(--primary)" opacity={0.12} />
      <polyline points={coords.join(' ')} fill="none" stroke="var(--primary)" strokeWidth={2} />
    </svg>
  );
}

export default function MyBalance() {
  const { token, lang } = useAddon();
  const t = useT();
  const api = createApi(token);

  const [wallet, setWallet]  = useState<Wallet | null>(null);
  const [txs, setTxs]        = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get<{ wallet: Wallet; transactions: Transaction[] }>('wallet')
      .then(({ wallet, transactions }) => {
        setWallet(wallet);
        setTxs(transactions);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return <div className="page"><div className="empty">{t('noToken')}</div></div>;
  if (loading) return <div className="page"><div className="loading">{t('loading')}</div></div>;
  if (error)   return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!wallet) return null;

  return (
    <div className="page">
      {/* Hero solde */}
      <div className="card mb-4" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div className="stat-label" style={{ marginBottom: '.5rem' }}>{t('balance')}</div>
        <div className="balance-amount">
          {fmt(wallet.balance, wallet.currency, lang)}
        </div>
        <div className="text-muted text-xs mt-2">
          {t('currency')} : {wallet.currency}
        </div>
      </div>

      {/* Évolution du solde */}
      {txs.length >= 2 && (
        <div className="card mb-4">
          <div className="stat-label mb-2">{t('balanceOverTime')}</div>
          <BalanceChart wallet={wallet} txs={txs} />
        </div>
      )}

      {/* Historique */}
      <div className="section-title">{t('transactions')}</div>
      <div className="card" style={{ padding: 0 }}>
        {txs.length === 0 ? (
          <div className="empty">{t('noTx')}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('amount')}</th>
                  <th>{t('note')}</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => (
                  <tr key={tx.id}>
                    <td className={`text-bold ${tx.amount >= 0 ? 'text-green' : 'text-red'}`}>
                      {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount, wallet.currency, lang)}
                    </td>
                    <td className="text-muted">{tx.note ?? '—'}</td>
                    <td className="mono">{new Date(tx.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
