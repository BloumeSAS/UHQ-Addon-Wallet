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

export default function AdminBalances() {
  const { token, role, lang } = useAddon();
  const t = useT();
  const api = createApi(token);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Formulaire credit/débit
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sign, setSign]         = useState<1 | -1>(1);
  const [amount, setAmount]     = useState('');
  const [note, setNote]         = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get<{ wallets: Wallet[] }>('wallet/all')
      .then(d => setWallets(d.wallets))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token || role !== 'ADMIN') { setLoading(false); return; }
    load();
  }, [token, role]);

  const openForm = (userId: string, s: 1 | -1) => {
    setActiveId(userId); setSign(s);
    setAmount(''); setNote(''); setFeedback(null);
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!activeId || isNaN(amt) || amt <= 0) return;
    setSaving(true); setFeedback(null);
    try {
      const res = await api.post<{ balance: number }>('wallet/add', {
        userId: activeId,
        amount: sign * amt,
        note: note || undefined,
      });
      setFeedback({ type: 'ok', msg: `${t('updated')} — ${fmt(res.balance, 'EUR', lang)}` });
      setActiveId(null);
      load();
    } catch (e: any) {
      setFeedback({ type: 'err', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <div className="page"><div className="empty">{t('noToken')}</div></div>;
  if (role !== 'ADMIN') return <div className="page"><div className="empty">{t('noAdmin')}</div></div>;
  if (loading) return <div className="page"><div className="loading">{t('loading')}</div></div>;
  if (error)   return <div className="page"><div className="alert alert-error">{error}</div></div>;

  return (
    <div className="page">
      <div className="section-title">{t('allBalances')}</div>

      {feedback && (
        <div className={`alert alert-${feedback.type === 'ok' ? 'success' : 'error'} mb-3`}>
          {feedback.msg}
        </div>
      )}

      {/* Formulaire (s'ouvre sous la ligne concernée) */}
      {activeId && (
        <div className="card card-sm mb-3" style={{ background: 'var(--bg2)' }}>
          <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
            <span className={`text-bold ${sign > 0 ? 'text-green' : 'text-red'}`}>
              {sign > 0 ? `+ ${t('credit')}` : `− ${t('debit')}`}
            </span>
            <span className="mono truncate" style={{ maxWidth: 200 }}>{activeId}</span>
          </div>
          <div className="form-row mt-2">
            <div style={{ flex: 1, minWidth: 80 }}>
              <label className="label-text">{t('amount')}</label>
              <input
                className="input"
                type="number" min="0.01" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div style={{ flex: 2, minWidth: 120 }}>
              <label className="label-text">{t('note')}</label>
              <input
                className="input"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Raison optionnelle"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? '…' : t('save')}
              </button>
              <button className="btn btn-outline" onClick={() => setActiveId(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {wallets.length === 0 ? (
          <div className="empty">{t('noData')}</div>
        ) : (
          <div className="table-wrap">
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
                  <tr key={w.id} style={{ background: activeId === w.user_id ? 'var(--bg2)' : undefined }}>
                    <td><span className="mono truncate">{w.user_id}</span></td>
                    <td>
                      <span className={`text-bold ${w.balance > 0 ? 'text-green' : 'text-muted'}`}>
                        {fmt(w.balance, w.currency, lang)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-success" onClick={() => openForm(w.user_id, 1)}>+</button>
                        <button className="btn btn-sm btn-danger"  onClick={() => openForm(w.user_id, -1)}>−</button>
                      </div>
                    </td>
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
