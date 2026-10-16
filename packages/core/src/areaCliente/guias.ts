// As guias da Área do Cliente (Vitor, 16/10/2026): o que o cliente vê de cada guia pronta. O robô grava no espelho
// (areasCliente/{token}/guias/{id}) SÓ o que sai daqui: lista branca de campos, nunca o pedido inteiro do robô.
// Guia pronta aparece sozinha; a que tem aviso (filial na guia da matriz, débito antigo, emitida depois do vencimento…)
// espera o "Liberar" no escritório.

export type TipoDeGuia = 'FGTS' | 'DAS' | 'DAE' | 'outra';
export type SituacaoDaGuia = 'a vencer' | 'vence hoje' | 'vencida';

/** O nome da guia para o cliente, sem sigla solta. */
export const ROTULO_DA_GUIA: Record<TipoDeGuia, string> = { FGTS: 'FGTS', DAS: 'DAS (Simples Nacional)', DAE: 'DAE (imposto estadual)', outra: 'Guia' };
export const ROTULO_DA_SITUACAO_DA_GUIA: Record<SituacaoDaGuia, string> = { 'a vencer': 'A vencer', 'vence hoje': 'Vence hoje', vencida: 'Vencida' };

export interface GuiaDoCliente {
  id: string;
  tipo: TipoDeGuia;
  /** 'aaaa-mm' */
  competencia: string;
  /** 'dd/mm/aaaa' */
  vencimento: string;
  /** em reais */
  valor: number;
  /** o número da guia (quando tem) */
  numero?: string;
  /** calculada pela data de hoje; quem mostra recalcula com situacaoDaGuia */
  situacao: SituacaoDaGuia;
  /** o PDF está no espelho (guias/{id}/pdf/{n}) */
  temPdf: boolean;
}

/**
 * O pedido do FGTS Digital (pedidosFgts) como o robô o grava. Aqui só o que a projeção olha: o resto (passos, erro,
 * quem pediu…) é interno e não sai.
 */
export interface PedidoFgtsInterno {
  id: string;
  competencia: string;
  /** 'pronto' = a guia saiu */
  status: string;
  /** 'emitir' emite a guia; 'ensaio' só entra no perfil */
  modo: string;
  vencimento: string;
  /** ex.: "917,42" ou "1.917,42" */
  valor: string;
  numeroGuia: string;
  /** o que o DP precisa saber da guia: com aviso, espera a liberação do escritório */
  aviso: string;
  pdfNome?: string;
}

/** "1.917,42" ou "917,42" → 1917.42; NaN quando não é um valor. */
export function valorEmReais(texto: string): number {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  return Number(limpo.replace(/\./g, '').replace(',', '.'));
}

/** 'dd/mm/aaaa' → Date (meia-noite local); null se não for uma data. */
export function dataDoVencimento(vencimento: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(vencimento);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
}

/** A situação pela data: antes do vencimento "a vencer", no dia "vence hoje", depois "vencida". */
export function situacaoDaGuia(vencimento: string, hoje: Date): SituacaoDaGuia {
  const v = dataDoVencimento(vencimento);
  if (!v) return 'a vencer';
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return v.getTime() > h ? 'a vencer' : v.getTime() === h ? 'vence hoje' : 'vencida';
}

/** A guia do FGTS pronta tem aviso: espera o "Liberar" do escritório antes de aparecer para o cliente. */
export function guiaPrecisaLiberar(p: Pick<PedidoFgtsInterno, 'status' | 'modo' | 'aviso'>): boolean {
  return p.status === 'pronto' && p.modo === 'emitir' && !!String(p.aviso ?? '').trim();
}

/**
 * A guia do FGTS que o cliente vê: de um pedido pronto e de emitir (o ensaio nunca sai). Com aviso, só depois do
 * "Liberar" (liberada = true); sem a liberação devolve null. Lista branca: só os campos da GuiaDoCliente.
 */
export function guiaDoFgts(pedido: PedidoFgtsInterno, hoje: Date, liberada = false): GuiaDoCliente | null {
  if (pedido.status !== 'pronto' || pedido.modo !== 'emitir') return null;
  if (guiaPrecisaLiberar(pedido) && !liberada) return null;
  const valor = valorEmReais(pedido.valor);
  if (!Number.isFinite(valor) || !dataDoVencimento(pedido.vencimento) || !/^\d{4}-\d{2}$/.test(pedido.competencia)) return null;
  const numero = String(pedido.numeroGuia ?? '').trim();
  return {
    id: pedido.id,
    tipo: 'FGTS',
    competencia: pedido.competencia,
    vencimento: pedido.vencimento,
    valor,
    ...(numero ? { numero } : {}),
    situacao: situacaoDaGuia(pedido.vencimento, hoje),
    temPdf: !!String(pedido.pdfNome ?? '').trim(),
  };
}

/** As guias do cliente com a situação recalculada para hoje, as mais urgentes primeiro (vencimento, depois tipo). */
export function guiasDeHoje(guias: GuiaDoCliente[], hoje: Date): GuiaDoCliente[] {
  const chave = (g: GuiaDoCliente) => (dataDoVencimento(g.vencimento)?.getTime() ?? 0);
  return guias.map(g => ({ ...g, situacao: situacaoDaGuia(g.vencimento, hoje) })).sort((a, b) => chave(a) - chave(b) || a.tipo.localeCompare(b.tipo));
}

/** As guias agrupadas por competência, a mais nova primeiro. */
export function guiasPorCompetencia(guias: GuiaDoCliente[]): { competencia: string; guias: GuiaDoCliente[] }[] {
  const mapa = new Map<string, GuiaDoCliente[]>();
  for (const g of guias) mapa.set(g.competencia, [...(mapa.get(g.competencia) ?? []), g]);
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([competencia, lista]) => ({ competencia, guias: lista }));
}
