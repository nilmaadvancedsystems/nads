// Publicar no SCI Report 24h as guias do Fiscal › Enviar guias com a via "SCI Report" (24/11/2026), e ler de volta se o
// cliente viu e se informou o pagamento. Funções puras; quem publica é o cliente do SCI Report (areaCliente/sciReportCliente:
// publicar), no robô da nuvem. A publicação manual da SCI é BETA ("em desenvolvimento"): os campos podem mudar.
//   multipart: arquivo (PDF ≤ 20 MB), relatorioId (4 posições), mesRef '01'..'13', anoRef, todaEmpresa=false, empresaId e,
//   para imposto, dataVencimento (aaaa-mm-dd) e valor > 0; id livre até 10 caracteres; descricao.
import type { PublicacaoDoSci } from '../../areaCliente/sciReport';

/** O maior PDF que a SCI aceita. */
export const MAIOR_PDF_NO_SCI = 20 * 1024 * 1024;

export interface GuiaParaPublicar {
  /** 'aaaa-mm' (a competência da apuração) */
  competencia: string;
  /** 'dd/mm/aaaa' */
  vencimento: string;
  /** em reais */
  valor: number;
  /** o nome que o cliente vê ("DAS", "DARF PIS"…) */
  descricao: string;
}

/** 'dd/mm/aaaa' → 'aaaa-mm-dd'; '' se não é data. */
export function dataParaOSci(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? '').trim());
  if (!m) return '';
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

/**
 * O identificador do nads na publicação (o campo `id`, até 10 caracteres, que a SCI guarda em maiúsculo): a competência e um
 * resumo do nome da guia. Serve para reconhecer, na busca, que aquela guia já foi publicada.
 */
export function idDaPublicacao(competencia: string, descricao: string): string {
  const mes = competencia.replace('-', '').slice(2); // '2610'
  const nome = String(descricao ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return (mes + nome).slice(0, 10);
}

/** O que falta para publicar ('' = pode). */
export function erroDaGuiaParaPublicar(g: GuiaParaPublicar, relatorioId: string, empresaId: number | null, tamanhoDoPdf: number): string {
  if (!relatorioId) return 'falta dizer, em Configurações › Integração SCI, o código do relatório desta guia no SCI Report';
  if (!empresaId) return 'a empresa não foi achada no SCI Report pelo CNPJ';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(g.competencia)) return 'a guia está sem a competência';
  if (!dataParaOSci(g.vencimento)) return 'a guia está sem o vencimento';
  if (!(g.valor > 0)) return 'a guia está sem o valor';
  if (!(tamanhoDoPdf > 0)) return 'a guia está sem o PDF';
  if (tamanhoDoPdf > MAIOR_PDF_NO_SCI) return 'o PDF passa de 20 MB';
  return '';
}

/** Os campos de texto do multipart (o arquivo vai à parte). */
export function camposDaPublicacao(g: GuiaParaPublicar, relatorioId: string, empresaId: number): Record<string, string> {
  return {
    relatorioId, mesRef: g.competencia.slice(5, 7), anoRef: g.competencia.slice(0, 4), todaEmpresa: 'false', empresaId: String(empresaId),
    dataVencimento: dataParaOSci(g.vencimento), valor: (Math.round(g.valor * 100) / 100).toFixed(2),
    id: idDaPublicacao(g.competencia, g.descricao), descricao: String(g.descricao ?? '').slice(0, 120),
  };
}

/** Já existe na lista do SCI uma publicação igual (mesma competência, vencimento e valor)? Para não publicar duas vezes. */
export function jaPublicada(lista: PublicacaoDoSci[], g: GuiaParaPublicar, relatorioId: string): PublicacaoDoSci | null {
  const valor = Math.round(g.valor * 100);
  return lista.find(p => p.competencia === g.competencia && p.vencimento === g.vencimento && Math.round(p.valor * 100) === valor && (!relatorioId || !p.relatorioId || p.relatorioId === relatorioId)) ?? null;
}

/** O que o nads guarda de cada publicação no registro do envio (solicitacoesEmail.sciReport). */
export interface PublicadaNoSci {
  publicadosId: number;
  nome: string;
  /** 'dd/mm/aaaa' ou '' */
  vistoEm: string;
  /** 'dd/mm/aaaa' ou '' (o pagamento que o cliente informou no SCI Report) */
  pagamentoEm: string;
}

/** Atualiza as publicações do registro com o que a SCI diz agora; `mudou` diz se precisa gravar. */
export function situacaoDeVolta(guardadas: PublicadaNoSci[], daSci: PublicacaoDoSci[]): { publicadas: PublicadaNoSci[]; mudou: boolean; terminou: boolean } {
  const porId = new Map(daSci.map(p => [p.publicadosId, p]));
  let mudou = false;
  const publicadas = guardadas.map(g => {
    const p = porId.get(g.publicadosId);
    if (!p) return g;
    const vistoEm = g.vistoEm || p.vistoEm || (p.visualizado && !g.vistoEm ? '?' : '');
    const pagamentoEm = g.pagamentoEm || p.pagamentoEm;
    if (vistoEm !== g.vistoEm || pagamentoEm !== g.pagamentoEm) mudou = true;
    return { ...g, vistoEm, pagamentoEm };
  });
  // terminou: todas com o pagamento informado (não precisa mais perguntar)
  return { publicadas, mudou, terminou: publicadas.length > 0 && publicadas.every(p => !!p.pagamentoEm) };
}

/** Lê o campo sciReport.publicadas de um registro (o que vier torto some). */
export function publicadasDoRegistro(v: unknown): PublicadaNoSci[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap(x => {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
    const id = Number(o?.publicadosId);
    if (!o || !Number.isInteger(id) || id <= 0) return [];
    const t = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
    return [{ publicadosId: id, nome: t('nome'), vistoEm: t('vistoEm'), pagamentoEm: t('pagamentoEm') }];
  });
}

/** A frase para a tela ("visto 12/11 · pago 19/11"; "ainda não visto"). */
export function fraseDaPublicacao(p: PublicadaNoSci): string {
  if (p.pagamentoEm) return 'pagamento informado ' + p.pagamentoEm.slice(0, 5);
  if (p.vistoEm) return p.vistoEm === '?' ? 'vista' : 'vista ' + p.vistoEm.slice(0, 5);
  return 'ainda não vista';
}
