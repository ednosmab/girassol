import { Redis } from '@upstash/redis';

// Interface mínima que usamos. Permite mock sem importar @upstash/redis real.
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

let cachedClient: RedisLike | null = null;

export function getRedis(env: NodeJS.ProcessEnv = process.env): RedisLike {
  if (cachedClient) return cachedClient;

  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis não configurado. Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  cachedClient = new Redis({ url, token });
  return cachedClient;
}

export function _setRedisForTests(client: RedisLike | null): void {
  cachedClient = client;
}
