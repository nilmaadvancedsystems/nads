// O WhatsApp do robô na Central (12/11/2026): a situação do chip (robo/estado.whatsapp) e os pedidos de conectar,
// desconectar e mandar a mensagem de teste. No banco: whatsapp.firestore.ts. Nos exemplos: aqui, um robô de mentira que
// mostra um QR, "conecta" depois de uns segundos e responde ao teste (nada vai para o banco nem para o WhatsApp).
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
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const SEGUNDO = 1000;

export function criarWhatsappMemoria(): RepoWhatsapp {
  let w: r.WhatsappDoRobo = { ...r.WHATSAPP_DESLIGADO, situacao: 'desconectado', motivo: 'ainda não conectado: peça o QR code', teste: ['553891383638'] };
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudar = (parcial: Partial<r.WhatsappDoRobo>) => {
    w = { ...w, ...parcial, atualizadoEm: new Date().toISOString() };
    ver++;
    for (const f of ouvintes) f();
  };
  const esperar = (ms: number) => new Promise(ok => setTimeout(ok, ms));
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
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
