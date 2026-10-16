import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { useApi, useDebounced, useFetch } from '../lib/api';
import { downloadFile, fmtDateTime, fmtMoney, initials, timeAgo, toCsv } from '../lib/format';
import { Icon } from '../components/icons';
import { SourceBadge, Tx, txTitle } from '../components/TxMeta';
import { Card, Empty, ErrorBox, Field, Modal, PageSkeleton, Pagination, SearchInput, Seg, Stat, useConfirm } from '../components/ui';

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  email?: string;
  updated_at: string;
}

const PAGE = 20;
type BalFilter = 'all' | 'funded' | 'empty';
type SortKey = 'balance' | 'email' | 'recent';

const label = (w: Pick<Wallet, 'email' | 'user_id'>) => w.email || w.user_id;

/** Page admin : indicateurs, classement, comptes (recherche / filtre / tri / pagination), crédit-débit et historique en fenêtres. */
export default function AdminBalances() {
  const { token, role, lang } = useAddon();
  const t = useT();
  const all = useFetch<{ wallets: Wallet[] }>(token && role === 'ADMIN' ? 'wallet/all' : null);

  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim().toLowerCase(), 200);
  const [bal, setBal] = useState<BalFilter>('all');
  const [sort, setSort] = useState<SortKey>('balance');
  const [offset, setOffset] = useState(0);
  const [adjust, setAdjust] = useState<{ wallet: Wallet; sign: 1 | -1 } | null>(null);
  const [history, setHistory] = useState<Wallet | null>(null);

  const wallets = all.data?.wallets ?? [];
  const cur = wallets[0]?.currency ?? 'EUR';

  const filtered = useMemo(() => {
    let list = wallets.filter((w) => {
      if (bal === 'funded' && !(w.balance > 0)) return false;
      if (bal === 'empty' && w.balance > 0) return false;
      if (!q) return true;
      return w.user_id.toLowerCase().includes(q) || (w.email ?? '').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) =>
      sort === 'email' ? label(a).localeCompare(label(b))
        : sort === 'recent' ? b.updated_at.localeCompare(a.updated_at)
          : b.balance - a.balance);
    return list;
  }, [wallets, bal, q, sort]);

  const funded = wallets.filter((w) => w.balance > 0);
  const total = wallets.reduce((s, w) => s + w.balance, 0);
  const top = [...funded].sort((a, b) => b.balance - a.balance).slice(0, 5);
  const topMax = top[0]?.balance ?? 1;

  const exportAccounts = () => {
    const rows: (string | number)[][] = [[t('email'), t('userId'), t('balance'), t('currency'), t('updated')]];
    for (const w of filtered) rows.push([w.email ?? '', w.user_id, w.balance, w.currency, w.updated_at]);
    downloadFile(`wallets-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  };

  if (!token) return <div className="page"><Empty icon="key" title={t('noToken')} text={t('noTokenText')} /></div>;
  if (role !== 'ADMIN') return <div className="page"><Empty icon="ban" title={t('noAdmin')} text={t('noAdminText')} /></div>;
  if (all.loading && !all.data) return <div className="page"><PageSkeleton /></div>;
  if (all.error && !all.data) return <div className="page"><ErrorBox message={all.error} onRetry={all.reload} /></div>;

  const paged = filtered.slice(offset, offset + PAGE);

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('allBalances')}</h1>
          <p className="page-sub">{t('allBalancesSub')}</p>
        </div>
        <div className="row">
          <button className="btn btn-outline btn-sm" onClick={exportAccounts} disabled={filtered.length === 0}><Icon name="download" size={14} />{t('exportCsv')}</button>
          <button className="btn btn-outline btn-sm" onClick={all.reload} disabled={all.loading}><Icon name="refresh" size={14} />{t('ui.refresh')}</button>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label={t('total')} value={fmtMoney(total, cur, lang)} sub={t('acrossAccounts', { n: wallets.length })} tone="primary" />
        <Stat label={t('activeAccounts')} value={`${funded.length} / ${wallets.length}`} sub={t('withBalance')} />
        <Stat label={t('avgBalance')} value={fmtMoney(funded.length ? total / funded.length : 0, cur, lang)} sub={t('avgBalanceSub')} />
        <Stat label={t('emptyAccounts')} value={wallets.length - funded.length} sub={t('emptyAccountsSub')} />
      </div>

      {top.length > 0 && (
        <Card title={t('topAccounts')}>
          <div className="stack-sm">
            {top.map((w) => (
              <div key={w.user_id} className="hbar">
                <span className="truncate" title={label(w)}>{label(w)}</span>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: `${Math.max(4, (w.balance / topMax) * 100)}%` }} /></div>
                <b className="num">{fmtMoney(w.balance, w.currency, lang)}</b>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card flush>
        <div className="card-head">
          <h3 className="card-title">{t('accounts')} <span className="text-muted text-sm">({filtered.length})</span></h3>
          <div className="row">
            <Seg<BalFilter>
              label={t('filter')}
              value={bal}
              onChange={(v) => { setBal(v); setOffset(0); }}
              options={[{ id: 'all', label: t('filterAll') }, { id: 'funded', label: t('filterFunded') }, { id: 'empty', label: t('filterEmpty') }]}
            />
            <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setOffset(0); }} aria-label={t('sortBy')}>
              <option value="balance">{t('sort.balance')}</option>
              <option value="email">{t('sort.email')}</option>
              <option value="recent">{t('sort.recent')}</option>
            </select>
          </div>
        </div>
        <div style={{ padding: '0 1.1rem 0.8rem' }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0); }} placeholder={t('search')} />
        </div>

        {filtered.length === 0 ? (
          <Empty
            icon={wallets.length === 0 ? 'users' : 'search'}
            title={wallets.length === 0 ? t('noAccounts') : t('noResults')}
            text={wallets.length === 0 ? t('noAccountsText') : t('noResultsText')}
            action={wallets.length > 0 ? <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setBal('all'); setOffset(0); }}>{t('resetFilters')}</button> : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>{t('account')}</th><th className="num">{t('balance')}</th><th>{t('lastActivity')}</th><th style={{ textAlign: 'right' }}>{t('actions')}</th></tr>
              </thead>
              <tbody>
                {paged.map((w) => (
                  <tr key={w.user_id}>
                    <td>
                      <div className="row gap-3" style={{ flexWrap: 'nowrap' }}>
                        <span className="avatar">{initials(label(w))}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="text-bold truncate" style={{ maxWidth: 260 }}>{w.email || <span className="text-muted">{t('noEmail')}</span>}</div>
                          <div className="mono text-muted truncate" style={{ maxWidth: 260 }}>{w.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num"><b className={w.balance > 0 ? 'text-green' : 'text-muted'}>{fmtMoney(w.balance, w.currency, lang)}</b></td>
                    <td className="text-muted text-sm" title={fmtDateTime(w.updated_at, lang)}>{w.id ? timeAgo(w.updated_at, lang) : '—'}</td>
                    <td>
                      <div className="row gap-1" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button className="btn btn-sm btn-success" onClick={() => setAdjust({ wallet: w, sign: 1 })} aria-label={`${t('credit')} ${label(w)}`}><Icon name="plus" size={13} />{t('credit')}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setAdjust({ wallet: w, sign: -1 })} disabled={!(w.balance > 0)} aria-label={`${t('debit')} ${label(w)}`}><Icon name="minus" size={13} />{t('debit')}</button>
                        <button className="btn btn-sm btn-outline" onClick={() => setHistory(w)} disabled={!w.id}><Icon name="history" size={13} />{t('history')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={filtered.length} limit={PAGE} offset={offset} onChange={setOffset} />
      </Card>

      {adjust && <AdjustModal wallet={adjust.wallet} initialSign={adjust.sign} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); all.reload(); }} />}
      {history && <HistoryModal wallet={history} onClose={() => setHistory(null)} onChanged={all.reload} />}
    </div>
  );
}

// ─── Crédit / débit ────────────────────────────────────────────────────────────

function AdjustModal({ wallet, initialSign, onClose, onDone }: { wallet: Wallet; initialSign: 1 | -1; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const { lang } = useAddon();
  const api = useApi();
  const [sign, setSign] = useState<1 | -1>(initialSign);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const amt = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(amt) && amt > 0 && Math.abs(amt * 100 - Math.round(amt * 100)) < 1e-6;
  const next = valid ? Math.round((wallet.balance + sign * amt) * 100) / 100 : null;
  const insufficient = next !== null && next < 0;

  const submit = async () => {
    if (!valid || insufficient) return;
    setBusy(true);
    try {
      const res = await api.post<{ balance: number }>('wallet/add', { userId: wallet.user_id, amount: sign * amt, note: note.trim() || undefined });
      toast.success(`${sign > 0 ? t('credited') : t('debited')} — ${fmtMoney(res.balance, wallet.currency, lang)}`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  const quick = sign > 0 ? [5, 10, 25, 50, 100] : [5, 10, 25, 50];
  const reasons = sign > 0 ? [t('reason.topup'), t('reason.gift'), t('reason.refund')] : [t('reason.correction'), t('reason.chargeback')];

  return (
    <Modal
      title={<>{sign > 0 ? t('credit') : t('debit')} — {label(wallet)}</>}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('ui.cancel')}</button>
          <button className={`btn ${sign > 0 ? 'btn-primary' : 'btn-danger-solid'}`} onClick={submit} disabled={busy || !valid || insufficient}>
            {busy ? '…' : sign > 0 ? t('confirmCredit') : t('confirmDebit')}
          </button>
        </>
      }
    >
      <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Seg<'1' | '-1'> label={t('operation')} value={String(sign) as '1' | '-1'} onChange={(v) => setSign(v === '1' ? 1 : -1)} options={[{ id: '1', label: `+ ${t('credit')}` }, { id: '-1', label: `− ${t('debit')}` }]} />
        <Field label={t('amount')} error={amount && !valid ? t('amountInvalid') : insufficient ? t('insufficient') : undefined}>
          <input className={`input ${amount && (!valid || insufficient) ? 'invalid' : ''}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus aria-label={t('amount')} />
        </Field>
        <div className="row gap-1">
          {quick.map((v) => <button key={v} type="button" className="btn btn-outline btn-sm" onClick={() => setAmount(String(v))}>{sign > 0 ? '+' : '−'}{v}</button>)}
          {sign < 0 && wallet.balance > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setAmount(String(wallet.balance))}>{t('all')}</button>}
        </div>
        <Field label={t('note')} hint={t('noteHint')}>
          <input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="row gap-1">
          {reasons.map((r) => <button key={r} type="button" className="btn btn-ghost btn-sm" onClick={() => setNote(r)}>{r}</button>)}
        </div>
        <div className="section-box">
          <div className="row-between"><span className="text-muted">{t('currentBalance')}</span><b>{fmtMoney(wallet.balance, wallet.currency, lang)}</b></div>
          <div className="row-between mt-1"><span className="text-muted">{t('newBalance')}</span><b className={insufficient ? 'text-red' : next !== null ? (sign > 0 ? 'text-green' : '') : 'text-muted'}>{next !== null ? fmtMoney(next, wallet.currency, lang) : '—'}</b></div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Historique d'un compte ────────────────────────────────────────────────────

const TX_PAGE = 15;

function HistoryModal({ wallet, onClose, onChanged }: { wallet: Wallet; onClose: () => void; onChanged: () => void }) {
  const t = useT();
  const { lang } = useAddon();
  const api = useApi();
  const [confirm, confirmEl] = useConfirm();
  const [type, setType] = useState<'all' | 'credit' | 'debit'>('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const path = `wallet/transactions?userId=${encodeURIComponent(wallet.user_id)}&limit=${TX_PAGE}&offset=${offset}&type=${type}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, loading, error, reload } = useFetch<{ transactions: Tx[]; total: number }>(path);

  useEffect(() => { setSelected(new Set()); }, [path]);

  const txs = data?.transactions ?? [];
  const total = data?.total ?? 0;

  const removeIds = async (ids: string[]) => {
    try {
      await api.post('wallet/transactions/delete', { ids });
      setSelected(new Set());
      reload();
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  const exportAll = async () => {
    try {
      const r = await api.get<{ transactions: Tx[] }>(`wallet/transactions?userId=${encodeURIComponent(wallet.user_id)}&all=1`);
      const rows: (string | number)[][] = [[t('csv.date'), t('csv.type'), t('csv.amount'), t('csv.note'), t('csv.by'), t('csv.balanceAfter')]];
      for (const tx of r.transactions) rows.push([tx.created_at, tx.amount >= 0 ? t('tx.credit') : t('tx.debit'), tx.amount, tx.note ?? '', tx.created_by, tx.balance_after ?? '']);
      downloadFile(`wallet-${label(wallet).replace(/[^A-Za-z0-9@._-]/g, '_')}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Modal title={<>{t('history')} — {label(wallet)}</>} onClose={onClose} size="lg">
      <div className="stack-sm">
        <div className="alert alert-info"><Icon name="info" size={15} /><div>{t('historyNote')}</div></div>
        <div className="row">
          <Seg<'all' | 'credit' | 'debit'> label={t('filter')} value={type} onChange={(v) => { setType(v); setOffset(0); }} options={[{ id: 'all', label: t('filter.all') }, { id: 'credit', label: t('filter.credit') }, { id: 'debit', label: t('filter.debit') }]} />
          <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0); }} placeholder={t('searchTx')} />
        </div>
        <div className="row-between">
          <span className="text-xs text-muted">{t('txCount', { n: total })}</span>
          <div className="row gap-1">
            <button className="btn btn-outline btn-sm" onClick={exportAll}><Icon name="download" size={13} />{t('exportCsv')}</button>
            <button className="btn btn-danger btn-sm" disabled={selected.size === 0} onClick={async () => { if (await confirm({ title: t('deleteSelected'), message: t('confirmBulkDelete', { count: selected.size }), confirmLabel: t('deleteTx') })) void removeIds([...selected]); }}>
              <Icon name="trash" size={13} />{t('deleteSelected')}{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
            <button className="btn btn-danger btn-sm" disabled={total === 0} onClick={async () => { if (await confirm({ title: t('clearHistory'), message: t('confirmClearHistory'), confirmLabel: t('clearHistory') })) { try { await api.post('wallet/transactions/clear', { userId: wallet.user_id }); reload(); onChanged(); } catch (e: any) { toast.error(e.message); } } }}>
              {t('clearHistory')}
            </button>
          </div>
        </div>

        {error ? <ErrorBox message={error} onRetry={reload} /> : loading && !data ? <div className="loading">{t('ui.loading')}</div> : txs.length === 0 ? (
          <Empty icon="history" title={t('noTx')} />
        ) : (
          <div className="card card-flush card-flat">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}><input type="checkbox" aria-label={t('selectAll')} checked={txs.length > 0 && selected.size === txs.length} onChange={() => setSelected(selected.size === txs.length ? new Set() : new Set(txs.map((x) => x.id)))} /></th>
                    <th>{t('operation')}</th><th className="num">{t('amount')}</th><th>{t('date')}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx) => (
                    <tr key={tx.id}>
                      <td><input type="checkbox" checked={selected.has(tx.id)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(tx.id)) n.delete(tx.id); else n.add(tx.id); return n; })} aria-label={`${t('deleteTx')} ${tx.id}`} /></td>
                      <td>
                        <div className="text-bold" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{txTitle(tx, t)}</div>
                        <div className="row gap-2 text-xs text-muted"><SourceBadge tx={tx} /><span className="truncate" style={{ maxWidth: 160 }}>{tx.created_by}</span></div>
                      </td>
                      <td className="num"><b className={tx.amount >= 0 ? 'text-green' : 'text-red'}>{tx.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(tx.amount), wallet.currency, lang)}</b></td>
                      <td className="text-sm text-muted">{fmtDateTime(tx.created_at, lang)}</td>
                      <td><button className="btn btn-ghost btn-icon btn-sm" onClick={async () => { if (await confirm({ title: t('deleteTx'), message: t('confirmDeleteTx'), confirmLabel: t('deleteTx') })) void removeIds([tx.id]); }} aria-label={t('deleteTx')}><Icon name="trash" size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={TX_PAGE} offset={offset} onChange={setOffset} />
          </div>
        )}
      </div>
      {confirmEl}
    </Modal>
  );
}
