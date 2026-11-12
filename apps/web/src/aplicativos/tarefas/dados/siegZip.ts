// O que vai no .zip do "Baixar do SIEG" (11/11/2026: "preciso também que coloque uma opção de baixar pdf ou uma de baixar os 2").
// O robô monta um .zip só, com os XMLs na raiz e os PDFs das notas na pasta PDF/ (robo/sieg-pdfs.js, 09/11/2026). A escolha é
// feita aqui, na hora de baixar: o pedido ao robô não muda (as chaves do pedidosSieg são as das regras do banco do Entregas).
// Os arquivos são copiados como vieram (já comprimidos): só o índice do .zip é refeito, sem biblioteca.

export type FormatoDoSieg = 'xml' | 'pdf' | 'ambos';

export const FORMATOS_DO_SIEG: { valor: FormatoDoSieg; rotulo: string }[] = [
  { valor: 'xml', rotulo: 'XML' },
  { valor: 'pdf', rotulo: 'PDF' },
  { valor: 'ambos', rotulo: 'XML e PDF' },
];

/** O texto do botão: "Baixar XMLs do SIEG", "Baixar PDFs do SIEG" ou "Baixar XMLs e PDFs do SIEG". */
export const rotuloDoBotao = (f: FormatoDoSieg) => 'Baixar ' + (f === 'xml' ? 'XMLs' : f === 'pdf' ? 'PDFs' : 'XMLs e PDFs') + ' do SIEG';

/** O nome do arquivo baixado: "SIEG 2026-10 - X.zip" vira "SIEG 2026-10 - X (PDFs).zip" e "… (XMLs).zip"; com os dois, o mesmo. */
export function nomeDoZip(nome: string, f: FormatoDoSieg): string {
  if (f === 'ambos') return nome;
  return nome.replace(/(\.zip)?$/i, ' (' + (f === 'pdf' ? 'PDFs' : 'XMLs') + ').zip');
}

const PASTA_PDF = 'PDF/';

/**
 * O .zip só com o formato escolhido: 'xml' tira a pasta PDF/; 'pdf' fica só com ela, sem o "PDF/" no nome (os PDFs soltos no
 * .zip); 'ambos' devolve os bytes como vieram. Devolve { bytes, arquivos } (arquivos: quantos ficaram).
 */
export function zipNoFormato(bytes: Uint8Array, f: FormatoDoSieg): { bytes: Uint8Array; arquivos: number } {
  const entradas = lerIndice(bytes);
  if (f === 'ambos') return { bytes, arquivos: entradas.length };
  const ficam = entradas
    .filter(e => (f === 'pdf' ? e.nome.startsWith(PASTA_PDF) && e.nome.length > PASTA_PDF.length : !e.nome.startsWith(PASTA_PDF)))
    .map(e => (f === 'pdf' ? { ...e, nome: e.nome.slice(PASTA_PDF.length) } : e));
  return { bytes: montar(bytes, ficam), arquivos: ficam.length };
}

type Entrada = { nome: string; central: number; local: number; tamanho: number };

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const p16 = (b: Uint8Array, i: number, v: number) => { b[i] = v & 0xff; b[i + 1] = (v >>> 8) & 0xff; };
const p32 = (b: Uint8Array, i: number, v: number) => { b[i] = v & 0xff; b[i + 1] = (v >>> 8) & 0xff; b[i + 2] = (v >>> 16) & 0xff; b[i + 3] = (v >>> 24) & 0xff; };

/** As entradas do .zip pelo índice do fim (o diretório central): o nome, onde estão e o tamanho comprimido. */
function lerIndice(b: Uint8Array): Entrada[] {
  let fim = b.length - 22;
  while (fim >= 0 && u32(b, fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('o arquivo não é um .zip');
  const total = u16(b, fim + 10);
  let j = u32(b, fim + 16);
  const saida: Entrada[] = [];
  const texto = new TextDecoder('utf-8');
  for (let n = 0; n < total; n++) {
    if (u32(b, j) !== 0x02014b50) throw new Error('o índice do .zip está quebrado');
    const tamNome = u16(b, j + 28);
    saida.push({ nome: texto.decode(b.subarray(j + 46, j + 46 + tamNome)), central: j, local: u32(b, j + 42), tamanho: u32(b, j + 20) });
    j += 46 + tamNome + u16(b, j + 30) + u16(b, j + 32);
  }
  return saida;
}

/** Um .zip novo com estas entradas (os dados copiados do original, o nome talvez trocado). */
function montar(b: Uint8Array, entradas: Entrada[]): Uint8Array {
  const cod = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let pos = 0;
  for (const e of entradas) {
    const nome = cod.encode(e.nome);
    const ini = e.local + 30 + u16(b, e.local + 26) + u16(b, e.local + 28);
    const dados = b.subarray(ini, ini + e.tamanho);
    const local = new Uint8Array(30 + nome.length);
    local.set(b.subarray(e.local, e.local + 30));
    // o CRC e os tamanhos do índice (sem o "vem depois dos dados", o bit 3) e o nome novo, sem campo extra
    p16(local, 6, u16(b, e.central + 8) & ~0x0008);
    p32(local, 14, u32(b, e.central + 16)); p32(local, 18, e.tamanho); p32(local, 22, u32(b, e.central + 24));
    p16(local, 26, nome.length); p16(local, 28, 0);
    local.set(nome, 30);
    const central = new Uint8Array(46 + nome.length);
    central.set(b.subarray(e.central, e.central + 46));
    p16(central, 8, u16(b, e.central + 8) & ~0x0008);
    p16(central, 28, nome.length); p16(central, 30, 0); p16(central, 32, 0);
    p32(central, 42, pos);
    central.set(nome, 46);
    locais.push(local, dados);
    centrais.push(central);
    pos += local.length + dados.length;
  }
  const tamDir = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  p32(fim, 0, 0x06054b50); p16(fim, 8, entradas.length); p16(fim, 10, entradas.length); p32(fim, 12, tamDir); p32(fim, 16, pos);
  const saida = new Uint8Array(pos + tamDir + 22);
  let k = 0;
  for (const parte of [...locais, ...centrais, fim]) { saida.set(parte, k); k += parte.length; }
  return saida;
}
