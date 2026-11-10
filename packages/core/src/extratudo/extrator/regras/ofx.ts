// OFX (extrato que o banco exporta para sistemas): cada <STMTTRN> é um lançamento.
import type { Lancamento } from '../tipos';
import { centavos, lerData } from './texto';

function campo(bloco: string, nome: string): string {
  const m = new RegExp('<' + nome + '>([^<\\r\\n]*)', 'i').exec(bloco);
  return m ? m[1].trim() : '';
}

/**
 * O valor do OFX em centavos. O padrão é "-1234.56" (o ponto é o decimal, com quantas casas vierem); o banco que escreve no
 * jeito de cá ("1.234,56", "1234,56") ou com o milhar ("1,234.56") vai pela leitura comum (antes "1.234,56" virava 1,23).
 */
function valorDoOfx(s: string): number | null {
  const t = s.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t) ? Math.round(parseFloat(t) * 100) || 0 : centavos(t);
}

export function ehOfx(texto: string): boolean {
  return /<OFX>|OFXHEADER/i.test(texto);
}

/** O saldo antes do primeiro lançamento: o saldo final do OFX (<LEDGERBAL><BALAMT>) menos o movimento do arquivo. Sem saldo, null. */
export function saldoAnteriorDoOfx(texto: string, lancamentos: readonly Lancamento[]): number | null {
  const m = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i.exec(texto);
  if (!m) return null;
  const final = valorDoOfx(m[1]);
  if (final == null) return null;
  return final - lancamentos.reduce((t, l) => t + l.valor, 0);
}

export function lancamentosDoOfx(texto: string): Lancamento[] {
  const saida: Lancamento[] = [];
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi;
  for (const m of texto.matchAll(re)) {
    const b = m[1];
    const d = campo(b, 'DTPOSTED');
    if (!/^\d{8}/.test(d)) continue;
    // a data que não existe (20260231) não entra
    const data = lerData(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), 0);
    const valor = valorDoOfx(campo(b, 'TRNAMT'));
    if (!data || !valor) continue;
    const historico = [campo(b, 'MEMO'), campo(b, 'NAME')].filter(Boolean).join(' ').trim();
    saida.push({ data, valor, historico: historico || campo(b, 'CHECKNUM') || '(sem histórico)' });
  }
  return saida;
}
