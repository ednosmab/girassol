// Redis REST client using native fetch — no external dependencies needed.
// Compatible with Upstash Redis REST API.

export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

let cachedClient: RedisLike | null = null;

function createRedisClient(url: string, token: string): RedisLike {
  async function exec<T = unknown>(...args: (string | number)[]): Promise<T> {
    const body = JSON.stringify(args);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`Redis error ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.result as T;
  }

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      return exec<T | null>('GET', key);
    },
    async set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown> {
      const args: (string | number)[] = ['SET', key, typeof value === 'string' ? value : JSON.stringify(value)];
      if (opts?.ex) args.push('EX', opts.ex);
      return exec(...args);
    },
    async del(key: string): Promise<unknown> {
      return exec('DEL', key);
    },
    async keys(pattern: string): Promise<string[]> {
      return exec<string[]>('KEYS', pattern);
    },
  };
}

export function getRedis(env: NodeJS.ProcessEnv = process.env): RedisLike {
  if (cachedClient) return cachedClient;

  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis não configurado. Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  cachedClient = createRedisClient(url, token);
  return cachedClient;
}

export function _setRedisForTests(client: RedisLike | null): void {
  cachedClient = client;
}
