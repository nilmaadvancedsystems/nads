// O relógio do andamento das notas (15/10/2026: "não consegue ter o feedback do robô de como tá indo?"): enquanto alguma nota
// anda (na fila, enviando, na prefeitura, cancelando), a tela redesenha a cada segundo para o "há 12 s" contar sozinho.
import { useEffect, useState } from 'react';

export function useRelogio(ativo: boolean): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}
