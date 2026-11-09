// O sinal de onde a pessoa está (useOndeEstou): ao entrar na etapa e ao trocar, e no compasso do ponto do online, só com a aba
// visível. Ao deixar a etapa, apaga; a aba fechada para de renovar e deixa de contar sozinha.
import { usuarios } from '@nads/core';
import { useEffect } from 'react';
import { useOndeEstou, type OndeAberto } from './useOndeEstou';

export function useSinalDeOnde(onde: OndeAberto | null) {
  const { gravar, limpar } = useOndeEstou();
  const chave = onde ? JSON.stringify(onde) : '';
  useEffect(() => {
    if (!chave) return;
    const atual = JSON.parse(chave) as OndeAberto;
    let ultimo = 0;
    const bater = () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimo < 60 * 1000) return;
      ultimo = Date.now();
      gravar(atual);
    };
    bater();
    const relogio = setInterval(bater, usuarios.PONTO_DA_PRESENCA_MS);
    document.addEventListener('visibilitychange', bater);
    return () => { clearInterval(relogio); document.removeEventListener('visibilitychange', bater); };
  }, [chave, gravar]);
  // à parte, para trocar de etapa não apagar e gravar de novo
  const naEtapa = !!chave;
  useEffect(() => (naEtapa ? limpar : undefined), [naEtapa, limpar]);
}
