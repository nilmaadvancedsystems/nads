// O arquivador (Vitor, 05/10/2026: "tem que ter um botão assim como no Entregas onde chama o arquivador no Drive"): o
// mesmo "Arquivar agora" das Pendências do Entregas. O pedido vai para solicitacoesArquivo e o arquivador do PC do
// escritório (Entregas/scripts/arquivador.js) roda a rotina do Claudio Secretário (/organizar), como a das 9h: cada
// arquivo da pasta Claudio Secretario vai para a pasta do cliente. O PC bate o ponto em robo/arquivador.
// Interface + a versão de exemplo (finge a organização); a do banco é arquivador.firestore.ts.

export interface PassoDoArquivador { em: string; texto: string; sub: boolean }

export interface PedidoDeArquivo {
  id: string;
  /** pendente → aguardando (esperando outra execução) → processando → concluido | erro; ou cancelado */
  status: string;
  criadoPor: string;
  criadoEm: string;
  processandoEm: string;
  concluidoEm: string;
  erroEm: string;
  canceladoEm: string;
  aguardandoMotivo: string;
  erro: string;
  passos: number;
  /** a lista de etapas que o Claude mantém enquanto organiza (vira a %) */
  progresso: { feitas: number; total: number; atual: string } | null;
  andamento: PassoDoArquivador[];
}

export interface EstadoDoArquivador {
  carregado: boolean;
  /** quem não é admin nem contábil não lê (as regras do Entregas): o botão some */
  semPermissao: boolean;
  /** o último ponto do PC (ISO) */
  em: string;
  situacao: string;
  desligadoEm: string;
}

export interface RepoArquivador {
  exemplos: boolean;
  estado(): EstadoDoArquivador;
  /** os últimos pedidos, o mais novo primeiro */
  pedidos(): PedidoDeArquivo[];
  pedir(): Promise<void>;
  cancelar(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos não há PC: o pedido anda sozinho (espera, organiza em etapas e conclui) para ver a tela funcionando. */
export function criarArquivadorMemoria(quem: () => { nome: string } | null): RepoArquivador {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const agora = () => new Date().toISOString();
  const pedidos: PedidoDeArquivo[] = [];
  const ETAPAS = ['Ler a pasta Claudio Secretario', 'Identificar o cliente de cada arquivo', 'Mover para as pastas dos clientes', 'Conferir e registrar'];
  return {
    exemplos: true,
    estado: () => ({ carregado: true, semPermissao: false, em: agora(), situacao: pedidos.some(p => p.status === 'processando') ? 'rodando' : 'livre', desligadoEm: '' }),
    pedidos: () => pedidos,
    async pedir() {
      const p: PedidoDeArquivo = {
        id: 'p' + Date.now(), status: 'pendente', criadoPor: quem()?.nome || 'alguém', criadoEm: agora(), processandoEm: '', concluidoEm: '', erroEm: '',
        canceladoEm: '', aguardandoMotivo: '', erro: '', passos: 0, progresso: null, andamento: [],
      };
      pedidos.unshift(p);
      mudou();
      let feitas = 0;
      setTimeout(() => {
        if (p.status !== 'pendente') return;
        p.status = 'processando'; p.processandoEm = agora(); p.progresso = { feitas: 0, total: ETAPAS.length, atual: ETAPAS[0] };
        mudou();
        const r = setInterval(() => {
          feitas++;
          p.passos += 3;
          p.andamento = [...p.andamento, { em: agora(), texto: 'Feito: ' + ETAPAS[feitas - 1], sub: false }];
          if (feitas >= ETAPAS.length) { clearInterval(r); p.status = 'concluido'; p.concluidoEm = agora(); p.progresso = null; }
          else p.progresso = { feitas, total: ETAPAS.length, atual: ETAPAS[feitas] };
          mudou();
        }, 2500);
      }, 2000);
    },
    async cancelar(id) {
      const p = pedidos.find(x => x.id === id);
      if (p && (p.status === 'pendente' || p.status === 'aguardando')) { p.status = 'cancelado'; p.canceladoEm = agora(); mudou(); }
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
