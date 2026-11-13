// As solicitações de reunião das Notificações do Início novo (13/11/2026): o Sênior pede, o Diretor e o Dono aprovam ou
// recusam com a observação. Interface + a versão de exemplo (na memória); a do banco é solicitacoes.firestore.ts (coleção
// nadsSolicitacoes do Entregas, que só passa quando a regra estiver no ar). As regras são do core (tarefas.solicitacoes).
import { tarefas } from '@nads/core';

type Solicitacao = tarefas.solicitacoes.SolicitacaoDeReuniao;
type Pessoa = { uid: string; nome: string };
export type PedidoDeReuniao = Pick<Solicitacao, 'titulo' | 'texto' | 'quando'> & { link: string };

export interface RepoSolicitacoes {
  exemplos: boolean;
  /** todas: as de todo mundo (quem aprova); sem: só as da pessoa (quem pede) */
  lista(todas: boolean): { carregadas: boolean; solicitacoes: Solicitacao[] };
  solicitar(p: PedidoDeReuniao): Promise<void>;
  /** aprova ou recusa (devolve a solicitação decidida: quem aprovou publica a reunião nas Notificações) */
  decidir(id: string, aprovar: boolean, observacao: string): Promise<Solicitacao>;
  assinar(f: () => void): () => void;
  versao(): number;
}

/** O pedido pronto para gravar (o link só quando tem). */
export function solicitacaoNova(p: PedidoDeReuniao, por: Pessoa, id: string, em: string): Solicitacao {
  return { id, titulo: p.titulo.trim(), texto: tarefas.limparAviso(p.texto), quando: p.quando, ...(p.link.trim() ? { link: p.link.trim() } : {}), por: por.nome, porUid: por.uid, em, situacao: 'pendente' };
}

/** paraQuemUsa: o ⚡ do Início (modo desenvolvedor) põe pedidos de exemplo, alguns de quem está usando */
export function criarSolicitacoesMemoria(quem: () => Pessoa | null, paraQuemUsa = false): RepoSolicitacoes {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const ha = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const dia = (n: number, hora: string) => tarefas.delegadas.hojeIso(new Date(Date.now() + n * 86400_000)) + 'T' + hora;
  const eu = quem() || { uid: 'exemplo-3', nome: 'Vitor' };
  let lista: Solicitacao[] = paraQuemUsa ? [
    { id: 'sr-1', titulo: 'Revisão das empresas do Simples', texto: 'Passar as empresas que mudam de faixa no mês que vem.', quando: dia(2, '15:00'), por: 'Fernando', porUid: 'exemplo-4', em: ha(5), situacao: 'pendente' },
    { id: 'sr-2', titulo: 'Treinamento do eSocial', texto: 'Uma hora com a equipe do DP sobre o leiaute novo.', quando: dia(4, '10:00'), link: 'https://meet.google.com/', por: eu.nome, porUid: eu.uid, em: ha(3), situacao: 'pendente' },
    { id: 'sr-3', titulo: 'Alinhamento com o cliente novo', texto: 'Entender a rotina da empresa antes do primeiro fechamento.', quando: dia(1, '09:30'), por: eu.nome, porUid: eu.uid, em: ha(30), situacao: 'aprovada', decididoPor: 'Nilma', decididoEm: ha(20), observacao: 'Pode usar a sala de reunião.' },
    { id: 'sr-4', titulo: 'Folga coletiva de dezembro', texto: 'Combinar os dias de folga do fim do ano.', quando: dia(6, '17:00'), por: eu.nome, porUid: eu.uid, em: ha(60), situacao: 'recusada', decididoPor: 'Nilma', decididoEm: ha(48), observacao: 'Vamos tratar na reunião geral do dia 18.' },
  ] : [];
  const cache = new Map<string, { ver: number; estado: { carregadas: boolean; solicitacoes: Solicitacao[] } }>();
  return {
    exemplos: true,
    lista(todas) {
      const uid = quem()?.uid || eu.uid;
      const chave = (todas ? '*' : uid);
      const c = cache.get(chave);
      if (c && c.ver === ver) return c.estado;
      const estado = { carregadas: true, solicitacoes: tarefas.solicitacoes.ordenarSolicitacoes(todas ? lista : lista.filter(s => s.porUid === uid)) };
      cache.set(chave, { ver, estado });
      return estado;
    },
    async solicitar(p) {
      const problema = tarefas.solicitacoes.problemaDaSolicitacao(p);
      if (problema) throw new Error(problema);
      lista = [...lista, solicitacaoNova(p, quem() || eu, 'sr-' + Date.now().toString(36), new Date().toISOString())];
      mudou();
    },
    async decidir(id, aprovar, observacao) {
      const s = lista.find(x => x.id === id);
      if (!s) throw new Error('a solicitação não existe mais');
      const decidida = tarefas.solicitacoes.decidir(s, aprovar, observacao, (quem() || eu).nome, new Date().toISOString());
      lista = lista.map(x => (x.id === id ? decidida : x));
      mudou();
      return decidida;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
