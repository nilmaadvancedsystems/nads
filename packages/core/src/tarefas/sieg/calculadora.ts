// A calculadora do Simples Nacional do Fiscal (Heverton, 22/10/2026: as planilhas do Excel do Fiscal no nads), feita a
// partir da "PLANILHA SIMPLES NACIONAL 2018.xlsx". Puro: a tela só desenha. As contas são as da planilha:
//   - as abas ANEXO I a V: pelo RBT12, a alíquota efetiva ((RBT12 × nominal − parcela a deduzir) ÷ RBT12, arredondada
//     a 5 e depois a 4 casas, como fração) e o percentual efetivo de cada tributo (efetiva × repartição, a 4 casas; a
//     sobra do arredondamento vai para o maior). Nos Anexos III e IV, o ISS passa de 5% só na 5ª faixa: o excesso vai
//     para os tributos federais, na proporção da repartição deles (LC 123/2006, notas dos anexos), e o ISS fica em 5%;
//   - a aba EFETIVA: a receita com ICMS-ST não paga a parcela do ICMS, a do monofásico não paga o PIS/COFINS e o serviço
//     com o ISS retido não paga o ISS;
//   - as abas FATOR R e Planilha5: a folha dos 12 meses (salário bruto, FGTS e CPP) sobre o RBT12; de 28% para cima, o
//     serviço sai do Anexo V e vai para o III.
// As tabelas (faixas e repartição) são as de simples.ts (ANEXOS), conferidas com a planilha.
import { ANEXOS, type Anexo } from './simples';

export type TributoDoSimples = 'IRPJ' | 'CSLL' | 'COFINS' | 'PIS' | 'CPP' | 'IPI' | 'ICMS' | 'ISS';
/** a ordem das colunas da planilha */
export const TRIBUTOS_DO_SIMPLES: readonly TributoDoSimples[] = ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'IPI', 'ICMS', 'ISS'];
export const ROTULO_DO_TRIBUTO: Record<TributoDoSimples, string> = { IRPJ: 'IRPJ', CSLL: 'CSLL', COFINS: 'Cofins', PIS: 'PIS/Pasep', CPP: 'CPP', IPI: 'IPI', ICMS: 'ICMS', ISS: 'ISS' };

/** o teto do ISS no Simples (5%) e o Fator R que leva o serviço do Anexo V para o III (28%) */
export const TETO_DO_ISS = 0.05;
export const FATOR_R_MINIMO = 0.28;

const centavos = (v: number) => Math.round(v * 100) / 100;
// como o ARRED e o TRUNCAR do Excel (o número limpo a 15 dígitos antes, para 0,0045 não virar 0,0044)
const arred = (v: number, casas: number) => { const x = Number((Math.abs(v) * 10 ** casas).toPrecision(15)); return (Math.sign(v) * Math.round(x)) / 10 ** casas; };
const truncar = (v: number, casas: number) => { const x = Number((Math.abs(v) * 10 ** casas).toPrecision(15)); return (Math.sign(v) * Math.trunc(x)) / 10 ** casas; };

export interface PercentualDoTributo { tributo: TributoDoSimples; /** o percentual efetivo, em % (2 casas, como a planilha) */ pct: number }
export interface PercentuaisEfetivos {
  anexo: Anexo; faixa: number; nominal: number; deduzir: number;
  /** a alíquota efetiva, em % (2 casas) */
  efetiva: number;
  /** os tributos do anexo (os que têm repartição na faixa), na ordem da planilha */
  tributos: PercentualDoTributo[];
  /** o ISS passou de 5% e o excesso foi para os federais */
  issNoTeto: boolean;
}

/** soma a sobra do arredondamento no maior (o primeiro, no empate), como a planilha */
function sobraNoMaior(v: Map<TributoDoSimples, number>, alvo: number, entre: readonly TributoDoSimples[]) {
  const soma = [...v.values()].reduce((s, x) => s + x, 0);
  const sobra = alvo - soma;
  if (Math.abs(sobra) < 1e-12 || !entre.length) return;
  const maior = entre.reduce((m, t) => ((v.get(t) || 0) > (v.get(m) || 0) ? t : m), entre[0]);
  v.set(maior, arred((v.get(maior) || 0) + sobra, 4));
}

/** A alíquota efetiva e o percentual efetivo de cada tributo pelo RBT12, como as abas ANEXO I a V da planilha. */
export function percentuaisEfetivos(anexo: Anexo, rbt12: number): PercentuaisEfetivos {
  const fs = ANEXOS[anexo].faixas;
  const i = rbt12 > fs[fs.length - 1].ate ? fs.length - 1 : Math.max(0, fs.findIndex(f => rbt12 <= f.ate));
  const f = fs[i];
  const bruta = rbt12 > 0 ? (rbt12 * (f.aliquota / 100) - f.deduzir) / rbt12 : f.aliquota / 100;
  const efetiva = arred(arred(bruta, 5), 4);
  const tributos = TRIBUTOS_DO_SIMPLES.filter(t => f.reparte[t] != null);
  const v = new Map<TributoDoSimples, number>(tributos.map(t => [t, arred(efetiva * (f.reparte[t] as number) / 100, 4)]));
  sobraNoMaior(v, efetiva, tributos);
  // o teto de 5% do ISS (Anexos III e IV, na 5ª faixa): o excesso vai para os federais, na proporção da repartição deles
  let issNoTeto = false;
  const iss = v.get('ISS') || 0;
  if (iss > TETO_DO_ISS + 1e-12) {
    issNoTeto = true;
    const federais = tributos.filter(t => t !== 'ISS');
    const pesos = federais.reduce((s, t) => s + (f.reparte[t] as number), 0);
    const antes = [...v.values()].reduce((s, x) => s + x, 0);
    for (const t of federais) v.set(t, arred((v.get(t) || 0) + (iss - TETO_DO_ISS) * (f.reparte[t] as number) / pesos, 4));
    v.set('ISS', truncar(TETO_DO_ISS, 4));
    sobraNoMaior(v, antes, federais);
  }
  return {
    anexo, faixa: i + 1, nominal: f.aliquota, deduzir: f.deduzir,
    efetiva: arred(efetiva * 100, 2),
    tributos: tributos.map(t => ({ tributo: t, pct: arred((v.get(t) || 0) * 100, 2) })),
    issNoTeto,
  };
}

/** Uma parcela da receita do mês, o anexo dela e os tributos que ela não paga no DAS (o ICMS da ST, o PIS/COFINS do
 * monofásico, o ISS retido). A mercadoria vai no Anexo I ou II e o serviço no III, IV ou V, como na aba EFETIVA. */
export interface ParcelaDoCalculo { id: string; rotulo: string; anexo: Anexo; valor: number; fora: readonly TributoDoSimples[] }

export interface CalculoDoSimples {
  /** os percentuais de cada anexo usado (na ordem das parcelas) */
  percentuais: PercentuaisEfetivos[];
  receita: number;
  parcelas: (ParcelaDoCalculo & { efetiva: number; /** a alíquota que sobra (%) */ aplicada: number; valores: Partial<Record<TributoDoSimples, number>>; das: number })[];
  /** cada tributo: o valor do mês (a soma das parcelas) */
  porTributo: { tributo: TributoDoSimples; valor: number }[];
  /** o DAS do mês */
  total: number;
  /** quanto as deduções (ST, monofásico, ISS retido) tiraram do DAS */
  deduzido: number;
}

/** O DAS do mês, tributo a tributo: cada parcela da receita × o percentual efetivo (do anexo dela) de cada tributo que ela paga. */
export function calculoDoSimples(rbt12: number, parcelas: readonly ParcelaDoCalculo[]): CalculoDoSimples {
  const porAnexo = new Map<Anexo, PercentuaisEfetivos>();
  const doAnexo = (a: Anexo) => { if (!porAnexo.has(a)) porAnexo.set(a, percentuaisEfetivos(a, rbt12)); return porAnexo.get(a)!; };
  let cheio = 0;
  const linhas = parcelas.filter(x => x.valor > 0).map(x => {
    const p = doAnexo(x.anexo);
    const valores: Partial<Record<TributoDoSimples, number>> = {};
    let aplicada = 0;
    for (const t of p.tributos) {
      cheio += centavos(x.valor * t.pct / 100);
      if (x.fora.includes(t.tributo)) continue;
      valores[t.tributo] = centavos(x.valor * t.pct / 100);
      aplicada += t.pct;
    }
    return { ...x, efetiva: p.efetiva, aplicada: arred(aplicada, 2), valores, das: centavos(Object.values(valores).reduce((s, n) => s + (n || 0), 0)) };
  });
  const receita = centavos(linhas.reduce((s, l) => s + l.valor, 0));
  const usados = new Set(linhas.flatMap(l => Object.keys(l.valores)));
  const porTributo = TRIBUTOS_DO_SIMPLES.filter(t => usados.has(t)).map(t => ({ tributo: t, valor: centavos(linhas.reduce((s, l) => s + (l.valores[t] || 0), 0)) }));
  const total = centavos(porTributo.reduce((s, t) => s + t.valor, 0));
  return { percentuais: [...porAnexo.values()], receita, parcelas: linhas, porTributo, total, deduzido: centavos(Math.max(0, cheio - total)) };
}

/** As parcelas de sempre da planilha: a mercadoria normal, com ST (sem ICMS), monofásica (sem PIS/COFINS) ou as duas;
 * o serviço normal e com o ISS retido (sem ISS). */
export const PARCELAS_DA_RECEITA: readonly { id: string; rotulo: string; tipo: 'mercadoria' | 'servico'; fora: readonly TributoDoSimples[] }[] = [
  { id: 'normal', rotulo: 'Mercadorias (normal)', tipo: 'mercadoria', fora: [] },
  { id: 'st', rotulo: 'Com ICMS-ST (sem o ICMS)', tipo: 'mercadoria', fora: ['ICMS'] },
  { id: 'monofasico', rotulo: 'Monofásico (sem PIS/Cofins)', tipo: 'mercadoria', fora: ['PIS', 'COFINS'] },
  { id: 'monofasicoESt', rotulo: 'Monofásico e ST (sem PIS/Cofins e ICMS)', tipo: 'mercadoria', fora: ['PIS', 'COFINS', 'ICMS'] },
  { id: 'servicos', rotulo: 'Serviços (normal)', tipo: 'servico', fora: [] },
  { id: 'issRetido', rotulo: 'Serviços com ISS retido (sem o ISS)', tipo: 'servico', fora: ['ISS'] },
];

export interface FolhaDoMes { salario: number; fgts: number; cpp: number }

/** O Fator R: a folha dos 12 meses (salário bruto + FGTS + CPP) ÷ RBT12; de 28% para cima, Anexo III; abaixo, V. */
export function fatorR(meses: readonly FolhaDoMes[], rbt12: number): { folha: number; salario: number; fgts: number; cpp: number; fator: number | null; anexo: 'III' | 'V' | null } {
  const soma = (k: keyof FolhaDoMes) => centavos(meses.reduce((s, m) => s + (Number(m[k]) || 0), 0));
  const salario = soma('salario'), fgts = soma('fgts'), cpp = soma('cpp');
  const folha = centavos(salario + fgts + cpp);
  if (!(rbt12 > 0)) return { folha, salario, fgts, cpp, fator: null, anexo: null };
  const fator = arred(folha / rbt12 * 100, 2);
  return { folha, salario, fgts, cpp, fator, anexo: fator >= FATOR_R_MINIMO * 100 ? 'III' : 'V' };
}
