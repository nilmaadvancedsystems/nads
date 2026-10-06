// O menu do botão direito do Explorador (como o do Windows 11): a lista, com atalho à direita e ✓ nas opções marcadas
// (a fileira de ícones em cima saiu em 06/10/2026: repetia a lista). Abre onde o mouse está (sem sair da tela),
// fecha ao clicar fora, com Esc, ao rolar ou ao mudar o tamanho da janela; setas ↑ ↓ andam pelas opções.
import { Icone, type NomeIcone } from '@nads/ui';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface OpcaoDoMenu {
  rotulo: string;
  icone?: NomeIcone;
  atalho?: string;
  desabilitado?: boolean;
  /** true/false mostra a coluna do ✓ (Exibir, Classificar por) */
  marcado?: boolean;
  onClick: () => void;
}
export type LinhaDoMenu = OpcaoDoMenu | 'separador' | { titulo: string };

export interface MenuAberto { x: number; y: number; linhas: LinhaDoMenu[] }

export function MenuDeContexto({ menu, onFechar }: { menu: MenuAberto; onFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(4, Math.min(menu.x, window.innerWidth - r.width - 4)), y: Math.max(4, Math.min(menu.y, window.innerHeight - r.height - 4)) });
    el.querySelector<HTMLButtonElement>('.ctx-lista button:not(:disabled)')?.focus();
  }, [menu]);
  useEffect(() => {
    const fora = (ev: Event) => { if (ref.current && !ref.current.contains(ev.target as Node)) onFechar(); };
    const fechar = () => onFechar();
    document.addEventListener('mousedown', fora, true);
    document.addEventListener('contextmenu', fora, true);
    window.addEventListener('resize', fechar);
    window.addEventListener('blur', fechar);
    document.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('mousedown', fora, true);
      document.removeEventListener('contextmenu', fora, true);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('blur', fechar);
      document.removeEventListener('scroll', fechar, true);
    };
  }, [onFechar]);

  const escolher = (o: OpcaoDoMenu) => { if (o.desabilitado) return; onFechar(); o.onClick(); };
  const teclas = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); onFechar(); return; }
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    ev.preventDefault();
    const bts = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
    const i = bts.indexOf(document.activeElement as HTMLButtonElement);
    bts[(i + (ev.key === 'ArrowDown' ? 1 : -1) + bts.length) % bts.length]?.focus();
  };
  const comMarca = menu.linhas.some(l => typeof l === 'object' && 'rotulo' in l && l.marcado !== undefined);

  return (
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: pos.x, top: pos.y }} onKeyDown={teclas} onContextMenu={ev => ev.preventDefault()}>
      <div className="ctx-lista">
        {menu.linhas.map((l, i) => {
          if (l === 'separador') return <hr key={'s' + i} className="ctx-sep" />;
          if ('titulo' in l) return <div key={'t' + i} className="ctx-titulo">{l.titulo}</div>;
          return (
            <button key={l.rotulo + i} type="button" role={l.marcado !== undefined ? 'menuitemcheckbox' : 'menuitem'} aria-checked={l.marcado}
              disabled={l.desabilitado} onClick={() => escolher(l)}>
              {comMarca && <span className="ctx-marca">{l.marcado && <Icone nome="check" />}</span>}
              <span className="ctx-icone">{l.icone && <Icone nome={l.icone} />}</span>
              <span className="ctx-rotulo">{l.rotulo}</span>
              {l.atalho && <span className="ctx-atalho">{l.atalho}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
