// As imagens das Ferramentas (12/11/2026): reconhecer PNG e JPG pelos primeiros bytes (o nome engana: "foto.png" que é
// JPG), para virar página de PDF. Os outros formatos (WEBP, GIF, BMP…) a tela desenha e converte para PNG antes.

export type FormatoDeImagem = 'png' | 'jpg';

/** O formato pelos primeiros bytes; null se não for PNG nem JPG. */
export function formatoDaImagem(bytes: Uint8Array): FormatoDeImagem | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}

/** O nome é de uma imagem que o navegador sabe abrir. */
export const ehNomeDeImagem = (nome: string) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(nome.trim());

/** As imagens aceitas, para o campo de escolher arquivo. */
export const ACEITA_IMAGENS = '.png,.jpg,.jpeg,.webp,.gif,.bmp';
