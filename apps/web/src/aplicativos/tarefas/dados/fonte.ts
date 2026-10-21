// De onde vêm os dados da Tarefas (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `tarefas` (ver tarefas.firestore.ts), com a lista
//                de empresas do escritório; o check automático lê o que o Extrator guardou no banco;
//   "exemplos" → a lista de empresas do escritório com andamentos inventados (concluídas, em andamento,
//                paradas), neste navegador; nada vai para o banco. O check lê o Extrator de exemplo.
// Quem está trabalhando: no banco, o login com as contas do Entregas (entregas.firestore.ts, 30/09/2026);
// nos exemplos, a pessoa escolhe o nome na lista da equipe (não há login).
// O repositório e a sessão são criados uma vez, quando alguém abre a Tarefas. O do Cadastro, quando alguém abre o Cadastro.
import { demo, empresas, entregas, extrator, formatos, tarefas } from '@nads/core';
import { criarAcessoMemoria, type RepoAcesso } from './acesso';
import { criarAcessoFirestore } from './acesso.firestore';
import { criarDriveFirestore } from './drive.firestore';
import { criarSessaoEntregas, type SessaoEntregas } from './entregas.firestore';
import { criarGmailFirestore } from './gmail.firestore';
import { criarArquivadorMemoria, type RepoArquivador } from './arquivador';
import { criarFgtsMemoria, type RepoFgts } from './fgts';
import { criarFgtsFirestore } from './fgts.firestore';
import { criarCaixaMemoria, type RepoCaixa } from './caixa';
import { criarCaixaFirestore } from './caixa.firestore';
import { criarHonorariosMemoria, type RepoHonorarios } from './honorarios';
import { criarHonorariosFirestore } from './honorarios.firestore';
import { criarNfseMemoria, type RepoNfse } from './nfse';
import { criarNfseFirestore } from './nfse.firestore';
import { criarEntregasDeDocumentosMemoria, type RepoEntregasDeDocumentos } from './entregasDeDocumentos';
import { criarEntregasDeDocumentosFirestore } from './entregasDeDocumentos.firestore';
import { criarSiegMemoria, type RepoSieg } from './sieg';
import { criarSiegFirestore } from './sieg.firestore';
import { criarArquivadorFirestore } from './arquivador.firestore';
import { criarIAMemoria, type RepoIA } from './ia';
import { criarIAFirestore } from './ia.firestore';
import { criarFeedbackMemoria, type RepoFeedback } from './feedback';
import { criarCategoriasDpMemoria, type RepoCategoriasDp } from './categoriasDp';
import { criarCategoriasDpFirestore } from './categoriasDp.firestore';
import { criarLegislacaoDpMemoria, type RepoLegislacaoDp } from './legislacaoDp';
import { criarLegislacaoDpFirestore } from './legislacaoDp.firestore';
import { criarAreaClienteMemoria, type RepoAreaCliente } from './areaCliente';
import { criarAreaClienteFirestore } from './areaCliente.firestore';
import { criarLcdprMemoria, type RepoLcdpr } from './lcdpr';
import { criarLcdprFirestore } from './lcdpr.firestore';
import { criarFeedbackFirestore } from './feedback.firestore';
import { criarUsoMemoria, type RepoUso } from './uso';
import { criarUsoFirestore } from './uso.firestore';
import { criarPessoalMemoria, type RepoPessoal } from './pessoal';
import { criarPessoalFirestore } from './pessoal.firestore';
import { criarSaudeMemoria, type RepoSaude } from './saude';
import { criarSaudeFirestore } from './saude.firestore';
import { criarPainelRoboMemoria, type RepoPainelRobo } from './painelRobo';
import { criarPainelRoboFirestore } from './painelRobo.firestore';
import { balanceteNoEntregas, clientesNoEntregas, conferenciaNoBanco, gravarLeituraDeContas, ouvirLeituraDeContas, portaCadastroFirestore } from './cadastro.firestore';
import { criarRepoTarefasFirestore, extratorNoBanco, type RepoTarefasFirestore } from './tarefas.firestore';
import { ligadoAoBanco } from '../../../comum/modoDesenvolvedor';
import { definirEmpresasExtras } from '../../../comum/empresaDaRota';
import { criarCofreMemoria, type RepoCofre } from './cofre';
import { criarCofreFirestore, certificadosDoRobo, gravarAvisoDeCertificados, ouvirAvisoDeCertificados } from './cofre.firestore';
import { criarAgentesMemoria, type RepoAgentes } from './agentes';
import { criarAgentesFirestore } from './agentes.firestore';
import { criarGuardadoFirestore } from './guardado.firestore';
import { ligarGuardadoRemoto } from '../../../comum/guardado';

export const noBanco = ligadoAoBanco(); // no modo desenvolvedor, os dados de exemplo (nada vai para o banco)

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
  if (!repo) {
    const r = demo.tarefasComDemo(noBanco ? criarRepoTarefasFirestore(empresas.EMPRESAS_COM_DP) : tarefas.criarRepoTarefasMemoria({ empresas: empresas.EMPRESAS_COM_DP }));
    // a lista do escritório com as empresas cadastradas pelo nads (Cadastro › Nova empresa)
    const listar = r.listarEmpresas.bind(r);
    let cache: { base: readonly empresas.EmpresaDoEscritorio[]; novas: readonly empresas.EmpresaDoEscritorio[]; junto: readonly empresas.EmpresaDoEscritorio[] } | null = null;
    r.listarEmpresas = () => {
      const base = listar();
      const novas = empresasNovas();
      if (!cache || cache.base !== base || cache.novas !== novas) cache = { base, novas, junto: novas.length ? [...base, ...novas] : base };
      return cache.junto;
    };
    definirEmpresasExtras(empresasNovas);
    // o regime do Cadastro › Empresa vale no lugar do da lista (13/10/2026): muda as etapas da rotina
    tarefas.usarRegimesDoCadastro(regimeNoCadastro);
    // o "onde parou" da Tarefa também no banco (16/10/2026): no banco, sim; nos exemplos e no modo desenvolvedor, não
    if (noBanco) ligarGuardadoRemoto(criarGuardadoFirestore(() => quemPede()?.nome || ''));
    repo = r;
  }
  return repo;
}

let novasCache: { ver: number; lista: readonly empresas.EmpresaDoEscritorio[] } | null = null;
/** As empresas cadastradas pelo nads (no cadastro, com o regime), sem as que já estão na lista do escritório. */
export function empresasNovas(): readonly empresas.EmpresaDoEscritorio[] {
  const c = repoDoCadastro();
  const ver = c.versao();
  if (novasCache && novasCache.ver === ver) return novasCache.lista;
  const ja = new Set(empresas.EMPRESAS_COM_DP.map(e => e.nome));
  const lista = empresas.cadastro.empresasCadastradasNoNads(c.todos().porId.values()).filter(e => !ja.has(e.nome));
  novasCache = { ver, lista };
  return lista;
}

let regimesCache: { ver: number; mapa: Map<number, string> } | null = null;
// o regime que o Entregas tem (o enquadramento e a Receita; 13/10/2026): lido uma vez, dos mesmos clientes dos bancos
let regimesEntregas: ReadonlyMap<number, empresas.cadastro.RegimeDoEntregas> | null = null;
let pedidoRegimes: Promise<void> | null = null;
const ouvintesRegimes = new Set<() => void>();
function carregarRegimesDoEntregas(): void {
  if (pedidoRegimes) return;
  pedidoRegimes = clientesDoEntregas().then(docs => {
    regimesEntregas = empresas.cadastro.regimesDoEntregasPorCodigo(docs);
    for (const f of ouvintesRegimes) f();
  });
}
/** Para a tela desenhar de novo quando os regimes do Entregas chegam. */
export function assinarRegimesDoEntregas(f: () => void): () => void {
  carregarRegimesDoEntregas();
  ouvintesRegimes.add(f);
  return () => { ouvintesRegimes.delete(f); };
}
export const versaoDosRegimesDoEntregas = () => regimesEntregas;
/** O que o Entregas diz do regime da empresa (o enquadramento e a Receita), ou null. */
export function regimeNoEntregas(codigo: number | null | undefined): empresas.cadastro.RegimeDoEntregas | null {
  carregarRegimesDoEntregas();
  return codigo == null ? null : regimesEntregas?.get(codigo) || null;
}

/**
 * O regime da empresa fora da lista fixa: o escolhido no cadastro do nads; sem ele, o do Entregas (o enquadramento; sem
 * ele, a Receita quando diz Simples ou MEI). '' = vale o da lista do escritório.
 */
function regimeNoCadastro(codigo: number): string {
  return regimeEscolhidoNoNads(codigo) || empresas.cadastro.regimeDoEntregas(regimeNoEntregas(codigo));
}

/**
 * O regime escolhido no cadastro da empresa no nads ('' = nenhum). Pelo nome (o cadastro é por nome): os dois códigos
 * de uma empresa com o mesmo nome (ex.: 358 e 359) seguem o mesmo cadastro.
 */
function regimeEscolhidoNoNads(codigo: number): string {
  const c = repoDoCadastro();
  const ver = c.versao();
  if (!regimesCache || regimesCache.ver !== ver) {
    const porSlug = new Map<string, string>();
    for (const [id, x] of c.todos().porId) { const r = empresas.cadastro.regimeDoCadastro(x); if (r) porSlug.set(id, r); }
    const mapa = new Map<number, string>();
    for (const e of [...empresas.EMPRESAS_COM_DP, ...empresasNovas()]) {
      const r = e.codigo != null ? porSlug.get(formatos.slug(e.nome)) : undefined;
      if (r && e.codigo != null) mapa.set(e.codigo, r);
    }
    regimesCache = { ver, mapa };
  }
  return regimesCache.mapa.get(codigo) || '';
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

/** Clientes de exemplo do Entregas (os bancos que o robô teria aprendido; o 292 com a Receita discordando do regime). */
const CLIENTES_EXEMPLO: Record<string, unknown>[] = [
  { codigoOrigem: '292', enquadramento: 'Presumido', documento: '11.222.333/0001-81', nomeFantasia: 'Exemplo Comércio', inscricaoEstadual: '001.234.567.0089', cidade: 'Montes Claros/MG',
    receita: { simples: true, razaoSocial: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA', situacao: 'ATIVA', situacaoDesde: '2015-03-02', cnae: '4721-1/02',
      cnaeDescricao: 'Padaria e confeitaria com predominância de revenda', naturezaJuridica: '206-2 - Sociedade Empresária Limitada', porte: 'ME',
      abertura: '2015-03-02', endereco: 'Rua Exemplo, 100, Centro, Montes Claros/MG', socios: ['FULANO DE TAL', 'BELTRANA DA SILVA'], conferidoEm: '2026-10-01T10:00:00Z' },
    bancos: ['sicoob', 'bb'], contasBancarias: [{ banco: 'sicoob', agencia: '3144-5', conta: '12.345-6' }] },
  { codigoOrigem: '14', bancos: ['itau'], contasBancarias: [{ banco: 'itau', agencia: '0412', conta: '99887-7' }] },
  { codigoOrigem: '58', bancos: ['sicoob', 'nubank'] },
];

let docsDoEntregas: Promise<Record<string, unknown>[]> | null = null;
let doEntregas: Promise<Map<number, empresas.cadastro.BancosDoEntregas>> | null = null;
let contatosEntregas: Promise<Map<number, empresas.cadastro.ContatoDoEntregas>> | null = null;
let dadosEntregas: Promise<Map<number, empresas.cadastro.DadosDaEmpresaNoEntregas>> | null = null;

/** Os dados da empresa que o Entregas tem (o CNPJ, o cadastro e a Receita), por código (14/10/2026). Os mesmos documentos. */
export function dadosDaEmpresaNoEntregas(): Promise<Map<number, empresas.cadastro.DadosDaEmpresaNoEntregas>> {
  if (!dadosEntregas) dadosEntregas = clientesDoEntregas().then(docs => empresas.cadastro.dadosDaEmpresaNoEntregasPorCodigo(docs)).catch(() => new Map());
  return dadosEntregas;
}

/** Os clientes do Entregas (só leitura), lidos uma vez por sessão e usados pelos bancos e pelo contato (falha = vazio). */
function clientesDoEntregas(): Promise<Record<string, unknown>[]> {
  if (!docsDoEntregas) docsDoEntregas = (noBanco ? clientesNoEntregas() : Promise.resolve(CLIENTES_EXEMPLO)).catch(() => []);
  return docsDoEntregas;
}

/** Os bancos que o Entregas já sabe de cada cliente, por código do ERP (lido uma vez por sessão; falha = vazio). */
export function bancosDoEntregas(): Promise<Map<number, empresas.cadastro.BancosDoEntregas>> {
  if (!doEntregas) doEntregas = clientesDoEntregas().then(docs => empresas.cadastro.bancosDoEntregasPorCodigo(docs)).catch(() => new Map());
  return doEntregas;
}

/**
 * O e-mail e o WhatsApp que o Entregas já tem de cada cliente, por código do ERP (Vitor, 08/10/2026): o Mandei usa quando o
 * Cadastro do nads não tem. Os mesmos documentos dos bancos (sem leitura nova).
 */
export function contatosDoEntregas(): Promise<Map<number, empresas.cadastro.ContatoDoEntregas>> {
  if (!contatosEntregas) contatosEntregas = clientesDoEntregas().then(docs => empresas.cadastro.contatosDoEntregasPorCodigo(docs)).catch(() => new Map());
  return contatosEntregas;
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

let painelRobo: RepoPainelRobo | null = null;

/** O painel do robô (Cadastro › Painel do robô, 21/10/2026): os dois robôs, as filas, a atividade e o que foi arquivado. */
export function repoDoPainelRobo(): RepoPainelRobo {
  if (!painelRobo) painelRobo = noBanco ? criarPainelRoboFirestore() : criarPainelRoboMemoria();
  return painelRobo;
}

let pessoal: RepoPessoal | null = null;

/** O que é só da pessoa (a Minha página): as cobranças dela, as anotações e o que ela arquivou na caixa de entrada. */
export function repoPessoal(): RepoPessoal {
  if (!pessoal) {
    pessoal = noBanco ? criarPessoalFirestore(() => { const q = quemPede(); return q ? { uid: q.uid, email: q.email } : null; }) : criarPessoalMemoria();
  }
  return pessoal;
}

let cofreRepo: RepoCofre | null = null;

/** O cofre de senhas gov.br e certificados (07/10/2026). */
/**
 * Os certificados do cofre que pedem atenção (o resumo do robô, robo/certificados), para a faixa do admin (19/10/2026).
 * Nos exemplos: um vencido e um vencendo.
 */
let avisoExemplo = true;
const ouvintesDoAviso = new Set<(ligado: boolean) => void>();
/** O aviso de certificado vencendo ligado ou não (config/avisoCertificados; nos exemplos, na memória). */
export function ouvirAvisoDeCertificadosLigado(chegou: (ligado: boolean) => void): () => void {
  if (noBanco) return ouvirAvisoDeCertificados(chegou);
  ouvintesDoAviso.add(chegou);
  chegou(avisoExemplo);
  return () => { ouvintesDoAviso.delete(chegou); };
}
export async function ligarAvisoDeCertificados(ligado: boolean): Promise<void> {
  if (noBanco) return gravarAvisoDeCertificados(ligado, quemPede()?.nome || '');
  avisoExemplo = ligado;
  for (const f of ouvintesDoAviso) f(ligado);
}

export async function certificadosParaOAviso(): Promise<{ empresa: string; codigo: number | null; validade: string }[]> {
  if (noBanco) return (await certificadosDoRobo().catch(() => null))?.atencao || [];
  const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  return [{ empresa: 'EMPRESA EXEMPLO VENCIDA LTDA', codigo: 901, validade: dia(-4) }, { empresa: 'EMPRESA EXEMPLO VENCENDO LTDA', codigo: 902, validade: dia(12) }];
}

export function repoDoCofre(): RepoCofre {
  if (!cofreRepo) {
    cofreRepo = noBanco ? criarCofreFirestore(() => { const q = quemPede(); return q ? { uid: q.uid, nome: q.nome } : null; })
      : criarCofreMemoria(() => { try { const n = localStorage.getItem('nads-tarefas-operador'); return n ? { uid: n, nome: n } : null; } catch { return null; } });
  }
  return cofreRepo;
}

let sieg: RepoSieg | null = null;

/** O SIEG no Fiscal: as notas do mês e a sequência das saídas (o robô do PC do escritório). */
export function repoDoSieg(): RepoSieg {
  if (!sieg) sieg = noBanco ? criarSiegFirestore(() => { const q = quemPede(); return q ? { nome: q.nome, uid: q.uid } : null; }) : criarSiegMemoria();
  return sieg;
}

let fgts: RepoFgts | null = null;

/** O FGTS Digital pelo robô da nuvem (07/10/2026): os pedidos de guia do DP e o estado do robô. */
export function repoDoFgts(): RepoFgts {
  if (!fgts) fgts = noBanco ? criarFgtsFirestore(() => { const q = quemPede(); return q ? { nome: q.nome, uid: q.uid } : null; }) : criarFgtsMemoria();
  return fgts;
}

let notasFiscais: RepoNfse | null = null;

/** O emissor de NFS-e do financeiro (15/10/2026): as notas de honorários, a configuração e o token, emitidas pelo robô da nuvem. */
export function repoDeNfse(): RepoNfse {
  if (!notasFiscais) notasFiscais = noBanco ? criarNfseFirestore(() => { const q = quemPede(); return q ? { nome: q.nome, uid: q.uid } : null; }) : criarNfseMemoria();
  return notasFiscais;
}

let caixa: RepoCaixa | null = null;

/** O caixa e o plano de contas do financeiro (19/10/2026): o Movimento de Caixa e o Plano de Contas que vieram do Toriba. */
export function repoDoCaixa(): RepoCaixa {
  if (!caixa) caixa = noBanco ? criarCaixaFirestore() : criarCaixaMemoria();
  return caixa;
}

let honorarios: RepoHonorarios | null = null;

/** Os honorários dos clientes (19/10/2026, fase 2 do Financeiro): os contratos e os recebimentos por competência. */
export function repoDeHonorarios(): RepoHonorarios {
  if (!honorarios) honorarios = noBanco ? criarHonorariosFirestore() : criarHonorariosMemoria();
  return honorarios;
}

let entregasDeDocumentos: RepoEntregasDeDocumentos | null = null;

/** A entrega de documentos aos clientes (16/10/2026): a rota e o painel do Entregas, nos mesmos documentos de lá. */
export function repoDeEntregasDeDocumentos(): RepoEntregasDeDocumentos {
  if (!entregasDeDocumentos) entregasDeDocumentos = noBanco ? criarEntregasDeDocumentosFirestore(() => { const u = sessaoDaTarefas()?.estado().usuario; return u ? { nome: u.nome, papeis: [...u.papeis] } : null; }) : criarEntregasDeDocumentosMemoria();
  return entregasDeDocumentos;
}

let agentes: RepoAgentes | null = null;

/** O painel dos agentes do Claude Code (14/10/2026): os computadores cadastrados (painelMaquinas) e as conversas que cada um grava; só o admin. */
export function repoDosAgentes(): RepoAgentes {
  if (!agentes) agentes = noBanco ? criarAgentesFirestore() : criarAgentesMemoria();
  return agentes;
}

let arquivador: RepoArquivador | null = null;

/** O "Arquivar agora" (o arquivador do PC do escritório, o mesmo das Pendências do Entregas). */
export function repoDoArquivador(): RepoArquivador {
  if (!arquivador) {
    arquivador = noBanco ? criarArquivadorFirestore(() => { const q = quemPede(); return q ? { nome: q.nome, uid: q.uid } : null; })
      : criarArquivadorMemoria(() => { try { const n = localStorage.getItem('nads-tarefas-operador'); return n ? { nome: n } : null; } catch { return null; } });
  }
  return arquivador;
}

let ia: RepoIA | null = null;

/** O chat com a IA do escritório (o mesmo do Entregas: conversasIA, respondido pelo robô). */
let feedback: RepoFeedback | null = null;

/** Os feedbacks (o print e o que melhorar): no banco, a coleção feedbacks do Entregas; nos exemplos, na memória. */
export function repoDeFeedback(): RepoFeedback {
  if (!feedback) {
    feedback = noBanco
      ? criarFeedbackFirestore(() => { const q = quemPede(); return q ? { uid: q.uid, email: q.email, nome: q.nome } : null; })
      : criarFeedbackMemoria(() => { try { return localStorage.getItem('nads-tarefas-operador') || ''; } catch { return ''; } });
  }
  return feedback;
}

let usoDoSistema: RepoUso | null = null;

/** O mapa de uso do sistema (Gustavo, 20/10/2026): no banco, config/uso e uso/{dia}; nos exemplos, na memória (90 dias inventados). */
export function repoDeUso(): RepoUso {
  if (!usoDoSistema) usoDoSistema = noBanco ? criarUsoFirestore(() => quemPede()?.nome || '') : criarUsoMemoria();
  return usoDoSistema;
}

let categoriasDp: RepoCategoriasDp | null = null;

/** As categorias novas de obrigações do DP: no banco, config/dpCategorias; nos exemplos, na memória. */
export function repoDeCategoriasDp(): RepoCategoriasDp {
  if (!categoriasDp) categoriasDp = noBanco ? criarCategoriasDpFirestore(() => quemPede()?.nome || '') : criarCategoriasDpMemoria();
  return categoriasDp;
}

let legislacaoDp: RepoLegislacaoDp | null = null;

/** A legislação do DP cadastrada no nads: no banco, legislacaoDp/{id}; nos exemplos, na memória. */
export function repoDeLegislacaoDp(): RepoLegislacaoDp {
  if (!legislacaoDp) legislacaoDp = noBanco ? criarLegislacaoDpFirestore(() => quemPede()?.nome || '') : criarLegislacaoDpMemoria();
  return legislacaoDp;
}

let areaCliente: RepoAreaCliente | null = null;

/** A Área do Cliente vista pelo escritório (links, chamados, recebidos): no banco, areasCliente e vizinhas; nos exemplos, na memória. */
export function repoDaAreaCliente(): RepoAreaCliente {
  if (!areaCliente) {
    const quem = () => {
      if (noBanco) return quemPede()?.nome || '';
      try { return localStorage.getItem('nads-tarefas-operador') || ''; } catch { return ''; }
    };
    areaCliente = noBanco ? criarAreaClienteFirestore(quem) : criarAreaClienteMemoria(quem);
  }
  return areaCliente;
}

let lcdprRepo: RepoLcdpr | null = null;

/** O Importador LCDPR (16/10/2026): as regras e os cadastros no lcdpr/config do Entregas (o mesmo da página antiga); nos exemplos, na memória. */
export function repoDoLcdpr(): RepoLcdpr {
  if (!lcdprRepo) lcdprRepo = noBanco ? criarLcdprFirestore() : criarLcdprMemoria();
  return lcdprRepo;
}

export function repoDaIA(): RepoIA {
  if (!ia) ia = noBanco ? criarIAFirestore(() => { const q = quemPede(); return q ? { uid: q.uid, email: q.email } : null; }) : criarIAMemoria();
  return ia;
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
