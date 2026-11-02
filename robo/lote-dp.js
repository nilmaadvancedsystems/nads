// DP › Envios › Lote (28/10/2026: "uma opção onde eu subo um lote de arquivos, esses arquivos são lidos e organizados para
// dispará-los em lote, após a disparada eles salvam no drive e alimentam o sistema com valores de folha, fgts etc"). Roda no
// robô da nuvem (vigia-robo.js, com USAR_DRIVE_API=1):
//
//   1. a tela cria lotesDp/{lote} { status: 'enviando', criadoEm, criadoPor, criadoPorUid, total } e cada arquivo em
//      lotesDp/{lote}/arquivos/{k} { nome, tamanho, partes, status: 'enviando' }, com os pedaços em .../partes/{n} { dados }
//      (como o enviosSecretario); o arquivo inteiro passa para 'pendente' e, no fim, o lote também;
//   2. a leitura: cada arquivo pelo leitor do arquivador (montarEntrada + decidir, o mesmo do Claudio Secretário), com o
//      cadastro do banco e as pastas do mapa do Drive (na máquina do Google não há o G:); sem OCR (a máquina é pequena: o
//      escaneado fica "não identificado" e a pessoa escolhe). O resultado vai no próprio arquivo (leitura: o cliente, o tipo,
//      a competência, o valor e o vencimento da guia, a pasta e o nome de destino) e o lote fica 'lido';
//   3. a tela revisa (escolha { cliente, tipo, competencia } ou fora: true em cada arquivo) e pede o disparo ('disparar',
//      com disparadoPor/disparadoPorUid; só o DP e o admin). O robô manda um e-mail por cliente e competência (o modelo do
//      DP › Envios, para o e-mail do Cadastro do nads), grava cada arquivo enviado na pasta do cliente no Drive (sem
//      sobrescrever: salvarArquivo) e registra o envio em solicitacoesEmail (tipo envioDp, origem lote: entra no histórico do
//      cliente e marca a Entrega). O resultado de cada cliente fica em resultados.<código>_<AAAA-MM>; os pedaços são apagados.
//   Os valores (o FGTS, a DARF do INSS e o total da folha) a tela grava na execução do DP do mês ao ver o envio feito.
const os = require('os');
const path = require('path');
// sem OCR na máquina do Google (pequena demais para o Tesseract): vale antes de o arquivador-novo ser carregado
if (process.env.ARQ_NOVO_OCR == null) process.env.ARQ_NOVO_OCR = '0';
const { ouvir } = require('./ouvinte');
const R = require('./arquivador-regras');
const dp = require('./envios-do-dp');
// o painel do robô: o lote lido e o disparado
const painel = require('./painel');

const COLECAO = 'lotesDp';
const MAX_ARQUIVOS = 150;
const MAX_PARTES = 30;
const CADASTRO_VALE_MS = 30 * 60 * 1000;
// lote esquecido (a pessoa fechou a tela no meio, ou não disparou): some do banco, com os pedaços
const ESQUECIDO_MS = 3 * 24 * 36e5;
// a pasta do DP no mês de cada tipo escolhido à mão na revisão (o que o leitor não reconheceu)
const PASTA_DO_TIPO = { FGTS: 'FGTS', DARF: 'DARF', FOLHA: 'FOLHA', 'PRO-LABORE': 'PRÓ-LABORE', OUTRO: '' };

// ---------- funções puras (testadas sem rede) ----------

const doisDigitos = n => String(n).padStart(2, '0');
/** { mes: 9, ano: 2026 } -> '2026-09' ('' sem os dois) */
function competenciaIso(c) {
  return c && c.mes && c.ano ? c.ano + '-' + doisDigitos(c.mes) : '';
}
/** 'R$1234,56' (ou '1.234,56') -> 1234.56; null quando não é valor */
function valorNumero(v) {
  const m = /(\d[\d.]*),(\d{2})/.exec(String(v || ''));
  return m ? Number(m[1].replace(/\./g, '') + '.' + m[2]) : null;
}
/** O tributo da DARF pelo nome final do arquivador ("09-2026 - DARF INSS - VALOR …"): 'INSS', 'IRRF'… ou '' */
function tributoDoNome(nome) {
  const m = /- DARF ([A-Z]+)/.exec(String(nome || '').toUpperCase());
  return m ? m[1] : '';
}

/**
 * O que vai no arquivo depois da leitura: a decisão do arquivador (d), os campos da guia (FGTS/DARF) e a entrada.
 * destino: as pastas a partir do Meu Drive ([ano, pasta do cliente, ...caminho]); vazio quando não dá para arquivar.
 */
function leituraDe(d, guia, entrada) {
  const arquivar = d.acao === 'ARQUIVAR' && d.pastaCliente && Array.isArray(d.caminho);
  return {
    acao: d.acao || 'NAO_IDENTIFICADO',
    motivo: d.motivo || '',
    cliente: Number.isInteger(d.cliente) ? d.cliente : null,
    clienteNome: d.clienteNome || '',
    tipo: d.tipo || '',
    tributo: d.tipo === 'DARF' ? tributoDoNome(d.nomeFinal) : '',
    competencia: competenciaIso(d.competencia || (guia && guia.competencia)),
    valor: (guia && guia.valor) || '',
    vencimento: (guia && guia.vencimento) || '',
    nomeFinal: d.nomeFinal || '',
    destino: arquivar ? [String(d.anoRaiz || ''), d.pastaCliente, ...d.caminho].filter(Boolean) : [],
    semTexto: !!(entrada && !(entrada.texto || []).join('').replace(/\s/g, '').length),
  };
}

/**
 * O que a pessoa decidiu na revisão vale sobre o que o leitor achou. Devolve { codigo, competencia, tipo, tributo, nome,
 * destino, valor } do arquivo, ou null quando ele fica fora do lote (marcado fora, ou sem cliente ou competência).
 * pastaDoCliente(codigo) -> o nome da pasta do cliente na raiz do ano (o mapa do Drive), ou '' (cria "<cód> - <nome>").
 */
function doArquivo(a, pastaDoCliente) {
  if (!a || a.fora) return null;
  const l = a.leitura || {};
  const e = a.escolha || null;
  // cliente 0 = ainda não escolhido na revisão
  const codigo = e && Number.isInteger(e.cliente) && e.cliente > 0 ? e.cliente : l.cliente;
  const competencia = (e && e.competencia) || l.competencia;
  if (!Number.isInteger(codigo) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia || '')) return null;
  const tipo = (e && e.tipo) || l.tipo || 'OUTRO';
  // mudou o cliente, o tipo ou a competência: a pasta do DP no mês, com o nome original; senão, a do arquivador
  const mudou = !!e && (codigo !== l.cliente || tipo !== l.tipo || competencia !== l.competencia);
  let destino = l.destino || [];
  let nome = l.nomeFinal || a.nome;
  if (mudou || !destino.length) {
    const pasta = pastaDoCliente(codigo) || (codigo + ' - ' + R.nomeSeguro(l.clienteNome || (e && e.clienteNome) || String(codigo)));
    destino = [competencia.slice(0, 4), pasta, 'DEPARTAMENTO PESSOAL', competencia.slice(5), PASTA_DO_TIPO[tipo] || ''].filter(Boolean);
    nome = a.nome;
  }
  return { codigo, competencia, tipo, tributo: mudou ? '' : l.tributo || '', nome, destino, valor: mudou ? null : valorNumero(l.valor) };
}

/** Os arquivos do lote por cliente e competência ('58_2026-10' -> [arquivo + vai]), e os que ficam de fora. */
function grupos(arquivos, pastaDoCliente) {
  const porChave = new Map();
  const fora = [];
  for (const a of arquivos) {
    const x = doArquivo(a, pastaDoCliente);
    if (!x) { fora.push(a); continue; }
    const chave = x.codigo + '_' + x.competencia;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push(Object.assign({}, a, { vai: x }));
  }
  return { porChave, fora };
}

/** Os valores do mês que o grupo traz para o sistema: o FGTS e a DARF do INSS (somados, se vier mais de uma guia). */
function valoresDoGrupo(itens) {
  const v = {};
  for (const i of itens) {
    const x = i.vai;
    if (x.valor == null) continue;
    if (x.tipo === 'FGTS') v.fgts = Math.round(((v.fgts || 0) + x.valor) * 100) / 100;
    else if (x.tipo === 'DARF' && x.tributo === 'INSS') v.darf = Math.round(((v.darf || 0) + x.valor) * 100) / 100;
  }
  return v;
}

// ---------- o banco e o Drive ----------

// o cadastro do arquivador na máquina do Google: o banco (Entregas + nads) e as pastas do mapa do Drive
let contexto = null;
async function contextoDoArquivador(db) {
  if (contexto && Date.now() - contexto.em < CADASTRO_VALE_MS) return contexto;
  const CAD = require('./arquivador-cadastro');
  const dados = await CAD.atualizar(db, path.join(os.tmpdir(), 'nads-lote-dp-cadastro.json'));
  const { linhas } = CAD.juntar({ planilha: [], entregas: dados.entregas || [], nads: dados.nads || [] });
  const raiz = (await db.collection('driveIndice').doc('raiz').get()).data() || {};
  const clientes = raiz.clientes || [];
  const cadastro = R.montarCadastro(linhas, clientes.map(c => c.nomePasta).filter(Boolean));
  R.comAnosEMapa(cadastro, new Map(), null);
  const pastas = new Map(clientes.filter(c => c.codigo).map(c => [Number(c.codigo), c.nomePasta]));
  contexto = { em: Date.now(), cadastro, pastaDoCliente: cod => pastas.get(Number(cod)) || '' };
  return contexto;
}

async function bufferDoArquivo(ref, a) {
  const n = Number(a.partes);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTES) throw new Error('quantidade de partes inválida');
  const snap = await ref.collection('partes').get();
  const pedacos = snap.docs.map(d => ({ n: Number(d.id), dados: d.get('dados') })).sort((x, y) => x.n - y.n);
  if (pedacos.length !== n || pedacos.some((p, i) => p.n !== i)) throw new Error('o arquivo não chegou inteiro');
  const buffer = Buffer.concat(pedacos.map(p => Buffer.from(p.dados || [])));
  if (buffer.length !== Number(a.tamanho)) throw new Error('o arquivo chegou incompleto');
  return buffer;
}
async function apagarPartes(ref) {
  const snap = await ref.collection('partes').get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

async function quemPode(db, uid) {
  const u = uid ? ((await db.collection('usuarios').doc(String(uid)).get()).data() || {}) : {};
  const papeis = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
  return papeis.includes('admin') || papeis.includes('dp') || u.departamento === 'dp';
}

// 2. a leitura
async function lerLote(db, ref, lote, log) {
  if (!(await quemPode(db, lote.criadoPorUid))) throw new Error('só o DP e o administrador sobem lote do DP');
  await ref.update({ status: 'lendo', lendoEm: new Date().toISOString() });
  const ctx = await contextoDoArquivador(db);
  const novo = require('./arquivador-novo');
  const docs = (await ref.collection('arquivos').get()).docs.slice(0, MAX_ARQUIVOS);
  let lidos = 0;
  for (const doc of docs) {
    const a = doc.data();
    if (a.status !== 'pendente') continue;
    try {
      const buffer = await bufferDoArquivo(doc.ref, a);
      const entrada = await novo.montarEntrada(String(a.nome || 'arquivo.pdf'), String(a.nome || ''), buffer);
      const d = R.decidir(entrada, { cadastro: ctx.cadastro, hoje: new Date() });
      const u = R.norm((entrada.texto || []).slice(0, 3).join('\n'));
      const guia = d.tipo === 'FGTS' || d.tipo === 'DARF' ? R.camposDaGuia(u) : null;
      await doc.ref.update({ status: 'lido', leitura: leituraDe(d, guia, entrada), hash: entrada.hash || '' });
    } catch (err) {
      await doc.ref.update({ status: 'erro', erro: String(err.message || err).slice(0, 300) });
    }
    lidos++;
    if (lidos % 5 === 0) await ref.update({ lidos }).catch(() => {});
  }
  await ref.update({ status: 'lido', lidos, lidoEm: new Date().toISOString() });
  log('lote do DP:', lidos, 'arquivo(s) lido(s) (' + (lote.criadoPor || '?') + ')');
  painel.atividade('gmail', 'Leu o lote do DP (' + lidos + ' arquivos)', lote.criadoPor ? 'pedido de ' + lote.criadoPor : '');
}

// 3. o disparo: um e-mail por cliente e competência, o Drive e o registro do envio
async function dispararLote(db, ref, lote, deps) {
  const { log } = deps;
  if (!(await quemPode(db, lote.disparadoPorUid))) throw new Error('só o DP e o administrador disparam o lote do DP');
  await ref.update({ status: 'disparando', disparandoEm: new Date().toISOString() });
  const ctx = await contextoDoArquivador(db);
  const docs = (await ref.collection('arquivos').get()).docs;
  const arquivos = docs.map(d => Object.assign({ id: d.id, ref: d.ref }, d.data())).filter(a => a.status === 'lido' || a.escolha);
  const { porChave } = grupos(arquivos, ctx.pastaDoCliente);
  const ativos = await require('./clientes-cache').clientesAtivos(db, m => log(m));
  const drive = deps.getDrive();
  const DA = require('./drive-arquivos');
  let enviados = 0;
  let erros = 0;
  for (const [chave, itens] of porChave) {
    // disparar de novo (depois de corrigir o e-mail de quem deu erro) não manda outra vez para quem já recebeu
    if (lote.resultados && lote.resultados[chave] && lote.resultados[chave].status === 'enviado') { enviados++; continue; }
    const { codigo, competencia } = itens[0].vai;
    const resultado = { codigo, competencia, arquivos: itens.map(i => i.vai.nome), valores: valoresDoGrupo(itens) };
    try {
      const { cliente, para } = await dp.destinatarios(db, codigo, ativos);
      const nome = String(cliente.nome || '').trim();
      const anexos = [];
      for (const i of itens) anexos.push({ nome: i.vai.nome, mime: dp.mimeDe(i.vai.nome), buffer: await bufferDoArquivo(i.ref, i) });
      if (anexos.reduce((s, a) => s + a.buffer.length, 0) > dp.MAX_BYTES) throw new Error('os arquivos do cliente passam de 18 MB juntos');
      const cfg = deps.config ? await deps.config().catch(() => ({})) : {};
      const { gmailId, assunto } = await dp.mandarEmailDoDp(db, { comp: competencia, nome, para, anexos }, { enviar: deps.enviar, caixa: deps.caixa, assinatura: cfg.assinatura || 'Nilma Contabilidade' });
      const agora = new Date().toISOString();
      // o envio no histórico do cliente (e a Entrega marcada pela tela), como o do DP › Envios
      await db.collection('solicitacoesEmail').add({
        tipo: 'envioDp', origem: 'lote', lote: ref.id, status: 'enviado', competencia, codigo: String(codigo), empresa: nome, arquivos: [],
        para, enviados: anexos.map(a => a.nome), assunto, gmailId, enviadoEm: agora, criadoEm: agora,
        criadoPor: lote.disparadoPor || '', criadoPorUid: lote.disparadoPorUid || '',
      });
      // e no Drive, na pasta do cliente (sem sobrescrever: o mesmo arquivo de novo não duplica)
      const salvos = [];
      for (let k = 0; k < itens.length; k++) {
        try {
          const pastaId = await DA.garantirCaminho(drive, itens[k].vai.destino.map(p => String(p).normalize('NFC')));
          const nomeSalvo = await DA.salvarArquivo(drive, pastaId, itens[k].vai.nome, anexos[k].buffer);
          salvos.push({ nome: nomeSalvo || itens[k].vai.nome, pasta: itens[k].vai.destino.join('/'), jaEstava: !nomeSalvo });
        } catch (err) { salvos.push({ nome: itens[k].vai.nome, erro: String(err.message || err).slice(0, 200) }); }
      }
      Object.assign(resultado, { status: 'enviado', para, enviadoEm: agora, salvos });
      for (const i of itens) await apagarPartes(i.ref).catch(() => {});
      enviados++;
    } catch (err) {
      Object.assign(resultado, { status: 'erro', erro: String(err.message || err).slice(0, 300) });
      erros++;
    }
    await ref.update({ ['resultados.' + chave]: resultado });
  }
  await ref.update({ status: 'disparado', disparadoEm: new Date().toISOString(), enviados, erros });
  log('lote do DP: disparado para', enviados, 'cliente(s)' + (erros ? ', ' + erros + ' com erro' : ''));
  painel.atividade('gmail', 'Disparou o lote do DP (' + enviados + ' clientes' + (erros ? ', ' + erros + ' com erro' : '') + ')', lote.disparadoPor ? 'pedido de ' + lote.disparadoPor : '');
}

// deps: { enviar(dados), getDrive(), config() (a assinatura: config/cobranca), caixa, log }
function iniciarLoteDp(db, deps) {
  const { log } = deps;
  let ocupado = false;
  let deNovo = false;
  async function atender() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        const snap = await db.collection(COLECAO).where('status', 'in', ['pendente', 'disparar']).get();
        for (const doc of snap.docs.sort((a, b) => String(a.get('criadoEm')).localeCompare(String(b.get('criadoEm'))))) {
          const lote = doc.data();
          try {
            if (lote.status === 'pendente') await lerLote(db, doc.ref, lote, log);
            else await dispararLote(db, doc.ref, lote, deps);
          } catch (err) {
            log('lote do DP', doc.id, 'deu erro:', err.message);
            painel.erro('gmail', 'O lote do DP deu erro', err.message);
            await doc.ref.update({ status: 'erro', erro: String(err.message || err).slice(0, 300), erroEm: new Date().toISOString() }).catch(() => {});
          }
        }
      } while (deNovo);
    } catch (err) { log('lote do DP: não li a fila:', err.message); } finally { ocupado = false; }
  }
  ouvir('Lote do DP', () => db.collection(COLECAO).where('status', 'in', ['pendente', 'disparar']), () => { void atender(); }, log);
  // o lote esquecido some, com os arquivos e os pedaços
  setInterval(async () => {
    try {
      const velhos = await db.collection(COLECAO).where('criadoEm', '<', new Date(Date.now() - ESQUECIDO_MS).toISOString()).limit(10).get();
      for (const d of velhos.docs) await db.recursiveDelete(d.ref);
    } catch (e) { /* tenta de novo depois */ }
  }, 6 * 36e5);
  log('lote do DP: ligado');
}

module.exports = {
  iniciarLoteDp,
  // puras, pro teste
  competenciaIso, valorNumero, tributoDoNome, leituraDe, doArquivo, grupos, valoresDoGrupo, PASTA_DO_TIPO, COLECAO,
};
