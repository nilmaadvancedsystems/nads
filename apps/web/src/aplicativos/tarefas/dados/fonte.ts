// De onde vêm os dados da Tarefas (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `tarefas` (ver tarefas.firestore.ts), com a lista
//                de empresas do escritório; o check automático lê o que o Extrator guardou no banco;
//   "exemplos" → a lista de empresas do escritório com andamentos inventados (concluídas, em andamento,
//                paradas), neste navegador; nada vai para o banco. O check lê o Extrator de exemplo.
// Quem está trabalhando: no banco, o login com as contas do Entregas (entregas.firestore.ts, 30/09/2026);
// nos exemplos, a pessoa escolhe o nome na lista da equipe (não há login).
// O repositório e a sessão são criados uma vez, quando alguém abre a Tarefas. O do Cadastro, quando alguém abre o Cadastro.
import { empresas, extrator, tarefas } from '@nads/core';
import { criarSessaoEntregas, type SessaoEntregas } from './entregas.firestore';
import { balanceteNoEntregas, clientesNoEntregas, conferenciaNoBanco, portaCadastroFirestore } from './cadastro.firestore';
import { criarRepoTarefasFirestore, extratorNoBanco, type RepoTarefasFirestore } from './tarefas.firestore';

export const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: tarefas.RepoTarefas | null = null;
let sessao: SessaoEntregas | null = null;

/** O login do Entregas (só no banco; nos exemplos, null: a pessoa escolhe o nome). */
export function sessaoDaTarefas(): SessaoEntregas | null {
  if (!noBanco) return null;
  if (!sessao) sessao = criarSessaoEntregas();
  return sessao;
}

export function repoDaTarefas(): tarefas.RepoTarefas {
  if (!repo) repo = noBanco ? criarRepoTarefasFirestore(empresas.EMPRESAS) : tarefas.criarRepoTarefasMemoria({ empresas: empresas.EMPRESAS });
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: tarefas.RepoTarefas, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoTarefasFirestore).definirAviso(aviso);
}

/** O que o Extrator guardou da empresa (arquivos e bancos adicionados), para o check automático e a página da empresa. */
export async function extratorDaEmpresa(nome: string): Promise<extrator.EmpresaExtrator> {
  if (noBanco) return extratorNoBanco(nome);
  // exemplos: o Extrator de exemplo guarda neste navegador; lê de novo a cada conferência
  return extrator.criarRepoExtratorMemoria({ exemplos: true }).obter(nome) || extrator.empresaNova(nome);
}

let cadastro: empresas.cadastro.RepoCadastro | null = null;

/**
 * O Cadastro (contas bancárias, plano de contas, contas padrão): no banco, a coleção `cadastro` do Entregas
 * (ver cadastro.firestore.ts); nos exemplos, neste navegador.
 */
export function repoDoCadastro(): empresas.cadastro.RepoCadastro {
  if (!cadastro) {
    cadastro = noBanco
      ? empresas.cadastro.criarRepoCadastro(portaCadastroFirestore(), false)
      : empresas.cadastro.criarRepoCadastroMemoria();
  }
  return cadastro;
}

/** O documento da empresa na Conferência (para montar o plano pelo balancete). Nos exemplos, não há. */
export async function conferenciaDaEmpresa(nome: string): Promise<Record<string, unknown> | null> {
  return noBanco ? conferenciaNoBanco(nome) : null;
}

/** O balancete de Clientes › Balancetes do Entregas (para montar o plano). Nos exemplos, não há. */
export async function balanceteDoEntregas(codigo: number | null): Promise<Record<string, unknown> | null> {
  return noBanco && codigo != null ? balanceteNoEntregas(codigo) : null;
}

/** Clientes de exemplo do Entregas (os bancos que o robô teria aprendido). */
const CLIENTES_EXEMPLO: Record<string, unknown>[] = [
  { codigoOrigem: '292', bancos: ['sicoob', 'bb'], contasBancarias: [{ banco: 'sicoob', agencia: '3144-5', conta: '12.345-6' }] },
  { codigoOrigem: '14', bancos: ['itau'], contasBancarias: [{ banco: 'itau', agencia: '0412', conta: '99887-7' }] },
  { codigoOrigem: '58', bancos: ['sicoob', 'nubank'] },
];

let doEntregas: Promise<Map<number, empresas.cadastro.BancosDoEntregas>> | null = null;

/** Os bancos que o Entregas já sabe de cada cliente, por código do ERP (lido uma vez por sessão; falha = vazio). */
export function bancosDoEntregas(): Promise<Map<number, empresas.cadastro.BancosDoEntregas>> {
  if (!doEntregas) {
    doEntregas = (noBanco ? clientesNoEntregas() : Promise.resolve(CLIENTES_EXEMPLO))
      .then(docs => empresas.cadastro.bancosDoEntregasPorCodigo(docs))
      .catch(() => new Map());
  }
  return doEntregas;
}
