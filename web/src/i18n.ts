import { useAddon } from './context';

const I18N: Record<string, Record<string, string>> = {
  fr: {
    myBalance:       'Mon solde',
    balance:         'Solde',
    currency:        'Devise',
    transactions:    'Transactions',
    allBalances:     'Gestion des soldes',
    userId:          'Utilisateur',
    amount:          'Montant',
    note:            'Note',
    credit:          'Créditer',
    debit:           'Débiter',
    save:            'Enregistrer',
    cancel:          'Annuler',
    noData:          'Aucune donnée',
    noTx:            'Aucune transaction',
    updated:         'Mis à jour',
    noToken:         'Connexion requise',
    noAdmin:         'Accès admin requis',
    loading:         'Chargement…',
    error:           'Erreur',
    total:           'Total soldes',
    activeAccounts:  'Comptes actifs',
    avgBalance:      'Solde moyen',
    actions:         'Actions',
  },
  en: {
    myBalance:       'My balance',
    balance:         'Balance',
    currency:        'Currency',
    transactions:    'Transactions',
    allBalances:     'Balance management',
    userId:          'User',
    amount:          'Amount',
    note:            'Note',
    credit:          'Credit',
    debit:           'Debit',
    save:            'Save',
    cancel:          'Cancel',
    noData:          'No data',
    noTx:            'No transactions',
    updated:         'Updated',
    noToken:         'Login required',
    noAdmin:         'Admin access required',
    loading:         'Loading…',
    error:           'Error',
    total:           'Total balances',
    activeAccounts:  'Active accounts',
    avgBalance:      'Average balance',
    actions:         'Actions',
  },
};

export function useT() {
  const { lang } = useAddon();
  return (key: string) => I18N[lang]?.[key] ?? I18N['fr'][key] ?? key;
}

export function fmt(value: number, currency = 'EUR', lang = 'fr') {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}
