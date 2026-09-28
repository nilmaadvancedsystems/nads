// Consulta › Baixar CSV: o filtro SEM ordenar (as linhas saem na ordem guardada) e o nome do arquivo.
// Origem: conferencia.html filtrar (~L2965 — só filtra; quem ordena é o renderConsulta ~L3030),
// clique [data-csv] (~L3294-3303: nome tp+'-'+atual.replace(/\W+/g,'-').toLowerCase()+'.csv').
import { dataOrdem } from '../../formatos';
import type { FiltroConsulta, GrupoConsulta, NotaConsulta } from './consulta';

/** Mesmo filtro da Consulta (período + busca), mantendo a ordem da lista. */
export function filtrarConsultaSemOrdem(lista: NotaConsulta[], f: Pick<FiltroConsulta, 'de' | 'ate' | 'q'>): NotaConsulta[] {
  const q = f.q.toLowerCase();
  const de = f.de && f.de.length === 10 ? dataOrdem(f.de) : 0;
  const ate = f.ate && f.ate.length === 10 ? dataOrdem(f.ate) : 0;
  return lista.filter(n => {
    const t = dataOrdem(n.data);
    return (!de || t >= de) && (!ate || t <= ate) &&
      (!q || n.nome.toLowerCase().indexOf(q) > -1 || n.numero.indexOf(q) > -1 || n.cfop.indexOf(q) > -1 || n.lanc.indexOf(q) > -1);
  });
}

/** O "slug" dos nomes de arquivo do original: tudo que não é letra/número/_ vira "-" (acento também). */
export function slugArquivoLegado(nome: string): string {
  return String(nome || '').replace(/\W+/g, '-').toLowerCase();
}

/** "fiscais-nome-da-empresa.csv" */
export function nomeCsvConsulta(g: GrupoConsulta, empresa: string): string {
  return g + '-' + slugArquivoLegado(empresa) + '.csv';
}
