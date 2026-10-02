// De onde vêm os dados da Tarefas (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `tarefas` (ver tarefas.firestore.ts), com a lista
//                de empresas do escritório; o check automático lê o que o Extrator guardou no banco;
//   "exemplos" → a lista de empresas do escritório com andamentos inventados (concluídas, em andamento,
//                paradas), neste navegador; nada vai para o banco. O check lê o Extrator de exemplo.
// Quem está trabalhando: no banco, o login com as contas do Entregas (entregas.firestore.ts, 30/09/2026);
// nos exemplos, a pessoa escolhe o nome na lista da equipe (não há login).
// O repositório e a sessão são criados uma vez, quando alguém abre a Tarefas. O do Cadastro, quando alguém abre o Cadastro.
import { demo, empresas, entregas, extrator, tarefas } from '@nads/core';
import { criarAcessoMemoria, type RepoAcesso } from './acesso';
import { criarAcessoFirestore } from './acesso.firestore';
import { criarDriveFirestore } from './drive.firestore';
import { criarSessaoEntregas, type SessaoEntregas } from './entregas.firestore';
import { criarGmailFirestore } from './gmail.firestore';
import { criarSaudeMemoria, type RepoSaude } from './saude';
import { criarSaudeFirestore } from './saude.firestore';
import { balanceteNoEntregas, clientesNoEntregas, conferenciaNoBanco, gravarLeituraDeContas, ouvirLeituraDeContas, portaCadastroFirestore } from './cadastro.firestore';
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
  // a empresa de teste (Personaly Company) fica neste navegador; o resto, no banco (ou nos exemplos)
  if (!repo) repo = demo.tarefasComDemo(noBanco ? criarRepoTarefasFirestore(empresas.EMPRESAS) : tarefas.criarRepoTarefasMemoria({ empresas: empresas.EMPRESAS }));
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: tarefas.RepoTarefas, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoTarefasFirestore).definirAviso(aviso);
}

/** O que o Extrator guardou da empresa (arquivos e bancos adicionados), para o check automático e a página da empresa. */
export async function extratorDaEmpresa(nome: string): Promise<extrator.EmpresaExtrator> {
  if (demo.ehEmpresaDemo(nome)) return demo.extratorDaDemo();
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
      ? empresas.cadastro.criarRepoCadastro(demo.portaCadastroComDemo(portaCadastroFirestore()), false)
      : empresas.cadastro.criarRepoCadastro(demo.portaCadastroComDemo(empresas.cadastro.portaCadastroMemoria()), true);
  }
  return cadastro;
}

/** O documento da empresa na Conferência (para montar o plano pelo balancete). Nos exemplos, não há. */
export async function conferenciaDaEmpresa(nome: string): Promise<Record<string, unknown> | null> {
  return noBanco && !demo.ehEmpresaDemo(nome) ? conferenciaNoBanco(nome) : null;
}

/** O balancete de Clientes › Balancetes do Entregas (para montar o plano). Nos exemplos, não há. */
export async function balanceteDoEntregas(codigo: number | null): Promise<Record<string, unknown> | null> {
  return noBanco && codigo != null && codigo !== demo.EMPRESA_DEMO.codigo ? balanceteNoEntregas(codigo) : null;
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

/**
 * O interruptor do robô que lê a agência e a conta dos extratos (no banco: config/indiceDrive.contas do Entregas;
 * nos exemplos, só neste navegador enquanto a página está aberta).
 */
let leituraExemplo = true;
const ouvintesExemplo = new Set<(ligado: boolean) => void>();
export function ouvirLeituraDoRobo(aoMudar: (ligado: boolean) => void, aoFalhar: (err: Error) => void): () => void {
  if (noBanco) return ouvirLeituraDeContas(aoMudar, aoFalhar);
  ouvintesExemplo.add(aoMudar);
  aoMudar(leituraExemplo);
  return () => { ouvintesExemplo.delete(aoMudar); };
}
export async function gravarLeituraDoRobo(ligado: boolean): Promise<void> {
  if (noBanco) return gravarLeituraDeContas(ligado);
  leituraExemplo = ligado;
  for (const f of ouvintesExemplo) f(ligado);
}

/** Quem está logado (vai nos pedidos ao robô do Entregas). */
function quemPede(): entregas.Quem | null {
  const u = sessaoDaTarefas()?.estado().usuario;
  return u ? { nome: u.nome, uid: u.uid, email: u.email } : null;
}

let drive: entregas.RepoDriveDoEntregas | null = null;
let gmail: entregas.RepoGmailDoEntregas | null = null;

/** O Drive do escritório pelo robô do Entregas (o mapa das pastas e os pedidos de abrir e baixar). */
export function repoDoDrive(): entregas.RepoDriveDoEntregas {
  if (!drive) drive = noBanco ? criarDriveFirestore(quemPede) : entregas.criarDriveDoEntregasMemoria();
  return drive;
}

/** A caixa do robô do Gmail (o que ele viu e a fila de pedidos). */
export function repoDoGmail(): entregas.RepoGmailDoEntregas {
  if (!gmail) {
    const mes = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    gmail = noBanco ? criarGmailFirestore(quemPede, mes) : entregas.criarGmailDoEntregasMemoria();
  }
  return gmail;
}

let saude: RepoSaude | null = null;

/** A saúde do robô do Entregas (Cadastro › Configurações). */
export function repoDaSaude(): RepoSaude {
  if (!saude) saude = noBanco ? criarSaudeFirestore() : criarSaudeMemoria();
  return saude;
}

let acesso: RepoAcesso | null = null;

/** A proteção do login, a equipe e as configurações do nads (config/nads). */
export function repoDeAcesso(): RepoAcesso {
  if (!acesso) {
    acesso = noBanco
      ? criarAcessoFirestore(() => {
        const u = sessaoDaTarefas()?.estado().usuario;
        return u ? { uid: u.uid, nome: u.nome, email: u.email, admin: u.papeis.includes('admin') } : null;
      })
      // nos exemplos, quem está é a pessoa escolhida na lista da equipe (operador.tsx guarda o nome neste navegador)
      : criarAcessoMemoria(() => {
        let nome = 'você';
        try { nome = localStorage.getItem('nads-tarefas-operador') || nome; } catch { /* sem storage */ }
        return { nome };
      });
  }
  return acesso;
}
