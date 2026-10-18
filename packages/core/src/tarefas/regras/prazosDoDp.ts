// Os prazos legais de cada parte da rotina do DP (revisão da UI, 18/10/2026: "Atrasado passa a ser a parte pendente com o
// prazo vencido; Pendente é a que está no prazo"). Antes o DP só tinha o fim do mês da competência como data.
//
// O dia útil daqui tira o sábado (menos na folha, onde ele conta), o domingo e o feriado nacional (feriadoNacional, o mesmo
// das etiquetas da folha). Feriado estadual e municipal não entram: o escritório confere.
//
// As fontes (as mesmas que o DP já usa: a etiqueta da folha cita o art. 459 da CLT; a Legislação do DP no nads):
// - Salário (folha e recibos): até o 5º dia útil do mês seguinte, contando o sábado e não o domingo nem o feriado
//   (CLT, art. 459, § 1º; o sábado como dia útil, como a etiqueta da folha já usa).
// - eSocial, eventos periódicos (S-1200, S-1210, S-1299): até o dia 15 do mês seguinte; sem expediente, antecipa para o
//   dia útil anterior (Manual de Orientação do eSocial, item "prazos").
// - EFD-REINF: até o dia 15 do mês seguinte; sem expediente, antecipa (IN RFB 2.043/2021).
// - DARF de INSS e de IRRF (o que a DCTFWeb gera): dia 20 do mês seguinte; sem expediente bancário, antecipa (Lei 8.212/1991,
//   art. 30, I, "b"; Lei 11.196/2005, art. 70, I, "d"). A DCTFWeb fica com o prazo do DARF dela, como o escritório usa.
//   CONFERIR: a transmissão da DCTFWeb tem prazo próprio na IN RFB 2.005/2021.
// - FGTS Digital: dia 20 do mês seguinte; sem expediente, antecipa (Lei 8.036/1990, art. 15, com a Lei 14.438/2022).
// - eConsignado (o crédito do trabalhador): o repasse vai na guia do FGTS Digital, então o mesmo dia 20.
// - A entrega ao cliente não tem prazo legal: vale o da guia mais cedo que o cliente tem (a guia precisa chegar antes de
//   vencer). Sem guia, o da folha.
// - As categorias criadas no nads (x-…) não têm prazo cadastrado: ficam fora do "atrasado".
import { feriadoNacional } from './etiquetasDaFolha';

export type AjusteDoPrazo = 'antecipa' | 'posterga';

export interface RegraDoPrazo {
  /** o dia do mês seguinte, ou 'quinto-dia-util' (contando o sábado) */
  dia: number | 'quinto-dia-util';
  ajuste: AjusteDoPrazo;
  fonte: string;
}

export const PRAZOS_DO_DP: Readonly<Record<string, RegraDoPrazo>> = {
  folha: { dia: 'quinto-dia-util', ajuste: 'antecipa', fonte: 'CLT, art. 459, § 1º' },
  recibos: { dia: 'quinto-dia-util', ajuste: 'antecipa', fonte: 'CLT, art. 459, § 1º' },
  s1200: { dia: 15, ajuste: 'antecipa', fonte: 'Manual do eSocial (eventos periódicos)' },
  s1210: { dia: 15, ajuste: 'antecipa', fonte: 'Manual do eSocial (eventos periódicos)' },
  s1299: { dia: 15, ajuste: 'antecipa', fonte: 'Manual do eSocial (eventos periódicos)' },
  reinf: { dia: 15, ajuste: 'antecipa', fonte: 'IN RFB 2.043/2021' },
  dctfweb: { dia: 20, ajuste: 'antecipa', fonte: 'Lei 8.212/1991, art. 30, I, "b" (o DARF da DCTFWeb)' },
  darf: { dia: 20, ajuste: 'antecipa', fonte: 'Lei 8.212/1991, art. 30; Lei 11.196/2005, art. 70' },
  fgts: { dia: 20, ajuste: 'antecipa', fonte: 'Lei 8.036/1990, art. 15 (Lei 14.438/2022)' },
  econsignado: { dia: 20, ajuste: 'antecipa', fonte: 'na guia do FGTS Digital (Lei 8.036/1990, art. 15)' },
};

/** as guias (o que a entrega leva ao cliente) */
const GUIAS = ['dctfweb', 'darf', 'fgts', 'econsignado'];

const dois = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
const util = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6 && !feriadoNacional(d);

/** o mês seguinte à competência 'aaaa-mm' (ano, mês base 0) */
function mesSeguinte(competencia: string): [number, number] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]), 1);
  return [d.getFullYear(), d.getMonth()];
}

/** o dia de uma regra no mês seguinte, já no dia útil ('aaaa-mm-dd') */
function diaDaRegra(regra: RegraDoPrazo, competencia: string): string | null {
  const seg = mesSeguinte(competencia);
  if (!seg) return null;
  const [ano, mes] = seg;
  if (regra.dia === 'quinto-dia-util') {
    // o sábado conta; o domingo e o feriado nacional não
    const d = new Date(ano, mes, 1);
    let uteis = 0;
    for (;;) {
      if (d.getDay() !== 0 && !feriadoNacional(d)) uteis++;
      if (uteis === 5) return iso(d);
      d.setDate(d.getDate() + 1);
    }
  }
  const d = new Date(ano, mes, regra.dia);
  while (!util(d)) d.setDate(d.getDate() + (regra.ajuste === 'antecipa' ? -1 : 1));
  return iso(d);
}

/** O prazo de uma obrigação do DP na competência ('aaaa-mm-dd'); null = sem prazo cadastrado (as categorias x-…). */
export function prazoDaObrigacaoDp(obrigacao: string, competencia: string, doCliente: readonly string[] = []): string | null {
  if (obrigacao === 'envio') {
    // a entrega: o prazo da guia mais cedo do cliente; sem guia, o da folha
    const guias = doCliente.filter(o => GUIAS.includes(o)).map(o => prazoDaObrigacaoDp(o, competencia)).filter((x): x is string => !!x).sort();
    return guias[0] || prazoDaObrigacaoDp('folha', competencia);
  }
  const regra = PRAZOS_DO_DP[obrigacao];
  return regra ? diaDaRegra(regra, competencia) : null;
}

/** Os dias de hoje até o prazo (negativo = venceu há N dias; 0 = vence hoje). */
export function diasAtePrazo(prazo: string, hoje: Date): number {
  const [a, m, d] = prazo.split('-').map(Number);
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((new Date(a, m - 1, d).getTime() - h.getTime()) / 86400000);
}

export interface PrazoMaisUrgente {
  obrigacao: string;
  prazo: string;
  /** negativo = venceu há N dias */
  dias: number;
}

/**
 * Das obrigações pendentes de um cliente, a de prazo mais cedo (a mais urgente), ou null se nenhuma tem prazo.
 * `todas` são as obrigações que o cliente tem no mês (para o prazo da entrega).
 */
export function prazoMaisUrgenteDoDp(pendentes: readonly string[], todas: readonly string[], competencia: string, hoje: Date): PrazoMaisUrgente | null {
  let melhor: PrazoMaisUrgente | null = null;
  for (const o of pendentes) {
    const prazo = prazoDaObrigacaoDp(o, competencia, todas);
    if (!prazo) continue;
    if (!melhor || prazo < melhor.prazo) melhor = { obrigacao: o, prazo, dias: diasAtePrazo(prazo, hoje) };
  }
  return melhor;
}
