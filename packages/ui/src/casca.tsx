// A casca de todos os aplicativos (nasceu na Conferência): cabeçalho (☰, logo, trilha "Sistema / Empresa", abas das páginas),
// barra lateral das seções (com "Ocultar barra lateral") — ou, com lateral="caixa", a caixa de seções ao lado da página —,
// gaveta ☰ com tema e a área da página (título + ações no canto direito). Marcação e classes iguais às do conferencia.html (~L973-1033).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icone, MarcaN, type NomeIcone } from './icones';
import { SeletorTema } from './tema';

/** caixa: no lugar do ícone, uma caixinha de checklist (vazia, marcada ou parada) — as etapas de uma tarefa */
export interface SecaoCasca { id: string; rotulo: string; icone: NomeIcone; grupo: number; ativa?: boolean; travada?: boolean; caixa?: 'vazia' | 'marcada' | 'parada' }
export interface PaginaCasca { id: string; rotulo: string; icone: NomeIcone; ativa?: boolean; travada?: boolean; oculta?: boolean }

/**
 * A tela está dentro de outra (um iframe, como quando a Tarefas abre uma ferramenta na etapa)? Aí
 * mostra só a página, sem cabeçalho nem barra lateral. Olha o próprio navegador, sem guardar nada:
 * assim não vaza para a tela de fora nem para uma visita normal depois.
 */
function embutida(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // outro endereço por fora: o navegador não deixa olhar, então está dentro de um iframe
  }
}

/**
 * Acoplada a outro sistema (o Entregas abre o Extratudo com ?acoplado=entregas, 2026-09-29): a barra de
 * cima (☰, logo, sistema) é a do sistema de fora, então aqui some só ela; ficam a empresa, as abas das
 * páginas e a barra lateral das ferramentas, como as outras telas do Entregas. Fica guardado na aba,
 * porque as rotas trocam o endereço e o ?acoplado some.
 */
function acoplada(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('acoplado')) sessionStorage.setItem('nads-acoplado', '1');
    return embutida() && sessionStorage.getItem('nads-acoplado') === '1';
  } catch {
    return false;
  }
}

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
  /** uma linha embaixo do título (cinza) */
  descricao?: string;
  acoes?: ReactNode;
  /** mais pedaços da trilha depois da empresa ("Sistema / Empresa / …") */
  trilha?: { rotulo: string; titulo?: string; onClick?: () => void }[];
  onSecao: (id: string) => void;
  onPagina: (id: string) => void;
  onInicio: () => void;
  /** Início do nads (tela de aplicativos), na gaveta ☰. Sem ele, a gaveta usa onInicio. */
  onAplicativos?: () => void;
  onEmpresa: () => void;
  /** os aplicativos do nads, na gaveta ☰ (o atual marcado) */
  aplicativos?: { id: string; nome: string; icone: NomeIcone; ativo?: boolean }[];
  onAplicativo?: (id: string) => void;
  /**
   * Como as seções aparecem à esquerda: "barra" (padrão; a barra lateral que oculta) ou "caixa"
   * (lista com borda ao lado da página, no estilo "Insights" do GitHub; guardada para um uso futuro).
   */
  lateral?: 'barra' | 'caixa';
  /** a página usa a largura toda da tela (ex.: a ferramenta de uma etapa) */
  larga?: boolean;
  /** nome da lista da esquerda, para leitor de tela (padrão "Seções") */
  rotuloLateral?: string;
  children: ReactNode;
}) {
  const [oculta, setOculta] = useState(lerLateral);
  const [gaveta, setGaveta] = useState(false);
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

  const alternarLateral = () => {
    setOculta(o => {
      try { localStorage.setItem(CHAVE_LATERAL, o ? '0' : '1'); } catch { /* sem storage: vale só agora */ }
      return !o;
    });
  };

  const principal = (
    <main className="main">
      {/* sem título nem descrição, some — e, dentro de uma etapa, mesmo com o lugar das ações */}
      <header className="topbar" hidden={!p.titulo && !p.descricao && (!p.acoes || embutida())}>
        <div>
          <h2 className="page-title">{p.titulo}</h2>
          {p.descricao && <p className="page-desc">{p.descricao}</p>}
        </div>
        <div id="topbarActions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{p.acoes}</div>
      </header>
      <div className="content">{p.children}</div>
    </main>
  );

  // aberta dentro de outra tela (a etapa de uma tarefa): só a página, sem cabeçalho nem barra lateral
  const noOutro = acoplada();
  if (embutida() && !noOutro) return <div id="app" className="on embutida">{principal}</div>;

  let grupoAnt: number | null = null;
  return (
    <div id="app" className={'on' + (p.larga ? ' larga' : '') + (noOutro ? ' acoplada' : '')}>
      <header className="gh-header" ref={cabecalho}>
        <div className="gh-header-top">
          {!noOutro && (
            <>
              <button className="gh-hamb" type="button" aria-label="Abrir menu" title="Menu" onClick={() => setGaveta(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
            </>
          )}
          <nav className="gh-crumbs" aria-label="Local">
            {!noOutro && (
              <>
                <button className="gh-crumb" type="button" title="Voltar para a tela inicial" onClick={p.onInicio}>{p.sistema}</button>
                <span className="gh-sep">/</span>
              </>
            )}
            <button className="brand-tag" id="brandTagEmpresa" type="button" title={p.empresa.nome} onClick={p.onEmpresa}>{p.empresa.codigo}</button>
            {p.trilha?.map(t => (
              <span key={t.rotulo} style={{ display: 'contents' }}>
                <span className="gh-sep">/</span>
                {t.onClick ? <button className="gh-crumb" type="button" title={t.titulo} onClick={t.onClick}>{t.rotulo}</button>
                  : <span className="gh-crumb gh-crumb-fim" title={t.titulo}>{t.rotulo}</span>}
              </span>
            ))}
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
          <button className="drawer-item" type="button" onClick={() => { setGaveta(false); (p.onAplicativos || p.onInicio)(); }}><Icone nome="home" />Início</button>
          {p.aplicativos && p.aplicativos.length > 0 && (
            <>
              <hr className="drawer-sep" />
              <p className="drawer-label">Aplicativos</p>
              {p.aplicativos.map(a => (
                <button key={a.id} className={'drawer-item' + (a.ativo ? ' active' : '')} type="button" aria-current={a.ativo ? 'page' : undefined}
                  onClick={() => { setGaveta(false); p.onAplicativo?.(a.id); }}>
                  <Icone nome={a.icone} />{a.nome}
                </button>
              ))}
            </>
          )}
          <div className="drawer-foot">
            <SeletorTema />
            <p>Versão do sistema: {p.versao}</p>
          </div>
        </aside>
      )}

      {p.lateral === 'caixa' ? (
        <div className="layout-caixa">
          <nav className="caixa-menu" aria-label={p.rotuloLateral || 'Seções'}>
            {p.secoes.map(s => (
              <button key={s.id} type="button" className={'caixa-item' + (s.ativa ? ' active' : '') + (s.travada ? ' is-locked' : '')}
                aria-current={s.ativa ? 'page' : undefined} aria-disabled={s.travada ? 'true' : undefined} onClick={() => p.onSecao(s.id)}>
                {s.rotulo}
              </button>
            ))}
          </nav>
          {principal}
        </div>
      ) : (
      <div className={'layout' + (oculta ? ' sidebar-oculta' : '')}>
        <nav className="subnav" id="subnav" aria-label={p.rotuloLateral || 'Seções'}>
          <div className="subnav-itens">
            {p.secoes.map(s => {
              const sep = grupoAnt !== null && s.grupo !== grupoAnt;
              grupoAnt = s.grupo;
              return (
                <span key={s.id} style={{ display: 'contents' }}>
                  {sep && <hr className="subnav-sep" />}
                  <button type="button" className={'subnav-item' + (s.ativa ? ' active' : '') + (s.travada ? ' is-locked' : '')}
                    aria-current={s.ativa ? 'page' : undefined} aria-disabled={s.travada ? 'true' : undefined} title={s.rotulo} onClick={() => p.onSecao(s.id)}>
                    {s.caixa ? <span className={'subnav-caixa ' + s.caixa} aria-hidden="true">{s.caixa === 'marcada' && <Icone nome="check" />}</span> : <Icone nome={s.icone} />}
                    <span>{s.rotulo}</span>
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
        {principal}
      </div>
      )}
    </div>
  );
}

/** Baixa um arquivo binário gerado no navegador (planilha .xlsx/.xls). */
export function baixarBytes(bytes: Uint8Array, nome: string, tipo: string) {
  const b = new Blob([bytes as BlobPart], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Baixa um arquivo de texto gerado no navegador (CSV etc.). */
export function baixarArquivo(texto: string, nome: string, tipo = 'text/csv') {
  const b = new Blob([texto], { type: tipo + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
