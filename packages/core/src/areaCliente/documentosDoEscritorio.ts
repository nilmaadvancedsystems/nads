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

// ---------- o arquivo que a equipe manda ao cliente pela Tarefas (26/11/2026, o módulo Área do Cliente refeito; o dono
// escolheu "Pelo Drive") ----------
// A tela manda pelo enviosSecretario com o campo cliente = MARCA + área; o robô da nuvem grava na subpasta da área
// (robo/envios-do-nads.js, gravarParaOCliente) e o robô do PC publica na Central › Do escritório.

/** A marca no campo cliente do envio: "@area-do-cliente/dp". */
export const MARCA_DO_ENVIO_AO_CLIENTE = '@area-do-cliente/';
/** A subpasta de cada área dentro de DO ESCRITÓRIO. */
export const SUBPASTA_DA_AREA: Readonly<Record<AreaDoEscritorio, string>> = { fiscal: 'FISCAL', dp: 'DP', contabil: 'CONTÁBIL', societario: 'SOCIETÁRIO' };
/** As áreas na ordem do seletor, com o rótulo. */
export const AREAS_DO_ESCRITORIO: readonly { valor: AreaDoEscritorio; rotulo: string }[] = [
  { valor: 'fiscal', rotulo: 'Fiscal' }, { valor: 'dp', rotulo: 'Departamento Pessoal' }, { valor: 'contabil', rotulo: 'Contábil' }, { valor: 'societario', rotulo: 'Societário' },
];
/** O maior arquivo que o cliente consegue baixar pela Área (o robô do PC não publica acima disso). */
export const MAIOR_ENVIO_AO_CLIENTE = 5 * 1024 * 1024;

/** O campo cliente do envio para a área. */
export function clienteDoEnvioAoCliente(area: AreaDoEscritorio): string {
  return MARCA_DO_ENVIO_AO_CLIENTE + area;
}

/** O erro do arquivo que a equipe quer mandar ao cliente, ou ''. */
export function erroDoEnvioAoCliente(arquivo: { nome: string; tamanho: number } | null): string {
  if (!arquivo) return 'Escolha o arquivo.';
  if (!arquivo.tamanho) return 'O arquivo está vazio.';
  if (arquivo.tamanho > MAIOR_ENVIO_AO_CLIENTE) return 'O arquivo passa de 5 MB: o cliente não conseguiria baixar.';
  if (/(holerite|recibo de pagamento|contracheque)/i.test(arquivo.nome)) return 'Holerite não vai pela Área do Cliente (tem o CPF completo do funcionário).';
  return '';
}
