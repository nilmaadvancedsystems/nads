import type { SVGProps } from 'react';
declare const ICONS: {
    readonly relatorio: "<path d=\"M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z\"/><path d=\"M14.5 2.5v5h5\"/><path d=\"M8.5 18v-2\"/><path d=\"M12 18v-5\"/><path d=\"M15.5 18v-3.5\"/>";
    readonly checklist: "<path d=\"m3.5 6.5 1.5 1.5 3-3\"/><path d=\"m3.5 12.5 1.5 1.5 3-3\"/><path d=\"m3.5 18.5 1.5 1.5 3-3\"/><path d=\"M11.5 7h9\"/><path d=\"M11.5 13h9\"/><path d=\"M11.5 19h9\"/>";
    readonly briefcase: "<rect x=\"2.5\" y=\"7\" width=\"19\" height=\"13\" rx=\"2\"/><path d=\"M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2\"/><path d=\"M2.5 12.5h19\"/>";
    readonly fileDown: "<path d=\"M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z\"/><path d=\"M14.5 2.5v5h5\"/><path d=\"M12 11v6\"/><path d=\"m9.5 14.5 2.5 2.5 2.5-2.5\"/>";
    readonly fileUp: "<path d=\"M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5Z\"/><path d=\"M14.5 2.5v5h5\"/><path d=\"M12 17v-6\"/><path d=\"m9.5 13.5 2.5-2.5 2.5 2.5\"/>";
    readonly zap: "<path d=\"M13 2 3 14h9l-1 8 10-12h-9l1-8z\"/>";
    readonly home: "<path d=\"M3 11.5 12 4l9 7.5\"/><path d=\"M5.5 10v9.5h13V10\"/><path d=\"M10 19.5v-6h4v6\"/>";
    readonly landmark: "<path d=\"M3 21h18\"/><path d=\"M5 21v-8.5\"/><path d=\"M19 21v-8.5\"/><path d=\"M9.5 21v-8.5\"/><path d=\"M14.5 21v-8.5\"/><path d=\"M2.5 9 12 3l9.5 6Z\"/>";
    readonly link: "<path d=\"M9.5 14.5 14.5 9.5\"/><path d=\"M11 6.5 12.8 4.7a4.3 4.3 0 0 1 6.1 6.1L17 12.6\"/><path d=\"M13 17.5l-1.8 1.8a4.3 4.3 0 0 1-6.1-6.1L7 11.4\"/>";
    readonly arrowDown: "<path d=\"M12 4v13\"/><path d=\"m6 12 6 6 6-6\"/>";
    readonly arrowUp: "<path d=\"M12 20V7\"/><path d=\"m6 12 6-6 6 6\"/>";
    readonly check: "<path d=\"M20 6 9 17l-5-5\"/>";
    readonly checkCircle: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8.3 12.3 2.6 2.6 5-5.2\"/>";
    readonly scale: "<path d=\"M12 3v18\"/><path d=\"M7 21h10\"/><path d=\"m4 8 4-4 4 4\"/><path d=\"M2.5 13a3.5 3.5 0 0 0 7 0L6 7Z\"/><path d=\"M14.5 13a3.5 3.5 0 0 0 7 0L18 7Z\"/>";
    readonly alert: "<path d=\"M10.6 3.8a1.6 1.6 0 0 1 2.8 0l8.4 14.6a1.6 1.6 0 0 1-1.4 2.4H3.6a1.6 1.6 0 0 1-1.4-2.4L10.6 3.8Z\"/><path d=\"M12 9.5v4.2\"/><path d=\"M12 17.2h.01\"/>";
    readonly lock: "<rect x=\"4.5\" y=\"10.5\" width=\"15\" height=\"10\" rx=\"2\"/><path d=\"M8 10.5V7a4 4 0 0 1 8 0v3.5\"/>";
    readonly unlock: "<rect x=\"4.5\" y=\"10.5\" width=\"15\" height=\"10\" rx=\"2\"/><path d=\"M8 10.5V7a4 4 0 0 1 7.5-2\"/>";
    readonly x: "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>";
    readonly sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2.5\"/><path d=\"M12 19.5V22\"/><path d=\"M4.9 4.9l1.8 1.8\"/><path d=\"M17.3 17.3l1.8 1.8\"/><path d=\"M2 12h2.5\"/><path d=\"M19.5 12H22\"/><path d=\"M4.9 19.1l1.8-1.8\"/><path d=\"M17.3 6.7l1.8-1.8\"/>";
    readonly moon: "<path d=\"M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z\"/>";
    readonly monitor: "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"12\" rx=\"1.8\"/><path d=\"M8 20.5h8\"/><path d=\"M12 16.5v4\"/>";
    readonly upload: "<path d=\"M12 15V4\"/><path d=\"m7 9 5-5 5 5\"/><path d=\"M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3\"/>";
    readonly fileText: "<path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z\"/><path d=\"M14 3v5h5\"/>";
    readonly clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3.5 2\"/>";
    readonly chevronsLeft: "<path d=\"m11 17-5-5 5-5\"/><path d=\"m18 17-5-5 5-5\"/>";
    readonly settings: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z\"/>";
    readonly logOut: "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><path d=\"M16 17l5-5-5-5\"/><path d=\"M21 12H9\"/>";
    readonly barChart: "<path d=\"M3 3v18h18\"/><rect x=\"7\" y=\"13\" width=\"3\" height=\"5\"/><rect x=\"12\" y=\"9\" width=\"3\" height=\"9\"/><rect x=\"17\" y=\"5\" width=\"3\" height=\"13\"/>";
    readonly search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m21 21-4.3-4.3\"/>";
    readonly repeat: "<path d=\"m17 2 4 4-4 4\"/><path d=\"M3 11V9a4 4 0 0 1 4-4h14\"/><path d=\"m7 22-4-4 4-4\"/><path d=\"M21 13v2a4 4 0 0 1-4 4H3\"/>";
    readonly calendar: "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 9.5h18\"/><path d=\"M8 2.5v4\"/><path d=\"M16 2.5v4\"/>";
    readonly plus: "<path d=\"M12 5v14\"/><path d=\"M5 12h14\"/>";
    readonly fileSearch: "<path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4\"/><path d=\"M14 3v5h5\"/><path d=\"M19 8v2.5\"/><circle cx=\"16\" cy=\"16\" r=\"3\"/><path d=\"m21 21-2.8-2.8\"/>";
    readonly hash: "<path d=\"M4 9h16\"/><path d=\"M4 15h16\"/><path d=\"M10 3 8 21\"/><path d=\"M16 3l-2 18\"/>";
    readonly list: "<path d=\"M8 6h13\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M3.5 6h.01\"/><path d=\"M3.5 12h.01\"/><path d=\"M3.5 18h.01\"/>";
    readonly menu: "<path d=\"M4 6h16M4 12h16M4 18h16\"/>";
    readonly painel: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M9 4v16\"/><path d=\"m16 10-2 2 2 2\"/>";
};
export type NomeIcone = keyof typeof ICONS;
/** <Icone nome="upload" /> — SVG de traço, na cor do texto. */
export declare function Icone({ nome, ...resto }: {
    nome: NomeIcone;
} & SVGProps<SVGSVGElement>): import("react").JSX.Element;
/** Gradientes da marca (vão uma vez no topo da página). */
export declare function DefsMarca(): import("react").JSX.Element;
/** O "N" da Nilma. */
export declare function MarcaN(): import("react").JSX.Element;
export {};
