// O acervo de documentos do escritório na Área do Cliente (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio;
// frase do dono: "Pasta fixa"). A equipe salva o arquivo na pasta fixa do cliente no Drive,
// <ano>\<cód> - nome\ÁREA DO CLIENTE\DO ESCRITÓRIO\ (contrato social, alteração, alvará, balanço), e o robô do PC publica
// na Central de documentos › Do escritório. Só vai o que alguém pôs na pasta: nada é escolhido sozinho pelo arquivador
// (um documento mal identificado iria parar na Área de outra empresa). Holerite e documento com CPF completo de
// funcionário NUNCA vão para esta pasta. Subpastas FISCAL, DP, CONTÁBIL e SOCIETÁRIO dão a área; o solto é societário.
// Só a lógica (sem tela e sem banco).

export type AreaDoEscritorio = 'fiscal' | 'dp' | 'contabil' | 'societario';

/** O que o robô grava em documentos/{id} (lista branca): os bytes vão em pedaços, em documentos/{id}~{n}. */
export interface DocumentoDoEscritorio {
  tipo: 'escritorio';
  id: string;
  nome: string;
  area: AreaDoEscritorio;
  /** ISO: quando o arquivo foi posto (ou mudou) na pasta */
  enviadoEm: string;
  tamanho: number;
  /** quantos pedaços; 0 = grande demais (não baixa pela Área) */
  partes: number;
}

/** O nome da pasta fixa, dentro de ÁREA DO CLIENTE. */
export const PASTA_DO_ESCRITORIO = 'DO ESCRITÓRIO';

const semAcento = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

/** A área pela subpasta (FISCAL, DP / DEPARTAMENTO PESSOAL, CONTÁBIL, SOCIETÁRIO); sem subpasta ou outra, societário. */
export function areaDaSubpasta(subpasta: string | null | undefined): AreaDoEscritorio {
  const s = semAcento(subpasta || '');
  if (s === 'FISCAL') return 'fiscal';
  if (s === 'DP' || s === 'DEPARTAMENTO PESSOAL') return 'dp';
  if (s === 'CONTABIL') return 'contabil';
  return 'societario';
}

/** Um número curto e estável do texto (djb2), para o id não depender do tamanho do caminho. */
function resumo(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** O id estável do documento pela empresa e pelo caminho dentro da pasta ('CONTÁBIL/Balanço 2025.pdf'). */
export function idDoDocumentoDoEscritorio(codigo: number, caminho: string): string {
  const legivel = semAcento(caminho).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return 'esc-' + codigo + '-' + legivel + '-' + resumo(codigo + '|' + caminho);
}
