// Retorno ao usuário: toast (some em ~3,6 s) e modal (pergunta com botões, devolve a escolha).
// Origem: conferencia.html toast/modal (~L1425-1448). O ViewModel pede com useRetorno();
// quem desenha é daqui.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sairComo } from './animacao';
import { Icone, type NomeIcone } from './icones';

export interface BotaoModal<T> { rotulo: string; valor: T; variante?: 'btn-primary' | 'btn-outline' | 'btn-danger' }

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

  const toast = useCallback((texto: string) => {
    const id = ++seq.current;
    setToasts(t => t.concat({ id, texto }));
    // a saída (animejs, 01/10/2026): o aviso sai por onde entrou, do jeito do app; só então sai da lista
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-toast="' + id + '"]');
      void (el ? sairComo('aviso', el) : Promise.resolve()).then(() => setToasts(t => t.filter(x => x.id !== id)));
    }, 3300);
  }, []);

  const modal = useCallback(<T,>(o: OpcoesModal<T>) => new Promise<T>(res => {
    setAberto({ id: ++proximaJanela, o: o as OpcoesModal<unknown>, resolver: v => res(v as T) });
  }), []);

  const valor = useMemo<Retorno>(() => ({ toast, modal }), [toast, modal]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      {aberto && <Modal key={aberto.id} aberto={aberto} fechar={v => { setAberto(a => (a === aberto ? null : a)); aberto.resolver(v); }} />}
      <div className="toast-region" aria-live="polite">
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
    if (janela) void sairComo('janela', janela);
    void sairComo('fundo', el).then(() => fechar(v));
  }, [fechar]);
  useEffect(() => { primeiro.current?.focus(); }, []);
  useEffect(() => {
    if (!o.fecharEm) return;
    const t = setTimeout(() => fecharAnimado(o.fecharEm?.valor), o.fecharEm.ms);
    return () => clearTimeout(t);
  }, [o, fecharAnimado]);
  return (
    <div ref={raiz} className={'modal-overlay' + (o.obrigatoria ? ' modal-blur' : '')}>
      <div className={'modal' + (o.tom === 'ok' ? ' modal-ok' : '')} role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="modal-icon"><Icone nome={o.icone || 'landmark'} /></div>
        <h3 id="modalTitle">{o.titulo}</h3>
        {o.html ? <p dangerouslySetInnerHTML={{ __html: o.html }} /> : o.texto ? <p>{o.texto}</p> : null}
        {o.corpo}
        <div className="modal-actions">
          {o.botoes.map((b, i) => (
            <button key={b.rotulo} ref={i === 0 ? primeiro : undefined} type="button" className={'btn ' + (b.variante || 'btn-outline')} onClick={() => fecharAnimado(b.valor)}>{b.rotulo}</button>
          ))}
        </div>
        {o.fecharEm && <div className="modal-ok-barra" />}
      </div>
    </div>
  );
}
