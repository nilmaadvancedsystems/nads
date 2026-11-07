// Pega o retrato do dia que o backup-firestore.js já leu (não lê o Firestore
// de novo — não gasta cota) e monta uma planilha .xlsx com uma linha por
// registro, no mesmo espírito do "Índice de Entregas" (a planilha do Google
// Sheets que a Nilma já usa): fácil de filtrar e ordenar por empresa.
//
// Substitui o script do Google Apps Script que fazia algo parecido e estava
// dando problema — este roda no mesmo PC do robô, sem depender do Apps
// Script nem da internet do Google Sheets.
//
// Uso:  node backup-planilha.js [pasta-do-json] [arquivo-de-saida.xlsx]
// Padrão: lê o JSON mais recente de G:\Meu Drive\NILMA-PROTOCOLO-BACKUPS\banco
//         e grava planilha-AAAA-MM-DD.xlsx na mesma pasta.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// BACKUP_PASTA: na nuvem não há G:, e o backup vai pro disco da máquina (ver backup-diario.js).
const PASTA_PADRAO = process.env.BACKUP_PASTA || 'G:\\Meu Drive\\NILMA-PROTOCOLO-BACKUPS\\banco';

// "207 - BMJ SOM AUTOMOTIVO LTDA" -> { codigo: '207', nome: 'BMJ SOM AUTOMOTIVO LTDA' }
// Cobre também clienteNome de documentosMensal/entregas, que já vem assim.
function separarCodigo(nomeCompleto, codigoOrigemSolto) {
  const nome = String(nomeCompleto || '');
  const m = /^(\d+)\s*-\s*(.+)$/.exec(nome);
  if (m) return { codigo: m[1], nome: m[2] };
  return { codigo: codigoOrigemSolto || '', nome: nome };
}

function achaJsonMaisRecente(pasta) {
  const arquivos = fs.readdirSync(pasta).filter(f => /^banco-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (!arquivos.length) throw new Error('nenhum banco-AAAA-MM-DD.json em ' + pasta);
  return path.join(pasta, arquivos[arquivos.length - 1]);
}

function moeda(v) {
  return typeof v === 'number' ? v : null;
}

function montarAba_Clientes(colecao) {
  const linhas = Object.keys(colecao || {}).map(id => {
    const d = (colecao[id] || {}).dados || {};
    const { codigo, nome } = separarCodigo(d.nome, d.codigoOrigem);
    const receita = d.receita || {};
    return {
      'Código': codigo,
      'Cliente': nome,
      'Nome fantasia': d.nomeFantasia || '',
      'CNPJ/CPF': d.documento || '',
      'Telefone': d.telefone || '',
      'Ativo': d.ativo ? 'Sim' : 'Não',
      'Faz entrega': d.entrega ? 'Sim' : 'Não',
      'Zona': d.zona || '',
      'Endereço': d.endereco || (receita.endereco || ''),
      'Situação na Receita': receita.situacao || '',
      'Simples Nacional': receita.simples === true ? 'Sim' : receita.simples === false ? 'Não' : '',
      'MEI': receita.mei === true ? 'Sim' : receita.mei === false ? 'Não' : '',
      'Sócios': Array.isArray(receita.socios) ? receita.socios.join('; ') : '',
      'Criado em': d.criadoEm || '',
    };
  });
  linhas.sort((a, b) => a['Cliente'].localeCompare(b['Cliente'], 'pt-BR'));
  return linhas;
}

function montarAba_DocumentosMensais(colecao) {
  const linhas = Object.keys(colecao || {}).map(id => {
    const d = (colecao[id] || {}).dados || {};
    const { codigo, nome } = separarCodigo(d.clienteNome);
    return {
      'Código': codigo,
      'Cliente': nome,
      'Competência': d.competencia || '',
      'Extrato': d.extrato ? 'Sim' : '',
      'Comprovante': d.comprovante ? 'Sim' : '',
      'Aplicação': d.aplicacao ? 'Sim' : '',
      'Atualizado em': d.atualizadoEm || '',
    };
  });
  linhas.sort((a, b) => a['Cliente'].localeCompare(b['Cliente'], 'pt-BR') || String(b['Competência']).localeCompare(String(a['Competência'])));
  return linhas;
}

function montarAba_Entregas(colecao) {
  const linhas = Object.keys(colecao || {}).map(id => {
    const d = (colecao[id] || {}).dados || {};
    const { codigo, nome } = separarCodigo(d.clienteNome);
    const itens = Array.isArray(d.itens) ? d.itens : [];
    const valorTotal = itens.reduce((s, it) => s + (moeda(it.valor) || 0), 0);
    return {
      'ID': id,
      'Código': codigo,
      'Cliente': nome,
      'Competência': d.competencia || '',
      'Vencimento': d.vencimento || '',
      'Itens': itens.map(it => it.tipo + (moeda(it.valor) !== null ? ' (R$ ' + it.valor.toFixed(2).replace('.', ',') + ')' : '')).join(', '),
      'Valor total': valorTotal || '',
      'Recebedor': d.recebedor || '',
      'Entregue por': d.entregadoPorNome || '',
      'Status': d.status || '',
      'Tem comprovante': (d.temAssinatura ? 'assinatura' : '') + (d.temAssinatura && d.temFoto ? ' + ' : '') + (d.temFoto ? 'foto' : '') || 'sem anexo',
      'Falhou': d.falha ? 'Sim' : '',
      'Motivo da falha': d.motivoFalha || '',
      'Criado em': d.criadoEm || '',
      'Confirmado em': d.confirmadoEm || '',
    };
  });
  linhas.sort((a, b) => a['Cliente'].localeCompare(b['Cliente'], 'pt-BR') || String(a['Criado em']).localeCompare(String(b['Criado em'])));
  return linhas;
}

function abaDaPlanilha(wb, nome, linhas) {
  const ws = XLSX.utils.json_to_sheet(linhas);
  // larguras simples, só pra não ficar tudo espremido numa coluna só
  const larguras = linhas.length ? Object.keys(linhas[0]).map(k => ({ wch: Math.min(40, Math.max(10, k.length + 4)) })) : [];
  ws['!cols'] = larguras;
  XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31)); // limite do Excel pro nome da aba
}

// Lê do retrato SÓ as coleções pedidas, em fluxo, sem montar o JSON inteiro na
// memória. O retrato passa de 300 MB e a máquina do robô tem 1 GB: o
// JSON.parse do arquivo todo estourava ("23: 0xccb4c8", 06/11/2026). O arquivo
// tem a forma { projeto, feitoEm, colecoes: { nome: { id: {...} } }, ... }; o
// leitor anda pelo texto contando chaves (respeitando aspas e barras) e só
// guarda o trecho das coleções que a planilha usa.
function lerColecoes(caminho, nomes, tamanhoBloco) {
  const { StringDecoder } = require('string_decoder');
  const quero = new Set(nomes);
  const achadas = {};
  const fd = fs.openSync(caminho, 'r');
  const dec = new StringDecoder('utf8');
  const buf = Buffer.alloc(tamanhoBloco || 4 * 1024 * 1024);
  let prof = 0, emString = false, escapou = false, tok = '', ultimaChaveRaiz = '', ultimaChaveCol = '';
  let dentroColecoes = false, captura = null;   // captura: { nome, partes: [] , ini }
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (!n) break;
      const txt = dec.write(buf.slice(0, n));
      let ini = captura ? 0 : -1;   // começo do trecho pendente deste pedaço
      for (let i = 0; i < txt.length; i++) {
        const c = txt[i];
        if (emString) {
          if (escapou) escapou = false;
          else if (c === '\\') escapou = true;
          else if (c === '"') { emString = false; if (prof === 1) ultimaChaveRaiz = tok; else if (prof === 2 && dentroColecoes) ultimaChaveCol = tok; }
          else if (prof <= 2) tok += c;
          continue;
        }
        if (c === '"') { emString = true; tok = ''; continue; }
        if (c === '{' || c === '[') {
          prof++;
          if (c === '{' && prof === 2 && ultimaChaveRaiz === 'colecoes') dentroColecoes = true;
          else if (dentroColecoes && prof === 3 && quero.has(ultimaChaveCol)) { captura = { nome: ultimaChaveCol, partes: [] }; ini = i; }
        } else if (c === '}' || c === ']') {
          if (captura && prof === 3) {
            captura.partes.push(txt.slice(ini, i + 1));
            achadas[captura.nome] = JSON.parse(captura.partes.join(''));
            captura = null; ini = -1;
          }
          if (prof === 2 && dentroColecoes) dentroColecoes = false;
          prof--;
        }
      }
      if (captura) captura.partes.push(txt.slice(Math.max(ini, 0)));
    }
  } finally { fs.closeSync(fd); }
  return achadas;
}

function main() {
  const args = process.argv.slice(2);
  const pastaJson = args[0] || PASTA_PADRAO;
  const caminhoJson = fs.existsSync(pastaJson) && fs.statSync(pastaJson).isFile() ? pastaJson : achaJsonMaisRecente(pastaJson);
  const colecoes = lerColecoes(caminhoJson, ['clientes', 'documentosMensal', 'entregas']);
  const backup = { colecoes };
  const dia = (/banco-(\d{4}-\d{2}-\d{2})\.json$/.exec(caminhoJson) || [])[1] || new Date().toISOString().slice(0, 10);

  const wb = XLSX.utils.book_new();
  abaDaPlanilha(wb, 'Clientes', montarAba_Clientes(backup.colecoes.clientes));
  abaDaPlanilha(wb, 'Documentos Mensais', montarAba_DocumentosMensais(backup.colecoes.documentosMensal));
  abaDaPlanilha(wb, 'Entregas', montarAba_Entregas(backup.colecoes.entregas));

  const pastaSaida = path.dirname(caminhoJson);
  const saida = args[1] || path.join(pastaSaida, 'planilha-' + dia + '.xlsx');
  XLSX.writeFile(wb, saida);

  console.log('OK:', saida);
  console.log('Clientes:', Object.keys(backup.colecoes.clientes || {}).length,
    '| Documentos Mensais:', Object.keys(backup.colecoes.documentosMensal || {}).length,
    '| Entregas:', Object.keys(backup.colecoes.entregas || {}).length);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('ERRO:', e.message); process.exit(1); }
}

module.exports = { lerColecoes, montarAba_Clientes, montarAba_DocumentosMensais, montarAba_Entregas, separarCodigo };
