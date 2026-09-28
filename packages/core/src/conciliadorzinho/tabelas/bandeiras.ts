// Catálogo das bandeiras (operadoras de cartão), sem os logos.
// Origem: conciliadorZINHO.html BRAND_META (~L960) e BRAND_LIST (~L967).
// Os logos ficam em @nads/ui (logosBandeiras.ts): são desenho, não regra.
import type { Bandeira, IdBandeira } from '../tipos';

/** Na mesma ordem do BRAND_LIST (é a ordem da grade de escolha). */
export const BANDEIRAS: readonly Bandeira[] = [
  { id: 'cielo', rotulo: 'Cielo', slug: 'cielo' },
  { id: 'rede', rotulo: 'Rede', slug: 'rede' },
  { id: 'getnet', rotulo: 'Getnet', slug: 'getnet' },
  { id: 'stone', rotulo: 'Stone', slug: 'stone' },
  { id: 'pagbank', rotulo: 'PagBank', slug: 'pagbank' },
];

export function bandeira(id: IdBandeira): Bandeira {
  const b = BANDEIRAS.find(x => x.id === id);
  if (!b) throw new Error('Bandeira desconhecida: ' + id);
  return b;
}
