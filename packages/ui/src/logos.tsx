// Logos de bancos e do Drive. No padrão do app ficam em tons de cinza (a cor do texto, currentColor, em
// opacidades diferentes — certos no tema claro e no escuro); com `cor`, nas cores da marca (ex.: o banco
// cujo extrato já foi importado). O Sicoob e o Drive têm o desenho deles; os outros bancos são um selo
// com a cor e as iniciais da marca (simplificado — trocar pelo logo de verdade quando tiver o arquivo).
/// <reference types="vite/client" />
import { useId } from 'react';
import { Icone } from './icones';

/**
 * Os logos originais (as imagens que o Vitor mandou, 29/09/2026), na pasta logos-bancos/: nome do arquivo = a
 * marca (itau.png, c6.jpg…), e também drive, gmail e whatsapp. Regra do Vitor (30/09/2026): logo com o nome ou o
 * desenho em BRANCO fica com o fundo (Itaú, Stone, Nubank, Bradesco, BTG, C6, Caixa, Cora, Banco do Nordeste); os outros, sem o fundo
 * (as imagens como vieram estão em logos-bancos/originais/). Em cinza até o extrato ser importado, depois
 * coloridos. Sem arquivo, vale o desenho abaixo.
 */
const IMAGENS = import.meta.glob('./logos-bancos/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
import marcaNilma from './marca-nilma.png';

/** O endereço completo do logo da Nilma (o do e-mail), publicado junto com o site. */
export function urlDoLogoNilma(): string {
  return new URL(marcaNilma, window.location.origin).href;
}

/** O endereço completo do logo do banco (null = sem imagem), para usar fora do site (o e-mail). */
export function urlDoLogoBanco(marca: string): string | null {
  const url = imagemDaMarca(marca);
  return url ? new URL(url, window.location.origin).href : null;
}
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

/** Cinza até o arquivo ser importado, como os logos dos bancos. */
const cinzaSeNao = (cor?: boolean) => (cor ? undefined : { filter: 'grayscale(1)', opacity: 0.75 });

/**
 * O logo do INSS (Vitor, 07/10/2026), desenhado a partir da imagem que ele mandou: o oval branco, a meia-lua verde à
 * esquerda, a amarela à direita e o globo azul de quadradinhos no meio.
 */
export function LogoInss({ cor }: { cor?: boolean }) {
  const quadros: [number, number, number][] = [];
  // o globo: quadradinhos numa grade, menores perto da borda (a esfera)
  for (let l = -3; l <= 3; l++) {
    for (let c = -3; c <= 3; c++) {
      const d = Math.hypot(l, c);
      if (d > 3.4) continue;
      const lado = 3.6 * (1 - d / 6);
      quadros.push([50 + c * 4.6 - lado / 2, 35 + l * 4.6 - lado / 2, lado]);
    }
  }
  return (
    <svg viewBox="0 0 100 70" width="100%" height="100%" aria-hidden="true" style={cinzaSeNao(cor)}>
      <ellipse cx="50" cy="35" rx="48" ry="32" fill="#fff" stroke="#d9dde3" strokeWidth="1.5" />
      <path fill="#0A9B3A" d="M40 8 C18 12 6 26 8 40 C10 54 26 62 46 62 C30 54 26 46 30 38 C34 30 30 20 40 8 Z" />
      <path fill="#F6BE2C" d="M60 8 C80 10 94 22 92 36 C90 50 76 60 56 62 C70 54 74 46 70 38 C66 30 70 20 60 8 Z" />
      {quadros.map(([x, y, s], i) => <rect key={i} x={x} y={y} width={s} height={s} rx={0.6} fill="#1D5BBF" />)}
    </svg>
  );
}

/** O logo do FGTS (Vitor, 07/10/2026): as letras em verde e, no F, a bandeirinha (o triângulo amarelo e o azul). */
export function LogoFgts({ cor }: { cor?: boolean }) {
  return (
    <svg viewBox="0 0 120 34" width="100%" height="100%" aria-hidden="true" style={cinzaSeNao(cor)}>
      {/* o F: a barra de cima e o canto com a bandeirinha */}
      <path fill="#0A9B3A" d="M2 4 H28 V10 H10 L2 18 Z" />
      <path fill="#0A9B3A" d="M2 18 L10 10 V30 H2 Z" />
      <path fill="#F6D21C" d="M10 12 V28 L4 28 Z" />
      <path fill="#1C86E0" d="M10 18 A6 6 0 0 0 6 28 H10 Z" />
      <path fill="#0A9B3A" d="M10 15 H24 V21 H10 Z" />
      {/* G */}
      <path fill="none" stroke="#0A9B3A" strokeWidth="6" d="M58 7 H38 V27 H55 V19 H48" />
      {/* T */}
      <path fill="none" stroke="#0A9B3A" strokeWidth="6" d="M62 7 H88 M75 7 V30" />
      {/* S */}
      <path fill="none" stroke="#0A9B3A" strokeWidth="6" d="M117 7 H96 V17 H114 V27 H92" />
    </svg>
  );
}

/*
 * As logos dos órgãos das guias (Vitor, 17/10/2026: "a logo de cada guia no quadradinho"), redesenhadas em SVG a partir
 * das oficiais que o escritório baixou: o símbolo do Simples Nacional (o site do Simples na Receita), o triângulo do
 * Governo de Minas (o site da SEFAZ-MG) e o símbolo da Receita Federal (o SVG do Wikimedia Commons, só o desenho, sem o
 * nome). Sempre coloridas; quem usa dá o tamanho e um fundo claro.
 */

/** O símbolo do Simples Nacional: o círculo verde (à esquerda) e amarelo (à direita), cortado pelo S branco. */
export function LogoSimplesNacional() {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={id + 'v'} x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stopColor="#6DB33F" /><stop offset=".4" stopColor="#8CC63F" /><stop offset="1" stopColor="#0E8D45" /></linearGradient>
        <radialGradient id={id + 'a'} cx=".55" cy=".5" r=".6"><stop offset="0" stopColor="#FFF200" /><stop offset=".6" stopColor="#FFD400" /><stop offset="1" stopColor="#F7B11E" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#FFFFFF" />
      <path fill={'url(#' + id + 'v)'} d="M33 6.2A47 47 0 0 0 22.5 88.2L24.5 73.5C34 79 47 84 56 79C62 74 59 64 49 57C37 48 22 38 23 25C24 15 28 9.5 33 6.2Z" />
      <path fill={'url(#' + id + 'a)'} d="M71 8A47 47 0 0 1 66.5 94L67.5 82.5C72.5 72 68.5 61 60 54C48.5 46 39.5 39.5 40 29C40.5 22 46 19 53 20C60 21 66 19 71 8Z" />
    </svg>
  );
}

/** O triângulo do Governo de Minas: o losango vinho no alto, os dois vermelhos dos lados e o rosa embaixo. */
export function LogoGovernoMinas() {
  return (
    <svg viewBox="0 6 287 198" width="100%" height="100%" aria-hidden="true">
      <path fill="#AE0F0A" d="M143 10 189 74 143 137 97 74Z" />
      <path fill="#E30613" d="M6 201 97 74 143 137 97 201Z" />
      <path fill="#E30613" d="M280 201 189 74 143 137 189 201Z" />
      <path fill="#E4ADB5" d="M143 137 189 201H97Z" />
    </svg>
  );
}

/** O símbolo da Receita Federal, no azul dela (#003772). */
export function LogoReceitaFederal() {
  return (
    <svg viewBox="6 30 1062 708" width="100%" height="100%" aria-hidden="true">
      <path fill="#003772" d="M 530.58 37.59 C 533.62 36.73 536.86 36.07 539.97 37.01 C 613.44 56.24 684.87 82.59 754.71 112.29 C 761.41 115.28 768.34 117.76 774.81 121.25 C 769.46 159.24 763.70 197.18 758.87 235.23 C 765.17 232.28 771.00 228.46 777.10 225.12 C 808.73 207.17 841.08 190.47 874.05 175.10 C 876.93 173.90 880.24 171.46 883.34 173.52 C 938.47 201.08 992.08 231.57 1045.15 262.88 C 1050.82 266.31 1056.61 269.53 1062.14 273.19 C 1044.97 285.67 1027.54 297.81 1010.54 310.54 C 955.57 351.42 902.41 394.74 851.02 440.04 C 847.99 443.19 843.56 440.53 839.98 440.03 C 749.31 419.17 657.92 401.51 566.04 386.90 C 556.84 385.67 547.72 383.73 538.46 383.03 C 541.81 386.28 545.69 388.89 549.49 391.57 C 612.30 437.37 674.14 484.51 734.44 533.57 C 736.28 535.09 738.08 536.66 739.90 538.22 C 732.82 545.71 724.86 552.30 717.61 559.62 C 658.72 615.71 599.76 671.75 540.90 727.89 C 539.58 729.05 538.24 730.19 536.90 731.34 C 531.98 727.55 527.84 722.90 523.38 718.62 C 421.23 620.23 318.12 522.74 211.02 429.71 C 212.81 425.38 214.91 421.19 217.10 417.05 C 245.17 362.01 273.60 307.11 304.68 253.69 C 307.81 248.12 311.56 242.89 314.21 237.06 C 309.00 239.34 304.19 242.40 299.26 245.22 C 241.94 278.25 185.71 313.14 130.40 349.43 C 127.41 351.30 124.66 353.78 121.20 354.75 C 117.90 352.84 115.17 350.11 112.18 347.78 C 82.58 324.08 51.92 301.73 20.67 280.27 C 17.60 278.18 14.56 276.05 11.59 273.81 C 17.89 269.17 24.95 265.72 31.59 261.59 C 120.12 209.41 210.77 160.62 304.56 118.53 C 308.49 116.71 312.50 114.56 316.96 114.59 C 382.69 114.66 448.42 117.20 513.97 122.03 C 520.56 122.40 527.13 123.40 533.74 123.08 C 531.86 121.93 529.94 120.85 527.92 119.98 C 489.08 104.11 449.66 89.67 409.86 76.41 C 415.90 73.60 422.36 71.89 428.62 69.67 C 462.37 58.23 496.17 46.89 530.58 37.59 M 534.23 125.09 C 477.94 149.96 422.77 177.35 368.59 206.52 C 351.01 216.19 333.25 225.58 316.00 235.83 C 320.29 238.66 324.75 241.21 329.17 243.83 C 366.66 266.27 403.36 290.00 439.57 314.43 C 472.47 336.49 504.70 359.53 537.04 382.39 C 542.35 379.00 547.31 375.12 552.46 371.50 C 615.26 326.59 679.11 283.03 745.45 243.47 C 749.70 240.97 754.10 238.68 758.01 235.63 C 688.25 193.33 615.21 156.48 539.97 124.98 C 538.12 124.09 536.04 124.16 534.23 125.09 Z" />
      <path fill="#003772" d="M 514.47 164.61 C 539.32 162.32 564.63 163.87 588.81 170.21 C 604.32 174.25 619.38 180.39 632.77 189.26 C 642.23 195.59 650.86 203.47 656.70 213.32 C 662.74 223.43 665.44 235.89 662.43 247.44 C 659.14 261.09 649.70 272.35 638.87 280.86 C 622.29 293.67 602.34 301.44 582.02 305.97 C 548.61 313.32 513.36 312.59 480.33 303.63 C 460.27 298.07 440.71 288.98 425.48 274.51 C 415.31 264.38 407.49 250.68 408.14 235.93 C 408.51 220.27 417.88 206.35 429.46 196.46 C 453.19 176.61 484.19 167.81 514.47 164.61 Z" />
    </svg>
  );
}

/** A cor que predomina na marca de cada banco (a mesma chave do logo). */
const COR_DA_MARCA: Record<string, string> = {
  sicoob: '#00AE9D', 'banco-do-brasil': '#FCFC30', itau: '#EC7000', bradesco: '#CC092F', santander: '#EC0000', caixa: '#005CA9',
  nubank: '#820AD1', inter: '#FF7A00', c6: '#242424', btg: '#001E62', stone: '#00A868', cora: '#FE3E6D', sicredi: '#3FA110',
  safra: '#1C2A55', banrisul: '#004B8D', bnb: '#A6193C', 'mercado-pago': '#00B1EA', pagbank: '#1BB99A',
};

/**
 * O fundo pastel do banco, bem suave (Vitor, 15/10/2026: "uma corzinha pastel, da cor predominante do banco"): a cor da
 * marca misturada com a superfície (certa no tema claro e no escuro). Banco sem cor: undefined.
 */
export function fundoSuaveDoBanco(marca: string): string | undefined {
  const cor = COR_DA_MARCA[marca];
  return cor ? 'color-mix(in srgb, ' + cor + ' ' + (marca === 'banco-do-brasil' ? 30 : 16) + '%, var(--surface))' : undefined;
}
