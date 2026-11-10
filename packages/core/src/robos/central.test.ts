import { describe, expect, it } from 'vitest';
import { lerBatimento, type AtividadeDoRobo } from '../entregas';
import {
  ACOES, acoesDoRobo, buscarRobos, comandoSemResposta, errosDeHoje, lerComando, lerEstadoDaMaquina, lerRegistros, LINHAS_DO_REGISTRO,
  MAQUINAS, maquinaPorId, montarComando, primeiroNome, resumoDasFilas, roboDaAtividade, roboPorId, ROBOS, saudacao, situacaoDaMaquina,
  situacaoDoRoboNaCentral, tempoLigado, textoDoComando, VALIDADE_DO_COMANDO_MS,
  ateDaHora, codigoDoCampo, competenciaAnterior, estadoDoRefazer, lerItemDaFila, ordenarFila, pausaGeral, quandoVolta, type Comando,
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
  it('ids únicos e lista fechada com as 13 ações', () => {
    expect(new Set(ROBOS.map(r => r.id)).size).toBe(ROBOS.length);
    expect(ACOES.map(a => a.id).sort()).toEqual(['assistir', 'atualizar', 'cancelar-item', 'limpar-fila', 'na-frente', 'parar-tudo', 'pausar', 'pedir-cliente', 'refazer', 'reiniciar', 'retomar', 'retomar-tudo', 'rodar-agora']);
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
    expect(situacaoDaMaquina(servidor, lerBatimento('pc', { em: ha(5) }), null, AGORA).rotulo).toBe('Ligada');
    expect(situacaoDaMaquina(servidor, lerBatimento('pc', { em: ha(8) }), null, AGORA).rotulo).toBe('Atrasada');
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
    expect(() => montarComando({ robo: 'arquivador', acao: 'pausar' }, quem)).toThrow(/pausar/);
    expect(() => montarComando({ robo: 'nfse', acao: 'limpar-fila' }, quem)).toThrow(/fila/);
    expect(() => montarComando({ robo: 'ia', acao: 'pausar' }, { uid: '', nome: '' })).toThrow(/conta/);
  });
  it('o histórico: leitura, texto e sem resposta', () => {
    const c = lerComando('c1', { maquina: 'nuvem', robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail', em: ha(1), status: 'feito', porNome: 'Vitor' });
    expect(textoDoComando(c)).toBe('Gmail e avisos: ler o Gmail agora');
    expect(textoDoComando(lerComando('c2', { maquina: 'servidor', acao: 'reiniciar', robo: '' }))).toBe('Servidor: reiniciar com calma');
    expect(lerComando('c3', { status: 'qualquer' }).status).toBe('pendente');
    expect(comandoSemResposta(lerComando('c4', { status: 'pendente', em: new Date(AGORA - VALIDADE_DO_COMANDO_MS - 1).toISOString() }), AGORA)).toBe(true);
    expect(comandoSemResposta(lerComando('c5', { status: 'pendente', em: ha(1) }), AGORA)).toBe(false);
  });
});

describe('os controles', () => {
  const comando = (extra: Partial<Comando>): Comando => ({ id: 'c', maquina: 'servidor', robo: 'fgts', acao: 'refazer', tarefa: '', por: 'u', porNome: 'V', em: ha(1), status: 'feito', mensagem: '', respondidoEm: '', ...extra });
  const erro = (extra = {}) => ({ id: 'a', em: ha(5), robo: 'pc' as const, maquina: 'S', tipo: 'fgts', texto: 'A guia não saiu', detalhe: '', erro: true, pedido: 'p1', ...extra });

  it('o item, o cliente e a competência saem no comando só nas ações que usam', () => {
    expect(montarComando({ robo: 'fgts', acao: 'cancelar-item', item: 'abc123', rotulo: '486 VS (10/2026)' }, quem, AGORA)).toMatchObject({ item: 'abc123', rotulo: '486 VS (10/2026)', tarefa: '' });
    expect(montarComando({ robo: 'sieg', acao: 'pedir-cliente', tarefa: 'xmls', cliente: '292', competencia: '2026-10' }, quem, AGORA)).toMatchObject({ tarefa: 'xmls', cliente: '292', competencia: '2026-10' });
    expect(Object.keys(montarComando({ robo: 'ia', acao: 'retomar', item: 'x', cliente: '1' }, quem, AGORA))).not.toContain('item');
  });
  it('recusa formato e o que a fila não deixa', () => {
    expect(() => montarComando({ robo: 'fgts', acao: 'refazer', item: '../x' }, quem)).toThrow(/inválido/);
    expect(() => montarComando({ robo: 'arquivador', acao: 'cancelar-item', item: 'abc' }, quem)).toThrow(/não deixa/);
    expect(() => montarComando({ robo: 'nfse', acao: 'na-frente', item: 'abc' }, quem)).toThrow(/não deixa/);
    expect(() => montarComando({ robo: 'sieg', acao: 'pedir-cliente', tarefa: 'rm -rf', cliente: '1', competencia: '2026-10' }, quem)).toThrow(/desconhecido/);
    expect(() => montarComando({ robo: 'sieg', acao: 'pedir-cliente', tarefa: 'xmls', cliente: '1;del', competencia: '2026-10' }, quem)).toThrow(/código/);
    expect(() => montarComando({ robo: 'sieg', acao: 'pedir-cliente', tarefa: 'xmls', cliente: '1', competencia: '10/2026' }, quem)).toThrow(/competência/);
  });
  it('a hora de voltar: só no futuro e até 7 dias', () => {
    const ate = new Date(AGORA + 3600000).toISOString();
    expect(montarComando({ robo: 'ia', acao: 'pausar', ate }, quem, AGORA).ate).toBe(ate);
    expect(montarComando({ robo: '', maquina: 'servidor', acao: 'parar-tudo', ate }, quem, AGORA)).toMatchObject({ maquina: 'servidor', robo: '', ate });
    expect(() => montarComando({ robo: 'ia', acao: 'pausar', ate: ha(1) }, quem, AGORA)).toThrow(/passou/);
    expect(() => montarComando({ robo: 'ia', acao: 'pausar', ate: new Date(AGORA + 8 * 86400000).toISOString() }, quem, AGORA)).toThrow(/7 dias/);
  });
  it('o texto no histórico', () => {
    expect(textoDoComando({ acao: 'pedir-cliente', robo: 'fgts', tarefa: 'guia', maquina: 'servidor', cliente: '486', competencia: '2026-10' })).toBe('FGTS Digital: emitir a guia, cliente 486 (10/2026)');
    expect(textoDoComando({ acao: 'refazer', robo: 'fgts', tarefa: '', maquina: 'servidor', rotulo: 'A guia de 486' })).toBe('FGTS Digital: refazer · A guia de 486');
    expect(textoDoComando({ acao: 'parar-tudo', robo: '', tarefa: '', maquina: 'servidor' })).toBe('Servidor: parar tudo');
  });
  it('o item da fila: título, o que é e o que dá para fazer', () => {
    const fgts = roboPorId('fgts')!;
    expect(lerItemDaFila(fgts, 'p1', { status: 'pendente', codigo: '486', empresa: 'VS MEDICINA', competencia: '2026-10', modo: 'emitir', criadoPor: 'Ana', criadoEm: ha(5) }))
      .toMatchObject({ titulo: '486 VS MEDICINA (10/2026)', detalhe: 'Emitir a guia', rotulo: 'Na fila', emAndamento: false, podeCancelar: true, podePassarNaFrente: true });
    expect(lerItemDaFila(fgts, 'p2', { status: 'trabalhando', codigo: '1' })).toMatchObject({ emAndamento: true, podeCancelar: false, podePassarNaFrente: false, rotulo: 'Fazendo' });
    expect(lerItemDaFila(roboPorId('arquivador')!, 'p3', { status: 'pendente', modo: 'PRODUCAO' })).toMatchObject({ titulo: 'Arquivar agora', podeCancelar: false, podePassarNaFrente: false });
    expect(lerItemDaFila(roboPorId('sieg')!, 'p4', { status: 'pendente', codigo: '292', competencia: '2026-10', tipo: 'xmls' })).toMatchObject({ titulo: '292 (10/2026)', detalhe: 'Baixar os XMLs' });
  });
  it('a ordem da fila: andando, na frente, mais antigo', () => {
    const fgts = roboPorId('fgts')!;
    const i = (id: string, status: string, min: number, naFrenteEm = '') => lerItemDaFila(fgts, id, { status, criadoEm: ha(min), naFrenteEm });
    expect(ordenarFila([i('novo', 'pendente', 1), i('velho', 'pendente', 50), i('frente', 'pendente', 2, ha(1)), i('andando', 'trabalhando', 3)]).map(x => x.id)).toEqual(['andando', 'frente', 'velho', 'novo']);
  });
  it('o Refazer: só com pedido e em robô que deixa; depois de pedido, some', () => {
    expect(estadoDoRefazer(erro(), [], AGORA)).toBe('pode');
    expect(estadoDoRefazer(erro({ pedido: undefined }), [], AGORA)).toBe('nao');
    expect(estadoDoRefazer(erro({ tipo: 'nfse', robo: 'vm' }), [], AGORA)).toBe('nao');
    expect(estadoDoRefazer(erro(), [comando({ item: 'p1' })], AGORA)).toBe('pedido');
    expect(estadoDoRefazer(erro(), [comando({ item: 'p1', status: 'recusado' })], AGORA)).toBe('pode');
    expect(estadoDoRefazer(erro(), [comando({ item: 'p1', em: ha(30) })], AGORA)).toBe('pode');
    expect(estadoDoRefazer(erro(), [comando({ item: 'p2' })], AGORA)).toBe('pode');
  });
  it('a pausa geral: quem para, quem fica e a volta', () => {
    const b = lerBatimento('pc', { em: ha(1) });
    const m = (id: 'servidor' | 'escritorio') => situacaoDaMaquina(maquinaPorId(id)!, b, null, AGORA);
    const ate = new Date(AGORA + 3600000).toISOString();
    const eS = lerEstadoDaMaquina('servidor', { em: ha(1), pausados: { fgts: { por: 'Vitor', em: ha(2), ate } } });
    const sit = (id: string, e: ReturnType<typeof lerEstadoDaMaquina>) => situacaoDoRoboNaCentral(roboPorId(id)!, m(roboPorId(id)!.maquina === 'servidor' ? 'servidor' : 'escritorio'), b, e, [], AGORA);
    const g = pausaGeral([sit('fgts', eS), sit('sieg', eS), sit('arquivador', eS), sit('ia', null)]);
    expect(g.pausaveis.map(r => r.id)).toEqual(['fgts', 'sieg', 'ia']);
    expect(g.pausados.map(s => s.robo.id)).toEqual(['fgts']);
    expect(g.naoPausam.map(r => r.id)).toEqual(['arquivador']);
    expect(g.paraParar.map(x => x.id)).toEqual(['servidor', 'escritorio']);
    expect(g.paraRetomar.map(x => x.id)).toEqual(['servidor']);
    expect(g.voltaEm).toBe(ate);
    expect(sit('fgts', eS).motivo).toContain('volta às');
  });
  it('as horas e a competência', () => {
    const d = new Date(AGORA); d.setHours(17, 30, 0, 0);
    const base = d.getTime();
    const hoje = new Date(ateDaHora('18:30', base));
    expect([hoje.getDate(), hoje.getHours(), hoje.getMinutes()]).toEqual([d.getDate(), 18, 30]);
    expect(new Date(ateDaHora('08:00', base)).getDate()).not.toBe(d.getDate());
    expect(ateDaHora('25:00', base)).toBe('');
    expect(quandoVolta(new Date(base + 3600000).toISOString(), base)).toMatch(/^às 18:30$/);
    expect(quandoVolta(new Date(base + 2 * 86400000).toISOString(), base)).toMatch(/^em \d{2}\/\d{2} às 17:30$/);
    expect(competenciaAnterior(new Date(2026, 0, 15).getTime())).toBe('2025-12');
    expect(codigoDoCampo('486 VS MEDICINA')).toBe('486');
    expect(codigoDoCampo('VS 486')).toBe('');
  });
  it('as filas do catálogo: os três robôs que mexem têm os pedidos para cliente', () => {
    expect(ROBOS.filter(r => r.itens?.refazer).map(r => r.id).sort()).toEqual(['alterdata', 'fgts', 'sieg']);
    expect(ROBOS.filter(r => r.pedidos?.length).map(r => r.id).sort()).toEqual(['alterdata', 'fgts', 'sieg']);
    expect(ROBOS.filter(r => r.pausavel).map(r => r.id).sort()).toEqual(['alterdata', 'fgts', 'ia', 'sieg']);
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
