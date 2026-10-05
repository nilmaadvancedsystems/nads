// Cruzamento banco × sistema (passo 3 do fluxo): cada título liquidado procura a NF no arquivo do
// sistema, de onde vêm a contrapartida e o histórico. O BANCO SEMPRE MANDA (pedido do escritório,
// 2026-09-29): valor e cliente são os do banco; o sistema só dá a conta do cliente. Achou a NF, a
// conta é a daquela linha, mesmo com valor ou nome diferente (no 292 o sistema tem a razão social ou o
// dono, "CIRO VERNER DE PAULA NUNES EIRELI", e o banco o fantasia, "SUPERMERCADOS BOA COMPRA"). NF que
// não está no sistema: a conta vem de uma linha do mesmo cliente do banco. Só pede decisão sem conta.
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
  /** a conta veio do que foi aprendido do cliente (cruzarPeloBalancete) */
  aprendida?: boolean;
  /** a conta veio do relatório de Saídas importado na Tarefa (a NF da nota) */
  pelaSaida?: boolean;
  /** sem conta decidida, as contas do balancete entre as quais a pessoa escolhe (filiais de nome igual) */
  opcoes?: { codigo: string; nome: string }[];
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

/**
 * Mesmo cliente, para achar a conta pelo nome (mais rígido que mesmoCliente, que também aceita a
 * primeira palavra igual — "SUPERMERCADO X" × "SUPERMERCADO Y" não pode dar a mesma conta).
 */
function mesmoNome(a: string, b: string): boolean {
  const x = palavras(a).join(' '), y = palavras(b).join(' ');
  if (x.length < 6 || y.length < 6) return false;
  return x.includes(y) || y.includes(x);
}

/** A linha do sistema com a conta do cliente do banco — só se todas as linhas dele têm a mesma conta. */
function linhaDoCliente(sacado: string, sistema: LinhaSistema[]): LinhaSistema | null {
  const dele = sistema.filter(l => l.contrapartida && mesmoNome(sacado, l.cliente));
  return dele.length && new Set(dele.map(l => l.contrapartida)).size === 1 ? dele[0] : null;
}

/** Os números do histórico, sem zeros à esquerda ("Recebimento DUP.009897/1/1" → 9897, 1, 1), com 3+ dígitos. */
function numerosDoHistorico(h: string): string[] {
  return [...new Set((h.match(/\d+/g) || []).map(n => n.replace(/^0+(?=\d)/, '')).filter(n => n.length >= 3))];
}

export function cruzar(titulos: Titulo[], sistema: LinhaSistema[]): Cruzamento[] {
  const porNf = new Map<string, LinhaSistema[]>();
  // segunda chance: a NF escrita no histórico, quando a coluna de NF não tem (ou tem outro número)
  const porHistorico = new Map<string, LinhaSistema[]>();
  for (const l of sistema) {
    const k = chaveNf(l.nf);
    if (k) porNf.set(k, [...(porNf.get(k) || []), l]);
    for (const n of numerosDoHistorico(l.historico)) if (n !== k) porHistorico.set(n, [...(porHistorico.get(n) || []), l]);
  }
  const titulosPorNf = new Map<string, Titulo[]>();
  for (const t of titulos) {
    const k = chaveNf(t.nf);
    titulosPorNf.set(k, [...(titulosPorNf.get(k) || []), t]);
  }

  return titulos.map((t): Cruzamento => {
    const k = chaveNf(t.nf);
    const candidatas = (k && (porNf.get(k) || porHistorico.get(k))) || [];
    const base = { tituloId: t.id, valorBanco: t.valor };
    // a conta pelo cliente do banco; o histórico fica vazio para os lançamentos usarem "NF - cliente" do banco
    const pelaConta = (motivo: string): Cruzamento | null => {
      const l = linhaDoCliente(t.sacado, sistema);
      return l ? { ...base, situacao: 'ok', linha: { ...l, nf: t.nf, historico: '', cliente: t.sacado, valor: t.valor }, valorSistema: null, nota: motivo + ' Conta ' + l.contrapartida + ' pelo cliente.' } : null;
    };
    if (!candidatas.length) {
      return pelaConta('NF ' + (k || '(vazia)') + ' não está no sistema.')
        || { ...base, situacao: 'nao-encontrada', linha: null, valorSistema: null, nota: 'NF ' + (k || '(vazia)') + ' não está no arquivo do sistema, nem outra do mesmo cliente.' };
    }
    // a linha que mais parece: mesmo valor primeiro, depois mesmo cliente
    const nota = (l: LinhaSistema) => (l.valor != null && igual(l.valor, t.valor) ? 2 : 0) + (mesmoCliente(t.sacado, l.cliente) ? 1 : 0);
    const linha = [...candidatas].sort((a, b) => nota(b) - nota(a))[0];
    const vs = linha.valor;
    const r = { ...base, linha, valorSistema: vs };
    const outroNome = mesmoCliente(t.sacado, linha.cliente) ? '' : ' No sistema: ' + linha.cliente + '.';
    if (vs != null && !igual(vs, t.valor)) {
      const k2 = duplicatasJuntas(vs, t, titulosPorNf.get(k) || []);
      if (k2) return { ...r, situacao: 'dividido', nota: 'O sistema lançou ' + k2 + ' duplicatas juntas (' + brl(vs) + '). Vai o valor desta parcela, na data em que o banco liquidou.' + outroNome };
      return { ...r, situacao: 'ok', nota: ('Vai o valor do banco (' + brl(t.valor) + '; no sistema ' + brl(vs) + ', diferença ' + brl(r2(t.valor - vs)) + ').' + outroNome).trim() };
    }
    return { ...r, situacao: 'ok', nota: outroNome.trim() };
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

