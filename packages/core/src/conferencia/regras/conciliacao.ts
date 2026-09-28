// Conciliação com o balancete: soma das notas × saldo da conta, e a situação de cada conta.
// Origem: conferencia.html gruposConciliacao (~L3470), nomeBaseConta/nomeComumContas
// (~L3491-3507), renderCcBalancete (~L3508, a parte que CALCULA), autoMarcarConferidos
// (~L3563), podeConferir (~L2328), verifChave/verifEstado (~L3826).
import { compararNumerico, nomeNorm } from '../../formatos';
import type { Empresa, EstadoVerificacao, FiltroMovimento, GrupoNatureza, TipoCfop, TipoServico } from '../tipos';
import { somaValores, tituloDoGrupo } from './cfop';
import { avisoPassivo, contasDaNatureza, nomeConta, saldoAtualizado } from './empresa';
import { periodoKey } from './periodo';
import { servicoDaConta } from './servicos';

type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;

/** Abaixo disso a soma das notas é zero (fica fora da conferência). */
export const ZERO = 0.005;
/** Diferença menor que um centavo = bateu. */
export const TOLERANCIA = 0.01;

/** Só estas contas podem ficar "Conferido" com diferença: Água, Internet, Energia Elétrica, Locação de Sistemas. */
export const CONFERIVEIS = /\bagua\b|internet|energia eletrica|sistema/;

export function podeConferir(e: Empresa, codigos: string[], extras: string[] = []): boolean {
  const t = (codigos || []).map(c => nomeConta(e, c) || '').concat(extras).map(nomeNorm).join(' | ');
  return CONFERIVEIS.test(t);
}

export interface ComponenteConciliacao { naturezas: string[]; contas: string[] }

/** Naturezas e contas ligadas entre si pelo Cadastro (componentes conexos): soma tudo de uma vez. */
export function gruposConciliacao(e: Empresa, chaves: string[]): ComponenteConciliacao[] {
  const visitadas: Record<string, boolean> = {};
  const out: ComponenteConciliacao[] = [];
  for (const k0 of chaves) {
    if (visitadas[k0] || !contasDaNatureza(e, k0).length) continue;
    const naturezas = [k0];
    const contas: string[] = [];
    visitadas[k0] = true;
    for (let i = 0; i < naturezas.length; i++) {
      for (const c of contasDaNatureza(e, naturezas[i])) {
        if (contas.indexOf(c) > -1) continue;
        contas.push(c);
        for (const k2 of chaves) if (!visitadas[k2] && contasDaNatureza(e, k2).indexOf(c) > -1) { visitadas[k2] = true; naturezas.push(k2); }
      }
    }
    out.push({ naturezas, contas });
  }
  return out;
}

/** Tira "à vista"/"a prazo" do fim do nome da conta. */
export function nomeBaseConta(nome: string): string {
  return String(nome || '').replace(/\s*[àáa]\s+(vista|prazo)\s*$/i, '').trim();
}

function nomeBaseNormalizada(nome: string): string {
  return nomeBaseConta(nome).toLowerCase().split(/\s+/).map(p => p.replace(/s$/, '')).join(' ');
}

/** Contas que são "a mesma coisa" (à vista / a prazo, plural): o nome comum, ou null. */
export function nomeComumContas(nomes: string[]): string | null {
  if (nomes.length < 2) return null;
  const bases = nomes.map(nomeBaseConta);
  const norm = nomeBaseNormalizada(nomes[0]);
  if (!norm) return null;
  if (!nomes.every(n => nomeBaseNormalizada(n) === norm)) return null;
  return bases.reduce((menor, b) => (b.length < menor.length ? b : menor));
}

/** "70002 + 70006 — Compras de Mercadorias" */
export function tituloContas(e: Empresa, contas: string[]): string {
  const nomes = contas.map(c => nomeConta(e, c) || '').filter(Boolean);
  const comum = nomeComumContas(nomes);
  return comum ? contas.join(' + ') + ' — ' + comum : contas.map(c => { const n = nomeConta(e, c); return c + (n ? ' — ' + n : ''); }).join(' + ');
}

// ---------- Verificar por conta: estado gravado por período ----------
export function verifChave(p: Periodo, conta: string): string {
  return periodoKey(p) + '||' + conta;
}

export function verifEstado(e: Empresa, p: Periodo, conta: string): EstadoVerificacao | null {
  return (e.verifConta || {})[verifChave(p, conta)] || null;
}

// ---------- situação ----------
export type Situacao =
  | { tipo: 'ok' }
  | { tipo: 'ok-pela-revisao'; diferenca: number }
  | { tipo: 'conferido'; diferenca: number }
  | { tipo: 'diferenca'; diferenca: number }
  | { tipo: 'soma-zero' }
  | { tipo: 'fora-do-balancete' }
  | { tipo: 'sem-conta' };

export interface EntradaSituacao {
  somaNotas: number;
  /** null = conta fora do balancete lido */
  saldo: number | null;
  revisao: EstadoVerificacao | null;
  conferidoManual: boolean;
  podeConferir: boolean;
}

export function situacaoDaConta(x: EntradaSituacao): Situacao {
  if (Math.abs(x.somaNotas) < ZERO) return { tipo: 'soma-zero' };
  if (x.saldo == null) return { tipo: 'fora-do-balancete' };
  const diferenca = x.somaNotas - x.saldo;
  if (Math.abs(diferenca) < TOLERANCIA) return { tipo: 'ok' };
  if (x.revisao === 'ok') return { tipo: 'ok-pela-revisao', diferenca };
  if ((x.conferidoManual || x.revisao === 'conferido') && x.podeConferir) return { tipo: 'conferido', diferenca };
  return { tipo: 'diferenca', diferenca };
}

/** Situação que abre o "Revisar" (tem diferença de verdade). */
export function temRevisar(s: Situacao): boolean {
  return s.tipo === 'diferenca' || s.tipo === 'conferido';
}

export interface LinhaSaldo {
  contas: string[];
  titulo: string;
  cfops: string[];
  qtdNotas: number;
  somaNotas: number;
  saldo: number | null;
  /** conta com nota de serviço no período: conferida em Tomados/Prestados */
  emServicos: TipoServico | null;
  situacao: Situacao;
  avisoPassivo: string | null;
}

function saldoDasContas(e: Empresa, contas: string[]): number | null {
  if (contas.some(c => saldoAtualizado(e, c) == null)) return null;
  return contas.reduce((s, c) => s + (saldoAtualizado(e, c) as number), 0);
}

/**
 * Tabela "confere com o saldo" do Relatório. A conciliação usa todas as notas
 * do período (uma conta pode receber naturezas dos dois tipos); tipoF só filtra
 * as linhas exibidas.
 */
export function linhasDoSaldo(e: Empresa, grupos: Record<string, GrupoNatureza>, chaves: string[], p: Periodo, tipoF: '' | TipoCfop): LinhaSaldo[] {
  let comps = gruposConciliacao(e, chaves);
  if (tipoF) comps = comps.filter(c => c.naturezas.some(k => grupos[k].tipo === tipoF));
  const pk = periodoKey(p);
  const linhas = comps.map(comp => {
    const somaNotas = comp.naturezas.reduce((s, k) => s + somaValores(grupos[k].itens), 0);
    const saldo = saldoDasContas(e, comp.contas);
    const cfops = comp.naturezas.reduce<string[]>((l, k) => l.concat(grupos[k].cfops), [])
      .filter((c, i, l) => l.indexOf(c) === i).sort(compararNumerico);
    // todas as naturezas desta conta marcadas à mão no Checklist
    const conferidoManual = comp.naturezas.every(k => {
      const mk = pk + '||' + k;
      return e.confMarcados.indexOf(mk) > -1 && e.confAutoMarcados.indexOf(mk) < 0;
    });
    const situacao = situacaoDaConta({
      somaNotas, saldo,
      revisao: verifEstado(e, p, comp.contas[0]),
      conferidoManual,
      podeConferir: podeConferir(e, comp.contas, comp.naturezas.map(k => grupos[k].desc || k)),
    });
    return {
      contas: comp.contas,
      titulo: tituloContas(e, comp.contas),
      cfops,
      qtdNotas: comp.naturezas.reduce((s, k) => s + grupos[k].itens.length, 0),
      somaNotas, saldo,
      emServicos: servicoDaConta(e, comp.contas, p),
      situacao,
      avisoPassivo: avisoPassivo(e, comp.contas),
    };
  });
  return linhas.sort((a, b) => compararNumerico(a.titulo, b.titulo));
}

/**
 * Naturezas que devem ser marcadas "conferido" sozinhas: todo grupo cuja(s) conta(s)
 * bate(m) com o balancete. Nunca desmarca; respeita o que a pessoa desmarcou (recusados).
 */
export function quaisMarcarSozinho(e: Empresa, grupos: Record<string, GrupoNatureza>, chaves: string[], p: Periodo): { chave: string; texto: string }[] {
  if (!e.contas.length) return [];
  const pk = periodoKey(p);
  const out: { chave: string; texto: string }[] = [];
  for (const comp of gruposConciliacao(e, chaves)) {
    const saldo = saldoDasContas(e, comp.contas);
    if (saldo == null) continue;
    const somaNotas = comp.naturezas.reduce((s, k) => s + somaValores(grupos[k].itens), 0);
    if (servicoDaConta(e, comp.contas, p)) continue; // conferida em Serviços
    if (Math.abs(somaNotas) < ZERO) continue;
    if (Math.abs(somaNotas - saldo) >= TOLERANCIA) continue;
    for (const k of comp.naturezas) {
      const mk = pk + '||' + k;
      if (e.confMarcados.indexOf(mk) > -1 || e.confAutoRecusados.indexOf(mk) > -1) continue;
      out.push({ chave: mk, texto: tituloDoGrupo(grupos[k]) });
    }
  }
  return out;
}
