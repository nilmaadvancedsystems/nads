// ViewModel da página de uma empresa na Tarefas (os insights dela): na competência escolhida, a situação,
// quantas etapas, a etapa atual, quem mexeu por último e cada etapa com quem fez, quando e o motivo de
// parar; o histórico dos últimos meses; e o que o Extrator tem guardado dela. Daqui, o botão abre o executor.
import { empresas, extrator, tarefas as t } from '@nads/core';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { extratorDaEmpresa } from '../../dados/fonte';
import { useRepo, useVersaoDoRepo } from '../../dados/repo';
import { caminhoDaEmpresa, caminhoDaPagina, caminhoDoExecutor } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { ACAO } from '../empresas/andamento';

/** Quantos meses o histórico mostra. */
const MESES_HISTORICO = 6;

const ROTULO_ETAPA: Record<t.SituacaoEtapa, string> = { pendente: 'A fazer', feita: 'Feita', dispensada: 'Não se aplica', interrompida: 'Parada' };
/** A cor da bolinha de cada etapa (as mesmas classes da situação da empresa). */
const COR_ETAPA: Record<t.SituacaoEtapa, t.SituacaoGeral> = { pendente: 'nao-iniciada', feita: 'concluida', dispensada: 'concluida', interrompida: 'parada' };

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Quem mexeu por último na execução, e quando. */
function ultimoToque(ex: t.Execucao | null): { por: string; em: string } | null {
  const estados = ex ? Object.values(ex.etapas) : [];
  return estados.length ? estados.reduce((a, b) => (b.em > a.em ? b : a)) : null;
}

export function useEmpresa(rota: string) {
  const repo = useRepo();
  useVersaoDoRepo();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const op = useOperador().operador as Operador;
  const rotina = op.departamento === 'contabil' ? t.ROTINA_CONTABIL : null;
  const competencias = t.competenciasRecentes(new Date(), 12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const lote = (params.get('lote') || '').includes('..') && t.competenciasDoPeriodo(params.get('lote') as string).length > 1 ? (params.get('lote') as string) : '';
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rota);
  const dep = rotina?.departamento || op.departamento;
  const agora = new Date();

  // o que o Extrator guardou da empresa (uma leitura ao abrir a página)
  const [arquivos, setArquivos] = useState<extrator.ArquivoImportado[] | null>(null);
  useEffect(() => {
    if (!empresa) return;
    let vivo = true;
    setArquivos(null);
    extratorDaEmpresa(empresa.nome).then(e => { if (vivo) setArquivos(e.arquivos); }, () => { if (vivo) setArquivos([]); });
    return () => { vivo = false; };
  }, [empresa]);

  const execucaoDe = (c: string) => (empresa && repo.execucoes(c, dep).find(e => e.empresa === empresa.nome)) || null;
  const ex = execucaoDe(competencia);
  const carregando = !repo.carregada(competencia, dep);

  if (!empresa || !rotina) {
    return { pronta: false as const, empresa, departamento: op.departamento };
  }

  const situacao = t.situacaoGeral(ex, rotina);
  const p = t.progresso(ex, rotina);
  const proxima = t.proximaEtapa(ex, rotina);
  const ultimo = ultimoToque(ex);

  const etapas = rotina.etapas.map((e, i) => {
    const est = t.estadoDa(ex, e.id);
    const s = t.situacaoDa(ex, e.id);
    const motivo = est?.objecao ? (e.objecoes.find(o => o.id === est.objecao)?.texto || (est.objecao === 'outro' ? 'Outro motivo' : est.objecao)) : '';
    return {
      id: e.id, n: i + 1, nome: e.nome, rotulo: ROTULO_ETAPA[s], cor: COR_ETAPA[s], atual: proxima?.id === e.id,
      por: est?.por || '', quando: est ? t.quandoFoi(est.em, agora) : '', quandoCompleto: est ? dataHora(est.em) : '',
      motivo: [motivo, est?.observacao].filter(Boolean).join(' — '),
    };
  });

  // histórico: a situação nos últimos meses (a competência aberta fica marcada)
  const historico = competencias.slice(0, MESES_HISTORICO).map(c => {
    const e = execucaoDe(c);
    const s = t.situacaoGeral(e, rotina);
    const u = ultimoToque(e);
    return {
      competencia: c, rotulo: t.rotuloCompetencia(c), aberta: c === competencia, carregando: !repo.carregada(c, dep),
      situacao: s, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[s], feitas: t.progresso(e, rotina).concluidas,
      quando: u ? t.quandoFoi(u.em, agora) : '', quandoCompleto: u ? dataHora(u.em) : '',
    };
  });

  const extratos = (arquivos || []).slice().sort((a, b) => b.importadoEm.localeCompare(a.importadoEm)).map(a => ({
    id: a.id, lado: a.lado === 'banco' ? 'Extrato' : 'Sistema', nome: a.nome, qtd: a.lancamentos.length,
    periodo: extrator.rotuloPeriodo(extrator.periodo(a.lancamentos)), quando: t.quandoFoi(a.importadoEm, agora), quandoCompleto: dataHora(a.importadoEm),
  }));

  return {
    pronta: true as const, empresa, departamento: op.departamento, carregando, competencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao],
    feitas: p.concluidas, total: p.total,
    etapaAtual: situacao === 'nao-iniciada' || !proxima ? '' : proxima.nome,
    paradas: etapas.filter(e => e.cor === 'parada').length,
    ultimo: ultimo ? { por: ultimo.por, quando: t.quandoFoi(ultimo.em, agora), quandoCompleto: dataHora(ultimo.em) } : null,
    etapas, historico,
    extratos, carregandoExtratos: arquivos === null,
    acao: ACAO[situacao],
    // começa no que está escolhido no seletor: o Em lote, ou a competência
    abrirExecutor: () => navegar(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), lote || competencia)),
    lote, setLote: (l: string) => setParams({ competencia, lote: l }),
    abrirCompetencia: (c: string) => navegar(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), c)),
    voltar: () => navegar(caminhoDaPagina('minhas-empresas', 'empresas') + '?competencia=' + competencia),
  };
}
