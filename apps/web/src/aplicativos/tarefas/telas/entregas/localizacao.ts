// O lugar de onde a entrega é confirmada (16/10/2026, a cópia fiel do Entregas: capturarPosicaoAtual_): pede alta
// precisão primeiro (12 s); sem resposta, tenta sem exigir (6 s, aceita uma leitura de até 1 min) — e guarda a margem de
// erro junto, para quem comparar duas posições saber o quanto pode confiar nelas. Sem localização, a entrega segue.
import type { entregas } from '@nads/core';

type Geo = NonNullable<ReturnType<typeof entregas.geoDoBanco>>;

export function capturarPosicao(): Promise<Geo | null> {
  return new Promise(ok => {
    if (!navigator.geolocation) { ok(null); return; }
    const deu = (p: GeolocationPosition) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
    navigator.geolocation.getCurrentPosition(deu, () => {
      navigator.geolocation.getCurrentPosition(deu, () => ok(null), { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 });
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}

/** "localização capturada (precisão de 12 m)" / "localização indisponível (entrega segue normalmente)". */
export const textoDaLocalizacao = (g: Geo | null | undefined, procurando: boolean) =>
  procurando ? 'obtendo localização...' : g ? 'localização capturada' + (g.accuracy ? ' (precisão de ' + Math.round(g.accuracy) + ' m)' : '') : 'localização indisponível (entrega segue normalmente)';
