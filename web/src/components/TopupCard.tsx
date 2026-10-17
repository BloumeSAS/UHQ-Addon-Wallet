import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAddon } from '../context';
import { useT } from '../i18n';
import { useApi, useDebounced, useFetch } from '../lib/api';
import { copyText, fmtMoney } from '../lib/format';
import { Icon } from './icons';
import { Badge, Card, Modal, Notice, Spinner } from './ui';

interface Config {
  available: boolean;
  reason: 'disabled' | 'orders' | 'methods' | null;
  currency: string;
  offers: { id: string; amount: number; bonus_percent: number; label: string; featured: boolean }[];
  custom: { min: number; max: number } | null;
  tiers: { min_amount: number; bonus_percent: number }[];
  methods: { stripe: boolean; nowpayments: boolean; paypal: boolean };
  promo: boolean;
  gift: boolean;
}

interface Quote {
  amount: number;
  bonus_percent: number;
  base_credit: number;
  credit: number;
  bonus: number;
  promo?: { valid: boolean; reason?: string; code?: string; label?: string; effect?: number };
}

type Method = 'stripe' | 'nowpayments' | 'paypal';
const METHOD_ICON = { stripe: 'card', nowpayments: 'coins', paypal: 'card' } as const;

/** Adresse de retour après paiement : la page du PANEL qui contient cet addon (le jeton y est re-transmis), sinon la page courante. */
function returnBase(): string {
  try {
    return (window.top ?? window).location.href.split('#')[0].split('?')[0];
  } catch {
    return window.location.href.split('#')[0].split('?')[0];
  }
}

/** Recharge du solde (paiement via les passerelles de l'addon Orders) + application d'un code cadeau. */
export function TopupCard({ onChanged }: { onChanged: () => void }) {
  const { token, lang } = useAddon();
  const t = useT();
  const api = useApi();
  const cfg = useFetch<Config>(token ? 'topup/config' : null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<Method | null>(null);
  const [promo, setPromo] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [paypal, setPaypal] = useState<{ order_id: string; paypal: { email: string; note: string }; total: number } | null>(null);

  const c = cfg.data;
  const cur = c?.currency ?? 'EUR';
  const customAmount = Number(custom.replace(',', '.'));
  const amount = offerId ? c?.offers.find((o) => o.id === offerId)?.amount : Number.isFinite(customAmount) && customAmount > 0 ? customAmount : undefined;
  const debouncedAmount = useDebounced(amount, 350);
  const debouncedPromo = useDebounced(promo.trim(), 450);

  // Méthode par défaut = la première disponible.
  useEffect(() => {
    if (!c) return;
    if (!method || !c.methods[method]) setMethod(c.methods.stripe ? 'stripe' : c.methods.paypal ? 'paypal' : c.methods.nowpayments ? 'nowpayments' : null);
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  // Devis (bonus d'offre / de palier + code promo) recalculé côté serveur à chaque changement.
  useEffect(() => {
    if (!c?.available || !debouncedAmount) { setQuote(null); setQuoteErr(''); return; }
    let alive = true;
    api.post<Quote>('topup/quote', { ...(offerId ? { offer_id: offerId } : { amount: debouncedAmount }), ...(c.promo && debouncedPromo ? { promo_code: debouncedPromo } : {}) })
      .then((q) => { if (alive) { setQuote(q); setQuoteErr(''); } })
      .catch((e) => { if (alive) { setQuote(null); setQuoteErr(String(e.message)); } });
    return () => { alive = false; };
  }, [c?.available, c?.promo, debouncedAmount, debouncedPromo, offerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const errText = (m: string) => (t(`err.${m}`) !== `err.${m}` ? t(`err.${m}`, { min: c?.custom?.min ?? 0, max: c?.custom?.max ?? 0 }) : m);

  const pay = async () => {
    if (!amount || !method) return;
    setBusy(true);
    try {
      const base = returnBase();
      const sep = base.includes('?') ? '&' : '?';
      const r = await api.post<{ order_id: string; checkoutUrl?: string; paypal?: { email: string; note: string }; total: number }>('topup/checkout', {
        ...(offerId ? { offer_id: offerId } : { amount }),
        method,
        ...(c?.promo && promo.trim() ? { promo_code: promo.trim() } : {}),
        successUrl: `${base}${sep}topup=success`,
        cancelUrl: `${base}${sep}topup=cancelled`,
      });
      if (method === 'paypal') {
        if (!r.paypal) throw new Error(t('err.PAYPAL_MISSING'));
        setPaypal({ order_id: r.order_id, paypal: r.paypal, total: r.total });
      } else {
        if (!r.checkoutUrl) throw new Error(t('err.PAYMENT_URL'));
        // Les passerelles refusent l'iframe : on redirige le navigateur ENTIER.
        (window.top ?? window).location.href = r.checkoutUrl;
      }
    } catch (e: any) {
      toast.error(errText(String(e.message)));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: number) => fmtMoney(v, cur, lang);

  if (!token || (cfg.loading && !c)) return null;
  if (!c) return null;

  return (
    <>
      <Card collapsible defaultOpen={/[?&]topup=/.test(window.location.search)} title={<span className="row gap-2"><Icon name="plus" size={16} />{t('topupTitle')}</span>}>
        {!c.available ? (
          <Notice tone="info">{t(`topupOff.${c.reason ?? 'disabled'}`)}</Notice>
        ) : (
          <div className="stack">
            <p className="text-sm text-muted">{t('topupHelp')}</p>

            <div className="topup-grid">
              {c.offers.map((o) => {
                const active = offerId === o.id;
                return (
                  <button key={o.id} type="button" className={`topup-offer ${active ? 'active' : ''}`} onClick={() => { setOfferId(o.id); setCustom(''); }} aria-pressed={active}>
                    {o.featured && <Badge tone="primary">{t('popular')}</Badge>}
                    <b className="topup-amount">{fmt(o.amount)}</b>
                    {o.label && <span className="text-xs text-muted">{o.label}</span>}
                    {o.bonus_percent > 0 ? <Badge tone="good" icon="plus">{t('bonusPct', { n: o.bonus_percent })}</Badge> : <span className="text-xs text-muted">&nbsp;</span>}
                  </button>
                );
              })}
            </div>

            {c.custom && (
              <div className="stack-sm">
                <label className="label" htmlFor="topup-custom">{t('customAmount')}</label>
                <div className="input-affix">
                  <input
                    id="topup-custom" className="input" inputMode="decimal" value={custom}
                    onChange={(e) => { setCustom(e.target.value); setOfferId(null); }}
                    placeholder={t('customPlaceholder', { min: c.custom.min, max: c.custom.max || '∞' })}
                  />
                </div>
                <span className="hint">{t('customHint', { min: fmt(c.custom.min), max: c.custom.max > 0 ? fmt(c.custom.max) : t('noMax') })}</span>
              </div>
            )}

            {c.tiers.length > 0 && (
              <div className="section-box text-sm">
                <b className="row gap-2"><Icon name="zap" size={14} />{t('tiersTitle')}</b>
                <ul style={{ listStyle: 'none', marginTop: 4 }}>
                  {c.tiers.map((x) => <li key={x.min_amount} className="text-muted">{t('tierLine', { min: fmt(x.min_amount), n: x.bonus_percent })}</li>)}
                </ul>
              </div>
            )}

            {c.promo && (
              <div className="stack-sm">
                <label className="label" htmlFor="topup-promo">{t('bonusCode')}</label>
                <input id="topup-promo" className="input mono" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder={t('bonusCodePh')} maxLength={60} autoComplete="off" spellCheck={false} />
                {quote?.promo && (quote.promo.valid
                  ? <span className="hint text-green">✓ {t('promoOk', { label: quote.promo.label || quote.promo.code || '', v: fmt(quote.promo.effect ?? 0) })}</span>
                  : <span className="error-text">{t(`reason.${quote.promo.reason}`) !== `reason.${quote.promo.reason}` ? t(`reason.${quote.promo.reason}`) : t('promoBad')}</span>)}
              </div>
            )}

            {amount && quote ? (
              <div className="section-box stack-sm">
                <div className="row-between"><span className="text-muted">{t('youPay')}</span><b>{fmt(quote.amount)}</b></div>
                {quote.bonus > 0 && <div className="row-between"><span className="text-muted">{t('bonus')}</span><b className="text-green">+{fmt(quote.bonus)}</b></div>}
                <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}><span>{t('youGet')}</span><b style={{ fontSize: '1.15rem' }}>{fmt(quote.credit)}</b></div>
              </div>
            ) : quoteErr ? <Notice tone="error">{errText(quoteErr)}</Notice> : null}

            <div className="stack-sm" role="radiogroup" aria-label={t('payWith')}>
              <div className="label">{t('payWith')}</div>
              {(['stripe', 'paypal', 'nowpayments'] as Method[]).filter((m) => c.methods[m]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} className={`pay-option ${method === m ? 'active' : ''}`} onClick={() => setMethod(m)}>
                  <span className="pay-radio" /><Icon name={METHOD_ICON[m]} size={17} /><span className="grow"><b>{t(`pay.${m}`)}</b><div className="text-xs text-muted">{t(m === 'paypal' ? 'pay.paypalHint' : 'pay.redirect')}</div></span>
                </button>
              ))}
            </div>

            <button className="btn btn-primary btn-lg btn-block" onClick={pay} disabled={busy || !amount || !quote || !method}>
              {busy ? <Spinner /> : <><Icon name="card" size={16} />{amount && quote ? t('payBtn', { v: fmt(quote.amount) }) : t('chooseAmount')}</>}
            </button>
          </div>
        )}
      </Card>

      {c.gift && <GiftCard cur={cur} onDone={onChanged} />}
      {paypal && <PaypalTopupModal info={paypal} cur={cur} onClose={() => { setPaypal(null); onChanged(); }} />}
    </>
  );
}

/** Code cadeau (crédit) : appliqué directement sur le solde. */
function GiftCard({ cur, onDone }: { cur: string; onDone: () => void }) {
  const t = useT();
  const { lang } = useAddon();
  const api = useApi();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ credited: number; code: string }>('topup/redeem', { code: code.trim() });
      setMsg({ ok: true, text: t('giftOk', { v: fmtMoney(r.credited, cur, lang), code: r.code }) });
      setCode('');
      toast.success(t('giftApplied'));
      onDone();
    } catch (ex: any) {
      const key = `reason.${String(ex.message)}`;
      setMsg({ ok: false, text: t(key) !== key ? t(key) : String(ex.message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card collapsible title={<span className="row gap-2"><Icon name="gift" size={16} />{t('giftTitle')}</span>}>
      <form className="stack-sm" onSubmit={apply}>
        <p className="text-sm text-muted">{t('giftHelp')}</p>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('giftPh')} maxLength={60} autoComplete="off" spellCheck={false} aria-label={t('giftPh')} />
          <button className="btn btn-primary" type="submit" disabled={busy || !code.trim()}>{busy ? '…' : t('apply')}</button>
        </div>
        {msg && <Notice tone={msg.ok ? 'success' : 'error'}>{msg.text}</Notice>}
      </form>
    </Card>
  );
}

/** PayPal Amis & Famille : consignes + suivi automatique jusqu'au crédit du solde. */
function PaypalTopupModal({ info, cur, onClose }: { info: { order_id: string; paypal: { email: string; note: string }; total: number }; cur: string; onClose: () => void }) {
  const t = useT();
  const { lang } = useAddon();
  const api = useApi();
  const [status, setStatus] = useState<'pending' | 'fulfilled' | 'cancelled'>('pending');
  const [credit, setCredit] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'pending') return;
    const id = setInterval(() => {
      api.get<{ status: string; credit?: number }>(`topup/status/${info.order_id}`)
        .then((r) => {
          if (r.status === 'fulfilled') { setStatus('fulfilled'); setCredit(r.credit ?? null); }
          else if (r.status === 'cancelled') setStatus('cancelled');
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(id);
  }, [status, info.order_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (label: string, value: string, mono = false) => (
    <div className="row-between cred" style={{ flexWrap: 'nowrap' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="text-xs text-muted">{label}</div>
        <div className={mono ? 'mono text-bold' : 'text-bold'} style={{ wordBreak: 'break-all' }}>{value}</div>
      </div>
      <button className="btn btn-outline btn-sm" onClick={() => void copyText(value).then(() => toast.success(t('ui.copied')))}><Icon name="copy" size={13} />{t('ui.copy')}</button>
    </div>
  );

  return (
    <Modal title={t('ppTitle')} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>{status === 'pending' ? t('ui.close') : t('ppDone')}</button>}>
      {status === 'fulfilled' ? (
        <Notice tone="success">{t('ppCredited', { v: credit !== null ? fmtMoney(credit, cur, lang) : '' })}</Notice>
      ) : status === 'cancelled' ? (
        <Notice tone="error">{t('ppCancelled')}</Notice>
      ) : (
        <div className="stack-sm">
          <ol className="steps"><li>{t('ppStep1')}</li><li>{t('ppStep2')}</li><li>{t('ppStep3')}</li></ol>
          {row(t('ppRecipient'), info.paypal.email)}
          {row(t('ppAmount'), `${info.total.toFixed(2)} ${cur}`)}
          {row(t('ppNote'), info.paypal.note, true)}
          <Notice tone="warn" icon="alert">{t('ppWarn')}</Notice>
          <div className="row gap-2 text-sm text-muted"><span className="spinner" />{t('ppWaiting')}</div>
        </div>
      )}
    </Modal>
  );
}
