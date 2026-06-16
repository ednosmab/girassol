import { jest } from '@jest/globals';
import { getRedis, _setRedisForTests, RedisLike } from '../../api/_shared/redis-client';

beforeEach(() => {
  _setRedisForTests(null);
});

describe('getRedis', () => {
  it('deve lançar erro se faltar configuração', () => {
    expect(() => getRedis({} as NodeJS.ProcessEnv)).toThrow(/Redis não configurado/);
  });

  it('deve aceitar client injetado via _setRedisForTests', () => {
    const mock: RedisLike = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    _setRedisForTests(mock);
    const r = getRedis();
    expect(r).toBe(mock);
  });

  it('deve cachear instância entre chamadas', () => {
    const mock: RedisLike = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    _setRedisForTests(mock);
    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);
  });

  it('deve permitir resetar cache', () => {
    const mock1: RedisLike = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    const mock2: RedisLike = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    _setRedisForTests(mock1);
    const r1 = getRedis();
    _setRedisForTests(mock2);
    const r2 = getRedis();
    expect(r1).toBe(mock1);
    expect(r2).toBe(mock2);
  });

  it('deve preferir UPSTASH_* sobre KV_* quando ambos definidos', () => {
    const env = {
      UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      KV_REST_API_URL: 'https://kv.example.com',
      KV_REST_API_TOKEN: 'kv-token'
    } as NodeJS.ProcessEnv;

    expect(() => getRedis(env)).not.toThrow();
  });

  it('deve aceitar fallback KV_REST_API_URL/TOKEN', () => {
    const env = {
      KV_REST_API_URL: 'https://kv.example.com',
      KV_REST_API_TOKEN: 'kvtoken'
    } as NodeJS.ProcessEnv;

    expect(() => getRedis(env)).not.toThrow();
  });
});
