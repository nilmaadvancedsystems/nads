// A conferência do INSS a recolher (Vitor, 05/10/2026: "quando o INSS não bate direito"): o razão da conta (XLS da
// conciliação do Alterdata) contra as guias pagas (o PDF dos comprovantes de arrecadação da Receita). Mês a mês:
// - a provisão de cada grupo (segurados, contribuinte individual, patronal + GILRAT, terceiros) × os códigos da guia;
// - o que está na guia e o sistema não provisiona (Adicional GILRAT 1141, aquisição de produção rural 1656/1646-03/
//   1213-06, outros códigos) vira "verba não provisionada", com o nome;
// - cada guia paga no período precisa da baixa no razão (o pagamento com o mesmo valor);
// - o saldo que devia sobrar (as guias pagas depois do período) × o saldo do razão: o que não se explica vem de antes.
// O resultado vem com o lançamento sugerido de cada diferença. Tudo no navegador; nada é gravado.
import { brl } from '../../formatos';
import type { LancamentoDoRazao, RazaoDaConta } from './razao';

// ─── As guias (o PDF dos comprovantes de arrecadação) ──────────────────────────────────────────────────────────────

export interface ItemDaGuia {
  codigo: string;
  /** a variação do código ("01", "04", "21" = 13º, "03"/"06" = produção rural) */
  variacao: string;
  descricao: string;
  principal: number;
  total: number;
}

export interface GuiaDoInss {
  /** o período de apuração, 'aaaa-mm' */
  competencia: string;
  numero: string;
  /** AAAA-MM-DD */
  vencimento: string;
  /** AAAA-MM-DD da arrecadação ('' = o comprovante não trouxe) */
  pagaEm: string;
  itens: ItemDaGuia[];
  principal: number;
  total: number;
}

/** Um pedaço de texto do PDF (o leitor de PDF do Extrator devolve assim). */
export interface PedacoDoPdf { texto: string; x: number; y: number }

const centavos = (n: number) => Math.round(n * 100) / 100;
const valorBr = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const iso = (d: string) => d.slice(6, 10) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);

/** Os pedaços de cada página → as linhas de texto (de cima para baixo, da esquerda para a direita). */
export function linhasDasPaginas(paginas: readonly (readonly PedacoDoPdf[])[]): string[][] {
  return paginas.map(itens => {
    const porY = new Map<number, PedacoDoPdf[]>();
    for (const i of itens) {
      const y = Math.round(i.y);
      porY.set(y, [...(porY.get(y) || []), i]);
    }
    return [...porY.keys()].sort((a, b) => b - a)
      .map(y => porY.get(y)!.sort((a, b) => a.x - b.x).map(i => i.texto).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  });
}

const RE_CABECALHO = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}\/\d{2}\/\d{4}) (\d{10,})$/;
const RE_ITEM = /^(\d{4}) (.+?) ([\d.]+,\d{2}) (?:-|[\d.]+,\d{2}) (?:-|[\d.]+,\d{2}) ([\d.]+,\d{2})$/;
const RE_VARIACAO = /^(\d{2}) - (.+)$/;

/**
 * As linhas do PDF → as guias do INSS (só os DARFs com código previdenciário; PIS, COFINS, IRPJ… ficam de fora). Uma
 * guia que passa de uma página (o mesmo número de documento) vira uma só.
 */
export function guiasDasLinhas(paginas: readonly (readonly string[])[]): GuiaDoInss[] {
  const porNumero = new Map<string, GuiaDoInss>();
  for (const linhas of paginas) {
    let guia: GuiaDoInss | null = null;
    let ultimo: ItemDaGuia | null = null;
    let esperandoData = false;
    for (const l of linhas) {
      const cab = l.match(RE_CABECALHO);
      if (cab) {
        guia = porNumero.get(cab[3]) || { competencia: iso(cab[1]).slice(0, 7), vencimento: iso(cab[2]), numero: cab[3], pagaEm: '', itens: [], principal: 0, total: 0 };
        porNumero.set(cab[3], guia);
        continue;
      }
      if (!guia) continue;
      const it = l.match(RE_ITEM);
      if (it) {
        ultimo = { codigo: it[1], variacao: '', descricao: it[2], principal: valorBr(it[3]), total: valorBr(it[4]) };
        guia.itens.push(ultimo);
        continue;
      }
      const v = l.match(RE_VARIACAO);
      if (v && ultimo && !ultimo.variacao) { ultimo.variacao = v[1]; ultimo.descricao = v[2]; continue; }
      if (/Data de Arrecada/i.test(l)) { esperandoData = true; continue; }
      const data = l.match(/(\d{2}\/\d{2}\/\d{4})$/);
      if (esperandoData && data) { guia.pagaEm = iso(data[1]); esperandoData = false; }
    }
  }
  return [...porNumero.values()]
    .filter(g => g.itens.some(i => grupoDoItem(i) !== 'outros'))
    .map(g => ({ ...g, principal: centavos(g.itens.reduce((s, i) => s + i.principal, 0)), total: centavos(g.itens.reduce((s, i) => s + i.total, 0)) }))
    .sort((a, b) => a.competencia.localeCompare(b.competencia) || a.vencimento.localeCompare(b.vencimento));
}

// ─── Os grupos: o que o sistema provisiona e o que não ─────────────────────────────────────────────────────────────

export type GrupoDoInss = 'segurados' | 'individuais' | 'patronal' | 'terceiros' | 'adicional-gilrat' | 'producao-rural' | 'outros';

export const NOME_DO_GRUPO: Record<GrupoDoInss, string> = {
  segurados: 'Segurados (descontado dos empregados)',
  individuais: 'Contribuinte individual (pró-labore)',
  patronal: 'Patronal + GILRAT',
  terceiros: 'Terceiros (Sal. Educação, Incra, Senai, Sesi, Sebrae…)',
  'adicional-gilrat': 'Adicional GILRAT (aposentadoria especial)',
  'producao-rural': 'Aquisição de produção rural de PF',
  outros: 'Outros códigos',
};

/** Os grupos que o razão do Alterdata provisiona (cada um com o seu histórico). */
const PROVISIONADOS: readonly GrupoDoInss[] = ['segurados', 'individuais', 'patronal', 'terceiros'];
const TERCEIROS = new Set(['1170', '1176', '1181', '1184', '1191', '1196', '1200']);

export function grupoDoItem(i: Pick<ItemDaGuia, 'codigo' | 'variacao'>): GrupoDoInss {
  if (i.codigo === '1082') return 'segurados';
  if (i.codigo === '1099') return 'individuais';
  if (i.codigo === '1138') return 'patronal';
  if (i.codigo === '1646') return i.variacao === '03' ? 'producao-rural' : 'patronal';
  if (i.codigo === '1141') return 'adicional-gilrat';
  if (i.codigo === '1656') return 'producao-rural';
  if (i.codigo === '1213') return i.variacao === '06' ? 'producao-rural' : 'terceiros';
  if (TERCEIROS.has(i.codigo)) return 'terceiros';
  return 'outros';
}

/** O histórico do Alterdata → o grupo da provisão ("Pelo valor de INSS empresa a recolher <02/2026>" → patronal). */
export function grupoDoHistorico(h: string): GrupoDoInss | null {
  const s = h.toLowerCase();
  if (/terceiros/.test(s)) return 'terceiros';
  if (/empresa|patronal/.test(s)) return 'patronal';
  if (/pr[óo]\s*-?\s*labore|retirada|contribuinte individual|aut[ôo]nomo/.test(s)) return 'individuais';
  if (/descontad|segurad/.test(s)) return 'segurados';
  return null;
}

/** "<02/2026>" no histórico → '2026-02'; sem isso, o mês do lançamento. */
export function competenciaDoLancamento(l: Pick<LancamentoDoRazao, 'historico' | 'data'>): string {
  const m = l.historico.match(/<(\d{2})\/(\d{4})>/);
  return m ? m[2] + '-' + m[1] : l.data.slice(0, 7);
}

/** Débito com cara de pagamento da guia ("Pagamento de INSS ref 02/2026 conforme DARF."). */
function ehPagamento(l: LancamentoDoRazao): boolean {
  return l.valor < 0 && (/pag|darf|recolhiment|guia|quita/i.test(l.historico) || !grupoDoHistorico(l.historico));
}

// ─── A conferência ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface GrupoConferido { grupo: GrupoDoInss; nome: string; razao: number; guia: number; diferenca: number }

export interface SugestaoDoInss {
  /** 'aaaa-mm' de onde ela vem */
  mes: string;
  tipo: 'provisao' | 'baixa';
  debito: string;
  credito: string;
  valor: number;
  historico: string;
  /** por quê, em uma linha */
  motivo: string;
}

export interface MesDoInss {
  mes: string;
  /** o razão não alcança o mês (começa depois): o mês não é conferido */
  foraDoRazao: boolean;
  guia: GuiaDoInss | null;
  provisao: number;
  /** a guia (principal) − a provisão do razão */
  diferenca: number;
  grupos: GrupoConferido[];
  /** os códigos da guia que o sistema não provisionou (Adicional GILRAT, produção rural, outros) */
  naoProvisionadas: { grupo: GrupoDoInss; nome: string; itens: ItemDaGuia[]; valor: number }[];
  /** diferenças de centavos entre os grupos (até R$ 0,05 cada) */
  arredondamento: number;
}

export interface BaixaDoInss { guia: GuiaDoInss; lancamento: LancamentoDoRazao | null }

export interface ConferenciaDoInss {
  meses: MesDoInss[];
  /** as guias pagas dentro do período e a baixa delas no razão (null = falta) */
  baixas: BaixaDoInss[];
  /** pagamentos no razão sem guia com o mesmo valor */
  pagamentosSemGuia: LancamentoDoRazao[];
  sugestoes: SugestaoDoInss[];
  /** o saldo do razão no fim do período (credor positivo, como o Alterdata dá no passivo) */
  saldoDoRazao: number;
  /** o que devia sobrar: as guias do período pagas depois dele (ou sem pagamento) */
  saldoEsperado: number;
  /** o saldo do razão com todas as sugestões lançadas */
  saldoAjustado: number;
  /** esperado − ajustado: o que vem de antes do período (0 = fecha) */
  antesDoPeriodo: number;
}

const TOLERANCIA = 0.05;

function maisComum(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

const conta = (l: LancamentoDoRazao) => (l.contrapartida + (l.nomeContrapartida ? ' ' + l.nomeContrapartida : '')).trim();
const rotuloMes = (mes: string) => mes.slice(5, 7) + '/' + mes.slice(0, 4);

/** O razão do INSS a recolher × as guias, nos meses do período. */
export function conferirInss(razao: RazaoDaConta, guias: readonly GuiaDoInss[], meses: readonly string[]): ConferenciaDoInss {
  const ls = razao.lancamentos;
  const pagamentos = ls.filter(ehPagamento);
  const provisoes = ls.filter(l => !ehPagamento(l));
  const inicioDoRazao = razao.inicio.slice(0, 7);
  // as contrapartidas que o razão já usa: a despesa de cada grupo e o banco do pagamento
  const contraDoGrupo = (g: GrupoDoInss) => maisComum(provisoes.filter(l => grupoDoHistorico(l.historico) === g).map(conta));
  const despesaPatronal = contraDoGrupo('patronal') || 'INSS - encargos da empresa (despesa)';
  const banco = maisComum(pagamentos.map(conta)) || 'Banco';
  const sugestoes: SugestaoDoInss[] = [];

  const mesesConferidos: MesDoInss[] = meses.map(mes => {
    const guia = guias.find(g => g.competencia === mes) || null;
    const doMes = provisoes.filter(l => competenciaDoLancamento(l) === mes);
    const foraDoRazao = mes < inicioDoRazao;
    const provisao = centavos(doMes.reduce((s, l) => s + l.valor, 0));
    const grupos: GrupoConferido[] = PROVISIONADOS.map(g => {
      const r = centavos(doMes.filter(l => grupoDoHistorico(l.historico) === g).reduce((s, l) => s + l.valor, 0));
      const gu = centavos((guia?.itens || []).filter(i => grupoDoItem(i) === g).reduce((s, i) => s + i.principal, 0));
      return { grupo: g, nome: NOME_DO_GRUPO[g], razao: r, guia: gu, diferenca: centavos(gu - r) };
    }).filter(g => g.razao || g.guia);
    const naoProvisionadas = (['adicional-gilrat', 'producao-rural', 'outros'] as GrupoDoInss[]).map(g => {
      const itens = (guia?.itens || []).filter(i => grupoDoItem(i) === g);
      return { grupo: g, nome: NOME_DO_GRUPO[g], itens, valor: centavos(itens.reduce((s, i) => s + i.principal, 0)) };
    }).filter(v => v.itens.length);
    const arredondamento = centavos(grupos.filter(g => Math.abs(g.diferenca) <= TOLERANCIA).reduce((s, g) => s + g.diferenca, 0));
    const diferenca = guia ? centavos(guia.principal - provisao) : 0;

    if (guia && !foraDoRazao) {
      const ref = '<' + rotuloMes(mes) + '>';
      for (const g of grupos.filter(x => Math.abs(x.diferenca) > TOLERANCIA)) {
        const despesa = contraDoGrupo(g.grupo) || despesaPatronal;
        const sobra = g.diferenca < 0;
        sugestoes.push({
          mes, tipo: 'provisao', debito: sobra ? 'INSS a recolher' : despesa, credito: sobra ? despesa : 'INSS a recolher', valor: Math.abs(g.diferenca),
          historico: 'Pelo valor de INSS ' + (sobra ? 'provisionado a maior' : 'a recolher') + ' — ' + g.nome + ' ' + ref,
          motivo: g.nome + ': razão ' + brl(g.razao) + ' × guia ' + brl(g.guia),
        });
      }
      for (const v of naoProvisionadas) {
        const rural = v.grupo === 'producao-rural';
        sugestoes.push({
          mes, tipo: 'provisao', debito: rural ? 'Fornecedor (produtor rural PF)' : despesaPatronal, credito: 'INSS a recolher', valor: v.valor,
          historico: rural ? 'INSS sobre aquisição de produção rural de PF (sub-rogação) ' + ref : 'Pelo valor de INSS a recolher — ' + v.nome + ' ' + ref,
          motivo: v.nome + ' na guia (' + v.itens.map(i => i.codigo + (i.variacao ? '-' + i.variacao : '') + ' ' + brl(i.principal)).join(', ') + ') e não no razão',
        });
      }
      // o arredondamento só vira lançamento quando sobra algum centavo no mês
      if (Math.abs(arredondamento) >= 0.01) {
        sugestoes.push({
          mes, tipo: 'provisao', debito: arredondamento > 0 ? despesaPatronal : 'INSS a recolher', credito: arredondamento > 0 ? 'INSS a recolher' : despesaPatronal,
          valor: Math.abs(arredondamento), historico: 'Ajuste de centavos do INSS a recolher ' + ref, motivo: 'Arredondamento entre os grupos (centavos)',
        });
      }
    }
    return { mes, foraDoRazao, guia, provisao, diferenca, grupos, naoProvisionadas, arredondamento };
  });

  // as baixas: cada guia paga dentro do período (e dentro do que o razão alcança) tem que ter o pagamento no razão (o
  // mais perto da data, sem repetir)
  const primeiro = meses[0] + '-01';
  const desde = primeiro > razao.inicio ? primeiro : razao.inicio;
  const ultimo = meses[meses.length - 1] + '-31';
  const usados = new Set<LancamentoDoRazao>();
  const baixas: BaixaDoInss[] = guias.filter(g => g.pagaEm && g.pagaEm >= desde && g.pagaEm <= ultimo).map(guia => {
    const dias = (l: LancamentoDoRazao) => Math.abs(Date.parse(l.data) - Date.parse(guia.pagaEm));
    const lancamento = pagamentos.filter(l => !usados.has(l) && (Math.abs(-l.valor - guia.total) < 0.01 || Math.abs(-l.valor - guia.principal) < 0.01))
      .sort((a, b) => dias(a) - dias(b))[0] || null;
    if (lancamento) usados.add(lancamento);
    else {
      sugestoes.push({
        mes: guia.competencia, tipo: 'baixa', debito: 'INSS a recolher', credito: banco, valor: guia.total,
        historico: 'Pagamento de INSS ref ' + rotuloMes(guia.competencia) + ' conforme DARF.',
        motivo: 'Guia de ' + rotuloMes(guia.competencia) + ' paga em ' + guia.pagaEm.split('-').reverse().join('/') + ' sem a baixa no razão'
          + (guia.total > guia.principal ? ' (multa e juros de ' + brl(centavos(guia.total - guia.principal)) + ' vão para a despesa)' : ''),
      });
    }
    return { guia, lancamento };
  });
  const pagamentosSemGuia = pagamentos.filter(l => !usados.has(l) && l.data >= primeiro && l.data <= ultimo);

  const saldoEsperado = centavos(guias.filter(g => g.competencia <= meses[meses.length - 1] && (!g.pagaEm || g.pagaEm > ultimo)).reduce((s, g) => s + g.principal, 0));
  // cada sugestão de provisão aumenta (ou diminui) o saldo credor; cada baixa diminui pelo principal da guia
  const ajuste = sugestoes.reduce((s, x) => {
    if (x.tipo === 'baixa') return s - (baixas.find(b => !b.lancamento && b.guia.competencia === x.mes)?.guia.principal ?? x.valor);
    return s + (x.credito === 'INSS a recolher' ? x.valor : -x.valor);
  }, 0);
  // o saldo do razão no fim do período (o razão pode ir além dele)
  const ateOFim = ls.filter(l => l.data <= ultimo);
  const saldoDoRazao = ateOFim.length ? ateOFim[ateOFim.length - 1].saldo : razao.saldoInicial;
  const saldoAjustado = centavos(saldoDoRazao + ajuste);
  return {
    meses: mesesConferidos, baixas, pagamentosSemGuia, sugestoes,
    saldoDoRazao, saldoEsperado, saldoAjustado, antesDoPeriodo: centavos(saldoEsperado - saldoAjustado),
  };
}
