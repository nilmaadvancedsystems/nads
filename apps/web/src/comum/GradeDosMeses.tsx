// A grade dos meses (Importação, Caixa, INSS, Clientes), Vitor, 07/10/2026: de padrão cabe tudo na tela (até os 12
// meses), com a primeira coluna num tamanho que encolhe um pouco quando há mais meses; a pessoa pode arrastar a borda
// da primeira coluna (duplo clique volta ao padrão) e, se ela crescer além do que cabe, a grade rola para o lado.
// O tamanho escolhido fica neste navegador (preferência de quem usa). O valor no mês estreito perde o "R$" (CSS).
import { useCallback, useState, type CSSProperties, type PointerEvent as EventoDoPonteiro } from 'react';

const CHAVE = 'nads-grade-coluna-';
/** O mínimo de cada mês quando a primeira coluna foi aumentada (abaixo disso, a grade rola). */
const MES_MINIMO = 72;

function ler(id: string): number | null {
  try { const v = Number(localStorage.getItem(CHAVE + id)); return v > 0 ? v : null; } catch { return null; }
}
function gravar(id: string, px: number | null) {
  try { if (px) localStorage.setItem(CHAVE + id, String(Math.round(px))); else localStorage.removeItem(CHAVE + id); } catch { /* só nesta tela */ }
}

/**
 * A primeira coluna ajustável. id: o nome da grade (o tamanho fica por grade); padrao: a largura de padrão (CSS).
 * Devolve o estilo da tabela, a largura da coluna (para o <col>) e a alça (vai dentro do primeiro <th> do cabeçalho).
 */
export function useColunaAjustavel(id: string, padrao: string, meses: number) {
  const [px, setPx] = useState<number | null>(() => ler(id));
  const arrastar = useCallback((e: EventoDoPonteiro<HTMLSpanElement>) => {
    const th = e.currentTarget.parentElement;
    if (!th) return;
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = th.getBoundingClientRect().width;
    let ultimo = w0;
    const mover = (ev: PointerEvent) => { ultimo = Math.max(60, Math.min(1200, w0 + ev.clientX - x0)); setPx(ultimo); };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      gravar(id, ultimo);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }, [id]);
  const voltar = useCallback(() => { setPx(null); gravar(id, null); }, [id]);
  const tabela: CSSProperties = px ? { minWidth: 'calc(' + px + 'px + ' + meses + ' * ' + MES_MINIMO + 'px)' } : {};
  return {
    tabela,
    largura: px ? px + 'px' : padrao,
    alca: (
      <span className="grade-alca" role="separator" aria-orientation="vertical" aria-label="Ajustar a largura da primeira coluna"
        title="Arraste para ajustar a coluna (duplo clique volta ao padrão)" onPointerDown={arrastar} onDoubleClick={voltar} />
    ),
  };
}

/** O valor no mês ("−R$ 1.450,00"): o "R$" some quando o mês fica estreito e, mais estreito, a letra diminui um pouco. */
export function ValorNaGrade({ texto }: { texto: string }) {
  const m = /^(−|-)?R\$\s?(.*)$/.exec(texto);
  if (!m) return <span className="grade-valor"><span className="grade-num">{texto}</span></span>;
  return <span className="grade-valor"><span className="grade-num">{m[1] || ''}<span className="grade-moeda">R$&nbsp;</span>{m[2]}</span></span>;
}
