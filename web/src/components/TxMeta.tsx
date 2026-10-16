import { useT } from '../i18n';
import { Badge } from './ui';

export interface Tx {
  id: string;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
  balance_after?: number;
}

export type TxSource = 'admin' | 'purchase' | 'refund';

/** Origine d'une opération : la boutique (Orders) écrit « addon-orders », un administrateur son e-mail. */
export function txSource(tx: Pick<Tx, 'amount' | 'note' | 'created_by'>): TxSource {
  if (tx.created_by === 'addon-orders') {
    return tx.amount > 0 || /^remboursement|^refund/i.test(tx.note ?? '') ? 'refund' : 'purchase';
  }
  return 'admin';
}

export function SourceBadge({ tx }: { tx: Pick<Tx, 'amount' | 'note' | 'created_by'> }) {
  const t = useT();
  const s = txSource(tx);
  return <Badge tone={s === 'purchase' ? 'info' : s === 'refund' ? 'warn' : 'muted'}>{t(`src.${s}`)}</Badge>;
}

export function txTitle(tx: Pick<Tx, 'amount' | 'note'>, t: (k: string) => string): string {
  return tx.note?.trim() || (tx.amount >= 0 ? t('tx.credit') : t('tx.debit'));
}
