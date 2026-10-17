// A planilha de recebimentos do financeiro (15/10/2026: "quero que ele leia uma planilha com clientes que já pagaram para
// gerar para mim"; "a data da nota = a da planilha"): o relatório do banco, sem cabeçalho, uma linha por cliente que pagou:
//   A = o código do cliente entre parênteses, com zeros ("(00462)"); B = o nome; C = a data do pagamento; D = o valor.
// Aqui só a leitura (pura, sem tela nem banco); a leitura do arquivo em si (xlsx, xls, csv) é a planilha.ts.

export interface Recebimento { codigo: number; nome: string; /** AAAA-MM-DD */ data: string; valor: number }

const texto = (v: unknown) => String(v ?? '').trim();

/** O número de série de uma data do Excel (dias desde 30/12/1899) → AAAA-MM-DD ('' fora de um intervalo razoável). */
function dataDoSerial(n: number): string {
  if (!(n >= 20000 && n < 80000)) return '';
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

const iso = (a: number, m: number, d: number): string => {
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '';
};

/**
 * A data da célula: número de série do Excel, Date, ou texto — "10/20/26" (M/D/AA, como o relatório mostra), "20/10/2026"
 * (D/M/AAAA) e "2026-10-20". Com ano de 2 dígitos vale M/D; com 4 dígitos, D/M; quando um dos lados passa de 12, ele é o dia.
 */
export function dataDaCelula(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'number') return dataDoSerial(v);
  const t = texto(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (!m) return /^\d{5}(\.\d+)?$/.test(t) ? dataDoSerial(Number(t)) : '';
  const a = Number(m[1]);
  const b = Number(m[2]);
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mesPrimeiro = m[3].length === 2 ? a <= 12 : a <= 12 && b > 12;
  return mesPrimeiro ? iso(ano, a, b) : iso(ano, b, a);
}

/** O valor da célula: número, ou texto "1,200.00", "1.200,00", "R$ 670,00" ou "670.00" (0 quando não dá para ler). */
export function valorDaCelula(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  let s = texto(v).replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const ponto = s.lastIndexOf('.');
  const virgula = s.lastIndexOf(',');
  if (ponto >= 0 && virgula >= 0) s = ponto > virgula ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (virgula >= 0) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * O código da primeira coluna: "(00462)" → 462 (null se não tem esse formato). No xlsx do banco a célula é um número (462)
 * que o Excel mostra como "(00462)" pelo formato; no csv já vem o texto.
 */
export function codigoDaCelula(v: unknown): number | null {
  // no csv o Excel/SheetJS lê "(00462)" como número negativo (parênteses = negativo na contabilidade): vale o módulo
  if (typeof v === 'number') { const n = Math.abs(v); return Number.isInteger(n) && n > 0 && n < 10000000 ? n : null; }
  const m = /^\(\s*(\d{1,7})\s*\)$/.exec(texto(v));
  const n = m ? Number(m[1]) : 0;
  return n > 0 ? n : null;
}

/** Os recebimentos das linhas da planilha (a primeira aba), e um aviso para cada linha ignorada. */
export function lerPlanilhaDeRecebimentos(linhas: unknown[][]): { recebimentos: Recebimento[]; avisos: string[] } {
  const recebimentos: Recebimento[] = [];
  const avisos: string[] = [];
  linhas.forEach((r, i) => {
    if (!r || !r.some(c => texto(c))) return;
    const n = 'Linha ' + (i + 1) + ': ';
    const codigo = codigoDaCelula(r[0]);
    if (codigo == null) { avisos.push(n + 'ignorada, sem o código do cliente no formato (00000).'); return; }
    const valor = valorDaCelula(r[3]);
    if (!(valor > 0)) { avisos.push(n + 'ignorada, sem valor.'); return; }
    const data = dataDaCelula(r[2]);
    if (!data) { avisos.push(n + 'ignorada, a data não é válida.'); return; }
    recebimentos.push({ codigo, nome: texto(r[1]), data, valor });
  });
  return { recebimentos, avisos };
}

/** "Serviços Contábeis Ref. MM/AAAA" do mês ANTERIOR à data (a nota real de 14/10/2026 diz "Ref. 09/2026"). */
export function descricaoPadrao(data: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(data);
  if (!m) return 'Serviços Contábeis';
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  return 'Serviços Contábeis Ref. ' + String(mes === 1 ? 12 : mes - 1).padStart(2, '0') + '/' + (mes === 1 ? ano - 1 : ano);
}
