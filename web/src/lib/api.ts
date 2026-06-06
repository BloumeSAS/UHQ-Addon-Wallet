/**
 * Client HTTP pour l'addon Wallet.
 * Le React tourne dans un iframe du panel → même origine que l'API NestJS.
 * Toutes les requêtes sont faites avec Authorization: Bearer <token>.
 */
export function createApi(token: string) {
  const headers = () => ({
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = (data as any)?.message ?? (data as any)?.error ?? `HTTP ${res.status}`;
      throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
    }

    return data as T;
  }

  return {
    get:  <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  };
}
