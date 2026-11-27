// O que a Projeção do Fator R guarda (26/11/2026): fatorR/{ano}_{código}, um documento por empresa e ano, com a receita e a
// folha digitadas (ou lidas do PDF do extrato do PGDAS-D subido na tela) de cada mês do ano. A tela de um ano de projeção lê
// três documentos (o ano, o anterior e o antes dele, para o Fator R dos meses do ano anterior) e o pgdas/{código} da empresa.
// O que o robô do e-CAC já trouxe (pgdas/{código}) vale mais que o digitado: no Simples o faturamento é o do PGDAS-D.
import { extratoDaEmpresa, type ExtratoDoPgdas } from '../pgdas/extrato';
import { competenciasEntre, type FonteDoValor, type MesDoFatorR } from './projecao';

/** 'MM' → valor */
export type ValoresDoAno = Record<string, number>;

export interface FatorRDoAno {
  ano: number;
  codigo: number;
  receita: ValoresDoAno;
  folha: ValoresDoAno;
  /** os meses que vieram do PDF do PGDAS-D: 'r01' (a receita de janeiro), 'f01' (a folha de janeiro) */
  doPdf: string[];
  atualizadoEm: string;
  atualizadoPor: string;
}

export type CampoDoFatorR = 'receita' | 'folha';
/** o maior valor aceito num mês (R$ 100 bilhões: só barra o número colado errado) */
export const MAIOR_VALOR = 1e11;
const MES = /^(0[1-9]|1[0-2])$/;
const MARCA = /^[rf](0[1-9]|1[0-2])$/;
const centavos = (v: number) => Math.round(v * 100) / 100;

export const idDoFatorR = (ano: number, codigo: number) => ano + '_' + codigo;

/** o ano da projeção que a tela abre: de outubro em diante, o ano que vem (a planilha de 2027 foi feita em nov/2026) */
export function anoPadraoDaProjecao(hoje: Date): number {
  return hoje.getMonth() >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}

/** os documentos que a tela de um ano lê (o mais velho primeiro) */
export const anosDaProjecao = (ano: number): number[] => [ano - 2, ano - 1, ano];

/** os meses que a tela mostra: o ano anterior inteiro e o ano da projeção */
export const competenciasDaProjecao = (ano: number): string[] => competenciasEntre((ano - 1) + '-01', ano + '-12');

export function fatorRVazio(ano: number, codigo: number): FatorRDoAno {
  return { ano, codigo, receita: {}, folha: {}, doPdf: [], atualizadoEm: '', atualizadoPor: '' };
}

const valorBom = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAIOR_VALOR;
function valoresDe(v: unknown): ValoresDoAno {
  const out: ValoresDoAno = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (MES.test(k) && valorBom(x)) out[k] = centavos(x);
  return out;
}

/** O documento do banco como a tela usa; o que não fecha fica de fora. null = não é um documento do Fator R. */
export function lerFatorRDoAno(dados: unknown): FatorRDoAno | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown>;
  const ano = Number(d.ano), codigo = Number(d.codigo);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2099 || !Number.isInteger(codigo) || codigo <= 0) return null;
  return {
    ano, codigo, receita: valoresDe(d.receita), folha: valoresDe(d.folha),
    doPdf: Array.isArray(d.doPdf) ? [...new Set((d.doPdf as unknown[]).filter((x): x is string => typeof x === 'string' && MARCA.test(x)))].sort() : [],
    atualizadoEm: typeof d.atualizadoEm === 'string' ? d.atualizadoEm.slice(0, 40) : '',
    atualizadoPor: typeof d.atualizadoPor === 'string' ? d.atualizadoPor.slice(0, 100) : '',
  };
}

/** O documento com o valor do mês trocado (null tira o valor). Valor negativo ou absurdo: o documento volta igual. */
export function comValorDoMes(doc: FatorRDoAno, competencia: string, campo: CampoDoFatorR, valor: number | null, fonte: 'digitado' | 'pdf' = 'digitado'): FatorRDoAno {
  const [a, mm] = competencia.split('-');
  if (Number(a) !== doc.ano || !MES.test(mm || '')) return doc;
  if (valor != null && !valorBom(valor)) return doc;
  const valores = { ...doc[campo] };
  if (valor == null) delete valores[mm]; else valores[mm] = centavos(valor);
  const marca = (campo === 'receita' ? 'r' : 'f') + mm;
  const doPdf = doc.doPdf.filter(x => x !== marca);
  if (valor != null && fonte === 'pdf') doPdf.push(marca);
  return { ...doc, [campo]: valores, doPdf: doPdf.sort() };
}

/** o pedaço do PGDAS-D do robô que a projeção usa (o pgdas/{código}) */
export interface PgdasParaOFatorR {
  meses: Readonly<Record<string, { receita: number }>>;
  folhas?: Readonly<Record<string, { valor: number }>>;
}

/**
 * Os meses da empresa para a projeção: o digitado (e o do PDF) dos documentos e, por cima, o PGDAS-D do robô (a receita
 * declarada e a folha do 2.3), que vale mais.
 */
export function mesesDaEmpresa(docs: readonly FatorRDoAno[], pgdas: PgdasParaOFatorR | null): Record<string, MesDoFatorR> {
  const meses: Record<string, MesDoFatorR> = {};
  const mes = (c: string) => (meses[c] ??= { receita: null, folha: null });
  for (const d of docs) {
    const doPdf = new Set(d.doPdf);
    const fonte = (marca: string): FonteDoValor => (doPdf.has(marca) ? 'pdf' : 'digitado');
    for (const [mm, v] of Object.entries(d.receita)) mes(d.ano + '-' + mm).receita = { valor: v, fonte: fonte('r' + mm) };
    for (const [mm, v] of Object.entries(d.folha)) mes(d.ano + '-' + mm).folha = { valor: v, fonte: fonte('f' + mm) };
  }
  for (const [c, m] of Object.entries(pgdas?.meses || {})) mes(c).receita = { valor: m.receita, fonte: 'pgdas' };
  for (const [c, f] of Object.entries(pgdas?.folhas || {})) mes(c).folha = { valor: f.valor, fonte: 'pgdas' };
  return meses;
}

export type ResultadoDoPdf =
  | { erro: string }
  | { docs: FatorRDoAno[]; receitas: number; folhas: number; pa: string };

/**
 * O PDF do extrato do PGDAS-D subido na tela: a receita do PA e dos meses anteriores e a folha do 2.3 vão para os
 * documentos da empresa, marcados como do PDF (o PDF não é guardado). Só os anos de `anos` (os que a tela leu) mudam; o
 * extrato de outro CNPJ é recusado. Devolve só os documentos que mudaram.
 */
export function comOExtrato(atuais: ReadonlyMap<number, FatorRDoAno>, extrato: ExtratoDoPgdas | null, empresa: { codigo: number; cnpj: string },
  anos: readonly number[]): ResultadoDoPdf {
  if (!extrato) return { erro: 'Este PDF não é um extrato do PGDAS-D.' };
  if (!extratoDaEmpresa(extrato, empresa.cnpj)) return { erro: 'O extrato é de outro CNPJ' + (extrato.cnpj ? ' (' + extrato.cnpj + ')' : '') + ', não da empresa ' + empresa.codigo + '.' };
  const docs = new Map<number, FatorRDoAno>();
  const doAno = (a: number) => docs.get(a) ?? atuais.get(a) ?? fatorRVazio(a, empresa.codigo);
  let receitas = 0, folhas = 0;
  const por = (c: string, campo: CampoDoFatorR, v: number) => {
    const a = Number(c.slice(0, 4));
    if (!anos.includes(a)) return false;
    docs.set(a, comValorDoMes(doAno(a), c, campo, v, 'pdf'));
    return true;
  };
  for (const m of extrato.anteriores) if (por(m.competencia, 'receita', m.total)) receitas++;
  if (por(extrato.competencia, 'receita', extrato.receita.total)) receitas++;
  for (const f of extrato.folhas || []) if (por(f.competencia, 'folha', f.valor)) folhas++;
  if (!receitas && !folhas) return { erro: 'O extrato é de ' + extrato.competencia.slice(5) + '/' + extrato.competencia.slice(0, 4) + ': nenhum mês dele cai nos anos desta projeção.' };
  return { docs: [...docs.values()], receitas, folhas, pa: extrato.competencia };
}
