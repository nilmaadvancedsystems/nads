// Verificar por conta: cruza as notas da conta com o relatório da conta (razão) e diz
// o que falta, o que está duplicado, o que está a mais e o ICMS.
// Origem: conferencia.html — o algoritmo morava DENTRO do clique $('#vcBtConferir').onclick
// (~L3980-4108); vcNumerosDoHistorico/vcPartesHistorico/ehLinhaIcms (~L3754-3792),
// vcLinhasDuplicadas/vcLinhasFaltando/vcLinhaRazao (~L3785-3806), vcComposicao (~L4110),
// vcNotasServ (~L3735), vcBtCsv (~L4225). O relatório nunca é salvo: só memória.
import { brl, compararNumerico, nomeNorm } from '../../formatos';
import { SV } from '../tabelas/servicos';
import type { Conta, Empresa, NotaComTipo, NotaServico, TipoServico } from '../tipos';
import { agruparTotaisPorNatureza, chaveNaturezaNota, chaveNota } from './cfop';
import { nomeComumContas } from './conciliacao';
import { contasDaNatureza, listaTipo, naturezasDaConta, todasNotasComTipo } from './empresa';
import { catDoPart, catServ, contasDoPart, notasCfopDeServico } from './servicos';

/** Uma linha do relatório da conta. */
export interface LinhaRazao {
  txt: string;
  data: string;
  /** sempre positivo */
  valor: number;
  sinal: 1 | -1;
  contra: string;
  /** conta de origem, quando são várias contas */
  conta?: string;
  /** "é do CFOP 1201 (conta 60502)" */
  dica?: string;
}

/** Nota alvo da conferência: fiscal (com CFOP) ou de serviço. */
export type NotaAlvo = (NotaComTipo | (NotaServico & { cfop?: string; tipo?: undefined })) & { exportado?: string };

const IGUAL = 0.005;
const semZeros = (t: string) => t.replace(/^0+/, '') || t;

/**
 * Números de nota no histórico. Padrão fiscal: "… 29-54540585000161-NOME // NF 9009" — o número
 * real vem logo antes do CNPJ. Sem esse padrão, todo número de 3+ dígitos (serviço aceita até 15,
 * sem confundir com CPF/CNPJ). O grupo é limitado ({1,9}) pra regex não travar em texto comprido.
 */
export function numerosDoHistorico(txt: string, serv: boolean): string[] {
  const m = txt.match(/(\d{1,9})-(\d{14})-/);
  if (m) return [m[1]];
  return (txt.match(/\d{3,}/g) || []).filter(t => (serv ? t.length <= 15 && t.length !== 11 && t.length !== 14 : t.length < 11));
}

export function partesDoHistorico(txt: string): { nota: string; doc: string; nome: string; contra: string; lanc: string } {
  const t = String(txt || '').replace(/\s+/g, ' ').trim();
  const p = { nota: '', doc: '', nome: '', contra: '', lanc: '' };
  const m = t.match(/(\d{1,15})\s*-\s*(\d{14}|\d{11})\s*-\s*(.+)$/);
  if (m) { p.nota = m[1].replace(/^0+(?=\d)/, ''); p.doc = m[2]; p.nome = m[3].trim(); }
  const c = t.match(/^(.*?)\s(\d{4,6})\s+pelo valor/i);
  if (c) { p.contra = c[1].trim(); p.lanc = c[2]; }
  return p;
}

/** Lançamento de ICMS não é nota repetida: sai da conferência e vai pra lista própria. */
export function ehLinhaIcms(l: Pick<LinhaRazao, 'txt'>): boolean {
  return /\bicms\b/.test(nomeNorm(l.txt));
}

/** Linha do relatório no formato da tabela. */
export interface LinhaTabela { data: string; nota: string; part: string; contra: string; valor: number; txt?: string; conta?: string; cfop?: string; exportado?: string }

export function linhaDaTabela(l: LinhaRazao): LinhaTabela {
  const p = partesDoHistorico(l.txt);
  return { data: l.data, nota: p.nota, part: (p.nome || l.txt) + (l.dica ? ' · ' + l.dica : ''), contra: l.contra || p.lanc, valor: l.valor, txt: l.txt, conta: l.conta };
}

// ---------- o que conferir ----------
/** Conta ligada só a serviço → modo serviços (sem CFOP). */
export function servicoDaContaVerificar(e: Empresa, codigo: string): TipoServico | null {
  for (const k of Object.keys(e.naturezaConta || {})) {
    const m = /^serv\|(tomados|prestados)\|/.exec(k);
    if (m && contasDaNatureza(e, k).indexOf(codigo) > -1) return m[1] as TipoServico;
  }
  return null;
}

/** Notas de serviço (e com CFOP ligadas às mesmas contas) da conta. */
export function notasServicoDaConta(e: Empresa, t: TipoServico, codigos: string[]): NotaAlvo[] {
  const tNf = t === 'tomados' ? 'Entrada' : 'Saída';
  const serv = listaTipo(e, t).filter(n => contasDoPart(e, t, n.nome).some(c => codigos.indexOf(c) > -1));
  const nf = notasCfopDeServico(e, t).filter(n => contasDaNatureza(e, chaveNaturezaNota(n, tNf)).some(c => codigos.indexOf(c) > -1))
    .map(n => ({ ...n, tipo: tNf } as NotaComTipo));
  return (serv as NotaAlvo[]).concat(nf);
}

/** Opções de CFOP (naturezas) para o formulário; a vinculada à conta vem travada. */
export function opcoesCfop(e: Empresa, conta: Conta | null): { chaves: string[]; rotulos: Record<string, string>; vinculada: string | null } {
  const grupos = agruparTotaisPorNatureza(todasNotasComTipo(e));
  const chaves = Object.keys(grupos).sort((a, b) => compararNumerico(grupos[a].cfops.slice().sort()[0] || '', grupos[b].cfops.slice().sort()[0] || ''));
  const rotulos: Record<string, string> = {};
  for (const k of chaves) {
    const g = grupos[k];
    rotulos[k] = g.cfops.slice().sort(compararNumerico).join(', ') + (g.desc ? ' — ' + g.desc : '') + ' (' + g.itens.length + ' notas)';
  }
  const vinculada = conta ? naturezasDaConta(e, conta.codigo).filter(k => grupos[k])[0] || null : null;
  return { chaves, rotulos, vinculada };
}

/** "70002 + 70006 — Compras de Mercadorias" (ou uma conta só). */
export function rotuloContas(contas: Pick<Conta, 'codigo' | 'nome'>[]): string {
  if (!contas.length) return '';
  if (contas.length === 1) return contas[0].codigo + ' — ' + contas[0].nome;
  const nomes = contas.map(a => a.nome);
  return contas.map(a => a.codigo).join(' + ') + ' — ' + (nomeComumContas(nomes) || nomes.join(' / '));
}

// ---------- o cruzamento ----------
export interface Duplicada { numero: string; vezes: number; valor: number; linhas: LinhaRazao[] }

export interface ResultadoVerificacao {
  faltando: NotaAlvo[];
  duplicada: Duplicada[];
  aMais: LinhaRazao[];
  icms: LinhaRazao[];
  somaRazao: number;
  somaSemIcms: number;
  icmsSub: number;
  somaFiscal: number;
  serv: TipoServico | null;
  conta: { codigo: string; nome: string };
  /** mais de uma conta com relatório: abas Todas · 70002 · 70006 */
  contas: { codigo: string; nome: string }[] | null;
  fonte: string;
  /** todas as linhas usadas (com a conta de origem), para as abas por conta */
  linhas: LinhaRazao[];
}

export interface EntradaVerificacao {
  empresa: Empresa;
  /** contas conferidas (uma, ou o grupo que divide os CFOPs) */
  contas: Conta[];
  /** relatório de cada conta (código → linhas) */
  razaoPorConta: Record<string, LinhaRazao[]>;
  /** natureza escolhida (modo CFOP) */
  cfopGrupo: string | null;
  /** modo serviços */
  servTipo: TipoServico | null;
}

export function conferirConta(x: EntradaVerificacao): ResultadoVerificacao {
  const e = x.empresa;
  const codigos = x.contas.map(c => c.codigo);
  const multi = x.contas.length > 1;
  const todas = todasNotasComTipo(e);
  let alvo: NotaAlvo[];
  let fonte: string;
  let gr: ReturnType<typeof agruparTotaisPorNatureza>[string] | undefined;
  if (x.servTipo) {
    alvo = notasServicoDaConta(e, x.servTipo, codigos);
  } else {
    gr = agruparTotaisPorNatureza(todas)[x.cfopGrupo || ''];
    if (!gr) throw new Error('Escolha o CFOP antes de conferir.');
    alvo = gr.itens;
  }
  const razao: LinhaRazao[] = multi
    ? x.contas.flatMap(a => (x.razaoPorConta[a.codigo] || []).map(l => ({ ...l, conta: a.codigo, dica: undefined })))
    : (x.razaoPorConta[codigos[0]] || []).map(l => ({ ...l, dica: undefined }));

  const icmsLinhas = razao.filter(ehLinhaIcms);
  let linhasConf = razao.filter(l => !ehLinhaIcms(l));

  // nota com mais de um CFOP (ex.: NF 21112 = CFOP 1411 + CFOP 1201): a linha com o valor do item
  // do outro CFOP não é duplicada — pertence a outra conta; vai pra "A mais" com a dica
  const deOutroCfop: LinhaRazao[] = [];
  if (!x.servTipo) {
    const chAlvo: Record<string, 1> = {};
    for (const n of alvo) chAlvo[chaveNota(n as NotaComTipo)] = 1;
    const porNum: Record<string, NotaComTipo[]> = {};
    for (const n of todas) { const k = String(n.numero || '').replace(/^0+/, '') || n.numero; if (k) (porNum[k] = porNum[k] || []).push(n); }
    linhasConf = linhasConf.filter(l => {
      for (const t of numerosDoHistorico(l.txt, false)) {
        const ns = porNum[semZeros(t)] || [];
        const doAlvo = ns.filter(n => chAlvo[chaveNota(n)]);
        if (!doAlvo.length || doAlvo.some(n => Math.abs(n.valor - l.valor) < IGUAL)) continue;
        const f = ns.find(n => !chAlvo[chaveNota(n)] && Math.abs(n.valor - l.valor) < IGUAL);
        if (f) {
          const cs = contasDaNatureza(e, chaveNaturezaNota(f, f.tipo));
          l.dica = 'é do CFOP ' + f.cfop + (cs.length ? ' (conta ' + cs.join(', ') + ')' : ' (sem conta vinculada)');
          deOutroCfop.push(l);
          return false;
        }
      }
      return true;
    });
  }

  const serv = !!x.servTipo;
  const numerosPorLinha = linhasConf.map(l => numerosDoHistorico(l.txt, serv));
  const vistos: Record<string, number> = {};
  linhasConf.forEach((_, i) => { for (const t of numerosPorLinha[i]) { const k = semZeros(t); vistos[k] = (vistos[k] || 0) + 1; } });
  const numerosAlvo: Record<string, 1> = {};
  for (const n of alvo) if (n.numero) numerosAlvo[n.numero.replace(/^0+/, '') || n.numero] = 1;
  const faltando = alvo.filter(n => !!n.numero && !vistos[n.numero.replace(/^0+/, '') || n.numero]);

  const itensPorNumero: Record<string, number[]> = {};
  const linhasPorNumero: Record<string, LinhaRazao[]> = {};
  for (const n of alvo) { if (!n.numero) continue; const k = n.numero.replace(/^0+/, '') || n.numero; (itensPorNumero[k] = itensPorNumero[k] || []).push(n.valor); }
  linhasConf.forEach((l, i) => { for (const t of numerosPorLinha[i]) { const k = semZeros(t); const a = (linhasPorNumero[k] = linhasPorNumero[k] || []); if (a.indexOf(l) < 0) a.push(l); } });
  // duplicada é decidida pelo VALOR: só quando o lançado com o número da nota passa do valor dela
  const duplicada: Duplicada[] = Object.keys(linhasPorNumero).filter(k => numerosAlvo[k] && linhasPorNumero[k].length > 1).map(k => {
    const ls = linhasPorNumero[k];
    const its = itensPorNumero[k] || [];
    const esperado = its.reduce((s, v) => s + v, 0);
    const lancado = ls.reduce((s, l) => s + l.valor, 0);
    const extra = lancado - esperado;
    if (extra < IGUAL) return null; // bate com a nota (inteira ou item a item)
    const resto = ls.slice().sort((a, b) => a.valor - b.valor);
    const inteira = resto.findIndex(l => Math.abs(l.valor - esperado) < IGUAL);
    if (inteira >= 0) resto.splice(inteira, 1);
    else for (const v of its) { const i = resto.findIndex(l => Math.abs(l.valor - v) < IGUAL); if (i >= 0) resto.splice(i, 1); }
    return { numero: k, vezes: ls.length, valor: extra, linhas: resto };
  }).filter((d): d is Duplicada => d !== null);

  const aMais = linhasConf.filter((_, i) => !numerosPorLinha[i].some(t => numerosAlvo[semZeros(t)])).concat(deOutroCfop);
  const somaSemIcms = linhasConf.concat(deOutroCfop).reduce((s, l) => s + l.valor, 0);
  const neg = linhasConf.filter(l => l.sinal < 0).length;
  const sinalConta = neg > linhasConf.length / 2 ? -1 : 1;
  const icmsSub = icmsLinhas.reduce((s, l) => s + (l.sinal === sinalConta ? -l.valor : l.valor), 0);
  const somaRazao = somaSemIcms + icmsLinhas.reduce((s, l) => s + l.valor, 0);
  const somaFiscal = alvo.reduce((s, n) => s + n.valor, 0);

  if (x.servTipo) {
    const cats: string[] = [];
    for (const n of alvo) { const c = catServ(x.servTipo, catDoPart(e, x.servTipo, n.nome)).nome; if (cats.indexOf(c) < 0) cats.push(c); }
    fonte = SV[x.servTipo].rotulo + (cats.length ? ' · ' + cats.join(', ') : '');
  } else {
    fonte = 'CFOP ' + (gr as NonNullable<typeof gr>).cfops.slice().sort(compararNumerico).join(', ') + ((gr as NonNullable<typeof gr>).desc ? ' — ' + (gr as NonNullable<typeof gr>).desc : '');
  }
  const comRel = multi ? x.contas.filter(a => x.razaoPorConta[a.codigo]) : [];
  const rot = rotuloContas(x.contas);
  const conta = !multi ? { codigo: x.contas[0].codigo, nome: x.contas[0].nome }
    : comRel.length === 1 ? { codigo: comRel[0].codigo, nome: comRel[0].nome }
    : { codigo: comRel.map(a => a.codigo).join(' + '), nome: nomeComumContas(comRel.map(a => a.nome)) || rot.slice(rot.indexOf(' — ') + 3) };

  return {
    faltando, duplicada, aMais, icms: icmsLinhas, somaRazao, somaSemIcms, icmsSub, somaFiscal,
    serv: x.servTipo, conta,
    contas: comRel.length > 1 ? comRel.map(a => ({ codigo: a.codigo, nome: a.nome })) : null,
    fonte, linhas: razao,
  };
}

export function semPendencias(r: ResultadoVerificacao): boolean {
  return !r.faltando.length && !r.duplicada.length && !r.aMais.length;
}

/** Linhas "a mais" por repetição (as que sobram de cada número duplicado). */
export function linhasDuplicadas(r: ResultadoVerificacao): LinhaTabela[] {
  const out: LinhaTabela[] = [];
  for (const d of r.duplicada) for (const l of d.linhas) out.push(linhaDaTabela(l));
  return out;
}

export function linhasFaltando(r: ResultadoVerificacao): LinhaTabela[] {
  return r.faltando.map(n => ({ data: n.data, nota: n.numero, part: n.nome, contra: '', valor: n.valor, cfop: n.cfop || '', exportado: n.exportado || '' }));
}

export interface Totais { faltando: number; duplicadas: number; aMais: number; icms: number; diferenca: number; semExplicacao: number }

/** Diferença = Faltando − Duplicadas − A mais − ICMS; o que sobrar é "Sem explicação". */
export function totaisVerificacao(r: ResultadoVerificacao): Totais {
  const faltando = r.faltando.reduce((s, n) => s + n.valor, 0);
  const duplicadas = r.duplicada.reduce((s, d) => s + d.valor, 0);
  const aMais = r.aMais.reduce((s, l) => s + l.valor, 0);
  const icms = r.icms.reduce((s, l) => s + l.valor, 0);
  const diferenca = r.somaFiscal - r.somaRazao;
  return { faltando, duplicadas, aMais, icms, diferenca, semExplicacao: diferenca - (faltando - duplicadas - aMais - icms) };
}

/** Aba de uma conta (várias contas): o relatório dela e o que sobrou nela. */
export function resultadoDaConta(r: ResultadoVerificacao, codigo: string) {
  const dups = linhasDuplicadas(r).filter(l => l.conta === codigo);
  const mais = r.aMais.filter(l => l.conta === codigo).map(linhaDaTabela);
  const soma = (ls: { valor: number }[]) => ls.reduce((s, l) => s + l.valor, 0);
  const somaConta = soma(r.linhas.filter(l => l.conta === codigo && !ehLinhaIcms(l)));
  return { dups, mais, somaConta, pendencias: soma(dups) + soma(mais) };
}

/** CSV do resultado (mesmas colunas da tela + totalizador). */
export function csvVerificacao(r: ResultadoVerificacao): string[] {
  const t = totaisVerificacao(r);
  const multi = !!(r.contas && r.contas.length > 1);
  const L = [(multi ? 'Tipo;Conta;' : 'Tipo;') + 'Data;Nota;Participante;Contrapartida;Valor'];
  const add = (tipo: string, l: LinhaTabela) => L.push([tipo].concat(multi ? [l.conta || ''] : []).concat([l.data, l.nota || '', String(l.part || '').replace(/;/g, ','), l.contra || '', brl(l.valor)]).join(';'));
  linhasFaltando(r).forEach(l => add('Faltando', l));
  linhasDuplicadas(r).forEach(l => add('Duplicada', l));
  r.aMais.map(linhaDaTabela).forEach(l => add('A mais', l));
  r.icms.map(linhaDaTabela).forEach(l => add('ICMS', l));
  L.push('');
  const vz = multi ? ['', '', '', ''] : ['', '', ''];
  L.push(['Totalizador', ...vz, 'Faltando', brl(t.faltando)].join(';'));
  L.push(['Totalizador', ...vz, 'Duplicadas', brl(-t.duplicadas)].join(';'));
  L.push(['Totalizador', ...vz, 'A mais', brl(-t.aMais)].join(';'));
  if (t.icms) L.push(['Totalizador', ...vz, 'ICMS', brl(-t.icms)].join(';'));
  L.push(['Totalizador', ...vz, 'Diferença', brl(t.faltando - t.duplicadas - t.aMais - t.icms)].join(';'));
  return L;
}

/** O que falta preencher antes de conferir. */
export function faltaParaConferir(x: { temPlano: boolean; conta: Conta | null; multi: boolean; algumRelatorio: boolean; relatorioUnico: boolean; servTipo: TipoServico | null; qtdNotasServ: number; cfopGrupo: string | null }): string[] {
  const f: string[] = [];
  if (!x.temPlano) f.push('Importar o balancete em Importação › Balancete');
  if (!x.conta) f.push('Escolher qual conta você quer conferir');
  if (x.multi) { if (!x.algumRelatorio) f.push('Importar o relatório de pelo menos uma das contas'); }
  else if (!x.relatorioUnico) f.push('Importar o relatório da conta contábil');
  if (x.servTipo) { if (!x.qtdNotasServ) f.push('Nenhuma nota de ' + SV[x.servTipo].rotulo.toLowerCase() + ' ligada a essa conta'); }
  else if (!x.cfopGrupo) f.push('Escolher o CFOP referente a essa conta');
  return f;
}
