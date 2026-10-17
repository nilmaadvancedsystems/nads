// O emissor de NFS-e do financeiro (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): as notas de
// honorários da Nilma (o escritório presta, o cliente toma), na prefeitura de Taiobeiras/MG, sistema da E&L no padrão
// DPS da NFS-e Nacional. O nads grava o pedido (nfseEmissoes, banco do Entregas); o robô da nuvem monta a DPS, assina com
// o certificado do escritório, envia com o token da prefeitura, consulta até sair a nota e cancela quando pedem.
// Aqui: os tipos, os nomes das situações e o que confere o pedido e a configuração (puro, sem banco).
import { EMAIL_PADRAO, type ConfigEmailNfse, type EmailDaNota, type PedidoDeEmail } from './email';

export type AmbienteNfse = 'homologacao' | 'producao';

/** pedida → enviando → processando → autorizada | erro; cancelamento-pedido → cancelada | erro-cancelamento */
export type StatusNfse = 'pedida' | 'enviando' | 'processando' | 'autorizada' | 'erro' | 'cancelamento-pedido' | 'cancelada' | 'erro-cancelamento';

export interface TomadorNfse {
  /** só os dígitos: 11 (CPF) ou 14 (CNPJ) */
  documento: string;
  nome: string;
  email?: string;
  /** só os dígitos, com o DDD */
  fone?: string;
  /** o endereço (opcional; se vier, completo): o município pelo IBGE */
  endereco?: { cMun: string; cep: string; logradouro: string; numero: string; bairro: string };
}

export interface ServicoNfse {
  descricao: string;
  valor: number;
  /** AAAA-MM-DD: a data do serviço (o fato gerador), como no portal da prefeitura */
  competencia: string;
}

export interface ErroNfse { codigo: string; descricao: string }

export interface NotaFiscal {
  id: string;
  status: StatusNfse;
  ambiente: AmbienteNfse;
  tomador: TomadorNfse;
  servico: ServicoNfse;
  /** o cliente no nads (o código do ERP), quando a nota é de um cliente da lista */
  empresaCodigo: number | null;
  pedidoPor: string;
  pedidoEm: string;
  dps: { serie: string; numero: number; id: string } | null;
  chaveAcesso: string;
  numeroNfse: string;
  erros: ErroNfse[];
  atualizadoEm: string;
  /** quando o robô mandou para a prefeitura, quantas vezes já consultou e quando saiu a nota (o andamento) */
  enviadaEm: string;
  consultas: number;
  autorizadaEm: string;
  cancelamento: { cMotivo: string; motivo: string; pedidoPor: string; pedidoEm: string } | null;
  /** o último envio da nota por e-mail ao tomador (o robô grava) */
  email?: EmailDaNota | null;
  /** o pedido de envio por e-mail feito no nads, até o robô atender */
  envioEmail?: PedidoDeEmail | null;
}

/** A configuração do emissor (config/nfse): o prestador (a Nilma), o serviço e a numeração. */
export interface ConfigNfse {
  ambiente: AmbienteNfse;
  prestador: {
    cnpj: string;
    /** a inscrição municipal, como no cadastro da prefeitura (com os zeros) */
    im: string;
    fone: string;
    /** 1 não optante; 2 MEI; 3 ME/EPP do Simples */
    opSimpNac: 1 | 2 | 3;
    /** no Simples (3): 1 tudo pelo Simples; 2 ISS fora do Simples; 3 tudo fora do Simples */
    regApTribSN: 1 | 2 | 3 | null;
    /** 0 nenhum regime especial */
    regEspTrib: number;
    /** o município do prestador (IBGE): Taiobeiras 3168002 */
    cLocEmi: string;
  };
  servico: {
    /** o código de tributação nacional (6 dígitos): contabilidade 17.19 → 171901 */
    cTribNac: string;
    /** o código do serviço no cadastro da prefeitura (obrigatório na E&L) */
    cIntContrib: string;
    /** o código NBS (9 dígitos) */
    cNBS: string;
    /** a alíquota do ISS (%), quando o regime pede */
    pAliq: number | null;
    /** as informações complementares (a frase do IBPT) */
    infoCompl: string;
  };
  serie: string;
  proximoNumero: Record<AmbienteNfse, number>;
  /** a nota autorizada por e-mail ao tomador (o robô manda a DANFSe e o XML) */
  email: ConfigEmailNfse;
}

export const CONFIG_PADRAO: ConfigNfse = {
  ambiente: 'homologacao',
  // os da Nilma, tirados de uma nota autorizada pelo portal (14/10/2026): Simples (ME/EPP), contabilidade 17.19
  prestador: { cnpj: '27872981000113', im: '250517/6308', fone: '', opSimpNac: 3, regApTribSN: 1, regEspTrib: 0, cLocEmi: '3168002' },
  servico: { cTribNac: '171901', cIntContrib: '1719', cNBS: '113022100', pAliq: 3.74, infoCompl: 'Percentual aproximado de tributos: 16,42% Fonte: IBPT' },
  serie: '1',
  proximoNumero: { homologacao: 1, producao: 1 },
  email: EMAIL_PADRAO,
};

export const soDigitos = (v: string) => String(v || '').replace(/\D/g, '');

const ROTULOS: Record<StatusNfse, { rotulo: string; tom: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  pedida: { rotulo: 'Na fila', tom: 'neutral' },
  enviando: { rotulo: 'Enviando', tom: 'neutral' },
  processando: { rotulo: 'Na prefeitura', tom: 'warn' },
  autorizada: { rotulo: 'Autorizada', tom: 'ok' },
  erro: { rotulo: 'Recusada', tom: 'bad' },
  'cancelamento-pedido': { rotulo: 'Cancelando', tom: 'warn' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
  'erro-cancelamento': { rotulo: 'Cancelamento recusado', tom: 'bad' },
};
export const rotuloDoStatus = (s: StatusNfse) => ROTULOS[s] || { rotulo: s, tom: 'neutral' as const };
/** ainda andando (o robô vai mexer): a tela mostra a rodinha */
export const andando = (s: StatusNfse) => s === 'pedida' || s === 'enviando' || s === 'processando' || s === 'cancelamento-pedido';

/** Os motivos de cancelamento da NFS-e Nacional (evento e101101). */
export const MOTIVOS_DE_CANCELAMENTO: { id: '1' | '2' | '9'; rotulo: string }[] = [
  { id: '1', rotulo: 'Erro na emissão' },
  { id: '2', rotulo: 'Serviço não prestado' },
  { id: '9', rotulo: 'Outros' },
];

/** O último dia do mês de uma competência AAAA-MM (a data que vai na DPS). */
export function competenciaDaNota(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes || '');
  if (!m) return '';
  const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return m[1] + '-' + m[2] + '-' + String(ultimo).padStart(2, '0');
}

/** O CPF ou o CNPJ confere (os dígitos verificadores). */
export function documentoValido(doc: string): boolean {
  const d = soDigitos(doc);
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false;
    const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false;
    const dv = (n: number) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * pesos[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  return false;
}

/** O que falta ou está errado no pedido de uma nota (vazio: pode pedir). */
export function conferirPedido(p: { tomador: TomadorNfse; servico: ServicoNfse }): string[] {
  const erros: string[] = [];
  if (!documentoValido(p.tomador.documento)) erros.push('O CPF ou CNPJ do tomador não confere.');
  if (p.tomador.nome.trim().length < 2) erros.push('Falta o nome do tomador.');
  if (p.tomador.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.tomador.email.trim())) erros.push('O e-mail do tomador não parece um e-mail.');
  if (p.servico.descricao.trim().length < 5) erros.push('Descreva o serviço (pelo menos 5 letras).');
  if (p.servico.descricao.length > 2000) erros.push('A descrição passa de 2.000 caracteres.');
  if (!(p.servico.valor > 0)) erros.push('O valor precisa ser maior que zero.');
  if (p.tomador.fone && !/^\d{10,11}$/.test(soDigitos(p.tomador.fone))) erros.push('O telefone do tomador precisa do DDD (10 ou 11 dígitos).');
  const e = p.tomador.endereco;
  // tomador CNPJ: a NFS-e Nacional exige o endereço (15/10/2026: a primeira nota em produção voltou com o E1358)
  if (soDigitos(p.tomador.documento).length === 14 && !e) erros.push('Falta o endereço do tomador (obrigatório quando é CNPJ).');
  if (e && !(/^\d{7}$/.test(e.cMun) && /^\d{8}$/.test(soDigitos(e.cep)) && e.logradouro.trim() && e.numero.trim() && e.bairro.trim())) erros.push('O endereço do tomador está incompleto (município, CEP, rua, número e bairro).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.servico.competencia)) erros.push('Escolha a competência.');
  return erros;
}

/** O que falta na configuração para o robô conseguir emitir (vazio: pronta). */
export function faltasNaConfig(c: ConfigNfse | null, temToken: boolean): string[] {
  if (!c) return ['a configuração do emissor'];
  const f: string[] = [];
  if (soDigitos(c.prestador.cnpj).length !== 14 || !documentoValido(c.prestador.cnpj)) f.push('o CNPJ do escritório');
  if (!c.prestador.im.trim()) f.push('a inscrição municipal');
  if (!/^\d{6}$/.test(c.servico.cTribNac)) f.push('o código de tributação nacional (6 dígitos)');
  if (!c.servico.cIntContrib.trim()) f.push('o código do serviço na prefeitura');
  if (!/^\d{9}$/.test(soDigitos(c.servico.cNBS))) f.push('o código NBS (9 dígitos)');
  if (c.prestador.opSimpNac === 3 && !c.prestador.regApTribSN) f.push('a apuração do Simples');
  if (c.servico.pAliq != null && !(c.servico.pAliq > 0 && c.servico.pAliq <= 5)) f.push('a alíquota do ISS (entre 0 e 5%)');
  if (!temToken) f.push('o token da prefeitura');
  return f;
}

/** Os dados de uma nota numa linha (para a busca da lista). */
export const textoDaNota = (n: NotaFiscal) => [n.tomador.nome, n.tomador.documento, n.servico.descricao, n.numeroNfse, n.empresaCodigo ?? ''].join(' ').toLowerCase();

/** Um tempo curto por extenso: "12 s", "3 min", "1 h 20 min". */
export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + ' s';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
}

/**
 * O andamento da nota numa frase (15/10/2026: "não consegue ter o feedback do robô de como tá indo?"), com o que o robô
 * grava: quando enviou, quantas consultas fez e a última. Vazio quando não há o que contar.
 */
export function andamentoDaNota(n: NotaFiscal, agora: Date): string {
  const desde = (iso: string) => (iso ? duracao(agora.getTime() - new Date(iso).getTime()) : '');
  if (n.status === 'pedida') return 'Na fila do robô há ' + desde(n.atualizadoEm || n.pedidoEm);
  if (n.status === 'enviando') return 'Enviando para a prefeitura…';
  if (n.status === 'processando') {
    const partes = ['Na prefeitura há ' + desde(n.enviadaEm || n.atualizadoEm)];
    if (n.consultas > 0) partes.push(n.consultas + (n.consultas === 1 ? ' consulta' : ' consultas'), 'última há ' + desde(n.atualizadoEm));
    return partes.join(' · ');
  }
  if (n.status === 'autorizada' && n.enviadaEm && n.autorizadaEm) return 'Autorizada em ' + duracao(new Date(n.autorizadaEm).getTime() - new Date(n.enviadaEm).getTime()) + ' depois do envio';
  if (n.status === 'cancelamento-pedido') return 'Pedindo o cancelamento à prefeitura…';
  return '';
}
export * from './danfse';
export * from './email';
export * from './recebimentos';
export * from './planilha';
