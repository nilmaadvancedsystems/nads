// O mapa na tela (21/10/2026: "a tela com os botões coloridos"): por cima da tela de verdade, cada controle (o mesmo
// rótulo da coleta, rotuloDoControle) ganha uma moldura na cor do calor, do frio (azul) ao quente (vermelho), com o
// número de cliques do período; o que apareceu e ninguém clicou fica tracejado. A camada não pega clique (dá para
// usar a tela e passear pelo sistema com o mapa); a barra de baixo diz a tela, troca o período e sai. Só o admin.
import { BotaoIcone, Icone, Segmentado } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONTROLE, rotuloDoControle } from './rotuloDoControle';
import { useMapaNaTelaVM } from './useMapaNaTelaVM';

interface Caixa { chave: string; x: number; y: number; l: number; a: number; cliques: number; nivel: number }

/** a camada e a barra do próprio mapa (fora da medida) */
const DO_MAPA = '[data-mapa-na-tela]';

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
        if (el.closest(DO_MAPA)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > altura || r.left > largura) continue;
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
  return createPortal(
    <div data-mapa-na-tela="" data-uso-ignorar="">
      <div className="mapa-tela" aria-hidden="true">
        {caixas.map(c => (
          <span key={c.chave} className={'mapa-tela-caixa calor-' + c.nivel} style={{ left: c.x, top: c.y, width: c.l, height: c.a }}>
            <span className="mapa-tela-n num">{c.cliques}</span>
          </span>
        ))}
      </div>
      <div className="mapa-tela-barra" role="region" aria-label="Mapa do uso nesta tela">
        <Icone nome="alvo" width={18} height={18} />
        <span className="mapa-tela-titulo">
          <b>{vm.rotulo || 'Esta tela'}</b>
          <span className="fraco">
            {carregando ? 'Lendo o uso…' : vm.visitas + (vm.visitas === 1 ? ' visita' : ' visitas') + ' · ' + vm.cliques + (vm.cliques === 1 ? ' clique' : ' cliques')}
            {vm.exemplos ? ' · cores de exemplo' : ''}
          </span>
        </span>
        <span className="mapa-tela-legenda" aria-label="Do frio ao quente">
          <span className="fraco">frio</span>
          {[1, 2, 3, 4, 5].map(n => <span key={n} className={'mapa-tela-cor calor-' + n} />)}
          <span className="fraco">quente</span>
          <span className="mapa-tela-cor calor-0" /><span className="fraco">sem clique</span>
        </span>
        <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />
        <BotaoIcone icone="x" titulo="Sair do mapa" onClick={vm.sair} />
      </div>
    </div>,
    document.body,
  );
}
