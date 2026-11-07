// Os dados da Central dos robôs. No banco (central.firestore.ts): os batimentos do painel (robo/painelPC, robo/painelVM),
// o estado de cada máquina (robosMaquinas), a atividade (roboAtividade), os comandos (robosComandos) e o espelho do log
// de cada robô (robosRegistros/{robo}, só enquanto a aba Registros está aberta). Nos exemplos: aqui, com as três máquinas
// de mentira e um robô de mentira que responde aos comandos (nada vai para o banco).
import { entregas, robos as r } from '@nads/core';

export interface DocsDaCentral {
  carregado: boolean;
  /** a leitura foi negada (quem não é admin) */
  semPermissao: boolean;
  batimentos: { servidor: entregas.BatimentoDoRobo | null; nuvem: entregas.BatimentoDoRobo | null };
  maquinas: Record<r.IdMaquina, r.EstadoDaMaquina | null>;
  atividades: entregas.AtividadeDoRobo[];
  comandos: r.Comando[];
}

/** O que a tela pede (porNome: o nome de quem está na tela, para o histórico). */
export interface PedidoDaTela { robo: string; acao: string; tarefa?: string; maquina?: string; porNome?: string }

export interface RepoCentral {
  readonly exemplos: boolean;
  docs(): DocsDaCentral;
  /** começa a ouvir (enquanto o site está aberto); devolve como parar */
  acompanhar(): () => void;
  /** o espelho do log de um robô, ao vivo enquanto a aba Registros está aberta (pede ao robô o "ao vivo") */
  registros(robo: string): r.RegistrosDoRobo;
  acompanharRegistros(robo: string): () => void;
  /** grava o comando (robosComandos) e devolve o id; o robô responde no próprio documento */
  pedir(p: PedidoDaTela): Promise<string>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

// ---------- os exemplos ----------

const MIN = 60 * 1000;

/** As três máquinas e a atividade de exemplo, com as horas contadas a partir de agora (a tela sempre parece viva). */
export function docsDeExemplo(agora = Date.now()): DocsDaCentral {
  const ha = (min: number) => new Date(agora - min * MIN).toISOString();
  const hoje = new Date(agora).toLocaleDateString('pt-BR');
  const servidor = entregas.lerBatimento('pc', {
    robo: 'pc', maquina: 'NILMA-SERVER', versao: '47205cc de ' + hoje, ligadoEm: ha(372), em: ha(0.4),
    agora: [
      { chave: 'fgts', texto: 'Emitindo FGTS 3/10 — 62 AGROPECUÁRIA EXEMPLO (10/2026)', desde: ha(4) },
      { chave: 'sieg', texto: 'SIEG: baixando os XMLs de 292', desde: ha(1) },
    ],
    modulos: [
      { id: 'arquivamento', nome: 'Arquivamento', ligado: true }, { id: 'fgts', nome: 'FGTS Digital', ligado: true },
      { id: 'alterdata', nome: 'Alterdata', ligado: true }, { id: 'sieg', nome: 'SIEG', ligado: true },
    ],
    filas: [
      { id: 'arquivamento', nome: 'Arquivamento', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'fgts', nome: 'FGTS Digital', esperando: 7, andamento: 1, maisAntigoEm: ha(14) },
      { id: 'alterdata', nome: 'Alterdata (balancete e razão)', esperando: 2, andamento: 0, maisAntigoEm: ha(75) },
      { id: 'sieg', nome: 'SIEG', esperando: 0, andamento: 1, maisAntigoEm: ha(2) },
    ],
  });
  const nuvem = entregas.lerBatimento('vm', {
    robo: 'vm', maquina: 'robo-nilma', versao: '47205cc de ' + hoje + ' · 2026-11-07a', ligadoEm: ha(60 * 26), em: ha(0.2),
    agora: [{ chave: 'gmail', texto: 'Lendo o Gmail (automático a cada 120 min)', desde: ha(1) }],
    modulos: [
      { id: 'gmail', nome: 'Gmail e cobranças', ligado: true }, { id: 'envios', nome: 'Envios do nads', ligado: true },
      { id: 'nfse', nome: 'NFS-e dos honorários', ligado: true }, { id: 'sefaz', nome: 'Situação na SEFAZ', ligado: true },
    ],
    filas: [
      { id: 'gmail', nome: 'Gmail e cobranças', esperando: 0, andamento: 1, maisAntigoEm: ha(1) },
      { id: 'nfse', nome: 'NFS-e dos honorários', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'sefaz', nome: 'Situação na SEFAZ', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'envios', nome: 'Envios do nads', esperando: 3, andamento: 0, maisAntigoEm: ha(6) },
    ],
  });
  const estado = (maquina: r.IdMaquina, host: string, em: number, sinais: Partial<r.SinaisDaMaquina>, extra: Record<string, unknown> = {}) =>
    r.lerEstadoDaMaquina(maquina, { host, em: ha(em), ligadoEm: ha(372), versao: '47205cc', sinais, pausados: {}, ...extra });
  const atividade = (id: string, min: number, robo: 'pc' | 'vm', tipo: string, texto: string, detalhe = '', erro = false): entregas.AtividadeDoRobo =>
    ({ id, em: ha(min), robo, maquina: robo === 'pc' ? 'NILMA-SERVER' : 'robo-nilma', tipo, texto, detalhe, erro });
  return {
    carregado: true, semPermissao: false,
    batimentos: { servidor, nuvem },
    maquinas: {
      servidor: estado('servidor', 'NILMA-SERVER', 0.4, { cpu: 34, memoria: 71, disco: 58, discoLivreGb: 412, ligadaHa: 9 * 86400 + 4 * 3600 }),
      nuvem: estado('nuvem', 'robo-nilma', 0.2, { cpu: 12, memoria: 46, disco: 39, discoLivreGb: 18, ligadaHa: 26 * 3600 }, { semGancho: ['atualizar'] }),
      escritorio: estado('escritorio', 'DPTO-FISCAL-004', 1.1, { cpu: 22, memoria: 63, disco: 81, discoLivreGb: 44, ligadaHa: 5 * 3600 },
        { pausados: { ia: { por: 'Vitor', em: ha(48) } }, semGancho: ['atualizar'] }),
    },
    atividades: [
      atividade('a1', 3, 'pc', 'sieg', 'Baixou 48 XMLs da 292 (10/2026)', 'portal do SIEG'),
      atividade('a2', 9, 'pc', 'fgts', 'Emitiu a guia do FGTS de 145 COMÉRCIO EXEMPLO (10/2026)', 'guia 8821 · R$ 1.234,56'),
      atividade('a3', 16, 'vm', 'gmail', 'Leu o Gmail: 12 e-mails, 9 anexos de 7 clientes'),
      atividade('a4', 31, 'pc', 'alterdata', 'O balancete da 205 não saiu', 'a janela do Contábil não respondeu em 2 min', true),
      atividade('a5', 44, 'pc', 'arquivamento', 'Arquivou 26 arquivos de 11 clientes', '2 não identificados'),
      atividade('a6', 58, 'vm', 'envios', 'Enviou os documentos do DP para 301 EXEMPLO LTDA'),
      atividade('a7', 75, 'vm', 'nfse', 'Emitiu a NFS-e 1.204 dos honorários (10/2026)'),
      atividade('a8', 92, 'vm', 'sefaz', 'Situação na SEFAZ: 3 notas conferidas'),
      atividade('a9', 120, 'pc', 'fgts', 'A guia do FGTS de 77 EXEMPLO não saiu', 'o login no FGTS Digital não foi', true),
      atividade('a10', 140, 'vm', 'cobranca', 'Cobrança enviada para 14 clientes'),
      atividade('a11', 200, 'pc', 'alterdata', 'Tirou o razão da 571 (01 a 10/2026)'),
    ],
    comandos: [
      { id: 'c1', maquina: 'servidor', robo: 'sieg', acao: 'limpar-fila', tarefa: '', por: 'uid-vitor', porNome: 'Vitor', em: ha(130), status: 'feito', mensagem: '2 pedidos travados viraram erro.', respondidoEm: ha(130) },
      { id: 'c2', maquina: 'escritorio', robo: 'ia', acao: 'pausar', tarefa: '', por: 'uid-vitor', porNome: 'Vitor', em: ha(48), status: 'feito', mensagem: 'Pausado.', respondidoEm: ha(48) },
      { id: 'c3', maquina: 'nuvem', robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail', por: 'uid-vitor', porNome: 'Vitor', em: ha(20), status: 'feito', mensagem: 'Pedido na fila do Gmail.', respondidoEm: ha(20) },
    ],
  };
}

const FRASES: Record<string, string[]> = {
  arquivador: ['lendo a pasta de entrada (312 arquivos)', 'arquivou NOTA 1234.pdf em 205 EXEMPLO/FISCAL/10', 'não identificado: scan_0012.pdf', 'índice do Drive em dia'],
  sieg: ['pedido 292 (10/2026): portal do SIEG', 'baixando o zip do período', '48 XMLs novos, 12 já arquivados', 'pedido 292 concluído'],
  fgts: ['abrindo o FGTS Digital pela extensão', 'empresa 62: competência 10/2026', 'guia emitida: 8821', 'salvo em 62 EXEMPLO/DEPARTAMENTO PESSOAL/10/FGTS'],
  alterdata: ['pedido do balancete da 205', 'abrindo o Contábil', 'ERRO: a janela do Contábil não respondeu em 2 min', 'tentando de novo em 1 min'],
  vigia: ['lendo o Gmail (3 dias)', '12 e-mails, 9 anexos', 'cobrança: 14 clientes', 'backup do dia: ok (412 MB)'],
  nfse: ['NFS-e 1.204: DPS enviada', 'NFS-e 1.204: autorizada'],
  envios: ['lote do DP: 301 EXEMPLO LTDA', 'enviado para o cliente (3 arquivos)'],
  sefaz: ['situação das notas: 3 conferidas'],
  ia: ['pausado pela Central dos robôs'],
  suporte: ['chamado 88: respondido', 'esperando chamados'],
};

function registrosDeExemplo(robo: string, agora = Date.now()): r.RegistrosDoRobo {
  const frases = FRASES[robo] || ['sem registros ainda'];
  const n = 60;
  const linhas = Array.from({ length: n }, (_, i) => {
    const texto = frases[i % frases.length];
    return { em: new Date(agora - (n - i) * 23000).toISOString(), texto, nivel: (texto.startsWith('ERRO') ? 'erro' : 'info') as 'info' | 'erro' };
  });
  return { robo, em: new Date(agora).toISOString(), linhas, aoVivoAte: '' };
}

/** O repositório na memória: o robô de mentira aceita o comando em 1 s e responde em 2,5 s. */
export function criarCentralMemoria(): RepoCentral {
  let docs = docsDeExemplo();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const regs = new Map<string, r.RegistrosDoRobo>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const trocarComando = (id: string, parcial: Partial<r.Comando>) => {
    docs = { ...docs, comandos: docs.comandos.map(c => (c.id === id ? { ...c, ...parcial } : c)) };
    mudou();
  };
  return {
    exemplos: true,
    docs: () => docs,
    acompanhar() {
      // as horas andam: a cada 30 s, os exemplos de novo (com os comandos feitos aqui)
      const t = setInterval(() => { const comandos = docs.comandos; const maquinas = docs.maquinas; docs = { ...docsDeExemplo(), comandos, maquinas }; mudou(); }, 30000);
      return () => clearInterval(t);
    },
    registros(robo) {
      if (!regs.has(robo)) regs.set(robo, registrosDeExemplo(robo));
      return regs.get(robo)!;
    },
    acompanharRegistros(robo) {
      // uma linha nova a cada 4 s, como o "ao vivo" do robô
      let i = 0;
      const t = setInterval(() => {
        const atual = regs.get(robo) || registrosDeExemplo(robo);
        const frases = FRASES[robo] || ['ainda aqui'];
        const linha = { em: new Date().toISOString(), texto: frases[i++ % frases.length], nivel: 'info' as const };
        regs.set(robo, { ...atual, em: linha.em, linhas: [...atual.linhas, linha].slice(-r.LINHAS_DO_REGISTRO) });
        mudou();
      }, 4000);
      return () => clearInterval(t);
    },
    async pedir(p) {
      const d = r.montarComando(p, { uid: 'uid-exemplo', nome: p.porNome || 'Vitor' });
      const id = 'ex-' + Date.now().toString(36);
      docs = { ...docs, comandos: [{ id, ...d, mensagem: '', respondidoEm: '' }, ...docs.comandos] };
      mudou();
      setTimeout(() => trocarComando(id, { status: 'aceito', mensagem: 'Recebi.', respondidoEm: new Date().toISOString() }), 1000);
      setTimeout(() => {
        const m = docs.maquinas[d.maquina];
        if (m && (d.acao === 'pausar' || d.acao === 'retomar')) {
          const pausados = { ...m.pausados };
          if (d.acao === 'pausar') pausados[d.robo] = { por: 'Vitor', em: new Date().toISOString() };
          else delete pausados[d.robo];
          docs = { ...docs, maquinas: { ...docs.maquinas, [d.maquina]: { ...m, pausados } } };
        }
        trocarComando(id, { status: 'feito', mensagem: 'Feito (exemplo: nada foi para o robô de verdade).', respondidoEm: new Date().toISOString() });
      }, 2500);
      return id;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
