// 2ª rodada: competências. Virada de ano, janeiro e dezembro, fevereiro bissexto, início e fim de atividade no meio do período
// (o razão só de parte dos meses), competência futura, período sem nenhum dado e a "competência 13". Dados fictícios.
import { describe, expect, it } from 'vitest';
import { desfazerReinf, situacaoReinf, transmitirReinf, type EstadoReinf } from '../reinf/reinf';
import { competenciasDoPeriodo as periodoDoFaturamento } from '../sieg/faturamento';
import { competenciasDoPeriodo, competenciasRecentes, MAXIMO_DE_MESES, rotaDoPeriodo, rotuloCompetencia, rotuloDoPeriodo, rotuloNumericoCompetencia } from './competencias';
import { etapaNoMesDoAno, execucaoNova, fazer, periodoConcluido, situacaoGeral } from './execucao';
import { conferirFgts } from './fgts';
import { conferirInss, type GuiaDoInss } from './inss';
import { lerRazao, mesesDoRazao } from './razao';
import { conferirSimples } from './simples';
import type { Rotina } from '../tipos';

const CAB = ['Data', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo'];
const razao = (itens: readonly (readonly [string, number, string])[]) => {
  let s = 0;
  return lerRazao([CAB, ...itens.map(([d, v, h]) => { s = Math.round((s + v) * 100) / 100; return [d, '', '', v, '', h, s]; })]);
};

describe('o período', () => {
  it('atravessa a virada do ano sem pular nem repetir', () => {
    expect(competenciasDoPeriodo('2025-11..2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('janeiro a dezembro são 12 e a ordem invertida dá o mesmo', () => {
    const a = competenciasDoPeriodo('2026-01..2026-12');
    expect(a).toHaveLength(12);
    expect(competenciasDoPeriodo('2026-12..2026-01')).toEqual(a);
  });
  it('corta em 24 meses', () => {
    expect(competenciasDoPeriodo('2024-01..2027-12')).toHaveLength(MAXIMO_DE_MESES);
  });
  it.each(['', 'x', '2026-13', '2026-00', '2026-1', '2026-01..', '2026-01..2026-13', '2026-01...2026-02'])('%j não é período', p => {
    expect(competenciasDoPeriodo(p)).toEqual([]);
  });
  it('a rota volta aos mesmos meses (ida e volta), em qualquer par de 2 anos', () => {
    const meses = competenciasDoPeriodo('2026-01..2027-12');
    for (const de of meses) for (const ate of meses) {
      const [a, b] = de <= ate ? [de, ate] : [ate, de];
      const r = competenciasDoPeriodo(rotaDoPeriodo(de, ate));
      expect(r[0]).toBe(a);
      expect(r[r.length - 1]).toBe(b);
    }
  });
  it('os rótulos na virada, em janeiro e em dezembro', () => {
    expect(rotuloDoPeriodo(['2025-12', '2026-01'])).toBe('Dezembro/2025 a Janeiro/2026');
    expect(rotuloDoPeriodo(['2026-01', '2026-12'])).toBe('Janeiro a Dezembro/2026');
    expect(rotuloDoPeriodo([])).toBe('');
    expect(rotuloNumericoCompetencia('2026-01')).toBe('01/2026');
    expect(rotuloCompetencia('2026-13')).toBe('13º salário/2026');
  });
  it('as recentes começam no mês anterior e viram o ano em janeiro, mesmo no dia 31', () => {
    expect(competenciasRecentes(new Date(2027, 0, 31), 2)).toEqual(['2026-12', '2026-11']);
    expect(competenciasRecentes(new Date(2026, 2, 31), 1)).toEqual(['2026-02']);
  });
  it('etapa trimestral na competência 13 não some nem quebra (o mês 13 não é trimestre)', () => {
    expect(etapaNoMesDoAno({ meses: [3, 6, 9, 12] }, '2026-12')).toBe(true);
    expect(etapaNoMesDoAno({ meses: [3, 6, 9, 12] }, '2026-13')).toBe(false);
    expect(etapaNoMesDoAno({}, '2026-13')).toBe(true);
  });
});

describe('os 12 meses do RBT12', () => {
  it('terminam na competência pedida e atravessam o ano sem repetir', () => {
    const janeiro = periodoDoFaturamento('12m', '2027-01');
    expect(janeiro).toHaveLength(12);
    expect(janeiro[0]).toBe('2026-02');
    expect(janeiro[11]).toBe('2027-01');
    expect(new Set(janeiro).size).toBe(12);
    const dezembro = periodoDoFaturamento('12m', '2026-12');
    expect([dezembro[0], dezembro[11]]).toEqual(['2026-01', '2026-12']);
  });
});

describe('início e encerramento de atividade no meio do período', () => {
  const rz = razao([['15/03/2026', -500, 'INSS s/ folha ref. 03/2026'], ['20/04/2026', 500, 'Pgto INSS ref. 03/2026']]);
  const guia = (c: string, total: number): GuiaDoInss => ({ competencia: c, total, vencimento: c + '-20', numero: 'g' + c } as unknown as GuiaDoInss);

  it('os meses antes do início do razão ficam "fora do razão", sem sugerir lançamento neles', () => {
    const c = conferirInss(rz, [guia('2026-03', 500)], ['2026-01', '2026-02', '2026-03']);
    expect(c.meses.map(m => m.foraDoRazao)).toEqual([true, true, false]);
    expect(c.sugestoes.filter(s => s.mes < '2026-03')).toEqual([]);
  });
  it('o mês depois do encerramento não tem movimento e o saldo fica o do último mês', () => {
    const m = mesesDoRazao(rz, ['2026-03', '2026-04', '2026-05']);
    expect(m.map(x => x.lancamentos.length)).toEqual([1, 1, 0]);
  });
  it('o arquivo de razão sem nenhuma linha é recusado na leitura, com aviso', () => {
    expect(() => razao([])).toThrow(/nenhum lançamento/);
  });
  it('período sem guia e sem provisão no mês: as conferências não quebram', () => {
    expect(conferirInss(rz, [], ['2026-06']).meses).toHaveLength(1);
    expect(conferirFgts(rz, [], ['2026-06'], []).meses).toHaveLength(1);
    expect(conferirSimples(rz, ['2026-06'], [], rz).sugestoes).toBeInstanceOf(Array);
  });
});

describe('competência futura e o encerramento do período', () => {
  const R = { etapas: [{ id: 'a', nome: 'A', objecoes: [] }] } as unknown as Rotina;
  it('o período com um mês sem execução (futuro) não encerra', () => {
    const f = fazer(execucaoNova('T', null, '2026-11', 'contabil'), 'a', 'Ana', new Date('2026-12-01T12:00:00Z')).execucao;
    expect(situacaoGeral(f, R)).toBe('concluida');
    expect(periodoConcluido([f, null], R)).toBe(false);
  });
});

describe('a REINF na virada do ano', () => {
  const e = (ate?: string): EstadoReinf => ({ codigo: 1, retificadas: [], ...(ate ? { transmitidoAte: ate } : {}) });
  const quando = new Date('2027-01-15T12:00:00Z');
  it('desfazer janeiro volta para dezembro do ano anterior', () => {
    expect(desfazerReinf(e('2027-01'), '2027-01').transmitidoAte).toBe('2026-12');
  });
  it('transmitir não volta o "até" para trás e dezembro cobre os meses anteriores', () => {
    const t = transmitirReinf(e('2026-12'), '2026-05', 'Ana', quando);
    expect(t.transmitidoAte).toBe('2026-12');
    expect(situacaoReinf(t, '2026-05')).toBe('transmitida');
    expect(situacaoReinf(t, '2027-01')).toBe('pendente');
    expect(situacaoReinf(undefined, '2026-01')).toBe('pendente');
  });
  it('desfazer um mês que ainda não foi transmitido não muda nada', () => {
    const x = e('2026-05');
    expect(desfazerReinf(x, '2026-06')).toBe(x);
  });
});
