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
}

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
    arquivos: {
      balancete: { status: 'pronto', nome: 'Balancete 2026-09.xlsx', tamanho: 18_400, partes: 1, erro: '' },
      razao: { status: 'pronto', nome: 'Razão 2026-09.xlsx', tamanho: 96_000, partes: 1, erro: '' },
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
      todos.push({ id, codigo, empresa, competencia, status: 'pendente', erro: '', mesmoQue: '', passos: [], arquivos: {}, criadoEm: agora(), criadoPor: 'exemplo', inicioEm: '', fimEm: '' });
      mudou();
      const por = (m: Partial<PedidoMensalDoAlterdata>) => { const i = todos.findIndex(p => p.id === id); if (i >= 0 && todos[i].status !== 'cancelado') { todos[i] = { ...todos[i], ...m }; mudou(); } };
      setTimeout(() => por({ status: 'trabalhando', inicioEm: agora(), passos: [{ n: 1, nome: 'balancete: gerando o balancete', quando: agora() }] }), 1000);
      setTimeout(() => por({
        status: 'pronto', fimEm: agora(),
        arquivos: {
          balancete: { status: 'pronto', nome: 'Balancete ' + codigo + ' ' + competencia + '.xlsx', tamanho: 18_400, partes: 1, erro: '' },
          razao: { status: 'erro', nome: '', tamanho: 0, partes: 0, erro: 'o robô ainda não sabe gerar o razão (exemplo)' },
        },
      }), 4000);
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
