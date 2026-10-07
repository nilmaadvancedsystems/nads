// A etapa Bens do Contábil (Vitor, 07/10/2026): as notas de entrada de compra de bem do ativo imobilizado (1551, 2551,
// 3551 e os CFOPs ligados: com ST, transferência, devolução de venda) e as saídas que baixam bem (venda, transferência,
// devolução de compra), tiradas das notas importadas na Conferência, no período da tarefa. Também aponta a nota de uso e
// consumo cujo item tem NCM de bem (veículo, máquina, equipamento, computador, móvel): "lançada no imobilizado, não na despesa".
// Só lê: nada aqui grava.
import type { Nota } from '../../conferencia/tipos';

/** O que a nota faz com o imobilizado. */
export type EfeitoNoImobilizado = 'entra' | 'sai' | 'nao-mexe';

export interface TipoDeCfopDeBem { rotulo: string; efeito: EfeitoNoImobilizado }

/** Entradas (1xxx, 2xxx, 3xxx), pelos três últimos dígitos do CFOP. */
const ENTRADAS: Record<string, TipoDeCfopDeBem> = {
  '551': { rotulo: 'Compra de bem para o ativo imobilizado', efeito: 'entra' },
  '406': { rotulo: 'Compra de bem para o ativo imobilizado com ST', efeito: 'entra' },
  '552': { rotulo: 'Transferência de bem do ativo imobilizado', efeito: 'entra' },
  '553': { rotulo: 'Devolução de venda de bem do ativo imobilizado', efeito: 'entra' },
  '554': { rotulo: 'Retorno de bem remetido para uso fora do estabelecimento', efeito: 'nao-mexe' },
  '555': { rotulo: 'Bem de terceiro recebido para uso no estabelecimento', efeito: 'nao-mexe' },
};

/** Saídas (5xxx, 6xxx, 7xxx). */
const SAIDAS: Record<string, TipoDeCfopDeBem> = {
  '551': { rotulo: 'Venda de bem do ativo imobilizado', efeito: 'sai' },
  '552': { rotulo: 'Transferência de bem do ativo imobilizado', efeito: 'sai' },
  '553': { rotulo: 'Devolução de compra de bem do ativo imobilizado', efeito: 'sai' },
  '412': { rotulo: 'Devolução de bem do ativo imobilizado recebido com ST', efeito: 'sai' },
  '554': { rotulo: 'Remessa de bem para uso fora do estabelecimento', efeito: 'nao-mexe' },
  '555': { rotulo: 'Devolução de bem de terceiro recebido para uso', efeito: 'nao-mexe' },
};

/** Uso e consumo (1556, 2556, 1407, 2407…): onde o bem costuma ser lançado como despesa. */
const USO_E_CONSUMO = new Set(['556', '407']);

const soDigitos = (cfop: string) => String(cfop || '').replace(/\D/g, '');

/** O CFOP é de bem do ativo imobilizado? (entrada ou saída) */
export function tipoDoCfopDeBem(cfop: string): TipoDeCfopDeBem | null {
  const d = soDigitos(cfop);
  if (d.length !== 4) return null;
  const tabela = '123'.includes(d[0]) ? ENTRADAS : '567'.includes(d[0]) ? SAIDAS : null;
  return tabela?.[d.slice(1)] ?? null;
}

/**
 * NCM de bem do imobilizado: veículos e reboques (8701–8705, 8711, 8716), máquinas e aparelhos (capítulo 84, com os
 * computadores 8471), máquinas e equipamentos elétricos (capítulo 85) e móveis (9401, 9403).
 */
export function ncmDeBem(ncm: string | undefined): boolean {
  const d = String(ncm || '').replace(/\D/g, '');
  if (d.length < 4) return false;
  const p4 = d.slice(0, 4);
  return d.startsWith('84') || d.startsWith('85') || ['8701', '8702', '8703', '8704', '8705', '8711', '8716', '9401', '9403'].includes(p4);
}

/** Uma nota (as linhas de item da mesma nota juntas). */
export interface NotaDeBem {
  chave: string;
  numero: string;
  data: string;
  /** aaaa-mm */
  comp: string;
  nome: string;
  doc: string;
  cfop: string;
  tipo: string;
  efeito: EfeitoNoImobilizado;
  valor: number;
  /** os NCM dos itens (quando o relatório traz) */
  ncms: string[];
  /** a conta do fornecedor/cliente, quando o relatório traz */
  conta: string;
}

export interface BensDoPeriodo {
  /** entradas de bem (compra, transferência, devolução de venda, e as que não mexem no imobilizado) */
  entradas: NotaDeBem[];
  /** saídas de bem (venda, transferência, devolução de compra, remessa) */
  saidas: NotaDeBem[];
  /** notas de uso e consumo com item de NCM de bem: podem ter ido para a despesa */
  usoEConsumo: NotaDeBem[];
  totais: { entram: number; saem: number };
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const ordemDaData = (d: string) => { const [dd, mm, aa] = String(d || '').split('/'); return (aa || '') + (mm || '') + (dd || ''); };

/** Junta as linhas da mesma nota (número + fornecedor + CFOP) e soma o valor. */
function juntar(linhas: readonly Nota[], tipo: (n: Nota) => TipoDeCfopDeBem): NotaDeBem[] {
  const por = new Map<string, NotaDeBem>();
  for (const n of linhas) {
    const chave = [n.comp, n.numero, n.doc || n.nome, soDigitos(n.cfop)].join('|');
    const t = tipo(n);
    const atual = por.get(chave) || {
      chave, numero: n.numero, data: n.data, comp: n.comp, nome: n.nome, doc: n.doc || '', cfop: soDigitos(n.cfop),
      tipo: t.rotulo, efeito: t.efeito, valor: 0, ncms: [], conta: n.conta || '',
    };
    atual.valor = centavos(atual.valor + (Number(n.valor) || 0));
    if (n.ncm && !atual.ncms.includes(n.ncm)) atual.ncms.push(n.ncm);
    por.set(chave, atual);
  }
  return [...por.values()].sort((a, b) => ordemDaData(a.data).localeCompare(ordemDaData(b.data)) || a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
}

/** As notas de bem dos meses da tarefa (entradas e saídas importadas na Conferência). */
export function bensDoPeriodo(entradas: readonly Nota[], saidas: readonly Nota[], meses: readonly string[]): BensDoPeriodo {
  const noPeriodo = (n: Nota) => meses.includes(n.comp);
  const ent = juntar(entradas.filter(n => noPeriodo(n) && tipoDoCfopDeBem(n.cfop)), n => tipoDoCfopDeBem(n.cfop) as TipoDeCfopDeBem);
  const sai = juntar(saidas.filter(n => noPeriodo(n) && tipoDoCfopDeBem(n.cfop)), n => tipoDoCfopDeBem(n.cfop) as TipoDeCfopDeBem);
  const uso = juntar(
    entradas.filter(n => noPeriodo(n) && USO_E_CONSUMO.has(soDigitos(n.cfop).slice(1)) && ncmDeBem(n.ncm)),
    () => ({ rotulo: 'Compra para uso e consumo', efeito: 'nao-mexe' }),
  );
  return {
    entradas: ent,
    saidas: sai,
    usoEConsumo: uso,
    totais: {
      entram: centavos(ent.filter(n => n.efeito === 'entra').reduce((s, n) => s + n.valor, 0)),
      saem: centavos(sai.filter(n => n.efeito === 'sai').reduce((s, n) => s + n.valor, 0)),
    },
  };
}

/** Notas de teste do ⚡ (modo desenvolvedor): uma compra de veículo, um computador com ST, uma venda e um uso e consumo suspeito. */
export function notasDeBensDeTeste(meses: readonly string[]): { entradas: Nota[]; saidas: Nota[] } {
  const m = meses[meses.length - 1] || '2026-08';
  const [a, mm] = m.split('-');
  const d = (dia: string) => dia + '/' + mm + '/' + a;
  const n = (cfop: string, numero: string, nome: string, valor: number, data: string, ncm: string, desc: string): Nota =>
    ({ cfop, lanc: '', valor, numero, nome, data: d(data), desc, comp: m, ncm, doc: '' });
  return {
    entradas: [
      n('2551', '45120', 'CONCESSIONARIA EXEMPLO VEICULOS LTDA', 189900, '05', '87042310', 'Compra de bem para o ativo imobilizado'),
      n('1406', '8812', 'INFORMATICA EXEMPLO LTDA', 7450.9, '12', '84713012', 'Compra de bem para o ativo imobilizado com ST'),
      n('1556', '3307', 'LOJA DE MOVEIS EXEMPLO ME', 4380, '18', '94033000', 'Compra de material para uso ou consumo'),
      n('1556', '3310', 'PAPELARIA EXEMPLO ME', 212.4, '19', '48201000', 'Compra de material para uso ou consumo'),
    ],
    saidas: [
      n('5551', '1503', 'COMPRADOR EXEMPLO DE MAQUINAS LTDA', 32000, '22', '84295190', 'Venda de bem do ativo imobilizado'),
    ],
  };
}
