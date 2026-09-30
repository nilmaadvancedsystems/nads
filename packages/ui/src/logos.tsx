// Logos de bancos e do Drive. No padrão do app ficam em tons de cinza (a cor do texto, currentColor, em
// opacidades diferentes — certos no tema claro e no escuro); com `cor`, nas cores da marca (ex.: o banco
// cujo extrato já foi importado). O Sicoob e o Drive têm o desenho deles; os outros bancos são um selo
// com a cor e as iniciais da marca (simplificado — trocar pelo logo de verdade quando tiver o arquivo).
/// <reference types="vite/client" />
import { Icone } from './icones';

/**
 * Os logos originais (as imagens que o Vitor mandou, 29/09/2026), na pasta logos-bancos/: nome do arquivo = a
 * marca (itau.png, c6.jpg…), e também drive, gmail e whatsapp. Regra do Vitor (30/09/2026): logo com o nome ou o
 * desenho em BRANCO fica com o fundo (Itaú, Stone, Nubank, Bradesco, BTG, C6, Caixa); os outros, sem o fundo
 * (as imagens como vieram estão em logos-bancos/originais/). Em cinza até o extrato ser importado, depois
 * coloridos. Sem arquivo, vale o desenho abaixo.
 */
const IMAGENS = import.meta.glob('./logos-bancos/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
function imagemDaMarca(marca: string): string | null {
  for (const [caminho, url] of Object.entries(IMAGENS)) if (caminho.replace(/^.*\//, '').replace(/\.[^.]+$/, '') === marca) return url;
  return null;
}

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
 * Banrisul, Bradesco, BTG Pactual, C6, Caixa, PagBank, Mercado Pago e Safra. Em cinza, o mesmo desenho em
 * tons de cinza.
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
  pagbank: cor => (
    <svg viewBox="0 0 300 300" aria-hidden="true" style={cinza(cor)}>
      <defs><clipPath id="clipPagbank"><circle cx="150" cy="150" r="136" /></clipPath></defs>
      <circle cx="150" cy="150" r="146" fill="#111111" />
      <g clipPath="url(#clipPagbank)" stroke="#111111" strokeWidth="10">
        <circle cx="152" cy="118" r="108" fill="#D6E14A" />
        <circle cx="122" cy="190" r="84" fill="#56D9DD" />
        <circle cx="210" cy="192" r="56" fill="#FFD400" />
      </g>
    </svg>
  ),
  'mercado-pago': cor => (
    <svg viewBox="0 0 240 240" aria-hidden="true" style={cinza(cor)}>
      <ellipse cx="120" cy="120" rx="100" ry="68" fill="#41C3F0" stroke="#1B2A78" strokeWidth="7" />
      <path d="M26 118 C60 100 88 96 110 104 L134 94 C158 88 184 98 214 116" fill="none" stroke="#1B2A78" strokeWidth="5" />
      <path d="M50 116 C74 102 94 100 112 108 L136 98 C154 94 174 100 190 112 L178 140 C160 152 138 156 116 148 C98 142 80 134 62 130 Z"
        fill="#FFFFFF" stroke="#1B2A78" strokeWidth="5" strokeLinejoin="round" />
      <path d="M112 108 L128 124 M104 124 L118 138 M92 124 L104 136 M126 118 L150 132" fill="none" stroke="#1B2A78" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  safra: cor => (
    <svg viewBox="0 0 180 180" aria-hidden="true" style={cinza(cor)}>
      <rect width="180" height="180" rx="40" fill="#FFFFFF" />
      <path d="M36 26 Q90 12 144 26 L144 104 Q144 146 90 166 Q36 146 36 104 Z" fill="#FFFFFF" stroke="#1C2A55" strokeWidth="7" strokeLinejoin="round" />
      <path d="M46 36 Q90 24 134 36 L134 102 Q134 138 90 154 Q46 138 46 102 Z" fill="none" stroke="#1C2A55" strokeWidth="2" />
      <text x="90" y="100" textAnchor="middle" dominantBaseline="central" fontFamily="Georgia, 'Times New Roman', serif" fontSize="74" fontStyle="italic" fill="#1C2A55">JS</text>
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
  sicredi: ['#3FA110', '#FFFFFF', 's'],
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
  const imagem = imagemDaMarca(banco);
  // o logo original: em cinza até o extrato ser importado, depois colorido
  if (imagem) return <img src={imagem} alt="" aria-hidden="true" className={'logo-img' + (cor ? '' : ' cinza')} />;
  if (banco === 'sicoob') return <Sicoob cor={cor} />;
  if (DESENHOS[banco]) return DESENHOS[banco](cor);
  if (SELOS[banco]) return <Selo marca={banco} cor={cor} />;
  return <Icone nome="landmark" />;
}

/**
 * Baixa antes os logos dos botões que só aparecem num menu (Pedir extrato → Gmail/WhatsApp) e o do Drive:
 * a tela chama ao abrir, e no clique eles já estão prontos, sem atraso.
 */
export function preCarregarLogosDosApps() {
  for (const m of ['gmail', 'whatsapp', 'drive']) {
    const url = imagemDaMarca(m);
    if (!url) continue;
    const img = new Image();
    img.src = url;
    void img.decode().catch(() => undefined);
  }
}

/** Gmail (o "M" do Google). */
export function LogoGmail() {
  const imagem = imagemDaMarca('gmail');
  if (imagem) return <img src={imagem} alt="" aria-hidden="true" className="logo-img app" />;
  return (
    <svg viewBox="0 0 256 193" aria-hidden="true">
      <path fill="#4285F4" d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z" />
      <path fill="#34A853" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798z" />
      <path fill="#EA4335" d="m58.182 93.14-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.669 34.992-4.669 40.644L128 145.504z" />
      <path fill="#FBBC04" d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z" />
      <path fill="#C5221F" d="m0 49.504 26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23z" />
    </svg>
  );
}

/** WhatsApp (o balão com o telefone). */
export function LogoWhatsApp() {
  const imagem = imagemDaMarca('whatsapp');
  if (imagem) return <img src={imagem} alt="" aria-hidden="true" className="logo-img app" />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function LogoDrive({ cor }: { cor?: boolean }) {
  const imagem = imagemDaMarca('drive');
  if (imagem) return <img src={imagem} alt="" aria-hidden="true" className={'logo-img app' + (cor ? '' : ' cinza')} />;
  return <Drive cor={cor} />;
}
