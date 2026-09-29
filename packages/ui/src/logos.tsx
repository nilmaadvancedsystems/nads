// Logos de bancos e do Drive no padrão do app: em tons de cinza (preto e branco), com a cor do texto
// (currentColor) em opacidades diferentes — ficam certos no tema claro e no escuro. Banco sem logo aqui
// mostra o ícone de banco.
import { Icone } from './icones';

/** Sicoob: o triângulo de três partes, com o triângulo vazado no meio. */
function Sicoob() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth={3}>
      <path d="M8 22 H43 L51 35 L43 52.6 H27 Z" fillOpacity={0.6} strokeOpacity={0.6} />
      <path d="M43 22 H92 L73 52.6 H59 L51 35 Z" fillOpacity={0.35} strokeOpacity={0.35} />
      <path d="M27 52.6 H73 L50 90 Z" fillOpacity={0.9} strokeOpacity={0.9} />
    </svg>
  );
}

/** Google Drive: as três faixas do triângulo, em cinzas diferentes. */
function Drive() {
  return (
    <svg viewBox="0 0 87.3 78" aria-hidden="true" fill="currentColor">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fillOpacity={0.55} />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fillOpacity={0.75} />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fillOpacity={0.45} />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fillOpacity={0.9} />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fillOpacity={0.6} />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fillOpacity={0.35} />
    </svg>
  );
}

const BANCOS: Record<string, () => React.JSX.Element> = { sicoob: Sicoob };

/** O logo do banco (id da marca), ou o ícone de banco quando não tem logo aqui. */
export function LogoBanco({ banco }: { banco: string }) {
  const L = BANCOS[banco];
  return L ? <L /> : <Icone nome="landmark" />;
}

export function LogoDrive() {
  return <Drive />;
}
