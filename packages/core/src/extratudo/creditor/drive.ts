// O Drive do escritório, do jeito que o Creditor usa: entrar com o usuário do Entregas (Pendências),
// ler o mapa da pasta do cliente e baixar um arquivo. Implementações: drive.memoria.ts (exemplos) e,
// no site ligado ao banco, apps/web/src/aplicativos/extratudo/dados/drive.firestore.ts.
import type { BalanceteDaEmpresa } from './regras/balancete';
import type { ItemDrive } from './regras/drive';
import type { RemetenteDoPedido } from '../../entregas/gmail';
import type { ExtratoRecebido } from '../extrator/regras/recebidos';

export interface AcessoDrive {
  /** já sabe se tem alguém logado (antes disso, não mostra o login) */
  pronto: boolean;
  /** logado no Entregas */
  entrou: boolean;
  /** quem está logado */
  quem: string;
}

/** O contato do cliente no cadastro do Entregas (clientes/{id}, pelo código do ERP). */
export interface ContatoDoCliente {
  id: string;
  nome: string;
  /** o e-mail principal primeiro, depois os outros */
  emails: string[];
  telefone: string;
}

/** O pedido de e-mail para a fila do robô do Entregas (ele monta o HTML e envia pelo Gmail do escritório). */
export interface PedidoDeEmail {
  contato: ContatoDoCliente;
  /** tem que ser um dos e-mails do cadastro (o robô confere) */
  para: string;
  assunto: string;
  /** o texto (quem não abre HTML; o robô também usa) */
  corpo: string;
  /** o HTML montado pelo nads (o robô do Entregas usa este no lugar do dele, quando souber ler o campo) */
  html?: string;
  /** 'aaaa-mm': o mês em que o pedido fica registrado no Entregas */
  competencia: string;
}

/** Como está o e-mail na fila do robô do Entregas. */
export interface SituacaoDoEmail { status: 'pendente' | 'processando' | 'enviado' | 'erro' | 'sumiu'; erro?: string }

export interface RepoDrive {
  readonly exemplos: boolean;
  /** o login é o do sistema de fora (o Extratudo acoplado no Entregas): não pede usuário nem senha */
  readonly loginDeFora?: boolean;
  acesso(): AcessoDrive;
  /** entra com o usuário (nome ou e-mail) e a senha do Entregas; erro vira exceção com a mensagem */
  entrar(usuario: string, senha: string): Promise<void>;
  /** entra com a conta Google do escritório (uma vez por computador: o login fica guardado) */
  entrarComGoogle(): Promise<void>;
  sair(): Promise<void>;
  /** a pasta do cliente pelo código do ERP e tudo o que tem dentro (null = o cliente não tem pasta) */
  pastaDoCliente(codigo: number | null): Promise<{ raiz: string; nome: string; itens: ItemDrive[] } | null>;
  /**
   * O balancete subido no Entregas (Clientes e ajustes → Balancetes), pelo código do ERP; null = não
   * tem. Só existe acoplado no Entregas.
   */
  balanceteDoEntregas?(codigo: number): Promise<BalanceteDaEmpresa | null>;
  /** baixa o arquivo (pelo robô do Entregas); `passo` conta o andamento para a tela */
  baixar(id: string, nome: string, passo?: (texto: string) => void): Promise<ArrayBuffer>;
  /** um link temporário para VER o arquivo (a cópia do robô vale ~30 min); não guardar o link */
  /** modo 'abrir' (padrão): o PDF abre no navegador, só para ver; 'baixar': vem como download */
  link(id: string, nome: string, passo?: (texto: string) => void, modo?: 'abrir' | 'baixar'): Promise<string>;
  /** o contato do cliente no cadastro do Entregas (null = não achou); não existe acoplado no Entregas */
  contatoDoCliente?(codigo: number): Promise<ContatoDoCliente | null>;
  /** põe o e-mail na fila do robô do Entregas e espera ele enviar (erro = o motivo); 'na-fila' = o robô ainda não pegou */
  pedirEmail?(p: PedidoDeEmail, passo?: (texto: string) => void): Promise<{ id: string; situacao: 'enviado' | 'na-fila' }>;
  /** de qual Gmail o pedido vai sair: o do setor de quem pede (a mesma regra do robô); não existe acoplado no Entregas */
  remetente?(): Promise<RemetenteDoPedido>;
  /** a situação de cada pedido de e-mail na fila do robô (pelo id) */
  situacaoDosEmails?(ids: string[]): Promise<Record<string, SituacaoDoEmail>>;
  /**
   * Os extratos que chegaram por e-mail (o robô do Gmail; 08/10/2026: "ele já jogue o extrato para o nads"), ainda não
   * importados, do cliente e do mês. Não existe acoplado no Entregas nem nos exemplos.
   */
  extratosRecebidos?(codigo: number, competencia: string): Promise<ExtratoRecebido[]>;
  /**
   * Manda um arquivo para a pasta Claudio Secretario/<competência>/<cliente> (a fila enviosSecretario, a mesma da Tarefas
   * › Drive), de onde o arquivamento leva para a pasta certa (o extrato vai para EXTRATOS/AAAA/MM/BANCÁRIOS/<BANCO>).
   * Resolve quando o arquivo inteiro já subiu e o envio ficou 'pendente' para o robô. Não existe acoplado no Entregas.
   * (Vitor, 09/10/2026: o extrato importado do computador que não está no Drive vai para lá.)
   */
  enviarAoDrive?(arquivo: { nome: string; bytes: Uint8Array }, destino: { competencia: string; codigo: number | null; cliente: string }): Promise<void>;
  /** o arquivo do extrato recebido */
  baixarRecebido?(id: string): Promise<ArrayBuffer>;
  /** importado (em que linha) ou ignorado: sai da lista */
  marcarRecebido?(id: string, status: 'importado' | 'ignorado', linha: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** O login do Entregas aceita o nome ("Vitor Silva" → vitor.silva@nilma.local) ou o e-mail, igual ao app Pendências. */
export function emailDoUsuario(usuario: string): string {
  const u = usuario.trim();
  if (u.includes('@')) return u;
  return u.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') + '@nilma.local';
}

/** A mensagem de erro do login do Firebase, em português. */
/** A conta Google do escritório (vem sugerida na janela do Google). */
export const CONTA_GOOGLE_DO_ESCRITORIO = 'nilmacontabilidade@gmail.com';

/** O erro do login com Google, em português, dizendo o que ajustar no projeto do Entregas. */
export function mensagemDoLoginGoogle(codigo: string, site: string): string {
  if (/popup-closed|cancelled-popup/.test(codigo)) return 'A janela do Google foi fechada antes de entrar.';
  if (/popup-blocked/.test(codigo)) return 'O navegador bloqueou a janela do Google. Libere as janelas deste site e tente de novo.';
  if (/unauthorized-domain/.test(codigo)) return 'Este site (' + site + ') ainda não está autorizado no login do Entregas: no Firebase do Entregas, Authentication → Configurações → Domínios autorizados.';
  if (/operation-not-allowed/.test(codigo)) return 'O login com Google não está ligado no Entregas: no Firebase do Entregas, Authentication → Método de login → Google.';
  if (/network/.test(codigo)) return 'Sem conexão com o Entregas.';
  return 'Não foi possível entrar com o Google (' + codigo + ').';
}

export function mensagemDoLogin(codigo: string): string {
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(codigo)) return 'Usuário ou senha errados.';
  if (/too-many-requests/.test(codigo)) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (/network/.test(codigo)) return 'Sem conexão com o Entregas.';
  return 'Não foi possível entrar (' + codigo + ').';
}
