// A ficha (de um robô, das máquinas, dos registros, dos ajustes): no celular, a tela inteira; no PC, um painel que entra
// pela direita, com o quadro visível atrás. A única animação do site: abrir e fechar, curta, e nenhuma com
// prefers-reduced-motion (o CSS zera a duração e aqui a espera de fechar vira 0). Esc e o fundo fecham.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconeDoRobo } from './IconeDoRobo';

const FECHAR_MS = 160;
const semMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Janela({ titulo, aoFechar, children, abas, rotulo }: { titulo: ReactNode; aoFechar: () => void; children: ReactNode; /** as abas, fixas debaixo do título */ abas?: ReactNode; rotulo: string }) {
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
    <div className={'cr-ficha-fundo' + (fechando ? ' fechando' : '')} onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={caixa} className="cr-ficha" role="dialog" aria-modal="true" aria-label={rotulo} tabIndex={-1}>
        <div className="cr-ficha-topo">
          <div className="cr-ficha-titulo">{titulo}</div>
          <button type="button" className="cr-fechar" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)">
            <IconeDoRobo nome="x" tamanho={18} />
          </button>
        </div>
        {abas}
        <div className="cr-ficha-corpo">{children}</div>
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
