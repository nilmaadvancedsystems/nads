// Uma leitura grande que sobrevive à atualização de versão (09/11/2026). Cada versão publicada recarrega todas as abas, e o
// nads sem cache local relia tudo: só os clientes do Entregas (396 documentos) eram quase metade de cada recarga. Guarda no
// sessionStorage da aba, por conta e por pouco tempo, e só é usado quando a recarga veio da versão nova: F5 lê do banco.
// Sem espaço (ou sem sessionStorage), não guarda e lê do banco, como antes.
type Guardado<T> = { dono: string; em: number; valor: T };
type Armazenamento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface CacheDaAtualizacao<T> { ler(dono: string): T | null; guardar(dono: string, valor: T): void }

export function criarCacheDaAtualizacao<T>(
  chave: string, validadeMs: number, loja: () => Armazenamento = () => sessionStorage, agora: () => number = Date.now,
): CacheDaAtualizacao<T> {
  return {
    ler(dono) {
      try {
        const bruto = loja().getItem(chave);
        if (!bruto) return null;
        const g = JSON.parse(bruto) as Guardado<T>;
        const idade = agora() - g.em;
        return g.dono === dono && idade >= 0 && idade < validadeMs ? g.valor : null;
      } catch { return null; }
    },
    guardar(dono, valor) {
      try { loja().setItem(chave, JSON.stringify({ dono, em: agora(), valor } satisfies Guardado<T>)); }
      catch { try { loja().removeItem(chave); } catch { /* sem sessionStorage: segue sem guardar */ } }
    },
  };
}
