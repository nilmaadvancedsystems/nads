// O lote de boletos de honorários (10/11/2026). Interface + a versão de exemplo: nada aqui grava no banco nem manda e-mail; o
// disparo só simula o caminho (na fila, enviando, enviado ou erro). A versão do banco e o envio pelo robô vêm nas próximas etapas.
import { financeiro } from '@nads/core';
import type { ListaAoVivo } from './agentes';

export type BoletoNovo = Omit<financeiro.BoletoDoLote, 'id'>;

export interface RepoBoletos {
  readonly exemplos: boolean;
  /** os boletos de todas as competências (ao vivo) */
  boletos(): ListaAoVivo<financeiro.BoletoDoLote>;
  /** os e-mails do cadastro do cliente do contrato */
  emailsDoContrato(contratoId: string): string[];
  adicionar(novos: BoletoNovo[]): Promise<void>;
  alterar(id: string, mudar: Partial<Omit<financeiro.BoletoDoLote, 'id'>>): Promise<void>;
  /** põe os boletos na fila de envio */
  disparar(ids: string[], quem: string): Promise<void>;
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
    boletos: () => ({ carregada: true, lista: [...boletos], erro: '' }),
    emailsDoContrato: id => [...(EMAILS[id] ?? [])],
    async adicionar(novos) { boletos = [...boletos, ...novos.map(n => ({ ...n, id: 'novo' + proximo++ }))]; mudou(); },
    async alterar(id, mudar) { alterar(id, mudar); },
    async disparar(ids, quem) {
      for (const id of ids) {
        const para = boletos.find(x => x.id === id)?.destinatarios ?? [];
        const envio = (status: financeiro.StatusDoEnvio, erro?: string): financeiro.EnvioDoBoleto => ({ status, para, em: new Date().toISOString(), por: quem, ...(erro ? { erro } : {}) });
        alterar(id, { envio: envio('fila') });
        setTimeout(() => alterar(id, { envio: envio('enviando') }), 700);
        setTimeout(() => {
          const recusa = para.some(e => e.includes('recusa'));
          alterar(id, { envio: recusa ? envio('erro', 'O servidor do cliente recusou o e-mail: caixa cheia.') : envio('enviado') });
        }, 1500);
      }
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
