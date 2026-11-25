// ViewModel de Prazos › Prazos do mês (plano do Acessórias, ficha E04): numa competência, cada obrigação com prazo de cada
// empresa, com a situação pelo prazo (a fazer, no prazo interno, atrasada, entregue antes/no prazo/com atraso, dispensada),
// o responsável e quem entregou. Por ora só o Fiscal: o Contábil ainda não tem prazos na tabela e o DP trabalha pela tabela
// dele (DP › Início; o dono, 17/11/2026: "dp nao usa rotina como contabil ele usa so tabela"). Só leitura: uma consulta das
// execuções do Fiscal por competência (a mesma de Minhas empresas) e o Cadastro, que o repo já tem.
import { empresas, tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { caminhoDoExecutor } from '../../casca/navegacao';
import { useExecucoes, useRegimesDoEntregas, useRepo } from '../../dados/repo';
import { useEmpresasDaPessoa, useEmpresasPermitidas } from '../empresas/andamento';

type Situacao = t.SituacaoDoPrazo;
/** 'acao' = as que pedem ação (atrasadas e no prazo interno), o padrão; '' = todas */
export type FiltroDeSituacao = Situacao | 'acao' | '';

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const hojeLocal = (d = new Date()) => d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
/** 'aaaa-mm-dd' → 'dd/mm' */
export const diaCurto = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');

export function usePrazosDoMes() {
  useRegimesDoEntregas(); // o regime do Entregas, quando chega (decide as etapas do Simples e do Presumido)
  const repo = useRepo();
  const competencias = useMemo(() => t.competenciasRecentes(new Date(), 6), []);
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [situacao, setSituacao] = useState<FiltroDeSituacao>('acao');
  const [responsavel, setResponsavel] = useState('');
  const [obrigacao, setObrigacao] = useState('');
  const [busca, setBusca] = useState('');
  const { execucoes, carregada } = useExecucoes(competencia, 'fiscal');
  const permitidas = useEmpresasPermitidas();
  const daPessoa = useEmpresasDaPessoa();
  const hoje = hojeLocal();

  const todas = useMemo(() => {
    const lista = permitidas.filtrar(repo.listarEmpresas()).filter(e => e.codigo != null);
    return t.linhasDoMes({
      execucoes, empresas: lista, departamento: 'fiscal', competencia, hoje,
      etapasDaEmpresa: codigo => t.rotinaDaEmpresa('fiscal', codigo)?.etapas || [],
      responsavelDe: e => daPessoa.responsavel(e, 'fiscal'),
    }).sort((a, b) => (a.legal || '').localeCompare(b.legal || '') || a.empresa.localeCompare(b.empresa, 'pt-BR'));
    // daPessoa e permitidas mudam a cada desenho; o que importa para a conta é o que eles leem (o repo e o cadastro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucoes, competencia, hoje, repo.versao(), permitidas.carregada, daPessoa.carregada, daPessoa.noCadastro]);

  const q = busca.trim().toLowerCase();
  const semSituacao = todas.filter(l =>
    (!responsavel || l.responsavel === responsavel) && (!obrigacao || l.etapa === obrigacao)
    && (!q || l.empresa.toLowerCase().includes(q) || String(l.codigo ?? '').includes(q)));
  const linhas = semSituacao.filter(l => !situacao || (situacao === 'acao' ? l.situacao === 'atrasada' || l.situacao === 'prazo-interno' : l.situacao === situacao));
  const contagem = t.contarPrazos(semSituacao);

  return {
    carregando: !carregada || !permitidas.carregada,
    exemplos: repo.exemplos,
    competencia, setCompetencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    hoje,
    linhas: linhas.map(l => ({
      ...l,
      chave: l.codigo + '|' + l.etapa,
      rotulo: t.ROTULO_DA_SITUACAO_DO_PRAZO[l.situacao],
      caminho: caminhoDoExecutor(empresas.rotaDaEmpresa(repo.listarEmpresas().find(e => e.codigo === l.codigo && e.nome === l.empresa) || { nome: l.empresa, codigo: l.codigo, regime: '' }), competencia),
    })),
    total: todas.length,
    contagem,
    filtros: {
      situacao, setSituacao,
      responsavel, setResponsavel,
      responsaveis: [...new Set(todas.map(l => l.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      obrigacao, setObrigacao,
      obrigacoes: [...new Map(todas.map(l => [l.etapa, l.nomeDaEtapa])).entries()].map(([valor, rotulo]) => ({ valor, rotulo })),
      busca, setBusca,
      algum: !!(responsavel || obrigacao || q || situacao !== 'acao'),
      limpar() { setResponsavel(''); setObrigacao(''); setBusca(''); setSituacao('acao'); },
    },
    exportar() {
      const cabecalho = ['Nº', 'Empresa', 'Obrigação', 'Prazo legal', 'Prazo interno', 'Situação', 'Responsável', 'Entregue por', 'Entregue em', 'Prazo a confirmar'];
      const valores = linhas.map(l => [
        l.codigo ?? '', l.empresa, l.nomeDaEtapa, diaCurto(l.legal || ''), diaCurto(l.interno || ''), t.ROTULO_DA_SITUACAO_DO_PRAZO[l.situacao],
        l.responsavel, l.feitaPor, diaCurto(l.feitaEm), l.aConfirmar ? 'sim' : '',
      ]);
      return { bytes: t.planilhaXlsx('Prazos ' + t.rotuloCompetencia(competencia), cabecalho, valores), nome: 'Prazos do mês ' + competencia + '.xlsx' };
    },
  };
}

export type VmPrazosDoMes = ReturnType<typeof usePrazosDoMes>;
