// O leitor do DAS e do DAE (Vitor, 16/10/2026): recebe o TEXTO que o leitor de PDF tirou da guia e devolve o que a Área do
// Cliente precisa mostrar (qual guia, vencimento e valor). Puro: sem PDF, sem banco. Não achou o vencimento e o valor,
// devolve null (quem sobe a guia segue sem eles e avisa a pessoa). Os rótulos vêm do próprio documento:
//   DAS (Documento de Arrecadação do Simples Nacional): "Pagar este documento até", "Valor Total do Documento",
//        "Número do Documento", "Período de Apuração".
//   DAE de MG (Documento de Arrecadação Estadual, SEF/MG): "Data de Vencimento"/"Vencimento"/"Validade", "Valor Total".
import { dataDoVencimento, valorEmReais } from './guias';

export type GuiaLida = 'DAS' | 'DAE';

export interface LeituraDaGuia {
  guia: GuiaLida;
  /** 'dd/mm/aaaa' */
  vencimento: string;
  /** '1.234,56' */
  valor: string;
  numero?: string;
  /** 'aaaa-mm' */
  competencia?: string;
}

const DATA = '(\\d{2}/\\d{2}/\\d{4})';
const DINHEIRO = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})';
/** até onde, depois do rótulo, o valor ainda é dele (cobre o valor na linha de baixo) */
const ALCANCE = 90;

/** Minúsculas, sem acento, espaços e quebras de linha viram um espaço só (os rótulos variam de caixa e acento). */
function normalizado(texto: string): string {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** O primeiro valor que casa com `padrao` logo depois de algum dos rótulos (na ordem de preferência). */
function depoisDoRotulo(texto: string, rotulos: readonly string[], padrao: string): string | null {
  for (const r of rotulos) {
    const m = new RegExp(r + '[^0-9]{0,' + ALCANCE + '}?' + padrao).exec(texto);
    if (m) return m[1];
  }
  return null;
}

/** 'dd/mm/aaaa' e data de verdade (dia 31/02 não passa). */
const dataValida = (d: string | null): d is string => !!d && dataDoVencimento(d) !== null;

/** O período como 'aaaa-mm': aceita "09/2026", "01/09/2026" e "01/09/2026 a 30/09/2026" (vale o primeiro dia). */
function competenciaLida(texto: string, rotulos: readonly string[]): string | undefined {
  const dia = depoisDoRotulo(texto, rotulos, '(\\d{2}/\\d{2}/\\d{4})');
  const mes = depoisDoRotulo(texto, rotulos, '(\\d{2}/\\d{4})(?!/)');
  const m = /^(\d{2})\/(\d{4})$/.exec(dia ? dia.slice(3) : mes || '');
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? m[2] + '-' + m[1] : undefined;
}

/** O número do documento: dígitos com pontos, traços e barras (ex.: "07.18.26277.1234567-8"). */
function numeroLido(texto: string, rotulos: readonly string[]): string | undefined {
  return depoisDoRotulo(texto, rotulos, '(\\d[\\d.\\-/]{6,40}\\d)') || undefined;
}

/** De qual guia é o texto (null = não parece DAS nem DAE). */
export function guiaDoTexto(texto: string): GuiaLida | null {
  const t = normalizado(texto);
  if (/documento de arrecadacao do simples nacional|pgdas/.test(t)) return 'DAS';
  if (/documento de arrecadacao estadual|\bdae\b|secretaria de estado de fazenda|sef\/mg/.test(t)) return 'DAE';
  return null;
}

/**
 * Lê a guia do texto do PDF. Precisa achar o tipo, o vencimento e o valor; senão devolve null. O número e a competência
 * vêm junto quando o documento os traz.
 */
export function lerGuia(texto: string): LeituraDaGuia | null {
  const guia = guiaDoTexto(texto);
  if (!guia) return null;
  const t = normalizado(texto);
  const das = guia === 'DAS';
  const vencimento = depoisDoRotulo(t, das
    ? ['pagar este documento ate', 'pagar ate', 'data de vencimento', 'vencimento']
    : ['data de vencimento', 'data de validade', 'vencimento', 'validade', 'pagar ate'], DATA);
  const valor = depoisDoRotulo(t, das
    ? ['valor total do documento', 'valor total', 'total do documento']
    : ['valor total do dae', 'valor total a recolher', 'total a recolher', 'valor total', 'valor a recolher', 'valor do documento'], DINHEIRO);
  if (!dataValida(vencimento) || !valor || !Number.isFinite(valorEmReais(valor))) return null;
  const numero = numeroLido(t, das ? ['numero do documento'] : ['numero do dae', 'numero do documento']);
  const competencia = competenciaLida(t, das
    ? ['periodo de apuracao', 'periodo de referencia']
    : ['periodo de referencia', 'periodo de apuracao', 'competencia']);
  return { guia, vencimento, valor, ...(numero ? { numero } : {}), ...(competencia ? { competencia } : {}) };
}
