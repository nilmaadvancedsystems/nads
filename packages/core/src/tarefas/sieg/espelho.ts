// O espelho da nota (23/10/2026: "quero que tenha como conferir as danfe direto pelo app, tanto no rateio quanto nas
// outras telas"; a 1ª etapa, com o que o app já guarda do XML: o resumo de siegNotas). A chave em blocos de 4, o modelo
// e a série que a chave carrega, os itens e os totais (produtos, ICMS, ST, IPI, frete, desconto e o total da nota). A
// DANFE completa (a descrição dos produtos, os endereços, a transportadora) precisa do XML inteiro: é a 2ª etapa.
import type { ItemDoXml, NotaDoSieg } from './index';

const centavos = (v: number) => Math.round(v * 100);
const soma = (vs: number[]) => vs.reduce((s, v) => s + centavos(v), 0) / 100;

export interface EspelhoDaNota {
  titulo: string;
  /** a chave em 11 blocos de 4 (como na DANFE) */
  chave: string;
  /** o que a chave diz: a UF (código IBGE), o ano e mês da emissão, o modelo (55 NF-e, 65 NFC-e) */
  daChave: { uf: string; anoMes: string; modelo: string } | null;
  itens: ItemDoXml[];
  totais: { produtos: number; icms: number; st: number; ipi: number; frete: number; desconto: number; total: number };
  /** os itens não vieram (a nota é de antes do resumo com itens, ou o resumo passou do tamanho) */
  semItens: boolean;
}

export function espelhoDaNota(n: NotaDoSieg): EspelhoDaNota {
  const itens = n.itens || [];
  const ch = (n.chave || '').replace(/\D/g, '');
  return {
    titulo: n.tipo + ' ' + n.numero + (n.serie ? ' · série ' + n.serie : '') + ' · ' + n.data,
    chave: ch.replace(/(\d{4})(?=\d)/g, '$1 '),
    daChave: ch.length === 44 ? { uf: ch.slice(0, 2), anoMes: ch.slice(4, 6) + '/20' + ch.slice(2, 4), modelo: ch.slice(20, 22) } : null,
    itens,
    totais: {
      produtos: soma(itens.map(i => i.valor)),
      icms: soma(itens.map(i => i.icms || 0)),
      st: soma(itens.map(i => i.st || 0)),
      ipi: soma(itens.map(i => i.ipi || 0)),
      frete: n.frete || 0,
      desconto: n.desconto || 0,
      total: n.valor,
    },
    semItens: !itens.length,
  };
}
