import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '../i18n';
import { useApi, useFetch } from '../lib/api';
import { Icon } from '../components/icons';
import { Card, ErrorBox, Field, Notice, PageSkeleton, Switch } from '../components/ui';

interface Offer { id: string; amount: number; bonus_percent: number; label: string; featured: boolean; enabled: boolean }
interface Tier { min_amount: number; bonus_percent: number }
interface Settings {
  enabled: boolean; offers: Offer[]; custom_enabled: boolean; custom_min: number; custom_max: number;
  tiers_enabled: boolean; tiers: Tier[]; promo_enabled: boolean;
}

const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')));

/** Réglages des recharges du solde : offres, montant libre (min / max), paliers de bonus, code promo — chaque bloc s'active ou se coupe. */
export default function AdminTopup() {
  const t = useT();
  const api = useApi();
  const { data, loading, error, reload } = useFetch<Settings>('topup/settings');
  const status = useFetch<{ available: boolean; reason: string | null }>('topup/config');
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data); }, [data]);

  if (loading && !s) return <PageSkeleton rows={4} />;
  if (error && !s) return <ErrorBox message={error} onRetry={reload} />;
  if (!s) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => (x ? { ...x, [k]: v } : x));
  const setOffer = (i: number, patch: Partial<Offer>) => set('offers', s.offers.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const setTier = (i: number, patch: Partial<Tier>) => set('tiers', s.tiers.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put<Settings>('topup/settings', s);
      setS(r);
      toast.success(t('saved'));
      status.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reason = status.data?.reason;
  return (
    <div className="stack">
      {status.data && (s.enabled && !status.data.available
        ? <Notice tone="warn">{t(`topupOff.${reason ?? 'disabled'}`)}</Notice>
        : <Notice tone="info">{t('topupAdminIntro')}</Notice>)}

      <Card>
        <label className="row gap-3" style={{ cursor: 'pointer' }}>
          <Switch checked={s.enabled} onChange={(v) => set('enabled', v)} label={t('topupEnable')} />
          <span><b>{t('topupEnable')}</b><div className="text-xs text-muted">{t('topupEnableHint')}</div></span>
        </label>
      </Card>

      <Card collapsible title={t('offersTitle')} right={<button className="btn btn-outline btn-sm" onClick={() => set('offers', [...s.offers, { id: '', amount: 20, bonus_percent: 0, label: '', featured: false, enabled: true }])} disabled={s.offers.length >= 12}><Icon name="plus" size={14} />{t('addOffer')}</button>}>
        <p className="text-sm text-muted" style={{ marginBottom: '0.7rem' }}>{t('offersHelp')}</p>
        {s.offers.length === 0 ? <span className="text-sm text-muted">{t('noOffers')}</span> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('amountPaid')}</th><th>{t('bonusPercent')}</th><th>{t('labelOpt')}</th><th>{t('featured')}</th><th>{t('enabled')}</th><th /></tr></thead>
              <tbody>
                {s.offers.map((o, i) => (
                  <tr key={i} style={{ opacity: o.enabled ? 1 : 0.55 }}>
                    <td><input className="input" style={{ width: 110 }} inputMode="decimal" value={o.amount || ''} onChange={(e) => setOffer(i, { amount: num(e.target.value) })} aria-label={t('amountPaid')} /></td>
                    <td><input className="input" style={{ width: 90 }} inputMode="decimal" value={o.bonus_percent || ''} onChange={(e) => setOffer(i, { bonus_percent: num(e.target.value) })} placeholder="0" aria-label={t('bonusPercent')} /></td>
                    <td><input className="input" style={{ width: 160 }} value={o.label} maxLength={40} onChange={(e) => setOffer(i, { label: e.target.value })} placeholder={t('labelPh')} aria-label={t('labelOpt')} /></td>
                    <td><Switch checked={o.featured} onChange={(v) => setOffer(i, { featured: v })} label={t('featured')} /></td>
                    <td><Switch checked={o.enabled} onChange={(v) => setOffer(i, { enabled: v })} label={t('enabled')} /></td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('offers', s.offers.filter((_, k) => k !== i))} aria-label={t('remove')}><Icon name="trash" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <label className="row gap-3" style={{ cursor: 'pointer', marginBottom: s.custom_enabled ? '0.8rem' : 0 }}>
          <Switch checked={s.custom_enabled} onChange={(v) => set('custom_enabled', v)} label={t('customEnable')} />
          <span><b>{t('customEnable')}</b><div className="text-xs text-muted">{t('customEnableHint')}</div></span>
        </label>
        {s.custom_enabled && (
          <div className="form-grid">
            <Field label={t('customMin')}><input className="input" inputMode="decimal" value={s.custom_min || ''} onChange={(e) => set('custom_min', num(e.target.value))} /></Field>
            <Field label={t('customMax')} hint={t('customMaxHint')}><input className="input" inputMode="decimal" value={s.custom_max || ''} onChange={(e) => set('custom_max', num(e.target.value))} placeholder="∞" /></Field>
          </div>
        )}
      </Card>

      <Card>
        <label className="row gap-3" style={{ cursor: 'pointer', marginBottom: s.tiers_enabled ? '0.8rem' : 0 }}>
          <Switch checked={s.tiers_enabled} onChange={(v) => set('tiers_enabled', v)} label={t('tiersEnable')} />
          <span><b>{t('tiersEnable')}</b><div className="text-xs text-muted">{t('tiersEnableHint')}</div></span>
        </label>
        {s.tiers_enabled && (
          <div className="stack-sm">
            {s.tiers.map((x, i) => (
              <div key={i} className="row gap-2" style={{ flexWrap: 'nowrap' }}>
                <span className="text-sm">{t('tierFrom')}</span>
                <input className="input" style={{ width: 110 }} inputMode="decimal" value={x.min_amount || ''} onChange={(e) => setTier(i, { min_amount: num(e.target.value) })} aria-label={t('tierFrom')} />
                <span className="text-sm">{t('tierBonus')}</span>
                <input className="input" style={{ width: 90 }} inputMode="decimal" value={x.bonus_percent || ''} onChange={(e) => setTier(i, { bonus_percent: num(e.target.value) })} aria-label={t('bonusPercent')} />
                <span className="text-sm">%</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('tiers', s.tiers.filter((_, k) => k !== i))} aria-label={t('remove')}><Icon name="trash" size={14} /></button>
              </div>
            ))}
            <div><button className="btn btn-outline btn-sm" onClick={() => set('tiers', [...s.tiers, { min_amount: 200, bonus_percent: 15 }])} disabled={s.tiers.length >= 10}><Icon name="plus" size={14} />{t('addTier')}</button></div>
            <span className="hint">{t('tiersNote')}</span>
          </div>
        )}
      </Card>

      <Card>
        <label className="row gap-3" style={{ cursor: 'pointer' }}>
          <Switch checked={s.promo_enabled} onChange={(v) => set('promo_enabled', v)} label={t('promoEnable')} />
          <span><b>{t('promoEnable')}</b><div className="text-xs text-muted">{t('promoEnableHint')}</div></span>
        </label>
      </Card>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : t('save')}</button>
      </div>
    </div>
  );
}
