// Leitura do arquivo do sistema (.xls, .xlsx ou .csv): de cada recebimento, a NF, o cliente, a
// Contrapartida, o Histórico e o valor. Sem coluna de NF (ou de cliente), tira do histórico
// ("Recebimento de clientes NF 4521 - MERCADO X").
import { normalizarTexto } from '../../../formatos';
import { dinheiro } from '../regras/numeros';
import type { LinhaSistema } from '../tipos';
import { linhasDaPlanilha, textoDaCelula, type Linha } from './planilha';

export type CampoSistema = 'nf' | 'cliente' | 'contrapartida' | 'historico' | 'valor' | 'data';

export const EXTENSOES_SISTEMA: readonly string[] = ['.csv', '.xls', '.xlsx', '.txt'];

export function campoDoSistema(h: unknown): CampoSistema | null {
  const s = normalizarTexto(h);
  if (!s) return null;
  if (/contrapartida|conta cred|^credito|^conta\b/.test(s)) return 'contrapartida';
  if (/hist|descri|complemento/.test(s)) return 'historico';
  if (/^nf\b|nota|documento|^doc\b|^num/.test(s)) return 'nf';
  if (/cliente|nome|razao|sacado|participante/.test(s)) return 'cliente';
  if (/valor|vlr|montante/.test(s)) return 'valor';
  if (/^(data|dt)\b/.test(s)) return 'data';
  return null;
}

/**
 * "Recebimento de clientes NF 4521 - MERCADO X" → "4521".
 * Alterdata: "Recebimento de clientes  9925 -DUP.001 -04352355000109 -ARAUJO" → "9925": a NF é o número
 * ANTES do "-DUP"; o número depois é a parcela.
 */
export function nfDoHistorico(h: string): string {
  const antesDaDup = h.match(/(\d+)\s*-\s*dup\.?\s*\d+/i);
  if (antesDaDup) return antesDaDup[1];
  const m = h.match(/\b(?:nf|n\.\s?f\.?|nota(?:\s+fiscal)?|duplicata|dup)\.?\s*(?:n[º°o.]?\s*)?[:-]?\s*(\d+)/i);
  return m ? m[1] : '';
}

/**
 * "Recebimento de clientes NF 4521 - MERCADO X" → "MERCADO X".
 * Com CPF/CNPJ no meio (Alterdata: "... -DUP.001 -04352355000109 -ARAUJO E SA LTDA"), o nome vem depois dele.
 */
export function clienteDoHistorico(h: string): string {
  const depoisDoDoc = h.match(/\d{11,14}\s*[-–:]\s*(.+)$/);
  if (depoisDoDoc) return depoisDoDoc[1].trim();
  const m = h.match(/\d+\s*[-–:]\s*(.+)$/);
  return m ? m[1].trim() : '';
}

/** As colunas que podem ser cada campo, pelo cabeçalho (pode haver mais de uma: "Hist." e "Complemento"). */
function candidatas(l: Linha): Partial<Record<CampoSistema, number[]>> {
  const m: Partial<Record<CampoSistema, number[]>> = {};
  l.forEach((c, i) => { const k = campoDoSistema(c); if (k) m[k] = [...(m[k] || []), i]; });
  return m;
}

function cabecalho(l: Linha): boolean {
  const m = candidatas(l);
  return !!m.contrapartida && !!m.valor && !!(m.nf || m.historico);
}

/**
 * Escolhe as colunas olhando o conteúdo, não só o cabeçalho (o Alterdata exporta o código do histórico,
 * "00246", ao lado do texto, "Recebimento DUP.009897…"):
 * - histórico: a coluna com mais texto (letras);
 * - NF: a coluna com mais números, e só se eles mudam de linha para linha (número repetido em quase
 *   todas as linhas é código, não NF). Sem ela, a NF sai do histórico.
 */
function escolher(cab: Linha, dados: Linha[]): Partial<Record<CampoSistema, number>> {
  const c = candidatas(cab);
  const amostra = dados.slice(0, 50).filter(l => l.some(x => textoDaCelula(x)));
  const textos = (i: number) => amostra.map(l => textoDaCelula(l[i])).filter(Boolean);
  const m: Partial<Record<CampoSistema, number>> = {};
  for (const k of Object.keys(c) as CampoSistema[]) m[k] = (c[k] as number[])[0];
  if (c.historico && c.historico.length > 1) {
    // Histórico de verdade tem texto E número ("Recebimento de clientes 9925 -DUP.001 ..."). No Alterdata a
    // "Descrição" é só o nome do cliente e a "Descrição histórico" é o histórico: antes ganhava a primeira
    // coluna com letras (o nome), e nenhuma NF era achada (292, 2026-09-29).
    const letras = (i: number) => textos(i).filter(t => /[a-zA-ZÀ-ú]{3}/.test(t)).length;
    const comNumero = (i: number) => textos(i).filter(t => /[a-zA-ZÀ-ú]{3}/.test(t) && /\d{3,}/.test(t)).length;
    const ordem = [...c.historico].sort((a, b) => comNumero(b) - comNumero(a) || letras(b) - letras(a));
    m.historico = ordem[0];
    // sem coluna de cliente: a outra coluna de texto sem números (o nome) é o cliente
    if (!c.cliente) {
      const soNome = ordem.slice(1).filter(i => letras(i) > 0 && comNumero(i) === 0).sort((a, b) => letras(b) - letras(a))[0];
      if (soNome != null) m.cliente = soNome;
    }
  }
  if (c.nf) {
    const digitos = (i: number) => textos(i).filter(t => /\d/.test(t)).length;
    const nf = [...c.nf].sort((a, b) => digitos(b) - digitos(a))[0];
    const t = textos(nf).filter(x => /\d/.test(x));
    const diferentes = new Set(t).size;
    m.nf = t.length && (t.length < 4 || diferentes / t.length >= 0.5) ? nf : undefined;
  }
  return m;
}

export function lerSistema(buf: ArrayBuffer, nome: string): LinhaSistema[] {
  const linhas = linhasDaPlanilha(buf, nome);
  const i0 = linhas.findIndex(cabecalho);
  if (i0 < 0) throw new Error('Não achei as colunas Contrapartida, Valor e NF (ou Histórico) no arquivo do sistema.');
  const m = escolher(linhas[i0], linhas.slice(i0 + 1));
  const cel = (l: Linha, k: CampoSistema) => (m[k] != null ? textoDaCelula(l[m[k] as number]) : '');
  const saida: LinhaSistema[] = [];
  linhas.slice(i0 + 1).forEach((l, i) => {
    const historico = cel(l, 'historico');
    const contrapartida = cel(l, 'contrapartida').replace(/\.0$/, '');
    const nf = cel(l, 'nf').replace(/\.0$/, '') || nfDoHistorico(historico);
    if (!nf && !contrapartida) return;
    saida.push({
      linha: i0 + i + 2, nf, contrapartida, historico,
      cliente: cel(l, 'cliente') || clienteDoHistorico(historico),
      valor: dinheiro(m.valor != null ? l[m.valor] : null),
    });
  });
  if (!saida.length) throw new Error('O arquivo do sistema não tem nenhum recebimento abaixo do cabeçalho.');
  // O Alterdata exporta a conciliação pela conta do cliente: os recebimentos vêm NEGATIVOS (-2.809,73).
  // O banco traz positivos; com a maioria negativa, vira tudo (senão todo valor "diverge").
  const comValor = saida.filter(l => l.valor != null && l.valor !== 0);
  if (comValor.length && comValor.filter(l => (l.valor as number) < 0).length > comValor.length / 2) {
    saida.forEach(l => { if (l.valor != null) l.valor = -l.valor; });
  }
  return saida;
}
