// DP › Configurações em Excel (10/11/2026: "nas config quero que tenha como exportar tudo para excel"): a lista dos
// clientes do DP com todos os parâmetros de cada um, uma coluna por obrigação do mês (Sim/Não, para filtrar no Excel), a
// REINF, a entrega, o agrupamento e se foi mudado no nads. Puro: devolve o cabeçalho e as linhas; a tela faz o .xlsx
// (planilhaXlsx) e baixa.
import type { CelulaDaPlanilha } from './planilha';

/** um cliente do DP como a planilha precisa (o CNPJ/CPF já com a máscara da tela) */
export interface ClienteDaPlanilhaDoDp {
  codigo: number;
  nome: string;
  documento: string;
  enquadramento: string;
  /** o responsável como está na planilha do DP (FABIANA, GUSTAVO.P); vazio = sem responsável */
  responsavel: string;
  movimento: string;
  /** os ids das obrigações que o cliente tem no mês (as da planilha e as categorias criadas no nads) */
  obrigacoes: readonly string[];
  reinfAutorizada: boolean;
  entrega: string;
  agrupamento: string;
  /** mudado nas Configurações do DP (não é mais o da planilha) */
  mudado: boolean;
}

/** o nome do responsável como se escreve: FABIANA → Fabiana; GUSTAVO.P → Gustavo.P; vazio → Sem responsável */
export function nomeDoResponsavelDoDp(r: string): string {
  return r ? r.split('.').map(p => p.charAt(0) + p.slice(1).toLowerCase()).join('.') : 'Sem responsável';
}

/**
 * O cabeçalho e as linhas da planilha das Configurações do DP, na ordem dos clientes recebida (a da tela). As colunas das
 * obrigações seguem a ordem de `obrigacoes` (as da planilha e, depois, as categorias do nads).
 */
export function planilhaDasConfiguracoesDoDp(
  clientes: readonly ClienteDaPlanilhaDoDp[],
  obrigacoes: readonly { id: string; nome: string }[],
): { cabecalho: string[]; linhas: CelulaDaPlanilha[][] } {
  const simOuNao = (b: boolean) => (b ? 'Sim' : 'Não');
  const cabecalho = ['Cód.', 'Cliente', 'CNPJ/CPF', 'Enquadramento', 'Responsável', 'Movimento',
    ...obrigacoes.map(o => o.nome), 'REINF autorizada', 'Entrega', 'Agrupamento', 'Mudado no nads'];
  const linhas = clientes.map(c => [
    c.codigo, c.nome, c.documento, c.enquadramento, nomeDoResponsavelDoDp(c.responsavel), c.movimento,
    ...obrigacoes.map(o => simOuNao(c.obrigacoes.includes(o.id))),
    simOuNao(c.reinfAutorizada), c.entrega, c.agrupamento, simOuNao(c.mudado),
  ]);
  return { cabecalho, linhas };
}
