import { useCallback, useEffect, useRef, useState } from 'react';
import { useAddon } from '../context';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Client HTTP de l'addon. Les URLs sont préfixées par BASE_URL ("/" en déploiement classique, "/addon-proxy/<slug>/" une
 * fois embarqué dans le panel) : jamais de chemin absolu "/api/..." (il ne passerait pas par le proxy). Le jeton du panel
 * ne voyage que dans l'en-tête Authorization.
 */
export function createApi(token: string, lang: 'fr' | 'en' = 'fr') {
  const base = import.meta.env.BASE_URL;

  async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${base}api/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'x-lang': lang,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data as any)?.message ?? (data as any)?.error ?? `HTTP ${res.status}`;
      throw new ApiError(Array.isArray(message) ? message.join(', ') : String(message), res.status);
    }
    return data as T;
  }

  return {
    get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    del: <T>(path: string) => request<T>('DELETE', path),
  };
}

export function useApi() {
  const { token, lang } = useAddon();
  // Instance stable tant que le jeton/la langue ne changent pas (utilisable dans des dépendances d'effets).
  const ref = useRef<{ key: string; api: ReturnType<typeof createApi> } | null>(null);
  const key = `${token}|${lang}`;
  if (!ref.current || ref.current.key !== key) ref.current = { key, api: createApi(token, lang) };
  return ref.current.api;
}

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

/** GET `path` (null = ne rien charger) ; recharge quand `path` change ou via `reload()`. Conserve les données précédentes pendant un rechargement. */
export function useFetch<T>(path: string | null): FetchState<T> {
  const { token, lang } = useAddon();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (path === null || !token) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const id = ++seq.current;
    setLoading(true);
    setError('');
    createApi(token, lang)
      .get<T>(path, ctrl.signal)
      .then((r) => id === seq.current && setData(r))
      .catch((e) => {
        if (id !== seq.current || e?.name === 'AbortError') return;
        setError(String(e?.message ?? e));
      })
      .finally(() => id === seq.current && setLoading(false));
    return () => ctrl.abort();
  }, [token, lang, path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** Valeur qui ne change qu'après `ms` d'inactivité (recherche au clavier). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
