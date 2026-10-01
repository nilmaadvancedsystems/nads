// Ícones do nads (traço 1,75). Mapa copiado de conferencia.html ICONS (~L1335, L1673-1677).
import type { SVGProps } from 'react';

const ICONS = {
  relatorio: '<path d="M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z"/><path d="M14.5 2.5v5h5"/><path d="M8.5 18v-2"/><path d="M12 18v-5"/><path d="M15.5 18v-3.5"/>',
  checklist: '<path d="m3.5 6.5 1.5 1.5 3-3"/><path d="m3.5 12.5 1.5 1.5 3-3"/><path d="m3.5 18.5 1.5 1.5 3-3"/><path d="M11.5 7h9"/><path d="M11.5 13h9"/><path d="M11.5 19h9"/>',
  briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/><path d="M2.5 12.5h19"/>',
  fileDown: '<path d="M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z"/><path d="M14.5 2.5v5h5"/><path d="M12 11v6"/><path d="m9.5 14.5 2.5 2.5 2.5-2.5"/>',
  fileUp: '<path d="M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z"/><path d="M14.5 2.5v5h5"/><path d="M12 17v-6"/><path d="m9.5 13.5 2.5-2.5 2.5 2.5"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  pasta: '<path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  envelope: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  arquivo: '<path d="M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z"/><path d="M14.5 2.5v5h5"/>',
  robo: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.5" r="1"/><path d="M9 13h.01"/><path d="M15 13h.01"/><path d="M9.5 16.5h5"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-6h4v6"/>',
  landmark: '<path d="M3 21h18"/><path d="M5 21v-8.5"/><path d="M19 21v-8.5"/><path d="M9.5 21v-8.5"/><path d="M14.5 21v-8.5"/><path d="M2.5 9 12 3l9.5 6Z"/>',
  link: '<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.8 4.7a4.3 4.3 0 0 1 6.1 6.1L17 12.6"/><path d="M13 17.5l-1.8 1.8a4.3 4.3 0 0 1-6.1-6.1L7 11.4"/>',
  arrowDown: '<path d="M12 4v13"/><path d="m6 12 6 6 6-6"/>',
  arrowUp: '<path d="M12 20V7"/><path d="m6 12 6-6 6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.3 12.3 2.6 2.6 5-5.2"/>',
  scale: '<path d="M12 3v18"/><path d="M7 21h10"/><path d="m4 8 4-4 4 4"/><path d="M2.5 13a3.5 3.5 0 0 0 7 0L6 7Z"/><path d="M14.5 13a3.5 3.5 0 0 0 7 0L18 7Z"/>',
  alert: '<path d="M10.6 3.8a1.6 1.6 0 0 1 2.8 0l8.4 14.6a1.6 1.6 0 0 1-1.4 2.4H3.6a1.6 1.6 0 0 1-1.4-2.4L10.6 3.8Z"/><path d="M12 9.5v4.2"/><path d="M12 17.2h.01"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.5-2"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5"/><path d="M12 19.5V22"/><path d="M4.9 4.9l1.8 1.8"/><path d="M17.3 17.3l1.8 1.8"/><path d="M2 12h2.5"/><path d="M19.5 12H22"/><path d="M4.9 19.1l1.8-1.8"/><path d="M17.3 6.7l1.8-1.8"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="1.8"/><path d="M8 20.5h8"/><path d="M12 16.5v4"/>',
  upload: '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
  ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  fileText: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  chevronsLeft: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  barChart: '<path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/>',
  // o triângulo do GitHub (octicon triangle-down), o mesmo da seta dos <select> no nads.css
  caretDown: '<path transform="scale(1.5)" fill="currentColor" stroke="none" d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/>',
  play: '<path d="M7 4.5v15l12-7.5Z"/>',
  filtro: '<path d="M3 5.5h18"/><path d="M6.5 12h11"/><path d="M10 18.5h4"/>',
  ordenar: '<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/>',
  copiar: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  fileSearch: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3v5h5"/><path d="M19 8v2.5"/><circle cx="16" cy="16" r="3"/><path d="m21 21-2.8-2.8"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  /** a pasta aberta (a da árvore, quando ela está expandida): a do GitHub (Octicons file-directory-open-fill, MIT), cheia */
  pastaAberta: '<path transform="scale(1.5)" fill="currentColor" stroke="none" d="M.513 1.513A1.75 1.75 0 0 1 1.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 0 0 .2.1H13a1 1 0 0 1 1 1v.5H2.75a.75.75 0 0 0 0 1.5h11.978a1 1 0 0 1 .994 1.117L15 13.25A1.75 1.75 0 0 1 13.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75c0-.464.184-.91.513-1.237Z"/>',
  /** os três pontinhos (mais ações), como o do GitHub */
  mais: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  // duas setas em círculo, uma atrás da outra (o "atualizando" que gira)
  girar: '<path d="M3 12a9 9 0 0 1 15.4-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.4 6.4L3 16"/><path d="M3 21v-5h5"/>',
  maximizar: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
  minimizar: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>',
  painel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m16 10-2 2 2 2"/>',
  // do Conciliadorzinho (mesmo traço 1,75)
  cartao: '<path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11Z"/><path d="M2 9.5h20"/><path d="M6 14.5h4"/>',
  download: '<path d="M12 3.5v11.8"/><path d="m7 10.8 5 5 5-5"/><path d="M5 20.5h14"/>',
  grade: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  impressora: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
} as const;

export type NomeIcone = keyof typeof ICONS;

/** <Icone nome="upload" /> — SVG de traço, na cor do texto. */
export function Icone({ nome, ...resto }: { nome: NomeIcone } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...resto} dangerouslySetInnerHTML={{ __html: ICONS[nome] }} />
  );
}

const CAMINHO_N = 'M2,40 C2,0 18,5 40,30 L490,482 C508,498 515,505 515,522 L515,640 C515,662 510,668 490,648 L165,322 C140,295 120,270 118,292 L118,738 C118,758 122,764 140,780 L218,858 C228,868 230,872 230,890 L230,1010 C230,1032 222,1030 200,1008 L12,818 C4,810 2,806 2,792 Z';

/** Gradientes da marca (vão uma vez no topo da página). */
export function DefsMarca() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nlRed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8F2429" /><stop offset=".45" stopColor="#D8323A" /><stop offset="1" stopColor="#93262B" /></linearGradient>
        <linearGradient id="nlSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6E6E73" /><stop offset=".5" stopColor="#D4D4D8" /><stop offset="1" stopColor="#7A7A7F" /></linearGradient>
      </defs>
    </svg>
  );
}

/** O "N" da Nilma. */
/**
 * A abertura do app (enquanto carrega): o N grande no meio da tela; as duas metades (a vermelha e a prata) entram de
 * lados opostos e se encaixam, e depois o N respira de leve até a tela abrir. Sem movimento para quem pediu menos.
 */
/** vidro: por cima de uma área que está carregando (o fundo embaçado, e não a tela toda) */
export function AberturaN({ vidro }: { vidro?: boolean } = {}) {
  return (
    <div className={'abertura' + (vidro ? ' vidro' : '')} role="status" aria-label="Abrindo">
      <svg className="abertura-n" viewBox="0 0 720 1176" aria-hidden="true">
        <g className="abertura-a"><path fill="url(#nlRed)" d={CAMINHO_N} /></g>
        <g className="abertura-b"><path fill="url(#nlSilver)" transform="rotate(180 360 588)" d={CAMINHO_N} /></g>
      </svg>
    </div>
  );
}

export function MarcaN() {
  return (
    <svg viewBox="0 0 720 1176">
      <path fill="url(#nlRed)" d={CAMINHO_N} />
      <path fill="url(#nlSilver)" transform="rotate(180 360 588)" d={CAMINHO_N} />
    </svg>
  );
}
