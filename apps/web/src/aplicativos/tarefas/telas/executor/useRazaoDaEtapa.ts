// ViewModel do razão da etapa (o Caixa), no desenho da Importação do banco (Vitor, 05/10/2026): a pessoa importa o XLS
// da conciliação do Alterdata e vê o período todo (o Em lote) ou um mês de cada vez (clica no mês). Para cada mês: os
// lançamentos, o saldo do fim e os pontos de atenção. O CRÉD.LIQ.COBRANÇA põe o Creditor no mês (onImportado).
// O razão fica só na tela (em memória): trocou de etapa, empresa ou período, some.
import { formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';

const dataBR = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);

function linha(l: t.LancamentoDoRazao, i: number) {
  return {
    id: i, data: dataBR(l.data), contrapartida: l.contrapartida, nomeContrapartida: l.nomeContrapartida, historico: l.historico,
    // negativo = débito no Alterdata; saldo positivo = credor
    debito: l.valor < 0 ? formatos.brl(-l.valor) : '', credito: l.valor > 0 ? formatos.brl(l.valor) : '',
    saldo: t.valorComLado(l.saldo), credor: l.saldo > 0,
  };
}

/**
 * chave: empresa, etapa e período (mudou, o razão some). meses: os do período ('aaaa-mm').
 * onImportado: recebe os meses com liquidação de cobrança e devolve aqueles em que o Creditor entrou.
 */
export function useRazaoDaEtapa(chave: string, meses: readonly string[], onImportado: (comLiquidacao: string[]) => string[]) {
  const { aviso } = useRetorno();
  const [lido, setLido] = useState<{ chave: string; arquivo: string; razao: t.RazaoDaConta } | null>(null);
  // o mês aberto (null = o período todo)
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  const atual = lido && lido.chave === chave ? lido : null;
  const doPeriodo = atual ? t.mesesDoRazao(atual.razao, meses) : [];
  const comCreditor = doPeriodo.filter(t.precisaDoCreditor).map(m => m.mes);

  async function importar(f: File | null) {
    if (!f) return;
    let razao: t.RazaoDaConta;
    try {
      razao = t.lerRazaoDoArquivo(await f.arrayBuffer());
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão', texto: e instanceof Error ? e.message : String(e) });
      return;
    }
    const ms = t.mesesDoRazao(razao, meses);
    if (!ms.some(m => m.lancamentos.length)) {
      aviso({ tom: 'erro', titulo: 'O razão não é deste período', texto: 'Nenhum lançamento entre ' + t.rotuloDoPeriodo([...meses]) + '.' });
      return;
    }
    setLido({ chave, arquivo: f.name, razao });
    setMesAberto(null);
    const entrou = onImportado(ms.filter(t.precisaDoCreditor).map(m => m.mes));
    if (entrou.length) aviso({ tom: 'info', titulo: 'O Creditor entrou na rotina', texto: 'Liquidação de cobrança no caixa em ' + entrou.map(t.rotuloCurtoCompetencia).join(', ') + '.' });
  }

  const vistos = mesAberto ? doPeriodo.filter(m => m.mes === mesAberto) : doPeriodo;
  const lancamentos = vistos.flatMap(m => m.lancamentos);
  // os pontos de atenção do que está na tela, juntos por tipo (o período todo ou o mês)
  const porTipo = new Map<t.TipoDeAtencao, t.PontoDeAtencao>();
  for (const p of vistos.flatMap(t.atencoesDoMes)) {
    const j = porTipo.get(p.tipo);
    // no caixa credor, o maior saldo; nos outros, a soma
    const total = !j ? p.total : p.tipo === 'caixa-credor' ? Math.max(j.total, p.total) : Math.round((j.total + p.total) * 100) / 100;
    porTipo.set(p.tipo, j ? { ...j, lancamentos: [...j.lancamentos, ...p.lancamentos], total } : p);
  }
  const ordem = Object.keys(t.ATENCOES_DO_CAIXA);
  const atencoes = [...porTipo.values()].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));

  return {
    importar,
    carregado: !!atual,
    arquivo: atual?.arquivo || '',
    remover: () => setLido(null),
    resumo: atual ? 'Razão: ' + doPeriodo.reduce((n, m) => n + m.lancamentos.length, 0).toLocaleString('pt-BR') + ' lançamentos' : '',
    /** a grade dos meses: o saldo do fim (sem o D; credor com o sinal de menos, em vermelho) e as pendências (Vitor, 05/10/2026) */
    meses: doPeriodo.map(m => ({
      mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), qtd: m.lancamentos.length,
      saldoFinal: (m.saldoFinal > 0 ? '−' : '') + formatos.brl(Math.abs(m.saldoFinal)), credor: m.diasCredor.length > 0,
      atencoes: t.atencoesDoMes(m).reduce((n, p) => n + p.lancamentos.length, 0), creditor: t.precisaDoCreditor(m),
    })),
    mesAberto,
    /** clicar no mês aberto volta para o período todo */
    abrirMes: (m: string) => setMesAberto(a => (a === m ? null : m)),
    /** o período da tarefa ("01/2026 a 08/2026") */
    periodo: t.rotuloDoPeriodo([...meses]),
    mostrando: mesAberto ? t.rotuloCompetencia(mesAberto) : t.rotuloDoPeriodo([...meses]),
    saldoAnterior: vistos.length ? t.valorComLado(vistos[0].saldoInicial) : '',
    lancamentos: lancamentos.map(linha),
    atencoes: atencoes.map(p => ({
      tipo: p.tipo, titulo: p.titulo, dica: p.dica, obrigatorio: p.obrigatorio,
      // "7 lançamentos · 1.234,56"; no caixa credor, "7 dias · maior saldo 1.234,56 C"
      resumo: p.tipo === 'caixa-credor'
        ? p.lancamentos.length + (p.lancamentos.length === 1 ? ' dia' : ' dias') + ' · maior saldo ' + t.valorComLado(p.total)
        : p.lancamentos.length + (p.lancamentos.length === 1 ? ' lançamento' : ' lançamentos') + ' · ' + formatos.brl(p.total),
      linhas: p.lancamentos.map(linha),
    })),
    qtdAtencoes: atencoes.reduce((n, p) => n + p.lancamentos.length, 0),
    /** o razão × o período: só avisa (a etapa trabalha só nos meses do período) */
    cobertura: atual ? (() => {
      const c = t.coberturaDoRazao(atual.razao, meses);
      const r = (ms: string[]) => ms.map(t.rotuloNumericoCompetencia);
      return { faltam: r(c.faltam), aMais: r(c.aMais), liquidacaoFora: r(c.liquidacaoFora) };
    })() : null,
    /** os meses do período com CRÉD.LIQ.COBRANÇA: o Creditor é obrigatório neles */
    creditor: comCreditor.map(t.rotuloNumericoCompetencia),
  };
}

export type RazaoDaEtapa = ReturnType<typeof useRazaoDaEtapa>;
