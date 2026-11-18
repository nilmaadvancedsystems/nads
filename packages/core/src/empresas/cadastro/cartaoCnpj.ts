// O cartão CNPJ (o "Comprovante de Inscrição e de Situação Cadastral" da Receita, em PDF) lido para o cadastro da empresa
// (Vitor, 18/11/2026: "coloca uma opcao de upar o cartao do cnpj em pdf da empresa para realizar o cadastro, (nao e para
// armazenar) apenas pegue os dados e deixe digitado"). Recebe o texto do PDF, uma linha por linha da página (o rótulo numa linha
// e o valor na de baixo, às vezes dois campos na mesma linha), e devolve o que a consulta à Receita devolveria. O regime não
// está no cartão: fica '' (a pessoa escolhe, ou a consulta à Receita diz se é Simples ou MEI).
import type { DadosDaReceita } from './receita';

const CNPJ = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/;
const DATA = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const vazio = (t: string) => (/^\*+$/.test(t.trim()) ? '' : t.trim());

/** A linha de valor logo abaixo do rótulo (pula as linhas de rótulo que o PDF intercala, como "CADASTRAL" e "MATRIZ"). */
function abaixo(linhas: string[], rotulo: string, pular: string[] = []): string {
  const i = linhas.findIndex(l => norm(l).startsWith(rotulo));
  if (i < 0) return '';
  for (let j = i + 1; j < Math.min(linhas.length, i + 4); j++) {
    const l = linhas[j].trim();
    if (!l || pular.includes(norm(l))) continue;
    return l;
  }
  return '';
}

export function ehCartaoCnpj(texto: string): boolean {
  const t = norm(texto);
  return t.includes('COMPROVANTE DE INSCRICAO E DE SITUACAO') && t.includes('CADASTRO NACIONAL DA PESSOA JURIDICA') && CNPJ.test(texto);
}

/** Lê o cartão CNPJ; null se o texto não for de um cartão CNPJ. */
export function lerCartaoCnpj(texto: string): DadosDaReceita | null {
  if (!ehCartaoCnpj(texto)) return null;
  const linhas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const pular = ['CADASTRAL', 'MATRIZ', 'FILIAL'];
  const linhaCnpj = linhas.find(l => CNPJ.test(l)) || '';
  const cnpj = (linhaCnpj.match(CNPJ) || [])[1] || '';
  const ab = linhaCnpj.match(DATA);
  // "NOME EMPRESARIAL  DATA DE CONSTITUIÇÃO": o nome e, no fim, a data
  const razaoSocial = abaixo(linhas, 'NOME EMPRESARIAL', pular).replace(/\s*\d{2}\/\d{2}\/\d{4}\s*$/, '').trim();
  // "TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)  PORTE": o nome e, no fim, o porte (ME, EPP, DEMAIS)
  const fantasia = vazio(abaixo(linhas, 'TITULO DO ESTABELECIMENTO', pular).replace(/\s+(ME|EPP|DEMAIS)\s*$/, ''));
  const atividade = abaixo(linhas, 'CODIGO E DESCRICAO DA ATIVIDADE ECONOMICA PRINCIPAL', pular);
  const ma = atividade.match(/^(\d{2}\.\d{2}-\d-\d{2})\s*-\s*(.+)$/);
  // "CEP  BAIRRO/DISTRITO  MUNICÍPIO  UF": o CEP no começo e a UF no fim (o bairro e o município, sem separação, ficam fora)
  const local = abaixo(linhas, 'CEP BAIRRO', pular);
  const ml = local.match(/^(\d{2}\.?\d{3}-\d{3})\s+(.*)\s+([A-Z]{2})$/);
  const situacao = (abaixo(linhas, 'SITUACAO CADASTRAL DATA DA SITUACAO', pular).replace(/\s*\d{2}\/\d{2}\/\d{4}\s*$/, '').trim() || '').toUpperCase();
  return {
    cnpj: cnpj.replace(/\D/g, ''),
    razaoSocial,
    fantasia,
    situacao,
    regime: '',
    cnae: ma ? ma[1] : '',
    cnaeDescricao: ma ? ma[2].trim() : vazio(atividade),
    municipio: '',
    uf: ml ? ml[3] : '',
    abertura: ab ? ab[3] + '-' + ab[2] + '-' + ab[1] : '',
    // sem o código do IBGE do município, o endereço da nota fiscal fica para a consulta à Receita
    endereco: null,
  };
}
