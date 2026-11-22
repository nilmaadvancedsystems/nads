// O que falta o cliente mandar no mês, no sino da Área do Cliente (plano do Acessórias, 17/11/2026, fichas
// o-que-falta-mandar e pedidos-do-mandei; frase do dono: "No sino"). O cartão "Precisa de você" saiu da tela inicial
// (17/11/2026: "remove isso"), então os pedidos do escritório aparecem como avisos do sino, que levam ao envio certo.
// Duas fontes: a matriz mensal de documentos do escritório (documentosMensal, a mesma das Pendências e da régua de
// cobrança) e os tickets do Mandei. Só a lógica (sem tela e sem banco).
import type { TipoDeEnvio } from './envios';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** O que o robô espelha em resumo/pendencias: lista branca (sem quem cobrou nem quando). */
export interface PendenciaDoMes {
  /** 'extrato-2026-10' (estável: o lido do sino fica guardado por ele) */
  id: string;
  /** "Extrato bancário de outubro" */
  titulo: string;
  /** o tipo do envio que resolve (a janela "Enviar documento" já abre nele) */
  tipo: TipoDeEnvio;
  /** 'aaaa-mm' */
  competencia: string;
}

/** Os documentos da matriz mensal (os mesmos da régua de cobrança, robo/regua-cobranca.js) e o tipo do envio de cada um. */
const DOCUMENTOS: Record<string, { titulo: string; tipo: TipoDeEnvio }> = {
  extrato: { titulo: 'Extrato bancário', tipo: 'extrato' },
  comprovante: { titulo: 'Comprovantes de pagamento', tipo: 'comprovante' },
  aplicacao: { titulo: 'Extrato da aplicação', tipo: 'extrato' },
};

/** As pendências do mês: o que falta (as chaves de documentosMensal) com o título do NADS e o tipo do envio. */
export function pendenciasDoMes(faltando: readonly string[], competencia: string): PendenciaDoMes[] {
  const mes = MESES[Number(competencia.slice(5, 7)) - 1];
  if (!mes || !/^\d{4}-\d{2}$/.test(competencia)) return [];
  return faltando.filter(c => DOCUMENTOS[c]).map(c => ({ id: c + '-' + competencia, titulo: DOCUMENTOS[c].titulo + ' de ' + mes, tipo: DOCUMENTOS[c].tipo, competencia }));
}

/** O prefixo do nome do arquivo mandado pelo aviso da aplicação (o envio não tem o tipo "aplicação": a regra do banco só
 *  aceita extrato, nota, comprovante e outro; o nome leva "Aplicação - …" e o robô baixa a pendência certa). */
export const PREFIXO_DA_APLICACAO = 'Aplicação';

/**
 * Qual documento do mês o envio da Área do Cliente baixa (22/11/2026, Documentos do cliente: antes só o extrato baixava,
 * o comprovante nunca baixava e a aplicação baixava o extrato): o extrato, a aplicação (o extrato com o nome começando por
 * "Aplicação") e o comprovante. A nota e o "outro" não baixam nada (null).
 */
export function documentoDoEnvio(tipo: string, nome: string): 'extrato' | 'aplicacao' | 'comprovante' | null {
  if (tipo === 'comprovante') return 'comprovante';
  if (tipo !== 'extrato') return null;
  return /^\s*aplica[cç][aã]o(?![a-z])/i.test(String(nome || '')) ? 'aplicacao' : 'extrato';
}

/**
 * O mês do documento mandado pela Área do Cliente, para baixar a pendência dele (a correção da ficha o-que-falta-mandar:
 * antes o envio pela Área não marcava documentosMensal e a régua continuava cobrando). Vale para o que documentoDoEnvio
 * reconhece: o mês do nome do arquivo ("10-2026", "10/2026", "10.2026"); sem ele, o mês anterior ao do envio (o extrato
 * mandado em novembro é de outubro). Os outros tipos não marcam (null).
 */
export function competenciaDoEnvio(tipo: string, recebidoEm: Date, nome: string): string | null {
  if (!documentoDoEnvio(tipo, nome)) return null;
  const m = /(?<!\d)(0[1-9]|1[0-2])[-/.](20\d{2})(?!\d)/.exec(String(nome || ''));
  if (m) return m[2] + '-' + m[1];
  const d = new Date(recebidoEm.getFullYear(), recebidoEm.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** O que o aviso "Falta mandar" abre (pelo id da pendência, 'aplicacao-2026-10'): o tipo do envio, o prefixo do nome e o mês. */
export function envioDaPendencia(id: string): { documento: string; tipo: TipoDeEnvio; prefixo?: string; competencia: string } | null {
  const m = /^(extrato|comprovante|aplicacao)-(\d{4}-\d{2})$/.exec(id);
  if (!m) return null;
  const documento = m[1];
  return { documento, tipo: DOCUMENTOS[documento].tipo, ...(documento === 'aplicacao' ? { prefixo: PREFIXO_DA_APLICACAO } : {}), competencia: m[2] };
}
