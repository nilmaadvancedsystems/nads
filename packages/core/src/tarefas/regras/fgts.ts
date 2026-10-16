// A conferência do FGTS a recolher (Vitor, 16/10/2026: "quero desenvolver algo para corrigir o FGTS… aprenda a ler o PDF e
// o razão"): o razão da conta (XLS da conciliação do Alterdata) contra as guias do FGTS Digital (o PDF "Detalhe da Guia
// Emitida", com a relação dos trabalhadores). Mês a mês:
// - a provisão do mês (os créditos com data no mês) × o total da guia, e cada trabalhador (o nome no histórico × o da guia);
// - o pagamento da guia: no razão (o débito com o mesmo valor); sem ele, no extrato do banco (o débito com o mesmo valor
//   perto do vencimento) — é o que vira o lançamento sugerido;
// - o histórico com a competência trocada ("<04/2026>" num lançamento de 31/05) aparece para corrigir;
// - o fechamento: o saldo do razão com os lançamentos sugeridos × as guias que vencem depois do período.
// Tudo no navegador; nada é gravado.
import { brl } from '../../formatos';
import { mesmoNomeDeCliente } from '../../extratudo/creditor/regras/clientes';
import { linhasDasPaginas, type LinhaDoAlterdata, type PedacoDoPdf } from './inss';
import type { LancamentoDoRazao, RazaoDaConta } from './razao';

// ─── As guias (o "Detalhe da Guia Emitida" do FGTS Digital) ─────────────────────────────────────────────────────────

export interface TrabalhadorDoFgts { nome: string; cpf: string; matricula: string; base: number; valor: number }

export interface GuiaDoFgts {
  numero: string;
  /** a competência de apuração, 'aaaa-mm' */
  competencia: string;
  /** AAAA-MM-DD */
  vencimento: string;
  emissao: string;
  /** o total da guia (FGTS) */
  total: number;
  trabalhadores: TrabalhadorDoFgts[];
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const valorBr = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const iso = (d: string) => d.slice(6, 10) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);
const mesDe = (mmaaaa: string) => mmaaaa.slice(3, 7) + '-' + mmaaaa.slice(0, 2);

/**
 * As linhas de cada página. O PDF do FGTS Digital vem deitado (a página girada): a linha da tabela é a posição na
 * horizontal e as colunas vão de cima para baixo. Girada (o rótulo "Número da Guia:" e o número na mesma horizontal), as
 * linhas saem pela horizontal; senão, como nas outras guias (linhasDasPaginas).
 */
export function linhasDaGuiaDoFgts(paginas: readonly (readonly PedacoDoPdf[])[]): string[][] {
  return paginas.map(itens => {
    const cheios = itens.filter(i => i.texto.trim());
    const rotulo = cheios.find(i => /n[úu]mero da guia/i.test(i.texto));
    const numero = cheios.find(i => /^\d{16}-\d$/.test(i.texto.trim()));
    const girada = !!rotulo && !!numero && Math.abs(rotulo.x - numero.x) < 2 && Math.abs(rotulo.y - numero.y) >= 2;
    if (!girada) return linhasDasPaginas([itens])[0] || [];
    const grupos: { x: number; itens: PedacoDoPdf[] }[] = [];
    for (const i of [...cheios].sort((a, b) => a.x - b.x)) {
      const g = grupos.find(x => Math.abs(x.x - i.x) <= 2);
      if (g) g.itens.push(i); else grupos.push({ x: i.x, itens: [i] });
    }
    return grupos.map(g => g.itens.sort((a, b) => a.y - b.y).map(i => i.texto.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  });
}

const RE_TRABALHADOR = /^(\d{2}\/\d{4})\s+(?:\d{2}\/\d{4}\s+)?(.+?)\s+(?:(\d{11})\s+)?(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d{3})\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/;
const RE_CATEGORIA = /^(\d{2}\/\d{4})\s+\d{3}\s+\d+\s+[\d.]+,\d{2}\s+([\d.]+,\d{2})/;

/** As linhas → as guias do FGTS. A mesma guia em várias páginas (ou arquivos) vira uma só; o trabalhador não repete. */
export function guiasDoFgtsDasLinhas(paginas: readonly (readonly string[])[]): GuiaDoFgts[] {
  const porNumero = new Map<string, GuiaDoFgts>();
  for (const linhas of paginas) {
    const texto = linhas.join(' ');
    const numero = /N[úu]mero da Guia:\s*(\d{16}-\d)/i.exec(texto)?.[1];
    if (!numero) continue;
    const g = porNumero.get(numero) || { numero, competencia: '', vencimento: '', emissao: '', total: 0, trabalhadores: [] };
    porNumero.set(numero, g);
    const venc = /Vencimento da Guia:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1];
    if (venc && !g.vencimento) g.vencimento = iso(venc);
    const emissao = /Data Emiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1];
    if (emissao && !g.emissao) g.emissao = iso(emissao);
    const total = /Total da Guia \(FGTS\):\s*([\d.]+,\d{2})/i.exec(texto)?.[1];
    if (total && !g.total) g.total = valorBr(total);
    for (const l of linhas) {
      const t = RE_TRABALHADOR.exec(l);
      if (t) {
        if (!g.competencia) g.competencia = mesDe(t[1]);
        if (!g.trabalhadores.some(x => x.cpf === t[4])) {
          g.trabalhadores.push({ nome: t[2].trim(), matricula: t[3] || '', cpf: t[4], base: valorBr(t[8]), valor: valorBr(t[9]) });
        }
        continue;
      }
      const c = RE_CATEGORIA.exec(l);
      if (c && !g.competencia) g.competencia = mesDe(c[1]);
    }
  }
  return [...porNumero.values()]
    .filter(g => g.competencia && (g.total || g.trabalhadores.length))
    // sem o total no cabeçalho, a soma dos trabalhadores
    .map(g => ({ ...g, total: g.total || centavos(g.trabalhadores.reduce((s, x) => s + x.valor, 0)) }))
    .sort((a, b) => a.competencia.localeCompare(b.competencia) || a.vencimento.localeCompare(b.vencimento));
}

// ─── A conferência ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Um lançamento do extrato do banco (o Extrator): a data AAAA-MM-DD, o valor em centavos (− saiu) e o banco. */
export interface LancamentoDoBanco { data: string; valor: number; historico: string; banco: string }

export interface TrabalhadorConferido { nome: string; razao: number; guia: number; diferenca: number }

export interface PagamentoDoFgts {
  /** onde o pagamento foi achado: no razão (já lançado) ou só no extrato (falta lançar) */
  onde: 'razao' | 'extrato';
  data: string;
  valor: number;
  historico: string;
  banco?: string;
}

export interface MesDoFgts {
  mes: string;
  /** o razão não alcança o mês (começa depois): não é conferido */
  foraDoRazao: boolean;
  guia: GuiaDoFgts | null;
  /** a provisão do mês (os créditos com data no mês) */
  provisao: number;
  /** a guia − a provisão */
  diferenca: number;
  trabalhadores: TrabalhadorConferido[];
  /** o pagamento da guia do mês (null = não achado) */
  pagamento: PagamentoDoFgts | null;
  /** ok = pago e lançado; falta = pago (ou vencido) sem a baixa no razão; depois = vence depois do período */
  situacao: 'ok' | 'falta' | 'depois' | 'sem-guia';
  /** os lançamentos do mês com outra competência no histórico ("<04/2026>" em 31/05) */
  competenciaTrocada: { data: string; historico: string; valor: number }[];
}

export interface SugestaoDoFgts {
  mes: string;
  /** AAAA-MM-DD: a provisão no último dia do mês; o pagamento no dia em que saiu do banco (ou no vencimento) */
  data: string;
  tipo: 'provisao' | 'pagamento';
  debito: string;
  credito: string;
  valor: number;
  historico: string;
  motivo: string;
}

export interface ConferenciaDoFgts {
  meses: MesDoFgts[];
  sugestoes: SugestaoDoFgts[];
  /** pagamentos no razão sem guia com o mesmo valor, no período */
  pagamentosSemGuia: LancamentoDoRazao[];
  /** o saldo do razão no fim do período (credor positivo) */
  saldoDoRazao: number;
  /** o que devia sobrar: as guias do período que vencem depois dele */
  saldoEsperado: number;
  /** o saldo com os lançamentos sugeridos */
  saldoAjustado: number;
  /** esperado − ajustado: o que vem de antes do período ou de mês sem guia (0 = fecha) */
  antesDoPeriodo: number;
}

/** O nome da conta nas sugestões (o lado que não é a contrapartida). */
export const FGTS_A_RECOLHER = 'FGTS a recolher';

const TOLERANCIA = 0.02;
const rotuloMes = (mes: string) => mes.slice(5, 7) + '/' + mes.slice(0, 4);
const fimDoMes = (mes: string) => mes + '-' + String(new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate()).padStart(2, '0');
const conta = (l: LancamentoDoRazao) => (l.contrapartida + (l.nomeContrapartida ? ' ' + l.nomeContrapartida : '')).trim();
const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

function maisComum(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

/** O trabalhador no histórico da provisão: "Pelo valor de FGTS a recolher s/ folha <05/2026> NOME" → "NOME". */
export function trabalhadorDoHistorico(h: string): string {
  return (/<\d{2}\/\d{4}>\s*(.+)$/.exec(h)?.[1] || '').trim();
}

/** A competência do histórico ("<05/2026>" ou "referente 05/2026") → '2026-05'; sem, ''. */
function competenciaDoHistorico(h: string): string {
  const m = /<(\d{2})\/(\d{4})>/.exec(h) || /refer\w*\s+(\d{2})\/(\d{4})/i.exec(h);
  return m ? m[2] + '-' + m[1] : '';
}

/**
 * O razão do FGTS a recolher × as guias, nos meses do período. extrato: os lançamentos dos bancos (para achar o pagamento
 * que não foi lançado no razão; vazio = só o razão).
 */
export function conferirFgts(razao: RazaoDaConta, guias: readonly GuiaDoFgts[], meses: readonly string[], extrato: readonly LancamentoDoBanco[] = []): ConferenciaDoFgts {
  const ls = razao.lancamentos;
  const provisoes = ls.filter(l => l.valor > 0);
  const pagamentos = ls.filter(l => l.valor < 0);
  const inicioDoRazao = razao.inicio.slice(0, 7);
  const ultimoDia = fimDoMes(meses[meses.length - 1]);
  // as contrapartidas que o razão já usa: a despesa da provisão e o banco do pagamento
  const despesa = maisComum(provisoes.map(conta)) || 'FGTS (despesa)';
  const banco = maisComum(pagamentos.map(conta)) || 'Banco';
  const sugestoes: SugestaoDoFgts[] = [];
  const usados = new Set<LancamentoDoRazao>();
  const usadosNoExtrato = new Set<LancamentoDoBanco>();

  const conferidos: MesDoFgts[] = meses.map(mes => {
    const guia = guias.find(g => g.competencia === mes) || null;
    const foraDoRazao = mes < inicioDoRazao;
    const doMes = provisoes.filter(l => l.data.slice(0, 7) === mes);
    const provisao = centavos(doMes.reduce((s, l) => s + l.valor, 0));
    const competenciaTrocada = doMes.filter(l => { const c = competenciaDoHistorico(l.historico); return c && c !== mes; })
      .map(l => ({ data: l.data, historico: l.historico, valor: l.valor }));
    // cada trabalhador: o do razão (pelo nome no histórico) × o da guia
    const trabalhadores: TrabalhadorConferido[] = [];
    for (const t of guia?.trabalhadores || []) {
      const r = centavos(doMes.filter(l => mesmoNomeDeCliente(trabalhadorDoHistorico(l.historico), t.nome)).reduce((s, l) => s + l.valor, 0));
      trabalhadores.push({ nome: t.nome, razao: r, guia: t.valor, diferenca: centavos(t.valor - r) });
    }
    // o que está no razão e não na guia
    for (const l of doMes) {
      const nome = trabalhadorDoHistorico(l.historico);
      if (guia && !guia.trabalhadores.some(t => mesmoNomeDeCliente(nome, t.nome))) {
        const ja = trabalhadores.find(x => x.guia === 0 && mesmoNomeDeCliente(nome, x.nome));
        if (ja) { ja.razao = centavos(ja.razao + l.valor); ja.diferenca = centavos(-ja.razao); }
        else trabalhadores.push({ nome: nome || l.historico, razao: l.valor, guia: 0, diferenca: centavos(-l.valor) });
      }
    }
    const diferenca = guia ? centavos(guia.total - provisao) : 0;
    const ref = '<' + rotuloMes(mes) + '>';

    // a provisão que não bate com a guia: o ajuste de cada trabalhador
    if (guia && !foraDoRazao && Math.abs(diferenca) > TOLERANCIA) {
      for (const t of trabalhadores.filter(x => Math.abs(x.diferenca) > TOLERANCIA)) {
        const sobra = t.diferenca < 0;
        sugestoes.push({
          mes, data: fimDoMes(mes), tipo: 'provisao', debito: sobra ? FGTS_A_RECOLHER : despesa, credito: sobra ? despesa : FGTS_A_RECOLHER, valor: Math.abs(t.diferenca),
          historico: 'Pelo valor de FGTS ' + (sobra ? 'provisionado a maior' : 'a recolher') + ' s/ folha ' + ref + ' ' + t.nome,
          motivo: t.nome + ': razão ' + brl(t.razao) + ' × guia ' + brl(t.guia),
        });
      }
    }

    // o pagamento da guia: no razão; sem ele, no extrato
    let pagamento: PagamentoDoFgts | null = null;
    let situacao: MesDoFgts['situacao'] = 'sem-guia';
    if (guia) {
      const doRazao = pagamentos.filter(l => !usados.has(l) && Math.abs(-l.valor - guia.total) <= TOLERANCIA)
        .sort((a, b) => (competenciaDoHistorico(b.historico) === mes ? 1 : 0) - (competenciaDoHistorico(a.historico) === mes ? 1 : 0) || dias(a.data, guia.vencimento) - dias(b.data, guia.vencimento))[0];
      if (doRazao) {
        usados.add(doRazao);
        pagamento = { onde: 'razao', data: doRazao.data, valor: -doRazao.valor, historico: doRazao.historico };
        situacao = 'ok';
      } else {
        const alvo = Math.round(guia.total * 100);
        const doExtrato = extrato.filter(e => !usadosNoExtrato.has(e) && e.valor === -alvo && dias(e.data, guia.vencimento) <= 10)
          .sort((a, b) => dias(a.data, guia.vencimento) - dias(b.data, guia.vencimento))[0];
        if (doExtrato) {
          usadosNoExtrato.add(doExtrato);
          pagamento = { onde: 'extrato', data: doExtrato.data, valor: guia.total, historico: doExtrato.historico, banco: doExtrato.banco };
        }
        const pagaNoPeriodo = pagamento ? pagamento.data <= ultimoDia : guia.vencimento <= ultimoDia;
        situacao = pagaNoPeriodo ? 'falta' : 'depois';
        if (pagaNoPeriodo && !foraDoRazao) {
          sugestoes.push({
            mes, data: pagamento?.data || guia.vencimento, tipo: 'pagamento', debito: FGTS_A_RECOLHER, credito: banco, valor: guia.total,
            historico: 'Pagamento de FGTS referente ' + rotuloMes(mes) + ', conforme GFD quitada.',
            motivo: 'Guia de ' + rotuloMes(mes) + (pagamento
              ? ' paga em ' + pagamento.data.split('-').reverse().join('/') + (pagamento.banco ? ' (' + pagamento.banco + ')' : '') + ' sem a baixa no razão'
              : ' vencida em ' + guia.vencimento.split('-').reverse().join('/') + ' sem a baixa no razão (o pagamento não está no extrato)'),
          });
        }
      }
    }
    return { mes, foraDoRazao, guia, provisao, diferenca, trabalhadores, pagamento, situacao, competenciaTrocada };
  });

  const primeiro = meses[0] + '-01';
  const pagamentosSemGuia = pagamentos.filter(l => !usados.has(l) && l.data >= primeiro && l.data <= ultimoDia
    && !guias.some(g => Math.abs(-l.valor - g.total) <= TOLERANCIA));

  // o saldo do razão no fim do período e o que devia sobrar (as guias do período que vencem depois dele)
  const ateOFim = ls.filter(l => l.data <= ultimoDia);
  const saldoDoRazao = centavos(ateOFim.length ? ateOFim[ateOFim.length - 1].saldo : razao.saldoInicial);
  const saldoEsperado = centavos(conferidos.filter(m => m.situacao === 'depois').reduce((s, m) => s + (m.guia?.total || 0), 0));
  const ajuste = sugestoes.reduce((s, x) => s + (x.credito === FGTS_A_RECOLHER ? x.valor : -x.valor), 0);
  const saldoAjustado = centavos(saldoDoRazao + ajuste);
  return { meses: conferidos, sugestoes, pagamentosSemGuia, saldoDoRazao, saldoEsperado, saldoAjustado, antesDoPeriodo: centavos(saldoEsperado - saldoAjustado) };
}

// ─── a exportação para o Alterdata ──────────────────────────────────────────────────────────────────────────────────

/** De que lado da sugestão fica a contrapartida (o outro é o FGTS a recolher) e o que a conferência sugeriu para ela. */
export function contrapartidaDoFgts(s: SugestaoDoFgts): { lado: 'debito' | 'credito'; sugerida: string } {
  return s.debito === FGTS_A_RECOLHER ? { lado: 'credito', sugerida: s.credito } : { lado: 'debito', sugerida: s.debito };
}

/** A chave de uma sugestão (para guardar a contrapartida escolhida). */
export const chaveDaSugestaoDoFgts = (s: SugestaoDoFgts) => s.mes + '|' + s.tipo + '|' + s.historico + '|' + s.valor;

/** As sugestões → as linhas do Alterdata (o padrão de 10 colunas), com a conta do FGTS a recolher e cada contrapartida. */
export function linhasDoAlterdataDoFgts(sugestoes: readonly SugestaoDoFgts[], contaFgts: string, contrapartidas: Readonly<Record<string, string>>): LinhaDoAlterdata[] {
  return sugestoes.map(s => {
    const c = contrapartidaDoFgts(s);
    const contra = contrapartidas[chaveDaSugestaoDoFgts(s)] || (/^([0-9]{3,})(?![0-9])/.exec(c.sugerida.trim())?.[1] || '');
    return { data: s.data.split('-').reverse().join('/'), debito: c.lado === 'debito' ? contra : contaFgts, credito: c.lado === 'credito' ? contra : contaFgts, historico: s.historico, valor: s.valor };
  });
}
