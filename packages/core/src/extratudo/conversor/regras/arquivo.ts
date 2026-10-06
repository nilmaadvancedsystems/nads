// O banco do extrato (pelo texto do arquivo ou pelo nome dele) e o nome do .xls, como o escritório salva:
// "BANCO BRASIL 08.2026.xls" — o banco em maiúsculas, sem acento e sem "do/da/de", e o mês do movimento.
import { normalizarTexto } from '../../../formatos';
import { BANCOS_CONHECIDOS } from '../../../empresas/bancos';
import type { LinhaConvertida } from '../tipos';

/** Como cada banco aparece no extrato (texto já sem acento e em minúsculas). */
const SINAIS: { nome: string; re: RegExp }[] = [
  { nome: 'Banco do Brasil', re: /banco do brasil|\bbb rende facil\b|\bbb giro\b|bancodobrasil/ },
  { nome: 'Banco do Nordeste', re: /banco do nordeste/ },
  { nome: 'Sicoob', re: /sicoob|bancoob/ },
  { nome: 'Sicredi', re: /sicredi/ },
  { nome: 'Itaú', re: /\bitau\b|itau unibanco/ },
  { nome: 'Bradesco', re: /bradesco/ },
  { nome: 'Caixa', re: /caixa economica|\bcaixa\b|\bcef\b/ },
  { nome: 'Santander', re: /santander/ },
  { nome: 'Inter', re: /banco inter\b/ },
  { nome: 'Nubank', re: /nubank|nu pagamentos/ },
  { nome: 'C6 Bank', re: /\bc6\b/ },
  { nome: 'Cora', re: /\bcora\b/ },
  { nome: 'Mercado Pago', re: /mercado ?pago/ },
  { nome: 'PagBank', re: /pagbank|pagseguro/ },
  { nome: 'Stone', re: /\bstone\b/ },
  { nome: 'BTG Pactual', re: /\bbtg\b/ },
  { nome: 'Safra', re: /\bsafra\b/ },
  { nome: 'Banrisul', re: /banrisul/ },
  { nome: 'Cresol', re: /cresol/ },
];

/** Os nomes de banco que a pessoa pode escolher (os conhecidos do nads). */
export const NOMES_DE_BANCO: readonly string[] = BANCOS_CONHECIDOS.map(b => b.nome);

/** A marca do banco (o logo: 'banco-do-brasil', 'itau'…; '' = sem logo). */
export function marcaDoBanco(nome: string): string {
  return BANCOS_CONHECIDOS.find(b => b.nome === nome)?.id || '';
}

/** O banco pelo texto do extrato e, se não achar, pelo nome do arquivo ('' = não sei). */
export function bancoDoTexto(texto: string, nomeDoArquivo = ''): string {
  for (const fonte of [texto, nomeDoArquivo.replace(/[_.-]+/g, ' ')]) {
    const n = normalizarTexto(fonte);
    const achado = SINAIS.find(s => s.re.test(n));
    if (achado) return achado.nome;
  }
  return '';
}

/** O mês com mais lançamentos ('aaaa-mm'; '' sem lançamento). */
export function mesDoExtrato(linhas: readonly LinhaConvertida[]): string {
  const conta = new Map<string, number>();
  for (const l of linhas) conta.set(l.data.slice(0, 7), (conta.get(l.data.slice(0, 7)) || 0) + 1);
  let melhor = '';
  for (const [m, n] of conta) if (!melhor || n > (conta.get(melhor) || 0)) melhor = m;
  return melhor;
}

/** "Banco do Brasil" → "BANCO BRASIL"; "Itaú" → "ITAU". */
export function bancoNoNomeDoArquivo(banco: string): string {
  return normalizarTexto(banco).toUpperCase().replace(/\b(DO|DA|DE|DOS|DAS)\b/g, ' ').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'EXTRATO';
}

/** "BANCO BRASIL 08.2026.xls" */
export function nomeDoXls(banco: string, linhas: readonly LinhaConvertida[]): string {
  const mes = mesDoExtrato(linhas);
  return bancoNoNomeDoArquivo(banco) + (mes ? ' ' + mes.slice(5) + '.' + mes.slice(0, 4) : '') + '.xls';
}
