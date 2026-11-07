// Os símbolos dos serviços com que os robôs trabalham (SIEG, FGTS Digital, Alterdata, Gmail, NFS-e), guardados em
// ../logos (as fontes estão no FONTES.md de lá). Saem junto com o site: nada é buscado de terceiros ao abrir.
/// <reference types="vite/client" />
const IMAGENS = import.meta.glob('../logos/*.{png,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** O endereço do logo pelo nome do arquivo sem a extensão ('sieg', 'gmail'…); null = sem logo (vale o ícone próprio). */
export function urlDoLogo(nome: string): string | null {
  if (!nome) return null;
  for (const [caminho, url] of Object.entries(IMAGENS)) if (caminho.replace(/^.*\//, '').replace(/\.[^.]+$/, '') === nome) return url;
  return null;
}
