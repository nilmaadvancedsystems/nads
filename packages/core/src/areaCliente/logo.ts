// A logo da empresa na Área do Cliente (12/11/2026: "tem que ter como o gestor do nads colocar a logo da empresa"). O
// gestor (admin ou diretor) manda a imagem no bloco "Link do cliente" da janela da empresa; o nads diminui (até 256 px
// no lado maior) e grava em logosDasEmpresas/{código} como data URL; o robô leva para o espelho do link
// (areasCliente/{token}/resumo/marca) e o topo da Área do Cliente mostra no lugar do ícone do prédio.

/** o lado maior da logo depois de diminuída, em pixels */
export const LADO_DA_LOGO = 256;
/** o maior data URL aceito (cabe folgado num documento do banco) */
export const MAIOR_LOGO = 150_000;
/** os formatos que a logo pode ter no banco (o SVG fica de fora: pode carregar código) */
export const FORMATOS_DA_LOGO = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** os formatos que o gestor pode escolher (o nads converte para WebP ou PNG antes de gravar) */
export const ARQUIVOS_DE_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'] as const;

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Por que a logo (o data URL) não pode ser gravada; '' se pode. */
export function erroDaLogo(dataUrl: unknown): string {
  if (typeof dataUrl !== 'string' || !dataUrl) return 'Escolha uma imagem.';
  if (dataUrl.length > MAIOR_LOGO) return 'A logo ficou grande demais mesmo diminuída. Tente uma imagem mais simples (PNG ou JPG).';
  if (!DATA_URL.test(dataUrl)) return 'A logo tem de ser PNG, JPG ou WebP.';
  return '';
}

/** Por que o arquivo escolhido não serve de logo (antes de diminuir); '' se serve. */
export function erroDoArquivoDeLogo(tipo: string, tamanho: number): string {
  if (!(ARQUIVOS_DE_LOGO as readonly string[]).includes(tipo)) return tipo === 'image/svg+xml' ? 'SVG não vale: mande a logo em PNG ou JPG.' : 'Escolha uma imagem (PNG, JPG ou WebP).';
  if (tamanho > 10 * 1024 * 1024) return 'A imagem passa de 10 MB. Mande uma menor.';
  return '';
}
