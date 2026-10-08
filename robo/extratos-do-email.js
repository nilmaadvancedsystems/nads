// Os extratos que chegam por e-mail vão sozinhos para o nads (Vitor, 08/10/2026: "quero que isso aconteça com o
// contábil, ele já jogue o extrato para o nads"). Chamado pelo download-attachments.js depois de decidir de qual cliente
// é o e-mail: cada anexo que é extrato (o OFX; o PDF que o robô reconhece como extrato; a planilha com "extrato" no nome)
// vai para a fila extratosRecebidos/{id} (o arquivo em Base64 nos pedaços partes/{n}), com o banco e a conta lidos do
// texto. O Extratudo, ao abrir a tarefa de extratos do cliente, importa cada um na linha do banco certo (só os
// lançamentos novos) e marca como importado. O id é o do e-mail e do arquivo: o mesmo e-mail lido de novo não repete.
const crypto = require('crypto');

const soDigitos = v => String(v || '').replace(/\D/g, '');
const codigoDe = x => soDigitos(x && (x.codigo != null && x.codigo !== '' ? x.codigo : x.codigoOrigem));
const PEDACO = 900000;

/**
 * Guarda os extratos do e-mail na fila do nads. ehExtratoPdf(a) e textoDoPdf(a) vêm do download-attachments (o mesmo
 * reconhecimento que marca o "extrato" do mês). Devolve quantos arquivos foram para a fila.
 */
async function mandarExtratosDoEmail({ db, cliente, anexos, mensagemId, competencia, remetente, simular, log, textoDoPdf, ehExtratoPdf }) {
  const codigo = codigoDe(cliente);
  if (!codigo) return 0;
  const { bancosDoTexto } = require('./bancos');
  const cb = require('./contas-bancarias');
  let mandados = 0;
  for (const a of anexos) {
    if (!a.buffer || !a.filename) continue;
    const nome = a.filename;
    let texto = '';
    if (/\.ofx$/i.test(nome)) texto = a.buffer.toString('latin1');
    else if (/\.pdf$/i.test(nome)) { if (!(await ehExtratoPdf(a))) continue; texto = await textoDoPdf(a); }
    else if (/\.(xlsx?|csv)$/i.test(nome)) { if (!/extrato/i.test(nome)) continue; }
    else continue;
    const id = mensagemId + '_' + crypto.createHash('md5').update(nome).digest('hex').slice(0, 8);
    const ref = db.collection('extratosRecebidos').doc(id);
    if ((await ref.get()).exists) continue;
    // o mesmo arquivo (pelo conteúdo) que já está na fila (do Drive ou de outro e-mail) não entra de novo
    const md5 = crypto.createHash('md5').update(a.buffer).digest('hex');
    if (!(await db.collection('extratosRecebidos').where('codigo', '==', codigo).where('md5', '==', md5).limit(1).get()).empty) continue;
    const bancos = texto ? bancosDoTexto(texto) : [];
    const contas = texto ? cb.contasDoTexto(texto).map(c => ({ agencia: String(c.agencia || ''), conta: String(c.conta || '') })) : [];
    if (simular) { if (log) log('extrato do e-mail (simulado): ' + nome + ' ' + bancos.join(',')); continue; }
    const b64 = a.buffer.toString('base64');
    let n = 0;
    for (let i = 0; i < b64.length; i += PEDACO) {
      n++;
      await ref.collection('partes').doc(String(n).padStart(3, '0')).set({ n, dados: b64.slice(i, i + PEDACO) });
    }
    await ref.set({
      status: 'novo', origem: 'email', md5, codigo, clienteId: cliente.id, clienteNome: cliente.nome || '', competencia, nome, bancos, contas,
      tamanho: a.buffer.length, partes: n, mensagemId, remetente: remetente || '', em: new Date().toISOString(),
    });
    mandados++;
    if (log) log('extrato do e-mail para o nads: ' + nome + (bancos.length ? ' (' + bancos.join(', ') + ')' : ''));
  }
  return mandados;
}

module.exports = { mandarExtratosDoEmail };
