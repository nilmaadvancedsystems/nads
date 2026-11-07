import { describe, expect, it } from 'vitest';
import { cartaoDoBackup, cartaoDoRobo, cartoesDosRobos, estadoDaMaquina, lerAtividade, lerBatimento, placarDaSaude, ROBOS_DA_SAUDE } from '.';

const AGORA = new Date(2026, 10, 7, 15, 0).getTime();
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();
const def = (id: string) => ROBOS_DA_SAUDE.find(r => r.id === id)!;

const pc = (extra: Record<string, unknown> = {}) => lerBatimento('pc', {
  robo: 'pc', maquina: 'NILMA-SERVER', ligadoEm: ha(600), em: ha(0.5), desligadoEm: null, agora: [{ chave: 'fgts', texto: 'Emitindo FGTS 2/5', desde: ha(3) }],
  modulos: [{ id: 'fgts', nome: 'FGTS Digital', ligado: true }, { id: 'sieg', nome: 'SIEG', ligado: true }, { id: 'alterdata', nome: 'Alterdata', ligado: false, motivo: 'o Contábil está fechado' }],
  filas: [
    { id: 'fgts', nome: 'FGTS Digital', esperando: 4, andamento: 1, maisAntigoEm: ha(10) },
    { id: 'sieg', nome: 'SIEG', esperando: 2, andamento: 0, maisAntigoEm: ha(120) },
  ],
  ultimos: { fgts: { trabalho: { em: ha(20), texto: 'Emitiu a guia do FGTS de X' }, erro: null }, sieg: { trabalho: { em: ha(300), texto: 'Baixou os XMLs de 292' }, erro: { em: ha(30), texto: 'O SIEG deu erro', detalhe: 'a API recusou' } } },
  ...extra,
});

describe('saúde dos robôs', () => {
  it('a máquina: em dia, atrasada (3 min), parada (15 min), desligada e sem painel', () => {
    expect(estadoDaMaquina(pc(), AGORA).tom).toBe('ok');
    expect(estadoDaMaquina(pc({ em: ha(5) }), AGORA).tom).toBe('aviso');
    expect(estadoDaMaquina(pc({ em: ha(14) }), AGORA).tom).toBe('aviso');
    expect(estadoDaMaquina(pc({ em: ha(16) }), AGORA).tom).toBe('erro');
    expect(estadoDaMaquina(pc({ desligadoEm: ha(2) }), AGORA)).toMatchObject({ tom: 'erro', sinal: 'desligou há 2 min' });
    expect(estadoDaMaquina(null, AGORA).tom).toBe('neutro');
  });

  it('ok: batimento em dia, fila nova, sem erro; mostra o último trabalho, a fila e o que está fazendo', () => {
    const c = cartaoDoRobo(def('fgts'), pc(), null, [], AGORA);
    expect(c).toMatchObject({ tom: 'ok', rotulo: 'Ok', motivos: [], batimento: 'agora há pouco' });
    expect(c.ultimoTrabalho).toEqual({ texto: 'Emitiu a guia do FGTS de X', quando: 'hoje, 14:40' });
    expect(c.fila).toMatchObject({ esperando: 4, andamento: 1, maisAntigo: 'há 10 min' });
    expect(c.fazendo).toEqual(['Emitindo FGTS 2/5']);
    expect(c.onde).toContain('NILMA-SERVER');
  });

  it('parado: sem batimento há mais de 15 min, e não mostra o "fazendo" velho', () => {
    const c = cartaoDoRobo(def('fgts'), pc({ em: ha(40) }), null, [], AGORA);
    expect(c.tom).toBe('erro');
    expect(c.rotulo).toBe('Parado');
    expect(c.fazendo).toEqual([]);
    expect(c.motivos[0]).toMatch(/sem batimento há 40 min/);
  });

  it('atenção: pedido esperando há mais de 1 h, erro sem trabalho depois e módulo desligado', () => {
    const fila = cartaoDoRobo(def('sieg'), pc({ ultimos: {} }), null, [], AGORA);
    expect(fila.tom).toBe('aviso');
    expect(fila.motivos.join()).toMatch(/pedido esperando há 2 h/);
    const erro = cartaoDoRobo(def('sieg'), pc({ filas: [] }), null, [], AGORA);
    expect(erro.tom).toBe('aviso');
    expect(erro.motivos.join()).toMatch(/erro há 30 min sem trabalho depois/);
    expect(erro.erros).toEqual([{ id: ha(30) + '|O SIEG deu erro', texto: 'O SIEG deu erro', detalhe: 'a API recusou', quando: 'hoje, 14:30' }]);
    const modulo = cartaoDoRobo(def('alterdata'), pc(), null, [], AGORA);
    expect(modulo.tom).toBe('aviso');
    expect(modulo.motivos).toEqual(['desligado: o Contábil está fechado']);
  });

  it('erro seguido de trabalho já passou: continua ok (e o erro fica na lista)', () => {
    const a = [lerAtividade('1', { em: ha(10), robo: 'pc', tipo: 'sieg', texto: 'Baixou os XMLs de 58', erro: false })];
    const c = cartaoDoRobo(def('sieg'), pc({ filas: [] }), null, a, AGORA);
    expect(c.tom).toBe('ok');
    expect(c.ultimoTrabalho?.texto).toBe('Baixou os XMLs de 58');
    expect(c.erros).toHaveLength(1);
  });

  it('a atividade completa o que o robô ainda não manda no batimento; erro com mais de 24 h não conta', () => {
    const a = [
      lerAtividade('1', { em: ha(15), robo: 'vm', tipo: 'nfse', texto: 'Emitiu a NFS-e nº 9', erro: false }),
      lerAtividade('2', { em: ha(60 * 30), robo: 'vm', tipo: 'nfse', texto: 'Uma NFS-e não saiu', erro: true }),
      lerAtividade('3', { em: ha(15), robo: 'pc', tipo: 'nfse', texto: 'de outro robô', erro: true }),
    ];
    const vm = lerBatimento('vm', { robo: 'vm', maquina: 'robo-nilma', em: ha(1), filas: [], modulos: [] });
    const c = cartaoDoRobo(def('nfse'), null, vm, a, AGORA);
    expect(c).toMatchObject({ tom: 'ok', erros: [] });
    expect(c.ultimoTrabalho?.texto).toBe('Emitiu a NFS-e nº 9');
  });

  it('sem painel: sem informação, e um cartão por robô da lista', () => {
    const c = cartaoDoRobo(def('nfse'), null, null, [], AGORA);
    expect(c).toMatchObject({ tom: 'neutro', rotulo: 'Sem informação' });
    const todos = cartoesDosRobos({ carregado: true, semPermissao: false, pc: pc(), vm: null, sinais: { pc: null, vm: null }, atividades: [] }, AGORA);
    expect(todos.map(x => x.id)).toEqual(ROBOS_DA_SAUDE.map(x => x.id));
  });

  it('backup: ok, falhou (parado), velho (atenção) e dependente da nuvem', () => {
    const vm = lerBatimento('vm', { robo: 'vm', maquina: 'robo-nilma', em: ha(1) });
    const bom = { backup: { ok: true, em: ha(120), resumo: '41 coleções, 83 MB' }, backupTentativas: { dia: '2026-11-07', backup: 1, planilha: 1, drive: 0 } };
    expect(cartaoDoBackup(bom, vm, AGORA)).toMatchObject({ tom: 'ok', fila: null, nota: 'Tentativas hoje: backup 1, planilha 1, Drive 0' });
    expect(cartaoDoBackup({ backup: { ok: false, em: ha(1600), tentadoEm: ha(5), resumo: 'sem espaço' } }, vm, AGORA)).toMatchObject({ tom: 'erro', rotulo: 'Parado' });
    expect(cartaoDoBackup({ backup: { ok: true, em: ha(60 * 31) } }, vm, AGORA).tom).toBe('aviso');
    expect(cartaoDoBackup(bom, lerBatimento('vm', { robo: 'vm', em: ha(30) }), AGORA).tom).toBe('aviso');
    expect(cartaoDoBackup(null, vm, AGORA).tom).toBe('neutro');
  });

  it('o placar conta por estado', () => {
    const c = (tom: 'ok' | 'aviso' | 'erro' | 'neutro') => ({ tom }) as never;
    expect(placarDaSaude([c('ok'), c('aviso'), c('erro'), c('neutro'), c('ok')])).toEqual({ parados: 1, atencao: 1, ok: 2, semInfo: 1, tom: 'erro' });
    expect(placarDaSaude([c('ok')]).tom).toBe('ok');
  });
});
