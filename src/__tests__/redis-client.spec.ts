import { jest } from '@jest/globals';
import { getRedis, _setRedisForTests, RedisLike } from '../../api/shared/redis-client';

function createMock(): RedisLike {
  return {
    get: jest.fn() as any,
    set: jest.fn() as any,
    del: jest.fn() as any,
    keys: jest.fn() as any
  };
}

beforeEach(() => {
  _setRedisForTests(null);
});

describe('getRedis', () => {
  it('deve lançar erro se faltar configuração', () => {
    expect(() => getRedis({} as NodeJS.ProcessEnv)).toThrow(/Redis não configurado/);
  });

  it('deve aceitar client injetado via _setRedisForTests', () => {
    const mock = createMock();
    _setRedisForTests(mock);
    const r = getRedis();
    expect(r).toBe(mock);
  });

  it('deve cachear instância entre chamadas', () => {
    const mock = createMock();
    _setRedisForTests(mock);
    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);
  });

  it('deve permitir resetar cache', () => {
    const mock1 = createMock();
    const mock2 = createMock();
    _setRedisForTests(mock1);
    const r1 = getRedis();
    _setRedisForTests(mock2);
    const r2 = getRedis();
    expect(r1).toBe(mock1);
    expect(r2).toBe(mock2);
  });
});
