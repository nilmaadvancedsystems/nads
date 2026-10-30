import { describe, expect, it } from 'vitest';
import { criarRepoTarefasMemoria } from '../repo.memoria';
import type { Execucao } from '../tipos';
import { dispensar, execucaoNova, fazer, informarValor, marcarSemMovimento, voltarPara, adicionarEtapa, definirPeriodo } from './execucao';
import { aplicarDiferenca, diferencaDaExecucao, igualPorConteudo } from './gravacaoDaExecucao';

const AGORA = new Date('2026-10-30T12:00:00Z');
const base = (): Execucao => ({ ...execucaoNova('Alfa', 14, '2026-09', 'fiscal'), etapas: { extratos: { situacao: 'feita', por: 'Nilma', em: '2026-10-01T00:00:00Z' } } });

describe('a diferença da execução (30/10/2026)', () => {
  it('só o que mudou: a etapa, o valor, os itens da lista e o campo', () => {
    const ex = base();
    expect(diferencaDaExecucao(ex, ex)).toEqual([]);
    const f = fazer(ex, 'razao', 'Vitor', AGORA).execucao;
    expect(diferencaDaExecucao(ex, f)).toEqual([{ caminho: ['etapas', 'razao'], valor: f.etapas.razao }]);
    expect(diferencaDaExecucao(ex, informarValor(ex, 'x', 'fiscalXmls', 12, 'V', AGORA).execucao)).toEqual([{ caminho: ['valores', 'fiscalXmls'], valor: 12 }]);
    expect(diferencaDaExecucao(ex, voltarPara(ex, 'extratos', 'V', AGORA).execucao)).toEqual([{ caminho: ['etapas', 'extratos'], apagar: true }]);
    expect(diferencaDaExecucao(ex, marcarSemMovimento(ex, 'extratos', 'sicoob', true, 'V', AGORA).execucao)).toEqual([{ caminho: ['semMovimento'], juntar: ['sicoob'] }]);
    const comBanco = { ...ex, semMovimento: ['sicoob', 'bb'] };
    expect(diferencaDaExecucao(comBanco, marcarSemMovimento(comBanco, 'extratos', 'bb', false, 'V', AGORA).execucao)).toEqual([{ caminho: ['semMovimento'], tirar: ['bb'] }]);
    const comPeriodo = definirPeriodo(ex, '2026-08..2026-09', 'V', AGORA).execucao;
    expect(diferencaDaExecucao(ex, comPeriodo)).toEqual([{ caminho: ['periodo'], valor: '2026-08..2026-09' }]);
    expect(diferencaDaExecucao(comPeriodo, definirPeriodo(comPeriodo, null, 'V', AGORA).execucao)).toEqual([{ caminho: ['periodo'], apagar: true }]);
  });
  it('a ordem das chaves não conta', () => {
    expect(igualPorConteudo({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(igualPorConteudo({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(igualPorConteudo([1, 2], [2, 1])).toBe(false);
  });
  it('vários valores informados a partir da mesma cópia ficam todos (antes só o último ficava)', () => {
    const ex = base();
    let noBanco = ex;
    for (const [chave, n] of [['fiscalXmls', 30], ['fiscalFaltam', 2], ['fiscalValores', 1]] as const) {
      const v = informarValor(ex, 'conferencia', chave, n, 'Vitor', AGORA);
      noBanco = aplicarDiferenca(noBanco, diferencaDaExecucao(ex, v.execucao));
    }
    expect(noBanco.valores).toEqual({ fiscalXmls: 30, fiscalFaltam: 2, fiscalValores: 1 });
  });
  it('o "Não se aplica" e o "Desmarcar" depois da janela não apagam o que chegou com ela aberta', () => {
    const doClique = base();
    // com a janela aberta, outra gravação marcou o razão e informou um valor
    const agora = informarValor(fazer(doClique, 'razao', 'Clara', AGORA).execucao, 'x', 'irMerc', 1000, 'Clara', AGORA).execucao;
    const dispensada = dispensar(doClique, 'cheque-especial', 'sem-saldo-negativo', '', 'Vitor', AGORA).execucao;
    const depois = aplicarDiferenca(agora, diferencaDaExecucao(doClique, dispensada));
    expect(depois.etapas.razao?.situacao).toBe('feita');
    expect(depois.etapas['cheque-especial']?.situacao).toBe('dispensada');
    expect(depois.valores).toEqual({ irMerc: 1000 });
    const desmarcada = aplicarDiferenca(agora, diferencaDaExecucao(doClique, voltarPara(doClique, 'extratos', 'Vitor', AGORA).execucao));
    expect(desmarcada.etapas.extratos).toBeUndefined();
    expect(desmarcada.etapas.razao?.situacao).toBe('feita');
  });
  it('duas listas mexidas a partir da mesma cópia: as duas ficam', () => {
    const ex = base();
    const a = adicionarEtapa(ex, 'cartoes', 'Cadastro', 'V', AGORA).execucao;
    const b = adicionarEtapa(ex, 'vendas-cartao', 'Cadastro', 'V', AGORA).execucao;
    const junto = aplicarDiferenca(aplicarDiferenca(ex, diferencaDaExecucao(ex, a)), diferencaDaExecucao(ex, b));
    expect(junto.adicionadas).toEqual(['cartoes', 'vendas-cartao']);
  });
});

describe('o repositório de exemplo com a cópia de onde partiu', () => {
  it('grava só o que mudou sobre a execução como está', () => {
    const repo = criarRepoTarefasMemoria({ guarda: null });
    const ex = base();
    repo.gravar(ex, { tipo: 'feita', etapa: 'extratos', por: 'Nilma', em: AGORA.toISOString() });
    for (const [chave, n] of [['fiscalXmls', 30], ['fiscalFaltam', 2]] as const) {
      const v = informarValor(ex, 'conferencia', chave, n, 'Vitor', AGORA);
      repo.gravar(v.execucao, v.evento, ex);
    }
    const gravada = repo.execucoes('2026-09', 'fiscal').find(e => e.empresa === 'Alfa');
    expect(gravada?.valores).toEqual({ fiscalXmls: 30, fiscalFaltam: 2 });
    expect(gravada?.etapas.extratos?.situacao).toBe('feita');
  });
});
