// Os anexos do delegador gastando o mínimo no banco (29/10/2026): a imagem vira WebP com o lado maior até 2000 px; o
// resto vai em gzip (sem perda: ao baixar volta byte a byte); o que já vem comprimido (zip, xlsx, vídeo...) fica como
// está. Só fica o encolhido se tirou pelo menos 5%. O que decide é do core (tarefas.delegadas.comoEncolher).
import { tarefas } from '@nads/core';
import type { ArquivoParaAnexar } from './tarefasDelegadas';

const d = tarefas.delegadas;

async function passar(bytes: Uint8Array, fluxo: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(fluxo)).arrayBuffer());
}

/** A imagem redesenhada em WebP (null = o navegador não abriu ou não gera WebP). */
async function imagemMenor(arquivo: File): Promise<Uint8Array | null> {
  let img: ImageBitmap;
  try { img = await createImageBitmap(arquivo); } catch { return null; }
  const escala = Math.min(1, d.MAIOR_LADO_DA_IMAGEM / Math.max(img.width, img.height));
  const tela = new OffscreenCanvas(Math.max(1, Math.round(img.width * escala)), Math.max(1, Math.round(img.height * escala)));
  tela.getContext('2d')?.drawImage(img, 0, 0, tela.width, tela.height);
  img.close();
  const blob = await tela.convertToBlob({ type: 'image/webp', quality: d.QUALIDADE_DA_IMAGEM });
  return blob.type === 'image/webp' ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** O arquivo escolhido pronto para subir: encolhido quando compensa (tamanho = o do arquivo que a pessoa vai baixar). */
export async function encolherAnexo(arquivo: File): Promise<ArquivoParaAnexar> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const como = d.comoEncolher(arquivo.name);
  try {
    if (como === 'imagem') {
      const menor = await imagemMenor(arquivo);
      if (menor && d.valeEncolher(bytes.length, menor.length)) return { nome: d.nomeDaImagemEncolhida(arquivo.name), bytes: menor, tamanho: menor.length };
    } else if (como === 'gzip') {
      const menor = await passar(bytes, new CompressionStream('gzip'));
      if (d.valeEncolher(bytes.length, menor.length)) return { nome: arquivo.name, bytes: menor, tamanho: bytes.length, gzip: true };
    }
  } catch { /* sem o encolhido, vai o original */ }
  return { nome: arquivo.name, bytes, tamanho: bytes.length };
}

/** Os bytes do arquivo como a pessoa anexou (descomprime o gzip). */
export const bytesDoAnexo = (bytes: Uint8Array, gzip?: boolean): Promise<Uint8Array> =>
  (gzip ? passar(bytes, new DecompressionStream('gzip')) : Promise.resolve(bytes));
