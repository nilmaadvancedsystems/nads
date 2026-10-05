// Tema claro / escuro / sistema, guardado no navegador de cada pessoa.
// Origem: conferencia.html applyTheme (~L1378) e o seletor .theme-toggle.
import { useEffect, useState } from 'react';
import { Icone } from './icones';

export type Tema = 'light' | 'dark' | 'system';
const CHAVE = 'nads-tema';

function lerTema(): Tema {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function aplicar(t: Tema) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

let atual: Tema = typeof document === 'undefined' ? 'system' : lerTema();
const ouvintes = new Set<(t: Tema) => void>();
// Ao abrir, só impõe o tema se a pessoa escolheu um; em "sistema" deixa como a página veio
// (quem hospeda pode já ter marcado claro/escuro).
if (typeof document !== 'undefined' && atual !== 'system') aplicar(atual);
// Trocou o tema em outra página do mesmo site (a Tarefas, com a ferramenta da etapa dentro dela): esta segue junto.
// Sem isso, a ferramenta embutida ficava no tema de quando abriu (Vitor, 05/10/2026: a Tarefas clara e o Creditor escuro).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== CHAVE) return;
    atual = lerTema();
    aplicar(atual);
    for (const f of ouvintes) f(atual);
  });
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(atual);
  useEffect(() => { ouvintes.add(setTema); return () => { ouvintes.delete(setTema); }; }, []);
  const mudar = (t: Tema) => {
    atual = t;
    aplicar(t);
    try { localStorage.setItem(CHAVE, t); } catch { /* navegador sem storage: vale só agora */ }
    for (const f of ouvintes) f(t);
  };
  return [tema, mudar];
}

export function SeletorTema() {
  const [tema, mudar] = useTema();
  const opcoes: { t: Tema; icone: 'sun' | 'moon' | 'monitor'; rotulo: string; titulo: string }[] = [
    { t: 'light', icone: 'sun', rotulo: 'Tema claro', titulo: 'Claro' },
    { t: 'dark', icone: 'moon', rotulo: 'Tema escuro', titulo: 'Escuro' },
    { t: 'system', icone: 'monitor', rotulo: 'Seguir o sistema', titulo: 'Sistema' },
  ];
  return (
    <div className="theme-toggle" role="group" aria-label="Tema">
      {opcoes.map(o => (
        <button key={o.t} type="button" className={tema === o.t ? 'active' : undefined} aria-label={o.rotulo} title={o.titulo} onClick={() => mudar(o.t)}>
          <Icone nome={o.icone} />
        </button>
      ))}
    </div>
  );
}
