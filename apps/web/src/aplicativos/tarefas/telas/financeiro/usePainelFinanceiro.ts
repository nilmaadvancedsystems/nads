// ViewModel de Financeiro › Painel (22/10/2026: "no financeiro, faça um dashboard de entradas, saídas dentre outros"):
// o período (este mês, mês passado, este ano), os números do período (entradas, saídas, resultado e o saldo de hoje),
// para onde vai e de onde vem o dinheiro (por conta do plano), os honorários do mês passado (recebidos e em aberto) e as
// notas fiscais do período. O extrato do banco importado (23/10/2026: "um importador de extrato que vai trazer os dados e
// informações para o dashboard inicial") entra somado nas entradas e saídas (cada banco como uma linha em "de onde veio"
// e "para onde foi") e dá o saldo do banco; o mês a mês saiu (23/10/2026: "remova essa parte de mês a mês").
import { financeiro, formatos, type nfse } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useCaixa, useHonorarios, useNfse } from '../../dados/repo';
import { hoje } from './formatosDaNota';

export type PeriodoDoPainel = 'este-mes' | 'mes-passado' | 'este-ano';
export const PERIODOS_DO_PAINEL: { valor: PeriodoDoPainel; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' }, { valor: 'mes-passado', rotulo: 'Mês passado' }, { valor: 'este-ano', rotulo: 'Este ano' },
];
/** as notas que contam como emitidas (autorizadas e não canceladas) */
const emitida = (n: nfse.NotaFiscal) => n.status === 'autorizada';

export function usePainelFinanceiro() {
  const caixa = useCaixa();
  const lanc = caixa.lancamentos();
  const plano = caixa.plano();
  const hon = useHonorarios();
  const contratos = hon.contratos();
  const recebimentos = hon.recebimentos();
  const notas = useNfse().notas();
  const extrato = caixa.extrato();
  const importacoes = caixa.importacoes();
  const navegar = useNavigate();
  const [periodo, setPeriodo] = useState<PeriodoDoPainel>('este-mes');
  const dia = hoje();
  const { de, ate } = financeiro.periodoPronto(periodo, dia);
  // o extrato do banco como lançamentos de uma "conta" por banco (Banco Sicoob…), para entrar nas contas do painel
  const doBanco = useMemo(() => extrato.lista.map((l): financeiro.LancamentoDeCaixa => (
    { id: l.id, data: l.data, descricao: l.historico, valor: l.valor, tipo: l.tipo, conta: 'banco:' + l.banco, origem: 'nads', criadoEm: '', criadoPor: '' })), [extrato.lista]);
  const contas = useMemo(() => {
    const m = new Map(plano.lista.map(c => [c.id, c]));
    for (const b of new Set(extrato.lista.map(l => l.banco))) {
      m.set('banco:' + b, { id: 'banco:' + b, codigo: 'Banco', descricao: b, tipo: 'ATIVO', nivel: 1, pai: null, ativo: true, movimentavel: true });
    }
    return m;
  }, [plano.lista, extrato.lista]);
  const todos = useMemo(() => [...lanc.lista, ...doBanco], [lanc.lista, doBanco]);
  const resumo = useMemo(() => financeiro.resumoDoPeriodo(lanc.lista, de, ate), [lanc.lista, de, ate]);
  const banco = useMemo(() => financeiro.resumoDoPeriodo(doBanco, de, ate), [doBanco, de, ate]);
  const saldos = financeiro.saldosNoBanco(importacoes.lista);
  const soma = (...v: number[]) => Math.round(v.reduce((s, x) => s + Math.round(x * 100), 0)) / 100;
  const temBanco = extrato.lista.length > 0;
  const competencia = financeiro.competenciaAnterior(dia);
  const honorarios = useMemo(() => financeiro.situacaoDaCompetencia(contratos.lista, recebimentos.lista, competencia), [contratos.lista, recebimentos.lista, competencia]);
  const notasDoPeriodo = notas.lista.filter(n => emitida(n) && n.servico.competencia >= de && n.servico.competencia <= ate);
  return {
    carregando: !lanc.carregada || !plano.carregada,
    exemplos: caixa.exemplos,
    periodo, setPeriodo, periodos: PERIODOS_DO_PAINEL,
    /** o Caixa e o banco somados; a dica diz quanto é de cada um (só quando há extrato importado) */
    numeros: {
      entradas: soma(resumo.entradas, banco.entradas), saidas: soma(resumo.saidas, banco.saidas),
      resultado: soma(resumo.entradas, banco.entradas, -resumo.saidas, -banco.saidas),
      saldo: financeiro.saldoDeHoje(lanc.lista, dia),
      saldoBanco: saldos.length ? soma(...saldos.map(s => s.saldo)) : null,
      lancamentos: resumo.lancamentos.length + banco.lancamentos.length,
    },
    dicas: temBanco ? {
      entradas: 'Caixa ' + formatos.reais(resumo.entradas) + ' · Banco ' + formatos.reais(banco.entradas),
      saidas: 'Caixa ' + formatos.reais(resumo.saidas) + ' · Banco ' + formatos.reais(banco.saidas),
    } : null,
    saidasPorConta: financeiro.totaisPorConta(todos, 'S', de, ate, contas),
    entradasPorConta: financeiro.totaisPorConta(todos, 'E', de, ate, contas),
    /** o banco: o saldo de cada um (no fim do último extrato) e a última importação */
    bancos: saldos.map(s => ({ ...s, saldoBr: formatos.reais(s.saldo), ateBr: s.ate.slice(8, 10) + '/' + s.ate.slice(5, 7) + '/' + s.ate.slice(0, 4) })),
    ultimaImportacao: importacoes.lista[0] ? { banco: importacoes.lista[0].banco, quando: new Date(importacoes.lista[0].importadoEm).toLocaleDateString('pt-BR') } : null,
    honorarios: { competencia: financeiro.competenciaBr(competencia), carregado: contratos.carregada && recebimentos.carregada, ...honorarios, pct: honorarios.previsto ? Math.round((honorarios.recebido / honorarios.previsto) * 100) : 0 },
    notas: { carregada: notas.carregada, quantas: notasDoPeriodo.length, valor: notasDoPeriodo.reduce((s, n) => s + Math.round(n.servico.valor * 100), 0) / 100 },
    ir: (pagina: 'caixa' | 'honorarios' | 'notas' | 'extrato') => navegar(caminhoDaPagina('financeiro', pagina)),
  };
}
