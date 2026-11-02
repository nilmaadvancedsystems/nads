// ViewModel do Fiscal › SIEG (31/10/2026: "coloca uma função de baixar do sieg q tinha na rotina … coloca um módulo la";
// "faz uma visualização mais completa, e também puxe entrada saída etc, tudo que de para puxar do sieg"): a empresa e o mês
// na barra, o painel do SIEG da rotina (as notas do mês, Contar agora e Baixar XMLs pelo robô) e, com os XMLs baixados, tudo
// que o SIEG traz no mês: saídas, entradas, serviços prestados e tomados e CT-e, cada um com o resumo por CFOP/CST/NBS e a
// tabela das notas (com busca; clicar abre o espelho), mais a sequência das saídas. As contas: core tarefas.sieg.painelDoSieg.
// A empresa aberta em Minhas empresas chega já escolhida (?empresa=código).
import { empresas as emp, tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo, useSieg } from '../../../dados/repo';
import { useEmpresasPermitidas } from '../../empresas/andamento';

export type AbaDaTela = t.sieg.AbaDoSieg | 'sequencia';
/** o resumo da aba: por CFOP, por CST (mercadorias) ou por NBS (serviços) */
export type ResumoPor = 'cfop' | 'cst' | 'nbs';
/** quantas notas a tabela mostra de cada vez (o resto pela busca) */
const NA_TABELA = 50;

export function useBaixarDoSieg() {
  const repo = useRepo();
  const sieg = useSieg();
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState<number | null>(() => Number(params.get('empresa')) || null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  const [aba, setAba] = useState<AbaDaTela>('saidas');
  const [resumoPor, setResumoPor] = useState<ResumoPor>('cfop');
  const [buscaDaNota, setBuscaDaNota] = useState('');
  const [vendo, setVendo] = useState('');

  const empresas = useEmpresasPermitidas().filtrar(repo.listarEmpresas()).filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const q = busca.trim();
  const achadas = q ? emp.buscarEmpresas(empresas, q).slice(0, 8) : [];
  const escolher = (e: { codigo: number | string | null }) => { setCodigo(Number(e.codigo)); setBusca(''); setBuscaDaNota(''); };

  const doSieg = empresa ? sieg.notas(String(empresa.codigo), competencia) : null;
  const dados = doSieg?.dados || null;
  const painel = useMemo(() => (dados ? t.sieg.painelDoSieg(dados) : null), [dados]);

  const resumo = painel && aba !== 'sequencia' ? painel.abas[aba] : null;
  const servico = aba === 'prestados' || aba === 'tomados';
  // o resumo escolhido vale para a aba (serviço só tem NBS; CT-e só CFOP)
  const por: ResumoPor = servico ? 'nbs' : aba === 'ctes' ? 'cfop' : resumoPor === 'nbs' ? 'cfop' : resumoPor;
  const achadasDaTabela = resumo ? resumo.linhas.filter(l => t.sieg.linhaCombina(l, buscaDaNota)) : [];

  const mudarAba = (a: AbaDaTela) => { setAba(a); setBuscaDaNota(''); };

  return {
    exemplos: sieg.exemplos,
    // a empresa e o mês
    empresa: empresa ? { codigo: empresa.codigo as number, nome: empresa.nome } : null,
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); }, achadas, ativo, setAtivo,
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher,
    escolherDestacado() { const e = achadas[ativo]; if (e) escolher(e); },
    trocarEmpresa() { setCodigo(null); },
    competencia, setCompetencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    // o que o SIEG trouxe
    carregando: !!empresa && !!doSieg && !doSieg.carregadas,
    semXml: !!empresa && !!doSieg?.carregadas && !dados,
    painel,
    aba, mudarAba,
    resumo,
    servico,
    resumoPor: por, setResumoPor,
    grupos: resumo ? (por === 'cst' ? resumo.porCst : por === 'nbs' ? resumo.porNbs : resumo.porCfop) : [],
    buscaDaNota, setBuscaDaNota,
    notas: achadasDaTabela.slice(0, NA_TABELA),
    notasFora: Math.max(0, achadasDaTabela.length - NA_TABELA),
    // a nota aberta no espelho (a NFS-e não tem itens nem chave: não abre)
    vendo: dados && vendo ? t.sieg.notaDaLinha(dados, vendo) : null,
    verNota: (id: string) => setVendo(id),
    fecharNota: () => setVendo(''),
  };
}

export type VmBaixarDoSieg = ReturnType<typeof useBaixarDoSieg>;
