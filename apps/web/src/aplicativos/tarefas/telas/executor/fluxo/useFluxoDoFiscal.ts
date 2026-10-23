// ViewModel do fluxo operacional do Fiscal (23/10/2026: o documento "FLUXO OPERACIONAL DO DEPARTAMENTO FISCAL", "pode
// substituir o atual"): a empresa e a competência da rota, o fluxo do regime (core tarefas.fluxoDoRegime), as etapas do
// mês com os subprocessos (tarefas.fluxoDoMes: o status, o responsável, se a etapa está liberada) e as ações — mudar o
// status (a própria pessoa passa por todos) e o responsável de cada subprocesso, gravados na rotina do mês. O painel de
// cada subprocesso é o mesmo do executor antigo (usePainelDoFiscal).
import { empresas, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEmpresa } from '../../../casca/navegacao';
import { useDepartamentoDaTela } from '../../../casca/departamento';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useCadastro, useExecucoesDoPeriodo, useRegimesDoEntregas, useRepo } from '../../../dados/repo';
import { useModoDesenvolvedor } from '../../../../../comum/modoDesenvolvedor';
import { usePainelDoFiscal } from '../usePainelDoFiscal';

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
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const etapa = etapas.find(e => e.n === escolhida) || resumo.daVez || etapas[etapas.length - 1] || null;
  const [aberto, setAberto] = useState('');
  // o responsável de sempre: o do Fiscal no Cadastro da empresa; as opções: quem é do Fiscal (ou tem o papel dele)
  const cadastro = useCadastro(empresa?.nome || '', empresa?.codigo ?? null).cadastro;
  const responsavelDaEmpresa = cadastro?.responsaveis?.fiscal || '';
  const equipe = useAcesso().equipe();
  const pessoas = equipe.lista.filter(p => p.ativo && (p.departamento === 'fiscal' || (p.papeis as string[]).includes('fiscal'))).map(p => p.nome)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const painel = usePainelDoFiscal(empresa?.nome || '', empresa?.codigo != null ? String(empresa.codigo) : '', competencia, [competencia]);
  const quem = op?.nome || '';

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
    etapa,
    escolherEtapa: (n: number) => { setEscolhida(n); setAberto(''); },
    aberto,
    abrir: (id: string) => setAberto(a => (a === id ? '' : id)),
    pessoas,
    responsavelDaEmpresa,
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
      gravar(t.definirStatus(ex, sub, status, quem, new Date(), observacao));
    },
    mudarResponsavel(sub: string, nome: string) {
      if (!ex) return;
      gravar(t.definirResponsavelDoSubprocesso(ex, sub, nome, quem, new Date()));
    },
    /** todos os subprocessos da etapa que ainda estão pendentes ficam com este responsável */
    responsavelDaEtapa(nome: string) {
      if (!ex || !etapa) return;
      let atual = ex;
      const subs = etapa.subprocessos.filter(s => !s.responsavel);
      if (!subs.length) return;
      let ultimo: t.Evento | null = null;
      for (const s of subs) { const r = t.definirResponsavelDoSubprocesso(atual, s.id, nome, quem, new Date()); atual = r.execucao; ultimo = r.evento; }
      if (ultimo) gravar({ execucao: atual, evento: { ...ultimo, observacao: nome + ' (' + subs.length + ' subprocessos)' } });
    },
    sair: () => navegar(lista + '?competencia=' + competencia),
    abrirEmpresa: () => { if (empresa) navegar(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), competencia)); },
  };
}

export type VmFluxoDoFiscal = ReturnType<typeof useFluxoDoFiscal>;
