// O relógio do expediente (12/11/2026): a tela das tarefas se redesenha só na virada (11:05, 13:00, 18:05 e 07:00, a
// regra é do core: tarefas.delegadas.proximaVirada), para a em andamento aparecer Pausada e voltar sozinha, sem um
// relógio batendo a cada segundo.
import { tarefas } from '@nads/core';
import { useEffect, useState } from 'react';

export function useAgoraDoExpediente(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    // +1 s de folga: acorda já do outro lado da virada
    const espera = tarefas.delegadas.proximaVirada(agora).getTime() - Date.now() + 1000;
    const id = setTimeout(() => setAgora(new Date()), Math.max(1000, espera));
    return () => clearTimeout(id);
  }, [agora]);
  return agora;
}
