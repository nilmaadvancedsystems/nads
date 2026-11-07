// A mesma gravação automática, pedida de novo, só depois de uma espera que dobra a cada vez (07/11/2026). Para os efeitos
// que gravam sozinhos ao ver o estado do banco (a Tarefa segue o Cadastro e o balancete, a Conferência segue o "presta
// serviços", a sobreposição dos extratos sai sozinha): com a gravação negada pelo banco, o snapshot volta sem a mudança
// e o efeito pede de novo; sem trava, foi assim que a Dornas Havana ganhou 2,6 milhões de eventos (05/11/2026). Com ela,
// a mesma chave grava em 0, 1, 3, 7, 15, 31 min... e depois no máximo uma vez por hora.

export interface TravaDeRepeticao {
  /** Pode pedir esta gravação agora? Se pode, já conta o pedido (a próxima vez espera o dobro). */
  (chave: string): boolean;
}

export function criarTravaDeRepeticao(primeiraEsperaMs = 60_000, esperaMaximaMs = 3_600_000, agora: () => number = Date.now): TravaDeRepeticao {
  const pedidas = new Map<string, { quando: number; vezes: number }>();
  return (chave: string) => {
    const t = agora();
    const p = pedidas.get(chave);
    if (p && t - p.quando < Math.min(esperaMaximaMs, primeiraEsperaMs * 2 ** (p.vezes - 1))) return false;
    pedidas.set(chave, { quando: t, vezes: (p?.vezes || 0) + 1 });
    return true;
  };
}
