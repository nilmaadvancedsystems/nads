// O ViewModel da aba Registros: o espelho do log do robô ao vivo (enquanto a aba está aberta), o filtro "só erros" e o
// "segue o fim" (a lista desce sozinha quando chega linha nova, a não ser que a pessoa tenha subido para ler).
import { robos as r } from '@nads/core';
import { useMemo, useState } from 'react';
import { useRegistrosDoRobo } from '../dados/repo';

export function useRegistros(robo: string, aberto: boolean, agora: number) {
  const regs = useRegistrosDoRobo(robo, aberto);
  const [soErros, setSoErros] = useState(false);
  const linhas = useMemo(() => (soErros ? regs.linhas.filter(l => l.nivel === 'erro') : regs.linhas), [regs.linhas, soErros]);
  const aoVivo = !!regs.em && agora - Date.parse(regs.em) < 60 * 1000;
  return {
    linhas: linhas.map((l, i) => ({ ...l, chave: l.em + '|' + i, hora: r.horaDaLinha(l.em) })),
    total: regs.linhas.length,
    erros: regs.linhas.filter(l => l.nivel === 'erro').length,
    atualizado: regs.em ? r.haQuantoTempo(regs.em, agora) : '',
    aoVivo,
    soErros,
    setSoErros,
  };
}
