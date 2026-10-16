import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { createApi, useDebounced, useFetch } from '../lib/api';
import { downloadFile, fmtDateTime, fmtMoney, timeAgo, toCsv } from '../lib/format';
import { BalanceChart, SeriesPoint } from '../components/BalanceChart';
import { Icon } from '../components/icons';
import { SourceBadge, Tx, txTitle } from '../components/TxMeta';
import { Card, Empty, ErrorBox, PageSkeleton, Pagination, Seg, SearchInput, Skeleton } from '../components/ui';

interface WalletData {
  wallet: { id: string; balance: number; currency: string; updated_at: string };
  transactions: Tx[];
  total: number;
  stats: { credited: number; spent: number; count: number };
  series: SeriesPoint[];
}

const PAGE = 12;
type TxFilter = 'all' | 'credit' | 'debit';
type Period = '7' | '30' | '90' | 'all';

/** Page client : solde, cumuls, évolution et historique (filtrable, paginé, exportable). */
export default function MyBalance() {
  const { token, lang } = useAddon();
  const t = useT();
  const [type, setType] = useState<TxFilter>('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [offset, setOffset] = useState(0);
  const [period, setPeriod] = useState<Period>('30');
  const [exporting, setExporting] = useState(false);

  const path = useMemo(
    () => `wallet?limit=${PAGE}&offset=${offset}&type=${type}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    [offset, type, q],
  );
  const { data, loading, error, reload } = useFetch<WalletData>(token ? path : null);

  const series = useMemo(() => {
    if (!data) return [];
    if (period === 'all') return data.series;
    const since = Date.now() - Number(period) * 86400_000;
    const inRange = data.series.filter((p) => new Date(p.t).getTime() >= since);
    // On garde le dernier point AVANT la fenêtre comme point de départ (le solde d'alors) pour que la courbe ne démarre pas à vide.
    const before = [...data.series].reverse().find((p) => new Date(p.t).getTime() < since);
    return before ? [{ ...before, t: new Date(since).toISOString() }, ...inRange] : inRange;
  }, [data, period]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const api = createApi(token, lang);
      const r = await api.get<WalletData>(`wallet?limit=200&offset=0&type=${type}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      const rows: (string | number | null)[][] = [[t('csv.date'), t('csv.type'), t('csv.amount'), t('csv.note'), t('csv.balanceAfter')]];
      for (const tx of r.transactions) {
        rows.push([tx.created_at, tx.amount >= 0 ? t('tx.credit') : t('tx.debit'), tx.amount, tx.note ?? '', tx.balance_after ?? '']);
      }
      downloadFile(`wallet-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!token) return <div className="page"><Empty icon="key" title={t('noToken')} text={t('noTokenText')} /></div>;
  if (loading && !data) return <div className="page"><PageSkeleton /></div>;
  if (error && !data) return <div className="page"><ErrorBox message={error} onRetry={reload} /></div>;
  if (!data) return null;

  const { wallet, transactions, total, stats } = data;
  const cur = wallet.currency;
  const filtering = type !== 'all' || q !== '';
  const brandNew = stats.count === 0 && wallet.balance === 0;

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('myWallet')}</h1>
          <p className="page-sub">{t('myWalletSub')}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={reload} disabled={loading}><Icon name="refresh" size={14} />{t('ui.refresh')}</button>
      </div>

      <div className="hero">
        <div className="hero-label">{t('balance')}</div>
        <div className="hero-amount">{fmtMoney(wallet.balance, cur, lang)}</div>
        <div className="hero-sub">{t('updatedAgo', { when: timeAgo(wallet.updated_at, lang) })}</div>
        <div className="hero-chips">
          <span className="hero-chip">↗ {t('totalCredited')} : {fmtMoney(stats.credited, cur, lang)}</span>
          <span className="hero-chip">↙ {t('totalSpent')} : {fmtMoney(stats.spent, cur, lang)}</span>
          <span className="hero-chip">{t('operations', { n: stats.count })}</span>
        </div>
      </div>

      {brandNew ? (
        <Card>
          <Empty
            icon="wallet"
            title={t('emptyWalletTitle')}
            text={t('emptyWalletText')}
          />
        </Card>
      ) : (
        <>
          <Card
            title={t('balanceOverTime')}
            right={
              <Seg<Period>
                label={t('period')}
                value={period}
                onChange={setPeriod}
                options={[
                  { id: '7', label: t('period.7') },
                  { id: '30', label: t('period.30') },
                  { id: '90', label: t('period.90') },
                  { id: 'all', label: t('period.all') },
                ]}
              />
            }
          >
            {series.length >= 2 ? <BalanceChart series={series} currency={cur} /> : <div className="text-sm text-muted" style={{ padding: '1.2rem 0' }}>{t('notEnoughData')}</div>}
          </Card>

          <Card flush>
            <div className="card-head">
              <h3 className="card-title">{t('transactions')}</h3>
              <div className="row">
                <Seg<TxFilter>
                  label={t('filter')}
                  value={type}
                  onChange={(v) => { setType(v); setOffset(0); }}
                  options={[
                    { id: 'all', label: t('filter.all') },
                    { id: 'credit', label: t('filter.credit') },
                    { id: 'debit', label: t('filter.debit') },
                  ]}
                />
                <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting || total === 0}><Icon name="download" size={14} />{t('exportCsv')}</button>
              </div>
            </div>
            <div style={{ padding: '0 1.1rem 0.8rem' }}>
              <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0); }} placeholder={t('searchTx')} />
            </div>

            {loading && transactions.length === 0 ? (
              <div className="stack-sm" style={{ padding: '0 1.1rem 1.1rem' }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} />)}</div>
            ) : transactions.length === 0 ? (
              <Empty
                icon="history"
                title={filtering ? t('noResults') : t('noTx')}
                text={filtering ? t('noResultsText') : undefined}
                action={filtering ? <button className="btn btn-outline btn-sm" onClick={() => { setType('all'); setSearch(''); setOffset(0); }}>{t('resetFilters')}</button> : undefined}
              />
            ) : (
              <ul className="tx-list" aria-live="polite">
                {transactions.map((tx) => (
                  <li key={tx.id} className="tx-row">
                    <div className={`tx-icon ${tx.amount >= 0 ? 'tx-in' : 'tx-out'}`}><Icon name={tx.amount >= 0 ? 'arrowIn' : 'arrowOut'} size={17} /></div>
                    <div className="tx-main">
                      <div className="tx-title" title={txTitle(tx, t)}>{txTitle(tx, t)}</div>
                      <div className="tx-meta row gap-2" style={{ marginTop: 2 }}>
                        <SourceBadge tx={tx} />
                        <span title={fmtDateTime(tx.created_at, lang)}>{timeAgo(tx.created_at, lang)}</span>
                      </div>
                    </div>
                    <div className="tx-amount">
                      <div className={tx.amount >= 0 ? 'text-green' : 'text-red'}>{tx.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(tx.amount), cur, lang)}</div>
                      {tx.balance_after !== undefined && <div className="tx-after">{t('balanceAfter', { v: fmtMoney(tx.balance_after, cur, lang) })}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination total={total} limit={PAGE} offset={offset} onChange={setOffset} />
          </Card>
        </>
      )}
    </div>
  );
}
