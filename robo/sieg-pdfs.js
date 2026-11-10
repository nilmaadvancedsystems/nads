// Os PDFs das notas do SIEG (Vitor, 09/11/2026: "quero tambem que o sieg puxe as notas em pdf tambem"; os dois destinos: a
// pasta do Drive, junto dos XMLs, e o .zip do "Baixar XMLs"). O PDF sai do próprio XML, sem navegador (robo/gerado/danfse.js):
// a NF-e e a NFC-e pelo danfePdf.ts, a NFS-e do padrão nacional pela DANFSe do botão do nads.
// CT-e, CF-e, evento e NFS-e de layout municipal não têm desenho no nads: ficam só no XML.
// O nome da NF-e é o que o arquivador já conhece do download do portal: "<chave> - <RAZÃO DO EMITENTE>.pdf".
// Nunca derruba o pedido: nota que não deu entra em `falhas` e os XMLs seguem.

// o .zip entregue vai em pedaços para o banco e fica 1 dia: o que passar disso fica só no Drive (o banco já chegou a 3 GB num laço)
const LIMITE_NO_ZIP = 60 * 1024 * 1024;

const limpo = t => String(t || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim();

/** O PDF de um XML: { nome, bytes }, ou null quando este tipo não tem desenho. */
async function pdfDoXml(a, g) {
  if (/-nfe\.xml$/i.test(a.nome)) {
    const d = g.danfeDoXml(a.xml);
    if (!d || !d.chave) return null;
    return { nome: d.chave + (limpo(d.emitente.nome) ? ' - ' + limpo(d.emitente.nome) : '') + '.pdf', bytes: await g.desenharDanfe(a.xml) };
  }
  if (/^nfse-/i.test(a.nome) && /<(?:\w+:)?infNFSe[\s>]/.test(a.xml)) return { nome: a.nome.replace(/\.xml$/i, '.pdf'), bytes: await g.pdfDaDanfse(a.xml) };
  return null;
}

/**
 * Os PDFs destes XMLs ([{ nome, xml }]). Devolve { pdfs: [{ de (nome do XML), nome, dados (Buffer) }], falhas: [{ nome, motivo }] }.
 * aoAndar(feitos, total), se vier, é chamado a cada nota.
 */
async function pdfsDasNotas(arquivos, aoAndar) {
  const g = require('./gerado/danfse');
  const pdfs = [];
  const falhas = [];
  let feitos = 0;
  for (const a of arquivos) {
    try {
      const p = await pdfDoXml(a, g);
      if (p) pdfs.push({ de: a.nome, nome: p.nome, dados: Buffer.from(p.bytes) });
    } catch (err) { falhas.push({ nome: a.nome, motivo: (err && err.message) || String(err) }); }
    feitos++;
    if (aoAndar) await aoAndar(feitos, arquivos.length);
    // de tempos em tempos larga a vez: o mesmo processo cuida dos outros pedidos
    if (feitos % 20 === 0) await new Promise(r => setImmediate(r));
  }
  return { pdfs, falhas };
}

/** Os arquivos a mais do .zip entregue: os PDFs (pasta PDF/) até o limite e, se algum ficou de fora, um aviso dizendo quantos. Puro. */
function paraOZip(pdfs, limite = LIMITE_NO_ZIP) {
  const entram = [];
  let soma = 0;
  for (const p of pdfs) {
    if (soma + p.dados.length > limite) continue;
    soma += p.dados.length;
    entram.push({ nome: 'PDF/' + p.nome, dados: p.dados });
  }
  const fora = pdfs.length - entram.length;
  if (fora) entram.push({ nome: 'PDF/LEIA - faltam ' + fora + ' PDFs.txt', xml: 'O .zip tem limite de tamanho: ' + fora + ' de ' + pdfs.length + ' PDFs não couberam aqui. Eles ficam na pasta do cliente no Drive.\r\n' });
  return { entram, fora };
}

module.exports = { pdfsDasNotas, paraOZip, LIMITE_NO_ZIP };
