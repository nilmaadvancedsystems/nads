import { describe, expect, it } from 'vitest';
import { empresasDeExemplo } from '../__exemplos__/empresas';
import { FILTRO_MOVIMENTO_VAZIO } from '../tipos';
import { cadastroServicos, conferirServicos } from './servicosConferencia';

const [comercio, medicos] = empresasDeExemplo();

describe('conferirServicos (tomados do comércio)', () => {
  const r = conferirServicos(comercio, 'tomados', FILTRO_MOVIMENTO_VAZIO, 'nome');

  it('internet lançada com 527 fica fora do padrão (esperado 52)', () => {
    const g = r.pendentes.find(x => x.nome === 'PROVEDOR LAMBDA INTERNET LTDA');
    expect(g?.cat.id).toBe('internet');
    expect(g?.itens.map(i => i.nota.numero)).toEqual(['7702']);
    expect(g?.sugerirCategorias).toEqual([]);
  });
  it('sistema na categoria geral com 503: sugere Locação de sistemas', () => {
    const g = r.pendentes.find(x => x.nome === 'SISTEMAS NU SOFTWARE LTDA');
    expect(g?.cat.id).toBe('geral');
    expect(g?.sugerirCategorias.map(c => c.nome)).toEqual(['Locação de sistemas']);
  });
  it('contagens', () => {
    expect(r.qtdForaDoPadrao).toBe(2);
    expect(r.qtdNotas).toBe(8);
    expect(r.temDivergencias).toBe(true);
  });
  it('corrigida sai das pendentes', () => {
    const k = 'serv:tomados|7702|08/08/2026|PROVEDOR LAMBDA INTERNET LTDA|129.90';
    const r2 = conferirServicos({ ...comercio, divResolvidos: [k] }, 'tomados', FILTRO_MOVIMENTO_VAZIO, 'nome');
    expect(r2.qtdForaDoPadrao).toBe(1);
    expect(r2.qtdCorrigidos).toBe(1);
  });
  it('conciliação por conta da categoria (telefone bate)', () => {
    const tel = r.saldo.find(l => l.contas.join() === '31109');
    expect(tel?.situacao.tipo).toBe('ok');
  });
});

describe('conferirServicos (prestados dos médicos)', () => {
  it('prestado lançado com 527 fica fora do padrão, sem sugestão', () => {
    const r = conferirServicos(medicos, 'prestados', FILTRO_MOVIMENTO_VAZIO, 'valor');
    expect(r.qtdForaDoPadrao).toBe(1);
    expect(r.pendentes[0].sugerirCategorias).toEqual([]);
  });
});

describe('cadastroServicos', () => {
  const c = cadastroServicos(comercio, 'tomados');
  it('lista as categorias padrão com a conta de cada uma', () => {
    expect(c.map(x => x.cat.id)).toEqual(['geral', 'honorario', 'telefone', 'internet', 'viagem', 'sistemas']);
    expect(c[0].chaveConta).toBe('serv|tomados|*');
    expect(c[0].contas).toEqual(['31130']);
  });
  it('Honorário é travado e não lista participantes', () => {
    const h = c.find(x => x.cat.id === 'honorario');
    expect(h?.cat.travado).toBe(true);
    expect(h?.participantes).toEqual([]);
  });
  it('telefone lista o participante; sistemas sugere quem usou 503', () => {
    expect(c.find(x => x.cat.id === 'telefone')?.participantes.map(p => p.nome)).toEqual(['TELEFONIA KAPPA S.A.']);
    expect(c.find(x => x.cat.id === 'sistemas')?.sugestoes).toEqual(['SISTEMAS NU SOFTWARE LTDA']);
  });
});
