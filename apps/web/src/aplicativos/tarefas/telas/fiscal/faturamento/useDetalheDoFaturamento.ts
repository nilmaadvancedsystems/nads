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
  return {
    numeros: {
      total,
      media: comDado.length ? total / comDado.length : 0,
      mesesComDado: comDado.length,
      maior: maior ? { rotulo: t.rotuloCompetencia(maior.competencia), valor: maior.total || 0 } : null,
      notas: comDado.reduce((s, m) => s + m.notas, 0),
    },
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
      clientes: resumo.porCliente.slice(0, 8).map(c => ({ ...c, pct: pct(c.valor, resumo.porCliente[0]?.valor || 0) })),
      outrosClientes: Math.max(0, resumo.porCliente.length - 8),
      cfops: resumo.porCfop.slice(0, 8).map(c => ({ ...c, pct: pct(c.valor, totalDoResumo) })),
    } : null,
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
