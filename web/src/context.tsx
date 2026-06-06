import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface AddonCtx {
  token: string;
  lang:  'fr' | 'en';
  theme: 'dark' | 'light';
  role:  string;
}

const AddonContext = createContext<AddonCtx>({
  token: '',
  lang:  'fr',
  theme: 'dark',
  role:  'USER',
});

export function AddonProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();

  const ctx: AddonCtx = {
    token: params.get('token') ?? '',
    lang:  (params.get('lang')  ?? 'fr') as 'fr' | 'en',
    theme: (params.get('theme') ?? 'dark') as 'dark' | 'light',
    role:  params.get('role')  ?? 'USER',
  };

  // Applique le thème sur <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', ctx.theme);
  }, [ctx.theme]);

  return (
    <AddonContext.Provider value={ctx}>
      {children}
    </AddonContext.Provider>
  );
}

export const useAddon = () => useContext(AddonContext);
