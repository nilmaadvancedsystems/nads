// Os XMLs que o cliente mandou (Vitor, 08/10/2026: "um botão juntamente à importação do Alterdata para importar os XMLs
// que os clientes mandam"), lidos no navegador: os .xml soltos e os de dentro dos .zip (sem biblioteca: o índice do fim
// do .zip e o DecompressionStream do navegador). Devolve o texto de cada XML de nota ou evento; o resto fica de fora.

/** Um XML de nota (NF-e, NFC-e, CT-e, NFS-e) ou de evento? (o robô confere de novo e fica só com os do cliente) */
export const ehXmlDeNota = (x: string) => /<(?:\w+:)?(?:infNFe|infCte|infCTe|tpEvento|NFSe|CompNfse|Nfse|InfNfse|infNFSe)[\s>]/.test(x);

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Os arquivos de dentro de um .zip (pelo índice do fim; sem ele, nada). */
async function arquivosDoZip(buf: ArrayBuffer): Promise<{ nome: string; bytes: Uint8Array }[]> {
  const v = new DataView(buf);
  const b = new Uint8Array(buf);
  let fim = buf.byteLength - 22;
  while (fim >= 0 && v.getUint32(fim, true) !== 0x06054b50) fim--;
  if (fim < 0) return [];
  const total = v.getUint16(fim + 10, true);
  let j = v.getUint32(fim + 16, true);
  const saida: { nome: string; bytes: Uint8Array }[] = [];
  const nomes = new TextDecoder();
  for (let n = 0; n < total && j + 46 <= buf.byteLength && v.getUint32(j, true) === 0x02014b50; n++) {
    const metodo = v.getUint16(j + 10, true);
    const tam = v.getUint32(j + 20, true);
    const tamNome = v.getUint16(j + 28, true);
    const nome = nomes.decode(b.subarray(j + 46, j + 46 + tamNome));
    const local = v.getUint32(j + 42, true);
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const dados = b.subarray(ini, ini + tam);
    if (!nome.endsWith('/')) saida.push({ nome, bytes: metodo === 8 ? await inflar(dados) : dados });
    j += 46 + tamNome + v.getUint16(j + 30, true) + v.getUint16(j + 32, true);
  }
  return saida;
}

const texto = (bytes: Uint8Array) => {
  const t = new TextDecoder('utf-8').decode(bytes);
  // o XML em ISO-8859-1 (alguns emissores de NFS-e): lê de novo nessa codificação
  return /encoding=["']ISO-8859-1["']/i.test(t.slice(0, 200)) ? new TextDecoder('iso-8859-1').decode(bytes) : t;
};

/** Os XMLs de nota dos arquivos soltos (.xml e .zip, até um .zip dentro de outro); ignorados = os outros arquivos. */
export async function lerXmlsDosArquivos(arquivos: readonly File[]): Promise<{ xmls: string[]; ignorados: number }> {
  const xmls: string[] = [];
  let ignorados = 0;
  const ler = async (nome: string, bytes: Uint8Array, fundo: number) => {
    if (/\.zip$/i.test(nome) && fundo < 3) {
      const dentro = await arquivosDoZip(bytes.slice().buffer);
      if (!dentro.length) ignorados++;
      for (const a of dentro) await ler(a.nome, a.bytes, fundo + 1);
      return;
    }
    if (!/\.xml$/i.test(nome)) { ignorados++; return; }
    const x = texto(bytes);
    if (ehXmlDeNota(x)) xmls.push(x); else ignorados++;
  };
  for (const f of arquivos) await ler(f.name, new Uint8Array(await f.arrayBuffer()), 0);
  return { xmls, ignorados };
}
