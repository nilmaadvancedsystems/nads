// O Início novo (Vitor, 13/11/2026: "Quero repaginar essa pagina de tarefas, mas quero que ela seja publicada somente no modo
// desenvolvedor"): a novidade 'inicio-novo' (comum/novidades.ts), só com o modo desenvolvedor ligado "até eu testar tudo".
// Por enquanto é o de hoje com a faixa em cima; o visual novo o Vitor ainda vai mandar.
import { Alerta } from '@nads/ui';
import type { ReactNode } from 'react';

export function InicioNovo({ deHoje }: { deHoje: ReactNode }) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Alerta naLinha titulo="Início novo" texto="Só no modo desenvolvedor, até o Vitor testar tudo. Com o modo desligado, aparece o Início de hoje." />
      </div>
      {deHoje}
    </>
  );
}
