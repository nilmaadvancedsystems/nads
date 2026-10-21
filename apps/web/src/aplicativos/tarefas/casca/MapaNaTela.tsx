// O mapa na tela (21/10/2026: "a tela com os botões coloridos"): por cima da tela de verdade, cada controle (o mesmo
// rótulo da coleta, rotuloDoControle) fica verde (usam) ou vermelho (ninguém clicou no período); só as duas cores, sem
// número (21/10/2026: "era pra ficar mais fácil o entendimento do mapa"). A camada não pega clique (dá para
// usar a tela e passear pelo sistema com o mapa); a barra de baixo diz a tela, o que cada cor quer dizer e sai. Só o admin.
import { Icone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONTROLE, DA_CASCA, rotuloDoControle } from './rotuloDoControle';
import { useMapaNaTelaVM } from './useMapaNaTelaVM';

interface Caixa { chave: string; x: number; y: number; l: number; a: number; cliques: number; nivel: number }

/** a camada e a barra do próprio mapa (fora da medida) */
const DO_MAPA = '[data-mapa-na-tela]';
/** fora do mapa, como nas ferramentas de mapa de cliques (PostHog, Clarity): só a página, sem a casca (o aviso do topo, o
 *  cabeçalho, a lateral, a gaveta) nem o balão do suporte */
const FORA = DO_MAPA + ', ' + DA_CASCA;

export function MapaNaTela() {
  const vm = useMapaNaTelaVM();
  const agora = useRef(vm);
  useEffect(() => { agora.current = vm; });
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const { ligado, carregando, tela, periodo } = vm;

  // mede os controles visíveis: ao abrir, ao rolar, ao mudar o tamanho e quando a tela muda (o que carrega depois)
  useEffect(() => {
    if (!ligado || carregando || !tela) { setCaixas([]); return; }
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const { nomes, calorDe } = agora.current;
      const largura = window.innerWidth, altura = window.innerHeight;
      const novas: Caixa[] = [];
      for (const el of document.querySelectorAll(CONTROLE)) {
        if (el.closest(FORA)) continue;
        // o controle dentro de outro (o ícone dentro do botão) não ganha moldura própria: só o de fora
        if (el.parentElement?.closest(CONTROLE)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > altura || r.left > largura) continue;
        // o que está coberto (atrás de uma janela aberta) fica de fora: no meio do controle tem que estar ele mesmo
        const meio = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (meio && !el.contains(meio) && !meio.closest(DO_MAPA)) continue;
        const rotulo = rotuloDoControle(el, tela, nomes);
        if (!rotulo || rotulo === 'item da lista') continue;
        const c = calorDe(rotulo);
        novas.push({ chave: novas.length + '|' + rotulo, x: r.left, y: r.top, l: r.width, a: r.height, cliques: c.cliques, nivel: c.nivel });
      }
      setCaixas(novas);
    };
    const pedir = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
    // a camada do mapa também muda o DOM: o que muda só nela não pede outra medida (senão, mede sem parar)
    const observador = new MutationObserver(registros => {
      if (registros.some(m => !(m.target instanceof Element && m.target.closest(DO_MAPA)))) pedir();
    });
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    window.addEventListener('scroll', pedir, true);
    window.addEventListener('resize', pedir);
    pedir();
    return () => {
      observador.disconnect();
      window.removeEventListener('scroll', pedir, true);
      window.removeEventListener('resize', pedir);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ligado, carregando, tela, periodo]);

  if (!ligado) return null;
  const semUso = caixas.filter(c => c.nivel === 0).length;
  return createPortal(
    <div data-mapa-na-tela="" data-uso-ignorar="">
      <div className="mapa-tela" aria-hidden="true">
        {caixas.map(c => (
          <span key={c.chave} className={'mapa-tela-caixa calor-' + c.nivel} style={{ left: c.x, top: c.y, width: c.l, height: c.a }} />
        ))}
      </div>
      <div className="mapa-tela-barra" role="region" aria-label="Mapa do uso nesta tela">
        <Icone nome="alvo" width={18} height={18} />
        <span className="mapa-tela-titulo">
          <b>{vm.rotulo || 'Esta tela'}</b>
          <span className="fraco">
            {carregando ? 'Lendo o uso…' : semUso === 0 ? 'Todos os botões desta tela são usados' : semUso + (semUso === 1 ? ' botão que ninguém usa' : ' botões que ninguém usa')}
            {vm.exemplos ? ' · cores de exemplo' : ''}
          </span>
        </span>
        <span className="mapa-tela-legenda uso-explica">
          <span className="uso-cor calor-5">verde = usam</span>
          <span className="uso-cor calor-0">vermelho = ninguém usa</span>
        </span>
        <button type="button" className="btn btn-outline btn-sm" onClick={vm.sair}>Sair</button>
      </div>
    </div>,
    document.body,
  );
}
