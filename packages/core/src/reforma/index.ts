// A Reforma Tributária do consumo (CBS, IBS) no nads (22/11/2026: a fase 2 das calculadoras da Receita).
//   - as tabelas oficiais (tabelas.json, gerado por scripts/tabelas-rtc.mjs do banco da calculadora da Receita): o CST, o
//     cClassTrib (com a redução, o tipo de alíquota, o crédito do adquirente e a fundamentação), as alíquotas de
//     referência e as atividades do Simples. As funções recebem as tabelas (o JSON tem ~100 KB: a tela carrega quando
//     abre, por import('@nads/core/reforma-tabelas'), e não vai para o pacote principal do site);
//   - o simulador do Simples (simulador.ts): recolher o IBS/CBS dentro ou fora do DAS a partir de 2027.
// Puro: a tela só desenha.
export * from './simulador';

export interface CstRtc {
  codigo: string; descricao: string;
  /** aaaa-mm-dd; fim null = vigente */
  inicio: string; fim: string | null;
  /** os grupos que o CST leva no XML (gIBSCBS, gRed, gDif, gIBSCBSMono...) */
  grupos: Record<string, boolean>;
}

export interface ClassificacaoRtc {
  codigo: string; descricao: string; cst: string;
  /** Padrão, Fixa, Sem alíquota, Uniforme nacional (referência), Uniforme setorial, Alíquotas Combinadas */
  tipoAliquota: string;
  /** NCM, NBS, NBS ou NCM, Não possui */
  nomenclatura: string;
  /** o percentual de redução vigente por tributo (CBS, IBSUF, IBSMun), 0 a 100 */
  reducao: Partial<Record<'CBS' | 'IBSUF' | 'IBSMun', number>>;
  creditoAdquirente: { CBS: boolean; IBS: boolean };
  creditoPresumidoFornecedor: boolean; creditoPresumidoAdquirente: boolean;
  /** Manutenção, Estorno... (o crédito da operação antecedente) */
  creditoOperacaoAntecedente: string;
  /** o anexo da LC 214/2025, quando tem */
  anexo: string;
  /** o texto curto da base legal ("Art. 125") */
  fundamentacao: string[];
  inicio: string; fim: string | null;
}

export interface AliquotaReferenciaRtc { tributo: string; valor: number; inicio: string; fim: string | null }

export interface AtividadeSimplesRtc {
  codigo: string; descricao: string; anexo: string; anexoComFatorR: string; rotulo: string;
  naoTributavel: boolean; issNoSimples: boolean; inicio: string; fim: string | null;
}

export interface TabelasRtc {
  fonte: string; versaoDoBanco: string; descricaoDoBanco: string;
  cst: CstRtc[]; cClassTrib: ClassificacaoRtc[]; aliquotasReferencia: AliquotaReferenciaRtc[]; atividadesSimples: AtividadeSimplesRtc[];
}

/** vale na data (aaaa-mm-dd): começou e ainda não terminou */
export const vigente = (x: { inicio: string; fim: string | null }, data: string): boolean => x.inicio <= data && (!x.fim || x.fim >= data);

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Os CST vigentes na data. */
export const cstsVigentes = (t: TabelasRtc, data: string): CstRtc[] => t.cst.filter(c => vigente(c, data));

/** A classificação vigente pelo código (6 dígitos), ou null. */
export function classificacao(t: TabelasRtc, codigo: string, data: string): ClassificacaoRtc | null {
  const c = String(codigo || '').replace(/\D/g, '');
  return t.cClassTrib.find(x => x.codigo === c && vigente(x, data)) || null;
}

/**
 * Busca de cClassTrib vigentes: pelo código (o começo: "200" traz todos do CST 200) ou por palavras da descrição, da
 * fundamentação e do anexo (todas as palavras, sem acento). cst: só as desse CST.
 */
export function buscarClassificacoes(t: TabelasRtc, texto: string, data: string, cst = ''): ClassificacaoRtc[] {
  const base = t.cClassTrib.filter(x => vigente(x, data) && (!cst || x.cst === cst));
  const q = semAcento(String(texto || '').trim());
  if (!q) return base;
  if (/^\d+$/.test(q)) return base.filter(x => x.codigo.startsWith(q));
  const palavras = q.split(/\s+/).filter(Boolean);
  return base.filter(x => {
    const tudo = semAcento([x.codigo, x.descricao, x.fundamentacao.join(' '), x.anexo ? 'anexo ' + x.anexo : ''].join(' '));
    return palavras.every(p => tudo.includes(p));
  });
}

/** As alíquotas de referência na data (CBS, IBSUF, IBSMun em %); null quando a tabela não tem (a partir de 2027). */
export function aliquotasDeReferencia(t: TabelasRtc, data: string): Record<string, number> | null {
  const vale = t.aliquotasReferencia.filter(a => vigente(a, data));
  return vale.length ? Object.fromEntries(vale.map(a => [a.tributo, a.valor])) : null;
}

/** A redução em texto curto: "sem redução", "100% na CBS e no IBS", "60% CBS · 60% IBS UF · 60% IBS mun." */
export function textoDaReducao(c: ClassificacaoRtc): string {
  const r = c.reducao;
  const v = [r.CBS || 0, r.IBSUF || 0, r.IBSMun || 0];
  if (v.every(x => !x)) return 'sem redução';
  const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
  if (v.every(x => x === v[0])) return pct(v[0]) + ' na CBS e no IBS';
  return [['CBS', v[0]], ['IBS UF', v[1]], ['IBS mun.', v[2]]].map(([n, x]) => pct(x as number) + ' ' + n).join(' · ');
}

/** O crédito de quem compra, em texto curto. */
export function textoDoCredito(c: ClassificacaoRtc): string {
  const { CBS, IBS } = c.creditoAdquirente;
  const base = CBS && IBS ? 'gera crédito de CBS e IBS' : CBS ? 'gera crédito só de CBS' : IBS ? 'gera crédito só de IBS' : 'não gera crédito ao adquirente';
  return base + (c.creditoPresumidoAdquirente ? ' · crédito presumido do adquirente' : '') + (c.creditoPresumidoFornecedor ? ' · crédito presumido do fornecedor' : '');
}

/** As atividades do Simples vigentes na data (as 15 da calculadora do Simples, com o anexo). */
export const atividadesDoSimples = (t: TabelasRtc, data: string): AtividadeSimplesRtc[] => t.atividadesSimples.filter(a => vigente(a, data));
