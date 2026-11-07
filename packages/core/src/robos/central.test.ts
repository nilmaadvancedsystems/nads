import { describe, expect, it } from 'vitest';
import { lerBatimento, type AtividadeDoRobo } from '../entregas';
import {
  ACOES, acoesDoRobo, buscarRobos, comandoSemResposta, errosDeHoje, lerComando, lerEstadoDaMaquina, lerRegistros, LINHAS_DO_REGISTRO,
  MAQUINAS, maquinaPorId, montarComando, primeiroNome, resumoDasFilas, roboDaAtividade, roboPorId, ROBOS, saudacao, situacaoDaMaquina,
  situacaoDoRoboNaCentral, tempoLigado, textoDoComando, VALIDADE_DO_COMANDO_MS,
} from './central';

const AGORA = Date.parse('2026-11-07T17:00:00.000Z');
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();
const quem = { uid: 'uid-vitor', nome: 'Vitor' };

describe('catálogo', () => {
  it('cada robô está numa máquina conhecida, com ícone e cor', () => {
    for (const r of ROBOS) {
      expect(maquinaPorId(r.maquina)).not.toBeNull();
      expect(r.icone).toBeTruthy();
      expect(r.cor).toHaveLength(2);
    }
  });
  it('ids únicos e lista fechada com as 7 ações', () => {
    expect(new Set(ROBOS.map(r => r.id)).size).toBe(ROBOS.length);
    expect(ACOES.map(a => a.id).sort()).toEqual(['assistir', 'atualizar', 'limpar-fila', 'pausar', 'reiniciar', 'retomar', 'rodar-agora']);
    expect(MAQUINAS.map(m => m.id)).toEqual(['servidor', 'nuvem', 'escritorio']);
  });
  it('cada máquina tem no máximo um robô "da casa" (as linhas sem marca)', () => {
    for (const m of MAQUINAS) expect(ROBOS.filter(r => r.maquina === m.id && r.tags.includes('')).length).toBeLessThanOrEqual(1);
  });
});

describe('saudação e textos', () => {
  it('bom dia, boa tarde, boa noite', () => {
    expect(saudacao(8)).toBe('Bom dia');
    expect(saudacao(14)).toBe('Boa tarde');
    expect(saudacao(20)).toBe('Boa noite');
    expect(saudacao(3)).toBe('Boa noite');
  });
  it('primeiro nome', () => { expect(primeiroNome('Vitor Hugo')).toBe('Vitor'); expect(primeiroNome('')).toBe(''); });
  it('tempo ligado', () => {
    expect(tempoLigado(600)).toBe('10 min');
    expect(tempoLigado(5 * 3600)).toBe('5 h');
    expect(tempoLigado(9 * 86400 + 4 * 3600)).toBe('9 d 4 h');
    expect(tempoLigado(null)).toBe('');
  });
});

describe('a situação da máquina', () => {
  const servidor = MAQUINAS[0];
  it('ligada pelo batimento do painel', () => {
    const b = lerBatimento('pc', { em: ha(1), maquina: 'NILMA-SERVER', ligadoEm: ha(100) });
    const s = situacaoDaMaquina(servidor, b, null, AGORA);
    expect([s.tom, s.rotulo, s.host]).toEqual(['ok', 'Ligada', 'NILMA-SERVER']);
    expect(s.sinais).toBeNull();
  });
  it('o estado da central mais novo que o batimento vale', () => {
    const b = lerBatimento('pc', { em: ha(30), maquina: 'NILMA-SERVER' });
    const e = lerEstadoDaMaquina('servidor', { em: ha(1), host: 'NILMA-SERVER', sinais: { cpu: 30, memoria: 70, disco: 50 } });
    const s = situacaoDaMaquina(servidor, b, e, AGORA);
    expect(s.tom).toBe('ok');
    expect(s.sinais?.cpu).toBe(30);
  });
  it('atrasada e sem sinal', () => {
    expect(situacaoDaMaquina(servidor, lerBatimento('pc', { em: ha(5) }), null, AGORA).rotulo).toBe('Atrasada');
    expect(situacaoDaMaquina(servidor, lerBatimento('pc', { em: ha(20) }), null, AGORA).tom).toBe('erro');
  });
  it('o PC do escritório só pelo estado da central', () => {
    const pc = maquinaPorId('escritorio')!;
    expect(situacaoDaMaquina(pc, null, null, AGORA).tom).toBe('neutro');
    expect(situacaoDaMaquina(pc, null, lerEstadoDaMaquina('escritorio', { em: ha(1), semGancho: ['atualizar'] }), AGORA)).toMatchObject({ tom: 'ok', semGancho: ['atualizar'] });
  });
});

describe('a situação do robô', () => {
  const sieg = roboPorId('sieg')!;
  const servidor = MAQUINAS[0];
  const b = lerBatimento('pc', {
    em: ha(1), maquina: 'NILMA-SERVER',
    agora: [{ chave: 'sieg', texto: 'SIEG: baixando', desde: ha(2) }, { chave: 'fgts', texto: 'FGTS', desde: '' }],
    modulos: [{ id: 'sieg', nome: 'SIEG', ligado: true }],
    filas: [{ id: 'sieg', nome: 'SIEG', esperando: 2, andamento: 1, maisAntigoEm: ha(5) }],
  });
  const ligada = situacaoDaMaquina(servidor, b, null, AGORA);
  const atividade = (id: string, min: number, tipo: string, erro = false): AtividadeDoRobo => ({ id, em: ha(min), robo: 'pc', maquina: 'S', tipo, texto: id, detalhe: '', erro });

  it('trabalhando, com a fila e o que está fazendo', () => {
    const s = situacaoDoRoboNaCentral(sieg, ligada, b, null, [atividade('a', 10, 'sieg')], AGORA);
    expect([s.tom, s.rotulo]).toEqual(['ok', 'Trabalhando']);
    expect(s.agora).toEqual(['SIEG: baixando']);
    expect(s.fila).toMatchObject({ esperando: 2, andamento: 1 });
    expect(s.ultimo?.id).toBe('a');
  });
  it('erro depois do último trabalho pede atenção', () => {
    const s = situacaoDoRoboNaCentral(sieg, ligada, b, null, [atividade('ok', 60, 'sieg'), atividade('erro', 5, 'sieg', true)], AGORA);
    expect([s.tom, s.rotulo, s.errosHoje]).toEqual(['aviso', 'Atenção', 1]);
  });
  it('máquina sem sinal: parado', () => {
    const parada = situacaoDaMaquina(servidor, lerBatimento('pc', { em: ha(30) }), null, AGORA);
    expect(situacaoDoRoboNaCentral(sieg, parada, b, null, [], AGORA)).toMatchObject({ tom: 'erro', rotulo: 'Parado', agora: [] });
  });
  it('pausado', () => {
    const e = lerEstadoDaMaquina('servidor', { em: ha(1), pausados: { sieg: { por: 'Vitor', em: ha(3) } } });
    expect(situacaoDoRoboNaCentral(sieg, ligada, b, e, [], AGORA)).toMatchObject({ rotulo: 'Pausado', pausa: { por: 'Vitor' } });
  });
  it('módulo que não ligou: parado com o motivo', () => {
    const b2 = lerBatimento('pc', { em: ha(1), modulos: [{ id: 'sieg', nome: 'SIEG', ligado: false, motivo: 'sem credencial' }] });
    expect(situacaoDoRoboNaCentral(sieg, ligada, b2, null, [], AGORA).motivo).toContain('sem credencial');
  });
  it('as filas e os erros de hoje nos widgets', () => {
    const s = situacaoDoRoboNaCentral(sieg, ligada, b, null, [], AGORA);
    expect(resumoDasFilas([s])).toMatchObject({ esperando: 2, andamento: 1, linhas: [{ robo: { id: 'sieg' } }] });
    expect(errosDeHoje([atividade('e1', 5, 'fgts', true), atividade('e2', 60 * 30, 'fgts', true), atividade('ok', 5, 'fgts')], AGORA).map(a => a.id)).toEqual(['e1']);
    expect(roboDaAtividade(atividade('x', 1, 'fgts'))?.id).toBe('fgts');
  });
});

describe('a busca', () => {
  it('sem acento, pelo nome e pela máquina', () => {
    expect(buscarRobos('sefaz').map(r => r.id)).toEqual(['sefaz']);
    expect(buscarRobos('nuvem').every(r => r.maquina === 'nuvem')).toBe(true);
    expect(buscarRobos('atendente').map(r => r.id)).toEqual(['ia']);
    expect(buscarRobos('')).toHaveLength(ROBOS.length);
  });
});

describe('as ações', () => {
  it('o que cada robô oferece', () => {
    expect(acoesDoRobo(roboPorId('ia')!, false).map(a => a.id)).toEqual(['pausar', 'reiniciar', 'atualizar']);
    expect(acoesDoRobo(roboPorId('ia')!, true).map(a => a.id)).toEqual(['retomar', 'reiniciar', 'atualizar']);
    expect(acoesDoRobo(roboPorId('arquivador')!, false).map(a => a.id)).toEqual(['rodar-agora', 'limpar-fila', 'reiniciar', 'atualizar']);
    expect(acoesDoRobo(roboPorId('nfse')!, false).map(a => a.id)).toEqual(['reiniciar', 'atualizar']);
  });
  it('o comando sai com os campos que as regras pedem', () => {
    const d = montarComando({ robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail' }, quem, AGORA);
    expect(Object.keys(d).sort()).toEqual(['acao', 'em', 'expiraEm', 'maquina', 'por', 'porNome', 'robo', 'status', 'tarefa']);
    expect(d).toMatchObject({ maquina: 'nuvem', robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail', por: 'uid-vitor', status: 'pendente', em: new Date(AGORA).toISOString() });
    expect(d.expiraEm.getTime() - AGORA).toBe(30 * 24 * 3600 * 1000);
  });
  it('a ação da máquina vai para a máquina do robô', () => {
    expect(montarComando({ robo: 'sieg', acao: 'reiniciar' }, quem, AGORA)).toMatchObject({ maquina: 'servidor', robo: 'sieg', tarefa: '' });
    expect(montarComando({ robo: '', maquina: 'nuvem', acao: 'atualizar' }, quem, AGORA)).toMatchObject({ maquina: 'nuvem', robo: '' });
  });
  it('recusa o que não está no catálogo', () => {
    expect(() => montarComando({ robo: 'sieg', acao: 'shell' }, quem)).toThrow(/desconhecida/);
    expect(() => montarComando({ robo: 'xyz', acao: 'pausar' }, quem)).toThrow(/desconhecido/);
    expect(() => montarComando({ robo: 'arquivador', acao: 'rodar-agora', tarefa: 'del *' }, quem)).toThrow(/Tarefa/);
    expect(() => montarComando({ robo: 'sieg', acao: 'pausar' }, quem)).toThrow(/pausar/);
    expect(() => montarComando({ robo: 'nfse', acao: 'limpar-fila' }, quem)).toThrow(/fila/);
    expect(() => montarComando({ robo: 'ia', acao: 'pausar' }, { uid: '', nome: '' })).toThrow(/conta/);
  });
  it('o histórico: leitura, texto e sem resposta', () => {
    const c = lerComando('c1', { maquina: 'nuvem', robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail', em: ha(1), status: 'feito', porNome: 'Vitor' });
    expect(textoDoComando(c)).toBe('Rodar agora: Ler o Gmail agora · Gmail e avisos');
    expect(textoDoComando(lerComando('c2', { maquina: 'servidor', acao: 'reiniciar', robo: '' }))).toBe('Reiniciar com calma · Servidor');
    expect(lerComando('c3', { status: 'qualquer' }).status).toBe('pendente');
    expect(comandoSemResposta(lerComando('c4', { status: 'pendente', em: new Date(AGORA - VALIDADE_DO_COMANDO_MS - 1).toISOString() }), AGORA)).toBe(true);
    expect(comandoSemResposta(lerComando('c5', { status: 'pendente', em: ha(1) }), AGORA)).toBe(false);
  });
});

describe('os registros', () => {
  it('lê as linhas, no máximo 200', () => {
    const linhas = Array.from({ length: 250 }, (_, i) => ({ em: ha(1), texto: 'l' + i, nivel: i % 50 ? 'info' : 'erro' }));
    const r = lerRegistros('sieg', { em: ha(1), linhas });
    expect(r.linhas).toHaveLength(LINHAS_DO_REGISTRO);
    expect(r.linhas[r.linhas.length - 1].texto).toBe('l249');
    expect(lerRegistros('sieg', null).linhas).toEqual([]);
  });
});
