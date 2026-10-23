// ViewModel do faturamento detalhado de um cliente (Fiscal › Faturamento; 22/10/2026: "quando eu clique no cliente abra
// um faturamento detalhado"): os números do período, o mês a mês (a NF-e e a NFC-e separadas, as notas, as canceladas e a
// variação; core tarefas.sieg.mesesDoDetalhe) e, no mês escolhido, para quem vendeu e por CFOP, pelas notas do "Baixar
// XMLs" (core tarefas.sieg.resumoDasEmitidas). Sem os XMLs do mês, diz onde baixar.
import { tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useSieg } from '../../../dados/repo';

const f = t.sieg;

export function useDetalheDoFaturamento(codigo: number, competencias: readonly string[]) {
  const sieg = useSieg();
  const meses = f.mesesDoDetalhe(competencias, c => sieg.doMes(c).saidas.get(String(codigo)));
  const comDado = meses.filter(m => m.total != null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const mes = (escolhido && meses.find(m => m.competencia === escolhido && m.total != null)) || comDado[comDado.length - 1] || null;
  const notas = mes ? sieg.notas(String(codigo), mes.competencia) : null;
  const resumo = notas?.dados ? f.resumoDasEmitidas(notas.dados) : null;
  const total = comDado.reduce((s, m) => s + (m.total || 0), 0);
  const maior = comDado.reduce<t.sieg.MesDoDetalhe | null>((a, m) => (!a || (m.total || 0) > (a.total || 0) ? m : a), null);
  const totalDoResumo = resumo?.valor || 0;
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
    meses: [...meses].reverse().map(m => ({ ...m, rotulo: f.mesCurto(m.competencia), escolhido: m.competencia === mes?.competencia })),
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
  };
}
