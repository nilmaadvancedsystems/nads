// A casca da Conferência: cabeçalho (☰, logo, trilha "Sistema / Empresa ▾", abas das páginas),
// barra lateral das seções (com "Ocultar barra lateral"), gaveta ☰ com tema e a área da página
// (título + ações no canto direito). Marcação e classes iguais às do conferencia.html (~L973-1033).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icone, MarcaN, type NomeIcone } from './icones';
import { SeletorTema } from './tema';

export interface SecaoCasca { id: string; rotulo: string; icone: NomeIcone; grupo: number; ativa?: boolean; travada?: boolean }
export interface PaginaCasca { id: string; rotulo: string; icone: NomeIcone; ativa?: boolean; travada?: boolean; oculta?: boolean }

const CHAVE_LATERAL = 'nads-barra-lateral-oculta';

function lerLateral(): boolean {
  try { return localStorage.getItem(CHAVE_LATERAL) === '1'; } catch { return false; }
}

export function Casca(p: {
  sistema: string;
  empresa: { codigo: string; nome: string };
  versao: string;
  secoes: SecaoCasca[];
  paginas: PaginaCasca[];
  titulo: string;
  acoes?: ReactNode;
  onSecao: (id: string) => void;
  onPagina: (id: string) => void;
  onInicio: () => void;
  onEmpresa: () => void;
  onSair: () => void;
  children: ReactNode;
}) {
  const [oculta, setOculta] = useState(lerLateral);
  const [gaveta, setGaveta] = useState(false);
  const [pop, setPop] = useState(false);
  const cabecalho = useRef<HTMLElement>(null);

  // o menu lateral gruda logo abaixo do cabeçalho — a altura muda no celular
  useLayoutEffect(() => {
    const ajustar = () => { if (cabecalho.current) document.documentElement.style.setProperty('--hdr-h', cabecalho.current.offsetHeight + 'px'); };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);
  useEffect(() => {
    if (!gaveta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setGaveta(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [gaveta]);
  useEffect(() => {
    if (!pop) return;
    const fora = (e: MouseEvent) => { if (!(e.target as Element).closest('.popover-wrap')) setPop(false); };
    document.addEventListener('click', fora);
    return () => document.removeEventListener('click', fora);
  }, [pop]);

  const alternarLateral = () => {
    setOculta(o => {
      try { localStorage.setItem(CHAVE_LATERAL, o ? '0' : '1'); } catch { /* sem storage: vale só agora */ }
      return !o;
    });
  };

  let grupoAnt: number | null = null;
  return (
    <div id="app" className="on">
      <header className="gh-header" ref={cabecalho}>
        <div className="gh-header-top">
          <button className="gh-hamb" type="button" aria-label="Abrir menu" title="Menu" onClick={() => setGaveta(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
          <nav className="gh-crumbs" aria-label="Local">
            <button className="gh-crumb" type="button" title="Voltar para a tela inicial" onClick={p.onInicio}>{p.sistema}</button>
            <span className="gh-sep">/</span>
            <button className="brand-tag" id="brandTagEmpresa" type="button" title={p.empresa.nome} onClick={p.onEmpresa}>{p.empresa.codigo}</button>
            <div className="popover-wrap" id="gearMenu">
              <button className="gh-caret" type="button" aria-label="Opções da empresa" title="Opções da empresa" onClick={e => { e.stopPropagation(); setPop(v => !v); }}>
                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 6.5 8 10l3.5-3.5z" /></svg>
              </button>
              {pop && (
                <div className="popover" id="gearPop">
                  <p className="popover-label" />
                  <button className="popover-item perigo" type="button" onClick={() => { setPop(false); p.onSair(); }}><Icone nome="logOut" /><span>Sair</span></button>
                  <p className="hint" style={{ textAlign: 'center', fontSize: 12 }}>Versão: {p.versao}</p>
                </div>
              )}
            </div>
          </nav>
        </div>
        <nav className="menu" id="menu" aria-label="Páginas da seção">
          {p.paginas.filter(x => !x.oculta).map(x => (
            <button key={x.id} type="button" className={'menu-item' + (x.ativa ? ' active' : '') + (x.travada ? ' is-locked' : '')}
              aria-current={x.ativa ? 'page' : undefined} aria-disabled={x.travada ? 'true' : undefined} onClick={() => p.onPagina(x.id)}>
              <Icone nome={x.icone} /><span>{x.rotulo}</span>
            </button>
          ))}
        </nav>
      </header>

      {gaveta && <div className="drawer-overlay" onClick={() => setGaveta(false)} />}
      {gaveta && (
        <aside className="drawer" aria-label="Menu">
          <div className="drawer-head">
            <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
            <button className="drawer-x" type="button" aria-label="Fechar menu" onClick={() => setGaveta(false)}><Icone nome="x" /></button>
          </div>
          <button className="drawer-item" type="button" onClick={() => { setGaveta(false); p.onInicio(); }}><Icone nome="home" />Início</button>
          <div className="drawer-foot">
            <SeletorTema />
            <p>Versão: {p.versao}</p>
          </div>
        </aside>
      )}

      <div className={'layout' + (oculta ? ' sidebar-oculta' : '')}>
        <nav className="subnav" id="subnav" aria-label="Seções">
          <div className="subnav-itens">
            {p.secoes.map(s => {
              const sep = grupoAnt !== null && s.grupo !== grupoAnt;
              grupoAnt = s.grupo;
              return (
                <span key={s.id} style={{ display: 'contents' }}>
                  {sep && <hr className="subnav-sep" />}
                  <button type="button" className={'subnav-item' + (s.ativa ? ' active' : '') + (s.travada ? ' is-locked' : '')}
                    aria-current={s.ativa ? 'page' : undefined} aria-disabled={s.travada ? 'true' : undefined} title={s.rotulo} onClick={() => p.onSecao(s.id)}>
                    <Icone nome={s.icone} /><span>{s.rotulo}</span>
                  </button>
                </span>
              );
            })}
          </div>
          <div className="subnav-foot">
            <button type="button" className="subnav-item subnav-colapsar" aria-expanded={!oculta} title={oculta ? 'Mostrar barra lateral' : 'Ocultar barra lateral'} onClick={alternarLateral}>
              <Icone nome="painel" /><span>{oculta ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}</span>
            </button>
          </div>
        </nav>
        <main className="main">
          <header className="topbar">
            <div>
              <h2 className="page-title">{p.titulo}</h2>
            </div>
            <div id="topbarActions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{p.acoes}</div>
          </header>
          <div className="content">{p.children}</div>
        </main>
      </div>
    </div>
  );
}

/** Baixa um arquivo gerado no navegador (CSV etc.). */
export function baixarArquivo(texto: string, nome: string, tipo = 'text/csv') {
  const b = new Blob([texto], { type: tipo + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
