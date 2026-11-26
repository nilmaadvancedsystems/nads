// O extrato do PGDAS-D lido pelo texto do PDF (25/11/2026: "preciso que o robô baixe relatório de faturamento do ecac para
// ter um relatório fiel na área do cliente e no faturamento"; o dono escolheu o PGDAS-D como o faturamento fiel do Simples).
// O robô (robo/ecac-pgdas.js) baixa o "Extrato do Simples Nacional" de cada empresa no e-CAC e passa o texto aqui. O texto
// vem do textoDoPdf (areaCliente/documentoAntigo): a leitura da página de cima para baixo, com espaços, sem quebra de linha
// garantida. Por isso a leitura procura os rótulos do extrato e os valores logo depois, sem depender da linha.
//
// O que se tira (o "2) Discriminativo de Receitas" e o "2.2) Receitas Brutas Anteriores"):
//   - o período de apuração (PA), o número da declaração, a data da transmissão, o CNPJ e o nome;
//   - a receita bruta do PA (RPA), mercado interno, externo e total;
//   - a RBT12 (os 12 meses antes do PA), a RBA (o ano até o PA) e a RBAA (o ano anterior), pelo total;
//   - os meses anteriores (mercado interno e externo), que enchem o histórico com um extrato só.
//   - o DAS gerado na apuração (número, vencimento, valor) e o pagamento dele (data e valor pago), quando o extrato traz;
//   - a receita de cada atividade (a "Receita Bruta Informada" de cada uma).
// Nada é inventado: o que não está no texto fica null; um extrato sem PA ou sem RPA não é extrato (null).
// O formato foi conferido num extrato real do PGDAS-D 2018 (25/11/2026; o PDF ficou fora do repositório): o número da
// apuração vem sem rótulo depois de "2) Informações da Apuração", a data vem como "Apurado em", os rótulos da RBT12 e da
// RBAA vêm DEPOIS dos valores ("…anteriores ao PA 2.635.748,20 0,00 2.635.748,20 (RBT12)") e os meses anteriores vêm aos
// pares ("01/2025 93.292,63 02/2025 …"), desde janeiro do ano anterior.

/** 'aaaa-mm' */
export type Competencia = string;

export interface ReceitaDoMes { interno: number; externo: number; total: number }
export interface MesAnteriorDoExtrato extends ReceitaDoMes { competencia: Competencia }

export interface DasDoExtrato {
  /** o número do DAS (17 números) */
  numero: string | null;
  /** 'aaaa-mm-dd' */
  vencimento: string | null;
  valor: number | null;
  /** o pagamento que a Receita já tem (a seção 6.2); null = sem pagamento no extrato */
  pagamento: { data: string; valor: number } | null;
}

export interface AtividadeDoExtrato { descricao: string; receita: number }

export interface ExtratoDoPgdas {
  /** o período de apuração */
  competencia: Competencia;
  /** o número da declaração (17 números: o CNPJ básico, o ano, o mês e a sequência); null se não veio */
  declaracao: string | null;
  /** a sequência da declaração no PA passou de 1: houve retificação antes desta */
  retificadora: boolean | null;
  /** 'aaaa-mm-ddThh:mm:ss' (hora de Brasília, como no extrato); null se não veio */
  transmitidaEm: string | null;
  /** o CNPJ da matriz (14 números) ou só o básico (8), como vier */
  cnpj: string | null;
  nome: string | null;
  receita: ReceitaDoMes;
  rbt12: number | null;
  rba: number | null;
  rbaa: number | null;
  /** os meses antes do PA, do mais antigo ao mais novo (o que o extrato listar) */
  anteriores: MesAnteriorDoExtrato[];
  /** o DAS gerado na apuração; null = o extrato não traz */
  das: DasDoExtrato | null;
  /** a receita de cada atividade declarada */
  atividades: AtividadeDoExtrato[];
}

const VALOR = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
const centavos = (n: number) => Math.round(n * 100) / 100;
export const valorDoTexto = (s: string): number => Number(s.replace(/\./g, '').replace(',', '.'));

/** sem acento, em maiúsculas, com os espaços juntos: os rótulos ficam fáceis de achar */
export function normalizarTexto(t: string): string {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').toUpperCase().trim();
}

/** os valores em reais logo depois do rótulo, até o próximo texto que não é número (no máximo `max`) */
function valoresDepois(u: string, rotulo: RegExp, max = 3): number[] | null {
  const m = rotulo.exec(u);
  if (!m) return null;
  const resto = u.slice(m.index + m[0].length, m.index + m[0].length + 200);
  const seq = /^[\s:R$]*((?:\d{1,3}(?:\.\d{3})*,\d{2}[\s]*){1,3})/.exec(resto);
  if (!seq) return null;
  return (seq[1].match(VALOR) || []).slice(0, max).map(valorDoTexto);
}

/** interno, externo e total pelos valores do rótulo: 3 valores = as três colunas; 1 = só o total (mercado interno) */
function receitaDe(vs: number[] | null): ReceitaDoMes | null {
  if (!vs || !vs.length) return null;
  if (vs.length >= 3) return { interno: vs[0], externo: vs[1], total: vs[2] };
  if (vs.length === 2) return { interno: vs[0], externo: vs[1], total: centavos(vs[0] + vs[1]) };
  return { interno: vs[0], externo: 0, total: vs[0] };
}

const totalDe = (vs: number[] | null): number | null => { const r = receitaDe(vs); return r ? r.total : null; };

const competenciaDe = (mes: string, ano: string): Competencia => ano + '-' + mes;

/** os meses e os valores de um trecho "Mercado Interno"/"Mercado Externo": os períodos e os valores, na mesma ordem */
function mesesDoTrecho(trecho: string): Map<Competencia, number> {
  const out = new Map<Competencia, number>();
  const periodos = [...trecho.matchAll(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/g)].map(m => competenciaDe(m[1], m[2]));
  const valores = (trecho.match(VALOR) || []).map(valorDoTexto);
  // a tabela vem em blocos (os períodos de uma linha e depois os valores dela): na ordem, o n-ésimo valor é do n-ésimo
  // período. Se o número não fecha, o trecho não é confiável: fica sem os anteriores.
  if (!periodos.length || periodos.length !== valores.length) return out;
  periodos.forEach((c, i) => out.set(c, valores[i]));
  return out;
}

/** os meses anteriores ao PA (o "2.2) Receitas Brutas Anteriores"), interno e externo juntos */
function anterioresDe(u: string): MesAnteriorDoExtrato[] {
  const ini = u.search(/RECEITAS BRUTAS ANTERIORES/);
  if (ini < 0) return [];
  let fim = u.slice(ini).search(/FOLHA(S)? DE SALARIOS ANTERIORES|2\.3\)|FATOR R|RESUMO DA DECLARACAO|3\)\s*RESUMO/);
  fim = fim < 0 ? Math.min(u.length, ini + 3000) : ini + fim;
  const bloco = u.slice(ini, fim);
  const iInt = bloco.search(/MERCADO INTERNO/);
  const iExt = bloco.search(/MERCADO EXTERNO/);
  const trechoInt = iInt < 0 ? bloco : bloco.slice(iInt, iExt > iInt ? iExt : undefined);
  const trechoExt = iExt < 0 ? '' : bloco.slice(iExt, iInt > iExt ? iInt : undefined);
  const int = mesesDoTrecho(trechoInt);
  const ext = mesesDoTrecho(trechoExt);
  // sem o mercado interno que fecha, nada: um mês só com o externo sairia com a receita errada (0 no lugar do valor)
  if (!int.size || (trechoExt && !ext.size)) return [];
  const todas = [...int.keys()].sort();
  return todas.map(c => {
    const interno = int.get(c) ?? 0, externo = ext.get(c) ?? 0;
    return { competencia: c, interno, externo, total: centavos(interno + externo) };
  });
}

/**
 * O extrato do PGDAS-D pelo texto do PDF. null = o texto não é um extrato do PGDAS-D (sem o PA ou sem a receita do PA).
 * A declaração (o PDF "Declaração") também tem o PA e a RPA: serve do mesmo jeito.
 */
export function extratoDoPgdas(texto: string): ExtratoDoPgdas | null {
  const u = normalizarTexto(texto);
  if (!/SIMPLES NACIONAL|PGDAS/.test(u)) return null;
  const pa = /PERIODO DE APURACAO\s*(?:\(PA\))?\s*:?\s*(?:\d{2}\/)?(0[1-9]|1[0-2])\/(20\d{2})/.exec(u);
  if (!pa) return null;
  const competencia = competenciaDe(pa[1], pa[2]);
  const receita = receitaDe(valoresDepois(u, /RECEITA BRUTA DO PA\s*\(RPA\)(?:\s*-\s*(?:COMPETENCIA|CAIXA))?/));
  if (!receita) return null;
  // o número da declaração (com rótulo) ou o da apuração (o extrato de 2018 traz sem rótulo, depois de "Informações da
  // Apuração"): o CNPJ básico, o ano e o mês do PA e a sequência
  const decl = /(?:N[OUº°]\.?|NUMERO)\s*DA DECLARACAO\s*:?\s*(\d{17})/.exec(u)
    || new RegExp('INFORMACOES DA APURACAO\\s*:?\\s*(\\d{8}' + pa[2] + pa[1] + '\\d{3})\\b').exec(u);
  const seq = decl ? Number(decl[1].slice(14)) : NaN;
  const retificadora = /APURACAO RETIFICADORA|DECLARACAO RETIFICADORA/.test(u) ? true : /APURACAO ORIGINAL/.test(u) ? false : Number.isFinite(seq) ? seq > 1 : null;
  const quando = /(?:(?:DATA\s*(?:E|\/)\s*HORA|DATA)\s*DA TRANSMISSAO|APURADO EM)\s*:?\s*(\d{2})\/(\d{2})\/(20\d{2})(?:\s*(?:AS\s*)?(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(u);
  const cnpj = /CNPJ\s*(?:MATRIZ|ESTABELECIMENTO)?\s*:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/.exec(u) || /CNPJ\s*BASICO\s*:?\s*(\d{2}\.\d{3}\.\d{3}|\d{8})\b/.exec(u);
  const nome = /NOME EMPRESARIAL\s*:?\s*(.+?)\s+(?:DATA DE ABERTURA|OPTANTE|REGIME DE APURACAO|CNPJ|PERIODO DE APURACAO|2\))/.exec(u);
  return {
    competencia,
    declaracao: decl ? decl[1] : null,
    retificadora,
    transmitidaEm: quando ? quando[3] + '-' + quando[2] + '-' + quando[1] + (quando[4] ? 'T' + quando[4] + ':' + quando[5] + ':' + (quando[6] || '00') : '') : null,
    cnpj: cnpj ? cnpj[1].replace(/\D/g, '') : null,
    nome: nome ? nome[1].slice(0, 200) : null,
    receita,
    // o rótulo entre parênteses vem antes ou depois dos valores, conforme a versão do extrato
    rbt12: totalDe(valoresDepois(u, /RECEITA BRUTA ACUMULADA NOS DOZE MESES ANTERIORES AO PA(?!\s*PROPORCIONALIZADA)(?:\s*\(RBT12\))?/)),
    rba: totalDe(valoresDepois(u, /RECEITA BRUTA ACUMULADA NO ANO-CALENDARIO CORRENTE(?:\s*\(RBA\))?/)),
    rbaa: totalDe(valoresDepois(u, /RECEITA BRUTA ACUMULADA NO ANO-CALENDARIO ANTERIOR(?:\s*\(RBAA\))?/)),
    anteriores: anterioresDe(u).filter(m => m.competencia < competencia),
    das: dasDe(u),
    atividades: atividadesDe(texto),
  };
}

const dataIso = (d: string, m: string, a: string) => a + '-' + m + '-' + d;

/** o DAS da apuração (a seção 6) e o pagamento dele (6.2) */
function dasDe(u: string): DasDoExtrato | null {
  const ini = u.search(/INFORMACOES SOBRE (O )?DAS GERADO/);
  if (ini < 0) return null;
  const s = u.slice(ini, ini + 2500);
  const numero = /NUMERO\s*:?\s*(\d{17})/.exec(s);
  const venc = /DATA DE VENCIMENTO\s*:?[\s\S]{0,120}?(\d{2})\/(\d{2})\/(20\d{2})/.exec(s);
  const total = /PRINCIPAL\s+[\d.,]+\s+MULTA\s+[\d.,]+\s+JUROS\s+[\d.,]+\s+TOTAL\s+(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(s);
  const pago = /INFORMACOES DA ARRECADACAO[\s\S]{0,200}?VALOR PAGO\s+(\d{2})\/(\d{2})\/(20\d{2})\s+\S+\s+(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(s);
  return {
    numero: numero ? numero[1] : null,
    vencimento: venc ? dataIso(venc[1], venc[2], venc[3]) : null,
    valor: total ? valorDoTexto(total[1]) : null,
    pagamento: pago ? { data: dataIso(pago[1], pago[2], pago[3]), valor: valorDoTexto(pago[4]) } : null,
  };
}

/** a receita de cada atividade ("Valor do Débito por Tributo para a Atividade (R$): <atividade> Receita Bruta Informada: R$ <valor>") */
function atividadesDe(texto: string): AtividadeDoExtrato[] {
  const t = String(texto ?? '').replace(/\s+/g, ' ');
  return [...t.matchAll(/para a Atividade \(R\$\):\s*(.+?)\s*Receita Bruta Informada:\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi)]
    .map(m => ({ descricao: m[1].trim().slice(0, 300), receita: valorDoTexto(m[2]) }));
}

/** o extrato é desta empresa? (pelo CNPJ básico: os 8 primeiros números). Sem CNPJ no extrato, não dá para dizer: false. */
export function extratoDaEmpresa(e: ExtratoDoPgdas, cnpjDaEmpresa: string): boolean {
  const a = String(e.cnpj || '').replace(/\D/g, '').slice(0, 8);
  const b = String(cnpjDaEmpresa || '').replace(/\D/g, '').slice(0, 8);
  return a.length === 8 && a === b;
}
