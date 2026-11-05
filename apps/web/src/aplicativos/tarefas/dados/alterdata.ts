// O balancete e o razão do Alterdata pelo robô do PC (Vitor, 04/11/2026: "quero criar um robo que puxa balancete e
// planilha de conta e upa no nads"). Na página Alterdata da empresa aberta, a pessoa pede um mês; o pedido vai para a fila
// pedidosAlterdata ({tipo: 'mensal'}), a mesma do balancete da Conferência. O robô gera os dois no Contábil aberto e logado
// do PC, um pedido por vez, e sobe os arquivos em pedaços (pedidosAlterdata/{id}/partes/{relatorio}-{nnn}). Pedidos ao
// mesmo tempo esperam a vez; o mesmo mês da mesma empresa já na fila não entra de novo (a tela mostra o que já está lá) e,
// se entrar por duas pessoas ao mesmo tempo, o robô gera uma vez e o segundo pedido aponta para o primeiro (mesmoQue).
// Interface + a versão de exemplo; a do banco é alterdata.firestore.ts.

export type RelatorioDoAlterdata = 'balancete' | 'razao';
export const RELATORIOS_DO_ALTERDATA: readonly { id: RelatorioDoAlterdata; rotulo: string }[] = [
  { id: 'balancete', rotulo: 'Balancete' },
  { id: 'razao', rotulo: 'Razão' },
];

export interface ArquivoDoAlterdata {
  /** pronto: dá para baixar; erro: o robô não conseguiu este (o outro pode ter saído) */
  status: 'pronto' | 'erro';
  nome: string;
  tamanho: number;
  /** quantos pedaços em partes/{relatorio}-{nnn} */
  partes: number;
  erro: string;
  /** os números lidos para dentro do nads (05/11/2026): quantas contas e, no razão, quantos lançamentos */
  importado?: { contas: number; lancamentos?: number; erro?: string };
}

/** O que o robô está fazendo agora (05/11/2026, Vitor: "quero que no nads tenha um feedback do que o robo ta fazendo, onde
 *  ele ta clicando com uma barra de progresso"): a porcentagem, a etapa (o último passo) e o clique da hora. */
export interface AndamentoDoAlterdata { pct: number; etapa: string; clique: string; em: string }

export interface PedidoMensalDoAlterdata {
  id: string;
  codigo: number;
  empresa: string;
  competencia: string;
  /** pendente, trabalhando, pronto, erro, cancelado */
  status: string;
  erro: string;
  passos: { n: number; nome: string; quando: string }[];
  arquivos: Partial<Record<RelatorioDoAlterdata, ArquivoDoAlterdata>>;
  andamento: AndamentoDoAlterdata | null;
  /** o pedido igual que o robô já atendeu: os arquivos são os dele */
  mesmoQue: string;
  criadoEm: string;
  criadoPor: string;
  inicioEm: string;
  fimEm: string;
}

/** O Contábil de cada máquina do robô (o servidor; o PC só quando ligado lá): ok | login | fechado | dois | erro. */
export interface ContabilDoRobo { carregado: boolean; maquinas: readonly { onde: string; contabil: string; em: string }[] }

export interface RepoAlterdata {
  exemplos: boolean;
  /** os pedidos mensais da empresa (o mais novo primeiro) */
  pedidos(codigo: number): { carregados: boolean; lista: readonly PedidoMensalDoAlterdata[] };
  /** quantos pedidos estão na fila do robô agora (de todas as empresas, os dois tipos) e quantos antes deste */
  fila(): { carregada: boolean; ids: readonly string[] };
  /** o Contábil de cada máquina do robô (robo/alterdata) */
  robo(): ContabilDoRobo;
  pedir(dados: { codigo: number; empresa: string; competencia: string }): Promise<void>;
  cancelar(id: string): Promise<void>;
  /** o arquivo montado dos pedaços (o do pedido igual, quando mesmoQue) */
  arquivo(p: PedidoMensalDoAlterdata, relatorio: RelatorioDoAlterdata): Promise<{ bytes: Uint8Array; nome: string } | null>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** O pedido do mês que ainda está andando (na fila ou com o robô): não se pede de novo. */
export const pedidoAndando = (lista: readonly PedidoMensalDoAlterdata[], competencia: string) =>
  lista.find(p => p.competencia === competencia && (p.status === 'pendente' || p.status === 'trabalhando')) || null;

/** O tipo do arquivo pelo nome, para o download. */
export function tipoDoArquivo(nome: string): string {
  const n = nome.toLowerCase();
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.csv')) return 'text/csv';
  return 'application/octet-stream';
}

/** Nos exemplos: um pedido anda sozinho (na fila → com o robô → pronto) em 4 s; o razão de exemplo sai com erro. */
export function criarAlterdataMemoria(): RepoAlterdata {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const agora = () => new Date().toISOString();
  const todos: PedidoMensalDoAlterdata[] = [{
    id: 'ex-1', codigo: 0, empresa: '', competencia: '2026-09', status: 'pronto', erro: '', mesmoQue: '',
    passos: [{ n: 1, nome: 'balancete pronto', quando: '2026-10-02T13:05:00.000Z' }],
    andamento: { pct: 100, etapa: 'pronto', clique: '', em: '2026-10-02T13:06:00.000Z' },
    arquivos: {
      balancete: { status: 'pronto', nome: 'Balancete 2026-09.xlsx', tamanho: 18_400, partes: 1, erro: '', importado: { contas: 289 } },
      razao: { status: 'pronto', nome: 'Razao 2026-09.csv', tamanho: 421_000, partes: 1, erro: '', importado: { contas: 213, lancamentos: 2193 } },
    },
    criadoEm: '2026-10-02T13:02:00.000Z', criadoPor: 'exemplo', inicioEm: '2026-10-02T13:03:00.000Z', fimEm: '2026-10-02T13:06:00.000Z',
  }];
  return {
    exemplos: true,
    pedidos: codigo => ({ carregados: true, lista: todos.filter(p => p.codigo === codigo || p.id === 'ex-1').map(p => (p.id === 'ex-1' ? { ...p, codigo } : p)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) }),
    fila: () => ({ carregada: true, ids: todos.filter(p => p.status === 'pendente' || p.status === 'trabalhando').map(p => p.id) }),
    robo: () => ({ carregado: true, maquinas: [{ onde: 'servidor', contabil: 'ok', em: agora() }] }),
    async pedir({ codigo, empresa, competencia }) {
      if (pedidoAndando(todos.filter(p => p.codigo === codigo), competencia)) return;
      const id = 'ex-' + codigo + '-' + Date.now();
      todos.push({ id, codigo, empresa, competencia, status: 'pendente', erro: '', mesmoQue: '', passos: [], arquivos: {}, andamento: null, criadoEm: agora(), criadoPor: 'exemplo', inicioEm: '', fimEm: '' });
      mudou();
      const por = (m: Partial<PedidoMensalDoAlterdata>) => { const i = todos.findIndex(p => p.id === id); if (i >= 0 && todos[i].status !== 'cancelado') { todos[i] = { ...todos[i], ...m }; mudou(); } };
      // o robô de mentira: os passos de verdade, um a cada 1,2 s, com os cliques no meio
      const roteiro: [string, string][] = [
        ['balancete: abrindo Livros e Relatórios → Balancete', 'menu Livros e Relatórios'], ['balancete: empresa ' + codigo, 'campo Código: ' + codigo],
        ['balancete: período', 'data'], ['balancete: gerando o balancete', 'Concluir (o Alterdata monta o balancete)'],
        ['balancete: salvando em Xlsx', 'tipo Xlsx Dados Arquivo'], ['balancete pronto', 'subindo o balancete para o nads'],
        ['razão: abrindo Livros e Relatórios → Razão', 'Razão ▾'], ['razão: empresa ' + codigo, 'Avançar'], ['razão: período', 'ordem Nome + Código'],
        ['razão: gerando o CSV na pasta do pedido', 'Concluir (o Alterdata monta o razão)'], ['razão pronto', 'subindo o razão para o nads'],
        ['lendo os números para o nads', ''],
      ];
      const passos: PedidoMensalDoAlterdata['passos'] = [];
      setTimeout(() => por({ status: 'trabalhando', inicioEm: agora(), andamento: { pct: 0, etapa: 'começando', clique: '', em: agora() } }), 800);
      roteiro.forEach(([nome, clique], i) => setTimeout(() => {
        passos.push({ n: i + 1, nome, quando: agora() });
        por({ passos: [...passos], andamento: { pct: Math.round((i + 1) / 13 * 100), etapa: nome, clique, em: agora() } });
      }, 1600 + i * 1200));
      setTimeout(() => por({
        status: 'pronto', fimEm: agora(), andamento: { pct: 100, etapa: 'pronto', clique: '', em: agora() },
        arquivos: {
          balancete: { status: 'pronto', nome: 'Balancete ' + codigo + ' ' + competencia + '.xlsx', tamanho: 24_228, partes: 1, erro: '', importado: { contas: 289 } },
          razao: { status: 'pronto', nome: 'Razao ' + codigo + ' ' + competencia + '.csv', tamanho: 421_770, partes: 1, erro: '', importado: { contas: 213, lancamentos: 2193 } },
        },
      }), 1600 + roteiro.length * 1200);
    },
    async cancelar(id) {
      const i = todos.findIndex(p => p.id === id);
      if (i >= 0) { todos[i] = { ...todos[i], status: 'cancelado', fimEm: agora() }; mudou(); }
    },
    async arquivo(p, relatorio) {
      const a = p.arquivos[relatorio];
      if (!a || a.status !== 'pronto') return null;
      return { bytes: new TextEncoder().encode('exemplo;' + relatorio + ';' + p.competencia + '\n'), nome: a.nome.replace(/\.xlsx$/, '.csv') };
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
