// O andamento das empresas na competência, usado pela lista (Empresas) e pelos números (Insights):
// a competência escolhida (na URL), e para cada empresa as etapas feitas, a situação e a próxima etapa.
import { empresas, formatos, tarefas as t } from '@nads/core';
import { useSearchParams } from 'react-router';
import { useAcesso, useExecucoes, useRegimesDoEntregas, useRepo, useTodosOsCadastros } from '../../dados/repo';
import { useOperador, type Operador } from '../../casca/operador';
import { competenciasDaTela } from '../../casca/navegacao';
import { useDepartamentoDaTela } from '../../casca/departamento';

export const SITUACOES: readonly { valor: t.SituacaoGeral; rotulo: string }[] = [
  { valor: 'parada', rotulo: 'Paradas' },
  { valor: 'em-andamento', rotulo: 'Em andamento' },
  { valor: 'nao-iniciada', rotulo: 'Não iniciadas' },
  { valor: 'concluida', rotulo: 'Concluídas' },
];

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/**
 * Os nomes que valem para a pessoa (a mesma regra de Cadastro › Empresas por responsável): o nome e, com sufixo
 * (Gustavo.S), o nome sem ele, quando ninguém mais da equipe começa assim.
 */
function nomesDaPessoa(pessoa: string, equipe: readonly string[]): string[] {
  const base = pessoa.split('.')[0].trim();
  if (!base || igual(base, pessoa)) return [pessoa];
  const outros = equipe.filter(n => !igual(n, pessoa) && (igual(n, base) || n.toLowerCase().startsWith(base.toLowerCase() + '.')));
  return outros.length ? [pessoa] : [pessoa, base];
}

/** Minhas (só as da pessoa) ou todas (o admin e o diretor podem escolher; ?escopo=todas) */
export type EscopoDasEmpresas = 'minhas' | 'todas';

const ORDEM: Record<t.SituacaoGeral, number> = { parada: 0, 'em-andamento': 1, 'nao-iniciada': 2, concluida: 3 };
export const ACAO: Record<t.SituacaoGeral, string> = { parada: 'Retomar', 'em-andamento': 'Continuar', 'nao-iniciada': 'Iniciar', concluida: 'Ver' };

/**
 * As empresas da pessoa num setor (26/10/2026): ela é a responsável do setor no Cadastro (no Fiscal, sem escolha, o da
 * planilha do DP). A empresa sem responsável no setor não aparece para ninguém em "Minhas" (28/10/2026: "a pessoa não deve
 * ver as empresas que não estão ligadas a ela"); o admin e o diretor a veem em "Todas". Usado por Minhas empresas e pela
 * busca do menu ☰ (27/10/2026: "só é para aparecer as empresas que a pessoa tem").
 */
export function useEmpresasDaPessoa() {
  const op = useOperador().operador as Operador;
  const cadastros = useTodosOsCadastros();
  const equipe = useAcesso().equipe().lista.filter(p => p.ativo).map(p => p.nome);
  const nomes = nomesDaPessoa(op.nome, equipe);
  const responsavelDe = (emp: { nome: string; codigo: number | null }, dep: 'fiscal' | 'contabil') => {
    const r = cadastros.porId.get(formatos.slug(emp.nome))?.responsaveis?.[dep] || '';
    return r || (dep === 'fiscal' ? empresas.clienteDoDp(emp.codigo)?.responsavel || '' : '');
  };
  return {
    /** o admin e o diretor podem ver todas (26/10/2026) */
    podeVerTodas: !!op.admin || op.nivel === 'diretor',
    carregada: cadastros.carregada,
    /** só a empresa em que a pessoa é a responsável do setor (a sem responsável fica de fora) */
    e: (emp: { nome: string; codigo: number | null }, dep: 'fiscal' | 'contabil') => { const r = responsavelDe(emp, dep); return !!r && nomes.some(n => igual(n, r)); },
  };
}

export function useAndamento() {
  useRegimesDoEntregas(); // o regime do Entregas, quando chega
  const repo = useRepo();
  const op = useOperador().operador as Operador;
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  // a rotina da tela: a do Fiscal no módulo Fiscal; senão, a do departamento da pessoa
  const { dep } = useDepartamentoDaTela();
  const rotinaDoDep = t.rotinaDo(dep);
  const { execucoes, carregada } = useExecucoes(competencia, dep);
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));

  // só as empresas da pessoa (26/10/2026: "o minhas empresas tem que aparecer só as empresas da pessoa e tem que mudar
  // dependendo do setor dela"): as que têm ela como responsável do setor no Cadastro (no Fiscal, sem escolha, o da
  // planilha), como em Cadastro › Empresas por responsável. O admin e o diretor podem ver todas (?escopo=todas). O DP não
  // tem responsável por empresa no nads: lista todas.
  const daPessoa = useEmpresasDaPessoa();
  const podeVerTodas = daPessoa.podeVerTodas;
  const escopo: EscopoDasEmpresas = podeVerTodas && params.get('escopo') === 'todas' ? 'todas' : 'minhas';
  // o Contábil sempre com todas, sem o Minhas/Todas (Vitor, 28/10/2026: "sempre vai ser todas por enquanto, ainda não temos
  // a relação"; "pode até remover esse filtro"): só o Fiscal filtra pelo responsável
  const temResponsavel = dep === 'fiscal';
  const filtrar = escopo === 'minhas' && temResponsavel;

  // as empresas da rotina: o DP, os clientes da planilha do DP; o Contábil e o Fiscal, a lista do escritório
  const linhas = rotinaDoDep ? t.empresasDaRotina(dep, repo.listarEmpresas()).filter(emp => !filtrar || daPessoa.e(emp, dep as 'fiscal' | 'contabil')).map(emp => {
    const ex = porNome.get(emp.nome) || null;
    // a rotina da empresa (16/10/2026): no Contábil, a 62 (com o LCDPR) conta 1 etapa só
    const rotina = t.rotinaDaEmpresa(dep, emp.codigo) || rotinaDoDep;
    const p = t.progresso(ex, rotina);
    const situacao = t.situacaoGeral(ex, rotina);
    const proxima = t.proximaEtapa(ex, rotina);
    // a última vez que quem está trabalhando mexeu nesta empresa (para 'Minhas recentes' do Iniciar)
    const minhas = ex ? Object.values(ex.etapas).filter(e => e.por === op.nome).map(e => e.em) : [];
    const mexiEm = minhas.length ? minhas.reduce((x, y) => (y > x ? y : x)) : null;
    return {
      empresa: emp, chave: (emp.codigo ?? '') + emp.nome, codigo: emp.codigo, nome: emp.nome, rota: empresas.rotaDaEmpresa(emp),
      concluidas: p.concluidas, total: p.total, situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao],
      proxima: proxima ? proxima.nome : '—', acao: ACAO[situacao], mexiEm,
      // a etapa em que a empresa está (em branco se ainda não começou ou já terminou)
      etapaAtual: situacao === 'nao-iniciada' || !proxima ? '' : proxima.nome,
      // a última vez que alguém mexeu nesta empresa na competência (de qualquer pessoa)
      ultimaVez: t.ultimaVez(ex),
    };
  }).sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao]) : [];

  /** Muda um parâmetro da URL mantendo os outros (competência, situação). */
  function mudar(chave: string, valor: string) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor); else novo.delete(chave);
    setParams(novo);
  }

  return {
    temRotina: !!rotinaDoDep,
    departamento: op.departamento,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => mudar('competencia', c),
    /** a competência veio no endereço (voltou de outra tela): não pergunta de novo */
    competenciaEscolhida: params.has('competencia'),
    params, setParams, mudar,
    carregando: !carregada || (filtrar && !daPessoa.carregada),
    linhas,
    /** minhas ou todas: quem pode escolher, a escolha e se o setor tem responsável por empresa */
    podeVerTodas: podeVerTodas && temResponsavel,
    escopo,
    setEscopo: (e: EscopoDasEmpresas) => mudar('escopo', e === 'todas' ? 'todas' : ''),
    filtrandoPorResponsavel: filtrar,
    contar: (s: t.SituacaoGeral) => linhas.filter(l => l.situacao === s).length,
  };
}
