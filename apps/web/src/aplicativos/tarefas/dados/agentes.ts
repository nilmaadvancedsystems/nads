// O painel dos agentes do Claude Code no nads, por computador (14/10/2026; decisão do Vitor: só admin; o texto do pedido
// vai junto; só entram computadores cadastrados). O admin cadastra o computador aqui (painelMaquinas/{chave}: o id do
// documento é a chave secreta, mostrada uma vez, que vai para o instalador do kit); o gancho registro.js de cada
// computador grava o resumo vivo de cada conversa em painelMaquinas/{chave}/sessoes/{sessão}, no banco do Entregas.
// Interface + a versão de exemplo; a do banco é agentes.firestore.ts.

export interface AcaoDoAgente { ts: string; fer: string; txt: string; ms: number; falhou: boolean }

export interface AgenteNoPainel {
  /** 'principal' ou o id do subagente */
  chave: string;
  /** 'principal', o tipo do subagente (rapido, forte, planejador…) */
  tipo: string;
  modelo: string;
  /** trabalhando | parado | terminou */
  status: string;
  /** a última mensagem (o fim do subagente ou da resposta) */
  msg: string;
  /** a ferramenta que ele está usando agora */
  agora: { fer: string; txt: string; ts: string } | null;
  /** as últimas ações, a mais nova primeiro */
  hist: AcaoDoAgente[];
}

export interface SessaoDeAgentes {
  sessao: string;
  /** a chave do computador (painelMaquinas/{chave}) */
  maquina: string;
  /** o nome que o Claude deu à conversa (vazio: ainda sem nome) */
  titulo: string;
  cwd: string;
  /** a última pasta do cwd */
  projeto: string;
  /** trabalhando | esperando | parado | encerrada */
  status: string;
  /** o nível que o porteiro deu ao último pedido: rapido | padrao | forte */
  nivel: string;
  modelo: string;
  pedido: string;
  aviso: string;
  /** a última atividade (ISO) */
  ultimo: string;
  /** o principal (com o agora da conversa) e os subagentes */
  agentes: AgenteNoPainel[];
  maisAgentes: number;
}

export interface MaquinaDoPainel {
  /** o id do documento: a chave secreta do computador */
  chave: string;
  nome: string;
  ativo: boolean;
  criadoEm: string;
  criadoPor: string;
}

export interface ListaAoVivo<T> { carregada: boolean; lista: T[]; erro: string }

export interface RepoAgentes {
  readonly exemplos: boolean;
  /** os computadores cadastrados (ao vivo) */
  maquinas(): ListaAoVivo<MaquinaDoPainel>;
  /** as conversas das últimas 24 h dos computadores ativos, a mais recente primeiro (ao vivo) */
  sessoes(): ListaAoVivo<SessaoDeAgentes>;
  /** cadastra o computador e devolve a chave nova (aleatória, 48 caracteres) */
  cadastrar(nome: string, quem: string): Promise<string>;
  renomear(chave: string, nome: string): Promise<void>;
  ativar(chave: string, ativo: boolean): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** A última pasta do caminho (C:\claudio\nads-dp → nads-dp). */
export const pastaDe = (cwd: string) => String(cwd || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';

/** A chave nova do computador: 24 bytes aleatórios em hexadecimal. */
export function chaveNova(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

/** Nos exemplos: dois computadores (um com a dupla planejador/executor trabalhando e uma conversa parada há horas). */
export function criarAgentesMemoria(): RepoAgentes {
  const agora = Date.now();
  const iso = (s: number) => new Date(agora - s * 1000).toISOString();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let maquinas: MaquinaDoPainel[] = [
    { chave: 'exemplo-pc-fiscal', nome: 'PC do Fiscal (EXEMPLO)', ativo: true, criadoEm: iso(86400 * 3), criadoPor: 'Vitor' },
    { chave: 'exemplo-notebook', nome: 'Notebook do Vitor (EXEMPLO)', ativo: true, criadoEm: iso(86400), criadoPor: 'Vitor' },
  ];
  const principal = (agoraDele: AgenteNoPainel['agora']): AgenteNoPainel => ({ chave: 'principal', tipo: 'principal', modelo: '', status: 'parado', msg: '', agora: agoraDele, hist: [] });
  const sessoes: SessaoDeAgentes[] = [
    {
      sessao: 'exemplo-1', maquina: 'exemplo-pc-fiscal', titulo: 'nads · Fiscal › Painel (lucro presumido)', cwd: 'C:\\claudio\\nads-dp', projeto: 'nads-dp',
      status: 'trabalhando', nivel: 'forte', modelo: 'claude-opus-5-5', pedido: 'monte a rotina do lucro presumido e real (EXEMPLO)', aviso: '', ultimo: iso(2), maisAgentes: 0,
      agentes: [
        principal({ fer: 'SendMessage', txt: 'planejador', ts: iso(2) }),
        { chave: 'p1', tipo: 'planejador', modelo: 'opus', status: 'trabalhando', msg: '', agora: { fer: 'Read', txt: 'packages/core/src/tarefas/sieg/lucro.ts', ts: iso(1) }, hist: [] },
        { chave: 'e1', tipo: 'executor', modelo: 'sonnet', status: 'terminou', msg: '', agora: null, hist: [] },
      ],
    },
    {
      sessao: 'exemplo-2', maquina: 'exemplo-pc-fiscal', titulo: 'Entregas › Nova entrega', cwd: 'C:\\claudio\\Entregas', projeto: 'Entregas',
      status: 'esperando', nivel: 'rapido', modelo: 'claude-sonnet-5-5', pedido: 'tudo pronto? (EXEMPLO)', aviso: 'Claude precisa da sua permissão para usar Bash', ultimo: iso(300), maisAgentes: 0,
      agentes: [principal(null)],
    },
    {
      sessao: 'exemplo-3', maquina: 'exemplo-notebook', titulo: '', cwd: 'C:\\claudio\\nads', projeto: 'nads',
      status: 'parado', nivel: 'padrao', modelo: 'claude-opus-5-5', pedido: 'ajuste o robô do SIEG (EXEMPLO)', aviso: '', ultimo: iso(3 * 3600), maisAgentes: 0,
      agentes: [principal(null)],
    },
  ];
  const ativas = () => new Set(maquinas.filter(m => m.ativo).map(m => m.chave));
  return {
    exemplos: true,
    maquinas: () => ({ carregada: true, lista: maquinas, erro: '' }),
    sessoes: () => ({ carregada: true, lista: sessoes.filter(s => ativas().has(s.maquina)), erro: '' }),
    async cadastrar(nome, quem) {
      const chave = chaveNova();
      maquinas = [...maquinas, { chave, nome, ativo: true, criadoEm: new Date().toISOString(), criadoPor: quem }];
      mudou();
      return chave;
    },
    async renomear(chave, nome) { maquinas = maquinas.map(m => (m.chave === chave ? { ...m, nome } : m)); mudou(); },
    async ativar(chave, ativo) { maquinas = maquinas.map(m => (m.chave === chave ? { ...m, ativo } : m)); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
