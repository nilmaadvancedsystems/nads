// As regras do cofre que não são criptografia: a situação do certificado (vencido, vencendo, em dia) e o que fica às
// claras no documento de uma empresa.
import type { SegredosDaEmpresa } from './tipos';

export type SituacaoDoCertificado = 'sem' | 'vencido' | 'vence' | 'ok';

/** Quantos dias antes do vencimento o certificado já aparece como "vence". */
export const AVISO_DE_VENCIMENTO_DIAS = 30;

/** A situação do certificado pela validade (aaaa-mm-dd) e os dias que faltam (negativo = vencido há). */
export function situacaoDoCertificado(validade: string | undefined, hoje: Date): { situacao: SituacaoDoCertificado; dias: number | null } {
  if (!validade || !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return { situacao: 'sem', dias: null };
  const [a, m, d] = validade.split('-').map(Number);
  const fim = Date.UTC(a, m - 1, d);
  const hj = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((fim - hj) / 86_400_000);
  return { situacao: dias < 0 ? 'vencido' : dias <= AVISO_DE_VENCIMENTO_DIAS ? 'vence' : 'ok', dias };
}

/** O que fica às claras no documento da empresa (não é segredo): se tem senha gov.br, certificado e a validade. */
export function metaDosSegredos(s: SegredosDaEmpresa): { temGov: boolean; temCertificado: boolean; validade?: string } {
  const temGov = !!(s.gov && (s.gov.login || s.gov.senha));
  const temCertificado = !!(s.certificado && s.certificado.arquivo);
  return { temGov, temCertificado, ...(temCertificado && s.certificado?.validade ? { validade: s.certificado.validade } : {}) };
}

/** "07/10/2026" de "2026-10-07". */
/**
 * O navegador e o sistema, do userAgent, em palavras: "Chrome no Windows", "Edge no Windows", "Safari no iPhone". O que
 * não reconhece fica de fora ("Windows", "Navegador desconhecido").
 */
export function navegadorDoUserAgent(ua: string): string {
  const u = String(ua || '');
  // a ordem importa: o Edge e o Opera também dizem "Chrome"; o Chrome também diz "Safari"
  const navegador = /Edg(e|A|iOS)?\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /Firefox\/|FxiOS\//.test(u) ? 'Firefox'
    : /SamsungBrowser\//.test(u) ? 'Samsung Internet' : /Chrome\/|CriOS\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  const sistema = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows'
    : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /CrOS/.test(u) ? 'Chromebook' : /Linux/.test(u) ? 'Linux' : '';
  return navegador && sistema ? navegador + ' no ' + sistema : navegador || sistema || 'Navegador desconhecido';
}

export const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
