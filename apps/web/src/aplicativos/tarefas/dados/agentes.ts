// O painel dos agentes do Claude Code no nads (Vitor, 13/10/2026: "tem como upar uma página no nads disso?"): o robô do
// PC (robo/painel-agentes.js) lê o que os ganchos do Claude Code gravam neste PC e publica o estado de cada sessão em
// painelAgentes/{sessão}, no banco do Entregas; só o admin lê. Interface + a versão de exemplo; a do banco é
// agentes.firestore.ts.

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
  maquina: string;
  agentes: AgenteNoPainel[];
  maisAgentes: number;
}

export interface RepoAgentes {
  readonly exemplos: boolean;
  /** as sessões, a mais recente primeiro (carrega na primeira chamada e fica ao vivo) */
  sessoes(): { carregada: boolean; lista: SessaoDeAgentes[]; erro: string };
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: duas sessões inventadas (uma com a dupla planejador/executor trabalhando). */
export function criarAgentesMemoria(): RepoAgentes {
  const agora = Date.now();
  const iso = (s: number) => new Date(agora - s * 1000).toISOString();
  const lista: SessaoDeAgentes[] = [
    {
      sessao: 'exemplo-1', projeto: 'nads-claude', status: 'trabalhando', nivel: 'forte', modelo: 'claude-opus-5-5', maquina: 'PC-EXEMPLO',
      pedido: 'monte a rotina do lucro presumido e real (EXEMPLO)', aviso: '', ultimo: iso(2), maisAgentes: 0,
      agentes: [
        { chave: 'principal', tipo: 'principal', modelo: '', status: 'parado', msg: '', agora: { fer: 'SendMessage', txt: 'planejador', ts: iso(2) },
          hist: [{ ts: iso(40), fer: 'Agent', txt: 'executor Passo 2', ms: 52000, falhou: false }, { ts: iso(120), fer: 'Agent', txt: 'planejador Plano da rotina', ms: 64000, falhou: false }] },
        { chave: 'p1', tipo: 'planejador', modelo: 'opus', status: 'trabalhando', msg: '', agora: { fer: 'Read', txt: 'packages/core/src/tarefas/sieg/lucro.ts', ts: iso(1) },
          hist: [{ ts: iso(8), fer: 'Bash', txt: 'npx vitest run lucro', ms: 4100, falhou: false }] },
        { chave: 'e1', tipo: 'executor', modelo: 'sonnet', status: 'terminou', msg: 'PASSO 2: FEITO — o painel do PIS/COFINS', agora: null,
          hist: [{ ts: iso(45), fer: 'Edit', txt: 'PainelDaTarefa.tsx', ms: 30, falhou: false }, { ts: iso(60), fer: 'Bash', txt: 'npm run verificar', ms: 61000, falhou: false }] },
      ],
    },
    {
      sessao: 'exemplo-2', projeto: 'Entregas', status: 'esperando', nivel: 'rapido', modelo: 'claude-sonnet-5-5', maquina: 'PC-EXEMPLO',
      pedido: 'tudo pronto? (EXEMPLO)', aviso: 'Claude precisa da sua permissão para usar Bash', ultimo: iso(300), maisAgentes: 0,
      agentes: [{ chave: 'principal', tipo: 'principal', modelo: '', status: 'parado', msg: 'Sim, publicado.', agora: null, hist: [] }],
    },
  ];
  return { exemplos: true, sessoes: () => ({ carregada: true, lista, erro: '' }), assinar: () => () => {}, versao: () => 0 };
}
