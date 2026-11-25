// O balão de guia (25/11/2026: "Coloca um balaozinho de guia, Importe os lancamentos do SCI em (formato que vc aceita)"; "Coloca um
// balao tbm aqui, de guia"): embaixo do botão que pulsa, com a setinha apontando para ele, enquanto a tela está vazia. Some no
// primeiro clique fora dele e do botão ("o usuario clicando fora, o balao sai"); volta quando a tela abre vazia de novo.
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** lado: o balão centrado no botão ou alinhado pela direita (o botão perto da borda da tela) */
export function BalaoDeGuia({ texto, lado = 'centro', children }: { texto: ReactNode; lado?: 'centro' | 'direita'; children: ReactNode }) {
  const [visivel, setVisivel] = useState(true);
  const caixa = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!visivel) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setVisivel(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [visivel]);
  return (
    <span ref={caixa} className="sci-guia">
      {children}
      {visivel && <span className={'sci-guia-balao ' + lado} role="note">{texto}</span>}
    </span>
  );
}
