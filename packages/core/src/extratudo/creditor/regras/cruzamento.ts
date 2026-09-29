// Cruzamento banco × sistema (passo 3 do fluxo): cada título liquidado procura a NF no arquivo do
// sistema, de onde vêm a contrapartida e o histórico. Divergência nunca é resolvida sozinha, com uma
// exceção que o próprio fluxo manda: o sistema lançou duas (ou mais) duplicatas juntas — aí vale o
// valor de cada parcela que o banco liquidou ("dividido").
import { brl, nomeNorm } from '../../../formatos';
import type { LinhaSistema, Titulo } from '../tipos';
import { chaveNf, igual, r2, somar } from './numeros';

export type SituacaoCruzamento = 'ok' | 'dividido' | 'valor-diverge' | 'cliente-diverge' | 'nao-encontrada';

export interface Cruzamento {
  tituloId: number;
  situacao: SituacaoCruzamento;
  /** a linha do sistema escolhida (null quando a NF não existe lá) */
  linha: LinhaSistema | null;
  valorBanco: number;
  valorSistema: number | null;
  /** explicação curta para a tela */
  nota: string;
}

/**
 * O que a pessoa decidiu num título com problema:
 * - confirmar: usar o valor do banco com a contrapartida e o histórico da linha achada;
 * - manual: contrapartida e histórico digitados (NF que não está no sistema);
 * - excluir: o título fica fora do arquivo.
 */
export type Decisao = { tipo: 'confirmar' } | { tipo: 'manual'; contrapartida: string; historico: string } | { tipo: 'excluir' };

const PALAVRAS_VAZIAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 's', 'a', 'de', 'da', 'do', 'das', 'dos', 'e', 'cia', 'comercio', 'industria']);

function palavras(nome: string): string[] {
  return nomeNorm(nome).split(' ').filter(p => p && !PALAVRAS_VAZIAS.has(p));
}

/**
 * Mesmo cliente? O banco costuma cortar o nome do sacado, então vale um conter o outro ou a primeira
 * palavra que importa ser a mesma. Nome vazio em um dos lados não bloqueia.
 */
export function mesmoCliente(a: string, b: string): boolean {
  const x = nomeNorm(a), y = nomeNorm(b);
  if (!x || !y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const pa = palavras(a), pb = palavras(b);
  return !!pa[0] && pa[0] === pb[0];
}

/** Lançou k duplicatas juntas? (valor do sistema = soma das parcelas do banco, ou k × a parcela) */
function duplicatasJuntas(valorSistema: number, t: Titulo, parcelasNoBanco: Titulo[]): number {
  if (parcelasNoBanco.length > 1 && igual(valorSistema, somar(parcelasNoBanco.map(p => p.valor)))) return parcelasNoBanco.length;
  for (let k = 2; k <= 12; k++) if (Math.abs(valorSistema - t.valor * k) <= 0.01 * k) return k;
  return 0;
}

export function cruzar(titulos: Titulo[], sistema: LinhaSistema[]): Cruzamento[] {
  const porNf = new Map<string, LinhaSistema[]>();
  for (const l of sistema) {
    const k = chaveNf(l.nf);
    if (k) porNf.set(k, [...(porNf.get(k) || []), l]);
  }
  const titulosPorNf = new Map<string, Titulo[]>();
  for (const t of titulos) {
    const k = chaveNf(t.nf);
    titulosPorNf.set(k, [...(titulosPorNf.get(k) || []), t]);
  }

  return titulos.map((t): Cruzamento => {
    const k = chaveNf(t.nf);
    const candidatas = (k && porNf.get(k)) || [];
    const base = { tituloId: t.id, valorBanco: t.valor };
    if (!candidatas.length) {
      return { ...base, situacao: 'nao-encontrada', linha: null, valorSistema: null, nota: 'NF ' + (k || '(vazia)') + ' não está no arquivo do sistema.' };
    }
    // a linha que mais parece: mesmo valor primeiro, depois mesmo cliente
    const nota = (l: LinhaSistema) => (l.valor != null && igual(l.valor, t.valor) ? 2 : 0) + (mesmoCliente(t.sacado, l.cliente) ? 1 : 0);
    const linha = [...candidatas].sort((a, b) => nota(b) - nota(a))[0];
    const vs = linha.valor;
    const r = { ...base, linha, valorSistema: vs };
    if (vs != null && !igual(vs, t.valor)) {
      const k2 = duplicatasJuntas(vs, t, titulosPorNf.get(k) || []);
      if (k2) return { ...r, situacao: 'dividido', nota: 'O sistema lançou ' + k2 + ' duplicatas juntas (' + brl(vs) + '). Vai o valor desta parcela, na data em que o banco liquidou.' };
      return { ...r, situacao: 'valor-diverge', nota: 'Banco ' + brl(t.valor) + ' × sistema ' + brl(vs) + ' (diferença ' + brl(r2(t.valor - vs)) + ').' };
    }
    if (!mesmoCliente(t.sacado, linha.cliente)) {
      return { ...r, situacao: 'cliente-diverge', nota: 'Cliente no banco: ' + t.sacado + ' · no sistema: ' + linha.cliente + '.' };
    }
    return { ...r, situacao: 'ok', nota: '' };
  });
}

/** Precisa de uma decisão da pessoa antes de gerar o arquivo? */
export function precisaDecisao(c: Cruzamento): boolean {
  return c.situacao === 'valor-diverge' || c.situacao === 'cliente-diverge' || c.situacao === 'nao-encontrada';
}

/** Decisão que serve para a situação (ex.: "confirmar" não serve quando a NF não foi achada). */
export function decisaoValida(c: Cruzamento, d: Decisao | undefined): boolean {
  if (!d) return false;
  if (d.tipo === 'excluir') return true;
  if (d.tipo === 'manual') return !!d.contrapartida.trim();
  return c.linha != null;
}

export function pendentes(cruzamentos: Cruzamento[], decisoes: Record<number, Decisao>): Cruzamento[] {
  return cruzamentos.filter(c => precisaDecisao(c) && !decisaoValida(c, decisoes[c.tituloId]));
}

