// O acesso ao nads: a proteção do login (liberar o computador com o código de um admin), a equipe (usuarios do
// Entregas) e as configurações do nads (config/nads). No banco: acesso.firestore.ts; nos exemplos: aqui mesmo, em
// memória (a proteção começa desligada e a equipe é a de exemplo).
import { usuarios } from '@nads/core';

export interface RepoAcesso {
  readonly exemplos: boolean;
  /** config/nads: a proteção do login (desligada até o admin ligar) */
  config(): { carregada: boolean; protecao: boolean };
  gravarProtecao(ligada: boolean): Promise<void>;
  /** este login já está liberado? (sem login ou sem proteção: sim) */
  minhaSessao(): { carregada: boolean; liberada: boolean };
  /** o pedido de liberação deste login (o mais novo), ao vivo */
  meuPedido(): usuarios.PedidoDeLiberacao | null;
  pedir(computador: string): Promise<void>;
  /** o código que o admin passou: libera este login */
  confirmar(codigo: string): Promise<void>;
  /** para o admin: os pedidos esperando */
  pendentes(): usuarios.PedidoDeLiberacao[];
  /** para o admin: aprova e devolve o código para passar à pessoa */
  aprovar(p: usuarios.PedidoDeLiberacao): Promise<string>;
  recusar(p: usuarios.PedidoDeLiberacao): Promise<void>;
  /** para o admin: os logins liberados */
  sessoes(): usuarios.SessaoLiberada[];
  revogar(id: string): Promise<void>;
  /** a equipe (usuarios do Entregas) */
  equipe(): { carregada: boolean; lista: usuarios.Usuario[]; docs: Record<string, usuarios.DocUsuario> };
  salvarCargo(uid: string, departamento: usuarios.Departamento | null, nivel: usuarios.Nivel | null): Promise<void>;
  salvarPapeis(uid: string, papeis: string[]): Promise<void>;
  ativar(uid: string, ativo: boolean): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarAcessoMemoria(quem: () => { nome: string } | null): RepoAcesso {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let protecao = false;
  let pedido: usuarios.PedidoDeLiberacao | null = null;
  let codigo = '';
  let liberada = false;
  let sessoes: usuarios.SessaoLiberada[] = [];
  const docs: Record<string, usuarios.DocUsuario> = Object.fromEntries(usuarios.EQUIPE_EXEMPLO.map(u => [u.uid, {
    nome: u.nome, email: u.email, roles: [...u.papeis], departamento: u.departamento || undefined, nivel: u.nivel || undefined, ativo: u.ativo,
  } as usuarios.DocUsuario]));
  const equipe = () => Object.entries(docs).map(([uid, d]) => usuarios.lerUsuario(uid, d));
  const agora = () => new Date().toISOString();
  return {
    exemplos: true,
    config: () => ({ carregada: true, protecao }),
    async gravarProtecao(l) { protecao = l; mudou(); },
    minhaSessao: () => ({ carregada: true, liberada: !protecao || liberada }),
    meuPedido: () => pedido,
    async pedir(computador) {
      const q = quem();
      pedido = { id: 'p' + Date.now(), uid: 'eu', nome: q?.nome || '', email: '', computador, authTime: '1', status: 'pendente', criadoEm: agora() };
      mudou();
    },
    async confirmar(c) {
      if (!pedido || pedido.status !== 'aprovado' || c !== codigo) throw new Error('código errado ou pedido ainda não aprovado');
      liberada = true;
      sessoes = [...sessoes, { id: 'eu_1', uid: 'eu', nome: pedido.nome, email: '', computador: pedido.computador, liberadoEm: agora() }];
      mudou();
    },
    pendentes: () => (pedido && pedido.status === 'pendente' ? [pedido] : []),
    async aprovar(p) {
      codigo = usuarios.codigoNovo();
      pedido = { ...p, status: 'aprovado', aprovadoPor: quem()?.nome || '', aprovadoEm: agora() };
      mudou();
      return codigo;
    },
    async recusar(p) { pedido = { ...p, status: 'recusado' }; mudou(); },
    sessoes: () => sessoes,
    async revogar(id) { sessoes = sessoes.filter(s => s.id !== id); if (id === 'eu_1') liberada = false; mudou(); },
    equipe: () => ({ carregada: true, lista: equipe(), docs }),
    async salvarCargo(uid, dep, nivel) { Object.assign(docs[uid], usuarios.mudancaDeCargo(docs[uid], dep, nivel)); mudou(); },
    async salvarPapeis(uid, papeis) { docs[uid].roles = papeis as usuarios.Papel[]; mudou(); },
    async ativar(uid, ativo) { docs[uid].ativo = ativo; mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
