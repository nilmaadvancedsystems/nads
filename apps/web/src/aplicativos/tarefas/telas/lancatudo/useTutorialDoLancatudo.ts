// ViewModel do tutorial do Lançatudo: abre sozinho na primeira vez (quando a tela já tem lançamentos para mostrar) e pelo
// botão Tutorial; fechar (concluindo ou pulando) guarda que viu, para não abrir sozinho de novo.
import { useEffect, useState } from 'react';
import { jaViuOTutorial, marcarTutorialVisto } from './passosDoTutorial';

export function useTutorialDoLancatudo(temLancamentos: boolean) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (temLancamentos && !jaViuOTutorial()) setAberto(true);
  }, [temLancamentos]);
  return {
    aberto,
    abrir: () => setAberto(true),
    fechar: () => { marcarTutorialVisto(); setAberto(false); },
  };
}
