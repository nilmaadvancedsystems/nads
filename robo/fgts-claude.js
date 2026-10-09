// A guia do FGTS Digital pelo Claude do PC (Vitor, 09/10/2026: "o Claude vai salvar na pasta do Claudio Secretario,
// após isso você vai rodar uma rotina de arquivamento personalizada só para salvar as guias baixadas na pasta do
// cliente, e depois a parte do DP vai ler, informar e disponibilizar o download; o DP deve ter acesso a como está indo
// a emissão como no robô").
//
// Por que o Claude e não o robô do navegador: o gov.br segura a verificação do navegador controlado por programa, mas
// no Chrome de quem usa o PC (logado com o certificado do escritório) ele entra direto. O Claude do PC, pelo Claude in
// Chrome, abre um grupo de abas nesse Chrome e faz o caminho do portal como uma pessoa faria.
//
// O caminho (visto em 09/10/2026, com a 277): o perfil Procurador e o CNPJ do cliente (Definir Perfil ou Trocar
// Perfil) → GESTÃO DE GUIAS → EMISSÃO DE GUIA RÁPIDA → a Competência de Apuração → Pesquisar → Emitir guia. O PDF
// baixa sozinho, com o número da guia no nome, na pasta de downloads do Chrome (G:\Meu Drive\Claudio Secretario).
//
// O arquivamento: o PDF sai do Claudio Secretario para a pasta do cliente no Drive,
// <ano>\<cód> - <nome>\DEPARTAMENTO PESSOAL\<MM>\FGTS\FGTS <MM>-<ano> <número>.pdf (cria as pastas que faltarem), e
// vai para o pedido (pedidosFgts/{id}/arquivo/pdf) para o DP baixar no nads.
//
// O andamento: o Claude escreve PASSO: … a cada etapa; cada passo entra no pedido, e a tela do DP mostra ao vivo.
// Nunca faz verificação de robô nem login: se o gov.br pedir login ou "não sou um robô", o pedido para com o motivo.
// Um pedido por vez.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ouvir } = require('./ouvinte');

const CLAUDE = process.env.CLAUDE_EXE || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const BAIXADOS = path.join(DRIVE, 'Claudio Secretario');
const MODELO = process.env.FGTS_MODELO || 'sonnet';
const LIMITE_MS = 8 * 60 * 1000;
const PORTAL = 'https://fgtsdigital.sistema.gov.br/portal/servicos';

const agora = () => new Date().toISOString();
const dormir = ms => new Promise(r => setTimeout(r, ms));
const cnpjValido = c => /^\d{14}$/.test(String(c || ''));
const competenciaValida = c => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''));
const semProibidos = t => String(t || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

/** Sem as variáveis de uma sessão do Claude que tenha ligado este programa (a do arquivador faz igual). */
function ambienteLimpo() {
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach(k => { if (/^CLAUDE_?CODE|^CLAUDECODE$|^ANTHROPIC_/.test(k)) delete env[k]; });
  return env;
}

/** O que o Claude faz, passo a passo; termina com RESULTADO: {json}. */
function instrucoes(p, modo) {
  const [ano, mes] = p.competencia.split('-');
  const cnpj = p.cnpj;
  return [
    'Você está emitindo a guia mensal do FGTS de um cliente no portal FGTS Digital, usando as ferramentas do Claude in Chrome.',
    'O Chrome deste PC já está logado no gov.br com o certificado do escritório (NILMA CONTABILIDADE, procuradora dos clientes).',
    '',
    'Cliente: ' + (p.empresa || '') + ' — CNPJ ' + cnpj + '. Competência de apuração: ' + mes + '/' + ano + '.',
    '',
    'Faça exatamente assim, numa aba do seu grupo:',
    '1. Abra ' + PORTAL + '.',
    '2. Se aparecer a tela de login do gov.br ou "Entrar com gov.br", NÃO faça login: pare e responda RESULTADO: {"erro":"login"}.',
    '   Se aparecer qualquer verificação "não sou um robô"/captcha, NÃO resolva: pare e responda RESULTADO: {"erro":"captcha"}.',
    '3. Escolha o perfil do cliente: na janela "Definir Perfil" (ou pelo botão "Trocar Perfil" no alto), abra a lista Perfil, escolha',
    '   "Procurador", digite o CNPJ ' + cnpj + ' em "Empregador a ser representado" e clique em Definir/Selecionar. Confira que o alto',
    '   da página mostra "Empregador: ' + cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') + '". Se o portal disser que não há procuração, responda RESULTADO: {"erro":"sem procuração"}.',
    '4. Clique no cartão GESTÃO DE GUIAS e depois em EMISSÃO DE GUIA RÁPIDA (sempre a Guia Rápida).',
    '5. Em "Competência de Apuração", abra a lista e escolha ' + mes + '/' + ano + '. Se essa competência não estiver na lista, responda',
    '   RESULTADO: {"erro":"sem débito em aberto na competência"}. Deixe os tipos de débito como estão e clique em Pesquisar.',
    '6. Leia o Resumo da Pesquisa: o Total Devedor e o vencimento da guia.',
    modo === 'emitir'
      ? '7. Clique em "Emitir guia" (uma vez só). O PDF baixa sozinho. Leia o número da guia que aparece ao lado do vencimento.'
      : '7. NÃO clique em "Emitir guia" (é só um ensaio).',
    '',
    'A cada etapa, escreva uma linha começando com "PASSO: " dizendo o que fez (ex.: PASSO: perfil do cliente definido).',
    'No fim, escreva uma linha só:',
    modo === 'emitir'
      ? 'RESULTADO: {"numero":"<número da guia>","valor":"<total, ex. 917,42>","vencimento":"<dd/mm/aaaa>"}'
      : 'RESULTADO: {"ensaio":true,"valor":"<total>","vencimento":"<dd/mm/aaaa>"}',
    'Se algo der errado, RESULTADO: {"erro":"<o que aconteceu, curto>"}. Não faça nada além disso no portal.',
  ].join('\n');
}

/** A pasta do cliente no Drive: a que começa com "<cód> - "; se não houver, cria "<cód> - <nome>". */
function pastaDoCliente(ano, codigo, empresa) {
  const raiz = path.join(DRIVE, ano);
  fs.mkdirSync(raiz, { recursive: true });
  const achada = fs.readdirSync(raiz, { withFileTypes: true }).find(d => d.isDirectory() && d.name.startsWith(codigo + ' - '));
  return path.join(raiz, achada ? achada.name : semProibidos(codigo + ' - ' + empresa));
}

/** O arquivamento: do Claudio Secretario para <cliente>\DEPARTAMENTO PESSOAL\<MM>\FGTS. Devolve o caminho novo. */
function arquivarGuia(arquivo, p, numero) {
  const [ano, mes] = p.competencia.split('-');
  const destino = path.join(pastaDoCliente(ano, String(p.codigo || ''), p.empresa || ''), 'DEPARTAMENTO PESSOAL', mes, 'FGTS');
  fs.mkdirSync(destino, { recursive: true });
  const final = path.join(destino, 'FGTS ' + mes + '-' + ano + ' ' + numero + '.pdf');
  try { fs.renameSync(arquivo, final); } catch (_) { fs.copyFileSync(arquivo, final); fs.rmSync(arquivo, { force: true }); }
  return final;
}

/** Espera o PDF da guia chegar no Claudio Secretario (o Chrome baixa com o número no nome). */
async function esperarPdf(numero, desde, ms) {
  const digitos = String(numero || '').replace(/\D/g, '');
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    try {
      const pdfs = fs.readdirSync(BAIXADOS).filter(n => /\.pdf$/i.test(n) && !/\.crdownload$/i.test(n))
        .map(n => ({ n, f: path.join(BAIXADOS, n), t: fs.statSync(path.join(BAIXADOS, n)).mtimeMs }))
        .filter(x => x.t >= desde - 2000);
      const certo = pdfs.find(x => digitos && x.n.replace(/\D/g, '').includes(digitos)) || (pdfs.length === 1 ? pdfs[0] : null);
      if (certo) return certo.f;
    } catch (_) { /* a pasta do Drive pode demorar */ }
    await dormir(1500);
  }
  return null;
}

function iniciarFgtsPeloClaude(db, log) {
  const estado = db.collection('robo').doc('fgts');
  const pedidos = db.collection('pedidosFgts');
  const marcar = dados => estado.set(Object.assign({ atualizadoEm: agora() }, dados), { merge: true }).catch(() => {});

  if (!fs.existsSync(CLAUDE)) { marcar({ ligado: false, motivo: 'falta o Claude no PC do escritório' }); log('FGTS: desligado (falta o Claude em ' + CLAUDE + ')'); return; }
  if (!fs.existsSync(BAIXADOS)) { marcar({ ligado: false, motivo: 'falta a pasta Claudio Secretario no Drive do PC' }); log('FGTS: desligado (falta ' + BAIXADOS + ')'); return; }
  let cert = null;
  try { const c = require('./fgts-digital').lerCertificadoDoWindows(); cert = c.erro ? null : c; } catch (_) { /* sem certificado lido, segue */ }
  marcar({ ligado: true, motivo: '', onde: 'pc-claude', certificado: cert });
  log('FGTS: ligado pelo Claude do PC (Claude in Chrome)' + (cert ? ', certificado até ' + cert.validade : ''));

  // pedido que ficou no meio quando o robô reiniciou (09/10/2026: outra atualização do arquivador derrubou uma
  // emissão no meio): volta para a fila uma vez sozinho; na segunda, fica como erro para a pessoa pedir de novo
  pedidos.where('status', 'in', ['trabalhando', 'verificacao', 'login']).get().then(s => Promise.all(s.docs.map(d => {
    const tentativas = Number(d.data().tentativas || 0);
    return tentativas < 1
      ? d.ref.update({ status: 'pendente', tentativas: tentativas + 1, passos: [] })
      : d.ref.update({ status: 'erro', erro: 'o robô reiniciou no meio duas vezes; peça de novo', fimEm: agora() });
  }))).catch(() => {});

  const fila = [];
  let ocupado = false;
  async function proximo() {
    if (ocupado || !fila.length) return;
    ocupado = true;
    const doc = fila.shift();
    try { await atender(doc); } catch (err) { log('FGTS: erro no pedido', doc.id, err.message); }
    ocupado = false;
    proximo();
  }
  ouvir('pedidos do FGTS', () => pedidos.where('status', '==', 'pendente'), snap => {
    for (const ch of snap.docChanges()) if (ch.type === 'added' && !fila.some(d => d.id === ch.doc.id)) fila.push(ch.doc);
    proximo();
  }, log);

  async function atender(doc) {
    const p = doc.data();
    const ref = doc.ref;
    const modo = p.modo === 'emitir' ? 'emitir' : 'ensaio';
    if (!cnpjValido(p.cnpj)) return ref.update({ status: 'erro', erro: 'CNPJ inválido', fimEm: agora() });
    if (!competenciaValida(p.competencia)) return ref.update({ status: 'erro', erro: 'competência inválida', fimEm: agora() });
    const passos = [];
    const passo = nome => {
      passos.push({ n: passos.length + 1, nome: String(nome).slice(0, 200), url: '', texto: '', quando: agora() });
      return ref.update({ passos }).catch(() => {});
    };
    await ref.update({ status: 'trabalhando', inicioEm: agora(), passos: [] });
    log('FGTS (Claude):', modo, p.cnpj, p.competencia, '(' + (p.empresa || '') + ')');
    await passo('o Claude abriu o FGTS Digital no Chrome do PC');
    const desde = Date.now();

    const r = await rodarClaude(instrucoes(p, modo), linha => { void passo(linha); });
    if (!r.resultado) {
      await ref.update({ status: 'erro', erro: 'o Claude não terminou: ' + (r.erro || 'sem resposta').slice(0, 300), fimEm: agora() });
      log('FGTS (Claude): sem resultado', p.cnpj, r.erro || '');
      return;
    }
    const res = r.resultado;
    if (res.erro) {
      const motivo = res.erro === 'login' ? 'o Chrome do PC não está logado no FGTS Digital: entre com o certificado e peça de novo'
        : res.erro === 'captcha' ? 'o gov.br pediu a verificação "não sou um robô" no Chrome do PC: faça o login lá e peça de novo'
          : String(res.erro);
      await ref.update({ status: 'erro', erro: motivo, fimEm: agora() });
      log('FGTS (Claude): erro', p.cnpj, motivo);
      return;
    }
    if (modo === 'ensaio') {
      await ref.update({ status: 'pronto', resultado: 'ensaio: total R$ ' + (res.valor || '?') + ', vence ' + (res.vencimento || '?') + ' (nada emitido)', fimEm: agora() });
      log('FGTS (Claude): ensaio ok', p.cnpj);
      return;
    }
    await passo('esperando o PDF da guia ' + (res.numero || '') + ' no Claudio Secretario');
    const baixado = await esperarPdf(res.numero, desde, 90000);
    if (!baixado) {
      await ref.update({ status: 'erro', erro: 'a guia ' + (res.numero || '') + ' foi emitida, mas o PDF não chegou no Claudio Secretario', fimEm: agora() });
      return;
    }
    const pdf = fs.readFileSync(baixado);
    if (pdf.slice(0, 4).toString() !== '%PDF') {
      await ref.update({ status: 'erro', erro: 'o arquivo baixado não é um PDF', fimEm: agora() });
      return;
    }
    const final = arquivarGuia(baixado, p, res.numero || 'sem-numero');
    await passo('arquivada em ' + path.relative(DRIVE, final));
    const nome = path.basename(final);
    await ref.collection('arquivo').doc('pdf').set({ base64: pdf.toString('base64'), nome, tamanho: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex'), quando: agora() });
    await ref.update({
      status: 'pronto', pdfNome: nome, fimEm: agora(), numeroGuia: res.numero || '', valor: res.valor || '', vencimento: res.vencimento || '',
      resultado: 'guia ' + (res.numero || '') + ' · R$ ' + (res.valor || '?') + ' · vence ' + (res.vencimento || '?'),
      arquivadaEm: path.relative(DRIVE, final),
    });
    log('FGTS (Claude): guia emitida', p.cnpj, p.competencia, res.numero || '');
  }

  /** Roda o Claude do PC com o Claude in Chrome; cada "PASSO: …" vai para aoPasso; devolve o RESULTADO. */
  function rodarClaude(texto, aoPasso) {
    return new Promise(resolve => {
      const filho = spawn(CLAUDE, ['-p', texto, '--chrome', '--model', MODELO, '--permission-mode', 'bypassPermissions',
        '--output-format', 'stream-json', '--verbose', '--no-session-persistence'], { cwd: __dirname, windowsHide: true, env: ambienteLimpo(), stdio: ['ignore', 'pipe', 'pipe'] });
      let resto = '', erros = '', resultado = null, final = '';
      const vistos = new Set();
      const lerTexto = t => {
        for (const linha of String(t).split('\n')) {
          const l = linha.trim();
          const m = l.match(/^PASSO:\s*(.+)$/);
          if (m && !vistos.has(m[1])) { vistos.add(m[1]); aoPasso(m[1]); }
          const r = l.match(/^RESULTADO:\s*(\{.*\})\s*$/);
          if (r) { try { resultado = JSON.parse(r[1]); } catch (_) { /* resultado mal escrito */ } }
        }
      };
      filho.stdout.on('data', b => {
        resto += String(b);
        const linhas = resto.split('\n');
        resto = linhas.pop();
        for (const l of linhas) {
          let ev = null; try { ev = JSON.parse(l); } catch (_) { continue; }
          if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) for (const c of ev.message.content) if (c.type === 'text') lerTexto(c.text);
          if (ev.type === 'result') { final = String(ev.result || ''); lerTexto(final); }
        }
      });
      filho.stderr.on('data', b => { erros += String(b); if (erros.length > 3000) erros = erros.slice(-3000); });
      const relogio = setTimeout(() => { try { filho.kill(); } catch (_) {} }, LIMITE_MS);
      filho.on('error', err => { clearTimeout(relogio); resolve({ resultado: null, erro: err.message }); });
      filho.on('close', () => { clearTimeout(relogio); resolve({ resultado, erro: resultado ? '' : (final || erros).slice(-300) }); });
    });
  }
}

module.exports = { iniciarFgtsPeloClaude };
