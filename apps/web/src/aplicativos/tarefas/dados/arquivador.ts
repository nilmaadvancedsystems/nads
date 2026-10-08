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
  /** a execução da rotina que o pedido gerou (EXEC-…): o resultado fica em arquivamentos/{execucao} */
  execucao: string;
}

/** O que a execução arquivou (o resumo que o arquivador publica do manifesto da rotina). */
export interface ResultadoDoArquivamento {
  arquivados: number;
  naoIdentificados: number;
  duplicados: number;
  /** os clientes que receberam arquivos, os que mais receberam primeiro */
  clientes: { codigo: string; nome: string; n: number }[];
}

/**
 * A rotina rodando por fora do botão (a tarefa das 9h, ou alguém rodando à mão): o arquivador do PC lê a trava que ela
 * cria (_CONTROLE/_execucao.lock: a execução, o início, o modo e a fase) e o último arquivo que ela mexeu, e manda no ponto.
 */
export interface RotinaRodando {
  ativa: boolean;
  execucao: string;
  /** ISO, ou '' quando só há sinal (sem a trava) */
  inicio: string;
  modo: string;
  /** a fase do 01-ORQUESTRADOR: 0, 1, 1b, 2, 3-4, 4b, 5, 6, 7 ou 8 */
  fase: string;
  ultimoSinalEm: string;
  /** é a execução de um pedido do botão (aí o painel mostra pelo pedido) */
  deUmPedido: boolean;
}

/** Uma execução já publicada (o resumo em arquivamentos/{EXEC-…}): as rodadas do dia somam no painel. */
export interface ExecucaoPublicada { id: string; em: string; arquivados: number; naoIdentificados: number; codigos: string[] }

/** Uma mensagem da conversa do Claude que roda a rotina (o texto; as ferramentas ficam de fora). */
export interface MensagemDaRotina { em: string; quem: 'claude' | 'voce'; texto: string }

/** A conversa mais recente da rotina e o relatório do dia, que o arquivador do PC publica (robo/arquivadorConversa). */
export interface ConversaDaRotina {
  carregada: boolean;
  atualizadaEm: string;
  /** a sessão do Claude desta conversa (o arquivador retoma ela quando alguém escreve pelo nads) */
  sessao: string;
  mensagens: MensagemDaRotina[];
  relatorio: { arquivo: string; em: string; texto: string } | null;
  /** os agentes que a rotina despachou (as etapas que se veem e a % do lote) */
  agentes: { id: string; descricao: string; tipo: string; em: string; status: 'rodando' | 'concluido' | 'erro' }[];
}

/** Uma mensagem escrita no nads para o Claude da rotina (07/10/2026: "coloque para eu conversar com o claude aqui"). */
export interface MensagemParaOClaude {
  id: string;
  texto: string;
  /** pendente, aguardando (a rotina está rodando), respondendo, respondida, erro */
  status: string;
  erro: string;
  criadoEm: string;
  criadoPor: string;
}

/** O relatório e a mensagem final de uma execução (arquivamentos/{EXEC-…}/detalhe/tudo). */
export interface DetalheDaExecucao { carregado: boolean; relatorio: string; resposta: string }

export interface EstadoDoArquivador {
  carregado: boolean;
  /** quem não é admin nem contábil não lê (as regras do Entregas): o botão some */
  semPermissao: boolean;
  /** o último ponto do PC (ISO) */
  em: string;
  situacao: string;
  desligadoEm: string;
  rotina: RotinaRodando | null;
}

export interface RepoArquivador {
  exemplos: boolean;
  estado(): EstadoDoArquivador;
  /** os últimos pedidos, o mais novo primeiro */
  pedidos(): PedidoDeArquivo[];
  /** a conversa do Claude que roda a rotina e o relatório do dia */
  conversa(): ConversaDaRotina;
  /** as últimas mensagens escritas no nads para o Claude da rotina (a mais nova primeiro) */
  mensagens(): MensagemParaOClaude[];
  /** escreve para o Claude da rotina: o arquivador do PC retoma a sessão com a mensagem (só o admin) */
  mandarMensagem(texto: string, sessao: string): Promise<void>;
  /** o relatório e a mensagem final de uma execução (lê quando pedem) */
  detalhe(execucao: string): DetalheDaExecucao;
  /** as últimas execuções publicadas, a mais nova primeiro */
  execucoesRecentes(): ExecucaoPublicada[];
  /** o resultado de uma execução (null enquanto não chegou) */
  resultado(execucao: string): ResultadoDoArquivamento | null;
  pedir(): Promise<void>;
  cancelar(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos não há PC: o pedido anda sozinho (espera, organiza em etapas e conclui) para ver a tela funcionando. */
export function criarArquivadorMemoria(quem: () => { nome: string } | null): RepoArquivador & { simularRotina(fase: string | null): void } {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const agora = () => new Date().toISOString();
  const pedidos: PedidoDeArquivo[] = [];
  let escritas: MensagemParaOClaude[] = [];
  // a rotina por fora, só para ver a tela (no console: simularRotina('2'); simularRotina(null) para parar)
  let rotina: RotinaRodando | null = null;
  const ETAPAS = ['Ler a pasta Claudio Secretario', 'Identificar o cliente de cada arquivo', 'Mover para as pastas dos clientes', 'Conferir e registrar'];
  return {
    exemplos: true,
    estado: () => ({ carregado: true, semPermissao: false, em: agora(), situacao: pedidos.some(p => p.status === 'processando') ? 'rodando' : 'livre', desligadoEm: '', rotina }),
    conversa: () => ({
      carregada: true, atualizadaEm: rotina ? agora() : '', sessao: 'exemplo',
      mensagens: rotina ? [
        { em: agora(), quem: 'claude', texto: 'Continuo com os separadores que faltam: **23 PDFs** de `593` e `584`. Como há limite de 20 simultâneos, despacho 20 agora e os 3 restantes depois.' },
        { em: agora(), quem: 'voce', texto: 'continue' },
        { em: agora(), quem: 'claude', texto: 'O K001 (balancete 2024) saiu `NAO_IDENTIFICADO`, sem CNPJ do cliente.\n\nPendentes do primeiro lote:\n- L007\n- L016\n- L018' },
      ] : [],
      agentes: rotina ? ['L023', 'L024', 'L025', 'L026', 'L027', 'L028'].map((l, k) => ({ id: 'a' + k, descricao: 'Separa PDF ' + l, tipo: 'separador', em: agora(), status: k < 4 ? 'concluido' as const : 'rodando' as const })) : [],
      relatorio: rotina ? { arquivo: 'RELATORIO-exemplo.txt', em: agora(), texto: 'RELATORIO DA RODADA — Organização Claudio Secretario\nmodo: PRODUCAO (rodadas parciais)\n\nPASTAS PROCESSADAS\n2026-10   587 copiados   Concluída' } : null,
    }),
    mensagens: () => escritas,
    async mandarMensagem(texto) {
      const m = { id: 'ex-' + Date.now(), texto, status: 'pendente', erro: '', criadoEm: agora(), criadoPor: quem()?.nome || 'exemplo' };
      escritas = [m, ...escritas];
      mudou();
      setTimeout(() => { escritas = escritas.map(x => (x.id === m.id ? { ...x, status: 'respondendo' } : x)); mudou(); }, 700);
      setTimeout(() => { escritas = escritas.map(x => (x.id === m.id ? { ...x, status: 'respondida' } : x)); mudou(); }, 2200);
    },
    detalhe: () => ({ carregado: true, relatorio: 'RELATORIO DA EXECUÇÃO (exemplo)\n\n12 arquivos arquivados em 3 clientes; 2 sem cliente.', resposta: 'A rotina terminou com o veredito **OK**.' }),
    execucoesRecentes: () => (rotina ? [
      { id: 'EXEC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-132848', em: agora(), arquivados: 587, naoIdentificados: 1, codigos: ['575', '573'] },
      { id: 'EXEC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-142056', em: agora(), arquivados: 2, naoIdentificados: 3, codigos: ['591', '560'] },
    ] : []),
    simularRotina(fase) {
      rotina = fase == null ? null : { ativa: true, execucao: 'EXEC-exemplo', inicio: new Date(Date.now() - 25 * 60000).toISOString(), modo: 'PRODUCAO', fase, ultimoSinalEm: agora(), deUmPedido: false };
      mudou();
    },
    pedidos: () => pedidos,
    resultado: execucao => (execucao ? {
      arquivados: 12, naoIdentificados: 2, duplicados: 1,
      clientes: [{ codigo: '462', nome: '3M EMPREENDIMENTOS FLORESTAIS LTDA', n: 5 }, { codigo: '356', nome: 'A7 COMERCIO DE VEICULOS LTDA', n: 4 }, { codigo: '205', nome: 'ADEMILSON OLIVEIRA CRUZ', n: 3 }],
    } : null),
    async pedir() {
      const p: PedidoDeArquivo = {
        id: 'p' + Date.now(), status: 'pendente', criadoPor: quem()?.nome || 'alguém', criadoEm: agora(), processandoEm: '', concluidoEm: '', erroEm: '',
        canceladoEm: '', aguardandoMotivo: '', erro: '', passos: 0, progresso: null, andamento: [], execucao: '',
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
          if (feitas >= ETAPAS.length) { clearInterval(r); p.status = 'concluido'; p.concluidoEm = agora(); p.progresso = null; p.execucao = 'EXEC-exemplo'; }
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
