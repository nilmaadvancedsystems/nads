// Um PDF com guias de vários clientes vira um arquivo por cliente (plano do Acessórias, 17/11/2026, ficha
// E16-pdf-com-varios-clientes; frase do dono: "Separar PDF (E16)"). Quando o portal gera um PDF só com as guias de vários
// clientes, o lote do Fiscal e o do DP separam antes de subir, e a pessoa confirma. Aqui só a conta: de quem é cada página,
// pelo CNPJ/CPF escrito nela. Só a lógica (sem tela e sem banco; o texto de cada página vem do pdf.js na tela).
//
// Regras (com dúvida, a página fica "sem cliente": nunca adivinha):
// - a página com o documento de UM cliente do Cadastro é dele;
// - a página com documentos de DOIS ou mais clientes fica sem cliente;
// - a página sem documento nenhum, logo depois de uma página de um cliente, fica com ele (a guia de duas páginas);
// - documento que não é de nenhum cliente (o CPF do contador, o CNPJ do escritório) não vira cliente; os da lista
//   `ignorar` (raízes de CNPJ, como a do escritório) nem contam como documento da página.

export interface ClienteParaSeparar {
  codigo: number;
  /** o CNPJ ou o CPF, com ou sem pontuação */
  documento: string;
}

export interface PaginasDoCliente {
  codigo: number;
  /** as páginas, a partir de 0 (o separarPdf de ferramentas/pdf.ts usa assim) */
  paginas: number[];
}

/** A raiz do CNPJ do escritório (os 8 primeiros números): nunca é cliente numa guia. */
export const RAIZ_DO_ESCRITORIO = '27872981';

const DOCUMENTO = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const soNumeros = (s: string) => s.replace(/\D/g, '');

/** Os CNPJs e CPFs escritos no texto (só os números), sem os que começam por uma raiz da lista de ignorar. */
export function documentosDoTexto(texto: string, ignorar: readonly string[] = [RAIZ_DO_ESCRITORIO]): string[] {
  const achados = (texto.match(DOCUMENTO) || []).map(soNumeros).filter(d => d.length === 11 || d.length === 14);
  return [...new Set(achados)].filter(d => !ignorar.some(r => d.startsWith(r)));
}

/**
 * De quem é cada página. `textos` = o texto de cada página, na ordem. Devolve os grupos por cliente (na ordem em que o
 * cliente aparece pela primeira vez) e as páginas sem cliente.
 */
export function paginasPorCliente(textos: readonly string[], clientes: readonly ClienteParaSeparar[], ignorar: readonly string[] = [RAIZ_DO_ESCRITORIO]): { grupos: PaginasDoCliente[]; semCliente: number[] } {
  const porDocumento = new Map<string, number>();
  for (const c of clientes) { const d = soNumeros(c.documento || ''); if (d.length === 11 || d.length === 14) porDocumento.set(d, c.codigo); }
  const grupos: PaginasDoCliente[] = [];
  const semCliente: number[] = [];
  let anterior: number | null = null;
  textos.forEach((texto, i) => {
    const docs = documentosDoTexto(texto, ignorar);
    const deles = [...new Set(docs.map(d => porDocumento.get(d)).filter((c): c is number => c != null))];
    let dono: number | null = null;
    if (deles.length === 1) dono = deles[0];
    else if (deles.length === 0 && docs.length === 0 && anterior != null) dono = anterior; // a continuação da guia
    if (dono == null) { semCliente.push(i); anterior = null; return; }
    const g = grupos.find(x => x.codigo === dono);
    if (g) g.paginas.push(i); else grupos.push({ codigo: dono, paginas: [i] });
    anterior = dono;
  });
  return { grupos, semCliente };
}
