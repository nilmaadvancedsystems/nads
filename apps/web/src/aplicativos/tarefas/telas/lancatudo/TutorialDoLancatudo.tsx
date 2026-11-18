// O tutorial do Lançatudo na tela: escurece tudo menos a parte do passo (a luz, com um anel na cor de destaque), e o balão
// ao lado diz o que é, com o passo, os pontos do progresso, o Voltar, o Próximo e o Pular. O primeiro e o último passo são o
// cartão no meio. A luz acompanha a parte se a tela rolar ou mudar de tamanho. Teclado: → e Enter avançam, ← volta, Esc
// fecha. Os passos vêm de tutorial.ts.
import { Icone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { passosNaTela } from './passosDoTutorial';

type Caixa = { top: number; left: number; width: number; height: number };
const FOLGA = 6;
const LARGURA = 360;

export function TutorialDoLancatudo({ fechar }: { fechar: () => void }) {
  const [passos] = useState(() => passosNaTela(alvo => !!document.querySelector(alvo)));
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const passo = passos[i];
  const primeiro = i === 0;
  const ultimo = i === passos.length - 1;
  const comParte = passos.filter(p => p.alvo);
  const nDaParte = passo.alvo ? comParte.indexOf(passo) + 1 : 0;

  // acha a parte, rola até ela se não estiver inteira na tela, e acompanha onde ela está
  useEffect(() => {
    if (!passo.alvo) { setCaixa(null); return; }
    const el = document.querySelector(passo.alvo);
    if (!el) { setCaixa(null); return; }
    const r0 = el.getBoundingClientRect();
    if (r0.top < 70 || r0.bottom > window.innerHeight - 200) el.scrollIntoView({ block: 'center', behavior: 'auto' });
    let quadro = 0;
    let ultima = '';
    const seguir = () => {
      const r = el.getBoundingClientRect();
      const c = { top: r.top - FOLGA, left: r.left - FOLGA, width: r.width + FOLGA * 2, height: r.height + FOLGA * 2 };
      const chave = [c.top, c.left, c.width, c.height].map(Math.round).join(',');
      if (chave !== ultima) { ultima = chave; setCaixa(c); }
      quadro = requestAnimationFrame(seguir);
    };
    seguir();
    return () => cancelAnimationFrame(quadro);
  }, [passo]);

  useEffect(() => { principal.current?.focus(); }, [i]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (ultimo) fechar(); else setI(i + 1); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); setI(i - 1); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [i, ultimo, fechar]);

  // o balão embaixo da parte quando cabe; senão, em cima; alinhado à esquerda dela, sem sair da tela
  const lugar = (() => {
    if (!caixa) return undefined;
    const left = Math.max(12, Math.min(caixa.left, window.innerWidth - LARGURA - 12));
    const embaixo = caixa.top + caixa.height < window.innerHeight * 0.58;
    return embaixo ? { left, top: caixa.top + caixa.height + 12 } : { left, bottom: window.innerHeight - caixa.top + 12 };
  })();

  return createPortal(
    <div className="lt-tut" role="dialog" aria-modal="true" aria-labelledby="lt-tut-titulo">
      {caixa ? <div className="lt-tut-luz" style={caixa} aria-hidden="true" /> : <div className="lt-tut-fundo" aria-hidden="true" />}
      <div key={passo.id} className={'lt-tut-balao' + (caixa ? '' : ' cartao')} style={lugar}>
        {caixa ? (
          <div className="lt-tut-topo">
            <span className="lt-tut-ico" aria-hidden="true"><Icone nome={passo.icone} /></span>
            <span className="lt-tut-conta">{nDaParte} de {comParte.length}</span>
            <button type="button" className="lt-tut-x" onClick={fechar} aria-label="Fechar o tutorial" title="Fechar (Esc)"><Icone nome="x" /></button>
          </div>
        ) : <span className="lt-tut-heroi" aria-hidden="true"><Icone nome={passo.icone} /></span>}
        <h2 id="lt-tut-titulo">{passo.titulo}</h2>
        <p>{passo.texto}</p>
        {passo.topicos && <ul className="lt-tut-topicos">{passo.topicos.map(t => <li key={t}>{t}</li>)}</ul>}
        {primeiro && <p className="lt-tut-tempo"><Icone nome="clock" />Menos de 1 minuto · {comParte.length} passos</p>}
        {caixa && (
          <div className="lt-tut-pontos" role="progressbar" aria-valuemin={1} aria-valuemax={comParte.length} aria-valuenow={nDaParte} aria-label={'Passo ' + nDaParte + ' de ' + comParte.length}>
            {comParte.map((p, k) => <span key={p.id} className={k + 1 === nDaParte ? 'atual' : k + 1 < nDaParte ? 'feito' : ''} />)}
          </div>
        )}
        <div className="lt-tut-pe">
          {primeiro ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={fechar}>Agora não</button>
              <span className="tarefas-barra-espaco" />
              <button type="button" ref={principal} className="btn btn-primary" onClick={() => setI(1)}>Começar<Icone nome="chevronRight" /></button>
            </>
          ) : (
            <>
              {caixa && <button type="button" className="btn btn-ghost lt-tut-pular" onClick={fechar}>Pular</button>}
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline" onClick={() => setI(i - 1)}><Icone nome="chevronLeft" />Voltar</button>
              {ultimo
                ? <button type="button" ref={principal} className="btn btn-primary" onClick={fechar}><Icone nome="check" />Concluir</button>
                : <button type="button" ref={principal} className="btn btn-primary" onClick={() => setI(i + 1)}>Próximo<Icone nome="chevronRight" /></button>}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
