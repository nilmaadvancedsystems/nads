// Os ícones da Central dos robôs: os do nads (@nads/ui Icone) e dois desenhados aqui, no mesmo traço (servidor e nuvem,
// que o nads não tinha). Todo ícone sai com tamanho explícito (width/height), nunca do tamanho que o navegador quiser.
import { Icone } from '@nads/ui';
import type { ComponentProps } from 'react';

type NomeDoNads = ComponentProps<typeof Icone>['nome'];

const PROPRIOS: Record<string, string> = {
  servidor: '<rect x="4" y="3.5" width="16" height="7" rx="1.8"/><rect x="4" y="13.5" width="16" height="7" rx="1.8"/><path d="M8 7h.01"/><path d="M8 17h.01"/><path d="M12 7h4"/><path d="M12 17h4"/>',
  nuvem: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5Z"/>',
  pausa: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 9.5 3 2.5-3 2.5"/><path d="M12.5 15h4.5"/>',
};

export function IconeDoRobo({ nome, tamanho = 24, className }: { nome: string; tamanho?: number; className?: string }) {
  const proprio = PROPRIOS[nome];
  if (proprio) {
    return (
      <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: proprio }} />
    );
  }
  return <Icone nome={nome as NomeDoNads} width={tamanho} height={tamanho} className={className} />;
}
