// O tutorial guiado da Área do Cliente (13/11/2026: "quero um tutorial tanto no modo pc e no modo celular bem guiado,
// explicando tudo passo a passo do jeito mais bonito possível"). A tela escurece e uma janela clara (o destaque) anda até
// a parte explicada, com um anel carmim; o balão ao lado diz o que é e o que dá para fazer, com o passo, a barra de
// progresso, o Voltar, o Próximo e o Pular. O primeiro e o último passo são o cartão no meio da tela. Cada passo abre a
// tela dele (o irPara). Teclado: → e Enter avançam, ← volta, Esc fecha. Os passos vêm de dados/tutorial.ts.
import { Icone, MarcaN } from '@nads/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { capitulosDoTutorial, ICONE_DO_CAPITULO, type PassoDoTutorial } from '../dados/tutorial';

type Caixa = { x: number; y: number; w: number; h: number; /** de que passo é */ id?: string };
const FOLGA = 8;      // o destaque um pouco maior que a parte
const MARGEM = 12;    // o balão longe das bordas
const ESPACO = 14;    // entre o destaque e o balão

export function Tutorial({ passos, abaAtual, irPara, onFechar }: {
  passos: readonly PassoDoTutorial[]; abaAtual: string; irPara: (aba: string) => void;
  /** concluiu: chegou ao fim (e não pulou) */ onFechar: (concluiu: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [alvo, setAlvo] = useState<Caixa | null>(null);
  // onde está cada marca numerada (só as que estão na tela)
  const [marcas, setMarcas] = useState<{ n: number; x: number; y: number }[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [tamanho, setTamanho] = useState({ w: 360, h: 220 });
  const balao = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const passo = passos[i];
  const ultimo = i === passos.length - 1;

  const ir = useCallback((k: number) => { if (k >= 0 && k < passos.length) setI(k); }, [passos.length]);
  const proximo = useCallback(() => { if (ultimo) onFechar(true); else ir(i + 1); }, [ultimo, onFechar, ir, i]);

  // abre a tela do passo (se precisar)
  useEffect(() => { if (passo?.aba && passo.aba !== abaAtual) irPara(passo.aba); }, [passo, abaAtual, irPara]);

  // acha a parte (a tela nova pode demorar um pouco), rola até ela e acompanha onde está (a rolagem, a janela que muda)
  // (13/11/2026: "tá piscando, não vai fluido"): o destaque fica na parte de antes até achar a nova e desliza até ela;
  // só some quando o passo não tem parte (o cartão do meio). O deslizar vale só logo depois de trocar de passo: na rolagem,
  // o destaque acompanha a parte sem atraso.
  const [andando, setAndando] = useState(false);
  // o balão só aparece quando a parte nova parou no lugar (a tela trocou, a rolagem terminou): aparece já no lugar certo,
  // num fade curto, em vez de deslizar pela tela com o texto trocado (13/11/2026: "a animação do balão tá estranha")
  const [assentou, setAssentou] = useState(false);
  useEffect(() => {
    setAndando(true);
    setAssentou(false);
    const t = setTimeout(() => setAndando(false), 700);
    return () => clearTimeout(t);
  }, [passo]);
  useEffect(() => {
    setMarcas([]);
    if (!passo?.alvo) { setAlvo(null); setProcurando(false); return; }
    setProcurando(true);
    let quadro = 0;
    const inicio = performance.now();
    let el: Element | null = null;
    let ultima = '';
    let quieto: ReturnType<typeof setTimeout> | undefined;
    const seguir = () => {
      if (!el || !el.isConnected) {
        el = document.querySelector(passo.alvo!);
        // rola na hora e só se a parte não está inteira na tela (13/11/2026: "tá demorando para aparecer"): rolagem
        // suave fazia o balão esperar ela terminar
        if (el) {
          const r0 = el.getBoundingClientRect();
          const cabe = r0.height < window.innerHeight - 40;
          if (r0.top < 60 || (cabe ? r0.bottom > window.innerHeight - 20 : r0.top > window.innerHeight * 0.5)) el.scrollIntoView({ block: cabe ? 'center' : 'start', inline: 'nearest', behavior: 'auto' });
        }
        else if (performance.now() - inicio > 2500) { setProcurando(false); return; }
      }
      if (el) {
        const r = el.getBoundingClientRect();
        // o que passa da tela fica dentro dela (a lateral inteira, uma lista comprida)
        const y = Math.max(r.top, 4), b = Math.min(r.bottom, window.innerHeight - 4);
        const x = Math.max(r.left, 4), d = Math.min(r.right, window.innerWidth - 4);
        const c = { x: x - FOLGA, y: y - FOLGA, w: d - x + FOLGA * 2, h: Math.max(b - y, 0) + FOLGA * 2 };
        // as marcas: o canto de cima, à esquerda, de cada parte de dentro que aparece
        const ms = (passo.marcas ?? []).map((m, k) => {
          const e = document.querySelector(m.alvo);
          const q = e?.getBoundingClientRect();
          return q && q.width > 0 && q.bottom > 0 && q.top < window.innerHeight ? { n: k + 1, x: Math.max(q.left - 9, 2), y: Math.max(q.top - 9, 2) } : null;
        }).filter((m): m is { n: number; x: number; y: number } => !!m);
        const chave = [c.x, c.y, c.w, c.h, ...ms.flatMap(m => [m.x, m.y])].map(Math.round).join(',');
        if (chave !== ultima) {
          ultima = chave; setAlvo({ ...c, id: passo.id }); setMarcas(ms); setProcurando(false);
          // o balão aparece logo depois de a parte ser achada (uma vez por passo; a parte que se mexe não o segura)
          if (!quieto) quieto = setTimeout(() => setAssentou(true), 40);
        }
      }
      quadro = requestAnimationFrame(seguir);
    };
    quadro = requestAnimationFrame(seguir);
    return () => { cancelAnimationFrame(quadro); clearTimeout(quieto); };
  }, [passo]);

  // o tamanho do balão (para caber do lado certo) e o foco no botão principal
  useLayoutEffect(() => {
    const b = balao.current?.getBoundingClientRect();
    if (b && (Math.round(b.width) !== tamanho.w || Math.round(b.height) !== tamanho.h)) setTamanho({ w: Math.round(b.width), h: Math.round(b.height) });
  }, [passo, alvo, procurando, tamanho.w, tamanho.h]);
  const temAlvo = alvo !== null;
  useEffect(() => { principal.current?.focus({ preventScroll: true }); }, [i, temAlvo]);

  // o teclado
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onFechar(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); proximo(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar, proximo, ir, i]);

  if (!passo) return null;
  const pronto = !!alvo && alvo.id === passo.id;
  const noMeio = !passo.alvo || (!procurando && !pronto);
  const escondido = !noMeio && (!pronto || !assentou);
  const lugar = alvo && !noMeio ? ondeFicaOBalao(alvo, tamanho) : null;
  const n = passos.length;
  const primeiro = i === 0;
  // os capítulos: a barra de progresso em pedaços, um por capítulo, cheios até onde já foi
  const capitulos = capitulosDoTutorial(passos);
  const noCapitulo = passos.filter(p => p.capitulo === passo.capitulo);
  const posNoCapitulo = noCapitulo.indexOf(passo);
  const capituloAtual = capitulos.indexOf(passo.capitulo);
  const cheio = (k: number) => (k < capituloAtual ? 1 : k > capituloAtual ? 0 : (posNoCapitulo + 1) / noCapitulo.length);
  // a setinha do balão aponta para o meio da parte (no lado em que o balão está)
  const seta = lugar && alvo ? (lugar.lado === 'baixo' || lugar.lado === 'cima'
    ? Math.max(20, Math.min(alvo.x + alvo.w / 2 - lugar.x, tamanho.w - 20))
    : Math.max(20, Math.min(alvo.y + alvo.h / 2 - lugar.y, tamanho.h - 20))) : 0;

  return createPortal(
    <div className={'cli-app cli-tut' + (noMeio ? ' no-meio' : '')} data-sem-animacao="" role="dialog" aria-modal="true" aria-labelledby="cli-tut-titulo">
      {/* o fundo escuro com a janela clara no lugar da parte explicada */}
      {alvo && !noMeio
        ? <div className={'cli-tut-destaque' + (andando ? ' anda' : '')} style={{ transform: `translate(${alvo.x}px, ${alvo.y}px)`, width: alvo.w, height: alvo.h }} aria-hidden="true" />
        : <div className="cli-tut-fundo" aria-hidden="true" />}
      <div className="cli-tut-trava" aria-hidden="true" />
      {!noMeio && !escondido && marcas.map(m => <span key={m.n} className="cli-tut-marca-n" style={{ transform: `translate(${m.x}px, ${m.y}px)` }} aria-hidden="true">{m.n}</span>)}

      <div ref={balao} key={passo.id} className={'cli-tut-balao' + (noMeio ? ' cartao' : '') + (lugar ? ' lado-' + lugar.lado : '') + (escondido ? ' escondido' : '')}
        style={lugar ? { left: lugar.x, top: lugar.y, ['--seta' as string]: seta + 'px' } : undefined} aria-live="polite">
        {noMeio ? (
          <div className="cli-tut-heroi" aria-hidden="true">
            {primeiro ? <span className="cli-tut-marca"><MarcaN /></span> : <Icone nome={passo.icone} width={30} height={30} />}
          </div>
        ) : (
          <div className="cli-tut-topo">
            <span className="cli-tut-ico" aria-hidden="true"><Icone nome={passo.icone} width={16} height={16} /></span>
            <span className="cli-tut-conta"><b>{passo.capitulo}</b>{noCapitulo.length > 1 && <> · {posNoCapitulo + 1} de {noCapitulo.length}</>}</span>
            <button type="button" className="cli-tut-x" onClick={() => onFechar(false)} aria-label="Fechar o tutorial" title="Fechar (Esc)"><Icone nome="x" width={14} height={14} /></button>
          </div>
        )}
        <h2 id="cli-tut-titulo">{passo.titulo}</h2>
        <p>{passo.texto}</p>
        {!noMeio && passo.marcas && marcas.length > 0 && (
          <ol className="cli-tut-marcas">
            {passo.marcas.map((m, k) => marcas.some(x => x.n === k + 1) && <li key={k}><span className="cli-tut-num">{k + 1}</span>{m.texto}</li>)}
          </ol>
        )}
        {/* o roteiro no começo e o resumo no fim: os capítulos com o ícone */}
        {noMeio && (primeiro || ultimo) && (
          <ul className={'cli-tut-roteiro' + (ultimo ? ' visto' : '')} aria-label={ultimo ? 'O que você viu' : 'O que vamos ver'}>
            {capitulos.map(c => (
              <li key={c}><span className="cli-tut-roteiro-ico"><Icone nome={ultimo ? 'check' : ICONE_DO_CAPITULO[c] ?? 'checkCircle'} width={14} height={14} /></span>{c}</li>
            ))}
          </ul>
        )}
        {primeiro && <p className="cli-tut-tempo"><Icone nome="clock" width={13} height={13} />Cerca de 1 minuto · {n - 2} passos</p>}
        {!noMeio && (
          <div className="cli-tut-capitulos" aria-label={'Passo ' + i + ' de ' + (n - 2)}>
            {capitulos.map((c, k) => (
              <span key={c} className={'cli-tut-cap' + (k === capituloAtual ? ' atual' : '')} title={c}><span style={{ width: cheio(k) * 100 + '%' }} /></span>
            ))}
          </div>
        )}
        <div className="cli-tut-pe">
          {primeiro ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => onFechar(false)}>Agora não</button>
              <button type="button" ref={principal} className="btn btn-primary" onClick={proximo}>Começar<Icone nome="chevronRight" width={16} height={16} /></button>
            </>
          ) : ultimo ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => ir(i - 1)}>Voltar</button>
              <button type="button" ref={principal} className="btn btn-primary" onClick={proximo}><Icone nome="check" width={16} height={16} />Concluir</button>
            </>
          ) : (
            <>
              <button type="button" className="cli-tut-pular" onClick={() => onFechar(false)}>Pular</button>
              <span className="cli-tut-botoes">
                <button type="button" className="btn btn-sm" onClick={() => ir(i - 1)} aria-label="Passo anterior"><Icone nome="chevronLeft" width={16} height={16} /></button>
                <button type="button" ref={principal} className="btn btn-sm btn-primary" onClick={proximo}>Próximo<Icone nome="chevronRight" width={16} height={16} /></button>
              </span>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Onde o balão fica: do lado com mais espaço (embaixo, em cima, à direita, à esquerda, nessa preferência quando cabe),
 * alinhado com a parte e sem sair da tela. No celular (tela estreita) só embaixo ou em cima, na largura toda.
 */
function ondeFicaOBalao(a: Caixa, t: { w: number; h: number }): { x: number; y: number; lado: 'baixo' | 'cima' | 'direita' | 'esquerda' } {
  const W = window.innerWidth, H = window.innerHeight;
  const cabe = {
    baixo: H - (a.y + a.h) - ESPACO >= t.h + MARGEM,
    cima: a.y - ESPACO >= t.h + MARGEM,
    direita: W - (a.x + a.w) - ESPACO >= t.w + MARGEM,
    esquerda: a.x - ESPACO >= t.w + MARGEM,
  };
  const prende = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
  const centroX = prende(a.x + a.w / 2 - t.w / 2, MARGEM, W - t.w - MARGEM);
  const centroY = prende(a.y + a.h / 2 - t.h / 2, MARGEM, H - t.h - MARGEM);
  // a parte alta e estreita (a lateral) pede o balão ao lado
  // (a lateral, aberta ou recolhida: encostada na esquerda e estreita)
  const altaEEstreita = (a.h > H * 0.5 && a.w < W * 0.4) || (a.w < 140 && a.h > 160) || (a.x < 40 && a.w < W * 0.25 && a.h > 200);
  if (altaEEstreita && cabe.direita) return { x: a.x + a.w + ESPACO, y: centroY, lado: 'direita' };
  if (cabe.baixo) return { x: centroX, y: a.y + a.h + ESPACO, lado: 'baixo' };
  if (cabe.cima) return { x: centroX, y: a.y - ESPACO - t.h, lado: 'cima' };
  if (cabe.direita) return { x: a.x + a.w + ESPACO, y: centroY, lado: 'direita' };
  if (cabe.esquerda) return { x: a.x - ESPACO - t.w, y: centroY, lado: 'esquerda' };
  // não cabe em lado nenhum (a parte ocupa a tela): por cima dela, embaixo da tela
  return { x: centroX, y: H - t.h - MARGEM - (W < 768 ? 76 : 0), lado: 'cima' };
}
