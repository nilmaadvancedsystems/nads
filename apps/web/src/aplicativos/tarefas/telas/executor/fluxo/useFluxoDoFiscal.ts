// ViewModel do fluxo operacional do Fiscal (23/10/2026: o documento "FLUXO OPERACIONAL DO DEPARTAMENTO FISCAL", "pode
// substituir o atual"): a empresa e a competência da rota, o fluxo do regime (core tarefas.fluxoDoRegime), as etapas do
// mês com os subprocessos (tarefas.fluxoDoMes: o status, o responsável, se a etapa está liberada) e as ações — mudar o
// status (a própria pessoa passa por todos) e o responsável de cada subprocesso, gravados na rotina do mês. O painel de
// cada subprocesso é o mesmo do executor antigo (usePainelDoFiscal).
import { demo, empresas, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEmpresa } from '../../../casca/navegacao';
import { useDepartamentoDaTela } from '../../../casca/departamento';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useCadastro, useExecucoesDoPeriodo, useRegimesDoEntregas, useRepo } from '../../../dados/repo';
import { useModoDesenvolvedor } from '../../../../../comum/modoDesenvolvedor';
import { usePainelDoFiscal } from '../usePainelDoFiscal';
import { implantarNotasFiscaisDeTeste } from '../../../../concilia-ai/importadosNaEtapa';

export function useFluxoDoFiscal(rotaEmpresa: string, competencia: string) {
  useRegimesDoEntregas();
  const repo = useRepo();
  const navegar = useNavigate();
  const { toast } = useRetorno();
  const op = useOperador().operador;
  const [dev] = useModoDesenvolvedor();
  const { lista } = useDepartamentoDaTela();
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rotaEmpresa);
  const regime = empresa ? t.regimeDaEmpresa(empresa.codigo) : '';
  const fluxo = t.fluxoDoRegime(regime);
  const { porMes, carregada } = useExecucoesDoPeriodo([competencia], 'fiscal');
  const ex = empresa ? (porMes[0]?.execucoes.find(e => e.empresa === empresa.nome) || t.execucaoNova(empresa.nome, empresa.codigo, competencia, 'fiscal')) : null;
  const etapas = fluxo ? t.fluxoDoMes(fluxo, ex, competencia) : [];
  const resumo = t.resumoDoFluxo(etapas);
  // as fases da lateral (poucas: 23/10/2026, "todos os menus têm muita informação"); dentro da fase, uma etapa aberta por vez
  const fases = fluxo ? t.fasesDoMes(fluxo, etapas) : [];
  const [faseEscolhida, setFaseEscolhida] = useState<number | null>(null);
  const iDaVez = Math.max(0, fases.findIndex(f => !f.concluida));
  const iFase = faseEscolhida != null && fases[faseEscolhida] ? faseEscolhida : fases.some(f => !f.concluida) ? iDaVez : Math.max(0, fases.length - 1);
  const fase = fases[iFase] || null;
  // a etapa aberta: a escolhida (0 = todas fechadas) ou a primeira da fase que falta
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const etapa = escolhida === 0 ? null : (fase?.etapas.find(e => e.n === escolhida) || fase?.etapas.find(e => !e.concluida) || null);
  const [aberto, setAberto] = useState('');
  // o responsável de sempre: o do Fiscal no Cadastro da empresa; as opções: quem é do Fiscal (ou tem o papel dele)
  const cadastro = useCadastro(empresa?.nome || '', empresa?.codigo ?? null).cadastro;
  const responsavelDaEmpresa = cadastro?.responsaveis?.fiscal || '';
  const equipe = useAcesso().equipe();
  const pessoas = equipe.lista.filter(p => p.ativo && (p.departamento === 'fiscal' || (p.papeis as string[]).includes('fiscal'))).map(p => p.nome)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const painel = usePainelDoFiscal(empresa?.nome || '', empresa?.codigo != null ? String(empresa.codigo) : '', competencia, [competencia]);
  const quem = op?.nome || '';
  // o responsável de cada subprocesso sem escolher (23/10/2026: "tenho que ficar colocando responsável em todos?"): o do
  // Fiscal da empresa no Cadastro; sem ele, quem está trabalhando. Escolher só quando for outra pessoa
  const responsavelPadrao = responsavelDaEmpresa || quem;
  const responsavelDe = (s: { responsavel: string }) => s.responsavel || responsavelPadrao;
  // o responsável da etapa: o que a maioria dos subprocessos tem; a linha só mostra quando é outro (23/10/2026: "tem muita informação aqui")
  const contagem = new Map<string, number>();
  for (const sub of fase?.etapas.flatMap(e => e.subprocessos) || []) contagem.set(responsavelDe(sub), (contagem.get(responsavelDe(sub)) || 0) + 1);
  const daMaioria = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || responsavelPadrao;

  const gravar = (r: { execucao: t.Execucao; evento: t.Evento }) => {
    if (dev) { toast('Modo desenvolvedor: nada é gravado.'); return; }
    repo.gravar(r.execucao, r.evento);
  };
  return {
    carregando: !carregada,
    empresa: empresa ? { nome: empresa.nome, codigo: empresa.codigo, rota: rotaEmpresa } : null,
    regime,
    fluxo,
    competencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    etapas,
    resumo,
    fases: fases.map((f, i) => ({ ...f, ativa: i === iFase })),
    fase,
    escolherFase: (i: number) => { setFaseEscolhida(i); setEscolhida(null); setAberto(''); },
    etapa,
    /** abre a etapa (e fecha a que estava aberta); clicar na aberta fecha */
    abrirEtapa: (n: number) => { setEscolhida(etapa?.n === n ? 0 : n); setAberto(''); },
    gruposDe: (e: t.EtapaNoMes) => t.gruposDaEtapa(e),
    aberto,
    abrir: (id: string) => setAberto(a => (a === id ? '' : id)),
    pessoas,
    responsavelDaEmpresa,
    responsavelPadrao,
    /** o responsável da etapa (o da maioria dos subprocessos) */
    responsavelDaEtapaAtual: daMaioria,
    /** o responsável do subprocesso só quando é outro que não o da etapa (para mostrar na linha) */
    outroResponsavel: (s: { responsavel: string }) => (responsavelDe(s) !== daMaioria ? responsavelDe(s) : ''),
    painel,
    valores: ex?.valores || {},
    informar(chave: string, valor: number) {
      if (!ex || dev) return;
      const r = t.informarValor(ex, 'fluxo', chave, valor, quem, new Date());
      repo.gravar(r.execucao, r.evento);
    },
    /** o relatório do início e do fim (os mesmos painéis do executor antigo): o regime e os subprocessos do mês */
    relatorio: {
      regime,
      etapas: etapas.flatMap(e => e.subprocessos.map(s => ({
        id: s.id, nome: s.nome, secao: e.n + '. ' + e.nome,
        situacao: (s.status === 'nao-aplicavel' ? 'dispensada' : s.encerrado ? 'feita' : 'pendente') as t.SituacaoEtapa, por: s.por, em: s.em,
      }))),
    },
    mudarStatus(sub: string, status: t.StatusDoSubprocesso, observacao = '') {
      if (!ex) return;
      gravar(t.definirStatus(ex, sub, status, quem, new Date(), observacao, responsavelPadrao));
    },
    /** a caixinha: um clique conclui; de novo, volta para Pendente */
    alternar(sub: string, encerrado: boolean) {
      if (!ex) return;
      gravar(t.definirStatus(ex, sub, encerrado ? 'pendente' : 'concluido', quem, new Date(), '', responsavelPadrao));
    },
    /** o "Concluir a etapa": tudo o que falta na etapa fica Concluído, numa gravação só */
    concluirEtapa(n: number) {
      const etapa = etapas.find(e => e.n === n);
      if (!ex || !etapa) return;
      const faltam = etapa.subprocessos.filter(s => !s.encerrado).map(s => s.id);
      if (faltam.length) gravar(t.definirStatusDeVarios(ex, faltam, 'concluido', quem, new Date(), responsavelPadrao));
    },
    /** o "trocar" do responsável: todos os subprocessos da fase */
    trocarResponsavelDaEtapa(nome: string) {
      if (!ex || !fase) return;
      gravar(t.definirResponsavelDeVarios(ex, fase.etapas.flatMap(e => e.subprocessos.map(s => s.id)), nome, quem, new Date()));
    },
    mudarResponsavel(sub: string, nome: string) {
      if (!ex) return;
      gravar(t.definirResponsavelDoSubprocesso(ex, sub, nome, quem, new Date()));
    },
    /** os dados de teste (o ⚡ do executor antigo): só no modo desenvolvedor ou na empresa de teste */
    testes: empresa && (dev || demo.ehEmpresaDemo(empresa.nome)) ? demo.OPCOES_FISCAIS_DE_TESTE.map(o => ({ rotulo: o.rotulo, id: o.id })) : [],
    usarTeste(id: string) {
      if (!empresa) return;
      if (implantarNotasFiscaisDeTeste(empresa.nome, [competencia], id)) toast(id === 'apagar-fiscal' ? 'Notas de teste apagadas.' : 'Notas de teste importadas na Conferência da empresa.');
      else toast('Os dados de teste só valem no modo desenvolvedor ou na empresa de teste.');
    },
    sair: () => navegar(lista + '?competencia=' + competencia),
    abrirEmpresa: () => { if (empresa) navegar(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), competencia)); },
  };
}

export type VmFluxoDoFiscal = ReturnType<typeof useFluxoDoFiscal>;
