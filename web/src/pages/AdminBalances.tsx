import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAddon } from '../context';
import { useT, fmt } from '../i18n';
import { createApi } from '../lib/api';

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  email?: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
}

/** Petit graphique en barres horizontales sans dépendance — top comptes par solde. */
function TopAccountsChart({ wallets, lang }: { wallets: Wallet[]; lang: string }) {
  const top = [...wallets].filter((w) => w.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);
  if (top.length === 0) return null;
  const max = Math.max(...top.map((w) => w.balance));
  return (
    <div className="space-y-2">
      {top.map((w) => (
        <div key={w.user_id} className="flex items-center gap-2">
          <span className="text-sm mono truncate" style={{ width: 160, flexShrink: 0 }} title={w.email || w.user_id}>
            {w.email || `${w.user_id.slice(0, 12)}…`}
          </span>
          <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(4, (w.balance / max) * 100)}%`,
                height: '100%',
                background: 'var(--primary)',
                borderRadius: 4,
              }}
            />
          </div>
          <span className="text-sm text-bold" style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
            {fmt(w.balance, w.currency, lang)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminBalances() {
  const { token, role, lang } = useAddon();
  const t = useT();
  const api = useMemo(() => createApi(token), [token]);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  // Formulaire credit/débit
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sign, setSign]         = useState<1 | -1>(1);
  const [amount, setAmount]     = useState('');
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  // Historique par compte
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [txs, setTxs]             = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set());

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
    setAmount(''); setNote('');
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!activeId || isNaN(amt) || amt <= 0) return;
    setSaving(true);
    try {
      const res = await api.post<{ balance: number }>('wallet/add', {
        userId: activeId,
        amount: sign * amt,
        note: note || undefined,
      });
      toast.success(`${t('updated')} — ${fmt(res.balance, 'EUR', lang)}`);
      setActiveId(null);
      load();
      if (historyId === activeId) loadHistory(activeId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = (userId: string) => {
    setTxLoading(true);
    setSelectedTx(new Set());
    api.get<{ transactions: Transaction[] }>(`wallet/transactions?userId=${encodeURIComponent(userId)}`)
      .then((d) => setTxs(d.transactions))
      .catch((e) => toast.error(e.message))
      .finally(() => setTxLoading(false));
  };

  const toggleHistory = (userId: string) => {
    if (historyId === userId) { setHistoryId(null); return; }
    setHistoryId(userId);
    loadHistory(userId);
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTx((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedTx((s) => (s.size === txs.length ? new Set() : new Set(txs.map((tx) => tx.id))));
  };

  const deleteTx = async (id: string) => {
    if (!window.confirm(t('confirmDeleteTx'))) return;
    try {
      await api.post('wallet/transactions/delete', { ids: [id] });
      setTxs((prev) => prev.filter((tx) => tx.id !== id));
      setSelectedTx((s) => { const n = new Set(s); n.delete(id); return n; });
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteSelected = async () => {
    if (selectedTx.size === 0) return;
    if (!window.confirm(t('confirmBulkDelete').replace('{count}', String(selectedTx.size)))) return;
    try {
      const ids = Array.from(selectedTx);
      await api.post('wallet/transactions/delete', { ids });
      setTxs((prev) => prev.filter((tx) => !selectedTx.has(tx.id)));
      setSelectedTx(new Set());
    } catch (e: any) { toast.error(e.message); }
  };

  const clearAllHistory = async (userId: string) => {
    if (!window.confirm(t('confirmClearHistory'))) return;
    try {
      await api.post('wallet/transactions/clear', { userId });
      setTxs([]);
      setSelectedTx(new Set());
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = wallets.filter((w) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return w.user_id.toLowerCase().includes(q) || (w.email ?? '').toLowerCase().includes(q);
  });

  const activeCount = wallets.filter((w) => w.balance > 0).length;
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const avgBalance = wallets.length > 0 ? totalBalance / wallets.length : 0;
  const currency = wallets[0]?.currency ?? 'EUR';

  if (!token) return <div className="page"><div className="empty">{t('noToken')}</div></div>;
  if (role !== 'ADMIN') return <div className="page"><div className="empty">{t('noAdmin')}</div></div>;
  if (loading) return <div className="page"><div className="loading">{t('loading')}</div></div>;
  if (error)   return <div className="page"><div className="alert alert-error">{error}</div></div>;

  return (
    <div className="page space-y-4">
      <div className="section-title">{t('allBalances')}</div>

      {/* Stats */}
      <div className="grid-3">
        <div className="card card-sm">
          <div className="stat-label">{t('total')}</div>
          <div className="text-bold" style={{ fontSize: '1.2rem' }}>{fmt(totalBalance, currency, lang)}</div>
        </div>
        <div className="card card-sm">
          <div className="stat-label">{t('activeAccounts')}</div>
          <div className="text-bold" style={{ fontSize: '1.2rem' }}>{activeCount} / {wallets.length}</div>
        </div>
        <div className="card card-sm">
          <div className="stat-label">{t('avgBalance')}</div>
          <div className="text-bold" style={{ fontSize: '1.2rem' }}>{fmt(avgBalance, currency, lang)}</div>
        </div>
      </div>

      {/* Top comptes */}
      {activeCount > 0 && (
        <div className="card">
          <div className="text-bold mb-3">{t('topAccounts')}</div>
          <TopAccountsChart wallets={wallets} lang={lang} />
        </div>
      )}

      {/* Recherche */}
      <input
        className="input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
      />

      {/* Formulaire (s'ouvre sous la ligne concernée) */}
      {activeId && (
        <div className="card card-sm" style={{ background: 'var(--bg2)' }}>
          <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
            <span className={`text-bold ${sign > 0 ? 'text-green' : 'text-red'}`}>
              {sign > 0 ? `+ ${t('credit')}` : `− ${t('debit')}`}
            </span>
            <span className="mono truncate" style={{ maxWidth: 200 }}>
              {wallets.find((w) => w.user_id === activeId)?.email || activeId}
            </span>
          </div>
          <div className="form-row mt-2">
            <div style={{ flex: 1, minWidth: 80 }}>
              <label className="label-text" htmlFor="wallet-amount">{t('amount')}</label>
              <input
                id="wallet-amount"
                className="input"
                type="number" min="0.01" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div style={{ flex: 2, minWidth: 120 }}>
              <label className="label-text" htmlFor="wallet-note">{t('note')}</label>
              <input
                id="wallet-note"
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
        {filtered.length === 0 ? (
          <div className="empty">{search ? t('noResults') : t('noData')}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('email')}</th>
                  <th>{t('userId')}</th>
                  <th>{t('balance')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <Fragment key={w.user_id}>
                    <tr style={{ background: activeId === w.user_id ? 'var(--bg2)' : undefined }}>
                      <td className="text-sm">{w.email || <span className="text-muted">—</span>}</td>
                      <td><span className="mono truncate" style={{ maxWidth: 160, display: 'inline-block' }}>{w.user_id}</span></td>
                      <td>
                        <span className={`text-bold ${w.balance > 0 ? 'text-green' : 'text-muted'}`}>
                          {fmt(w.balance, w.currency, lang)}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-success" onClick={() => openForm(w.user_id, 1)} aria-label={`${t('credit')} ${w.email || w.user_id}`}>+</button>
                          <button className="btn btn-sm btn-danger"  onClick={() => openForm(w.user_id, -1)} aria-label={`${t('debit')} ${w.email || w.user_id}`}>−</button>
                          <button className="btn btn-sm btn-outline" onClick={() => toggleHistory(w.user_id)}>
                            {historyId === w.user_id ? t('hideHistory') : t('viewHistory')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {historyId === w.user_id && (
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--bg2)', padding: '0.75rem' }}>
                          <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span className="text-bold text-sm">{t('history')}</span>
                            <div className="flex gap-1">
                              <button className="btn btn-sm btn-outline" onClick={toggleSelectAll} disabled={txs.length === 0}>
                                {t('selectAll')}
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={deleteSelected} disabled={selectedTx.size === 0}>
                                {t('deleteSelected')} {selectedTx.size > 0 ? `(${selectedTx.size})` : ''}
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => clearAllHistory(w.user_id)} disabled={txs.length === 0}>
                                {t('clearHistory')}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-muted mb-2">{t('historyNote')}</p>
                          {txLoading ? (
                            <div className="loading">{t('loading')}</div>
                          ) : txs.length === 0 ? (
                            <div className="empty">{t('noTx')}</div>
                          ) : (
                            <div className="table-wrap">
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th style={{ width: 24 }}></th>
                                    <th>{t('amount')}</th>
                                    <th>{t('note')}</th>
                                    <th>{t('by')}</th>
                                    <th>{t('date')}</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {txs.map((tx) => (
                                    <tr key={tx.id}>
                                      <td>
                                        <input
                                          type="checkbox"
                                          checked={selectedTx.has(tx.id)}
                                          onChange={() => toggleSelectTx(tx.id)}
                                          aria-label={`${t('deleteTx')} ${tx.id}`}
                                        />
                                      </td>
                                      <td className={`text-bold ${tx.amount >= 0 ? 'text-green' : 'text-red'}`}>
                                        {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount, w.currency, lang)}
                                      </td>
                                      <td className="text-muted text-sm">{tx.note ?? '—'}</td>
                                      <td className="mono text-sm">{tx.created_by}</td>
                                      <td className="mono text-sm">{new Date(tx.created_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td>
                                      <td>
                                        <button className="btn btn-sm btn-danger" onClick={() => deleteTx(tx.id)} aria-label={t('deleteTx')}>
                                          {t('deleteTx')}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
