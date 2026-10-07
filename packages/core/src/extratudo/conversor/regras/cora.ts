// Extrato do período da Cora (Cora SCFI) em PDF, o do app/site da Cora (Vitor, 07/10/2026). Do dia mais novo para o
// mais velho: a linha do dia ("30/09/2026  Saldo do dia  R$ 2.132,69") e, embaixo dela, os lançamentos daquele dia,
// cada um numa linha só:
//
//     30/09/2026                                   Saldo do dia   R$ 2.132,69
//       Transf Pix recebida   GEISIANE CARLA R …  090.766.176-94   + R$ 600,00
//       Boleto pago           Cemig Distribuicao                   - R$ 157,35
//
// e no .xls do escritório vira "Transf Pix recebida GEISIANE CARLA R 090.766.176-94" (sem as reticências do nome
// cortado). Os lançamentos que passam para a página seguinte continuam no dia de cima. O resumo do topo (saldo
// inicial, totais, saldo final), o "Saldo do dia" e o rodapé (Cora SCFI, Ouvidoria, pág) não são lançamento.
// No .xls sai do mais velho para o mais novo, como os outros bancos.
import { normalizarTexto } from '../../../formatos';
import { montarLinhas, type ItemDeTexto } from '../../extrator/regras/extrato';
import { centavos } from '../../extrator/regras/texto';
import type { LinhaConvertida } from '../tipos';

const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** o valor no fim da linha, com o sinal: "+ 600,00" ou "- 1.700,00" (o "R$" o montarLinhas já tirou) */
const RE_VALOR = /([+-])\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;

/** É o extrato da Cora? (o rodapé "Cora SCFI" e as linhas "Saldo do dia") */
export function ehExtratoDaCora(paginas: ItemDeTexto[][]): boolean {
  const textos = paginas.flatMap(montarLinhas).map(l => normalizarTexto(l.texto));
  return textos.some(t => /\bcora scfi\b|\bcora sociedade de credito\b/.test(t)) && textos.some(t => /\bsaldo do dia\b/.test(t));
}

export function lancamentosDaCora(paginas: ItemDeTexto[][]): LinhaConvertida[] {
  const saida: LinhaConvertida[] = [];
  let data = '';
  for (const pagina of paginas) {
    for (const l of montarLinhas(pagina)) {
      const t = l.tokens;
      if (!t.length) continue;
      const norm = normalizarTexto(l.texto);
      const m = t[0].s.match(RE_DATA);
      // a linha do dia: muda o dia dos lançamentos de baixo
      if (m && /\bsaldo do dia\b/.test(norm)) { data = m[3] + '-' + m[2] + '-' + m[1]; continue; }
      if (!data || /\bsaldo\b/.test(norm)) continue;
      const v = l.texto.match(RE_VALOR);
      if (!v) continue;
      const valor = centavos(v[2]);
      if (valor == null || valor === 0) continue;
      const historico = l.texto.slice(0, v.index).replace(/…|\.\.\./g, ' ').replace(/\s+/g, ' ').trim();
      saida.push({ data, valor: v[1] === '-' ? -valor : valor, historico });
    }
  }
  return saida.reverse();
}
