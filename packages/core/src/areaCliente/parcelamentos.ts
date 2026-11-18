// Os parcelamentos na Área do Cliente (plano do Acessórias, 18/11/2026, ficha parcelamentos; frase do dono: "Serve,
// seguir"). Os mesmos da página Parcelamentos do Entregas (a coleção parcelamentos, que o robo/parcela-paga.js marca pelo
// comprovante): só os ativos, como "parcela 12 de 60", o valor e o PRÓXIMO vencimento. Nunca "atrasada": as pagas só são
// marcadas pelo comprovante de e-mail ou à mão, e um parcelamento desatualizado assustaria o cliente à toa. Por isso a
// parcela mostrada é a do calendário (não a primeira sem marca): a deste mês, ou a do mês seguinte quando a deste já
// venceu ou já está paga. Sem obs, número do processo, quem atualizou nem o id interno. Só a lógica.
import { ORGAOS_DO_PARCELAMENTO, mesMais, type Parcelamento } from '../entregas/parcelamentos';

/** O que vai para o espelho (resumo/parcelamentos). */
export interface ParcelamentoNaArea {
  /** o órgão e a posição na lista ("pgfn-1"), não o id interno */
  id: string;
  /** "PGFN · Dívida ativa", "Simples Nacional"… */
  orgao: string;
  /** a modalidade digitada (até 60 letras); '' sem */
  modalidade: string;
  parcela: number;
  parcelas: number;
  /** em reais */
  valorParcela: number;
  /** 'dd/mm/aaaa' */
  vencimento: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** O vencimento da parcela do mês (o dia do cadastro, cortado no fim do mês; 'util' = o último dia útil). */
function vencimentoDoMes(dia: Parcelamento['dia'], mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  let d = dia === 'util' ? ultimo : Math.min(dia, ultimo);
  if (dia === 'util') while ([0, 6].includes(new Date(a, m - 1, d).getDay())) d--;
  return pad(d) + '/' + pad(m) + '/' + a;
}

const isoDoBr = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2);

/** A parcela a mostrar hoje: a deste mês, ou a seguinte se a deste já venceu ou está paga; null = acabou. */
export function parcelaDoMomento(p: Parcelamento, hoje: Date): { numero: number; vencimento: string } | null {
  if (!/^\d{4}-\d{2}$/.test(p.primeira)) return null;
  const hojeIso = hoje.getFullYear() + '-' + pad(hoje.getMonth() + 1) + '-' + pad(hoje.getDate());
  const mesHoje = hojeIso.slice(0, 7);
  const pagas = new Set(p.pagas);
  // a primeira parcela ainda não chegou: ela
  let mes = mesHoje < p.primeira ? p.primeira : mesHoje;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const [a1, m1] = p.primeira.split('-').map(Number);
    const [a2, m2] = mes.split('-').map(Number);
    const numero = (a2 - a1) * 12 + (m2 - m1) + 1;
    if (numero > p.parcelas) return null;
    const vencimento = vencimentoDoMes(p.dia, mes);
    if (!pagas.has(mes) && isoDoBr(vencimento) >= hojeIso) return { numero, vencimento };
    mes = mesMais(mes, 1);
  }
  return null;
}

/** Os parcelamentos ativos do cliente como a Área mostra, o que vence primeiro antes; no máximo 10. */
export function parcelamentosDoCliente(lista: readonly Parcelamento[], hoje: Date): ParcelamentoNaArea[] {
  const contagem = new Map<string, number>();
  const saida: ParcelamentoNaArea[] = [];
  for (const p of lista) {
    if (p.status !== 'ativo' || !p.aberto) continue;
    const agora = parcelaDoMomento(p, hoje);
    if (!agora) continue;
    const n = (contagem.get(p.orgao) ?? 0) + 1;
    contagem.set(p.orgao, n);
    saida.push({
      id: p.orgao + '-' + n,
      orgao: ORGAOS_DO_PARCELAMENTO.find(o => o.id === p.orgao)?.rotulo ?? 'Outro',
      modalidade: p.modalidade.trim().slice(0, 60),
      parcela: agora.numero, parcelas: p.parcelas,
      valorParcela: Math.round(p.valorParcela * 100) / 100,
      vencimento: agora.vencimento,
    });
  }
  return saida.sort((a, b) => isoDoBr(a.vencimento).localeCompare(isoDoBr(b.vencimento))).slice(0, 10);
}
