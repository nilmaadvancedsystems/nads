// Os ícones de perfil para quem não quer usar a própria foto: os mesmos 12 emblemas das Configurações do Entregas
// (nilma-config.js, 28/09/2026) — fundo de cor cheia e um símbolo grande, 96x96. Cada um vira uma imagem SVG gravada
// no mesmo campo da foto (usuarios.fotoPerfil), então aparece em todo lugar que mostra a foto (aqui e no Entregas).

interface IconeDePerfil { nome: string; fundo: string; corpo: string }

const ICONES: readonly IconeDePerfil[] = [
  { nome: 'Hexágono', fundo: '#1D1C1F', corpo:
    '<path d="M48 12 79 30v36L48 84 17 66V30Z" fill="none" stroke="#E5484D" stroke-width="7" stroke-linejoin="round"/>' +
    '<path d="M48 32 64 41v18L48 68 32 59V41Z" fill="#E5484D"/>' },
  { nome: 'Raio', fundo: '#F5B400', corpo:
    '<path d="M54 8 22 54h22l-6 34 36-48H52Z" fill="#1D1C1F"/>' },
  { nome: 'Picos', fundo: '#B0262D', corpo:
    '<path d="M8 80 36 30l16 28 10-16 26 38Z" fill="#FFFFFF"/><path d="m36 30 9 16-9-5-9 5Z" fill="#B0262D"/>' },
  { nome: 'Alvo', fundo: '#0A3D62', corpo:
    '<circle cx="48" cy="48" r="34" fill="none" stroke="#FFFFFF" stroke-width="7"/><circle cx="48" cy="48" r="19" fill="none" stroke="#FFFFFF" stroke-width="7"/><circle cx="48" cy="48" r="6" fill="#F5B400"/>' },
  { nome: 'Estrela', fundo: '#4A1D96', corpo:
    '<path d="m48 8 9 22 23-6-6 23 22 9-22 9 6 23-23-6-9 22-9-22-23 6 6-23-22-9 22-9-6-23 23 6Z" fill="#FFFFFF"/><circle cx="48" cy="48" r="10" fill="#4A1D96"/>' },
  { nome: 'Losango', fundo: '#101418', corpo:
    '<path d="M48 8 84 48 48 88 12 48Z" fill="#FF7A1A"/><path d="M48 30 66 48 48 66 30 48Z" fill="#101418"/>' },
  { nome: 'Escudo', fundo: '#14532D', corpo:
    '<path d="M48 10 78 20v26c0 20-13 33-30 40-17-7-30-20-30-40V20Z" fill="#FFFFFF"/><path d="M48 24v52c11-6 20-15 20-30V28Z" fill="#14532D"/>' },
  { nome: 'Setas', fundo: '#C2410C', corpo:
    '<path d="m18 22 26 26-26 26M46 22l26 26-26 26" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="square" stroke-linejoin="miter"/>' },
  { nome: 'Coroa', fundo: '#111827', corpo:
    '<path d="M14 70 18 28l16 16 14-24 14 24 16-16 4 42Z" fill="#F5B400"/><path d="M14 76h68" stroke="#F5B400" stroke-width="6"/>' },
  { nome: 'Blocos', fundo: '#0E7C86', corpo:
    '<path d="M16 16h26v26H16ZM54 16h26v26H54ZM16 54h26v26H16Z" fill="#FFFFFF"/><path d="M54 54h26v26H54Z" fill="#1D1C1F"/>' },
  { nome: 'Chama', fundo: '#7F1D1D', corpo:
    '<path d="M48 8c4 16 22 24 22 44a22 22 0 0 1-44 0c0-10 6-17 10-22 1 8 5 12 9 13-3-12 1-25 3-35Z" fill="#FF7A1A"/><path d="M48 50c3 7 11 10 11 19a11 11 0 0 1-22 0c0-7 6-11 11-19Z" fill="#F5B400"/>' },
  { nome: 'Órbita', fundo: '#1E3A8A', corpo:
    '<ellipse cx="48" cy="48" rx="38" ry="15" fill="none" stroke="#FFFFFF" stroke-width="6" transform="rotate(-30 48 48)"/><circle cx="48" cy="48" r="14" fill="#FFFFFF"/><circle cx="78" cy="30" r="6" fill="#F5B400"/>' },
];

/** O ícone como imagem (o mesmo formato que o Entregas grava em usuarios.fotoPerfil). */
function urlIcone(ic: IconeDePerfil): string {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="' + ic.fundo + '"/>' + ic.corpo + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Os ícones de personagem (Vitor, 05/10/2026: "coloque os ícones", da pasta icones): imagens 48x48 que entram no código
// como data: (?inline), então vão gravadas inteiras em usuarios.fotoPerfil e aparecem no Entregas também. Para pôr
// outro, é só soltar o .webp em ./icones (o nome vem do arquivo: Little_Wolf_profileicon.webp → "Little Wolf").
// (08/10/2026: "upe os novos ícones") também .jpg e .png; o "48px-" do começo do nome sai
const PERSONAGENS = import.meta.glob<string>('./icones/*.{webp,jpg,png}', { eager: true, query: '?inline', import: 'default' });
const nomeDoArquivo = (caminho: string) => caminho.replace(/^.*\//, '').replace(/^\d+px-/i, '').replace(/(_profileicon)?\.(webp|jpg|png)$/i, '').replace(/_/g, ' ');

export const ICONES_DE_PERFIL: readonly { nome: string; url: string }[] = ICONES.map(ic => ({ nome: ic.nome, url: urlIcone(ic) }));
const ICONES_DE_PERSONAGEM: readonly { nome: string; url: string }[] = Object.entries(PERSONAGENS)
  .sort(([a], [b]) => a.localeCompare(b)).map(([caminho, url]) => ({ nome: nomeDoArquivo(caminho), url }));

/** Quem vê os de personagem (Vitor, 05/10/2026: "só vão ser liberados para os usuários Gustavo.S e Vitor"), pelo login. */
const LIBERADOS_PERSONAGENS = ['gustavo.s@nilma.local', 'vitor@nilma.local'];

/** Os ícones que a pessoa pode escolher: os 12 emblemas para todos; os de personagem só para os liberados. */
export function iconesDePerfilPara(email: string): readonly { nome: string; url: string }[] {
  return LIBERADOS_PERSONAGENS.includes(email.trim().toLowerCase()) ? [...ICONES_DE_PERFIL, ...ICONES_DE_PERSONAGEM] : ICONES_DE_PERFIL;
}
