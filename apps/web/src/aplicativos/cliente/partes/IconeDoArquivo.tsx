// O ícone do arquivo na Área do Cliente (15/11/2026: "vamos melhorar mais", escolhido "ícones dos arquivos"): a folha de
// traço com o canto dobrado, um tom leve da cor do formato por dentro e a extensão escrita dentro da folha. Sem a
// etiqueta cheia saindo pela lateral nem o desenho de dentro, para ficar no mesmo traço dos outros ícones da Área.
// O Arquivador do admin segue com o IconeDeArquivo do @nads/ui.
import type { CSSProperties } from 'react';
import type { FormatoDoArquivo } from '@nads/ui';

const COR: Record<FormatoDoArquivo, string> = {
  PDF: 'var(--destructive)', XLSX: 'var(--success)', XML: 'var(--warn)', ZIP: 'var(--ink-muted)', DOCX: 'var(--info)', JPG: 'var(--roxo)', PNG: 'var(--roxo)',
  TXT: 'var(--ciano)', OFX: 'var(--info)',
};
const ROTULO: Record<FormatoDoArquivo, string> = { PDF: 'PDF', XLSX: 'XLS', XML: 'XML', ZIP: 'ZIP', DOCX: 'DOC', JPG: 'JPG', PNG: 'PNG', TXT: 'TXT', OFX: 'OFX' };

export function IconeDoArquivo({ formato, tamanho = 32 }: { formato: FormatoDoArquivo; /** em px */ tamanho?: number }) {
  return (
    <svg className="cli-arq" viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true" style={{ '--arq': COR[formato] ?? COR.PDF } as CSSProperties}>
      <path className="cli-arq-folha" d="M7.5 2.5h11L26 10v17a2.5 2.5 0 0 1-2.5 2.5h-16A2.5 2.5 0 0 1 5 27V5a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path className="cli-arq-canto" d="M18.5 2.5v5.5a2 2 0 0 0 2 2H26" />
      <text className="cli-arq-ext" x="15.5" y="23.4" textAnchor="middle">{ROTULO[formato] ?? 'PDF'}</text>
    </svg>
  );
}
