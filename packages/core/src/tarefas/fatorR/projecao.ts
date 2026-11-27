// A Projeção do Fator R (26/11/2026: a planilha "PROJEÇÃO FATOR R 6.0" do Fiscal no nads, Fiscal › Ferramentas). A planilha:
//   - aba FOLHA: o faturamento e a folha de cada mês (os passados digitados; os da projeção vindos da aba PROJEÇÃO);
//   - aba PROJEÇÃO: o Fator R de hoje (FS12 ÷ RBT12 dos 12 meses fechados) e 12 projeções, cada uma com a receita e a folha
//     do mês digitadas, a RBT12 e a FS12 da janela de 12 meses, o "Fator R" do mês (folha ÷ receita do mês) e o "Fator R
//     (RBT12 X FS12)" em destaque.
// No nads cada mês tem a sua linha (a receita e a folha pelo mês do fato gerador). A receita do Fator R é a dos 12 meses
// antes do PA (RBT12). A folha entra com defasagem (o dono, 27/11/2026: "folha 2027 cai 3 meses depois do fato gerador,
// 2026 2 meses", contando o mês do fato gerador; corrigido no mesmo dia: "a folha cadastrada tá um mês atrás do que
// deveria"): no PA de 2026 (e antes) o FS12 vai até o mês antes do PA; de 2027 em diante, até 2 meses antes. É a planilha:
// o "banco de dados" (PA 11/2026) soma a folha de 11/2025 a 10/2026, e a "Projeção 1 (jan/27)", de 12/2025 a 11/2026.
// Na virada de 2026 para 2027 a janela da folha fica parada um mês (12/2026 e 01/2027 usam a mesma).
// Acrescentados a pedido do dono (26/11/2026): o Anexo de cada PA (III a partir de 28%, senão V) e a folha que falta nos
// 12 meses para chegar a 28%.
import { FATOR_R_MINIMO } from '../sieg/calculadora';

/** de onde veio o número do mês: o PGDAS-D do robô, o PDF do extrato subido na tela ou digitado */
export type FonteDoValor = 'pgdas' | 'pdf' | 'digitado';
export interface ValorDoMes { valor: number; fonte: FonteDoValor }
/** o mês como a projeção usa: a receita bruta e a folha (salários, pró-labore, FGTS e CPP); null = sem o número */
export interface MesDoFatorR { receita: ValorDoMes | null; folha: ValorDoMes | null }
export type MesesDoFatorR = Readonly<Record<string, MesDoFatorR>>;

export interface FatorRDoPa {
  /** o período de apuração, 'aaaa-mm' */
  pa: string;
  /** a janela da receita: os 12 meses antes do PA */
  de: string;
  ate: string;
  /** a janela da folha: 12 meses, o último "defasagem" meses antes do PA */
  folhaDe: string;
  folhaAte: string;
  /** quantos meses antes do PA termina a janela da folha (1 até 2026, 2 de 2027 em diante) */
  defasagem: number;
  rbt12: number;
  fs12: number;
  /** quantos dos 12 meses têm o número (menos de 12 = a conta está incompleta) */
  mesesComReceita: number;
  mesesComFolha: number;
  /** FS12 ÷ RBT12 em %, truncado em 2 casas (27,996% fica no V); null sem receita na janela */
  fator: number | null;
  anexo: 'III' | 'V' | null;
  /** quanto falta de folha nos 12 meses para chegar a 28% (0 quando já chegou); null sem receita */
  folhaQueFalta: number | null;
}

export interface LinhaDoFatorR extends FatorRDoPa {
  competencia: string;
  receita: ValorDoMes | null;
  folha: ValorDoMes | null;
  /** a linha "Fator R:" da planilha: a folha do mês ÷ a receita do mês, em % (truncado em 2 casas) */
  fatorDoMes: number | null;
}

/** 28%, em % */
export const FATOR_R_EM_PCT = Math.round(FATOR_R_MINIMO * 10000) / 100;

const centavos = (v: number) => Math.round(v * 100) / 100;
const truncar = (v: number, casas: number) => { const x = Number((Math.abs(v) * 10 ** casas).toPrecision(15)); return (Math.sign(v) * Math.trunc(x)) / 10 ** casas; };
const paraCima = (v: number) => Math.ceil(Number((v * 100).toPrecision(15))) / 100;
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 'aaaa-mm' mais n meses (n pode ser negativo) */
export function somarMeses(c: string, n: number): string {
  const [a, m] = c.split('-').map(Number);
  const i = a * 12 + (m - 1) + n;
  return Math.floor(i / 12) + '-' + String((i % 12) + 1).padStart(2, '0');
}

/** de 'de' até 'ate', mês a mês (as duas pontas entram) */
export function competenciasEntre(de: string, ate: string): string[] {
  if (!COMPETENCIA.test(de) || !COMPETENCIA.test(ate) || de > ate) return [];
  const out: string[] = [];
  for (let c = de; c <= ate && out.length < 600; c = somarMeses(c, 1)) out.push(c);
  return out;
}

/**
 * Quantos meses antes do PA termina a janela da folha, pelo ano do PA (o dono, 27/11/2026): de 2027 em diante, 2 (a folha
 * "cai 3 meses depois do fato gerador"); em 2026 e antes, 1 ("cai 2 meses depois": a folha dos 12 meses antes do PA).
 */
export function defasagemDaFolha(pa: string): number {
  return Number(String(pa).slice(0, 4)) >= 2027 ? 2 : 1;
}

/** O Fator R de um PA: a receita dos 12 meses antes dele e a folha dos 12 meses que terminam "defasagem" meses antes. */
export function fatorRDoPa(meses: MesesDoFatorR, pa: string): FatorRDoPa {
  const de = somarMeses(pa, -12), ate = somarMeses(pa, -1);
  const defasagem = defasagemDaFolha(pa);
  const folhaDe = somarMeses(pa, -11 - defasagem), folhaAte = somarMeses(pa, -defasagem);
  const receitas = competenciasEntre(de, ate).map(c => meses[c]?.receita?.valor).filter((v): v is number => typeof v === 'number');
  const folhas = competenciasEntre(folhaDe, folhaAte).map(c => meses[c]?.folha?.valor).filter((v): v is number => typeof v === 'number');
  const rbt12 = centavos(receitas.reduce((s, v) => s + v, 0));
  const fs12 = centavos(folhas.reduce((s, v) => s + v, 0));
  const fator = rbt12 > 0 ? truncar((fs12 / rbt12) * 100, 2) : null;
  return {
    pa, de, ate, folhaDe, folhaAte, defasagem, rbt12, fs12, mesesComReceita: receitas.length, mesesComFolha: folhas.length,
    fator, anexo: fator == null ? null : fator >= FATOR_R_EM_PCT ? 'III' : 'V',
    folhaQueFalta: rbt12 > 0 ? Math.max(0, centavos(paraCima(FATOR_R_MINIMO * rbt12) - fs12)) : null,
  };
}

/** As linhas da projeção, de 'de' até 'ate': o mês (receita, folha e o fator do mês) e o Fator R do PA. */
export function linhasDoFatorR(meses: MesesDoFatorR, de: string, ate: string): LinhaDoFatorR[] {
  return competenciasEntre(de, ate).map(c => {
    const m = meses[c];
    const receita = m?.receita ?? null, folha = m?.folha ?? null;
    return {
      ...fatorRDoPa(meses, c), competencia: c, receita, folha,
      fatorDoMes: receita && receita.valor > 0 && folha ? truncar((folha.valor / receita.valor) * 100, 2) : null,
    };
  });
}
