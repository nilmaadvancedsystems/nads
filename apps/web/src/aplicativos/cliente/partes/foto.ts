// A foto do funcionário na Área do Cliente (Vitor, 16/10/2026: "subir a foto da pessoa que foi contratada"). Antes de
// enviar, o navegador recorta o quadrado do meio e reduz para 256×256 em JPEG (qualidade 0,82): fica com poucas dezenas
// de KB, bem abaixo dos 700 KB do envio. Só JPG e PNG.

export const ACEITA_FOTO = 'image/jpeg,image/png';
export const LADO_DA_FOTO = 256;

/** devolve o JPEG em base64 (sem o prefixo data:), ou lança o erro em português */
export async function fotoQuadrada(arquivo: File): Promise<string> {
  if (!/^image\/(jpeg|png)$/.test(arquivo.type)) throw new Error('Escolha uma imagem JPG ou PNG.');
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw new Error('Não deu para abrir esta imagem.'); });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    if (!lado) throw new Error('Não deu para abrir esta imagem.');
    const tela = document.createElement('canvas');
    tela.width = LADO_DA_FOTO;
    tela.height = LADO_DA_FOTO;
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error('Este navegador não consegue preparar a foto.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO_DA_FOTO, LADO_DA_FOTO);
    return tela.toDataURL('image/jpeg', 0.82).replace(/^data:image\/jpeg;base64,/, '');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const urlDaFoto = (base64Jpeg: string) => 'data:image/jpeg;base64,' + base64Jpeg;
