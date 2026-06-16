import { jest } from '@jest/globals';
import { checkRateLimit, pruneExpiredBuckets, _resetRateLimitForTests } from '../../api/_shared/rate-limit';

beforeEach(() => {
  _resetRateLimitForTests();
});

describe('checkRateLimit', () => {
  it('deve permitir primeira request', () => {
    const r = checkRateLimit('ip:test');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });

  it('deve contar até 10 requests na janela', () => {
    for (let i = 0; i < 9; i++) checkRateLimit('ip:test');
    const r = checkRateLimit('ip:test');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('deve bloquear 11ª request', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('ip:test');
    const r = checkRateLimit('ip:test');
    expect(r.allowed).toBe(false);
  });

  it('deve isolar buckets por chave', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('ip:a');
    const r = checkRateLimit('ip:b');
    expect(r.allowed).toBe(true);
  });

  it('deve resetar bucket após janela expirar', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('ip:test');
    const realNow = Date.now;
    Date.now = jest.fn(() => realNow() + 61_000);
    try {
      const r = checkRateLimit('ip:test');
      expect(r.allowed).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('pruneExpiredBuckets', () => {
  it('deve remover buckets expirados', () => {
    checkRateLimit('ip:expire');
    const realNow = Date.now;
    Date.now = jest.fn(() => realNow() + 120_000);
    try {
      const pruned = pruneExpiredBuckets();
      expect(pruned).toBeGreaterThanOrEqual(1);
    } finally {
      Date.now = realNow;
    }
  });

  it('não deve remover buckets ativos', () => {
    checkRateLimit('ip:active');
    const pruned = pruneExpiredBuckets();
    expect(pruned).toBe(0);
  });
});
