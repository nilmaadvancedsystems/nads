// O Drive do escritório, do jeito que o Creditor usa: entrar com o usuário do Entregas (Pendências),
// ler o mapa da pasta do cliente e baixar um arquivo. Implementações: drive.memoria.ts (exemplos) e,
// no site ligado ao banco, apps/web/src/aplicativos/extratudo/dados/drive.firestore.ts.
import type { ItemDrive } from './regras/drive';

export interface AcessoDrive {
  /** já sabe se tem alguém logado (antes disso, não mostra o login) */
  pronto: boolean;
  /** logado no Entregas */
  entrou: boolean;
  /** quem está logado */
  quem: string;
}

export interface RepoDrive {
  readonly exemplos: boolean;
  acesso(): AcessoDrive;
  /** entra com o usuário (nome ou e-mail) e a senha do Entregas; erro vira exceção com a mensagem */
  entrar(usuario: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  /** a pasta do cliente pelo código do ERP e tudo o que tem dentro (null = o cliente não tem pasta) */
  pastaDoCliente(codigo: number | null): Promise<{ raiz: string; nome: string; itens: ItemDrive[] } | null>;
  /** baixa o arquivo (pelo robô do Entregas); `passo` conta o andamento para a tela */
  baixar(id: string, nome: string, passo?: (texto: string) => void): Promise<ArrayBuffer>;
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
export function mensagemDoLogin(codigo: string): string {
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(codigo)) return 'Usuário ou senha errados.';
  if (/too-many-requests/.test(codigo)) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (/network/.test(codigo)) return 'Sem conexão com o Entregas.';
  return 'Não foi possível entrar (' + codigo + ').';
}
