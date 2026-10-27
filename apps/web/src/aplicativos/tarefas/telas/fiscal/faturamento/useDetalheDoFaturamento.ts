// ViewModel do faturamento detalhado de um cliente (Fiscal › Faturamento; 22/10/2026: "quando eu clique no cliente abra
// um faturamento detalhado"): os números do período, a evolução mês a mês (core tarefas.sieg.mesesDoDetalhe) e, no mês
// escolhido, as notas para procurar e abrir, por comprador ou por CFOP, pelas notas do "Baixar XMLs" (core
// tarefas.sieg.resumoDasEmitidas). Sem os XMLs do mês, diz onde baixar. E as despesas do mês pelo balancete
// dinâmico do Contábil (core tarefas.despesasDoMes: água, energia, FGTS…) e a guia do FGTS emitida pelo robô.
import { tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { useContabilDaEmpresa } from '../../../../../comum/contabilDaEmpresa';
import { useFgts, useSieg } from '../../../dados/repo';

const f = t.sieg;

/** "1,54 mi", "980 mil", "750" (o número em cima da barra) */
function compacto(v: number): string {
  if (v >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('pt-BR') + ' mil';
  return Math.round(v).toLocaleString('pt-BR');
}
const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export type ModoDasNotas = 'comprador' | 'cfop';
export interface NotaDoGrupo { nota: t.sieg.NotaDoSieg; valor: number }
export interface GrupoDeNotas { chave: string; rotulo: string; doc: string; valor: number; notas: NotaDoGrupo[] }

/** as notas do mês agrupadas por comprador ou por CFOP (no CFOP, o valor da nota é o dos itens daquele CFOP) */
function agrupar(vendas: readonly t.sieg.NotaDoSieg[], modo: ModoDasNotas): GrupoDeNotas[] {
  const grupos = new Map<string, GrupoDeNotas>();
  const somar = (chave: string, rotulo: string, doc: string, nota: t.sieg.NotaDoSieg, valor: number) => {
    const g = grupos.get(chave) || { chave, rotulo, doc, valor: 0, notas: [] };
    g.valor += valor; g.notas.push({ nota, valor });
    grupos.set(chave, g);
  };
  for (const n of vendas) {
    if (modo === 'comprador') {
      const doc = String(n.destinatario?.doc || '');
      const nome = String(n.destinatario?.nome || '').trim();
      somar(doc || nome || '—', nome || 'Consumidor (sem identificação)', doc, n, n.valor || 0);
    } else if (n.itens?.length) {
      const porCfop = new Map<string, number>();
      for (const i of n.itens) porCfop.set(i.cfop || '—', (porCfop.get(i.cfop || '—') || 0) + (i.valor || 0));
      for (const [cfop, v] of porCfop) somar(cfop, cfop, '', n, v);
    } else somar(n.cfop || '—', n.cfop || '—', '', n, n.valor || 0);
  }
  return [...grupos.values()].map(g => ({ ...g, valor: Math.round(g.valor * 100) / 100, notas: g.notas.sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => b.valor - a.valor);
}
const POR_VEZ = 30;

/** mostrarVazios: os meses sem dado entram na tabela (só no período Ano; 22/10/2026: "se não tá marcado anual não tem por que estar ali comendo espaço") */
export function useDetalheDoFaturamento(codigo: number, nome: string, competencias: readonly string[], mostrarVazios = false) {
  const sieg = useSieg();
  const fgts = useFgts();
  const contabil = useContabilDaEmpresa(nome, codigo);
  const meses = f.mesesDoDetalhe(competencias, c => sieg.doMes(c).saidas.get(String(codigo)));
  const comDado = meses.filter(m => m.total != null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const mes = (escolhido && meses.find(m => m.competencia === escolhido && m.total != null)) || comDado[comDado.length - 1] || null;
  const notas = mes ? sieg.notas(String(codigo), mes.competencia) : null;
  const resumo = notas?.dados ? f.resumoDasEmitidas(notas.dados) : null;
  const total = comDado.reduce((s, m) => s + (m.total || 0), 0);
  const maior = comDado.reduce<t.sieg.MesDoDetalhe | null>((a, m) => (!a || (m.total || 0) > (a.total || 0) ? m : a), null);
  const totalDoResumo = resumo?.valor || 0;
  const despesas = mes && contabil.dinamico ? t.despesasDoMes(contabil.dinamico.d, mes.competencia) : null;
  // a guia do FGTS do mês, se o robô emitiu (o valor vem como texto, "917,42")
  const guiaFgts = mes ? [...fgts.pedidos(mes.competencia).porCnpj.values()].find(p => p.codigo === String(codigo) && p.valor) : undefined;
  const pct = (v: number, de: number) => (de > 0 ? (v / de) * 100 : 0);
  // o painel do cliente (23/10/2026: "abre o dashboard de maneira muito simplista… procura referências"), como nos painéis
  // de faturamento por cliente: o ticket médio, o último mês com a variação, o mix NF-e × NFC-e, a evolução em barras e,
  // no mês, as notas para procurar (a curva ABC saiu em 23/10/2026: "o que é A, B, C? não tá intuitivo")
  const notasNoPeriodo = comDado.reduce((s, m) => s + m.notas, 0);
  const nfe = comDado.reduce((s, m) => s + (m.nfe || 0), 0), nfce = comDado.reduce((s, m) => s + (m.nfce || 0), 0);
  const ultimo = comDado[comDado.length - 1] || null;
  // as notas do mês, para procurar e abrir (23/10/2026: "por que não tem como eu ver todos os clientes / abrir e ver /
  // pesquisar as notas por aqui?" e "por que não ter como ver as notas por CFOP se eu clicar?"): por comprador ou por
  // CFOP, todos (de 30 em 30), a busca pelo nome, o CNPJ, o CFOP ou o número da nota; clicar abre as notas do grupo
  const [vendo, setVendo] = useState('');
  const [modo, setModo] = useState<ModoDasNotas>('comprador');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState('');
  const [limite, setLimite] = useState(POR_VEZ);
  const emitidas = notas?.dados?.emitidas;
  const vendas = useMemo(() => (emitidas || []).filter(n => (n.tipo === 'NF-e' || n.tipo === 'NFC-e') && !n.cancelada), [emitidas]);
  const grupos = useMemo(() => agrupar(vendas, modo), [vendas, modo]);
  const q = normal(busca.trim());
  const soDigitos = busca.replace(/\D/g, '');
  const achados = q ? grupos.flatMap(g => {
    if (normal(g.rotulo).includes(q) || (soDigitos.length >= 3 && g.doc.includes(soDigitos))) return [g];
    const notasAchadas = soDigitos ? g.notas.filter(x => x.nota.numero.includes(soDigitos)) : [];
    return notasAchadas.length ? [{ ...g, notas: notasAchadas }] : [];
  }) : grupos;
  return {
    numeros: {
      total,
      media: comDado.length ? total / comDado.length : 0,
      mesesComDado: comDado.length,
      maior: maior ? { rotulo: t.rotuloCompetencia(maior.competencia), valor: maior.total || 0 } : null,
      notas: notasNoPeriodo,
      canceladas: comDado.reduce((s, m) => s + m.canceladas, 0),
      ticket: notasNoPeriodo ? total / notasNoPeriodo : 0,
      ultimo: ultimo ? { rotulo: t.rotuloCompetencia(ultimo.competencia), valor: ultimo.total || 0, variacao: ultimo.variacao, anterior: comDado.length > 1 ? f.mesCurto(comDado[comDado.length - 2].competencia) : '' } : null,
      mix: { nfe, nfce, pctNfe: Math.round(pct(nfe, nfe + nfce)), pctNfce: Math.round(pct(nfce, nfe + nfce)) },
    },
    /** a evolução: uma barra por mês (fora do período Ano, só os meses com dado), o valor em cima; clicar escolhe o mês */
    barras: meses.filter(m => mostrarVazios || m.total != null).map((m, i) => ({
      chave: m.competencia, rotulo: f.mesCurto(m.competencia).slice(0, 3), sub: m.competencia.slice(5) === '01' || i === 0 ? m.competencia.slice(0, 4) : '',
      total: m.total ? Math.max(1, Math.round(m.total)) : 0,
      valor: m.total ? compacto(m.total) : '',
      leitura: f.mesCurto(m.competencia) + ': ' + (m.total == null ? 'sem dado' : 'R$ ' + m.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + (m.variacao == null ? '' : ', ' + (m.variacao > 0 ? '+' : '') + m.variacao + '% sobre o mês anterior')),
    })),
    /** quantos meses do período ficaram de fora por não ter dado */
    semDado: mostrarVazios ? 0 : meses.length - comDado.length,
    escolher: (c: string) => setEscolhido(c),
    mes: mes ? { competencia: mes.competencia, rotulo: t.rotuloCompetencia(mes.competencia) } : null,
    carregandoNotas: !!notas && !notas.carregadas,
    /** as notas do mês escolhido (null = o "Baixar XMLs" ainda não foi feito para o mês) */
    resumo: resumo ? { quantidade: resumo.quantidade, canceladas: resumo.canceladas } : null,
    /** o explorador das notas: o modo, a busca, os grupos (de 30 em 30) e o grupo aberto */
    modo, setModo: (m: ModoDasNotas) => { setModo(m); setAberto(''); setLimite(POR_VEZ); },
    busca, setBusca: (b: string) => { setBusca(b); setLimite(POR_VEZ); },
    grupos: achados.slice(0, limite).map(g => ({
      chave: g.chave, rotulo: g.rotulo, doc: g.doc, valor: g.valor, pct: Math.round(pct(g.valor, totalDoResumo) * 10) / 10,
      barra: pct(g.valor, achados[0]?.valor || 0),
      aberto: aberto === g.chave || (!!q && achados.length <= 3),
      notas: g.notas.map(x => ({ chave: x.nota.chave, titulo: x.nota.tipo + ' ' + x.nota.numero, data: x.nota.data, para: x.nota.destinatario?.nome || 'Consumidor (sem identificação)', valor: x.valor })),
    })),
    totalDeGrupos: grupos.length,
    gruposAchados: achados.length,
    faltam: Math.max(0, achados.length - limite),
    mostrarMais: () => setLimite(l => l + POR_VEZ),
    abrirGrupo: (chave: string) => setAberto(a => (a === chave ? '' : chave)),
    vendo: vendo ? vendas.find(n => n.chave === vendo) || null : null,
    verNota: (c: string) => setVendo(c),
    fecharNota: () => setVendo(''),
    /** o balancete dinâmico do Contábil: importado? tem o mês? as despesas do mês */
    temDinamico: !!contabil.dinamico,
    despesas: despesas ? {
      total: despesas.total,
      destaques: despesas.destaques,
      contas: despesas.contas.slice(0, 10).map(c => ({ ...c, pct: pct(c.valor, despesas.contas[0]?.valor || 0) })),
      outras: Math.max(0, despesas.contas.length - 10),
    } : null,
    guiaFgts: guiaFgts ? { valor: guiaFgts.valor, vencimento: guiaFgts.vencimento } : null,
  };
}
