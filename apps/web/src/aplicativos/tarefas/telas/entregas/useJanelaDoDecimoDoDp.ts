// ViewModel da janela "13º do DP" da Rota (11/11/2026: "quero que as empresas do dp que estão como office boy e estão com o
// 13 salario pronto suba para a rota", "no modulo do entregas como um botão"). As empresas do DP com folha que recebem pelo
// office boy (a entrega do DP, que se muda nas Configurações do DP), a parcela de cada uma na tabela do 13º (DP ›
// Obrigações › 13º salário: pronta = todas as bolinhas da parcela) e o que já está na rota ou já foi entregue; "Pôr na
// rota" grava uma parada por empresa que falta (entregas.entregaDoDecimo). A regra fica no core (decimoParaARota).
import { entregas, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useEntregasDeDocumentos, useExecucoes } from '../../dados/repo';
import { useClientesDoDp } from '../dp/useClientesDoDp';

const ROTULO: Record<entregas.SituacaoDoDecimo, { rotulo: string; tom: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  vai: { rotulo: 'Vai para a rota', tom: 'warn' },
  'na-rota': { rotulo: 'Já está na rota', tom: 'neutral' },
  entregue: { rotulo: 'Já entregue', tom: 'ok' },
  'sem-cadastro': { rotulo: 'Sem cadastro no Entregas', tom: 'bad' },
  'falta-marcar': { rotulo: 'Falta marcar no 13º', tom: 'neutral' },
};

export function useJanelaDoDecimoDoDp(fechar: () => void) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const doMesAgora = t.parcelaDoMes() || { ano: new Date().getFullYear(), parcela: '1' as const };
  const [parcela, setParcela] = useState<t.ParcelaDoDecimo>(doMesAgora.parcela);
  const ano = doMesAgora.ano;
  const { competencia } = entregas.documentoDoDecimo(parcela, ano);
  // o DP: a entrega e o movimento como valem em dezembro (quem tem empregado tem 13º), e as marcas do 13º do ano
  const doDp = useClientesDoDp(ano + '-12');
  const { execucoes, carregada } = useExecucoes(t.competenciaDoDecimo(ano), 'dp');
  // o Entregas: todos os clientes (o office boy pode ainda não ser cliente marcado do Entregas) e as entregas do mês
  const clientes = repo.clientes();
  const doMes = repo.doMes(competencia);
  useEffect(() => { void repo.garantirTodosOsClientes(); }, [repo]);
  const [gravando, setGravando] = useState(false);

  const linhas = useMemo(() => {
    const porNome = new Map(execucoes.map(e => [e.empresa, e]));
    const empresasDoDecimo = doDp.clientes.filter(c => c.movimento === 'Folha' && c.entrega === 'Office boy')
      .map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, pronta: t.parcelaDoDecimoPronta(porNome.get(c.nomeNaTela) || null, parcela) }));
    return entregas.decimoParaARota({ parcela, ano, empresas: empresasDoDecimo, clientes: clientes.lista, doMes: doMes.lista });
  }, [execucoes, doDp.clientes, parcela, ano, clientes.lista, doMes.lista]);
  const vao = linhas.filter(l => l.situacao === 'vai' && l.cliente);
  const carregando = !carregada || !doDp.carregado || !clientes.carregada || !doMes.carregada;

  return {
    carregando,
    erro: doMes.erro || clientes.erro,
    titulo: '13º do DP',
    sub: entregas.documentoDoDecimo(parcela, ano).tipo + ' · ' + entregas.rotuloDaCompetencia(competencia) + ' — as empresas do DP com folha que recebem pelo office boy',
    parcela, setParcela,
    parcelas: t.PARCELAS_DO_13.map(p => ({ valor: p.id as t.ParcelaDoDecimo, rotulo: p.rotulo + ' · ' + p.mes })),
    linhas: linhas.map(l => ({ chave: String(l.codigo), nome: l.nome, ...ROTULO[l.situacao] })),
    contagem: (s: entregas.SituacaoDoDecimo) => linhas.filter(l => l.situacao === s).length,
    quantasVao: vao.length,
    gravando,
    fechar,
    async porNaRota() {
      if (gravando || !vao.length) return;
      setGravando(true);
      let foram = 0, noAparelho = 0;
      const falharam: string[] = [];
      for (const l of vao) {
        try {
          const { resultado } = await repo.registrar(entregas.entregaDoDecimo(l.cliente as entregas.ClienteDaRota, parcela, ano), []);
          foram++;
          if (resultado === 'aparelho') noAparelho++;
        } catch { falharam.push(l.nome); }
      }
      setGravando(false);
      if (foram) retorno.aviso({ tom: 'ok', titulo: foram + (foram === 1 ? ' empresa foi' : ' empresas foram') + ' para a rota com o 13º.' + (noAparelho ? ' ' + noAparelho + ' ficaram no aparelho e sobem quando voltar o sinal.' : '') });
      if (falharam.length) retorno.aviso({ tom: 'erro', titulo: 'Não consegui pôr na rota: ' + falharam.join(', ') + '.' });
      if (!falharam.length) fechar();
    },
  };
}
