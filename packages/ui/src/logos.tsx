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

/**
 * Os logos de verdade (redesenhados a partir das imagens que o Vitor mandou, 29/09/2026): Banco do Brasil,
 * Banrisul, Bradesco, BTG Pactual, C6 e Caixa. Em cinza, o mesmo desenho em tons de cinza.
 */
const cinza = (cor?: boolean) => (cor ? undefined : { filter: 'grayscale(1)', opacity: 0.6 });

const DESENHOS: Record<string, (cor?: boolean) => React.JSX.Element> = {
  'banco-do-brasil': cor => (
    <svg viewBox="0 0 512 512" aria-hidden="true" style={cinza(cor)}>
      <rect width="512" height="512" rx="110" fill="#FCFC30" />
      <g fill="#465EFF">
        <path d="M115 210 L258 115 L343 170 L300 198 L258 170 L175 226 Z" />
        <path d="M343 152 L398 115 L398 142 L366 163 Z" />
        <path d="M205 172 L245 146 L395 243 L300 305 L258 278 L300 250 Z" />
        <path d="M307 340 L165 243 L208 215 L258 250 L342 305 Z" />
        <path d="M397 302 L254 397 L170 342 L212 314 L254 342 L337 286 Z" />
        <path d="M169 360 L114 397 L114 370 L146 349 Z" />
      </g>
    </svg>
  ),
  banrisul: cor => (
    <svg viewBox="0 0 447 447" aria-hidden="true" style={cinza(cor)} fill="none" strokeWidth="22" strokeLinejoin="round">
      <rect width="447" height="447" rx="96" fill="#02004F" />
      <path d="M142 160 L182 90 L262 90 L302 160 L262 230 L182 230 Z" stroke="#5B8CFF" />
      <path d="M82 270 L122 200 L202 200 L242 270 L202 340 L122 340 Z" stroke="#9F7BFF" />
      <path d="M212 270 L252 200 L332 200 L372 270 L332 340 L252 340 Z" stroke="#27D6C8" />
    </svg>
  ),
  bradesco: cor => (
    <svg viewBox="0 0 512 512" aria-hidden="true" style={cinza(cor)}>
      <defs>
        <linearGradient id="gradBradesco" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B21E7F" /><stop offset="1" stopColor="#FF0035" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="110" fill="url(#gradBradesco)" />
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="20">
        <path d="M186 326 C112 262 118 146 228 116 C296 98 356 110 374 132" />
        <path d="M70 190 C170 162 318 160 368 224 C396 262 370 300 334 324" />
      </g>
      <g fill="#FFFFFF">
        <rect x="230" y="340" width="20" height="94" rx="3" />
        <path d="M262 334 L300 304 L300 434 L262 434 Z" />
      </g>
    </svg>
  ),
  btg: cor => (
    <svg viewBox="0 0 512 512" aria-hidden="true" style={cinza(cor)}>
      <rect width="512" height="512" rx="110" fill="#070B18" />
      <path d="M404 352 A188 188 0 1 1 438 240" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <text x="300" y="302" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="168" letterSpacing="-6" fill="#FFFFFF">btg</text>
    </svg>
  ),
  c6: cor => (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={cinza(cor)}>
      <rect width="100" height="100" rx="22" fill="#121212" />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black, Arial, Helvetica, sans-serif" fontWeight="900" fontSize="42" letterSpacing="-2" fill="#FAFAFA">C6</text>
    </svg>
  ),
  caixa: cor => (
    <svg viewBox="0 0 250 250" aria-hidden="true" style={cinza(cor)}>
      <rect width="250" height="250" rx="54" fill="#0B47C9" />
      <path d="M180 48 L228 48 L166 120 L118 120 Z" fill="#F37021" />
      <path d="M130 130 L178 130 L116 202 L68 202 Z" fill="#F37021" />
      <path d="M70 48 L120 48 L150 120 L100 120 Z" fill="#FFFFFF" />
      <path d="M126 130 L176 130 L206 202 L156 202 Z" fill="#FFFFFF" />
    </svg>
  ),
};

/** [fundo, texto, iniciais] das marcas sem logo aqui ainda (selo simplificado). */
const SELOS: Record<string, [string, string, string]> = {
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
  if (DESENHOS[banco]) return DESENHOS[banco](cor);
  if (SELOS[banco]) return <Selo marca={banco} cor={cor} />;
  return <Icone nome="landmark" />;
}

export function LogoDrive({ cor }: { cor?: boolean }) {
  return <Drive cor={cor} />;
}
