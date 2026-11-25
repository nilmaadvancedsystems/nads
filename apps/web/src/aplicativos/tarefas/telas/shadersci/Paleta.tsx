// A paleta do minimum: a escolha no centro da tela, com o fundo embaçado, a busca em cima e a lista com o código, o nome e uma dica;
// ↑ ↓ e Enter escolhem, Esc fecha. A mesma na escolha da empresa (o ⌘K, 25/11/2026: "uma coisa mais premium") e na conta do Razão
// do SCI (25/11/2026: "Melhora isso do codigo, coloca uma popup mais premium, embacando o fundo").
import { sci } from '@nads/core';
import { Icone } from '@nads/ui';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface ItemDaPaleta {
  chave: string;
  /** o código, em destaque à esquerda ('' = sem) */
  codigo: string;
  nome: string;
  /** o texto pequeno à direita (o regime da empresa, a classificação da conta…) */
  dica?: string;
}

/** sem o filtrar: o código que começa pelo texto e o nome que o contém, sem acento */
const filtroPadrao = (itens: readonly ItemDaPaleta[], q: string) => {
  const t = sci.semAcento(q.trim());
  return itens.filter(i => i.codigo.startsWith(t) || sci.semAcento(i.nome).includes(t));
};

export function Paleta({ itens, escolher, fechar, rotulo, placeholder, unidade, filtrar = filtroPadrao }: {
  itens: readonly ItemDaPaleta[];
  escolher: (chave: string) => void;
  fechar: () => void;
  /** o nome da janela, para o leitor de tela ("Escolher a empresa") */
  rotulo: string;
  placeholder: string;
  /** para o total no pé e o "nada achado": ['empresa', 'empresas'] */
  unidade: readonly [string, string];
  filtrar?: (itens: readonly ItemDaPaleta[], q: string) => readonly ItemDaPaleta[];
}) {
  const [q, setQ] = useState('');
  const [ativo, setAtivo] = useState(0);
  const achados = useMemo(() => (q.trim() ? filtrar(itens, q) : itens), [itens, q, filtrar]);
  const caixa = useRef<HTMLUListElement>(null);
  useEffect(() => { caixa.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [ativo]);
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => Math.min(achados.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const x = achados[ativo]; if (x) escolher(x.chave); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
  };
  const total = (n: number) => (n === 1 ? '1 ' + unidade[0] : n + ' ' + unidade[1]);
  // no corpo da página: as telas animam com transform, que prenderia o position:fixed dentro delas
  return createPortal(
    <div className="sci-paleta-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="sci-paleta" role="dialog" aria-modal="true" aria-label={rotulo}>
        <div className="sci-paleta-busca">
          <Icone nome="search" width={18} height={18} />
          <input type="text" autoFocus autoComplete="off" placeholder={placeholder} aria-label={placeholder} role="combobox"
            aria-expanded="true" aria-controls="sci-paleta-lista" aria-activedescendant={achados[ativo] ? 'sci-paleta-' + achados[ativo].chave : undefined}
            value={q} onChange={e => { setQ(e.target.value); setAtivo(0); }} onKeyDown={tecla} />
          <kbd className="sci-kbd">esc</kbd>
        </div>
        <ul ref={caixa} id="sci-paleta-lista" className="sci-paleta-lista" role="listbox" aria-label={rotulo}>
          {achados.map((x, i) => (
            <li key={x.chave} id={'sci-paleta-' + x.chave} role="option" aria-selected={i === ativo} className="sci-paleta-item"
              onMouseMove={() => { if (i !== ativo) setAtivo(i); }} onClick={() => escolher(x.chave)}>
              <span className="sci-paleta-codigo">{x.codigo}</span>
              <span className="sci-paleta-nome" title={x.nome}>{x.nome}</span>
              {x.dica && <span className="sci-paleta-regime">{x.dica}</span>}
              <Icone nome="chevronRight" width={16} height={16} className="sci-paleta-seta" />
            </li>
          ))}
          {!achados.length && <li className="sci-paleta-vazio">Nenhuma {unidade[0]} com “{q.trim()}”</li>}
        </ul>
        <div className="sci-paleta-pe">
          <span><kbd className="sci-kbd">↑</kbd><kbd className="sci-kbd">↓</kbd> navegar</span>
          <span><kbd className="sci-kbd">↵</kbd> escolher</span>
          <span className="sci-paleta-total">{total(achados.length)}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
