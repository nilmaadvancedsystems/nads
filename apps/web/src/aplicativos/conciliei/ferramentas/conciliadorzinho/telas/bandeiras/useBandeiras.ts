// ViewModel da etapa Bandeiras: quais operadoras entram nesta conciliação.
// Origem: conciliadorZINHO.html brandGrid/selectedBrandCodes/brandsContinueBtn (~L1190-1220).
import { conciliadorzinho as cz } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useAbrirEtapa, useSessao } from '../../casca/sessao';

export function useBandeiras() {
  const s = useSessao();
  const abrir = useAbrirEtapa();
  const { toast } = useRetorno();
  const [marcadas, setMarcadas] = useState<cz.IdBandeira[]>(s.estado.bandeiras);

  function alternar(id: cz.IdBandeira) {
    setMarcadas(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  }

  /** Continuar: as bandeiras na ordem da grade; extratos e contas das bandeiras começam do zero. */
  function continuar() {
    const codigos = cz.BANDEIRAS.map(b => b.id).filter(id => marcadas.includes(id));
    if (!codigos.length) return;
    const dados: Partial<Record<cz.IdBandeira, { arquivos: []; conta: string }>> = {};
    for (const c of codigos) dados[c] = { arquivos: [], conta: '' };
    s.mudar(e => ({ ...e, bandeiras: codigos, dados, resultado: null, alcancada: 0 }));
    toast('Bandeiras selecionadas: ' + codigos.map(c => cz.bandeira(c).rotulo).join(', '));
    abrir(('extrato-' + codigos[0]) as `extrato-${cz.IdBandeira}`, codigos);
  }

  return {
    opcoes: cz.BANDEIRAS.map(b => ({ ...b, marcada: marcadas.includes(b.id) })),
    alternar,
    podeContinuar: marcadas.length > 0,
    continuar,
  };
}
