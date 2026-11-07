// A janela sobre o papel de parede (como as do Umbrel): no celular, uma folha que sobe de baixo e ocupa quase a tela; no
// PC, uma janela no meio. A única animação do site: abrir e fechar, curta, e nenhuma com prefers-reduced-motion (o CSS
// zera a duração e aqui a espera de fechar vira 0). Esc e o fundo fecham.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconeDoRobo } from './IconeDoRobo';

const FECHAR_MS = 160;
const semMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Janela({ titulo, aoFechar, children, larga = false, rotulo }: { titulo: ReactNode; aoFechar: () => void; children: ReactNode; larga?: boolean; rotulo: string }) {
  const [fechando, setFechando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = () => {
    if (fechando) return;
    setFechando(true);
    setTimeout(aoFechar, semMovimento() ? 0 : FECHAR_MS);
  };
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    caixa.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharRef.current(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div className={'cr-janela-fundo' + (fechando ? ' fechando' : '')} onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={caixa} className={'cr-janela' + (larga ? ' larga' : '')} role="dialog" aria-modal="true" aria-label={rotulo} tabIndex={-1}>
        <span className="cr-janela-puxador" aria-hidden="true" />
        <div className="cr-janela-topo">
          <div className="cr-janela-titulo">{titulo}</div>
          <button type="button" className="cr-fechar" onClick={fechar} aria-label="Fechar">
            <IconeDoRobo nome="x" tamanho={18} />
          </button>
        </div>
        <div className="cr-janela-corpo">{children}</div>
      </div>
    </div>
  );
}

/** A confirmação de uma ação (pausar, limpar a fila, reiniciar, atualizar): por cima da janela, com o "não" em foco. */
export function Confirmacao({ titulo, texto, rotuloSim, perigo, enviando, erro, aoConfirmar, aoCancelar }: {
  titulo: string; texto: ReactNode; rotuloSim: string; perigo: boolean; enviando: boolean; erro: string; aoConfirmar: () => void; aoCancelar: () => void;
}) {
  const nao = useRef<HTMLButtonElement>(null);
  useEffect(() => { nao.current?.focus(); }, []);
  return (
    <div className="cr-confirma-fundo" onMouseDown={e => { if (e.target === e.currentTarget && !enviando) aoCancelar(); }}>
      <div className="cr-confirma" role="alertdialog" aria-modal="true" aria-labelledby="cr-confirma-titulo">
        <h2 id="cr-confirma-titulo">{titulo}</h2>
        <div className="cr-confirma-texto">{texto}</div>
        {erro && <p className="cr-erro-linha" role="alert">{erro}</p>}
        <div className="cr-confirma-botoes">
          <button ref={nao} type="button" className="cr-botao" onClick={aoCancelar} disabled={enviando}>Cancelar</button>
          <button type="button" className={'cr-botao ' + (perigo ? 'perigo' : 'primario')} onClick={aoConfirmar} disabled={enviando}>
            {enviando ? 'Enviando…' : rotuloSim}
          </button>
        </div>
      </div>
    </div>
  );
}
