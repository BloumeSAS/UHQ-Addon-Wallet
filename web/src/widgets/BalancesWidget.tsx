/**
 * Widget tableau (340 px) affiché sur la page SubUsers du panel.
 * Manifeste : { "zone": "/subusers", "path": "/widget/balances", "height": 340 }
 */
import { useEffect, useState } from 'react';
import { useAddon } from '../context';
import { useT, fmt } from '../i18n';
import { createApi } from '../lib/api';

interface Wallet { id: string; user_id: string; balance: number; currency: string; }

export default function BalancesWidget() {
  const { token, role, lang } = useAddon();
  const t   = useT();
  const api = createApi(token);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire inline
  const [form, setForm] = useState<{ userId: string; sign: 1 | -1 } | null>(null);
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = () => {
    api.get<{ wallets: Wallet[] }>('wallet/all')
      .then(d => setWallets(d.wallets))
      .catch(() => setWallets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token || role !== 'ADMIN') { setLoading(false); return; }
    load();
  }, [token, role]);

  const submit = async () => {
    if (!form) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    try {
      await api.post('wallet/add', { userId: form.userId, amount: form.sign * amt, note: note || undefined });
      setMsg({ type: 'ok', text: t('updated') });
      setForm(null); setAmount(''); setNote('');
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  if (!token || role !== 'ADMIN') {
    return <div className="widget"><div className="empty text-xs">{t('noAdmin')}</div></div>;
  }
  if (loading) return <div className="widget"><div className="loading text-xs">{t('loading')}</div></div>;

  return (
    <div className="widget" style={{ overflow: 'auto', maxHeight: 340 }}>
      <div className="stat-label mb-3">{t('allBalances')}</div>

      {msg && (
        <div className={`alert alert-${msg.type === 'ok' ? 'success' : 'error'} mb-2`} style={{ fontSize: '0.75rem' }}>
          {msg.text}
        </div>
      )}

      {form && (
        <div className="card card-sm mb-2" style={{ background: 'var(--bg2)' }}>
          <div className="form-row">
            <input
              className="input" type="number" min="0.01" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={t('amount')} style={{ flex: 1, minWidth: 60 }}
              autoFocus
            />
            <input
              className="input" value={note} onChange={e => setNote(e.target.value)}
              placeholder={t('note')} style={{ flex: 2, minWidth: 80 }}
            />
            <button className="btn btn-sm btn-primary" onClick={submit}>OK</button>
            <button className="btn btn-sm btn-ghost"   onClick={() => setForm(null)}>✕</button>
          </div>
        </div>
      )}

      {wallets.length === 0 ? (
        <div className="empty text-xs">{t('noData')}</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('userId')}</th>
              <th>{t('balance')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(w => (
              <tr key={w.id}>
                <td><span className="mono truncate">{w.user_id.slice(0, 12)}…</span></td>
                <td>
                  <span className={`text-bold ${w.balance > 0 ? 'text-green' : 'text-muted'}`}>
                    {fmt(w.balance, w.currency, lang)}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-sm btn-success" onClick={() => { setForm({ userId: w.user_id, sign: 1  }); setMsg(null); }}>+</button>
                    <button className="btn btn-sm btn-danger"  onClick={() => { setForm({ userId: w.user_id, sign: -1 }); setMsg(null); }}>−</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
