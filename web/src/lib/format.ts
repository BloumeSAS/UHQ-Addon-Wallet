export type Lang = 'fr' | 'en';

const locale = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-GB');

export function fmtMoney(value: number | null | undefined, currency = 'EUR', lang: Lang = 'fr'): string {
  const v = Number(value);
  if (!Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat(locale(lang), { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export function fmtDate(iso: string | null | undefined, lang: Lang = 'fr'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(lang), { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined, lang: Lang = 'fr'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'short' });
}

/** « il y a 3 min » / « 3 min ago ». */
export function timeAgo(iso: string | null | undefined, lang: Lang = 'fr'): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.round((t - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(iso, lang);
}

export function initials(label: string): string {
  const base = (label.split('@')[0] || label).replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const parts = base.split(' ').filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? '')).slice(0, 2);
}

/** Presse-papiers, avec repli pour les contextes sans l'API moderne (iframe sans permission). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Télécharge un fichier texte généré côté navigateur. */
export function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV (séparateur « ; » pour Excel FR) ; protège contre l'injection de formules (=, +, -, @). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
