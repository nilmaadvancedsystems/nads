// Retorno ao usuário: toast (some em ~3,6 s) e modal (pergunta com botões, devolve a escolha).
// Origem: conferencia.html toast/modal (~L1425-1448). O ViewModel pede com useRetorno();
// quem desenha é daqui.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

interface ModalAberto { o: OpcoesModal<unknown>; resolver: (v: unknown) => void }

export function RetornoProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const [aberto, setAberto] = useState<ModalAberto | null>(null);
  const seq = useRef(0);

  const toast = useCallback((texto: string) => {
    const id = ++seq.current;
    setToasts(t => t.concat({ id, texto }));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600);
  }, []);

  const modal = useCallback(<T,>(o: OpcoesModal<T>) => new Promise<T>(res => {
    setAberto({ o: o as OpcoesModal<unknown>, resolver: v => res(v as T) });
  }), []);

  const valor = useMemo<Retorno>(() => ({ toast, modal }), [toast, modal]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      {aberto && <Modal aberto={aberto} fechar={v => { setAberto(null); aberto.resolver(v); }} />}
      <div className="toast-region" aria-live="polite">
        {toasts.map(t => <div key={t.id} className="toast">{t.texto}</div>)}
      </div>
    </Ctx.Provider>
  );
}

function Modal({ aberto, fechar }: { aberto: ModalAberto; fechar: (v: unknown) => void }) {
  const { o } = aberto;
  const primeiro = useRef<HTMLButtonElement>(null);
  useEffect(() => { primeiro.current?.focus(); }, []);
  useEffect(() => {
    if (!o.fecharEm) return;
    const t = setTimeout(() => fechar(o.fecharEm?.valor), o.fecharEm.ms);
    return () => clearTimeout(t);
  }, [o, fechar]);
  return (
    <div className={'modal-overlay' + (o.obrigatoria ? ' modal-blur' : '')}>
      <div className={'modal' + (o.tom === 'ok' ? ' modal-ok' : '')} role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="modal-icon"><Icone nome={o.icone || 'landmark'} /></div>
        <h3 id="modalTitle">{o.titulo}</h3>
        {o.html ? <p dangerouslySetInnerHTML={{ __html: o.html }} /> : o.texto ? <p>{o.texto}</p> : null}
        {o.corpo}
        <div className="modal-actions">
          {o.botoes.map((b, i) => (
            <button key={b.rotulo} ref={i === 0 ? primeiro : undefined} type="button" className={'btn ' + (b.variante || 'btn-outline')} onClick={() => fechar(b.valor)}>{b.rotulo}</button>
          ))}
        </div>
        {o.fecharEm && <div className="modal-ok-barra" />}
      </div>
    </div>
  );
}
