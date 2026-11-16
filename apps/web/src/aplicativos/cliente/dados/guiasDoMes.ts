// As regras curtas da tela de Guias e obrigações (16/11/2026: o dono apresentou a Área do Cliente e ouviu "tinha muita
// informação"). O resumo embaixo do título fica com no máximo dois fatos e cada guia diz só quando vence, numa frase
// curta ("Vence 19/11", "Venceu 11/11"), sem o "daqui a N dias" e sem a competência. Só a tela de Guias usa.
import type { TrechoDoResumo } from './regras';

/**
 * O resumo embaixo do título (16/11/2026, "muita informação"): no máximo dois fatos. Com guia a pagar: quanto há a pagar
 * e, ao lado, quantas venceram (ou, sem vencida, o próximo vencimento). Sem guia a pagar: "Nada a pagar em novembro" e,
 * se houver, quantas foram pagas no mês.
 */
export function resumoCurtoDasGuias(r: { nomeDoMes: string; aPagar: { valor: string; guias: number }; vencidas: number; proxima: string | null; pagas: number }): TrechoDoResumo[] {
  const qtas = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);
  if (!r.aPagar.guias) return [{ valor: 'Nada a pagar', depois: 'em ' + r.nomeDoMes }, ...(r.pagas ? [{ valor: qtas(r.pagas, 'guia paga', 'guias pagas') }] : [])];
  const segundo: TrechoDoResumo[] = r.vencidas ? [{ valor: qtas(r.vencidas, 'vencida', 'vencidas'), tom: 'perigo' }]
    : r.proxima ? [{ antes: 'próximo vencimento', valor: r.proxima }] : [];
  return [{ valor: r.aPagar.valor, depois: 'a pagar' }, ...segundo];
}

/**
 * A frase de cada guia a pagar (16/11/2026, "muita informação"): só a data, sem o "daqui a N dias". `tom` pinta a frase
 * da vencida e da que vence hoje. A data que não deu para ler fica na situação.
 */
export function quandoVence(situacao: string, vencimento: string): { texto: string; tom: '' | 'vencida' | 'hoje' } {
  const data = vencimento.slice(0, 5);
  const temData = /^\d\d\/\d\d$/.test(data);
  if (situacao === 'vencida') return { texto: temData ? 'Venceu ' + data : 'Vencida', tom: 'vencida' };
  if (situacao === 'vence hoje') return { texto: 'Vence hoje', tom: 'hoje' };
  return { texto: temData ? 'Vence ' + data : 'A pagar', tom: '' };
}
