// 2ª rodada: a máquina de estados das etapas. Toda transição a partir de cada situação, concluir duas vezes, desfazer, o
// status derivado e a gravação por diferença (o que o banco grava) em sequências sorteadas com semente fixa. Dados fictícios.
import { describe, expect, it } from 'vitest';
import { ROTINA_CONTABIL } from '../rotinas/contabil';
import type { Execucao, Rotina, SituacaoEtapa } from '../tipos';
import {
  adicionarEtapa, definirPeriodo, dispensar, etapaPeloBalancete, execucaoNova, fazer, informarValor, interromper, marcarSemMovimento,
  periodoConcluido, progresso, proximaEtapa, retirarEtapa, situacaoDa, situacaoGeral, todosSemMovimento, voltarPara,
} from './execucao';
import { aplicarDiferenca, diferencaDaExecucao, igualPorConteudo } from './gravacaoDaExecucao';
import { objecoesMaisComuns, resumoPorEtapa } from './visao';

function gerador(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const agora = new Date('2026-09-10T12:00:00.000Z');
const depois = new Date('2026-09-10T13:00:00.000Z');
const etapa = (id: string, objecoes: { id: string; texto: string }[] = []) => ({ id, nome: id.toUpperCase(), objecoes }) as unknown as Rotina['etapas'][number];
const R = { etapas: [etapa('a', [{ id: 'sem-doc', texto: 'Sem documento' }]), etapa('b', [{ id: 'sem-doc', texto: 'Sem documento' }]), etapa('c')] } as unknown as Rotina;
const nova = (): Execucao => execucaoNova('Empresa Teste', null, '2026-08', 'contabil');
const em = (s: SituacaoEtapa, id = 'a'): Execucao => {
  if (s === 'pendente') return nova();
  if (s === 'feita') return fazer(nova(), id, 'Ana', agora).execucao;
  if (s === 'dispensada') return dispensar(nova(), id, 'sem-doc', '', 'Ana', agora).execucao;
  return interromper(nova(), id, 'sem-doc', '', 'Ana', agora).execucao;
};
const SITUACOES: SituacaoEtapa[] = ['pendente', 'feita', 'dispensada', 'interrompida'];

describe('cada ação, a partir de cada situação', () => {
  it.each(SITUACOES)('de %s: fazer deixa feita', s => expect(situacaoDa(fazer(em(s), 'a', 'Bia', depois).execucao, 'a')).toBe('feita'));
  it.each(SITUACOES)('de %s: dispensar deixa dispensada', s => expect(situacaoDa(dispensar(em(s), 'a', 'sem-doc', 'obs', 'Bia', depois).execucao, 'a')).toBe('dispensada'));
  it.each(SITUACOES)('de %s: interromper deixa interrompida', s => expect(situacaoDa(interromper(em(s), 'a', 'sem-doc', 'obs', 'Bia', depois).execucao, 'a')).toBe('interrompida'));
  it.each(SITUACOES)('de %s: voltar deixa pendente e o evento guarda como estava', s => {
    const r = voltarPara(em(s), 'a', 'Bia', depois);
    expect(situacaoDa(r.execucao, 'a')).toBe('pendente');
    expect(r.evento).toMatchObject({ tipo: 'reaberta', observacao: s });
    expect(r.execucao.reabertas?.a).toBe(depois.toISOString());
  });

  it('nenhuma ação muda a execução que recebeu nem as outras etapas', () => {
    const base = fazer(em('interrompida', 'b'), 'c', 'Ana', agora).execucao;
    const copia = JSON.parse(JSON.stringify(base));
    const acoes = [fazer(base, 'a', 'B', depois), dispensar(base, 'a', 'x', '', 'B', depois), interromper(base, 'a', 'x', '', 'B', depois), voltarPara(base, 'a', 'B', depois)];
    expect(base).toEqual(copia);
    for (const a of acoes) { expect(a.execucao.etapas.b).toEqual(base.etapas.b); expect(a.execucao.etapas.c).toEqual(base.etapas.c); }
  });

  it('a observação só de espaços não vai para o estado nem para o evento', () => {
    const d = dispensar(nova(), 'a', 'sem-doc', '   ', 'Ana', agora);
    expect(d.execucao.etapas.a).not.toHaveProperty('observacao');
    expect(d.evento).not.toHaveProperty('observacao');
  });
});

describe('concluir duas vezes e desfazer', () => {
  it('concluir de novo não conta duas vezes no progresso', () => {
    const uma = fazer(nova(), 'a', 'Ana', agora).execucao;
    const duas = fazer(uma, 'a', 'Ana', depois).execucao;
    expect(progresso(duas, R).concluidas).toBe(1);
    expect(Object.keys(duas.etapas)).toEqual(['a']);
  });

  it('fazer, desfazer e fazer volta a concluir e a marca de reaberta fica guardada', () => {
    const f = fazer(nova(), 'a', 'Ana', agora).execucao;
    const v = voltarPara(f, 'a', 'Ana', depois).execucao;
    expect(progresso(v, R).concluidas).toBe(0);
    const f2 = fazer(v, 'a', 'Ana', depois).execucao;
    expect(progresso(f2, R).concluidas).toBe(1);
    expect(f2.reabertas?.a).toBe(depois.toISOString());
  });

  it('desfazer a última concluída tira a rotina de concluída', () => {
    let ex = nova();
    for (const e of R.etapas) ex = fazer(ex, e.id, 'Ana', agora).execucao;
    expect(situacaoGeral(ex, R)).toBe('concluida');
    expect(proximaEtapa(ex, R)).toBeNull();
    const v = voltarPara(ex, 'c', 'Ana', depois).execucao;
    expect(situacaoGeral(v, R)).toBe('em-andamento');
    expect(proximaEtapa(v, R)?.id).toBe('c');
  });

  it('desfazer a única etapa feita deixa a rotina como não iniciada', () => {
    const v = voltarPara(em('feita'), 'a', 'Ana', depois).execucao;
    expect(situacaoGeral(v, R)).toBe('nao-iniciada');
  });
});

describe('o status derivado', () => {
  it('nula e vazia: não iniciada', () => {
    expect(situacaoGeral(null, R)).toBe('nao-iniciada');
    expect(situacaoGeral(nova(), R)).toBe('nao-iniciada');
  });
  it('interrompida na próxima: parada; retomada: volta a andar', () => {
    const p = interromper(fazer(nova(), 'a', 'Ana', agora).execucao, 'b', 'sem-doc', '', 'Ana', agora).execucao;
    expect(situacaoGeral(p, R)).toBe('parada');
    expect(progresso(p, R).interrompida?.id).toBe('b');
    expect(situacaoGeral(voltarPara(p, 'b', 'Ana', depois).execucao, R)).toBe('em-andamento');
  });
  it('dispensar tudo também conclui', () => {
    let ex = nova();
    for (const e of R.etapas) ex = dispensar(ex, e.id, 'sem-doc', '', 'Ana', agora).execucao;
    expect(situacaoGeral(ex, R)).toBe('concluida');
  });
  it('o período só encerra com todos os meses concluídos (lista vazia e mês sem execução não encerram)', () => {
    let ex = nova();
    for (const e of R.etapas) ex = fazer(ex, e.id, 'Ana', agora).execucao;
    expect(periodoConcluido([], R)).toBe(false);
    expect(periodoConcluido([ex, null], R)).toBe(false);
    expect(periodoConcluido([ex, ex], R)).toBe(true);
  });
  it('sem movimento: marcar, desmarcar e repetir não duplicam o banco', () => {
    const bancos = [{ id: 'b1' }, { id: 'b2' }];
    let ex = marcarSemMovimento(nova(), 'extratos', 'b1', true, 'Ana', agora).execucao;
    ex = marcarSemMovimento(ex, 'extratos', 'b1', true, 'Ana', agora).execucao;
    expect(ex.semMovimento).toEqual(['b1']);
    expect(todosSemMovimento(ex, bancos)).toBe(false);
    ex = marcarSemMovimento(ex, 'extratos', 'b2', true, 'Ana', agora).execucao;
    expect(todosSemMovimento(ex, bancos)).toBe(true);
    ex = marcarSemMovimento(ex, 'extratos', 'b1', false, 'Ana', agora).execucao;
    expect(ex.semMovimento).toEqual(['b2']);
    expect(todosSemMovimento(ex, [])).toBe(false);
  });
  it('a etapa pelo balancete: sai, não sai duas vezes, volta', () => {
    const sai = etapaPeloBalancete(nova(), 'a', false, 'sem saldo', 'Ana', agora)!;
    expect(sai.execucao.retiradas).toEqual(['a']);
    expect(etapaPeloBalancete(sai.execucao, 'a', false, 'sem saldo', 'Ana', agora)).toBeNull();
    const volta = etapaPeloBalancete(sai.execucao, 'a', true, 'com saldo', 'Ana', agora)!;
    expect(volta.execucao.retiradas).toEqual([]);
    expect(etapaPeloBalancete(nova(), 'a', true, '', 'Ana', agora)).toBeNull();
  });
  it('a etapa que saiu do mês não prende a rotina, mesmo interrompida antes', () => {
    const p = interromper(nova(), 'a', 'sem-doc', '', 'Ana', agora).execucao;
    const fora = etapaPeloBalancete(p, 'a', false, 'sem saldo', 'Ana', agora)!.execucao;
    expect(progresso(fora, R)).toMatchObject({ total: 2, interrompida: null });
    expect(proximaEtapa(fora, R)?.id).toBe('b');
  });
});

describe('a visão de cima só conta o que vale no mês', () => {
  const parada = (): Execucao => etapaPeloBalancete(interromper(nova(), 'a', 'sem-doc', '', 'Ana', agora).execucao, 'a', false, 'sem saldo', 'Ana', agora)!.execucao;

  it('a etapa interrompida que saiu do mês não aparece como parada (conta como "não se aplica", como no progresso)', () => {
    const [a] = resumoPorEtapa([parada()], R, 1);
    expect(a).toMatchObject({ interrompidas: 0, dispensadas: 1, pendentes: 0, total: 1 });
  });
  it('a etapa feita antes de sair do mês continua contada como feita (o que foi feito fica guardado)', () => {
    const ex = etapaPeloBalancete(fazer(nova(), 'a', 'Ana', agora).execucao, 'a', false, 'sem saldo', 'Ana', agora)!.execucao;
    expect(resumoPorEtapa([ex], R, 1)[0]).toMatchObject({ feitas: 1, interrompidas: 0, pendentes: 0 });
  });
  it('a objeção da etapa que saiu do mês não conta entre as que estão parando agora', () => {
    expect(objecoesMaisComuns([parada()], R)).toEqual([]);
    expect(objecoesMaisComuns([em('interrompida')], R)).toMatchObject([{ etapa: 'a', objecao: 'sem-doc', qtd: 1 }]);
  });
  it('feitas + dispensadas + interrompidas + pendentes = total em qualquer mistura', () => {
    const r = gerador(20261110);
    const exs: Execucao[] = [];
    for (let i = 0; i < 200; i++) {
      let ex = nova();
      for (const e of R.etapas) {
        const s = SITUACOES[Math.floor(r() * 4)];
        if (s === 'feita') ex = fazer(ex, e.id, 'A', agora).execucao;
        else if (s === 'dispensada') ex = dispensar(ex, e.id, 'sem-doc', '', 'A', agora).execucao;
        else if (s === 'interrompida') ex = interromper(ex, e.id, 'sem-doc', '', 'A', agora).execucao;
        if (r() < 0.2) ex = etapaPeloBalancete(ex, e.id, false, '', 'A', agora)?.execucao || ex;
      }
      exs.push(ex);
    }
    for (const l of resumoPorEtapa(exs, R, 200)) expect(l.feitas + l.dispensadas + l.interrompidas + l.pendentes).toBe(l.total);
  });
});

describe('a gravação por diferença', () => {
  /** o banco não distingue o mapa ou a lista vazios de não ter o campo */
  // e a ordem de uma lista de texto não se grava (diferencaDaExecucao: "só a ordem mudou: nada a gravar")
  const semVazios = (ex: Execucao) => Object.fromEntries(Object.entries(ex).filter(([, v]) => !(v && typeof v === 'object' && !Object.keys(v).length)).map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]));
  const ACOES: ((ex: Execucao, e: string, r: () => number) => Execucao)[] = [
    (ex, e) => fazer(ex, e, 'Ana', depois).execucao,
    (ex, e) => dispensar(ex, e, 'sem-doc', 'obs', 'Ana', depois).execucao,
    (ex, e) => interromper(ex, e, 'sem-doc', '', 'Ana', depois).execucao,
    (ex, e) => voltarPara(ex, e, 'Ana', depois).execucao,
    (ex, e, r) => informarValor(ex, e, 'k' + Math.floor(r() * 3), Math.floor(r() * 1e7) / 100, 'Ana', depois).execucao,
    (ex, e) => adicionarEtapa(ex, e, 'm', 'Ana', depois).execucao,
    (ex, e) => retirarEtapa(ex, e, 'm', 'Ana', depois).execucao,
    (ex, e, r) => etapaPeloBalancete(ex, e, r() < 0.5, 'm', 'Ana', depois)?.execucao || ex,
    (ex, e, r) => marcarSemMovimento(ex, e, 'b' + Math.floor(r() * 3), r() < 0.6, 'Ana', depois).execucao,
    (ex, _e, r) => definirPeriodo(ex, r() < 0.5 ? '2026-06..2026-08' : null, 'Ana', depois).execucao,
  ];

  it('aplicar a diferença na cópia de origem dá a execução nova, em 3.000 passos sorteados', () => {
    const r = gerador(9112026);
    let ex = nova();
    for (let i = 0; i < 3000; i++) {
      const novo = ACOES[Math.floor(r() * ACOES.length)](ex, 'abc'[Math.floor(r() * 3)], r);
      const aplicada = aplicarDiferenca(ex, diferencaDaExecucao(ex, novo));
      expect(igualPorConteudo(semVazios(aplicada), semVazios(novo)), 'passo ' + i).toBe(true);
      ex = novo;
    }
  });

  it('sem mudança, diferença vazia; a ordem das chaves não conta', () => {
    const ex = fazer(em('interrompida', 'b'), 'a', 'Ana', agora).execucao;
    const invertida = { ...ex, etapas: Object.fromEntries(Object.entries(ex.etapas).reverse()) };
    expect(diferencaDaExecucao(ex, invertida)).toEqual([]);
  });

  it('duas ações da mesma cópia, gravadas uma atrás da outra, ficam as duas', () => {
    const base = nova();
    const d1 = diferencaDaExecucao(base, informarValor(base, 'a', 'folha', 10.5, 'Ana', agora).execucao);
    const d2 = diferencaDaExecucao(base, fazer(base, 'b', 'Bia', agora).execucao);
    const d3 = diferencaDaExecucao(base, marcarSemMovimento(base, 'c', 'b1', true, 'Caio', agora).execucao);
    const final = [d1, d2, d3].reduce(aplicarDiferenca, base);
    expect(final.valores).toEqual({ folha: 10.5 });
    expect(final.etapas.b.situacao).toBe('feita');
    expect(final.semMovimento).toEqual(['b1']);
  });

  it('marcar dois bancos a partir da mesma cópia não perde nenhum', () => {
    const base = nova();
    const d1 = diferencaDaExecucao(base, marcarSemMovimento(base, 'c', 'b1', true, 'A', agora).execucao);
    const d2 = diferencaDaExecucao(base, marcarSemMovimento(base, 'c', 'b2', true, 'A', agora).execucao);
    expect([d1, d2].reduce(aplicarDiferenca, base).semMovimento).toEqual(['b1', 'b2']);
  });

  it('a etapa reaberta sai do mapa na gravação', () => {
    const base = fazer(nova(), 'a', 'Ana', agora).execucao;
    const d = diferencaDaExecucao(base, voltarPara(base, 'a', 'Ana', depois).execucao);
    expect(d).toContainEqual({ caminho: ['etapas', 'a'], apagar: true });
    expect(aplicarDiferenca(base, d).etapas).toEqual({});
  });
});

describe('a rotina de verdade, mês a mês', () => {
  it('nenhum mês tem etapa repetida e a próxima etapa sempre é do mês', () => {
    for (let m = 1; m <= 12; m++) {
      const c = '2026-' + String(m).padStart(2, '0');
      const ex = execucaoNova('Teste', null, c, 'contabil');
      const p = proximaEtapa(ex, ROTINA_CONTABIL);
      const ids = ROTINA_CONTABIL.etapas.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(p && situacaoDa(ex, p.id)).toBe('pendente');
    }
  });
});
