// O resumo do PGDAS-D por empresa (25/11/2026): um documento por empresa, pgdas/{código}, com os meses dentro. Um documento
// só por empresa (e não um por mês) para a tela do Faturamento ler todos os clientes com uma leitura por empresa, não uma por
// empresa e mês (as leituras do banco já passam da cota). O robô (robo/ecac-pgdas.js) junta cada extrato que baixa aqui.
//
// Qual valor vale para um mês, quando há mais de um:
//   1. o extrato do próprio mês (origem 'extrato') vale mais que o mês visto nos "anteriores" de um extrato mais novo;
//   2. entre dois da mesma origem, vale o da declaração transmitida depois (a retificação);
//   3. sem data de transmissão, vale o consultado depois.
import { extratoDaEmpresa, type AtividadeDoExtrato, type DasDoExtrato, type ExtratoDoPgdas } from './extrato';

export const FONTE_RECEITA = 'Receita (PGDAS-D)';
export const FONTE_RECEITA_CURTA = 'Receita';
/** quantos meses o documento guarda (os mais novos); o resto sai */
export const MESES_GUARDADOS = 36;

export interface MesDoPgdas {
  competencia: string;
  /** a receita bruta do mês (RPA, interno + externo) */
  receita: number;
  interno: number;
  externo: number;
  /** a RBT12 do mês (só no extrato do próprio mês) */
  rbt12: number | null;
  declaracao: string | null;
  transmitidaEm: string | null;
  /** 'extrato': o extrato do próprio mês; 'anteriores': o mês listado no extrato de um mês depois */
  origem: 'extrato' | 'anteriores';
  /** quando o robô leu (ISO) */
  consultadoEm: string;
  /** só no extrato do próprio mês: o DAS gerado e o pagamento que a Receita tem (para a baixa da guia) */
  das?: DasDoExtrato | null;
  /** só no extrato do próprio mês: a receita de cada atividade */
  atividades?: AtividadeDoExtrato[];
}

export interface PgdasDaEmpresa {
  codigo: number;
  cnpj: string;
  nome: string;
  fonte: string;
  /** a última consulta do robô (ISO) */
  consultadoEm: string;
  meses: Record<string, MesDoPgdas>;
}

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/** este mês ganha do que já estava? */
export function valeMais(novo: MesDoPgdas, atual: MesDoPgdas | null | undefined): boolean {
  if (!atual) return true;
  if (novo.origem !== atual.origem) return novo.origem === 'extrato';
  const a = novo.transmitidaEm || '', b = atual.transmitidaEm || '';
  if (a && b && a !== b) return a > b;
  return novo.consultadoEm >= atual.consultadoEm;
}

/**
 * Junta um extrato no resumo da empresa. Recusa (Error) o extrato de outro CNPJ: o robô baixou a tela errada e nada é
 * gravado. Devolve o documento novo, com no máximo MESES_GUARDADOS meses.
 */
export function juntarExtrato(atual: PgdasDaEmpresa | null, extrato: ExtratoDoPgdas,
  empresa: { codigo: number; cnpj: string; nome: string }, agora: Date): PgdasDaEmpresa {
  if (!extratoDaEmpresa(extrato, empresa.cnpj)) throw new Error('o extrato é de outro CNPJ (' + (extrato.cnpj || 'sem CNPJ') + '), não da empresa ' + empresa.codigo);
  const em = agora.toISOString();
  const meses: Record<string, MesDoPgdas> = { ...(atual?.meses || {}) };
  const por = (m: MesDoPgdas) => { if (valeMais(m, meses[m.competencia])) meses[m.competencia] = m; };
  for (const a of extrato.anteriores) {
    por({ competencia: a.competencia, receita: a.total, interno: a.interno, externo: a.externo, rbt12: null, declaracao: extrato.declaracao, transmitidaEm: extrato.transmitidaEm, origem: 'anteriores', consultadoEm: em });
  }
  por({ competencia: extrato.competencia, receita: extrato.receita.total, interno: extrato.receita.interno, externo: extrato.receita.externo, rbt12: extrato.rbt12,
    declaracao: extrato.declaracao, transmitidaEm: extrato.transmitidaEm, origem: 'extrato', consultadoEm: em, das: extrato.das, atividades: extrato.atividades });
  const guardar = Object.keys(meses).sort().slice(-MESES_GUARDADOS);
  return {
    codigo: empresa.codigo, cnpj: String(empresa.cnpj).replace(/\D/g, ''), nome: String(empresa.nome || atual?.nome || '').slice(0, 200),
    fonte: FONTE_RECEITA, consultadoEm: em,
    meses: Object.fromEntries(guardar.map(c => [c, meses[c]])),
  };
}

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

const DATA = /^\d{4}-\d{2}-\d{2}$/;
function lerDas(v: unknown): DasDoExtrato | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const p = d.pagamento && typeof d.pagamento === 'object' ? d.pagamento as Record<string, unknown> : null;
  const pagoValor = p ? numero(p.valor) : null;
  return {
    numero: /^\d{17}$/.test(texto(d.numero)) ? texto(d.numero) : null,
    vencimento: DATA.test(texto(d.vencimento)) ? texto(d.vencimento) : null,
    valor: numero(d.valor),
    pagamento: p && DATA.test(texto(p.data)) && pagoValor != null ? { data: texto(p.data), valor: pagoValor } : null,
  };
}

/** O documento do banco como a tela usa; o que não fecha fica de fora. null = sem documento ou sem nenhum mês bom. */
export function lerPgdasDaEmpresa(dados: unknown): PgdasDaEmpresa | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown>;
  const codigo = numero(d.codigo);
  if (codigo == null) return null;
  const meses: Record<string, MesDoPgdas> = {};
  const brutos = d.meses && typeof d.meses === 'object' ? d.meses as Record<string, unknown> : {};
  for (const [c, v] of Object.entries(brutos)) {
    if (!COMPETENCIA.test(c) || !v || typeof v !== 'object') continue;
    const m = v as Record<string, unknown>;
    const receita = numero(m.receita);
    if (receita == null) continue;
    meses[c] = {
      competencia: c, receita, interno: numero(m.interno) ?? receita, externo: numero(m.externo) ?? 0, rbt12: numero(m.rbt12),
      declaracao: texto(m.declaracao) || null, transmitidaEm: texto(m.transmitidaEm) || null,
      origem: m.origem === 'anteriores' ? 'anteriores' : 'extrato', consultadoEm: texto(m.consultadoEm),
      ...(lerDas(m.das) ? { das: lerDas(m.das) } : {}),
      ...(Array.isArray(m.atividades) ? { atividades: (m.atividades as unknown[]).flatMap(x => {
        const a = x && typeof x === 'object' ? x as Record<string, unknown> : null;
        const r = a ? numero(a.receita) : null;
        return a && r != null ? [{ descricao: texto(a.descricao).slice(0, 300), receita: r }] : [];
      }) } : {}),
    };
  }
  if (!Object.keys(meses).length) return null;
  return { codigo, cnpj: texto(d.cnpj), nome: texto(d.nome), fonte: texto(d.fonte) || FONTE_RECEITA, consultadoEm: texto(d.consultadoEm), meses };
}

/**
 * No Simples, o faturamento é só o do PGDAS-D (25/11/2026, o dono: "no simples o faturamento do sieg seja substituído pelo
 * do pgdas, nele já tem todas as informações"): o mês sem PGDAS-D fica vazio, sem cair para o SIEG. Vale quando a empresa já
 * tem o PGDAS-D no nads; antes da primeira consulta do robô, ela segue pelo SIEG (para não sumir das telas). O MEI não
 * declara pelo PGDAS-D e segue pelo SIEG.
 */
export function faturamentoSoPeloPgdas(regime: string | null | undefined, pg: PgdasDaEmpresa | null | undefined): boolean {
  return regime === 'Simples' && !!pg && Object.keys(pg.meses).length > 0;
}

/** "consultado em 25/11/2026" (a data da consulta no fuso do escritório); '' sem data */
export function consultadoEmTexto(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return 'consultado em ' + new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
