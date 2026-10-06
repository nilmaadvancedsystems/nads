// A casca de todos os aplicativos (nasceu na Conferência): cabeçalho (☰, logo, trilha "Sistema / Empresa", abas das páginas),
// barra lateral das seções (com "Ocultar barra lateral") — ou, com lateral="caixa", a caixa de seções ao lado da página —,
// gaveta ☰ com tema e a área da página (título + ações no canto direito). Marcação e classes iguais às do conferencia.html (~L973-1033).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cleanInlineStyles } from 'animejs';
import { animar, ENTRAR, entrar, revelarTitulo, sairComo, useIndicador } from './animacao';
import { useAbasParaAEtapa, useAlturaNaEtapa } from './etapa';
import { Icone, MarcaN, type NomeIcone } from './icones';
import { SeletorTema } from './tema';
import { atualizarVersao, useVersaoNova } from './versaoNova';

/** caixa: no lugar do ícone, uma caixinha de checklist (vazia, marcada ou parada) — as etapas de uma tarefa */
/** titulo: o nome do grupo, em cima da primeira seção dele (Ativo, Passivo…) */
/** foraDaEtapa: a seção some quando o aplicativo está inteiro dentro de uma etapa (ex.: a Importação da Conferência, que foi para a primeira etapa) */
export interface SecaoCasca { id: string; rotulo: string; icone: NomeIcone; grupo: number; ativa?: boolean; travada?: boolean; caixa?: 'vazia' | 'marcada' | 'parada'; titulo?: string; foraDaEtapa?: boolean; apagada?: boolean }
/** contador: o número ao lado do nome, como o "Issues 12" do GitHub (ex.: "2/7") */
export interface PaginaCasca { id: string; rotulo: string; icone: NomeIcone; ativa?: boolean; travada?: boolean; oculta?: boolean; contador?: string }

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
// lido quando o app carrega: o primeiro redirecionamento das rotas já tira o ?acoplado do endereço
const ACOPLADO_NA_ENTRADA = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('acoplado');

function acoplada(): boolean {
  if (!embutida()) return false;
  if (ACOPLADO_NA_ENTRADA) return true;
  try {
    return sessionStorage.getItem('nads-acoplado') === '1';
  } catch {
    return false;
  }
}
try { if (ACOPLADO_NA_ENTRADA) sessionStorage.setItem('nads-acoplado', '1'); } catch { /* sem storage: vale o endereço */ }

const CHAVE_LATERAL = 'nads-barra-lateral-oculta';

function lerLateral(): boolean {
  try { return localStorage.getItem(CHAVE_LATERAL) === '1'; } catch { return false; }
}

export function Casca(p: {
  sistema: string;
  /** a empresa aberta na trilha (null: nenhuma — a Tarefas fora de uma empresa) */
  empresa: { codigo: string; nome: string } | null;
  versao: string;
  secoes: SecaoCasca[];
  paginas: PaginaCasca[];
  titulo: string;
  /** uma linha embaixo do título (cinza) */
  descricao?: string;
  acoes?: ReactNode;
  /** o seletor de tema no pé da gaveta ☰ (false: o app tem a página do usuário e o tema fica lá — a Tarefas) */
  temaNaGaveta?: boolean;
  /** mais pedaços da trilha depois da empresa ("Sistema / Empresa / …") */
  trilha?: { rotulo: string; titulo?: string; onClick?: () => void }[];
  onSecao: (id: string) => void;
  onPagina: (id: string) => void;
  onInicio: () => void;
  /** Início do nads (tela de aplicativos), na gaveta ☰. Sem ele, a gaveta usa onInicio. */
  onAplicativos?: () => void;
  onEmpresa: () => void;
  /** os aplicativos do nads, na gaveta ☰ (o atual marcado) */
  aplicativos?: { id: string; nome: string; icone: NomeIcone; ativo?: boolean; contador?: string }[];
  onAplicativo?: (id: string) => void;
  /**
   * Como as seções aparecem à esquerda: "barra" (padrão; a barra lateral que oculta) ou "caixa"
   * (lista com borda ao lado da página, no estilo "Insights" do GitHub) ou "nenhuma" (a página na tela toda).
   */
  lateral?: 'barra' | 'caixa' | 'nenhuma';
  /** a página usa a largura toda da tela (ex.: a ferramenta de uma etapa) */
  larga?: boolean;
  /** o canto direito do cabeçalho, como os botões do GitHub (ex.: os grupos da rotina e o perfil, no executor) */
  topoDireita?: ReactNode;
  /** nome da lista da esquerda, para leitor de tela (padrão "Seções") */
  rotuloLateral?: string;
  /**
   * Dentro de uma etapa da Tarefas, a página vem sem cabeçalho nem barra lateral. Com isto, o aplicativo vem
   * inteiro, exatamente como ele é (barra lateral, abas das páginas, a empresa), só sem a barra de cima (☰, logo,
   * sistema), que é a da Tarefas — como quando está acoplado a outro sistema. Ex.: a Conferência na Conferência fiscal.
   */
  inteiroNaEtapa?: boolean;
  /**
   * Com inteiroNaEtapa: no lugar da barra lateral e das abas da seção, todas as páginas numa linha de abas só (como
   * as de um repositório do GitHub), e a página na largura toda.
   */
  abasNaEtapa?: PaginaCasca[];
  onAbaNaEtapa?: (id: string) => void;
  children: ReactNode;
}) {
  const [oculta, setOculta] = useState(lerLateral);
  // a Minha página › Aparência e telas recolhe (ou abre) a barra lateral: vale já nesta tela
  useEffect(() => {
    const mudou = () => setOculta(lerLateral());
    window.addEventListener('nads-lateral', mudou);
    return () => window.removeEventListener('nads-lateral', mudou);
  }, []);
  const [gaveta, setGaveta] = useState(false);
  // a gaveta sai por onde entrou (animejs, 01/10/2026): desliza para a esquerda e o fundo apaga; só então desmonta.
  // Pelo Esc (teclado) fecha na hora: atalho de teclado não anima.
  const gavetaEl = useRef<HTMLElement>(null);
  const fundoEl = useRef<HTMLDivElement>(null);
  const fecharGaveta = () => {
    if (!gavetaEl.current) { setGaveta(false); return; }
    if (fundoEl.current) void sairComo('fundo', fundoEl.current);
    void sairComo('gaveta', gavetaEl.current).then(() => setGaveta(false));
  };
  // a página que abriu entra do jeito do app; andando pela lateral (as etapas, as seções), ela vem do lado para onde
  // se andou: a seguinte chega da direita, a anterior da esquerda
  const conteudo = useRef<HTMLDivElement>(null);
  const secaoAtiva = p.secoes.findIndex(s => s.ativa);
  const secaoAntes = useRef(secaoAtiva);
  useLayoutEffect(() => {
    const el = conteudo.current;
    const antes = secaoAntes.current;
    secaoAntes.current = secaoAtiva;
    if (!el) return;
    const lado = antes >= 0 && secaoAtiva >= 0 && antes !== secaoAtiva ? Math.sign(secaoAtiva - antes) : 0;
    // com uma ferramenta dentro (o iframe da etapa no executor), a página não desliza: arrastar um iframe inteiro pesa
    // e a ferramenta já anima a própria página. Trocou de etapa: só acende; trocou só de aba da ferramenta: nada.
    if (el.querySelector('iframe')) {
      if (!lado) return;
      const a = animar(el, { opacity: [0, 1], duration: 420, ease: ENTRAR, onComplete: x => { cleanInlineStyles(x); } });
      return () => { a.revert(); };
    }
    const a = entrar('pagina', el, lado ? { mais: { translateX: [lado * 32, 0], translateY: [0, 0] } } : {});
    return () => { a?.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.titulo, p.paginas?.find(x => x.ativa)?.id, p.secoes.find(s => s.ativa)?.id]);
  // os indicadores do ativo deslizam de um item ao outro (o sublinhado das abas e o fundo + barrinha da lateral)
  const abasInd = useIndicador<HTMLElement>('.menu-item.active', [p.paginas?.find(x => x.ativa)?.id, p.paginas?.length], 'sublinhado');
  const lateralInd = useIndicador<HTMLDivElement>('.subnav-item.active', [p.secoes.find(s => s.ativa)?.id, p.secoes.length, oculta], 'fundo');
  // o título da página se revela palavra por palavra (o h2 tem key={titulo}: o React cria um novo a cada título)
  const titulo = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = titulo.current;
    return el ? revelarTitulo(el) ?? undefined : undefined;
  }, [p.titulo]);
  // saiu versão nova do nads: um pontinho no ☰ e "Atualizar para …" ao lado da versão, no menu
  const versaoNova = useVersaoNova(p.versao || '');
  const cabecalho = useRef<HTMLElement>(null);
  // dentro de uma etapa da Tarefas: a página diz a altura dela (quem rola é a Tarefas, uma barra só)
  useAlturaNaEtapa(embutida() && !acoplada());
  // um aplicativo inteiro dentro da etapa, com as abas de todas as páginas: elas sobem para o cabeçalho da Tarefas
  const abasSobem = embutida() && !acoplada() && !!p.inteiroNaEtapa && !!p.abasNaEtapa;
  useAbasParaAEtapa(abasSobem ? p.abasNaEtapa || null : null, p.onAbaNaEtapa);

  // a altura do cabeçalho (muda no celular): a barra lateral vai dele até o fim da tela
  useLayoutEffect(() => {
    const ajustar = () => { if (cabecalho.current) document.documentElement.style.setProperty('--hdr-h', cabecalho.current.offsetHeight + 'px'); };
    ajustar();
    // muda também quando chegam as abas de uma ferramenta (a Conferência dentro da etapa)
    const obs = typeof ResizeObserver !== 'undefined' && cabecalho.current ? new ResizeObserver(ajustar) : null;
    if (obs && cabecalho.current) obs.observe(cabecalho.current);
    window.addEventListener('resize', ajustar);
    return () => { obs?.disconnect(); window.removeEventListener('resize', ajustar); };
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
          <h2 ref={titulo} key={p.titulo} className="page-title">{p.titulo}</h2>
          {p.descricao && <p className="page-desc">{p.descricao}</p>}
        </div>
        <div id="topbarActions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{p.acoes}</div>
      </header>
      <div ref={conteudo} className="content">{p.children}</div>
    </main>
  );

  // aberta dentro de outra tela (a etapa de uma tarefa): só a página, sem cabeçalho nem barra lateral
  // acoplado a outro sistema, ou um aplicativo inteiro dentro da etapa: tudo menos a barra de cima
  const noOutro = acoplada() || (embutida() && !!p.inteiroNaEtapa);
  // o aplicativo inteiro dentro da etapa: sem nem a linha da empresa (a empresa já está no cabeçalho da Tarefas)
  const naEtapa = embutida() && !!p.inteiroNaEtapa && !acoplada();
  // dentro da etapa, com as abas de todas as páginas: sem barra lateral
  const abasDaEtapa = naEtapa && p.abasNaEtapa ? p.abasNaEtapa : null;
  if (embutida() && !noOutro) return <div id="app" className="on embutida">{principal}</div>;

  let grupoAnt: number | null = null;
  return (
    <div id="app" className={'on' + (p.larga ? ' larga' : '') + (noOutro ? ' acoplada' : '')}>
      <header className="gh-header" ref={cabecalho} hidden={abasSobem}>
        <div className="gh-header-top" hidden={naEtapa}>
          {!noOutro && (
            <>
              <button className="gh-hamb" type="button" aria-label={'Abrir menu' + (versaoNova ? ' (versão nova)' : '')} title={versaoNova ? 'Menu · saiu a versão ' + versaoNova : 'Menu'} onClick={() => setGaveta(true)}>
                {versaoNova && <span className="gh-hamb-ponto" aria-hidden="true" />}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
            </>
          )}
          <nav className="gh-crumbs" aria-label="Local">
            {!noOutro && (
              <>
                <button className="gh-crumb" type="button" title="Voltar para a tela inicial" onClick={p.onInicio}>{p.sistema}</button>
                {p.empresa && <span className="gh-sep">/</span>}
              </>
            )}
            {p.empresa && <button className="brand-tag" id="brandTagEmpresa" type="button" title={p.empresa.nome} onClick={p.onEmpresa}>{p.empresa.codigo}</button>}
            {p.trilha?.map((t, i) => (
              <span key={t.rotulo} style={{ display: 'contents' }}>
                {(i > 0 || p.empresa || !noOutro) && <span className="gh-sep">/</span>}
                {t.onClick ? <button className="gh-crumb" type="button" title={t.titulo} onClick={t.onClick}>{t.rotulo}</button>
                  : <span className="gh-crumb gh-crumb-fim" title={t.titulo}>{t.rotulo}</span>}
              </span>
            ))}
          </nav>
          {p.topoDireita && <><span className="gh-header-spacer" /><div className="gh-topo-direita">{p.topoDireita}</div></>}
        </div>
        <nav ref={abasInd} className="menu com-indicador" id="menu" aria-label="Páginas da seção" hidden={!(abasDaEtapa || p.paginas).some(x => !x.oculta)}>
          {(abasDaEtapa || p.paginas).filter(x => !x.oculta).map(x => (
            <button key={x.id} type="button" className={'menu-item' + (x.ativa ? ' active' : '') + (x.travada ? ' is-locked' : '')}
              aria-current={x.ativa ? 'page' : undefined} aria-disabled={x.travada ? 'true' : undefined} onClick={() => (abasDaEtapa && p.onAbaNaEtapa ? p.onAbaNaEtapa : p.onPagina)(x.id)}>
              <Icone nome={x.icone} /><span>{x.rotulo}</span>{x.contador && <span className="menu-contador">{x.contador}</span>}
            </button>
          ))}
        </nav>
      </header>

      {gaveta && <div ref={fundoEl} className="drawer-overlay" onClick={fecharGaveta} />}
      {gaveta && (
        <aside ref={gavetaEl} className="drawer" aria-label="Menu">
          <div className="drawer-head">
            <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
            <button className="drawer-x" type="button" aria-label="Fechar menu" onClick={fecharGaveta}><Icone nome="x" /></button>
          </div>
          <button className="drawer-item" type="button" onClick={() => { fecharGaveta(); (p.onAplicativos || p.onInicio)(); }}><Icone nome="home" />Início</button>
          {p.aplicativos && p.aplicativos.length > 0 && (
            <>
              <hr className="drawer-sep" />
              {p.aplicativos.map(a => (
                <button key={a.id} className={'drawer-item' + (a.ativo ? ' active' : '')} type="button" aria-current={a.ativo ? 'page' : undefined}
                  onClick={() => { fecharGaveta(); p.onAplicativo?.(a.id); }}>
                  <Icone nome={a.icone} />{a.nome}{a.contador && <span className="menu-contador drawer-contador">{a.contador}</span>}
                </button>
              ))}
            </>
          )}
          <div className="drawer-foot">
            {p.temaNaGaveta !== false && <SeletorTema />}
            <p>Versão do sistema: {p.versao}{versaoNova && <> · <button type="button" className="drawer-atualizar" onClick={atualizarVersao}>Atualizar para {versaoNova}</button></>}</p>
          </div>
        </aside>
      )}

      {p.lateral === 'nenhuma' || abasDaEtapa ? principal : p.lateral === 'caixa' ? (
        <div className="layout-caixa">
          <nav className="caixa-menu" aria-label={p.rotuloLateral || 'Seções'}>
            {p.secoes.map(s => (
              <button key={s.id} type="button" className={'caixa-item' + (s.ativa ? ' active' : '') + (s.travada ? ' is-locked' : '')}
                aria-current={s.ativa ? 'page' : undefined} aria-disabled={s.travada ? 'true' : undefined} onClick={() => p.onSecao(s.id)}>
                {s.caixa && <span className={'subnav-caixa ' + s.caixa} aria-hidden="true">{s.caixa === 'marcada' && <Icone nome="check" />}</span>}
                {s.rotulo}
              </button>
            ))}
          </nav>
          {principal}
        </div>
      ) : (
      <div className={'layout' + (oculta ? ' sidebar-oculta' : '')}>
        <nav className="subnav" id="subnav" aria-label={p.rotuloLateral || 'Seções'}>
          <div ref={lateralInd} className="subnav-itens com-indicador">
            {p.secoes.filter(s => !(naEtapa && s.foraDaEtapa)).map(s => {
              const sep = grupoAnt !== null && s.grupo !== grupoAnt;
              const comeca = grupoAnt === null || s.grupo !== grupoAnt;
              grupoAnt = s.grupo;
              return (
                <span key={s.id} style={{ display: 'contents' }}>
                  {sep && !s.titulo && <hr className="subnav-sep" />}
                  {comeca && s.titulo && <p className={'subnav-titulo' + (sep ? ' depois' : '')}>{s.titulo}</p>}
                  <button type="button" className={'subnav-item' + (s.ativa ? ' active' : '') + (s.travada ? ' is-locked' : '') + (s.apagada ? ' apagada' : '')}
                    aria-current={s.ativa ? 'page' : undefined} aria-disabled={s.travada ? 'true' : undefined} title={s.rotulo} onClick={() => p.onSecao(s.id)}>
                    {s.caixa ? <span className={'subnav-caixa ' + s.caixa} aria-hidden="true">{s.caixa === 'marcada' && <Icone nome="check" />}</span> : <Icone nome={s.icone} />}
                    <span>{s.rotulo}</span>
                  </button>
                </span>
              );
            })}
          </div>
          <div className="subnav-foot">
            {/* saiu versão nova (Vitor, 02/10/2026: "não na tela toda, na barra lateral; deixe o usuário continuar usando") */}
            {versaoNova && !oculta && (
              <div className="versao-card" role="status">
                <b>Saiu a versão {versaoNova}</b>
                <span className="hint">Atualize quando quiser: nada do que você fez na tela se perde.</span>
                <button type="button" className="btn btn-primary" onClick={atualizarVersao}>Atualizar</button>
              </div>
            )}
            <button type="button" className="subnav-item subnav-colapsar" aria-expanded={!oculta} title={oculta ? 'Mostrar barra lateral' : 'Ocultar barra lateral'} onClick={alternarLateral}>
              <Icone nome="painel" /><span>{oculta ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}</span>
            </button>
          </div>
        </nav>
        {principal}
      </div>
      )}
      {!noOutro && <Rodape />}
    </div>
  );
}

/**
 * O rodapé (como o do GitHub): no fim da página, na largura toda; só aparece quando a pessoa rola até o fim.
 * Por enquanto só o direito autoral (o tigre saiu: Vitor, 01/10/2026); os links (Termos, Privacidade…) vêm depois, com as páginas.
 */
function Rodape() {
  return (
    <footer className="rodape">
      <span>© {new Date().getFullYear()} Grupo G&amp;V by Gustavo Santos &amp; Vítor Dias, Inc.</span>
    </footer>
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
