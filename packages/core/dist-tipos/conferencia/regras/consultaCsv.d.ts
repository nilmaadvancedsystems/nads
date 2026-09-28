import type { FiltroConsulta, GrupoConsulta, NotaConsulta } from './consulta';
/** Mesmo filtro da Consulta (período + busca), mantendo a ordem da lista. */
export declare function filtrarConsultaSemOrdem(lista: NotaConsulta[], f: Pick<FiltroConsulta, 'de' | 'ate' | 'q'>): NotaConsulta[];
/** O "slug" dos nomes de arquivo do original: tudo que não é letra/número/_ vira "-" (acento também). */
export declare function slugArquivoLegado(nome: string): string;
/** "fiscais-nome-da-empresa.csv" */
export declare function nomeCsvConsulta(g: GrupoConsulta, empresa: string): string;
