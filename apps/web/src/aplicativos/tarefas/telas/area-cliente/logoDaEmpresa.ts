// A logo da empresa diminuída no navegador antes de gravar (12/11/2026): até 256 px no lado maior, em WebP (com o fundo
// transparente, se tiver); se o navegador não fizer WebP, PNG. A regra do tamanho e do formato é do core (erroDaLogo).
import { areaCliente as ac } from '@nads/core';

/** O data URL da logo para gravar, ou o erro (em texto) de por que não deu. */
export async function logoParaGravar(arquivo: File): Promise<{ logo: string } | { erro: string }> {
  const antes = ac.erroDoArquivoDeLogo(arquivo.type, arquivo.size);
  if (antes) return { erro: antes };
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(arquivo); } catch { return { erro: 'Não consegui abrir esta imagem. Mande em PNG ou JPG.' }; }
  try {
    const escala = Math.min(1, ac.LADO_DA_LOGO / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * escala));
    c.height = Math.max(1, Math.round(bmp.height * escala));
    const ctx = c.getContext('2d');
    if (!ctx) return { erro: 'O navegador não desenhou a imagem.' };
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    for (const [tipo, qualidade] of [['image/webp', 0.9], ['image/webp', 0.75], ['image/png', 1]] as const) {
      const logo = c.toDataURL(tipo, qualidade);
      if (!ac.erroDaLogo(logo)) return { logo };
    }
    return { erro: ac.erroDaLogo(c.toDataURL('image/png')) };
  } finally {
    bmp.close();
  }
}
