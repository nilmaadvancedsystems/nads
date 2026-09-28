// Lançamentos de ajuste (positivação do saldo negativo) e estorno no dia seguinte.
// Origem: cheque_especial.html — buildLancamentos (~L628); contagens de renderResults (~L688);
// histórico padrão do campo fHistorico (~L391).
import type { DiaSaldo, Lancamento, ResultadoAjuste, ResumoAjuste } from '../tipos';
import { dataBR, proximoDiaUtil } from './datas';

/** Código de histórico que a tela já traz preenchido. */
export const HISTORICO_PADRAO = '92029';

/**
 * Para cada dia que fecha negativo: Ajuste no próprio dia (D banco / C cheque especial) e
 * Estorno (D cheque especial / C banco) no PRÓXIMO DIA PRESENTE no relatório. Se o relatório
 * termina negativo, o último estorno vai para o próximo dia útil e sai marcado como projetado.
 */
export function gerarLancamentos(dias: DiaSaldo[], contaBanco: string, contaCheque: string, historico: string): ResultadoAjuste {
  const lancamentos: Lancamento[] = [];
  let pendente: { valor: number; desde: Date } | null = null;
  for (const dia of dias) {
    if (pendente) {
      lancamentos.push({
        data: dia.data, debito: contaCheque, credito: contaBanco,
        valor: pendente.valor, historico, tipo: 'Estorno',
        obs: 'Estorno do ajuste de ' + dataBR(pendente.desde), projetado: false,
      });
      pendente = null;
    }
    if (dia.saldo < 0) {
      const valor = Math.abs(dia.saldo);
      lancamentos.push({
        data: dia.data, debito: contaBanco, credito: contaCheque,
        valor, historico, tipo: 'Ajuste',
        obs: 'Positivação do saldo negativo de ' + dataBR(dia.data), projetado: false,
      });
      pendente = { valor, desde: dia.data };
    }
  }
  let projetado = false;
  if (pendente) {
    projetado = true;
    lancamentos.push({
      data: proximoDiaUtil(dias[dias.length - 1].data), debito: contaCheque, credito: contaBanco,
      valor: pendente.valor, historico, tipo: 'Estorno',
      obs: 'Estorno do ajuste de ' + dataBR(pendente.desde) + ' (data projetada — fora do período do relatório)',
      projetado: true,
    });
  }
  return { lancamentos, projetado };
}

/** Os números dos cartões: dias negativos e total contam só os Ajustes (soma sem arredondar). */
export function resumoDoAjuste(res: ResultadoAjuste, dias: DiaSaldo[]): ResumoAjuste {
  const ajustes = res.lancamentos.filter(l => l.tipo === 'Ajuste');
  return {
    diasAnalisados: dias.length,
    diasNegativos: ajustes.length,
    totalAjustado: ajustes.reduce((acc, l) => acc + l.valor, 0),
    qtdLancamentos: res.lancamentos.length,
  };
}
