import { describe, expect, it } from 'vitest';
import { errosRecentes, filasDoPainel, filtrarAtividades, lerAtividade, lerBatimento, quandoNoPainel, situacaoDoRobo, tiposPresentes } from '.';

const AGORA = new Date(2026, 9, 21, 15, 0).getTime();
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();

const batidaPc = (extra: Record<string, unknown> = {}) => lerBatimento('pc', {
  robo: 'pc', maquina: 'PC-ESCRITORIO', versao: 'a1b2c3d de 21/10/2026', ligadoEm: ha(300), em: ha(0.5), desligadoEm: null,
  agora: [{ chave: 'fgts', texto: 'Emitindo FGTS 3/10 — 62 EMPRESA', desde: ha(4) }],
  modulos: [{ id: 'fgts', nome: 'FGTS Digital', ligado: true }, { id: 'sieg', nome: 'SIEG', ligado: false, motivo: 'falta a chave' }],
  filas: [
    { id: 'fgts', nome: 'FGTS Digital', esperando: 7, andamento: 1, maisAntigoEm: ha(12) },
    { id: 'alterdata', nome: 'Balancete do Alterdata', esperando: 0, andamento: 0, maisAntigoEm: '' },
    { id: 'sieg', nome: 'SIEG', esperando: 2, andamento: 0, maisAntigoEm: ha(90) },
  ],
  arquivados: { mes: '2026-10', hoje: 12, noMes: 340, execucoes: [{ id: 'EXEC-1', em: ha(60), arquivados: 12, clientes: 5 }] },
  ...extra,
});

describe('painel do robô', () => {
  it('lê o batimento e a atividade do banco (campos que faltam viram vazio)', () => {
    const b = batidaPc()!;
    expect(b.nome).toBe('Robô do PC');
    expect(b.desligadoEm).toBe('');
    expect(b.filas).toHaveLength(3);
    expect(b.arquivados?.hoje).toBe(12);
    expect(b.arquivados?.execucoes[0].naoIdentificados).toBe(0);
    expect(lerBatimento('vm', null)).toBeNull();
    expect(lerAtividade('a', { tipo: 'fgts', texto: 'x', erro: 'sim' })).toMatchObject({ robo: 'pc', erro: false, detalhe: '' });
  });

  it('a situação: ligado, atrasado, sem sinal e desligado', () => {
    const s = situacaoDoRobo('pc', batidaPc(), null, AGORA);
    expect([s.tom, s.rotulo, s.sinal, s.onde, s.ligadoDesde]).toEqual(['ok', 'Ligado', 'agora há pouco', 'PC do escritório', 'hoje, 10:00']);
    expect(s.agora).toEqual([{ texto: 'Emitindo FGTS 3/10 — 62 EMPRESA', ha: 'há 4 min' }]);
    expect(s.desligados.map(m => m.nome)).toEqual(['SIEG']);
    expect(s.ligados).toBe(1);
    expect(situacaoDoRobo('pc', batidaPc({ em: ha(5) }), null, AGORA).rotulo).toBe('Atrasado');
    const parado = situacaoDoRobo('pc', batidaPc({ em: ha(40) }), null, AGORA);
    expect([parado.tom, parado.rotulo, parado.agora]).toEqual(['erro', 'Sem sinal', []]);
    expect(situacaoDoRobo('pc', batidaPc({ desligadoEm: ha(2) }), null, AGORA).rotulo).toBe('Desligado');
  });

  it('sem o painel: o sinal antigo diz se está ligado, e o aviso pede para atualizar o robô', () => {
    const vivo = situacaoDoRobo('vm', null, { em: ha(1), maquina: 'robo-nilma', desligadoEm: '' }, AGORA);
    expect([vivo.tom, vivo.rotulo, vivo.maquina]).toEqual(['aviso', 'Ligado, sem o painel', 'robo-nilma']);
    expect(vivo.aviso).toMatch(/Atualize/);
    expect(situacaoDoRobo('vm', null, { em: ha(60), maquina: '', desligadoEm: '' }, AGORA).rotulo).toBe('Desligado');
    expect(situacaoDoRobo('vm', null, null, AGORA).tom).toBe('neutro');
  });

  it('as filas: as com pedido primeiro, a velha em atenção, a do robô parado em erro', () => {
    const f = filasDoPainel(batidaPc(), null, AGORA);
    expect(f.map(x => [x.id, x.tom, x.espera])).toEqual([['fgts', 'ok', 'há 12 min'], ['sieg', 'aviso', 'há 1 h'], ['alterdata', 'neutro', '']]);
    const parado = filasDoPainel(batidaPc({ em: ha(30) }), null, AGORA);
    expect(parado.find(x => x.id === 'fgts')?.tom).toBe('erro');
  });

  it('a atividade: o filtro por tipo e só erros, os tipos presentes e os erros das últimas 24 h', () => {
    const l = [
      lerAtividade('1', { em: ha(10), tipo: 'fgts', texto: 'Emitiu', erro: false }),
      lerAtividade('2', { em: ha(5), tipo: 'sieg', texto: 'Erro no SIEG', erro: true }),
      lerAtividade('3', { em: ha(60 * 30), tipo: 'fgts', texto: 'Erro velho', erro: true }),
    ];
    expect(filtrarAtividades(l, { tipo: 'todos', soErros: false }).map(a => a.id)).toEqual(['2', '1', '3']);
    expect(filtrarAtividades(l, { tipo: 'fgts', soErros: true }).map(a => a.id)).toEqual(['3']);
    expect(tiposPresentes(l)).toEqual([{ id: 'fgts', rotulo: 'FGTS', n: 2 }, { id: 'sieg', rotulo: 'SIEG', n: 1 }]);
    expect(errosRecentes(l, AGORA).map(a => a.id)).toEqual(['2']);
  });

  it('quando foi: hoje, ontem e a data', () => {
    expect(quandoNoPainel(new Date(2026, 9, 21, 9, 5).toISOString(), AGORA)).toBe('hoje, 09:05');
    expect(quandoNoPainel(new Date(2026, 9, 20, 18, 2).toISOString(), AGORA)).toBe('ontem, 18:02');
    expect(quandoNoPainel(new Date(2026, 9, 3, 7, 0).toISOString(), AGORA)).toBe('03/10, 07:00');
    expect(quandoNoPainel('', AGORA)).toBe('');
  });
});
