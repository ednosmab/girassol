import { registrarCuidadoComOutbox } from '../core/use-cases/registrar-cuidado-com-outbox';
import { db } from '../core/database/localforage-db';
import { outbox } from '../core/database/outbox-store';

beforeEach(async () => {
  const cuidados = await db.cuidados.keys();
  for (const k of cuidados) await db.cuidados.removeItem(k);

  const eventos = await outbox.listarTodos();
  for (const e of eventos) await outbox.remover(e.id);
});

describe('registrarCuidadoComOutbox', () => {
  it('deve salvar cuidado no IndexedDB', async () => {
    const resultado = await registrarCuidadoComOutbox({ tipo: 'rega' });
    expect(resultado.cuidado.id).toBeDefined();
    expect(resultado.cuidado.tipo).toBe('rega');
    expect(resultado.cuidado.timestamp).toBeDefined();
  });

  it('deve registrar evento na outbox', async () => {
    await registrarCuidadoComOutbox({ tipo: 'sol' });
    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBeGreaterThanOrEqual(1);
    expect(pendentes[0].type).toBe('care_registered');
    expect(pendentes[0].payload.careType).toBe('sol');
  });

  it('deve retornar sincronizado: false', async () => {
    const resultado = await registrarCuidadoComOutbox({ tipo: 'adubo' });
    expect(resultado.sincronizado).toBe(false);
  });

  it('deve funcionar para todos os tipos de cuidado', async () => {
    const rega = await registrarCuidadoComOutbox({ tipo: 'rega' });
    const sol = await registrarCuidadoComOutbox({ tipo: 'sol' });
    const adubo = await registrarCuidadoComOutbox({ tipo: 'adubo' });

    expect(rega.cuidado.tipo).toBe('rega');
    expect(sol.cuidado.tipo).toBe('sol');
    expect(adubo.cuidado.tipo).toBe('adubo');

    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBe(3);
  });

  it('deve gerar idempotencyKey único por evento', async () => {
    await registrarCuidadoComOutbox({ tipo: 'rega' });
    await registrarCuidadoComOutbox({ tipo: 'rega' });

    const pendentes = await outbox.listarPorStatus('pending');
    const keys = pendentes.map(e => e.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
