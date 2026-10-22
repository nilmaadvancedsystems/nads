// O ícone do arquivo na Central de documentos (Vitor, 16/10/2026: "quero um ícone mais bonito, pode ser dependendo do
// arquivo"). Desenhado à mão: a folha com o canto dobrado, a etiqueta com a extensão e um desenho de dentro por tipo —
// as linhas de texto no PDF e no DOC, a grade na planilha, o </> no XML, o zíper no ZIP e a montanha com o sol na
// imagem. Cada um na cor clássica, pelos tokens do nads (PDF vermelho, planilha verde, XML âmbar, ZIP cinza, DOC azul,
// imagem roxo); a folha leva um tom da mesma cor, para não apagar no escuro. Peça do catálogo (Ícones).
// Desde 22/10/2026 no @nads/ui (Vitor: o Arquivador do site do admin usa o mesmo ícone na lista dos arquivos), com o TXT
// (SPED, Sintegra) e o OFX (extrato do banco) a mais; o CSS foi junto para o nads.css.
import type { CSSProperties, ReactNode } from 'react';

/** O formato do arquivo (o ícone sai dele). */
export type FormatoDoArquivo = 'PDF' | 'XLSX' | 'XML' | 'ZIP' | 'DOCX' | 'JPG' | 'PNG' | 'TXT' | 'OFX';

const COR: Record<FormatoDoArquivo, string> = {
  PDF: 'var(--destructive)', XLSX: 'var(--success)', XML: 'var(--warn)', ZIP: 'var(--ink-muted)', DOCX: 'var(--info)', JPG: 'var(--roxo)', PNG: 'var(--roxo)',
  TXT: 'var(--ciano)', OFX: 'var(--info)',
};
const ROTULO: Record<FormatoDoArquivo, string> = { PDF: 'PDF', XLSX: 'XLS', XML: 'XML', ZIP: 'ZIP', DOCX: 'DOC', JPG: 'JPG', PNG: 'PNG', TXT: 'TXT', OFX: 'OFX' };

const TEXTO = <><path d="M10.5 7.5h5" /><path d="M10.5 10.5h11" /><path d="M10.5 13.5h11" /></>;
const DENTRO: Record<FormatoDoArquivo, ReactNode> = {
  PDF: TEXTO,
  DOCX: TEXTO,
  XLSX: <><rect x="10" y="6.5" width="12" height="8.5" rx="1" /><path d="M14 6.5v8.5" /><path d="M18 6.5v8.5" /><path d="M10 10.75h12" /></>,
  XML: <><path d="m12.5 7.5-2.75 3.25 2.75 3.25" /><path d="m19.5 7.5 2.75 3.25-2.75 3.25" /><path d="m17.25 6.75-2.5 8" /></>,
  ZIP: <><path d="M14 3h2" /><path d="M16 5.25h2" /><path d="M14 7.5h2" /><path d="M16 9.75h2" /><rect x="14" y="12" width="4" height="3.5" rx="1" /></>,
  JPG: <><circle cx="12.5" cy="8.25" r="1.6" /><path d="m10 15 3.5-3.5 2.25 2.25 2.25-2.5L22 15" /></>,
  PNG: <><circle cx="12.5" cy="8.25" r="1.6" /><path d="m10 15 3.5-3.5 2.25 2.25 2.25-2.5L22 15" /></>,
  TXT: TEXTO,
  // o extrato: as colunas do banco
  OFX: <><path d="M11 15V9.5" /><path d="M14.5 15V7" /><path d="M18 15v-4" /><path d="M21.5 15V8.5" /></>,
};

export function IconeDeArquivo({ formato, tamanho = 36 }: { formato: FormatoDoArquivo; /** em px */ tamanho?: number }) {
  const cor = COR[formato] ?? COR.PDF;
  return (
    <svg className="cli-arquivo" viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true" style={{ '--arq': cor } as CSSProperties}>
      {/* a folha e o canto dobrado */}
      <path className="cli-arquivo-folha" d="M8.5 2.5h10.25L25.5 9.25V27a2.5 2.5 0 0 1-2.5 2.5H8.5A2.5 2.5 0 0 1 6 27V5a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path className="cli-arquivo-canto" d="M18.75 2.5v4.25a2.5 2.5 0 0 0 2.5 2.5h4.25" />
      {/* o desenho de dentro */}
      <g className="cli-arquivo-dentro">{DENTRO[formato]}</g>
      {/* a etiqueta com a extensão */}
      <rect className="cli-arquivo-etiqueta" x="2.5" y="17.5" width="20" height="9" rx="2" />
      <text className="cli-arquivo-ext" x="12.5" y="24.1" textAnchor="middle">{ROTULO[formato]}</text>
    </svg>
  );
}

export const FORMATOS_DE_ARQUIVO = Object.keys(ROTULO) as FormatoDoArquivo[];

/** O formato pelo nome do arquivo (a extensão); o que não tem ícone próprio vira PDF. */
export function formatoPeloNome(nome: string): FormatoDoArquivo {
  const e = (/\.([a-z0-9]+)$/i.exec(nome || '')?.[1] || '').toLowerCase();
  if (e === 'xml') return 'XML';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(e)) return 'XLSX';
  if (['zip', 'rar', '7z'].includes(e)) return 'ZIP';
  if (['doc', 'docx', 'odt', 'rtf'].includes(e)) return 'DOCX';
  if (['jpg', 'jpeg', 'heic', 'webp'].includes(e)) return 'JPG';
  if (['png', 'gif', 'bmp', 'tif', 'tiff'].includes(e)) return 'PNG';
  if (e === 'ofx') return 'OFX';
  if (['txt', 'ret', 'rem'].includes(e)) return 'TXT';
  return 'PDF';
}
