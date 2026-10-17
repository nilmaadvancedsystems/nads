// O pagamento do Simples Nacional pelo banco (Vitor, 16/10/2026: "no Simples Nacional, coloque e indique o pagamento do
// imposto se tiver no banco"). O razão do Simples a recolher tem a provisão de cada mês (crédito) e o pagamento (débito); o
// DAS que o banco pagou e não baixou o razão costuma estar no Caixa Geral (a importação do extrato põe a saída do banco
// contra o caixa). Aqui: cada obrigação (o saldo anterior e a provisão de cada mês) × o pagamento — no razão, ou no extrato
// ("DÉB.CONV.TRIBUTOS FEDERAIS - RFB DAS SIMPLES … REF JUN202…"), com os juros quando foi pago com atraso — e os
// lançamentos sugeridos para baixar o que o banco pagou. Tudo no navegador; nada é gravado.
import type { LancamentoDoBanco } from './fgts';
import type { LancamentoDoRazao, RazaoDaConta } from './razao';

export interface PagamentoDoSimples {
  /** no razão do Simples (já baixado) ou só no extrato (falta baixar) */
  onde: 'razao' | 'extrato';
  /** AAAA-MM-DD */
  data: string;
  /** o que saiu do banco (com os juros, quando teve) */
  valor: number;
  historico: string;
  /** o banco do extrato (o id do Extrator) */
  banco?: string;
  /** o pagamento do extrato está no razão do Caixa (a baixa é contra o caixa, não contra o banco) */
  noCaixa?: boolean;
}

export interface ObrigacaoDoSimples {
  /** 'aaaa-mm': a competência do DAS (o saldo anterior: o mês antes do razão) */
  competencia: string;
  /** o saldo que o razão já trazia antes do primeiro lançamento */
  anterior: boolean;
  valor: number;
  /** AAAA-MM-DD: o dia 20 do mês seguinte */
  vencimento: string;
  pagamento: PagamentoDoSimples | null;
  /** ok = pago e baixado no razão; banco = pago pelo banco sem a baixa; aberto = vencido sem pagamento; depois = vence depois do período */
  situacao: 'ok' | 'banco' | 'aberto' | 'depois';
  /** o pago a mais (juros e multa do atraso) */
  juros: number;
}

export interface SugestaoDoSimples {
  competencia: string;
  data: string;
  tipo: 'pagamento' | 'juros';
  /** a contrapartida: o caixa (o pagamento passou por ele) ou o banco */
  contra: 'caixa' | 'banco';
  banco?: string;
  valor: number;
  historico: string;
  motivo: string;
}

export interface ConferenciaDoSimples {
  obrigacoes: ObrigacaoDoSimples[];
  sugestoes: SugestaoDoSimples[];
  /** DAS do extrato que não casaram com nenhuma obrigação */
  dasSemObrigacao: { data: string; valor: number; historico: string }[];
  saldoDoRazao: number;
  /** o que devia sobrar: o vencido sem pagamento e o que vence depois do período */
  saldoEsperado: number;
  saldoAjustado: number;
  diferenca: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };
const mesDepois = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 12 ? (a + 1) + '-01' : a + '-' + String(mm + 1).padStart(2, '0'); };
const vencimentoDe = (competencia: string) => mesDepois(competencia) + '-20';
const fimDoMes = (mes: string) => mes + '-' + String(new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate()).padStart(2, '0');
const rotulo = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);
const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

/**
 * O DAS do Simples no extrato (não a GPS, que é o INSS): "… RFB DAS SIMPLES …", "PAGTO DAS", "SIMPLES NACIONAL". O "das"
 * sozinho não basta ("Vale das Cancelas"): junto do Simples, da Receita (RFB, tributos federais) ou de pagamento.
 */
export function ehDasDoSimples(historico: string): boolean {
  const h = norm(historico);
  if (/\bgps\b/.test(h)) return false;
  return /\bdas simples\b|\bsimples nac/.test(h)
    || (/\bdas\b/.test(h) && /\brfb\b|tributos federais|receita federal|\bpagto\b|\bpagamento\b|\bdarf\b/.test(h) && !/\bvale das\b/.test(h));
}

/**
 * A competência que o histórico do banco diz ("REF JUN202…", "REF Jun2026", "REF 06/2026"); o ano que falta (o banco corta)
 * é o do pagamento, ou o de antes quando o mês é depois do mês do pagamento. '' = não diz.
 */
export function competenciaDoDas(historico: string, data: string): string {
  const h = norm(historico);
  const num = /\bref\.?\s*(\d{2})\/(\d{4})/.exec(h);
  if (num) return num[2] + '-' + num[1];
  const m = /\bref\.?\s*([a-z]{3})[a-z]*\s*(\d{4})?/.exec(h);
  const i = m ? MESES.indexOf(m[1]) : -1;
  if (i < 0) return '';
  const ano = m![2] ? Number(m![2]) : Number(data.slice(0, 4)) - (i + 1 > Number(data.slice(5, 7)) ? 1 : 0);
  return ano + '-' + String(i + 1).padStart(2, '0');
}

/**
 * O razão do Simples a recolher × os DAS do extrato, nos meses do período. caixa: o razão do Caixa Geral (para saber se o
 * pagamento do banco passou por ele); sem ele, a baixa sugerida é contra o banco.
 */
export function conferirSimples(razao: RazaoDaConta, meses: readonly string[], extrato: readonly LancamentoDoBanco[], caixa: RazaoDaConta | null = null): ConferenciaDoSimples {
  const ultimoDia = fimDoMes(meses[meses.length - 1]);
  const ls = razao.lancamentos.filter(l => l.data <= ultimoDia);
  // as obrigações: o saldo anterior (credor) e a provisão de cada mês
  const obrigacoes: ObrigacaoDoSimples[] = [];
  if (razao.saldoInicial > 0.005 && razao.inicio) {
    const c = mesAntes(razao.inicio.slice(0, 7));
    obrigacoes.push({ competencia: c, anterior: true, valor: centavos(razao.saldoInicial), vencimento: vencimentoDe(c), pagamento: null, situacao: 'aberto', juros: 0 });
  }
  for (const l of ls.filter(x => x.valor > 0)) {
    const c = l.data.slice(0, 7);
    const ja = obrigacoes.find(o => !o.anterior && o.competencia === c);
    if (ja) ja.valor = centavos(ja.valor + l.valor);
    else obrigacoes.push({ competencia: c, anterior: false, valor: centavos(l.valor), vencimento: vencimentoDe(c), pagamento: null, situacao: 'aberto', juros: 0 });
  }
  const abertas = () => obrigacoes.filter(o => !o.pagamento).sort((a, b) => a.competencia.localeCompare(b.competencia));
  const pagar = (o: ObrigacaoDoSimples, p: PagamentoDoSimples) => {
    o.pagamento = p;
    o.juros = centavos(Math.max(0, p.valor - o.valor));
    o.situacao = p.onde === 'razao' ? 'ok' : 'banco';
  };
  // achar a obrigação de um pagamento: a competência dita; o mesmo valor; o valor com juros (até 25% a mais) da mais antiga vencida
  const acharObrigacao = (valor: number, data: string, competencia: string) => {
    const vencidas = abertas().filter(o => o.vencimento <= addDias(data, 5));
    return (competencia && abertas().find(o => o.competencia === competencia))
      || vencidas.find(o => Math.abs(o.valor - valor) <= 0.02)
      || vencidas.find(o => valor >= o.valor - 0.02 && valor <= o.valor * 1.25)
      || null;
  };
  // 1. os pagamentos que já estão no razão
  const pagosNoRazao: LancamentoDoRazao[] = ls.filter(l => l.valor < 0).sort((a, b) => a.data.localeCompare(b.data));
  for (const l of pagosNoRazao) {
    const comp = /refer\w*\s+(\d{2})\/(\d{4})/i.exec(l.historico);
    const o = acharObrigacao(-l.valor, l.data, comp ? comp[2] + '-' + comp[1] : '');
    if (o) pagar(o, { onde: 'razao', data: l.data, valor: centavos(-l.valor), historico: l.historico });
  }
  // 2. os DAS do extrato que o razão não tem (o mesmo valor até 3 dias de um pagamento do razão é o mesmo pagamento)
  const das = extrato.filter(e => e.valor < 0 && ehDasDoSimples(e.historico) && e.data <= ultimoDia).sort((a, b) => a.data.localeCompare(b.data));
  const dasSemObrigacao: ConferenciaDoSimples['dasSemObrigacao'] = [];
  for (const e of das) {
    const valor = centavos(-e.valor / 100);
    if (pagosNoRazao.some(l => Math.abs(-l.valor - valor) <= 0.02 && dias(l.data, e.data) <= 3)) continue;
    const o = acharObrigacao(valor, e.data, competenciaDoDas(e.historico, e.data));
    const noCaixa = !!caixa?.lancamentos.some(l => Math.abs(Math.abs(l.valor) - valor) <= 0.02 && dias(l.data, e.data) <= 1);
    if (o) pagar(o, { onde: 'extrato', data: e.data, valor, historico: e.historico, banco: e.banco, noCaixa });
    else dasSemObrigacao.push({ data: e.data, valor, historico: e.historico });
  }
  // 3. as que ficaram sem pagamento: vencidas no período (em aberto) ou que vencem depois dele
  for (const o of obrigacoes) if (!o.pagamento) o.situacao = o.vencimento <= ultimoDia ? 'aberto' : 'depois';

  const sugestoes: SugestaoDoSimples[] = [];
  for (const o of obrigacoes.filter(x => x.situacao === 'banco' && x.pagamento)) {
    const p = o.pagamento!;
    const contra = p.noCaixa ? 'caixa' as const : 'banco' as const;
    const onde = p.noCaixa ? ' (está no Caixa Geral)' : ' (não está no razão)';
    sugestoes.push({
      competencia: o.competencia, data: p.data, tipo: 'pagamento', contra, banco: p.banco, valor: o.valor,
      historico: 'Pago Simples Nacional referente ' + rotulo(o.competencia) + ' conforme DARF quitado.',
      motivo: 'DAS de ' + rotulo(o.competencia) + ' pago em ' + p.data.split('-').reverse().join('/') + ' pelo banco' + onde,
    });
    if (o.juros > 0.005) {
      sugestoes.push({
        competencia: o.competencia, data: p.data, tipo: 'juros', contra, banco: p.banco, valor: o.juros,
        historico: 'Juros e multa s/ Simples Nacional referente ' + rotulo(o.competencia) + ' pago em atraso.',
        motivo: 'Pago ' + p.valor.toFixed(2).replace('.', ',') + ' para o DAS de ' + o.valor.toFixed(2).replace('.', ','),
      });
    }
  }
  const saldoDoRazao = centavos(ls.length ? ls[ls.length - 1].saldo : razao.saldoInicial);
  const saldoEsperado = centavos(obrigacoes.filter(o => o.situacao === 'aberto' || o.situacao === 'depois').reduce((s, o) => s + o.valor, 0));
  const saldoAjustado = centavos(saldoDoRazao - sugestoes.filter(s => s.tipo === 'pagamento').reduce((s, x) => s + x.valor, 0));
  return { obrigacoes: obrigacoes.sort((a, b) => a.competencia.localeCompare(b.competencia)), sugestoes, dasSemObrigacao, saldoDoRazao, saldoEsperado, saldoAjustado, diferenca: centavos(saldoEsperado - saldoAjustado) };
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
