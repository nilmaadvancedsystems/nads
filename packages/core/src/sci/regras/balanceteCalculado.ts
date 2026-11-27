// O balancete calculado pelo nads (27/11/2026, o Vitor: "quero que vc vire um segundo sistema contabil na outra pagina, pegando os
// lancamentos, somando e apresentando esses lancamentos separados por conta e pegando o saldo anterior do balancete, que fique
// exatamente como o balancete da empresa que importei"). Com o balancete importado do SCI (o período, as contas, a ordem e o saldo
// anterior) e os lançamentos da consulta do SCI:
//   - a analítica: o débito e o crédito são a soma dos lançamentos do período nela; o saldo atual, o anterior + débito − crédito;
//   - o participante (a linha embaixo da conta-mãe): os lançamentos da mãe com o participante dele;
//   - a sintética: a soma das analíticas abaixo dela.
// Cada linha leva o que o SCI disse, para mostrar onde não fecha. Os lançamentos em contas que o balancete não tem ficam à parte.
import type { BalanceteSci, ContaDoBalanceteSci } from './balancete';
import type { LancamentoDaConsulta } from './consulta';
import { classificacaoNormal } from './dePara';

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

export function balanceteCalculado(b: BalanceteSci, todos: readonly LancamentoDaConsulta[]): BalanceteCalculado {
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
