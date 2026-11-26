// A Projeção do Fator R (26/11/2026: a planilha "PROJEÇÃO FATOR R 6.0" do Fiscal no nads, Fiscal › Ferramentas). A planilha:
//   - aba FOLHA: o faturamento e a folha de cada mês (os passados digitados; os da projeção vindos da aba PROJEÇÃO);
//   - aba PROJEÇÃO: o Fator R de hoje (FS12 ÷ RBT12 dos 12 meses fechados) e 12 projeções, cada uma com a receita e a folha
//     do mês digitadas, a RBT12 e a FS12 da janela de 12 meses, o "Fator R" do mês (folha ÷ receita do mês) e o "Fator R
//     (RBT12 X FS12)" em destaque.
// No nads cada mês tem a sua linha e o Fator R do PA é o dos 12 meses antes dele (LC 123, art. 18, § 24): as somas são as
// da planilha. A "Projeção 1 (jan/27)" dela soma de 12/2025 a 11/2026, que aqui é o PA de 12/2026 (os títulos da planilha
// estavam um mês na frente da janela, e o que se digitava nela caía no mês seguinte da aba FOLHA).
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
  /** a janela: os 12 meses antes do PA */
  de: string;
  ate: string;
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

/** O Fator R de um PA: a folha e a receita dos 12 meses antes dele. */
export function fatorRDoPa(meses: MesesDoFatorR, pa: string): FatorRDoPa {
  const de = somarMeses(pa, -12), ate = somarMeses(pa, -1);
  const janela = competenciasEntre(de, ate).map(c => meses[c]);
  const receitas = janela.map(m => m?.receita?.valor).filter((v): v is number => typeof v === 'number');
  const folhas = janela.map(m => m?.folha?.valor).filter((v): v is number => typeof v === 'number');
  const rbt12 = centavos(receitas.reduce((s, v) => s + v, 0));
  const fs12 = centavos(folhas.reduce((s, v) => s + v, 0));
  const fator = rbt12 > 0 ? truncar((fs12 / rbt12) * 100, 2) : null;
  return {
    pa, de, ate, rbt12, fs12, mesesComReceita: receitas.length, mesesComFolha: folhas.length,
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
