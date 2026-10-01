// OFX (extrato que o banco exporta para sistemas): cada <STMTTRN> é um lançamento.
import type { Lancamento } from '../tipos';

function campo(bloco: string, nome: string): string {
  const m = new RegExp('<' + nome + '>([^<\\r\\n]*)', 'i').exec(bloco);
  return m ? m[1].trim() : '';
}

export function ehOfx(texto: string): boolean {
  return /<OFX>|OFXHEADER/i.test(texto);
}

/** O saldo antes do primeiro lançamento: o saldo final do OFX (<LEDGERBAL><BALAMT>) menos o movimento do arquivo. Sem saldo, null. */
export function saldoAnteriorDoOfx(texto: string, lancamentos: readonly Lancamento[]): number | null {
  const m = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i.exec(texto);
  if (!m) return null;
  const final = Math.round(parseFloat(m[1].trim().replace(',', '.')) * 100);
  if (!isFinite(final)) return null;
  return final - lancamentos.reduce((t, l) => t + l.valor, 0);
}

export function lancamentosDoOfx(texto: string): Lancamento[] {
  const saida: Lancamento[] = [];
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi;
  for (const m of texto.matchAll(re)) {
    const b = m[1];
    const d = campo(b, 'DTPOSTED');
    if (!/^\d{8}/.test(d)) continue;
    const valor = Math.round(parseFloat(campo(b, 'TRNAMT').replace(',', '.')) * 100);
    if (!isFinite(valor) || !valor) continue;
    const historico = [campo(b, 'MEMO'), campo(b, 'NAME')].filter(Boolean).join(' ').trim();
    saida.push({ data: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), valor, historico: historico || campo(b, 'CHECKNUM') || '(sem histórico)' });
  }
  return saida;
}
