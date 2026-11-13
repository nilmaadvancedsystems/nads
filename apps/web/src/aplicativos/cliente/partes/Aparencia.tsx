// A aparência da Área do Cliente (13/11/2026): Claro e Escuro para todos ("deixa escuro e claro apenas") e o OLED (o escuro
// com o preto puro) só no modo desenvolvedor do nads ("a OLED fica para dev"), num segmentado no pé do menu. Claro e
// escuro usam o tema do nads (useTema); o OLED liga o escuro e o data-oled. O modo dev é a marca data-dev no <html> (o
// nads põe ao ligar): o site do cliente nunca tem, e a Área do Cliente não leva o módulo do modo dev da equipe.
import { Icone, useTema } from '@nads/ui';
import { useState, useSyncExternalStore } from 'react';
import { aplicarOled, guardarOled, lerOled } from '../dados/aparencia';

const emModoDev = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-dev');
function assinarModoDev(aoMudar: () => void) {
  const o = new MutationObserver(aoMudar);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dev'] });
  return () => o.disconnect();
}
const escuroNoSistema = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

// já ao carregar, antes de desenhar: o preto puro só com o modo dev (sem piscar o cinza antes do preto)
aplicarOled(lerOled() && emModoDev());

type Opcao = 'light' | 'dark' | 'oled';

export function Aparencia({ recolhida }: { recolhida?: boolean }) {
  const [tema, mudarTema] = useTema();
  const dev = useSyncExternalStore(assinarModoDev, emModoDev, () => false);
  const [oledGuardado, setOled] = useState(lerOled);
  const oled = oledGuardado && dev;
  // desligou o modo dev com o OLED escolhido: volta ao escuro normal
  if (!dev && typeof document !== 'undefined' && document.documentElement.hasAttribute('data-oled')) aplicarOled(false);
  const atual: Opcao = oled ? 'oled' : tema === 'system' ? (escuroNoSistema() ? 'dark' : 'light') : tema;
  const escolher = (o: Opcao) => {
    const ligar = o === 'oled';
    setOled(ligar);
    guardarOled(ligar);
    aplicarOled(ligar);
    mudarTema(ligar ? 'dark' : o);
  };
  const opcoes: { id: Opcao; titulo: string; icone?: 'sun' | 'moon' }[] = [
    { id: 'light', titulo: 'Claro', icone: 'sun' },
    { id: 'dark', titulo: 'Escuro', icone: 'moon' },
    ...(dev ? [{ id: 'oled' as const, titulo: 'OLED (preto puro) · só no modo desenvolvedor' }] : []),
  ];
  return (
    <div className={'cli-aparencia' + (recolhida ? ' recolhida' : '')}>
      {!recolhida && <span className="cli-aparencia-rotulo">Aparência</span>}
      <div className="cli-aparencia-opcoes" role="radiogroup" aria-label="Aparência" style={{ gridTemplateColumns: recolhida ? undefined : 'repeat(' + opcoes.length + ', minmax(0, 1fr))' }}>
        {opcoes.map(o => (
          <button key={o.id} type="button" role="radio" aria-checked={atual === o.id} title={o.titulo} aria-label={o.titulo}
            className={'cli-aparencia-opcao' + (atual === o.id ? ' ativa' : '')} onClick={() => escolher(o.id)}>
            {o.icone ? <><Icone nome={o.icone} width={15} height={15} />{!recolhida && <span className="cli-aparencia-nome">{o.titulo}</span>}</> : <span className="cli-aparencia-oled" aria-hidden="true">OLED</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
