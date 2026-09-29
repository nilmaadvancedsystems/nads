// Logos de bancos e do Drive. No padrão do app ficam em tons de cinza (a cor do texto, currentColor, em
// opacidades diferentes — certos no tema claro e no escuro); com `cor`, nas cores da marca (ex.: o banco
// cujo extrato já foi importado). O Sicoob e o Drive têm o desenho deles; os outros bancos são um selo
// com a cor e as iniciais da marca (simplificado — trocar pelo logo de verdade quando tiver o arquivo).
import { Icone } from './icones';

/** Sicoob: o triângulo de três partes, com o triângulo vazado no meio. */
function Sicoob({ cor }: { cor?: boolean }) {
  const parte = (d: string, cheia: string, opacidade: number) => (
    <path d={d} fill={cor ? cheia : 'currentColor'} stroke={cor ? cheia : 'currentColor'} fillOpacity={cor ? 1 : opacidade} strokeOpacity={cor ? 1 : opacidade} />
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" strokeLinejoin="round" strokeWidth={3}>
      {parte('M8 22 H43 L51 35 L43 52.6 H27 Z', '#7AB929', 0.6)}
      {parte('M43 22 H92 L73 52.6 H59 L51 35 Z', '#00A69C', 0.35)}
      {parte('M27 52.6 H73 L50 90 Z', '#C8D400', 0.9)}
    </svg>
  );
}

/** [fundo, texto, iniciais] de cada marca. */
const SELOS: Record<string, [string, string, string]> = {
  'banco-do-brasil': ['#FCF800', '#005AA5', 'BB'],
  banrisul: ['#004B8D', '#FFFFFF', 'B'],
  bradesco: ['#CC092F', '#FFFFFF', 'b'],
  btg: ['#0D1D48', '#FFFFFF', 'btg'],
  c6: ['#1D1D1B', '#FFFFFF', 'C6'],
  caixa: ['#005CA9', '#F39200', 'X'],
  cora: ['#FE3E6D', '#FFFFFF', 'c'],
  inter: ['#FF7A00', '#FFFFFF', 'in'],
  itau: ['#EC7000', '#003399', 'itaú'],
  'mercado-pago': ['#00B1EA', '#FFFFFF', 'mp'],
  nubank: ['#820AD1', '#FFFFFF', 'nu'],
  pagbank: ['#26262E', '#C4E538', 'pb'],
  safra: ['#0C2340', '#C9A96E', 'S'],
  santander: ['#EC0000', '#FFFFFF', 'S'],
  sicredi: ['#3FA110', '#FFFFFF', 's'],
  stone: ['#00A868', '#FFFFFF', 'st'],
};

function Selo({ marca, cor }: { marca: string; cor?: boolean }) {
  const [fundo, texto, iniciais] = SELOS[marca];
  const tamanho = iniciais.length === 1 ? 58 : iniciais.length === 2 ? 46 : iniciais.length === 3 ? 36 : 30;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="22" fill={cor ? fundo : 'currentColor'} fillOpacity={cor ? 1 : 0.18} />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="inherit" fontWeight={800} fontSize={tamanho} letterSpacing={-1}
        fill={cor ? texto : 'currentColor'} fillOpacity={cor ? 1 : 0.85}>{iniciais}</text>
    </svg>
  );
}

/** Google Drive: as três faixas do triângulo (cinzas diferentes, ou as cores do Drive). */
function Drive({ cor }: { cor?: boolean }) {
  const faixa = (d: string, cheia: string, opacidade: number) => <path d={d} fill={cor ? cheia : 'currentColor'} fillOpacity={cor ? 1 : opacidade} />;
  return (
    <svg viewBox="0 0 87.3 78" aria-hidden="true">
      {faixa('m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z', '#0066DA', 0.55)}
      {faixa('m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z', '#00AC47', 0.75)}
      {faixa('m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z', '#EA4335', 0.45)}
      {faixa('m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z', '#00832D', 0.9)}
      {faixa('m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z', '#2684FC', 0.6)}
      {faixa('m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z', '#FFBA00', 0.35)}
    </svg>
  );
}

/** O logo do banco (a marca: 'sicoob', 'itau'…), em cinza ou, com `cor`, colorido. Sem logo: o ícone de banco. */
export function LogoBanco({ banco, cor }: { banco: string; cor?: boolean }) {
  if (banco === 'sicoob') return <Sicoob cor={cor} />;
  if (SELOS[banco]) return <Selo marca={banco} cor={cor} />;
  return <Icone nome="landmark" />;
}

export function LogoDrive({ cor }: { cor?: boolean }) {
  return <Drive cor={cor} />;
}
