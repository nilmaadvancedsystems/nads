// Os formatos do relatório de liquidação que o Creditor aceita (Vitor, 14/10/2026: "esse é o formato do Creditor, não
// aceite outro formato, não importe no Creditor outro tipo"):
//   1. "Relatório - Títulos por Período" (Sicoob; lido por posição em banco.ts: relatorioDosItens);
//   2. "Extrato de Movimentação da Carteira de Cobrança" (uma página por movimento: Nosso Número, Seu Número, Nome do
//      Pagador, Vencimento, Data Pagto, Valor do Título, Oscilação/Despesa, Valor Cobrado).
// Qualquer outro PDF (comprovante de pagamento, extrato de conta…) é recusado com a mensagem FORMATO_NAO_ACEITO.
// Também aqui: o cedente (a empresa dona da carteira) de cada um, para o importar automático não pegar o relatório de
// outra empresa na caixa de e-mail do escritório.
import { normalizarTexto } from '../../../formatos';
import { dataBR, dinheiro, ordemData, r2 } from '../regras/numeros';
import type { RelatorioBanco, Titulo } from '../tipos';
import { TOTAIS_VAZIOS } from './banco';

export type FormatoDoRelatorio = 'titulos-por-periodo' | 'carteira-de-cobranca';

export const NOME_DO_FORMATO: Record<FormatoDoRelatorio, string> = {
  'titulos-por-periodo': 'Relatório - Títulos por Período',
  'carteira-de-cobranca': 'Extrato de Movimentação da Carteira de Cobrança',
};

export const FORMATO_NAO_ACEITO = 'Este arquivo não é um relatório de títulos liquidados aceito pelo Creditor. Aceitos: "'
  + NOME_DO_FORMATO['titulos-por-periodo'] + '" (Sicoob) e "' + NOME_DO_FORMATO['carteira-de-cobranca'] + '".';

/** O formato pelo texto das páginas (null = não é um dos aceitos). */
export function formatoDoRelatorio(linhas: readonly string[]): FormatoDoRelatorio | null {
  const t = normalizarTexto(linhas.join(' '));
  if (/\bcarteira de cobranca\b/.test(t) && /\bnosso numero\b/.test(t) && /\bdata pagto\b/.test(t)) return 'carteira-de-cobranca';
  if (/\btitulos por periodo\b/.test(t) && /\bsacado\b/.test(t)) return 'titulos-por-periodo';
  return null;
}

/** O cedente do "Títulos por Período": "Cedente: 232904 - TORNEARIA VOLPONI…" → "TORNEARIA VOLPONI…". */
export function cedenteDosTitulosPorPeriodo(linhas: readonly string[]): string {
  for (const l of linhas) {
    const m = /cedente:\s*(?:\d+\s*-\s*)?(.+)$/i.exec(l.trim());
    if (m) return m[1].replace(/\s{2,}.*$/, '').trim();
  }
  return '';
}

const DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const VALOR = /^-?[\d.]+,\d{2}$/;

/** Uma linha de título da carteira: "53500000005  NF610-B  AGROPECUARIA FORQUILHA  13/02/2026  09/02/2026  6.250,00  0,00  6.250,00  2". */
export function tituloDaCarteira(linha: string, id: number): Titulo | null {
  const p = linha.trim().split(/\s{2,}/);
  const datas = p.map((x, i) => (DATA.test(x) ? i : -1)).filter(i => i >= 0);
  if (datas.length < 2) return null;
  const [iVenc, iPagto] = datas;
  const antes = p.slice(0, iVenc);
  const valores = p.slice(iPagto + 1).filter(x => VALOR.test(x));
  if (!/^\d{5,}$/.test(antes[0] || '') || valores.length < 3) return null;
  const valor = dinheiro(valores[0]);
  const cobrado = dinheiro(valores[2]);
  if (valor == null || cobrado == null) return null;
  // a oscilação: o que o pagador pagou a mais (juros) ou a menos (desconto)
  const dif = r2(cobrado - valor);
  return {
    id, nossoNumero: antes[0], nf: antes.length >= 3 ? antes[1] : '', sacado: antes.slice(antes.length >= 3 ? 2 : 1).join(' '),
    valor, mora: dif > 0 ? dif : 0, desconto: dif < 0 ? -dif : 0, outros: 0, liquidacao: dataBR(p[iPagto]), cobrado,
  };
}

/** O "Extrato de Movimentação da Carteira de Cobrança", pelas linhas de cada página (linhasDosItens). */
export function lerCarteiraDeCobranca(paginas: readonly (readonly string[])[]): RelatorioBanco {
  const titulos: Titulo[] = [];
  const vistos = new Set<string>();
  let cedente = '';
  let id = 1;
  for (const linhas of paginas) {
    // o cedente: a linha depois da agência ("2557 / TAIOBEIRAS  7 / 5  8939 - 7 …"), no fim da página
    const ag = linhas.findIndex(l => /^ag[eê]ncia\s+raz[aã]o/i.test(l.trim()));
    if (!cedente && ag >= 0 && linhas[ag + 2] && /[a-z]/i.test(linhas[ag + 2])) cedente = linhas[ag + 2].trim();
    const ini = linhas.findIndex(l => /nosso n[uú]mero/i.test(l) && /data pagto/i.test(l));
    if (ini < 0) continue;
    let ultimo: Titulo | null = null;
    for (let i = ini + 1; i < linhas.length; i++) {
      const l = linhas[i];
      if (/\bTIT\.|CODLANC|saldo anterior|total de quando/i.test(l)) break;
      const t = tituloDaCarteira(l, id);
      if (t) {
        const chave = t.nossoNumero + '|' + t.liquidacao + '|' + t.cobrado;
        ultimo = null;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        titulos.push(t);
        ultimo = t;
        id++;
        continue;
      }
      // o resto do nome do pagador ("LTDA", "FLORESTA") na linha de baixo
      if (ultimo && /[a-z]/i.test(l) && !/\d{2}\/\d{2}\/\d{4}/.test(l)) ultimo.sacado = (ultimo.sacado + ' ' + l.trim()).trim();
    }
  }
  titulos.sort((a, b) => ordemData(a.liquidacao) - ordemData(b.liquidacao) || a.id - b.id);
  return {
    grupos: titulos.length ? [{ id: 1, rotulo: NOME_DO_FORMATO['carteira-de-cobranca'], titulos, impresso: { ...TOTAIS_VAZIOS }, registros: null }] : [],
    totalGeral: { ...TOTAIS_VAZIOS }, registrosGeral: null, ignorados: 0,
    avisos: titulos.length ? [] : ['Não achei títulos neste extrato da carteira de cobrança.'],
    cedente, formato: 'carteira-de-cobranca',
  };
}

const RUIDO = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'recuperacao', 'judicial']);
const palavras = (s: string) => normalizarTexto(s).split(' ').filter(p => p.length >= 2 && !RUIDO.has(p));

/**
 * O relatório é da empresa? Pelo cedente: ao menos 2/3 das palavras dele estão no nome da empresa ("TORNEARIA VOLPONI
 * INDUSTRIA E COMERCIO LTDA" sim; "VOLPONI CONSTRUCOES MECANICAS" não). Sem cedente: não dá para saber (false).
 */
export function relatorioDaEmpresa(cedente: string | undefined, empresa: string): boolean {
  const ced = palavras(cedente || '');
  if (!ced.length) return false;
  const emp = new Set(palavras(empresa));
  return ced.filter(p => emp.has(p)).length / ced.length >= 2 / 3;
}
