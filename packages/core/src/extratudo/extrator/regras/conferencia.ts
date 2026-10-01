// Conferência extrato × sistema: o coração do Extrator.
// Origem: protótipo do Extrator (leitura.js: conferir).
//
// Ordem das passadas (cada lançamento entra em uma linha só):
//  0. se o sistema veio com todos os sinais trocados (o razão exportado ao contrário), inverte;
//  1. conferido: mesma data e mesmo valor (entre vários, o de histórico mais parecido);
//  2. duplicado: o que sobrou e é igual (data, valor e histórico parecido) a um já conferido do
//     mesmo lado — lançado duas vezes no sistema, ou repetido no extrato;
//  2b. conferido pelo total do dia: a cobrança em lote (o banco credita num lançamento só, o razão lança
//     cliente por cliente) — no mesmo dia, o que sobrou dos dois lados soma igual, no centavo;
//  2c. depois do passo 3, o total do dia de novo e, no que ainda não fecha, lote a lote (os do sistema que somam
//     exatamente cada lote do extrato);
//  3. diferente (data): mesmo valor, data até `tolerancia` dias de distância (a mais próxima);
//  4. diferente (sinal): mesmo valor com sinal trocado, dentro da tolerância;
//  5. diferente (valor): mesma data (ou dentro da tolerância) e histórico parecido, valor diferente;
//  6. o que sobrou no extrato está faltando no sistema; o que sobrou no sistema está a mais.
import type { Conferencia, LancamentoDoArquivo, LinhaConferencia, Situacao } from '../tipos';
import { montarCsv } from '../../../formatos';
import { dataBR, numeroDoDia, parecido, valorBR } from './texto';

/** Mínimo de parecença dos históricos para "valor diferente": mesmo dia / dias diferentes. */
export const PARECIDO_MESMO_DIA = 0.34;
export const PARECIDO_OUTRO_DIA = 0.5;
/** Mínimo para uma sobra ser cópia de um lançamento já conferido. */
export const PARECIDO_DUPLICADO = 0.5;

interface Item extends LancamentoDoArquivo { dia: number }

// no mesmo dia: o conferido e logo a cópia dele (duplicado), depois as outras pendências
const ORDEM: Record<Situacao, number> = { ok: 0, duplicado: 1, diferente: 2, faltando: 3, amais: 4 };

export function conferir(extrato: LancamentoDoArquivo[], sistema: LancamentoDoArquivo[], tolerancia = 3): Conferencia {
  const chaves = new Set(sistema.map(x => x.data + '|' + x.valor));
  let iguais = 0, invertidos = 0;
  for (const b of extrato) {
    if (chaves.has(b.data + '|' + b.valor)) iguais++;
    else if (chaves.has(b.data + '|' + -b.valor)) invertidos++;
  }
  const sistemaInvertido = invertidos >= 3 && invertidos > iguais * 2;

  const B: Item[] = extrato.map(x => ({ ...x, dia: numeroDoDia(x.data) })).sort((a, b) => a.dia - b.dia);
  const C: Item[] = sistema.map(x => ({ ...x, valor: sistemaInvertido ? -x.valor : x.valor, dia: numeroDoDia(x.data) }));
  const usadoB = new Set<string>(), usadoC = new Set<string>();
  const linhas: LinhaConferencia[] = [];
  const linha = (l: Omit<LinhaConferencia, 'data'>) => linhas.push({ ...l, data: (l.extrato || l.sistema)!.data });

  // 1. mesma data e mesmo valor
  const porDataValor = new Map<string, Item[]>();
  for (const c of C) { const k = c.data + '|' + c.valor; const l = porDataValor.get(k); if (l) l.push(c); else porDataValor.set(k, [c]); }
  const conferidosB = new Map<string, Item[]>(), conferidosC = new Map<string, Item[]>();
  for (const b of B) {
    const k = b.data + '|' + b.valor;
    let melhor: Item | null = null, nota = -1;
    for (const c of porDataValor.get(k) || []) {
      if (usadoC.has(c.id)) continue;
      const p = parecido(b.historico, c.historico);
      if (p > nota) { nota = p; melhor = c; }
    }
    if (!melhor) continue;
    usadoB.add(b.id); usadoC.add(melhor.id);
    linha({ situacao: 'ok', extrato: b, sistema: melhor, motivo: '' });
    (conferidosB.get(k) || conferidosB.set(k, []).get(k)!).push(b);
    (conferidosC.get(k) || conferidosC.set(k, []).get(k)!).push(melhor);
  }

  // 2. duplicados
  for (const c of C) {
    if (usadoC.has(c.id)) continue;
    const g = conferidosC.get(c.data + '|' + c.valor);
    if (g && g.some(o => parecido(o.historico, c.historico) >= PARECIDO_DUPLICADO)) {
      usadoC.add(c.id);
      linha({ situacao: 'duplicado', extrato: null, sistema: c, ladoDuplicado: 'sistema', motivo: 'Lançado mais de uma vez no sistema' });
    }
  }
  for (const b of B) {
    if (usadoB.has(b.id)) continue;
    const g = conferidosB.get(b.data + '|' + b.valor);
    if (g && g.some(o => parecido(o.historico, b.historico) >= PARECIDO_DUPLICADO)) {
      usadoB.add(b.id);
      linha({ situacao: 'duplicado', extrato: b, sistema: null, ladoDuplicado: 'banco', motivo: 'Aparece repetido no extrato e só uma vez no sistema' });
    }
  }

  // 2b. pelo total do dia (Vitor, 01/10/2026; a 292 no Sicoob): "CRÉD.LIQ.COBRANÇA DOC.: 1820477" 5.852,54 no extrato
  // e, no razão, os clientes daquele lote (com descontos e juros dentro). No mesmo dia, se o que sobrou do extrato soma
  // exatamente o que sobrou do sistema, tudo daquele dia está conferido. Um contra um fica para os passos de baixo.
  const soma = (l: Item[]) => l.reduce((t, x) => t + x.valor, 0);
  const sobrasPorDia = () => {
    const sb = new Map<number, Item[]>(), sc = new Map<number, Item[]>();
    for (const b of B) if (!usadoB.has(b.id)) (sb.get(b.dia) || sb.set(b.dia, []).get(b.dia)!).push(b);
    for (const c of C) if (!usadoC.has(c.id)) (sc.get(c.dia) || sc.set(c.dia, []).get(c.dia)!).push(c);
    return { sb, sc };
  };
  const conferirGrupo = (bs: Item[], cs: Item[], motivo: string) => {
    for (const b of bs) { usadoB.add(b.id); linha({ situacao: 'ok', extrato: b, sistema: null, motivo }); }
    for (const c of cs) { usadoC.add(c.id); linha({ situacao: 'ok', extrato: null, sistema: c, motivo }); }
  };
  const peloTotalDoDia = () => {
    const { sb, sc } = sobrasPorDia();
    for (const [dia, bs] of sb) {
      const cs = sc.get(dia);
      if (!cs || bs.length + cs.length < 3 || soma(bs) !== soma(cs)) continue;
      conferirGrupo(bs, cs, 'Conferido pelo total do dia: ' + bs.length + (bs.length === 1 ? ' lançamento' : ' lançamentos') + ' no extrato, ' + cs.length + ' no sistema, somando ' + valorBR(soma(bs)));
    }
  };
  peloTotalDoDia();

  // sobras do sistema por dia, para achar vizinhos
  const porDia = new Map<number, Item[]>();
  for (const c of C) if (!usadoC.has(c.id)) { const l = porDia.get(c.dia); if (l) l.push(c); else porDia.set(c.dia, [c]); }
  const perto = (b: Item, t: number) => {
    const r: Item[] = [];
    for (let k = -t; k <= t; k++) for (const c of porDia.get(b.dia + k) || []) if (!usadoC.has(c.id)) r.push(c);
    return r;
  };
  const casar = (b: Item, c: Item, l: Omit<LinhaConferencia, 'data' | 'extrato' | 'sistema' | 'situacao'>) => {
    usadoB.add(b.id); usadoC.add(c.id);
    linha({ situacao: 'diferente', extrato: b, sistema: c, ...l });
  };

  // 3. mesmo valor, data próxima
  if (tolerancia > 0) {
    for (const b of B) {
      if (usadoB.has(b.id)) continue;
      let melhor: Item | null = null, dist = Infinity, nota = -1;
      for (const c of perto(b, tolerancia)) {
        if (c.valor !== b.valor) continue;
        const d = Math.abs(c.dia - b.dia), p = parecido(b.historico, c.historico);
        if (d < dist || (d === dist && p > nota)) { dist = d; nota = p; melhor = c; }
      }
      if (melhor) casar(b, melhor, { tipoDiferenca: 'data', motivo: 'Data diferente: ' + dist + (dist === 1 ? ' dia' : ' dias') });
    }
  }

  // 3b. tirado o que só mudou de data, o resto do dia pode fechar; o que ainda não fecha, lote a lote: os
  // lançamentos do sistema do mesmo dia que somam exatamente cada lote do extrato (assim só o que está errado sobra)
  peloTotalDoDia();
  {
    const { sb, sc } = sobrasPorDia();
    for (const [dia, bs] of sb) {
      for (const b of bs.slice().sort((x, y) => Math.abs(y.valor) - Math.abs(x.valor))) {
        const livres = (sc.get(dia) || []).filter(c => !usadoC.has(c.id) && (c.valor > 0) === (b.valor > 0));
        const grupo = subconjuntoQueSoma(livres, b.valor);
        if (grupo) conferirGrupo([b], grupo, 'Conferido pelo lote: ' + grupo.length + ' lançamentos no sistema somando ' + valorBR(b.valor));
      }
    }
  }

  // 4. sinal trocado
  for (const b of B) {
    if (usadoB.has(b.id)) continue;
    const c = perto(b, tolerancia).find(x => x.valor === -b.valor);
    if (c) casar(b, c, { tipoDiferenca: 'sinal', motivo: b.valor > 0 ? 'No extrato é entrada; no sistema está como saída' : 'No extrato é saída; no sistema está como entrada' });
  }

  // 5. valor diferente, histórico parecido
  for (const b of B) {
    if (usadoB.has(b.id)) continue;
    let melhor: Item | null = null, nota = 0;
    for (const c of perto(b, tolerancia)) {
      if ((c.valor > 0) !== (b.valor > 0)) continue;
      const p = parecido(b.historico, c.historico);
      const minimo = c.dia === b.dia ? PARECIDO_MESMO_DIA : PARECIDO_OUTRO_DIA;
      if (p >= minimo && p > nota) { nota = p; melhor = c; }
    }
    if (melhor) casar(b, melhor, { tipoDiferenca: 'valor', motivo: 'Valor diferente: diferença de ' + valorBR(Math.abs(melhor.valor - b.valor)) });
  }

  // 6. sobras
  for (const b of B) if (!usadoB.has(b.id)) linha({ situacao: 'faltando', extrato: b, sistema: null, motivo: 'Está no extrato e não no sistema' });
  for (const c of C) if (!usadoC.has(c.id)) linha({ situacao: 'amais', extrato: null, sistema: c, motivo: 'Está no sistema e não no extrato' });

  const limpo = (x: LancamentoDoArquivo | null): LancamentoDoArquivo | null => {
    if (!x) return null;
    const { id, idArquivo, lado, data, valor, historico } = x;
    return { id, idArquivo, lado, data, valor, historico };
  };
  const final = linhas
    .map(l => ({ ...l, extrato: limpo(l.extrato), sistema: limpo(l.sistema) }))
    .sort((a, b) => a.data.localeCompare(b.data) || ORDEM[a.situacao] - ORDEM[b.situacao]);
  const contagem: Record<Situacao, number> = { ok: 0, faltando: 0, diferente: 0, amais: 0, duplicado: 0 };
  for (const l of final) contagem[l.situacao]++;
  return { linhas: final, sistemaInvertido, contagem };
}

/**
 * Os lançamentos (2 ou mais, do mesmo sinal) que somam exatamente o alvo; null = nenhum, ou a busca passou do
 * limite (dia com lançamentos demais). Os maiores primeiro, cortando quando o que resta não alcança o alvo.
 */
function subconjuntoQueSoma<T extends { valor: number }>(itens: T[], alvo: number, limite = 200000): T[] | null {
  const v = itens.map(x => ({ x, a: Math.abs(x.valor) })).sort((p, q) => q.a - p.a);
  const t = Math.abs(alvo);
  const resto: number[] = [];
  for (let i = v.length - 1, r = 0; i >= 0; i--) { r += v[i].a; resto[i] = r; }
  let passos = 0;
  const escolhidos: number[] = [];
  const buscar = (i: number, falta: number): boolean => {
    if (falta === 0) return escolhidos.length >= 2;
    if (i >= v.length || resto[i] < falta || ++passos > limite) return false;
    if (v[i].a <= falta) {
      escolhidos.push(i);
      if (buscar(i + 1, falta - v[i].a)) return true;
      escolhidos.pop();
    }
    return buscar(i + 1, falta);
  };
  return buscar(0, t) ? escolhidos.map(i => v[i].x) : null;
}

/** Entradas, saídas e o líquido de uma lista (centavos). */
export function totais(l: { valor: number }[]): { entradas: number; saidas: number; liquido: number } {
  let entradas = 0, saidas = 0;
  for (const x of l) if (x.valor > 0) entradas += x.valor; else saidas += x.valor;
  return { entradas, saidas, liquido: entradas + saidas };
}

const ROTULO: Record<Situacao, string> = { ok: 'Conferido', faltando: 'Faltando', diferente: 'Diferente', amais: 'A mais', duplicado: 'Duplicado' };

export function rotuloSituacao(s: Situacao): string {
  return ROTULO[s];
}

/** A conferência em CSV do escritório (";" e BOM), uma linha por par. */
export function csvConferencia(c: Conferencia): string {
  const cel = (v: string) => (/[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const num = (x: number) => (x / 100).toFixed(2).replace('.', ',');
  const linhas = [['Situação', 'Data extrato', 'Histórico extrato', 'Valor extrato', 'Data sistema', 'Histórico sistema', 'Valor sistema', 'O que houve'].join(';')];
  for (const l of c.linhas) {
    const b = l.extrato, s = l.sistema;
    linhas.push([ROTULO[l.situacao], b ? dataBR(b.data) : '', b ? b.historico : '', b ? num(b.valor) : '', s ? dataBR(s.data) : '', s ? s.historico : '', s ? num(s.valor) : '', l.motivo].map(cel).join(';'));
  }
  return montarCsv(linhas);
}
