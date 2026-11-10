// O lote de boletos de honorários (10/11/2026). Interface + a versão de exemplo, em que nada grava no banco nem manda e-mail: o
// disparo só simula o caminho (na fila, enviando, enviado ou erro). A versão do banco é boletos.firestore.ts.
import { financeiro } from '@nads/core';
import type { ListaAoVivo } from './agentes';

/** o boleto lido na tela, com os bytes do PDF (que vão para o banco em pedaços) */
export type BoletoNovo = Omit<financeiro.BoletoDoLote, 'id'> & { bytes: Uint8Array };
/** o que a revisão muda: o cliente, para quem vai e o tirar do lote; o lido do PDF não muda */
export type MudancaDoBoleto = Partial<Pick<financeiro.BoletoDoLote, 'contratoId' | 'achadoPor' | 'destinatarios' | 'fora'>>;

export interface RepoBoletos {
  readonly exemplos: boolean;
  /** os boletos da competência (ao vivo) */
  boletos(competencia: string): ListaAoVivo<financeiro.BoletoDoLote>;
  /** os e-mails do cadastro do cliente do contrato */
  emailsDoContrato(contrato: financeiro.ContratoDeHonorario): Promise<string[]>;
  adicionar(novos: BoletoNovo[], andamento?: (feitos: number, total: number) => void): Promise<void>;
  alterar(id: string, mudar: MudancaDoBoleto): Promise<void>;
  /** põe os boletos na fila de envio (o robô manda) */
  disparar(boletos: readonly financeiro.BoletoDoLote[]): Promise<void>;
  /** os bytes do PDF (null quando não há) */
  pdf(id: string): Promise<Uint8Array | null>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const EMAILS: Record<string, string[]> = {
  h1: ['financeiro@alfa.exemplo.com.br'], h2: ['contato@beta.exemplo.com.br', 'dono@beta.exemplo.com.br'], h3: ['adm@gama.exemplo.com.br'], h4: ['padaria@delta.exemplo.com.br'],
  h5: [], h7: ['eta@agro.exemplo.com.br'], h8: ['financeiro@recusa.exemplo.com.br'],
};
const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Nos exemplos: uma linha de cada situação, na competência que a tela abre. */
export function criarBoletosMemoria(): RepoBoletos {
  let ver = 0, proximo = 1;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const pdfs = new Map<string, Uint8Array>();
  const competencia = financeiro.competenciaAnterior(hojeIso());
  const dia28 = financeiro.vencimentoDoContrato(28, competencia);
  const LINHA = '75691000090000000000000000000000000000000000000';
  const b = (id: string, contratoId: string, arquivo: string, valor: number | null, extra: Partial<financeiro.BoletoDoLote> = {}): financeiro.BoletoDoLote => ({
    id, competencia, arquivo, contratoId, achadoPor: contratoId ? 'documento' : '', linha: valor == null ? '' : LINHA, valor, vencimento: valor == null ? null : dia28,
    destinatarios: EMAILS[contratoId] ?? [], ...extra,
  });
  let boletos: financeiro.BoletoDoLote[] = [
    b('b1', 'h1', 'Boleto ALFA.pdf', 850),
    b('b2', 'h2', 'Boleto BETA.pdf', 420),
    b('b3', 'h3', 'Boleto GAMA.pdf', 1200, { envio: { status: 'enviado', para: EMAILS.h3, em: new Date().toISOString(), por: 'Exemplo' } }),
    b('b4', 'h4', 'Boleto DELTA.pdf', 300),
    b('b5', 'h5', 'Boleto EPSILON.pdf', 650),
    b('b7', 'h7', 'Boleto ETA.pdf', 910),
    b('b8', 'h8', 'Boleto TETA.pdf', 1500, { envio: { status: 'erro', para: EMAILS.h8, em: new Date().toISOString(), por: 'Exemplo', erro: 'O servidor do cliente recusou o e-mail: caixa cheia.' } }),
    b('b9', '', 'Fatura_SEM_IDENTIFICACAO.pdf', 450),
    b('b10', '', 'digitalizado.pdf', null),
  ];
  const alterar = (id: string, mudar: Partial<financeiro.BoletoDoLote>) => { boletos = boletos.map(x => (x.id === id ? { ...x, ...mudar } : x)); mudou(); };
  return {
    exemplos: true,
    boletos: c => ({ carregada: true, lista: boletos.filter(x => x.competencia === c), erro: '' }),
    emailsDoContrato: async c => [...(EMAILS[c.id] ?? [])],
    async adicionar(novos, andamento) {
      novos.forEach(({ bytes, ...n }, i) => { const id = 'novo' + proximo++; pdfs.set(id, bytes); boletos = [...boletos, { ...n, id }]; andamento?.(i + 1, novos.length); });
      mudou();
    },
    async alterar(id, mudar) { alterar(id, mudar); },
    async disparar(lista) {
      for (const x of lista) {
        const envio = (status: financeiro.StatusDoEnvio, erro?: string): financeiro.EnvioDoBoleto => ({ status, para: x.destinatarios, em: new Date().toISOString(), por: 'Exemplo', ...(erro ? { erro } : {}) });
        alterar(x.id, { envio: envio('fila') });
        setTimeout(() => alterar(x.id, { envio: envio('enviando') }), 700);
        setTimeout(() => {
          const recusa = x.destinatarios.some(e => e.includes('recusa'));
          alterar(x.id, { envio: recusa ? envio('erro', 'O servidor do cliente recusou o e-mail: caixa cheia.') : envio('enviado') });
        }, 1500);
      }
    },
    pdf: async id => pdfs.get(id) ?? null,
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
