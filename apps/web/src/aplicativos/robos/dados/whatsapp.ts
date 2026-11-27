// O WhatsApp do robô na Central (12/11/2026): a situação do chip (robo/estado.whatsapp) e os pedidos de conectar,
// desconectar e mandar a mensagem de teste. No banco: whatsapp.firestore.ts. Nos exemplos: aqui, um robô de mentira que
// mostra um QR, "conecta" depois de uns segundos e responde ao teste (nada vai para o banco nem para o WhatsApp).
// Desde 27/11/2026: as chaves do que o robô faz pelo WhatsApp (config/whatsapp) e as respostas dos clientes (últimos 7 dias).
import { robos as r } from '@nads/core';

export type ComandoDoWhatsapp = 'conectar' | 'desconectar';

export interface RepoWhatsapp {
  readonly exemplos: boolean;
  /** a situação (ao vivo enquanto `acompanhar`) */
  situacao(): r.WhatsappDoRobo;
  acompanhar(): () => void;
  /** pede ao robô (fila do Gmail) e espera ele responder; erro = o motivo dele; 'na-fila' = ainda não pegou */
  comandar(c: ComandoDoWhatsapp, por: string): Promise<'feito' | 'na-fila'>;
  /** manda o texto para o número de teste (o do escritório) e espera o robô; erro = o motivo dele */
  testar(numero: string, texto: string, por: string): Promise<'feito' | 'na-fila'>;
  /** as chaves de config/whatsapp (lidas uma vez, quando a aba abre) */
  chaves(): Promise<r.ChavesDoWhatsapp>;
  /** grava as chaves (só o admin, pela regra do banco) */
  gravarChaves(c: r.ChavesDoWhatsapp, por: string): Promise<void>;
  /** as respostas dos últimos 7 dias, da mais nova para a mais velha (uma leitura, quando a pessoa pede) */
  respostas(): Promise<r.RespostaRecebida[]>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const SEGUNDO = 1000;

export function criarWhatsappMemoria(): RepoWhatsapp {
  let w: r.WhatsappDoRobo = { ...r.WHATSAPP_DESLIGADO, situacao: 'desconectado', motivo: 'ainda não conectado: peça o QR code', teste: ['553899197340', '553891383638'] };
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudar = (parcial: Partial<r.WhatsappDoRobo>) => {
    w = { ...w, ...parcial, atualizadoEm: new Date().toISOString() };
    ver++;
    for (const f of ouvintes) f();
  };
  const esperar = (ms: number) => new Promise(ok => setTimeout(ok, ms));
  let chaves: r.ChavesDoWhatsapp = { ...r.CHAVES_DESLIGADAS };
  const agora = Date.now();
  const respostas = [
    r.lerRespostaRecebida('ex1', { tipo: 'whatsapp', origem: 'boleto', clienteNome: 'Padaria Boa (exemplo)', teste: true, respondidoEm: new Date(agora - 3600000).toISOString(),
      respostas: { r1: { em: new Date(agora - 3600000).toISOString(), tipo: 'pdf', texto: 'pago', arquivo: 'comprovante.pdf' } } }),
    r.lerRespostaRecebida('ex2', { tipo: 'whatsapp-recebida', origem: 'autoatendimento', pedeEscritorio: true, empresa: 'Mercado Bom (exemplo)', numero: '5538999990000',
      respondidoEm: new Date(agora - 2 * 86400000).toISOString(), ultimaResposta: 'pediu para falar com o escritório' }),
  ];
  return {
    exemplos: true,
    situacao: () => w,
    acompanhar: () => () => {},
    async comandar(c) {
      await esperar(600);
      if (c === 'desconectar') { mudar({ situacao: 'desconectado', numero: '', nome: '', desde: '', qr: '', pronto: false, motivo: 'desconectado (exemplo)' }); return 'feito'; }
      mudar({ situacao: 'aguardando-qr', qr: 'exemplo-do-qr-code-do-nads', motivo: '', pronto: false });
      setTimeout(() => mudar({ situacao: 'conectado', qr: '', numero: '5538999990000', nome: 'Nilma Contabilidade', desde: new Date().toISOString(), motivo: '', pronto: true }), 6 * SEGUNDO);
      return 'feito';
    },
    async testar() {
      await esperar(1200);
      if (!w.pronto) throw new Error('o WhatsApp do robô não está conectado (exemplo)');
      return 'feito';
    },
    async chaves() { await esperar(300); return { ...chaves }; },
    async gravarChaves(c, por) {
      await esperar(500);
      chaves = r.lerChaves(r.chavesParaGravar(c, por, new Date().toISOString()));
      mudar({ liberado: chaves.liberado });
    },
    async respostas() { await esperar(400); return respostas; },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
