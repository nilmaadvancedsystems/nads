// O 13º salário nas Obrigações do DP (Vitor, 13/10/2026): as duas parcelas e o que se controla em cada uma, numa execução
// própria, a "competência 13" do ano (AAAA-13), com as etapas d13-1-* (1ª parcela) e d13-2-* (2ª parcela). Daqui saem a
// tabela do 13º no DP e o botão "13º do DP" da Rota do Entregas (11/11/2026: "quero que as empresas do dp que estão como
// office boy e estão com o 13 salario pronto suba para a rota").
import { estadoDa } from './execucao';
import type { Execucao } from '../tipos';

const ob = (id: string, rotulo: string, nome: string) => ({ id, rotulo, nome });
/** As parcelas e o que se controla em cada uma (a ordem é a das colunas). */
export const PARCELAS_DO_13 = [
  { id: '1', rotulo: '1ª parcela', mes: 'novembro', obrigacoes: [ob('recibos', 'Recibos', 'Recibos da 1ª parcela'), ob('folha', 'Folha', 'Folha da 1ª parcela')] },
  { id: '2', rotulo: '2ª parcela', mes: 'dezembro', obrigacoes: [
    ob('recibos', 'Recibos', 'Recibos da 2ª parcela'), ob('folha', 'Folha', 'Folha da 2ª parcela'),
    ob('s1200', 'S-1200', 'eSocial S-1200 do 13º'), ob('s1210', 'S-1210', 'eSocial S-1210 do 13º'), ob('s1299', 'S-1299', 'eSocial S-1299 (fechamento do 13º)'),
    ob('dctfweb', 'DCTFWeb', 'DCTFWeb do 13º'), ob('darf', 'DARF', 'DARF do 13º (INSS e IRRF)'),
  ] },
] as const;
export type ParcelaDoDecimo = '1' | '2';

/** A competência do 13º do ano ('2026-13'). */
export const competenciaDoDecimo = (ano: number) => ano + '-13';
/** As etapas da parcela na execução do 13º ('d13-1-recibos', …). */
export const etapasDaParcela = (parcela: ParcelaDoDecimo) =>
  (PARCELAS_DO_13.find(p => p.id === parcela)?.obrigacoes || []).map(o => 'd13-' + parcela + '-' + o.id);
/** A parcela está pronta: todas as etapas dela feitas (ou dispensadas), como a coluna verde da tabela do 13º. */
export function parcelaDoDecimoPronta(ex: Execucao | null, parcela: ParcelaDoDecimo): boolean {
  return etapasDaParcela(parcela).every(etapa => { const s = estadoDa(ex, etapa)?.situacao; return s === 'feita' || s === 'dispensada'; });
}
/** As etapas feitas (ou dispensadas), todas. */
const todasFeitas = (ex: Execucao | null, etapas: readonly string[]) =>
  etapas.every(etapa => { const s = estadoDa(ex, etapa)?.situacao; return s === 'feita' || s === 'dispensada'; });
/**
 * A parcela pronta para ir à rota do Entregas (26/11/2026: "tem 13 que já tá marcado e não puxa lá"): só o papel que o
 * office boy leva, os Recibos e a Folha. O eSocial, a DCTFWeb e o DARF da 2ª parcela não seguram a entrega.
 */
export function parcelaProntaParaEntregar(ex: Execucao | null, parcela: ParcelaDoDecimo): boolean {
  return todasFeitas(ex, ['d13-' + parcela + '-recibos', 'd13-' + parcela + '-folha']);
}
/**
 * A folha do mês pronta para ir à rota (26/11/2026: "quero poder puxar folha de pagamento também"): os Recibos de
 * pagamento e a Folha de pagamento feitos na rotina do DP da competência (as etapas dp-recibos e dp-folha).
 */
export function folhaProntaParaEntregar(ex: Execucao | null): boolean {
  return todasFeitas(ex, ['dp-recibos', 'dp-folha']);
}
/** A parcela que vale no mês: novembro = a 1ª; dezembro e janeiro = a 2ª (do ano que passou, em janeiro); nos outros, nenhuma. */
export function parcelaDoMes(hoje = new Date()): { ano: number; parcela: ParcelaDoDecimo } | null {
  const m = hoje.getMonth() + 1;
  if (m === 11) return { ano: hoje.getFullYear(), parcela: '1' };
  if (m === 12) return { ano: hoje.getFullYear(), parcela: '2' };
  if (m === 1) return { ano: hoje.getFullYear() - 1, parcela: '2' };
  return null;
}
