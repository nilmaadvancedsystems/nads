// Retorno ao usuário: toast (fica 4 s) e modal (pergunta com botões, devolve a escolha).
// Os avisos (01/10/2026, no estilo do Sonner): empilham no canto — o mais novo na frente, os de trás menores e um pouco
// acima (até 3 à vista); com o mouse em cima, a pilha abre em leque e o tempo para; com a aba escondida também para.
// Origem: conferencia.html toast/modal (~L1425-1448). O ViewModel pede com useRetorno();
// quem desenha é daqui.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { animar, apagarFundo, ENTRAR, origemDe, paramsDaPilha, paramsDoAvisoQueChega, sairComo, semMovimento, voltarParaOrigem } from './animacao';
import { Icone, type NomeIcone } from './icones';

export interface BotaoModal<T> {
  rotulo: string; valor: T; variante?: 'btn-primary' | 'btn-outline' | 'btn-danger';
  /** roda no próprio clique, antes de fechar (ex.: abrir uma aba nova, que o navegador só deixa no clique) */
  aoClicar?: () => void;
}

export interface OpcoesModal<T> {
  icone?: NomeIcone;
  titulo: string;
  /** texto simples */
  texto?: string;
  /** texto com <b>/<br> montado pelo próprio sistema (nunca com dado de fora sem escapar) */
  html?: string;
  botoes: BotaoModal<T>[];
  /** fundo embaçado e não fecha fora (pergunta obrigatória) */
  obrigatoria?: boolean;
  /** modal de sucesso (check verde grande) */
  tom?: 'ok';
  /** fecha sozinho depois de X ms devolvendo este valor (com a barrinha verde) */
  fecharEm?: { ms: number; valor: T };
  /** conteúdo livre (ex.: seletor de tema) */
  corpo?: ReactNode;
}

/**
 * Toda janela no desenho do "Tudo certo!" (Vitor, 02/10/2026: "redesenhe todas no mesmo padrão do JN-01"): o ícone numa
 * bolinha, o título, o texto e os botões no centro. A cor da bolinha diz o tom: verde (deu certo), laranja (aviso, ⚠),
 * cinza (as outras).
 */
export function classeDaJanela(o: { tom?: 'ok'; icone?: NomeIcone }): string {
  return 'modal modal-centro' + (o.tom === 'ok' ? ' modal-ok' : o.icone === 'alert' ? ' modal-aviso' : '');
}

/**
 * A ordem dos botões na janela (Vitor, 02/10/2026: "cancelar sempre na direita"): primeiro as ações, por último o de
 * desistir (o de borda, sem cor: Cancelar, Agora não, Não). Quem chama pode mandar em qualquer ordem.
 */
export function ordemDosBotoes<T extends { variante?: string }>(botoes: readonly T[]): T[] {
  const desiste = (b: T) => !b.variante || b.variante === 'btn-outline';
  return [...botoes.filter(b => !desiste(b)), ...botoes.filter(desiste)];
}

export interface Retorno {
  toast(mensagem: string): void;
  modal<T>(o: OpcoesModal<T>): Promise<T>;
}

const Ctx = createContext<Retorno | null>(null);

export function useRetorno(): Retorno {
  const r = useContext(Ctx);
  if (!r) throw new Error('useRetorno fora do RetornoProvider');
  return r;
}

interface ModalAberto { id: number; o: OpcoesModal<unknown>; resolver: (v: unknown) => void }
let proximaJanela = 0;

export function RetornoProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const [aberto, setAberto] = useState<ModalAberto | null>(null);
  const seq = useRef(0);

  // o tempo de cada aviso: quanto falta e desde quando está correndo (pausa com o mouse em cima e com a aba escondida)
  const relogios = useRef(new Map<number, { falta: number; desde: number; t: ReturnType<typeof setTimeout> | null }>());
  const pausado = useRef(false);
  const [leque, setLeque] = useState(false);
  const regiao = useRef<HTMLDivElement>(null);

  const tirar = useCallback((id: number) => {
    relogios.current.delete(id);
    // sai por onde entrou (desce e apaga); só então sai da lista
    const el = regiao.current?.querySelector<HTMLElement>('[data-toast="' + id + '"]');
    if (el) el.setAttribute('data-saindo', '');
    setToasts(t => t.slice());   // a pilha se rearruma sem ele já agora
    const fora = () => setToasts(t => t.filter(x => x.id !== id));
    if (!el) { fora(); return; }
    animar(el, { opacity: 0, translateY: el.offsetHeight + 24, scale: 0.95, duration: 320, ease: ENTRAR, composition: 'replace', onComplete: fora });
  }, []);
  const correr = useCallback((id: number) => {
    const r = relogios.current.get(id);
    if (!r || pausado.current) return;
    r.desde = Date.now();
    r.t = setTimeout(() => tirar(id), r.falta);
  }, [tirar]);
  const pausar = useCallback((sim: boolean) => {
    if (pausado.current === sim) return;
    pausado.current = sim;
    for (const [id, r] of relogios.current) {
      if (sim) { if (r.t) clearTimeout(r.t); r.t = null; r.falta = Math.max(800, r.falta - (Date.now() - r.desde)); }
      else correr(id);
    }
  }, [correr]);
  useEffect(() => {
    const ver = () => pausar(document.hidden);
    document.addEventListener('visibilitychange', ver);
    return () => document.removeEventListener('visibilitychange', ver);
  }, [pausar]);

  const toast = useCallback((texto: string) => {
    const id = ++seq.current;
    setToasts(t => t.concat({ id, texto }));
    relogios.current.set(id, { falta: 4000, desde: Date.now(), t: null });
    correr(id);
  }, [correr]);

  // a pilha: o mais novo na frente (embaixo); os de trás 12 px acima e 5% menores, até 3 à vista; no leque, um acima do
  // outro com 8 px entre eles. O que acabou de chegar sobe de baixo.
  const vistos = useRef(new Set<number>());
  useLayoutEffect(() => {
    const reg = regiao.current;
    if (!reg) return;
    const els = Array.from(reg.querySelectorAll<HTMLElement>('.toast:not([data-saindo])')).reverse();
    let acima = 0;
    els.forEach((el, i) => {
      const id = Number(el.dataset.toast);
      const lugar = { translateY: leque ? -acima : -i * 12, scale: leque ? 1 : Math.max(0.85, 1 - i * 0.05), opacity: i < 3 ? 1 : 0 };
      acima += el.offsetHeight + 8;
      el.style.zIndex = String(100 - i);
      if (!vistos.current.has(id)) {
        vistos.current.add(id);
        animar(el, paramsDoAvisoQueChega(el.offsetHeight));
      } else if (semMovimento()) {
        animar(el, { opacity: lugar.opacity });
        el.style.transform = 'translateY(' + lugar.translateY + 'px) scale(' + lugar.scale + ')';
      } else {
        animar(el, { ...lugar, ...paramsDaPilha(), composition: 'replace' });
      }
    });
    // a região tem a altura do que está à vista (o mouse continua "em cima" enquanto o leque está aberto)
    reg.style.height = (leque ? Math.max(0, acima - 8) : els[0]?.offsetHeight || 0) + 'px';
  }, [toasts, leque]);

  const modal = useCallback(<T,>(o: OpcoesModal<T>) => new Promise<T>(res => {
    setAberto({ id: ++proximaJanela, o: o as OpcoesModal<unknown>, resolver: v => res(v as T) });
  }), []);

  const valor = useMemo<Retorno>(() => ({ toast, modal }), [toast, modal]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      {aberto && <Modal key={aberto.id} aberto={aberto} fechar={v => { setAberto(a => (a === aberto ? null : a)); aberto.resolver(v); }} />}
      <div ref={regiao} className="toast-region" aria-live="polite"
        onMouseEnter={() => { setLeque(true); pausar(true); }} onMouseLeave={() => { setLeque(false); pausar(document.hidden); }}>
        {toasts.map(t => <div key={t.id} className="toast" data-toast={t.id}>{t.texto}</div>)}
      </div>
    </Ctx.Provider>
  );
}

function Modal({ aberto, fechar }: { aberto: ModalAberto; fechar: (v: unknown) => void }) {
  const { o } = aberto;
  const primeiro = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const saindo = useRef(false);
  // a saída (animejs, 01/10/2026): o fundo apaga e a janela sai pelo caminho da entrada, do jeito do app; só então ela fecha
  const fecharAnimado = useCallback((v: unknown) => {
    if (saindo.current) return;
    saindo.current = true;
    const el = raiz.current;
    if (!el) { fechar(v); return; }
    const janela = el.querySelector<HTMLElement>('.modal');
    // volta para o botão que a abriu (se ele ainda estiver na tela); senão, sai do jeito do app
    const volta = janela ? voltarParaOrigem(janela, origemDe(el)) : null;
    void (volta ? Promise.all([apagarFundo(el), volta]) : Promise.all([sairComo('fundo', el), janela ? sairComo('janela', janela) : null])).then(() => fechar(v));
  }, [fechar]);
  // clicar fora fecha (e a janela volta para o botão) quando dá para saber o que isso quer dizer: com um botão só, é ele;
  // com vários, é o de desistir (o contornado, nem o principal nem o de apagar). Janela obrigatória não fecha por fora.
  const desistir = o.botoes.length === 1 ? o.botoes[0] : o.botoes.find(b => (b.variante || 'btn-outline') === 'btn-outline');
  const foraFecha = !o.obrigatoria && !!desistir;
  const valorDeFora = desistir?.valor;
  useEffect(() => { primeiro.current?.focus(); }, []);
  useEffect(() => {
    if (!o.fecharEm) return;
    const t = setTimeout(() => fecharAnimado(o.fecharEm?.valor), o.fecharEm.ms);
    return () => clearTimeout(t);
  }, [o, fecharAnimado]);
  return (
    <div ref={raiz} data-saida-propria data-fecha-fora={foraFecha ? '' : undefined} className={'modal-overlay' + (o.obrigatoria ? ' modal-blur' : '')}
      onMouseDown={ev => { if (ev.target === ev.currentTarget && foraFecha) fecharAnimado(valorDeFora); }}>
      <div className={classeDaJanela(o)} role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="modal-icon"><Icone nome={o.icone || 'landmark'} /></div>
        <h3 id="modalTitle">{o.titulo}</h3>
        {o.html ? <p dangerouslySetInnerHTML={{ __html: o.html }} /> : o.texto ? <p>{o.texto}</p> : null}
        {o.corpo}
        <div className="modal-actions">
          {ordemDosBotoes(o.botoes).map((b, i, todos) => (
            // o foco no Cancelar quando a ação é de apagar (Enter sem querer não apaga); senão, na primeira ação
            <button key={b.rotulo} ref={i === (todos.some(x => x.variante === 'btn-danger') ? Math.max(0, todos.findIndex(x => !x.variante || x.variante === 'btn-outline')) : 0) ? primeiro : undefined} type="button" className={'btn ' + (b.variante || 'btn-outline')} onClick={() => { b.aoClicar?.(); fecharAnimado(b.valor); }}>{b.rotulo}</button>
          ))}
        </div>
        {o.fecharEm && <div className="modal-ok-barra" />}
      </div>
    </div>
  );
}
