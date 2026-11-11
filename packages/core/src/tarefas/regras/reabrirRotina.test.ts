// Reabrir a empresa concluída (11/11/2026): a etapa escolhida volta a pendente, o resto fica, e a execução guarda quem
// reabriu e quando. Dados fictícios.
import { describe, expect, it } from 'vitest';
import type { Execucao, Rotina } from '../tipos';
import { dispensar, execucaoNova, fazer, reaberturaEmAberto, reabrirRotina, ROTINA_REABERTA, situacaoDa, situacaoGeral } from './execucao';
import { aplicarDiferenca, diferencaDaExecucao } from './gravacaoDaExecucao';

const agora = new Date('2026-11-10T12:00:00.000Z');
const depois = new Date('2026-11-11T15:30:00.000Z');
const etapa = (id: string) => ({ id, nome: id.toUpperCase(), objecoes: [] }) as unknown as Rotina['etapas'][number];
const R = { departamento: 'contabil', etapas: [etapa('a'), etapa('b'), etapa('c')] } as unknown as Rotina;

/** a, feita; b, "não se aplica"; c, feita: a rotina concluída */
function concluida(): Execucao {
  let ex = execucaoNova('Empresa Teste', 1, '2026-10', 'contabil');
  ex = fazer(ex, 'a', 'Ana', agora).execucao;
  ex = dispensar(ex, 'b', 'sem-doc', 'nada no mês', 'Ana', agora).execucao;
  return fazer(ex, 'c', 'Ana', agora).execucao;
}

describe('reabrirRotina', () => {
  it('a etapa escolhida volta a pendente e a empresa sai de Concluída', () => {
    const ex = concluida();
    expect(situacaoGeral(ex, R)).toBe('concluida');
    const r = reabrirRotina(ex, R, 'b', 'Bia', depois)!;
    expect(situacaoDa(r.execucao, 'b')).toBe('pendente');
    expect(situacaoGeral(r.execucao, R)).toBe('em-andamento');
  });

  it('não perde o que já foi feito: as outras etapas continuam iguais, com quem fez e quando', () => {
    const ex = concluida();
    const r = reabrirRotina(ex, R, 'b', 'Bia', depois)!;
    expect(r.execucao.etapas.a).toEqual(ex.etapas.a);
    expect(r.execucao.etapas.c).toEqual(ex.etapas.c);
  });

  it('guarda quem reabriu, quando e por qual etapa; o evento é o reaberta, dizendo que foi a rotina', () => {
    const r = reabrirRotina(concluida(), R, 'b', 'Bia', depois)!;
    expect(r.execucao.rotinaReaberta).toEqual({ por: 'Bia', em: depois.toISOString(), etapa: 'b' });
    expect(r.execucao.reabertas?.b).toBe(depois.toISOString());
    expect(r.evento).toEqual({ tipo: 'reaberta', etapa: 'b', por: 'Bia', em: depois.toISOString(), observacao: ROTINA_REABERTA + ' (a etapa estava dispensada)' });
  });

  it('não muda a execução que recebeu', () => {
    const ex = concluida();
    const copia = JSON.parse(JSON.stringify(ex));
    reabrirRotina(ex, R, 'a', 'Bia', depois);
    expect(ex).toEqual(copia);
  });

  it('null quando a rotina não está concluída (é o voltarPara de sempre)', () => {
    const ex = fazer(execucaoNova('Empresa Teste', 1, '2026-10', 'contabil'), 'a', 'Ana', agora).execucao;
    expect(reabrirRotina(ex, R, 'a', 'Bia', depois)).toBeNull();
  });

  it('null para a etapa que não é da rotina ou que não tem estado (nada a reabrir)', () => {
    expect(reabrirRotina(concluida(), R, 'z', 'Bia', depois)).toBeNull();
    const semC = concluida();
    const R2 = { ...R, etapas: [...R.etapas, etapa('d')] } as Rotina;
    // d não entrou no mês (sem estado e não restrita): a rotina R2 nem está concluída
    expect(reabrirRotina(semC, R2, 'd', 'Bia', depois)).toBeNull();
  });

  it('a reabertura vale até a rotina ser concluída de novo; depois, fica só na história', () => {
    const r = reabrirRotina(concluida(), R, 'c', 'Bia', depois)!;
    expect(reaberturaEmAberto(r.execucao, R)).toEqual({ por: 'Bia', em: depois.toISOString(), etapa: 'c' });
    const deNovo = fazer(r.execucao, 'c', 'Bia', depois).execucao;
    expect(situacaoGeral(deNovo, R)).toBe('concluida');
    expect(reaberturaEmAberto(deNovo, R)).toBeNull();
    expect(deNovo.rotinaReaberta?.por).toBe('Bia');
    expect(reaberturaEmAberto(concluida(), R)).toBeNull();
    expect(reaberturaEmAberto(null, R)).toBeNull();
  });

  it('a gravação por diferença leva só a etapa reaberta, as reabertas e a reabertura (o resto do banco fica)', () => {
    const ex = concluida();
    const r = reabrirRotina(ex, R, 'b', 'Bia', depois)!;
    const mudancas = diferencaDaExecucao(ex, r.execucao);
    expect(mudancas.map(m => m.caminho.join('.')).sort()).toEqual(['etapas.b', 'reabertas.b', 'rotinaReaberta.em', 'rotinaReaberta.etapa', 'rotinaReaberta.por']);
    // alguém marcou outra coisa enquanto a janela estava aberta: continua lá
    const noBanco = { ...ex, valores: { folha: 10 } };
    expect(aplicarDiferenca(noBanco, mudancas)).toEqual({ ...r.execucao, valores: { folha: 10 } });
  });
});
