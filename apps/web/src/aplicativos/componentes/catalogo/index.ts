// O catálogo inteiro: os tipos (abas de cima), as telas (menu lateral) e as peças, cada uma com o código dela
// (prefixo do tipo + a ordem dentro do tipo: BT-01, JN-12…). Peça nova entra no fim do tipo, para os códigos não mudarem.
import { JANELAS } from './janelas';
import { PECAS_BASE } from './pecas';
import { TELAS, TIPOS } from './telas';
import type { Peca } from './tipos';

export { TELAS, TIPOS };

const contagem: Record<string, number> = {};
export const PECAS: Peca[] = [...PECAS_BASE, ...JANELAS].map(p => {
  const t = TIPOS.find(x => x.id === p.tipo);
  const n = (contagem[p.tipo] = (contagem[p.tipo] || 0) + 1);
  return { ...p, cod: (t ? t.prefixo : 'XX') + '-' + String(n).padStart(2, '0') };
}).filter(p => !p.removida);
