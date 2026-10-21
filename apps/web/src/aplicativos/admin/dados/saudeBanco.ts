// O resumo diário da saúde do banco (robo/saudeBanco, que o robô da nuvem grava uma vez por dia: robo/saude-banco.js).
// No banco: saudeBanco.firestore.ts (lê ao abrir e de novo a cada 15 min enquanto a tela está aberta); nos exemplos: aqui,
// com um resumo de mentira (as datas contadas a partir de agora, para a tela sempre parecer viva).
import { entregas } from '@nads/core';

export interface DocsDaSaudeDoBanco {
  carregado: boolean;
  /** a leitura foi negada (quem não é admin) */
  semPermissao: boolean;
  resumo: entregas.ResumoDaSaudeDoBanco | null;
}

export interface RepoSaudeDoBanco {
  readonly exemplos: boolean;
  docs(): DocsDaSaudeDoBanco;
  /** começa a ler (enquanto a tela está aberta); devolve como parar */
  acompanhar(): () => void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** O resumo de exemplo: 30 dias de uso, as coleções do banco, um órfão e a hospedagem de um projeto só (a outra sem permissão). */
export function resumoDeExemplo(agora = Date.now()): entregas.ResumoDaSaudeDoBanco {
  const ha = (min: number) => new Date(agora - min * 60000).toISOString();
  const dia = (n: number) => new Date(agora - n * 864e5).toISOString().slice(0, 10);
  // o uso de cada dia: dias úteis mais altos, fim de semana baixo, com um pico (o dia 9 atrás)
  const usoPorDia = Array.from({ length: 30 }, (_, i) => {
    const n = 30 - i;
    const d = new Date(agora - n * 864e5);
    const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
    const base = fimDeSemana ? 6200 : 21000 + ((n * 7919) % 9000);
    const pico = n === 9 ? 2.1 : 1;
    return { dia: dia(n), leituras: Math.round(base * pico), gravacoes: Math.round(base * 0.07), exclusoes: Math.round(base * 0.012) };
  });
  const c = (nome: string, total: number, ha7dias: number | null) => ({ nome, total, ha7dias });
  return {
    em: ha(190), dia: dia(0), leiturasGastas: 1484, duracaoMs: 41200,
    colecoes: [
      c('roboAtividade', 8420, 2310), c('rotinas', 6950, 6610), c('cadastro', 2410, 2390), c('clientes', 1860, 1855),
      c('solicitacoesEmail', 1320, 1240), c('pedidosFgts', 980, 850), c('uso', 62, 55), c('feedbacks', 148, 131),
      c('areasCliente', 212, 205), c('extratosRecebidos', 96, 140), c('chamados', 74, 61), c('usuarios', 14, 14),
    ],
    orfaos: [
      { colecao: 'areasCliente', rotulo: 'Espelhos da Área do Cliente sem link', quantos: 2, exemplos: ['k3f9a1c0', 'p7d2e4b8'], erro: '' },
      { colecao: 'feedbacks', rotulo: 'Partes de feedback sem o feedback', quantos: 0, exemplos: [], erro: '' },
      { colecao: 'extratosRecebidos', rotulo: 'Partes de extrato sem o extrato', quantos: 0, exemplos: [], erro: '' },
      { colecao: 'enviosSecretario', rotulo: 'Partes de envio do nads sem o envio', quantos: 0, exemplos: [], erro: '' },
      { colecao: 'pedidosFgts', rotulo: 'Guias do FGTS sem o pedido', quantos: 0, exemplos: [], erro: '' },
      { colecao: 'solicitacoesEmail', rotulo: 'Partes de pedido de e-mail sem o pedido', quantos: 0, exemplos: [], erro: '' },
    ],
    usoPorDia,
    armazenamento: { bytes: 312 * 1024 ** 2, erro: '' },
    hospedagem: [
      { projeto: 'conferencia-nilma', bytes: null, limite: null, enviadoNoMes: null, limiteDeEnvio: null, sites: [],
        erro: 'Permission monitoring.timeSeries.list denied on resource projects/conferencia-nilma' },
      { projeto: 'entregas-2e5e2', bytes: 1.9 * 1024 ** 3, limite: 10 * 1024 ** 3, enviadoNoMes: 2.4 * 1024 ** 3, limiteDeEnvio: 10 * 1024 ** 3,
        sites: [{ site: 'entregas-2e5e2', bytes: 1.4 * 1024 ** 3 }, { site: 'extratudo-entregas', bytes: 0.5 * 1024 ** 3 }], erro: '' },
    ],
    erros: ['hospedagem de conferencia-nilma: sem permissão para ler as métricas'],
  };
}

export function criarSaudeDoBancoMemoria(): RepoSaudeDoBanco {
  let docs: DocsDaSaudeDoBanco = { carregado: true, semPermissao: false, resumo: resumoDeExemplo() };
  let ver = 0;
  const ouvintes = new Set<() => void>();
  return {
    exemplos: true,
    docs: () => docs,
    acompanhar() {
      const r = setInterval(() => { docs = { ...docs, resumo: resumoDeExemplo() }; ver++; for (const f of ouvintes) f(); }, 60 * 1000);
      return () => clearInterval(r);
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
