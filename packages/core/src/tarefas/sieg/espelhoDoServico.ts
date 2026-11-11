// O espelho da nota de serviço (11/11/2026: "a parte dos servicos tomados e prestados nao e clicavel"): no Fiscal › SIEG, a
// NFS-e não abria (não tem itens nem chave de NF-e). Com o que o resumo do SIEG guarda dela: o número e a data, quem prestou
// e quem tomou, o valor, as retenções (e o que sobra depois delas), o NBS e a descrição do serviço, e a chave da NFS-e
// quando veio (a do padrão nacional tem 50 dígitos).
import type { NotaDoSieg } from './index';

const centavos = (v: number) => Math.round(v * 100);

export interface EspelhoDoServico {
  titulo: string;
  /** a chave em blocos de 4 ('' quando a nota não trouxe) */
  chave: string;
  prestador: { doc: string; nome: string };
  tomador: { doc: string; nome: string };
  valor: number;
  retencoes: { imposto: string; valor: number }[];
  retido: number;
  /** o valor menos as retenções */
  liquido: number;
  nbs: string;
  descricao: string;
}

export function espelhoDoServico(n: NotaDoSieg): EspelhoDoServico {
  const retencoes = (n.retencoes || []).filter(r => r.valor);
  const retido = retencoes.reduce((s, r) => s + centavos(r.valor), 0) / 100;
  const ch = (n.chave || '').replace(/\D/g, '');
  return {
    titulo: 'NFS-e ' + n.numero + (n.serie ? ' · série ' + n.serie : '') + ' · ' + n.data,
    chave: ch.replace(/(\d{4})(?=\d)/g, '$1 '),
    prestador: n.emitente, tomador: n.destinatario,
    valor: n.valor, retencoes, retido, liquido: (centavos(n.valor) - centavos(retido)) / 100,
    nbs: n.nbs || '', descricao: n.descricao || '',
  };
}
