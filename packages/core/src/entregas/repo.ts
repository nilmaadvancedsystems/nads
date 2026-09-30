// O que as telas do Drive e do Gmail pedem e gravam. A tela nunca sabe onde o dado mora.
// No site: os dados/*.firestore.ts da Tarefas (o banco do Entregas, com o login de lá); nos exemplos: repo.memoria.ts.
import type { AndamentoDoPedido, ItemDoDrive, MapaDoDrive, PedidoAoDrive } from './drive';
import type { ClienteDoEntregas, EmailLido, EstadoDoRobo, RespostaPedida } from './gmail';

/** Quem está pedindo (vai em todo pedido ao robô; as regras do banco conferem o uid). */
export interface Quem { nome: string; uid: string; email: string }

export interface RepoDriveDoEntregas {
  readonly exemplos: boolean;
  /** o mapa da pasta do ano, ao vivo */
  mapa(): MapaDoDrive;
  /** os itens da pasta de um cliente (carregam quando pedidos; voltam a carregar quando o robô atualiza a pasta) */
  itens(pastaDoCliente: string): { carregados: boolean; itens: ItemDoDrive[] };
  /** pede ao robô (abrir, baixar, zip) e acompanha; devolve como parar de acompanhar */
  pedir(p: PedidoAoDrive, aoMudar: (a: AndamentoDoPedido) => void): () => void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export interface PedidoDeResposta {
  mensagemId: string;
  corpo: string;
  /** responder a todos (Cc de quem estava no e-mail) */
  todos: boolean;
  para: string;
  assunto: string;
  clienteId: string | null;
}

export interface RepoGmailDoEntregas {
  readonly exemplos: boolean;
  /** o que o robô deixou em robo/estado, ao vivo */
  estado(): EstadoDoRobo;
  clientes(): { carregados: boolean; lista: ClienteDoEntregas[] };
  /** remetentes marcados como spam (config/roboIgnorados) */
  ignorados(): string[];
  /** "Verificar o Gmail agora" (lê os últimos dias) */
  verificar(dias: number): Promise<void>;
  /** para a leitura em andamento */
  cancelar(): Promise<void>;
  /** o robô salva os anexos do e-mail no Drive (Claudio Secretario/AAAA-MM/<cliente>) */
  salvarNoDrive(mensagemId: string, clienteId: string | null): Promise<void>;
  /** o e-mail passa a ser do cliente (clientes.email, ou em clientes.emails se ele já tem um) */
  ligarRemetente(clienteId: string, email: string): Promise<void>;
  /** o remetente vira spam (só o admin grava, pela regra do banco) */
  ignorar(email: string): Promise<void>;
  /** o e-mail inteiro (o robô busca e devolve; até 90 s) */
  ler(mensagemId: string): Promise<EmailLido>;
  responder(p: PedidoDeResposta): Promise<void>;
  /** as respostas já pedidas para o e-mail, ao vivo */
  respostas(mensagemId: string, aoMudar: (r: RespostaPedida[]) => void): () => void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}
