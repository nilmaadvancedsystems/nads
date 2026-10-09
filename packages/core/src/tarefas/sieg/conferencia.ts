// A conferência fiscal pelos XMLs (Vitor, 09/10/2026: "1 — erros de tributação apontados sozinhos" e "2 — valores, não só
// quantidade"). Puro: a tela só desenha.
//   - errosDeTributacao: cada item das notas emitidas (NF-e/NFC-e) que não fecha com o regime e com a substituição
//     tributária (CST no Simples, CSOSN fora dele, CFOP de ST sem ST no CST, ST no CST com CFOP de venda normal, item
//     com ST sem CEST).
//   - conferirValores: nota a nota, o XML x o relatório do Alterdata — valor diferente, cancelada que foi lançada e
//     lançada que não está nos XMLs.
import type { Nota } from '../../conferencia/tipos';
import type { NotaDoSieg, NotasSieg } from './index';

/** Um item que precisa de revisão. */
export interface ErroDeTributacao {
  numero: string; nome: string; data: string; tipo: string;
  ncm: string; cfop: string; cst: string; cest: string;
  problema: string;
}

// CST com ST (o fim: 10, 30, 60, 70, 90) e CSOSN com ST (201, 202, 203, 500, 900)
const CST_ST = ['10', '30', '60', '70', '90'];
const CSOSN_ST = ['201', '202', '203', '500', '900'];
// CFOP de saída com ST (x401 a x405) e de venda normal (x101, x102)
const cfopFim = (cfop: string) => String(cfop || '').slice(1);
const ehCfopSt = (cfop: string) => ['401', '402', '403', '405'].includes(cfopFim(cfop));
const ehCfopVenda = (cfop: string) => ['101', '102'].includes(cfopFim(cfop));

/** O código do item: CSOSN tem 4 dígitos (origem + 3), CST tem 3 (origem + 2). */
function codigoDoItem(cst: string): { csosn: boolean; codigo: string } | null {
  const c = String(cst || '').replace(/\D/g, '');
  if (c.length === 4) return { csosn: true, codigo: c.slice(1) };
  if (c.length === 3) return { csosn: false, codigo: c.slice(1) };
  return null;
}

/**
 * Os itens das notas emitidas que não fecham. regime: o da empresa ('Simples', 'MEI', 'Presumido', 'Real'; '' = não
 * sabe, e aí não confere CST x CSOSN). As canceladas ficam de fora.
 */
export function errosDeTributacao(x: NotasSieg | null, regime: string): ErroDeTributacao[] {
  if (!x) return [];
  const simples = regime === 'Simples' || regime === 'MEI';
  const normal = regime === 'Presumido' || regime === 'Real';
  const erros: ErroDeTributacao[] = [];
  for (const n of x.emitidas) {
    if (n.cancelada || !(n.tipo === 'NF-e' || n.tipo === 'NFC-e')) continue;
    for (const it of n.itens || []) {
      const cod = codigoDoItem(it.cst);
      const problemas: string[] = [];
      if (cod && simples && !cod.csosn) problemas.push('CST de regime normal: no Simples é CSOSN');
      if (cod && normal && cod.csosn) problemas.push('CSOSN numa empresa fora do Simples: é CST');
      const temSt = !!cod && (cod.csosn ? CSOSN_ST.includes(cod.codigo) : CST_ST.includes(cod.codigo));
      if (cod && ehCfopSt(it.cfop) && !temSt) problemas.push('CFOP de substituição tributária (' + it.cfop + ') com CST/CSOSN sem ST');
      if (temSt && ehCfopVenda(it.cfop) && cod && !['90', '900'].includes(cod.codigo)) problemas.push('ST no CST/CSOSN com CFOP de venda normal (' + it.cfop + ')');
      if (temSt && cod && !['90', '900'].includes(cod.codigo) && !String(it.cest || '').trim()) problemas.push('Item com ST sem CEST');
      for (const problema of problemas) {
        erros.push({ numero: n.numero, nome: n.destinatario.nome, data: n.data, tipo: n.tipo, ncm: it.ncm, cfop: it.cfop, cst: it.cst, cest: it.cest, problema });
      }
    }
  }
  return erros;
}

const semZeros = (v: string) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Uma nota que não fecha entre o XML e o Alterdata. */
export interface NotaQueNaoFecha { numero: string; nome: string; data: string; noXml: number; noAlterdata: number; diferenca: number }

export interface ConferenciaDeValores {
  /** o valor da nota no XML ≠ o valor lançado (a soma das linhas da nota no relatório) */
  diferentes: NotaQueNaoFecha[];
  /** cancelada no SIEG e lançada no Alterdata */
  canceladasLancadas: NotaQueNaoFecha[];
  /** lançada no Alterdata e que não está nos XMLs */
  semXml: NotaQueNaoFecha[];
}

/**
 * O XML x o Alterdata, nota a nota (pelo número sem zeros e, quando os dois têm, o CNPJ/CPF da outra parte: nas entradas
 * dois fornecedores podem ter o mesmo número). lado: 'emitidas' (saídas) ou 'recebidas' (entradas).
 */
export function conferirValores(doXml: NotaDoSieg[], doAlterdata: readonly Nota[], lado: 'emitidas' | 'recebidas'): ConferenciaDeValores {
  const outra = (n: NotaDoSieg) => (lado === 'emitidas' ? n.destinatario : n.emitente);
  const docDe = (v: unknown) => String(v || '').replace(/\D/g, '');
  // o Alterdata: uma nota pode vir em várias linhas (uma por CFOP): soma
  const lancadas = new Map<string, { numero: string; nome: string; data: string; doc: string; valor: number }>();
  for (const a of doAlterdata) {
    const k = semZeros(a.numero);
    if (!k) continue;
    const doc = docDe(a.doc);
    const chave = k + '|' + doc;
    const l = lancadas.get(chave) || { numero: a.numero, nome: a.nome, data: a.data, doc, valor: 0 };
    l.valor = centavos(l.valor + (Number(a.valor) || 0));
    lancadas.set(chave, l);
  }
  const acharLancada = (n: NotaDoSieg) => {
    const k = semZeros(n.numero);
    const doc = docDe(outra(n).doc);
    return lancadas.get(k + '|' + doc) || [...lancadas.entries()].find(([c, l]) => c.startsWith(k + '|') && (!l.doc || !doc))?.[1];
  };
  const r: ConferenciaDeValores = { diferentes: [], canceladasLancadas: [], semXml: [] };
  const usadas = new Set<object>();
  for (const n of doXml) {
    if (!(n.tipo === 'NF-e' || n.tipo === 'NFC-e')) continue;
    const l = acharLancada(n);
    if (l) usadas.add(l);
    if (!l) continue;
    const linha = { numero: n.numero, nome: outra(n).nome || l.nome, data: n.data, noXml: centavos(Number(n.valor) || 0), noAlterdata: l.valor, diferenca: centavos(l.valor - (Number(n.valor) || 0)) };
    if (n.cancelada) r.canceladasLancadas.push(linha);
    else if (Math.abs(linha.diferenca) > 0.05) r.diferentes.push(linha);
  }
  for (const l of lancadas.values()) {
    if (!usadas.has(l)) r.semXml.push({ numero: l.numero, nome: l.nome, data: l.data, noXml: 0, noAlterdata: l.valor, diferenca: l.valor });
  }
  const pelaDiferenca = (a: NotaQueNaoFecha, b: NotaQueNaoFecha) => Math.abs(b.diferenca) - Math.abs(a.diferenca);
  r.diferentes.sort(pelaDiferenca);
  r.semXml.sort(pelaDiferenca);
  return r;
}
