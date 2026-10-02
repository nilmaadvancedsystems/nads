// A barrinha de carregamento no topo da página, igual à do GitHub, no vermelho da marca. Qualquer tela
// avisa que está carregando com useCarregando(true); enquanto alguém estiver carregando, a barra anda
// devagar até quase o fim; quando todos terminam, ela completa e some. Carregamento rápido (menos de
// 150 ms) nem aparece. Dentro de uma etapa da Tarefas, a barra é a dela (no alto da página, de ponta a
// ponta): esta só conta a ela quando começa e termina.
import { animate, utils } from 'animejs';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ENTRAR, prefereMenosMovimento } from './animacao';
import { origemDoPai } from './origem';

let ativos = 0;
const ouvintes = new Set<() => void>();
function mudar(d: number) {
  ativos = Math.max(0, ativos + d);
  for (const f of ouvintes) f();
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const algumCarregando = () => ativos > 0;

/** A tela está carregando algo (dado do banco, arquivo…): a barra do topo aparece enquanto for true. */
export function useCarregando(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return;
    mudar(1);
    return () => mudar(-1);
  }, [ativo]);
}

type Fase = 'parada' | 'andando' | 'terminando';

/** A barra em si: vai uma vez só, no alto da página (main.tsx). */
export function BarraDeCarregamento() {
  const carregando = useSyncExternalStore(assinar, algumCarregando, algumCarregando);
  const [fase, setFase] = useState<Fase>('parada');
  const [pai] = useState(origemDoPai);

  // dentro de uma etapa da Tarefas: avisa a de fora (a barra aparece lá)
  useEffect(() => {
    if (pai) window.parent.postMessage({ nads: 'carregando', ativo: carregando }, pai);
  }, [pai, carregando]);

  useEffect(() => {
    if (carregando) {
      if (fase === 'andando') return;
      const t = setTimeout(() => setFase('andando'), fase === 'terminando' ? 0 : 150);
      return () => clearTimeout(t);
    }
    if (fase === 'andando') setFase('terminando');
  }, [carregando, fase]);

  // o movimento é do animejs (01/10/2026), por scaleX (só transform): andando, corre no começo e freia perto do fim (nunca chega sozinha);
  // terminando, completa num instante e apaga; sem movimento, só aparece e some
  const barra = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = barra.current;
    if (!el) return;
    if (fase === 'andando') {
      if (prefereMenosMovimento()) { utils.set(el, { scaleX: 0.6, opacity: 1 }); return; }
      const a = animate(el, { scaleX: [0, 0.88], opacity: [1, 1], duration: 9000, ease: 'out(5)' });
      return () => { a.pause(); };
    }
    if (fase === 'terminando') {
      const a = animate(el, { scaleX: 1, duration: prefereMenosMovimento() ? 0 : 200, ease: ENTRAR, onComplete: () => {
        animate(el, { opacity: 0, duration: prefereMenosMovimento() ? 0 : 240, ease: 'linear', onComplete: () => setFase('parada') });
      } });
      return () => { a.pause(); };
    }
    utils.set(el, { scaleX: 0, opacity: 0 });
  }, [fase]);

  if (pai) return null;
  return <div ref={barra} className={'barra-carregamento ' + fase} role="progressbar" aria-hidden={fase === 'parada'} aria-label="Carregando" />;
}
