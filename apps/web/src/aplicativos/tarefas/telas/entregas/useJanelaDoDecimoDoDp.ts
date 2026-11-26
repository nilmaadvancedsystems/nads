// ViewModel da janela "13º do DP" da Rota (11/11/2026: "quero que as empresas do dp que estão como office boy e estão com o
// 13 salario pronto suba para a rota", "no modulo do entregas como um botão"). As empresas do DP com folha que recebem pelo
// office boy (a entrega do DP, que se muda nas Configurações do DP), a parcela de cada uma na tabela do 13º (DP ›
// Obrigações › 13º salário; desde 26/11/2026, pronta = os Recibos e a Folha marcados, o papel que o office boy leva) e o que já está na rota ou já foi entregue; "Pôr na
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

/** O que a janela põe na rota: a folha do mês ou uma parcela do 13º. */
export type DocumentoDaJanela = 'folha' | t.ParcelaDoDecimo;

export function useJanelaDoDecimoDoDp(fechar: () => void) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const doMesAgora = t.parcelaDoMes();
  const ano = doMesAgora?.ano ?? new Date().getFullYear();
  // a folha do mês (26/11/2026: "quero poder puxar folha de pagamento também"): a do mês que passou, a que se entrega agora
  const competenciaDaFolha = entregas.competenciaAnterior(entregas.competenciaAtual());
  // abre no 13º da época (novembro a janeiro); fora dela, só a folha
  const [escolhido, setEscolhido] = useState<DocumentoDaJanela>(doMesAgora?.parcela ?? 'folha');
  const documento = useMemo(() => (escolhido === 'folha' ? entregas.documentoDaFolha(competenciaDaFolha) : entregas.documentoDoDecimo(escolhido, ano)), [escolhido, competenciaDaFolha, ano]);
  const competencia = documento.competencia;
  // o DP: a entrega e o movimento como valem na competência (no 13º, a de dezembro: quem tem empregado tem 13º) e as marcas
  const doDp = useClientesDoDp(escolhido === 'folha' ? competenciaDaFolha : ano + '-12');
  const { execucoes, carregada } = useExecucoes(escolhido === 'folha' ? competenciaDaFolha : t.competenciaDoDecimo(ano), 'dp');
  // o Entregas: todos os clientes (o office boy pode ainda não ser cliente marcado do Entregas) e as entregas do mês
  const clientes = repo.clientes();
  const doMes = repo.doMes(competencia);
  useEffect(() => { void repo.garantirTodosOsClientes(); }, [repo]);
  const [gravando, setGravando] = useState(false);

  const linhas = useMemo(() => {
    const porNome = new Map(execucoes.map(e => [e.empresa, e]));
    // pronta = só o papel que o office boy leva (26/11/2026: "tem 13 que já tá marcado e não puxa lá"): os Recibos e a Folha
    const pronta = (ex: (typeof execucoes)[number] | null) => (escolhido === 'folha' ? t.folhaProntaParaEntregar(ex) : t.parcelaProntaParaEntregar(ex, escolhido));
    const empresasDoDp = doDp.clientes.filter(c => c.movimento === 'Folha' && c.entrega === 'Office boy')
      .map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, pronta: pronta(porNome.get(c.nomeNaTela) || null) }));
    return entregas.dpParaARota({ documento, empresas: empresasDoDp, clientes: clientes.lista, doMes: doMes.lista });
  }, [execucoes, doDp.clientes, escolhido, documento, clientes.lista, doMes.lista]);
  const vao = linhas.filter(l => l.situacao === 'vai' && l.cliente);
  const carregando = !carregada || !doDp.carregado || !clientes.carregada || !doMes.carregada;
  const ROTULOS: Record<entregas.SituacaoDoDecimo, { rotulo: string; tom: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
    ...ROTULO, 'falta-marcar': { rotulo: escolhido === 'folha' ? 'Falta marcar Recibos e Folha no DP' : 'Falta marcar Recibos e Folha no 13º', tom: 'neutral' },
  };

  return {
    carregando,
    erro: doMes.erro || clientes.erro,
    titulo: 'Folha e 13º do DP',
    sub: documento.tipo + ' · ' + entregas.rotuloDaCompetencia(competencia) + ' — as empresas do DP com folha que recebem pelo office boy, com os Recibos e a Folha marcados',
    escolhido, setEscolhido,
    /** a folha do mês sempre; as parcelas do 13º só na época (novembro a janeiro) */
    opcoes: [
      { valor: 'folha' as DocumentoDaJanela, rotulo: 'Folha · ' + entregas.rotuloDaCompetencia(competenciaDaFolha) },
      ...(doMesAgora ? t.PARCELAS_DO_13.map(p => ({ valor: p.id as DocumentoDaJanela, rotulo: '13º ' + p.rotulo + ' · ' + p.mes })) : []),
    ],
    linhas: linhas.map(l => ({ chave: String(l.codigo), nome: l.nome, ...ROTULOS[l.situacao] })),
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
          const { resultado } = await repo.registrar(entregas.entregaDoDp(l.cliente as entregas.ClienteDaRota, documento), []);
          foram++;
          if (resultado === 'aparelho') noAparelho++;
        } catch { falharam.push(l.nome); }
      }
      setGravando(false);
      if (foram) retorno.aviso({ tom: 'ok', titulo: foram + (foram === 1 ? ' empresa foi' : ' empresas foram') + ' para a rota com ' + (escolhido === 'folha' ? 'a folha.' : 'o 13º.') + (noAparelho ? ' ' + noAparelho + ' ficaram no aparelho e sobem quando voltar o sinal.' : '') });
      if (falharam.length) retorno.aviso({ tom: 'erro', titulo: 'Não consegui pôr na rota: ' + falharam.join(', ') + '.' });
      if (!falharam.length) fechar();
    },
  };
}
