// O arquivo recebido pela Área do Cliente no mapa do Drive (26/11/2026: "quero poder ver o arquivo direto por aqui", na
// página Recebidos). O robô do PC guarda o arquivo em <ano>\<cód> - <nome>\ÁREA DO CLIENTE\<MM> e anota a pasta (relativa
// ao Meu Drive) e o nome final; a tela acha o id dele no mapa que o robô do Entregas mantém (driveIndice) e pede ao robô
// da nuvem para abrir (aberturasDrive), como o Explorador do Drive. Funções puras, testadas em arquivoDoRecebido.test.ts.
import type { entregas as e } from '@nads/core';

/** As partes da pasta anotada pelo robô: o ano, a pasta do cliente e as de dentro ("2026\292 - FITO\ÁREA DO CLIENTE\11"). */
export function partesDaPasta(pastaDrive: string): { ano: string; cliente: string; dentro: string[] } | null {
  const p = pastaDrive.split(/[\\/]/).map(x => x.trim()).filter(Boolean);
  if (p.length < 2 || !/^\d{4}$/.test(p[0])) return null;
  return { ano: p[0], cliente: p[1], dentro: p.slice(2) };
}

const igual = (a: string, b: string) => a.normalize('NFC').toLocaleLowerCase('pt-BR') === b.normalize('NFC').toLocaleLowerCase('pt-BR');

/** A pasta do cliente no mapa daquele ano: pelo nome da pasta; sem ela, pelo código ("292 - …" → "292"). */
export function pastaDoClienteNoMapa(clientes: readonly e.PastaDeCliente[], cliente: string): e.PastaDeCliente | null {
  const codigo = /^(\d+)\s*-/.exec(cliente)?.[1] ?? '';
  return clientes.find(c => igual(c.nomePasta, cliente)) ?? (codigo ? clientes.find(c => c.codigo === codigo) ?? null : null);
}

/** O arquivo dentro da pasta do cliente, descendo pelas pastas de dentro; null se o mapa ainda não tem. */
export function arquivoNaPasta(itens: readonly e.ItemDoDrive[], pastaDoCliente: string, dentro: readonly string[], nome: string): e.ItemDoDrive | null {
  let pai = pastaDoCliente;
  for (const n of dentro) {
    const sub = itens.find(x => x.t === 'd' && x.p === pai && igual(x.n, n));
    if (!sub) return null;
    pai = sub.i;
  }
  return itens.find(x => x.t !== 'd' && x.p === pai && igual(x.n, nome)) ?? null;
}

/** Como a prévia mostra o arquivo pelo nome: a imagem, o PDF ou nada (só o abrir em outra aba). */
export function jeitoDaPrevia(nome: string): 'imagem' | 'pdf' | 'outro' {
  if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(nome)) return 'imagem';
  if (/\.pdf$/i.test(nome)) return 'pdf';
  return 'outro';
}
