import { useMemo, useRef, useState } from 'react';
import { useAddon } from '../context';
import { fmtDateTime, fmtMoney } from '../lib/format';

export interface SeriesPoint {
  t: string;
  balance: number;
}

/**
 * Courbe d'évolution du solde (SVG natif, sans dépendance) : aire dégradée, repères min/max, survol qui affiche la date et le solde.
 */
export function BalanceChart({ series, currency }: { series: SeriesPoint[]; currency: string }) {
  const { lang } = useAddon();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 680;
  const H = 190;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 22;

  const geo = useMemo(() => {
    if (series.length < 2) return null;
    const times = series.map((p) => new Date(p.t).getTime());
    const t0 = times[0];
    const t1 = times[times.length - 1];
    const span = Math.max(1, t1 - t0);
    const vals = series.map((p) => p.balance);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 0.01);
    const range = max - min || 1;
    const x = (i: number) => padL + ((times[i] - t0) / span) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB);
    const pts = series.map((p, i) => ({ x: x(i), y: y(p.balance) }));
    // Courbe en escalier : un solde reste constant jusqu'à l'opération suivante.
    let line = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) line += ` H${pts[i].x} V${pts[i].y}`;
    const area = `${line} V${H - padB} H${pts[0].x} Z`;
    return { pts, line, area, min, max, zeroY: y(0) };
  }, [series]);

  if (!geo) return null;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    geo.pts.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < bestD) { bestD = d; best = i; }
    });
    setHover(best);
  };

  const hp = hover !== null ? geo.pts[hover] : null;
  return (
    <div className="chart" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="balance">
        <defs>
          <linearGradient id="bal-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padL} x2={W - padR} y1={geo.zeroY} y2={geo.zeroY} stroke="var(--border)" strokeDasharray="4 4" />
        <path d={geo.area} fill="url(#bal-grad)" />
        <path d={geo.line} fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinejoin="round" />
        <text x={padL} y={H - 6} fontSize="10" fill="var(--fg2)">{fmtDateTime(series[0].t, lang)}</text>
        <text x={W - padR} y={H - 6} fontSize="10" fill="var(--fg2)" textAnchor="end">{fmtDateTime(series[series.length - 1].t, lang)}</text>
        <text x={W - padR} y={10} fontSize="10" fill="var(--fg2)" textAnchor="end">{fmtMoney(geo.max, currency, lang)}</text>
        {hp && <>
          <line x1={hp.x} x2={hp.x} y1={padT} y2={H - padB} stroke="var(--fg2)" strokeOpacity="0.4" />
          <circle cx={hp.x} cy={hp.y} r="4.5" fill="var(--primary)" stroke="var(--bg)" strokeWidth="2" />
        </>}
      </svg>
      {hp && hover !== null && (
        <div className="chart-tip" style={{ left: `${(hp.x / W) * 100}%`, top: `${(hp.y / H) * 100}%` }}>
          <b>{fmtMoney(series[hover].balance, currency, lang)}</b>
          <div className="text-muted">{fmtDateTime(series[hover].t, lang)}</div>
        </div>
      )}
    </div>
  );
}
