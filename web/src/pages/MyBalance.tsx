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
