// A barrinha de carregamento no topo da página, igual à do GitHub, no vermelho da marca. Qualquer tela
// avisa que está carregando com useCarregando(true); enquanto alguém estiver carregando, a barra anda
// devagar até quase o fim; quando todos terminam, ela completa e some. Carregamento rápido (menos de
// 150 ms) nem aparece. Dentro de uma etapa da Tarefas, a barra é a dela (no alto da página, de ponta a
// ponta): esta só conta a ela quando começa e termina.
import { useEffect, useState, useSyncExternalStore } from 'react';
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

  // completou: some e volta ao começo
  useEffect(() => {
    if (fase !== 'terminando') return;
    const t = setTimeout(() => setFase('parada'), 450);
    return () => clearTimeout(t);
  }, [fase]);

  if (pai) return null;
  return <div className={'barra-carregamento ' + fase} role="progressbar" aria-hidden={fase === 'parada'} aria-label="Carregando" />;
}
