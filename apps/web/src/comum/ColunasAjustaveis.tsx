// Colunas com a largura ajustável (Vitor, 09/11/2026: "deixe possível os ajustes das colunas"): cada título ganha a alça da
// grade dos meses (arrastar ajusta; duplo clique volta ao padrão). As larguras ficam neste navegador, por tabela. Uma coluna
// é a flexível: enquanto a pessoa não mexe nela, fica com o que sobra da tela. Passando do que cabe, a tabela rola de lado.
import { useState, type CSSProperties, type PointerEvent as EventoDoPonteiro } from 'react';

const CHAVE = 'nads-colunas-';
const MENOR = 28;
const MAIOR = 900;
type Larguras = Record<string, number>;

export interface ColunaAjustavel { id: string; padrao: number }

function ler(id: string): Larguras {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE + id) || '{}');
    return v && typeof v === 'object' ? v as Larguras : {};
  } catch { return {}; }
}
function gravar(id: string, px: Larguras) {
  try {
    if (Object.keys(px).length) localStorage.setItem(CHAVE + id, JSON.stringify(px)); else localStorage.removeItem(CHAVE + id);
  } catch { /* só nesta tela */ }
}

/** id: o nome da tabela; flexivel: a coluna que fica com o que sobra (o padrao dela é o mínimo enquanto não for ajustada). */
export function useColunasAjustaveis(id: string, colunas: readonly ColunaAjustavel[], flexivel: string) {
  const [estado, setEstado] = useState(() => ({ id, px: ler(id) }));
  // a mesma tela pode trocar de tabela (o Simples e o Presumido)
  if (estado.id !== id) setEstado({ id, px: ler(id) });
  const px = estado.id === id ? estado.px : ler(id);

  const largura = (c: string) => px[c] ?? colunas.find(x => x.id === c)?.padrao ?? 0;
  const soma = colunas.reduce((s, c) => s + largura(c.id), 0);

  function arrastar(coluna: string, e: EventoDoPonteiro<HTMLSpanElement>) {
    const th = e.currentTarget.parentElement;
    if (!th) return;
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = th.getBoundingClientRect().width;
    let ultimo = px;
    const mover = (ev: PointerEvent) => {
      ultimo = { ...px, [coluna]: Math.round(Math.max(MENOR, Math.min(MAIOR, w0 + ev.clientX - x0))) };
      setEstado({ id, px: ultimo });
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      gravar(id, ultimo);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }
  function voltar(coluna: string) {
    const resto = { ...px };
    delete resto[coluna];
    setEstado({ id, px: resto });
    gravar(id, resto);
  }

  return {
    largura,
    /** a flexível ajustada: a tabela tem exatamente a soma; senão, ocupa a tela e não fica menor que a soma */
    tabela: (px[flexivel] ? { width: soma, minWidth: soma } : { minWidth: soma }) as CSSProperties,
    /** o estilo do <col> (a flexível sem ajuste fica sem largura: é ela que pega o que sobra) */
    col: (c: string): CSSProperties | undefined => (c === flexivel && !px[c] ? undefined : { width: largura(c) }),
    /** a alça: vai dentro do <th> da coluna */
    alca: (c: string) => (
      <span className="grade-alca" role="separator" aria-orientation="vertical" aria-label="Ajustar a largura da coluna"
        title="Arraste para ajustar a coluna (duplo clique volta ao padrão)" onPointerDown={e => arrastar(c, e)} onMouseDown={e => e.preventDefault()} onDoubleClick={() => voltar(c)} />
    ),
  };
}
