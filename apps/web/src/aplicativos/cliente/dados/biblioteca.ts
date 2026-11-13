// A Central de documentos como biblioteca (12/11/2026: "retrabalhe completamente a central de documentos"; a escolhida
// entre as propostas: "biblioteca com pastas"). Junta o que a área já tem, em vez de ficar vazia até o robô mandar os
// documentos do escritório: as guias (o PDF), os documentos do DP (a folha, os recibos, as férias…), as DANFEs que o
// cliente pediu, os documentos do escritório (quando houver) e o que o cliente enviou (o recibo: o arquivo fica no
// Drive do escritório, não volta). Cada item com a pasta, o mês de referência (o agrupamento da lista) e se abre.
import { areaCliente as ac, formatos } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import { ROTULO_DA_AREA, type DocumentoDoCliente, type FormatoDoArquivo } from './areaCliente';

export type PastaDaBiblioteca = 'guias' | 'dp' | 'notas' | 'escritorio' | 'enviados';

/** As pastas, com o ícone e o tom do cartão e do selo da linha (13/11/2026: as pastas em cartões no alto). */
export const PASTAS_DA_BIBLIOTECA: { id: PastaDaBiblioteca; rotulo: string; icone: NomeIcone; tom: 'ambar' | 'azul' | 'verde' | 'carmim' | 'neutro'; /** no cartão, quando o rótulo não cabe */ curto?: string }[] = [
  { id: 'guias', rotulo: 'Guias', icone: 'recibo', tom: 'ambar' },
  { id: 'dp', rotulo: 'Folha e DP', icone: 'usuario', tom: 'azul' },
  { id: 'notas', rotulo: 'Notas (DANFE)', icone: 'arquivo', tom: 'verde' },
  { id: 'escritorio', rotulo: 'Do escritório', icone: 'pastaAberta', tom: 'carmim' },
  { id: 'enviados', rotulo: 'Enviados por você', icone: 'upload', tom: 'neutro', curto: 'Enviados' },
];

/** Uma DANFE que já está no espelho (documentos/danfe-<chave>, sem erro). */
export interface DanfeNoEspelho { id: string; nome: string; chave: string; atualizadoEm: string }

export interface ItemDaBiblioteca {
  /** único na lista: a origem e o id */
  chave: string;
  pasta: PastaDaBiblioteca;
  nome: string;
  /** a linha de baixo, em português simples */
  detalhe: string;
  /** 'aaaa-mm': o mês de referência (o agrupamento) */
  mes: string;
  /** 'aaaa-mm-dd': para ordenar dentro do mês e mostrar a data */
  data: string;
  formato: FormatoDoArquivo;
  /** o cliente ainda não baixou (só os do escritório sabem) */
  novo: boolean;
  /** dá para ver e baixar (o enviado pelo cliente não volta) */
  abre: boolean;
  origem: { tipo: 'guia' | 'dp' | 'danfe' | 'escritorio' | 'envio'; id: string; chave?: string };
}

const EXTENSOES: Record<string, FormatoDoArquivo> = { pdf: 'PDF', xlsx: 'XLSX', xls: 'XLSX', csv: 'XLSX', xml: 'XML', zip: 'ZIP', doc: 'DOCX', docx: 'DOCX', jpg: 'JPG', jpeg: 'JPG', png: 'PNG', txt: 'TXT', ofx: 'OFX' };
/** O formato pelo nome do arquivo (o ícone); sem extensão conhecida, PDF. */
export function formatoPeloNome(nome: string): FormatoDoArquivo {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(nome)?.[1] || '').toLowerCase();
  return EXTENSOES[ext] ?? 'PDF';
}

const isoDaData = (br: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.slice(6, 10) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : '');
const mesBr = (c: string) => c.slice(5, 7) + '/' + c.slice(0, 4);
const ROTULO_DO_ENVIO = new Map(ac.TIPOS_DE_ENVIO.map(t => [t.valor as string, t.rotulo]));

/** Tudo o que a Central mostra, do mais novo ao mais antigo (pelo mês de referência e, dentro dele, pela data). */
export function bibliotecaDoCliente(e: {
  guias: readonly ac.GuiaDoCliente[]; documentosDp: readonly ac.DocumentoDoDp[]; danfes: readonly DanfeNoEspelho[];
  documentos: readonly DocumentoDoCliente[]; envios: readonly ac.ReciboDeEnvio[];
}): ItemDaBiblioteca[] {
  const itens: ItemDaBiblioteca[] = [
    ...e.guias.filter(g => g.temPdf).map(g => ({
      chave: 'guia-' + g.id, pasta: 'guias' as const, nome: 'Guia ' + (g.tipo === 'outra' ? '' : g.tipo + ' ') + mesBr(g.competencia),
      detalhe: ac.ROTULO_DA_GUIA[g.tipo] + ' · vence em ' + g.vencimento.slice(0, 5) + ' · ' + formatos.reais(g.valor),
      mes: g.competencia, data: isoDaData(g.vencimento) || g.competencia + '-01', formato: 'PDF' as const, novo: false, abre: true,
      origem: { tipo: 'guia' as const, id: g.id },
    })),
    ...e.documentosDp.map(d => ({
      chave: 'dp-' + d.id, pasta: 'dp' as const, nome: d.nome.replace(/\.[a-z0-9]{2,5}$/i, ''),
      detalhe: ac.ROTULO_DA_CATEGORIA_DP[d.categoria] + (d.funcionario ? ' · ' + d.funcionario : '') + ' · referente a ' + mesBr(d.competencia),
      mes: d.competencia, data: d.competencia + '-01', formato: formatoPeloNome(d.nome), novo: false, abre: d.partes > 0,
      origem: { tipo: 'dp' as const, id: d.id },
    })),
    ...e.danfes.map(d => {
      const mes = '20' + d.chave.slice(2, 4) + '-' + d.chave.slice(4, 6);
      return {
        chave: 'danfe-' + d.id, pasta: 'notas' as const, nome: d.nome.replace(/\.pdf$/i, ''),
        detalhe: (d.chave.slice(20, 22) === '65' ? 'NFC-e' : 'NF-e') + ' nº ' + Number(d.chave.slice(25, 34)) + ' · série ' + Number(d.chave.slice(22, 25)),
        mes, data: (d.atualizadoEm || mes + '-01').slice(0, 10), formato: 'PDF' as const, novo: false, abre: true,
        origem: { tipo: 'danfe' as const, id: d.id, chave: d.chave },
      };
    }),
    ...e.documentos.map(d => ({
      chave: 'esc-' + d.id, pasta: 'escritorio' as const, nome: d.nome, detalhe: ROTULO_DA_AREA[d.area] + (d.descricao ? ' · ' + d.descricao : ''),
      mes: d.competencia || d.enviadoEm.slice(0, 7), data: d.enviadoEm.slice(0, 10), formato: d.formato, novo: d.novo, abre: true,
      origem: { tipo: 'escritorio' as const, id: d.id },
    })),
    ...e.envios.map(x => ({
      chave: 'env-' + x.id, pasta: 'enviados' as const, nome: x.nome.replace(/\.[a-z0-9]{2,5}$/i, ''),
      detalhe: (ROTULO_DO_ENVIO.get(x.tipo) ?? 'Documento') + ' · recebido pelo escritório em ' + new Date(x.recebidoEm).toLocaleDateString('pt-BR'),
      mes: x.recebidoEm.slice(0, 7), data: x.recebidoEm.slice(0, 10), formato: formatoPeloNome(x.nome), novo: false, abre: false,
      origem: { tipo: 'envio' as const, id: x.id },
    })),
  ];
  return itens.filter(i => /^\d{4}-\d{2}$/.test(i.mes)).sort((a, b) => b.mes.localeCompare(a.mes) || b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
}

/** Quantos em cada pasta (e no "Tudo"). */
export function contagemDasPastas(itens: readonly ItemDaBiblioteca[]): Record<PastaDaBiblioteca | 'tudo', number> {
  const n = { tudo: itens.length, guias: 0, dp: 0, notas: 0, escritorio: 0, enviados: 0 };
  for (const i of itens) n[i.pasta]++;
  return n;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O filtro da Central: a pasta, o mês de referência e a busca (no nome e no detalhe, sem acento). */
export function filtrarBiblioteca(itens: readonly ItemDaBiblioteca[], f: { pasta: PastaDaBiblioteca | ''; mes: string; busca: string }): ItemDaBiblioteca[] {
  const b = semAcento(f.busca.trim());
  return itens.filter(i => (!f.pasta || i.pasta === f.pasta) && (!f.mes || i.mes === f.mes) && (!b || semAcento(i.nome + ' ' + i.detalhe).includes(b)));
}

/** A lista em grupos por mês (a ordem dos itens é mantida). */
export function porMesDaBiblioteca(itens: readonly ItemDaBiblioteca[]): { mes: string; itens: ItemDaBiblioteca[] }[] {
  const grupos: { mes: string; itens: ItemDaBiblioteca[] }[] = [];
  for (const i of itens) {
    const g = grupos[grupos.length - 1];
    if (g && g.mes === i.mes) g.itens.push(i); else grupos.push({ mes: i.mes, itens: [i] });
  }
  return grupos;
}

/**
 * Os nomes dos arquivos dentro do .zip (13/11/2026: "baixar vários de uma vez"): sem barra nem caractere que o Windows
 * recusa, e sem repetir (o segundo "Recibo.pdf" vira "Recibo (2).pdf"; a comparação ignora maiúsculas).
 */
export function nomesParaOZip(nomes: readonly string[]): string[] {
  const usados = new Set<string>();
  return nomes.map(bruto => {
    // eslint-disable-next-line no-control-regex -- os caracteres de controle também saem do nome (o Windows recusa)
    const limpo = (bruto.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()) || 'arquivo';
    const ponto = limpo.lastIndexOf('.');
    const base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
    const ext = ponto > 0 ? limpo.slice(ponto) : '';
    let nome = limpo;
    for (let n = 2; usados.has(nome.toLowerCase()); n++) nome = base + ' (' + n + ')' + ext;
    usados.add(nome.toLowerCase());
    return nome;
  });
}

/** O nome do .zip: "Documentos <empresa> <mês>.zip" (o mês por extenso quando é de um mês só; "Guias", "Folha"…). */
export function nomeDoZip(empresa: string, mes?: string, oQue = 'Documentos'): string {
  const quem = empresa.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const quando = mes ? ' ' + formatos.capital(formatos.rot(mes).toLowerCase()) : '';
  return (oQue + ' ' + quem + quando).replace(/\s+/g, ' ').trim() + '.zip';
}
