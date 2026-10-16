// A NFS-e por e-mail ao cliente (15/10/2026): quando a nota sai, o robô da nuvem manda para o e-mail do tomador a DANFSe
// (PDF) e o XML, se o admin ligou em Financeiro › Configurações › E-mail ao cliente. Também sob pedido, pela janela da nota.
// Aqui: a configuração (config/nfse.email), o que o nads e o robô gravam na nota e o texto do e-mail. Puro: o robô usa
// estas mesmas funções pelo pacote gerado (robo/gerado/danfse.js, scripts/robo-danfse.mjs).
import { reais } from '../formatos';

/** config/nfse.email: o envio automático e o modelo do e-mail ({cliente}, {numero}, {valor}, {competencia}) */
export interface ConfigEmailNfse {
  automatico: boolean;
  assunto: string;
  texto: string;
}

/** nfseEmissoes/{id}.email — o robô grava: o último envio (ou o erro dele) */
export interface EmailDaNota {
  para: string;
  /** ISO; vazio enquanto não saiu */
  enviadoEm: string;
  erro: string;
}

/** nfseEmissoes/{id}.envioEmail — o nads grava (o pedido manual); o robô envia e apaga */
export interface PedidoDeEmail {
  para: string;
  pedidoPor: string;
  pedidoEm: string;
}

export const EMAIL_PADRAO: ConfigEmailNfse = {
  automatico: false,
  assunto: 'NFS-e {numero} — Nilma Contabilidade',
  texto: 'Olá, {cliente}!\n\nSegue a nota fiscal de serviço nº {numero}, no valor de {valor}, referente a {competencia}. A DANFSe (PDF) e o XML vão anexados.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade',
};

/** O aviso que abre o texto de uma nota de homologação (só no envio manual: o automático não manda essas). */
export const AVISO_SEM_VALOR = 'Atenção: esta é uma nota de teste (homologação), SEM VALOR FISCAL.';

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()) && String(e).trim().length <= 150;

/** A configuração do e-mail como veio do banco, completada com a padrão (assunto ou texto vazio = o padrão). */
export function configDoEmail(v: unknown): ConfigEmailNfse {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  return { automatico: o.automatico === true, assunto: t(o.assunto) || EMAIL_PADRAO.assunto, texto: t(o.texto) || EMAIL_PADRAO.texto };
}

/** AAAA-MM-DD → MM/AAAA ('' quando não é data) */
const mesAno = (iso: string) => { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? m[2] + '/' + m[1] : ''; };

/** Troca {cliente}, {numero}, {valor} e {competencia} pelos dados da nota (o que não conhece fica como está). */
export function preencherModelo(modelo: string, campos: Record<string, string>): string {
  return String(modelo || '').replace(/\{(\w+)\}/g, (tudo, nome: string) => (Object.prototype.hasOwnProperty.call(campos, nome) ? campos[nome] : tudo));
}

type NotaDoEmail = { tomador: { nome: string }; numeroNfse: string; servico: { valor: number; competencia: string }; ambiente: string };

/** Os campos do modelo: {cliente}, {numero}, {valor} ("R$ 1.250,50") e {competencia} ("09/2026"). */
export function camposDaNota(n: NotaDoEmail): Record<'cliente' | 'numero' | 'valor' | 'competencia', string> {
  return {
    cliente: String(n.tomador.nome || '').trim(),
    numero: String(n.numeroNfse || ''),
    valor: reais(Number(n.servico.valor) || 0).replace(/[\u00a0\u202f]/g, ' '),
    competencia: mesAno(n.servico.competencia),
  };
}

/** O assunto e o texto do e-mail da nota. Homologação: o assunto e o texto avisam que não tem valor fiscal. */
export function mensagemDaNota(n: NotaDoEmail, email: ConfigEmailNfse = EMAIL_PADRAO): { assunto: string; texto: string } {
  const campos = camposDaNota(n);
  const teste = n.ambiente === 'homologacao';
  const assunto = preencherModelo(email.assunto || EMAIL_PADRAO.assunto, campos).replace(/\s+/g, ' ').trim();
  const texto = preencherModelo(email.texto || EMAIL_PADRAO.texto, campos).replace(/\r\n?/g, '\n').trim();
  return { assunto: (teste ? '[SEM VALOR FISCAL] ' : '') + assunto, texto: teste ? AVISO_SEM_VALOR + '\n\n' + texto : texto };
}
