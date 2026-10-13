// Extrato da conta PJ do Nubank em PDF, o do app (Vitor, 13/10/2026). Depois do resumo do topo (saldo inicial, totais),
// as "Movimentações" por dia: a linha do dia com o total das entradas ("01 SET 2026  Total de entradas  + 1.952,65"), os
// lançamentos, o "Total de saídas" e os lançamentos de saída, e o "Saldo do dia". O valor do lançamento vem sem sinal: é
// entrada ou saída pelo total de cima. Cada lançamento tem o tipo, a contraparte e o valor numa linha, e o resto da
// contraparte (banco, agência, conta) nas linhas de baixo, às vezes já na página seguinte:
//
//     01 SET 2026   Total de entradas                                                  + 1.952,65
//                   Transferência recebida pelo Pix   ANA RAMOS DE SA - •••.015.386-•• - BCO   87,00
//                                                     BRADESCO S.A. (0237) Agência: 2557 Conta:
//                                                     550173-3
//                   Total de saídas                                                    - 2.133,76
//                   Pagamento de boleto efetuado      DISTRIMED                           417,68
//                   Saldo do dia                                                          667,21
//
// e no .xls vira "Transferência recebida pelo Pix ANA RAMOS DE SA - •••.015.386-•• - BCO BRADESCO S.A. (0237) Agência:
// 2557 Conta: 550173-3". O cabeçalho de cada página (empresa, CNPJ, conta, período) e o rodapé (atendimento, ouvidoria,
// "Extrato gerado", as notas da última página) não entram.
import { normalizarTexto } from '../../../formatos';
import { montarLinhas, type ItemDeTexto } from '../../extrator/regras/extrato';
import { centavos } from '../../extrator/regras/texto';
import type { LinhaConvertida } from '../tipos';

const MESES: Record<string, string> = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
/** a data do dia: "01 SET 2026" */
const RE_DIA = /^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (\d{4})\b/;
const RE_VALOR = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
/** as colunas do PDF: a data em ~57, o tipo em ~120, a contraparte em ~259 e o valor em ~490 */
const X_TIPO = 100, X_CONTRAPARTE = 200, X_VALOR = 440;

/** É o extrato do Nubank? (o Nu Pagamentos ou o nubank.com.br no texto e as linhas "Total de entradas"/"Saldo do dia") */
export function ehExtratoDoNubank(paginas: ItemDeTexto[][]): boolean {
  const textos = paginas.flatMap(montarLinhas).map(l => normalizarTexto(l.texto));
  return textos.some(t => /\bnubank\.com\.br\b|\bnu pagamentos\b|\bnu financeira\b/.test(t))
    && textos.some(t => RE_DIA.test(t) && /\btotal de (entradas|saidas)\b/.test(t))
    && textos.some(t => /\bsaldo do dia\b/.test(t));
}

/** junta o pedaço de baixo: sem espaço quando a linha quebrou no meio do número ("60355-" + "4", "•••." + "373.345-••") */
function juntar(historico: string, pedaco: string): string {
  return /\S[.-]$/.test(historico) && /^\d/.test(pedaco) ? historico + pedaco : historico + ' ' + pedaco;
}

export function lancamentosDoNubank(paginas: ItemDeTexto[][]): LinhaConvertida[] {
  const saida: LinhaConvertida[] = [];
  let data = '';
  let sinal = 1;
  /** o lançamento que ainda pode ganhar o resto da contraparte nas linhas de baixo */
  let aberto: LinhaConvertida | null = null;
  for (const pagina of paginas) {
    // o cabeçalho da página vai até a linha do período ("VALORES EM R$")
    let dentro = false;
    for (const l of montarLinhas(pagina)) {
      const t = l.tokens;
      if (!t.length) continue;
      const norm = normalizarTexto(l.texto);
      if (!dentro) { if (/\bvalores em r\b/.test(norm)) dentro = true; continue; }
      const dia = norm.match(RE_DIA);
      if (t[0].x < X_TIPO) {
        if (dia) {
          data = dia[3] + '-' + MESES[dia[2]] + '-' + dia[1];
          sinal = /\btotal de saidas\b/.test(norm) ? -1 : 1;
          aberto = null;
          continue;
        }
        // antes do primeiro dia, o resumo do topo; depois, o rodapé: o resto da página não é lançamento (o lançamento
        // aberto continua: o resto da contraparte pode vir no topo da página seguinte)
        if (data) break;
        continue;
      }
      if (!data) continue;
      if (t[0].x < X_CONTRAPARTE) {
        aberto = null;
        if (/^total de entradas\b/.test(norm)) { sinal = 1; continue; }
        if (/^total de saidas\b/.test(norm)) { sinal = -1; continue; }
        if (/^saldo\b/.test(norm)) continue;
        // o valor: o último número, na coluna Valor (a contraparte comprida chega perto dela: "Agência: 1")
        const ultimo = t[t.length - 1];
        const v = ultimo.x >= X_VALOR && RE_VALOR.test(ultimo.s) ? centavos(ultimo.s) : null;
        if (v == null || v === 0) continue;
        const historico = t.slice(0, -1).map(x => x.s).join(' ');
        aberto = { data, valor: sinal * v, historico };
        saida.push(aberto);
        continue;
      }
      // a linha só com o resto da contraparte
      if (aberto) aberto.historico = juntar(aberto.historico, l.texto);
    }
  }
  // o "- 03.238.183/0001-76" do CNPJ, que a montagem das linhas grudou como se fosse um valor negativo
  return saida.map(l => ({ ...l, historico: l.historico.replace(/ -(\d)/g, ' - $1').replace(/\s+/g, ' ').trim() }));
}
