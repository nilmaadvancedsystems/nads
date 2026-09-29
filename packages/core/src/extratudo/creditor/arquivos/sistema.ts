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

/** "Recebimento de clientes NF 4521 - MERCADO X" → "4521" */
export function nfDoHistorico(h: string): string {
  const m = h.match(/\b(?:nf|n\.\s?f\.?|nota(?:\s+fiscal)?|duplicata|dup)\.?\s*(?:n[º°o.]?\s*)?[:-]?\s*(\d+)/i);
  return m ? m[1] : '';
}

/** "Recebimento de clientes NF 4521 - MERCADO X" → "MERCADO X" */
export function clienteDoHistorico(h: string): string {
  const m = h.match(/\d+\s*[-–:]\s*(.+)$/);
  return m ? m[1].trim() : '';
}

function mapa(l: Linha): Partial<Record<CampoSistema, number>> | null {
  const m: Partial<Record<CampoSistema, number>> = {};
  l.forEach((c, i) => { const k = campoDoSistema(c); if (k && m[k] == null) m[k] = i; });
  return m.contrapartida != null && m.valor != null && (m.nf != null || m.historico != null) ? m : null;
}

export function lerSistema(buf: ArrayBuffer, nome: string): LinhaSistema[] {
  const linhas = linhasDaPlanilha(buf, nome);
  const i0 = linhas.findIndex(l => mapa(l));
  if (i0 < 0) throw new Error('Não achei as colunas Contrapartida, Valor e NF (ou Histórico) no arquivo do sistema.');
  const m = mapa(linhas[i0]) as Partial<Record<CampoSistema, number>>;
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
  return saida;
}
