// O balancete calculado pelo nads (27/11/2026, o Vitor: "quero que vc vire um segundo sistema contabil na outra pagina, pegando os
// lancamentos, somando e apresentando esses lancamentos separados por conta e pegando o saldo anterior do balancete, que fique
// exatamente como o balancete da empresa que importei"). Com o balancete importado do SCI (o período, as contas, a ordem e o saldo
// anterior) e os lançamentos da consulta do SCI:
//   - a analítica: o débito e o crédito são a soma dos lançamentos do período nela; o saldo atual, o anterior + débito − crédito;
//   - o participante (a linha embaixo da conta-mãe): os lançamentos da mãe com o participante dele;
//   - a sintética: a soma das analíticas abaixo dela.
// Cada linha leva o que o SCI disse, para mostrar onde não fecha. Os lançamentos em contas que o balancete não tem ficam à parte.
import type { BalanceteSci, ContaDoBalanceteSci } from './balancete';
import { juntarPartidas, type LancamentoDaConsulta } from './consulta';
import { classificacaoNormal } from './dePara';
import { provisoesDaConta } from './provisoes';

export interface ContaCalculada extends ContaDoBalanceteSci {
  /** o que o balancete do SCI diz da conta (os mesmos campos) */
  doSci: { anterior: number; debito: number; credito: number; atual: number };
  /** o débito, o crédito e o saldo atual batem com o do SCI */
  confere: boolean;
  /** quantos lançamentos do período entraram na conta */
  lancamentos: number;
}

export interface BalanceteCalculado {
  inicio: string;
  fim: string;
  contas: ContaCalculada[];
  /** as contas dos lançamentos do período que o balancete não tem (o código, o débito e o crédito) */
  foraDoBalancete: { codigo: string; debito: number; credito: number; lancamentos: number }[];
  /** quantas analíticas (e participantes) não batem */
  divergentes: number;
}

/** o código do participante pela classificação da linha (01.1.2.01.000001577 → 1577) */
const participanteDa = (classificacao: string) => String(Number(classificacao.split('.').pop() || '0'));
const mesmoParticipante = (a: string, b: string) => !!a && String(Number(a)) === b;

/**
 * O apelido do código da consulta (27/11/2026, a 590: o Banco Inter é a 93 no balancete e vem como 84 nos lançamentos, com o mesmo
 * débito e o mesmo crédito): o código dos lançamentos do período que o balancete não tem, com o débito e o crédito iguais aos de uma
 * analítica do balancete que não tem lançamento nenhum, é essa conta. Só o par único (um código para uma conta); senão, nada.
 */
export function apelidosDaConsulta(b: BalanceteSci, todos: readonly LancamentoDaConsulta[]): Map<string, string> {
  const noPeriodo = todos.filter(l => l.data && (!b.inicio || l.data >= b.inicio) && (!b.fim || l.data <= b.fim));
  const doBalancete = new Set(b.contas.filter(c => !c.participante && c.codigo).map(c => c.codigo));
  const totais = new Map<string, { d: number; c: number }>();
  const somar = (cod: string, d: number, c: number) => { if (!cod) return; const t = totais.get(cod) || { d: 0, c: 0 }; t.d += d; t.c += c; totais.set(cod, t); };
  for (const l of noPeriodo) { somar(l.debito, l.valor, 0); somar(l.credito, 0, l.valor); }
  const semLancamento = b.contas.filter(c => c.analitica && !c.participante && c.codigo && !totais.has(c.codigo) && (c.debito || c.credito));
  const fora = [...totais.entries()].filter(([cod, t]) => !doBalancete.has(cod) && (t.d || t.c));
  const r = new Map<string, string>();
  for (const [cod, t] of fora) {
    const contas = semLancamento.filter(c => c.debito === t.d && c.credito === t.c);
    if (contas.length !== 1) continue;
    const outros = fora.filter(([, u]) => u.d === t.d && u.c === t.c);
    if (outros.length !== 1) continue;
    r.set(cod, contas[0].codigo);
  }
  return r;
}

/** Os lançamentos da consulta prontos para o balancete: os códigos com apelido trocados pela conta do balancete e as partidas juntas. */
export function consultaNoBalancete(b: BalanceteSci, todos: readonly LancamentoDaConsulta[]): LancamentoDaConsulta[] {
  const apelidos = apelidosDaConsulta(b, todos);
  const troca = (c: string | undefined) => (c && apelidos.get(c)) || c || '';
  const trocados = apelidos.size ? todos.map(l => ({ ...l, debito: troca(l.debito), credito: troca(l.credito), ...(l.contrapartida ? { contrapartida: troca(l.contrapartida) } : {}) })) : [...todos];
  return juntarPartidas(trocados);
}

export function balanceteCalculado(b: BalanceteSci, brutos: readonly LancamentoDaConsulta[]): BalanceteCalculado {
  const todos = consultaNoBalancete(b, brutos);
  const noPeriodo = todos.filter(l => l.data && (!b.inicio || l.data >= b.inicio) && (!b.fim || l.data <= b.fim));
  const contas: ContaCalculada[] = [];
  let mae: ContaDoBalanceteSci | null = null;
  // as analíticas primeiro (as sintéticas somam o que elas deram)
  const porLinha = new Map<ContaDoBalanceteSci, ContaCalculada>();
  for (const c of b.contas) {
    if (!c.participante) mae = c;
    if (!c.analitica && !c.participante) continue;
    let debito = 0, credito = 0, n = 0;
    if (c.participante && mae) {
      const p = participanteDa(c.classificacao);
      for (const l of noPeriodo) {
        if (l.debito === mae.codigo && mesmoParticipante(l.participanteD, p)) { debito += l.valor; n++; }
        if (l.credito === mae.codigo && mesmoParticipante(l.participanteC, p)) { credito += l.valor; n++; }
      }
    } else {
      for (const l of noPeriodo) {
        if (l.debito === c.codigo) { debito += l.valor; n++; }
        if (l.credito === c.codigo) { credito += l.valor; n++; }
      }
    }
    const atual = c.anterior + debito - credito;
    porLinha.set(c, {
      ...c, debito, credito, atual, lancamentos: n,
      doSci: { anterior: c.anterior, debito: c.debito, credito: c.credito, atual: c.atual },
      confere: debito === c.debito && credito === c.credito && atual === c.atual,
    });
  }
  // as sintéticas: a soma das analíticas abaixo (sem os participantes, que já estão na mãe)
  const analiticas = [...porLinha.values()].filter(c => !c.participante).map(c => ({ c, norm: classificacaoNormal(c.classificacao) }));
  for (const c of b.contas) {
    const calculada = porLinha.get(c);
    if (calculada) { contas.push(calculada); continue; }
    const prefixo = classificacaoNormal(c.classificacao) + '.';
    const filhas = analiticas.filter(a => a.norm.startsWith(prefixo)).map(a => a.c);
    const soma = (k: 'anterior' | 'debito' | 'credito' | 'atual') => filhas.reduce((t, f) => t + f[k], 0);
    const debito = soma('debito'), credito = soma('credito'), anterior = soma('anterior'), atual = soma('atual');
    contas.push({
      ...c, anterior, debito, credito, atual, lancamentos: filhas.reduce((t, f) => t + f.lancamentos, 0),
      doSci: { anterior: c.anterior, debito: c.debito, credito: c.credito, atual: c.atual },
      confere: debito === c.debito && credito === c.credito && atual === c.atual,
    });
  }
  // os lançamentos em contas que o balancete não tem
  const conhecidas = new Set(b.contas.filter(c => !c.participante).map(c => c.codigo));
  const fora = new Map<string, { codigo: string; debito: number; credito: number; lancamentos: number }>();
  const somaFora = (codigo: string, d: number, cr: number) => {
    if (!codigo || conhecidas.has(codigo)) return;
    const f = fora.get(codigo) || { codigo, debito: 0, credito: 0, lancamentos: 0 };
    f.debito += d; f.credito += cr; f.lancamentos++;
    fora.set(codigo, f);
  };
  for (const l of noPeriodo) { somaFora(l.debito, l.valor, 0); somaFora(l.credito, 0, l.valor); }
  return {
    inicio: b.inicio, fim: b.fim, contas,
    foraDoBalancete: [...fora.values()].sort((x, y) => x.codigo.localeCompare(y.codigo, 'pt-BR', { numeric: true })),
    divergentes: contas.filter(c => (c.analitica || c.participante) && !c.confere).length,
  };
}

// ------------------------------------------------------------------------------------------------- mês a mês
// 27/11/2026, o Vitor: "Depois da importacao, na segunda tela vai apresentar o que esta em aberto e os saldos, mes a mes de cada conta
// do balancete, de maneira dinamica".

/** Um mês de uma conta: o débito e o crédito do mês, o saldo no fim dele e, nas contas que provisionam, o que ficou em aberto. */
export interface MesDaConta {
  /** aaaa-mm */
  mes: string;
  debito: number;
  credito: number;
  /** o saldo no fim do mês (+ devedor, − credor) */
  saldo: number;
  /** as provisões do mês ainda sem pagamento (null = a conta não provisiona) */
  aberto: number | null;
  /** quantos lançamentos do mês */
  lancamentos: number;
}

export interface LinhaMesAMes extends ContaCalculada { meses: MesDaConta[] }

export interface BalanceteMesAMes { meses: string[]; linhas: LinhaMesAMes[] }

/** os meses de aaaa-mm-dd a aaaa-mm-dd (aaaa-mm) */
function mesesEntre(inicio: string, fim: string): string[] {
  const r: string[] = [];
  let [a, m] = inicio.slice(0, 7).split('-').map(Number);
  const [af, mf] = fim.slice(0, 7).split('-').map(Number);
  while (a < af || (a === af && m <= mf)) {
    r.push(a + '-' + String(m).padStart(2, '0'));
    m++; if (m > 12) { m = 1; a++; }
    if (r.length > 120) break;
  }
  return r;
}

/**
 * O balancete calculado mês a mês: para cada conta do balancete, o débito, o crédito e o saldo no fim de cada mês do período (do saldo
 * anterior do SCI em diante) e, nas contas que provisionam, o que cada mês tem em aberto. A sintética soma as analíticas abaixo.
 */
export function balanceteMesAMes(b: BalanceteSci, brutos: readonly LancamentoDaConsulta[]): BalanceteMesAMes {
  const todos = consultaNoBalancete(b, brutos);
  const base = balanceteCalculado(b, todos);
  const meses = b.inicio && b.fim ? mesesEntre(b.inicio, b.fim) : [];
  const noPeriodo = todos.filter(l => l.data && (!b.inicio || l.data >= b.inicio) && (!b.fim || l.data <= b.fim));
  let mae: ContaCalculada | null = null;
  const linhas: LinhaMesAMes[] = [];
  const porLinha = new Map<ContaCalculada, LinhaMesAMes>();
  for (const c of base.contas) {
    if (!c.participante) mae = c;
    if (!c.analitica && !c.participante) continue;
    const doLado = (l: LancamentoDaConsulta, lado: 'D' | 'C') => {
      if (c.participante && mae) {
        const p = participanteDa(c.classificacao);
        return lado === 'D' ? l.debito === mae.codigo && mesmoParticipante(l.participanteD, p) : l.credito === mae.codigo && mesmoParticipante(l.participanteC, p);
      }
      return lado === 'D' ? l.debito === c.codigo : l.credito === c.codigo;
    };
    // o em aberto por mês (só a analítica que provisiona; o participante fica na mãe)
    const prov = !c.participante ? provisoesDaConta(todos, c.codigo, c.classificacao) : null;
    const abertoDoMes = new Map(prov?.meses.map(m => [m.mes, m.aberto]) || []);
    let saldo = c.anterior;
    const ms = meses.map(mes => {
      let debito = 0, credito = 0, n = 0;
      for (const l of noPeriodo) {
        if (!l.data.startsWith(mes)) continue;
        if (doLado(l, 'D')) { debito += l.valor; n++; }
        if (doLado(l, 'C')) { credito += l.valor; n++; }
      }
      saldo += debito - credito;
      return { mes, debito, credito, saldo, aberto: prov ? abertoDoMes.get(mes) || 0 : null, lancamentos: n };
    });
    porLinha.set(c, { ...c, meses: ms });
  }
  const analiticas = [...porLinha.values()].filter(c => !c.participante).map(c => ({ c, norm: classificacaoNormal(c.classificacao) }));
  for (const c of base.contas) {
    const pronta = porLinha.get(c);
    if (pronta) { linhas.push(pronta); continue; }
    const prefixo = classificacaoNormal(c.classificacao) + '.';
    const filhas = analiticas.filter(a => a.norm.startsWith(prefixo)).map(a => a.c);
    const comAberto = filhas.some(f => f.meses.some(m => m.aberto != null));
    linhas.push({
      ...c,
      meses: meses.map((mes, k) => ({
        mes,
        debito: filhas.reduce((t, f) => t + f.meses[k].debito, 0),
        credito: filhas.reduce((t, f) => t + f.meses[k].credito, 0),
        saldo: filhas.reduce((t, f) => t + f.meses[k].saldo, 0),
        aberto: comAberto ? filhas.reduce((t, f) => t + (f.meses[k].aberto || 0), 0) : null,
        lancamentos: filhas.reduce((t, f) => t + f.meses[k].lancamentos, 0),
      })),
    });
  }
  return { meses, linhas };
}
