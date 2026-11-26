// Escolher a empresa (26/11/2026, a Área do Cliente refeita), com a peça "Busca de cliente com lista" do catálogo do nads
// (registro-busca + nf-achados, a da Nova nota): digitou o código ou parte do nome, a lista logo abaixo; ↑↓ e Enter
// escolhem. Escolhida, mostra "código · nome" com o ✕ para trocar. No tamanho compacto (fxr-empresa-busca, o das
// ferramentas do Fiscal), da altura dos outros campos.
import { Icone } from '@nads/ui';
import { useState } from 'react';
import { bate } from './comum';

export interface EmpresaEscolhivel { codigo: number; nome: string }

export function BuscaDeEmpresa<T extends EmpresaEscolhivel>({ empresas, escolhida, onEscolher, autoFocus, excluir }: {
  empresas: readonly T[]; escolhida: T | null; onEscolher: (e: T | null) => void; autoFocus?: boolean;
  /** as que já foram escolhidas (o seletor de várias) */
  excluir?: ReadonlySet<number>;
}) {
  const [busca, setBusca] = useState('');
  const [ativa, setAtiva] = useState(0);
  if (escolhida) {
    return (
      <div className="fxr-empresa-busca"><div className="registro-busca nf-escolhido">
        <Icone nome="predio" width={16} height={16} />
        <span style={{ flex: 1, minWidth: 0 }}><b className="num">{escolhida.codigo}</b> · {escolhida.nome}</span>
        <button type="button" className="janela-x" aria-label="Trocar a empresa" title="Trocar" onClick={() => { onEscolher(null); setBusca(''); }}><Icone nome="x" width={16} height={16} /></button>
      </div></div>
    );
  }
  const achadas = busca.trim() ? empresas.filter(e => !excluir?.has(e.codigo) && bate(busca, e.codigo, e.nome)).slice(0, 8) : [];
  const escolher = (e: T | undefined) => { if (e) { onEscolher(e); setBusca(''); setAtiva(0); } };
  return (
    <div className="fxr-empresa-busca">
      <div className="registro-busca">
        <Icone nome="search" width={16} height={16} />
        <input type="text" placeholder="Código ou nome da empresa" aria-label="Buscar a empresa" value={busca} autoFocus={autoFocus}
          onChange={e => { setBusca(e.target.value); setAtiva(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAtiva(a => Math.min(a + 1, achadas.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAtiva(a => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); escolher(achadas[ativa]); }
          }} />
      </div>
      {achadas.length > 0 && (
        <ul className="nf-achados" style={{ marginTop: 6 }}>
          {achadas.map((e, i) => (
            <li key={e.codigo}>
              <button type="button" className={'popover-item' + (i === ativa ? ' nf-ativo' : '')} onClick={() => escolher(e)}>
                <span className="nf-achado-codigo">{e.codigo}</span><span className="popover-texto">{e.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {busca.trim() && !achadas.length && <p className="hint" style={{ marginTop: 6 }}>Nenhuma empresa com “{busca.trim()}”.</p>}
    </div>
  );
}
