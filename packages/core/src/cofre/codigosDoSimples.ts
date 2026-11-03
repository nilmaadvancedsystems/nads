// Os códigos de acesso do Simples Nacional dos relatórios do Fiscal em Word (03/11/2026: "preciso que baseado nesses docx,
// pegue e coloque o codigo de acesso do simples no cadastro, nos docx está nomeado como codigo de acesso"): o "Relatório
// de Empresas" (Fabiana, Heverton) e o "Relatório de Entradas e Saídas" têm, por empresa, um bloco de parágrafos assim:
//   Empresa: <nome>      Código: <código>
//   End: ... · CNPJ: <cnpj> · I.E.: ...
//   CPF do responsável: <cpf>      Código de Acesso: <12 números>
// e a tabela das entradas e saídas do ano. Lê só os parágrafos do word/document.xml (o .docx é um zip). Nada sai daqui às
// claras: quem chama embaralha antes de gravar (o código vai para o cofre, como a senha gov.br).
import * as XLSX from 'xlsx';

export interface CodigoDoSimplesDoRelatorio {
  /** o nome como está no relatório */
  empresa: string;
  /** o "Código:" do relatório (nem sempre é o do ERP: confira pelo CNPJ) */
  codigo: number | null;
  /** só os números */
  cnpj: string;
  /** o CPF do responsável, só os números */
  cpf: string;
  /** o código de acesso (12 números) */
  acesso: string;
}

const desfazer = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** O texto de cada parágrafo do document.xml (os <w:t> de cada <w:p>, juntos). */
export function paragrafosDoDocumento(xml: string): string[] {
  const saida: string[] = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    const t = (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(x => desfazer(x.replace(/<[^>]+>/g, ''))).join('');
    if (t.trim()) saida.push(t);
  }
  return saida;
}

/**
 * Os códigos de acesso dos parágrafos: cada "Empresa:" abre um bloco, que vai até a próxima; dele saem o código, o CNPJ,
 * o CPF e o código de acesso. A empresa sem o código de acesso (ou com um que não tem 12 números) vai em `semCodigo`. A
 * mesma empresa duas vezes (o mesmo CNPJ, ou o mesmo nome sem CNPJ) fica uma só.
 */
export function codigosDosParagrafos(paragrafos: readonly string[]): { itens: CodigoDoSimplesDoRelatorio[]; semCodigo: string[] } {
  const itens = new Map<string, CodigoDoSimplesDoRelatorio>();
  const semCodigo: string[] = [];
  const blocos: string[][] = [];
  for (const p of paragrafos) {
    if (/^\s*Empresa\s*:/i.test(p)) blocos.push([p]);
    else if (blocos.length) blocos[blocos.length - 1].push(p);
  }
  for (const b of blocos) {
    const cab = /^\s*Empresa\s*:\s*(.*?)(?:\s+C[oó]digo\s*:\s*(\d+))?\s*$/i.exec(b[0]);
    const empresa = (cab?.[1] || '').replace(/\s+/g, ' ').trim();
    const texto = b.join('\n');
    const acesso = /C[oó]digo\s+de\s+Acesso\s*:\s*([\d.\s-]+)/i.exec(texto)?.[1].replace(/\D/g, '') || '';
    if (!/^\d{12}$/.test(acesso)) { if (empresa) semCodigo.push(empresa); continue; }
    const cnpj = (/CNPJ\s*:\s*([\d./\s-]+)/i.exec(texto)?.[1] || '').replace(/\D/g, '');
    const cpf = (/CPF\s+do\s+respons[aá]vel\s*:\s*([\d.\s-]+)/i.exec(texto)?.[1] || '').replace(/\D/g, '');
    const item = { empresa, codigo: cab?.[2] ? Number(cab[2]) : null, cnpj: cnpj.length === 14 ? cnpj : '', cpf: cpf.length === 11 ? cpf : '', acesso };
    itens.set(item.cnpj || 'nome:' + empresa.toLowerCase(), item);
  }
  return { itens: [...itens.values()], semCodigo };
}

/** Lê o .docx (o zip) e devolve os códigos de acesso; erro quando o arquivo não é um .docx. */
export function lerCodigosDoSimples(buf: ArrayBuffer): { itens: CodigoDoSimplesDoRelatorio[]; semCodigo: string[]; erro?: string } {
  let xml = '';
  try {
    const zip = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
    const k = zip.FullPaths.findIndex((p: string) => /(^|\/)word\/document\.xml$/.test(p));
    const conteudo = k >= 0 ? zip.FileIndex[k].content : null;
    if (conteudo) xml = new TextDecoder().decode(conteudo as Uint8Array);
  } catch { /* não é zip */ }
  if (!xml) return { itens: [], semCodigo: [], erro: 'Não é um arquivo do Word (.docx).' };
  return codigosDosParagrafos(paragrafosDoDocumento(xml));
}
