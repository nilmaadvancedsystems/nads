// Quem entra na Central e o que pode fazer nela. O admin entra sempre; os outros precisam de um papel em robosPermissoes (sem
// papel, sem acesso, como antes). Aqui é só para desenhar a tela: quem manda de verdade é a regra do banco e o robô.
import { robos as r } from '@nads/core';
import { createContext, useContext, useEffect, useState } from 'react';
import { ajustesDaCentral } from '../dados/repo';

export const PermissaoContext = createContext<r.PermissaoNaCentral>(r.SEM_PERMISSAO);
export const usePermissao = () => useContext(PermissaoContext);

/** null enquanto não sabe. Falha ao ler = sem acesso (nunca o contrário). */
export function useAcesso(nome: string | null, admin: boolean): r.PermissaoNaCentral | null {
  const [lido, setLido] = useState<{ chave: string; p: r.PermissaoNaCentral } | null>(null);
  const chave = (nome || '') + '|' + admin;
  useEffect(() => {
    if (!nome) return undefined;
    let vivo = true;
    ajustesDaCentral().minhaPermissao({ nome, admin })
      .then(p => { if (vivo) setLido({ chave, p }); })
      .catch(() => { if (vivo) setLido({ chave, p: admin ? r.TODA_PERMISSAO : r.SEM_PERMISSAO }); });
    return () => { vivo = false; };
  }, [nome, admin, chave]);
  return lido && lido.chave === chave ? lido.p : null;
}
