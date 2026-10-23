// ViewModel do faturamento detalhado de um cliente (Fiscal › Faturamento; 22/10/2026: "quando eu clique no cliente abra
// um faturamento detalhado"): os números do período, o mês a mês (a NF-e e a NFC-e separadas, as notas, as canceladas e a
// variação; core tarefas.sieg.mesesDoDetalhe) e, no mês escolhido, para quem vendeu e por CFOP, pelas notas do "Baixar
// XMLs" (core tarefas.sieg.resumoDasEmitidas). Sem os XMLs do mês, diz onde baixar. E as despesas do mês pelo balancete
// dinâmico do Contábil (core tarefas.despesasDoMes: água, energia, FGTS…) e a guia do FGTS emitida pelo robô.
import { tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useContabilDaEmpresa } from '../../../../../comum/contabilDaEmpresa';
import { useFgts, useSieg } from '../../../dados/repo';

const f = t.sieg;

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
  // no mês, a curva ABC dos compradores (quem faz 80% do valor) e a concentração no maior e nos 5 maiores
  const notasNoPeriodo = comDado.reduce((s, m) => s + m.notas, 0);
  const nfe = comDado.reduce((s, m) => s + (m.nfe || 0), 0), nfce = comDado.reduce((s, m) => s + (m.nfce || 0), 0);
  const ultimo = comDado[comDado.length - 1] || null;
  const curva = resumo ? f.curvaAbc(resumo.porCliente) : null;
  // as maiores notas do mês, para conferir no espelho (23/10/2026: "conferir as danfe direto pelo app")
  const [vendo, setVendo] = useState('');
  const vendas = (notas?.dados?.emitidas || []).filter(n => (n.tipo === 'NF-e' || n.tipo === 'NFC-e') && !n.cancelada);
  const maioresNotas = [...vendas].sort((a, b) => b.valor - a.valor).slice(0, 8);
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
    /** a evolução: uma barra por mês do período, em mil reais (clicar escolhe o mês) */
    barras: meses.map((m, i) => ({
      chave: m.competencia, rotulo: f.mesCurto(m.competencia).slice(0, 3), sub: m.competencia.slice(5) === '01' || i === 0 ? m.competencia.slice(0, 4) : '',
      total: m.total ? Math.max(1, Math.round(m.total / 1000)) : 0,
      leitura: f.mesCurto(m.competencia) + ': ' + (m.total == null ? 'sem dado' : 'R$ ' + m.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })),
    })),
    /** a curva ABC dos compradores do mês escolhido */
    abc: curva ? {
      compradores: curva.linhas.length,
      porClasse: curva.porClasse,
      maior: curva.maior,
      cinco: curva.cinco,
      consumidor: Math.round(pct(resumo?.porCliente.find(c => !c.doc)?.valor || 0, totalDoResumo)),
    } : null,
    /** o mês a mês, do mais novo para o mais velho */
    meses: [...meses].reverse().filter(m => mostrarVazios || m.total != null).map(m => ({ ...m, rotulo: f.mesCurto(m.competencia), escolhido: m.competencia === mes?.competencia })),
    /** quantos meses do período ficaram de fora por não ter dado */
    semDado: mostrarVazios ? 0 : meses.length - comDado.length,
    escolher: (c: string) => setEscolhido(c),
    mes: mes ? { competencia: mes.competencia, rotulo: t.rotuloCompetencia(mes.competencia) } : null,
    carregandoNotas: !!notas && !notas.carregadas,
    /** as notas do mês escolhido (null = o "Baixar XMLs" ainda não foi feito para o mês) */
    resumo: resumo ? {
      quantidade: resumo.quantidade, canceladas: resumo.canceladas,
      clientes: (curva?.linhas || []).slice(0, 8).map(c => ({ ...c, barra: pct(c.valor, curva?.linhas[0]?.valor || 0) })),
      outrosClientes: Math.max(0, resumo.porCliente.length - 8),
      cfops: resumo.porCfop.slice(0, 8).map(c => ({ ...c, pct: pct(c.valor, totalDoResumo) })),
    } : null,
    /** as maiores notas do mês e a aberta no espelho */
    maioresNotas: maioresNotas.map(n => ({ chave: n.chave, titulo: n.tipo + ' ' + n.numero, data: n.data, para: n.destinatario.nome || 'Consumidor (sem identificação)', valor: n.valor })),
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
