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
// o atalho da Emissão de Guia Rápida (o endereço da tela, visto em 09/10/2026): pula os dois cliques do menu
const GUIA_RAPIDA = 'https://fgtsdigital.sistema.gov.br/cobranca/#/gestao-guias/emissao-guia-rapida';

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

/**
 * O que o Claude faz, para o lote inteiro numa sessão só (Vitor, 09/10/2026: "tem como acelerar a emissão?"): entra uma
 * vez e, para cada cliente, só troca o perfil e emite. Escreve PASSO [cnpj]: … a cada etapa e RESULTADO [cnpj]: {json}
 * ao terminar cada cliente.
 */
// O roteiro dentro da página (Vitor, 09/10/2026: "acelerar mais"): em vez de o Claude clicar passo a passo, ele roda
// estes dois trechos de JavaScript na aba do portal, um por cliente. Vistos no portal em 09/10/2026: a lista Perfil e a
// Competência de Apuração são ng-select (abrem com mousedown no .ng-select-container; opções em .ng-option); o CNPJ tem
// máscara (00.000.000/0000-00); Definir troca de página; a pesquisa leva ~1 s; o número da guia tem 16 dígitos e o
// dígito (0126100966359791-5).
function roteiroPerfil(cnpj) {
  const formatado = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return `await (async () => {
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const visivel = e => e && e.offsetParent !== null;
  const botao = t => [...document.querySelectorAll('button')].find(b => visivel(b) && b.innerText.trim() === t);
  for (let i = 0; i < 20 && !botao('Trocar Perfil') && !visivel(document.querySelector('input[role=combobox]')); i++) await dormir(300);
  if (!visivel(document.querySelector('input[role=combobox]'))) { const tp = botao('Trocar Perfil'); if (!tp) return 'ERRO: sem Trocar Perfil'; tp.click(); await dormir(600); }
  const sel = [...document.querySelectorAll('ng-select')].find(visivel);
  if (!sel) return 'ERRO: sem a lista Perfil';
  sel.querySelector('.ng-select-container').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await dormir(400);
  const op = [...document.querySelectorAll('.ng-option')].find(o => o.innerText.trim() === 'Procurador');
  if (!op) return 'ERRO: sem a opção Procurador';
  op.click(); await dormir(500);
  const campo = [...document.querySelectorAll('input')].find(i => visivel(i) && /CNPJ ou CPF/i.test(i.placeholder || ''));
  if (!campo) return 'ERRO: sem o campo do CNPJ';
  campo.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(campo, '${formatado}');
  campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('blur', { bubbles: true }));
  await dormir(300);
  const ok = botao('Definir') || botao('Selecionar');
  if (!ok) return 'ERRO: sem o botão Definir';
  setTimeout(() => ok.click(), 100);
  return 'OK: definindo ${formatado}';
})()`;
}

function roteiroGuia(cnpj, competencia, emitir) {
  const [ano, mes] = competencia.split('-');
  const formatado = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return `await (async () => {
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const visivel = e => e && e.offsetParent !== null;
  for (let i = 0; i < 20 && ![...document.querySelectorAll('ng-select')].some(visivel); i++) await dormir(300);
  if (!document.body.innerText.includes('${formatado}')) return JSON.stringify({ erro: 'o perfil não é o do cliente' });
  const sel = [...document.querySelectorAll('ng-select')].find(visivel);
  if (!sel) return JSON.stringify({ erro: 'roteiro: sem a lista de competência' });
  sel.querySelector('.ng-select-container').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await dormir(400);
  const op = [...document.querySelectorAll('.ng-option')].find(o => o.innerText.trim() === '${mes}/${ano}');
  if (!op) return JSON.stringify({ erro: 'sem débito em aberto na competência' });
  op.click(); await dormir(300);
  const pesquisar = [...document.querySelectorAll('button')].find(b => visivel(b) && b.innerText.trim() === 'Pesquisar');
  if (!pesquisar) return JSON.stringify({ erro: 'roteiro: sem o Pesquisar' });
  pesquisar.click();
  let txt = '';
  for (let i = 0; i < 50; i++) { await dormir(300); txt = document.body.innerText; if (/Total Devedor/.test(txt) && /Vencimento da Guia/.test(txt)) break; }
  const valor = (txt.match(/Total Devedor\\s*R\\$\\s*([\\d.,]+)/) || [])[1] || '';
  const vencimento = (txt.match(/Vencimento da Guia:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/) || [])[1] || '';
  if (!valor) return JSON.stringify({ erro: 'roteiro: a pesquisa não mostrou o total' });
  if (!${emitir ? 'true' : 'false'}) return JSON.stringify({ ensaio: true, valor, vencimento });
  const emitirBotao = [...document.querySelectorAll('button')].find(b => visivel(b) && b.innerText.trim() === 'Emitir guia');
  if (!emitirBotao) return JSON.stringify({ erro: 'roteiro: sem o Emitir guia' });
  emitirBotao.click();
  let numero = '';
  for (let i = 0; i < 60 && !numero; i++) { await dormir(500); numero = (document.body.innerText.match(/(\\d{16}-\\d)/) || [])[1] || ''; }
  if (!numero) return JSON.stringify({ erro: 'roteiro: a guia não mostrou o número' });
  return JSON.stringify({ numero, valor, vencimento });
})()`;
}

function instrucoesDoLote(itens) {
  const lista = itens.map((p, i) => {
    const [ano, mes] = p.competencia.split('-');
    return (i + 1) + '. ' + (p.empresa || '') + ' — CNPJ ' + p.cnpj + ' — competência ' + mes + '/' + ano + ' — ' + (p.modo === 'emitir' ? 'EMITIR' : 'ENSAIO (não emitir)');
  });
  return [
    'Você vai emitir guias mensais do FGTS no portal FGTS Digital, usando as ferramentas do Claude in Chrome, para estes clientes,',
    'nesta ordem, numa aba só do seu grupo:',
    ...lista,
    '',
    'O Chrome deste PC usa o certificado do escritório (NILMA CONTABILIDADE, procuradora dos clientes). Seja rápido: para ler a',
    'página prefira o texto e a busca de elementos a tirar print; tire print só quando precisar ver onde clicar.',
    '',
    'Uma vez, no começo:',
    'A. Abra ' + PORTAL + '.',
    'B. Se o portal pedir login: clique em "Entrar com gov.br" e depois em "Seu certificado digital" (o Chrome escolhe sozinho o',
    '   certificado da NILMA; nunca digite CPF, senha ou código). Espere voltar ao portal. Se aparecer qualquer verificação',
    '   "não sou um robô"/captcha, NÃO resolva: pare tudo e responda RESULTADO: {"erro":"captcha"}. Se não voltar ao portal em',
    '   1 minuto, pare tudo e responda RESULTADO: {"erro":"login"}.',
    '',
    'Para cada cliente da lista, o CAMINHO RÁPIDO (use a ferramenta de rodar JavaScript na página, com o código exato abaixo):',
    '  a) abra ' + PORTAL + ' na aba e rode o ROTEIRO PERFIL do cliente; ele responde "OK: …" e a página troca sozinha (se a',
    '     ferramenta reclamar que a página navegou, é o esperado). Espere 2 segundos.',
    '  b) abra ' + GUIA_RAPIDA + ' e rode o ROTEIRO GUIA do cliente; ele responde um JSON. Esse JSON é o resultado do cliente:',
    '     escreva RESULTADO [<cnpj>]: <o JSON> (ex.: RESULTADO [27361015000131]: {"numero":"…","valor":"…","vencimento":"…"}).',
    '  Se um roteiro responder começando com "ERRO" ou com {"erro":"roteiro: …"}, faça aquele cliente pelo caminho manual abaixo.',
    '  Se responder {"erro":"sem débito em aberto na competência"} ou {"erro":"o perfil não é o do cliente"}, esse é o resultado dele.',
    '',
    'Os roteiros de cada cliente:',
    ...itens.map(p => ['--- ' + p.cnpj + ' — ROTEIRO PERFIL:', roteiroPerfil(p.cnpj), '--- ' + p.cnpj + ' — ROTEIRO GUIA:', roteiroGuia(p.cnpj, p.competencia, p.modo === 'emitir')].join('\n')),
    '',
    'O CAMINHO MANUAL (só quando um roteiro falhar), para aquele cliente:',
    '1. Escolha o perfil do cliente: na janela "Definir Perfil" ou pelo botão "Trocar Perfil" no alto, abra a lista Perfil, escolha',
    '   "Procurador", digite o CNPJ em "Empregador a ser representado" e clique em Definir/Selecionar. Confira que o alto da página',
    '   mostra "Empregador:" com o CNPJ dele. Se o portal disser que não há procuração, o resultado dele é {"erro":"sem procuração"}.',
    '2. Abra ' + GUIA_RAPIDA + ' (a Emissão de Guia Rápida; se não abrir, use o cartão GESTÃO DE GUIAS e EMISSÃO DE GUIA RÁPIDA).',
    '3. Em "Competência de Apuração", abra a lista e escolha a competência do cliente. Se ela não estiver na lista, o resultado',
    '   dele é {"erro":"sem débito em aberto na competência"}. Deixe os tipos de débito como estão e clique em Pesquisar.',
    '4. Leia o Total Devedor e o vencimento da guia.',
    '5. Se o cliente é EMITIR: clique em "Emitir guia" (uma vez só); o PDF baixa sozinho; leia o número da guia ao lado do',
    '   vencimento. Se é ENSAIO: NÃO clique em "Emitir guia".',
    '6. Escreva a linha do resultado dele e siga para o próximo cliente (um erro num cliente não para os outros).',
    '',
    'Escreva, sempre numa linha só e com o CNPJ só em números entre colchetes:',
    '  a cada etapa: PASSO [<cnpj>]: <o que fez>          (ex.: PASSO [27361015000131]: perfil do cliente definido)',
    '  no fim de cada cliente que EMITIR: RESULTADO [<cnpj>]: {"numero":"<número da guia>","valor":"<total, ex. 917,42>","vencimento":"<dd/mm/aaaa>"}',
    '  no fim de cada cliente ENSAIO: RESULTADO [<cnpj>]: {"ensaio":true,"valor":"<total>","vencimento":"<dd/mm/aaaa>"}',
    '  se der errado com um cliente: RESULTADO [<cnpj>]: {"erro":"<o que aconteceu, curto>"}',
    'Não faça nada além disso no portal.',
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

const CHROME = process.env.FGTS_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/** O Chrome de quem usa o PC está aberto? Se não, abre (normal, no perfil de sempre) e espera a extensão. true = abriu. */
async function abrirChromeSeFechado() {
  let aberto = false;
  try { aberto = /chrome\.exe/i.test(require('child_process').execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/NH'], { encoding: 'utf8', windowsHide: true })); } catch (_) { /* sem tasklist: tenta abrir */ }
  if (aberto || !fs.existsSync(CHROME)) return false;
  spawn(CHROME, [PORTAL], { detached: true, stdio: 'ignore' }).unref();
  chromeAbertoPeloRobo = true;
  await dormir(20000);
  return true;
}

// o Chrome que o robô abriu fecha no fim da fila (Vitor, 09/10/2026: "quero que feche o Chrome depois disso"); o que já
// estava aberto (alguém usando) fica
let chromeAbertoPeloRobo = false;
function fecharChromeDoRobo(log) {
  if (!chromeAbertoPeloRobo) return;
  chromeAbertoPeloRobo = false;
  try { require('child_process').execFileSync('taskkill', ['/IM', 'chrome.exe'], { windowsHide: true, stdio: 'ignore' }); log('FGTS: fechei o Chrome que eu tinha aberto'); } catch (_) { /* já fechado */ }
}

/** O Claude disse que a extensão do Chrome não estava conectada (ou não achou o navegador). */
function extensaoFora(r) {
  const t = String((r.resultado && r.resultado.erro) || r.erro || '').toLowerCase();
  return /extens|n[aã]o (est[aá] )?conectad|not connected|browser/.test(t) && !(r.resultado && (r.resultado.numero || r.resultado.ensaio));
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
    // o lote: todos os pedidos que estão na fila agora, numa sessão só do Claude (até 25 por vez)
    const lote = fila.splice(0, 25);
    try { await atenderLote(lote); } catch (err) { log('FGTS: erro no lote', err.message); }
    ocupado = false;
    // o Chrome fica aberto e logado depois do lote (Vitor, 09/10/2026: a opção 3, "deixar o Chrome aberto e logado"): a
    // próxima emissão já pega o login; o fecharChromeDoRobo fica guardado se voltar a ser pedido
    proximo();
  }
  ouvir('pedidos do FGTS', () => pedidos.where('status', '==', 'pendente'), snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'added' && !fila.some(d => d.id === ch.doc.id)) fila.push(ch.doc);
      // cancelado (ou pego) enquanto esperava: sai da fila (09/10/2026: o botão Cancelar do DP)
      if (ch.type === 'removed') { const i = fila.findIndex(d => d.id === ch.doc.id); if (i >= 0) fila.splice(i, 1); }
    }
    // espera um instante para juntar os pedidos que chegam juntos (o "Emitir as que faltam" pede um por um)
    setTimeout(proximo, 3000);
  }, log);

  async function atenderLote(docs) {
    // os pedidos do lote, cada um com os passos dele no pedido (a tela do DP acompanha ao vivo)
    const itens = [];
    for (const doc of docs) {
      const p = doc.data();
      if (!cnpjValido(p.cnpj)) { await doc.ref.update({ status: 'erro', erro: 'CNPJ inválido', fimEm: agora() }); continue; }
      if (!competenciaValida(p.competencia)) { await doc.ref.update({ status: 'erro', erro: 'competência inválida', fimEm: agora() }); continue; }
      const item = { p: Object.assign({}, p, { modo: p.modo === 'emitir' ? 'emitir' : 'ensaio' }), ref: doc.ref, passos: [], fim: false, comecou: false, tarefa: null };
      item.passo = nome => {
        item.passos.push({ n: item.passos.length + 1, nome: String(nome).slice(0, 200), url: '', texto: '', quando: agora() });
        return item.ref.update({ passos: item.passos }).catch(() => {});
      };
      itens.push(item);
    }
    if (!itens.length) return;
    const porCnpj = new Map(itens.map(it => [it.p.cnpj, it]));
    log('FGTS (Claude): lote de ' + itens.length + ' guia(s):', itens.map(it => it.p.cnpj).join(', '));
    for (const it of itens) await it.passo(itens.length > 1 ? 'no lote de ' + itens.length + ' guias; esperando a vez' : 'o Claude está abrindo o FGTS Digital');
    const desde = Date.now();
    if (await abrirChromeSeFechado()) for (const it of itens) await it.passo('o Chrome estava fechado: abri e esperei a extensão do Claude');

    // o Cancelar do DP no meio do lote: o cliente sai do lote (o resultado dele é ignorado); todos cancelados = para o Claude
    const vigias = itens.map(it => it.ref.onSnapshot(s => {
      if ((s.data() || {}).status !== 'cancelado' || it.fim) return;
      it.fim = true;
      it.cancelado = true;
      log('FGTS (Claude): cancelado pelo DP', it.p.cnpj);
      if (itens.every(x => x.fim) && processoAtual) { try { processoAtual.kill(); } catch (_) {} }
    }, () => {}));
    const comecar = it => {
      if (it.comecou || it.cancelado) return;
      it.comecou = true;
      void it.ref.update({ status: 'trabalhando', inicioEm: agora() }).catch(() => {});
    };
    let atual = itens[0];
    const aoPasso = (cnpj, texto) => {
      const it = (cnpj && porCnpj.get(cnpj)) || atual;
      if (!it || it.fim) return;
      atual = it;
      comecar(it);
      void it.passo(texto);
    };
    const aoResultado = (cnpj, res) => {
      if (!cnpj) {
        // erro geral (login ou captcha): vale para todos que ainda não terminaram
        for (const it of itens) if (!it.fim) { it.fim = true; it.tarefa = concluir(it, res, desde); }
        return;
      }
      const it = porCnpj.get(cnpj);
      if (!it || it.fim) return;
      it.fim = true;
      comecar(it);
      it.tarefa = concluir(it, res, desde);
    };
    const limite = 4 * 60 * 1000 + itens.length * 3 * 60 * 1000;
    let r = await rodarClaude(instrucoesDoLote(itens.map(it => it.p)), aoPasso, aoResultado, limite);
    // a extensão ainda não estava pronta (nenhum cliente começou): espera e tenta o lote de novo, uma vez
    if (!itens.some(it => it.comecou || it.fim) && extensaoFora(r)) {
      for (const it of itens) await it.passo('a extensão do Claude não respondeu; tentando de novo');
      await dormir(20000);
      r = await rodarClaude(instrucoesDoLote(itens.map(it => it.p)), aoPasso, aoResultado, limite);
    }
    for (const it of itens) {
      if (it.fim) continue;
      it.fim = true;
      const motivo = !it.comecou && extensaoFora(r)
        ? 'a extensão Claude in Chrome não está conectada no PC: abra o Chrome, clique no ícone do Claude e peça de novo'
        : 'o Claude não terminou este cliente' + (r.erro ? ': ' + r.erro.slice(0, 200) : '');
      it.tarefa = it.ref.update({ status: 'erro', erro: motivo, fimEm: agora() }).catch(() => {});
    }
    await Promise.all(itens.map(it => it.tarefa));
    vigias.forEach(parar => parar());
  }

  /** O fim de um cliente: o erro, o ensaio ou a guia (o PDF do Claudio Secretario arquivado e no pedido). */
  async function concluir(it, res, desde) {
    const { p, ref } = it;
    if (res.erro) {
      const motivo = res.erro === 'login' ? 'o login no FGTS Digital não foi no Chrome do PC: entre com o certificado lá e peça de novo'
        : res.erro === 'captcha' ? 'o gov.br pediu a verificação "não sou um robô" no Chrome do PC: faça o login lá e peça de novo'
          : String(res.erro);
      await ref.update({ status: 'erro', erro: motivo, fimEm: agora() });
      log('FGTS (Claude): erro', p.cnpj, motivo);
      return;
    }
    if (p.modo === 'ensaio') {
      await ref.update({ status: 'pronto', resultado: 'ensaio: total R$ ' + (res.valor || '?') + ', vence ' + (res.vencimento || '?') + ' (nada emitido)', fimEm: agora() });
      log('FGTS (Claude): ensaio ok', p.cnpj);
      return;
    }
    await it.passo('esperando o PDF da guia ' + (res.numero || '') + ' no Claudio Secretario');
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
    await it.passo('arquivada em ' + path.relative(DRIVE, final));
    const nome = path.basename(final);
    await ref.collection('arquivo').doc('pdf').set({ base64: pdf.toString('base64'), nome, tamanho: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex'), quando: agora() });
    await ref.update({
      status: 'pronto', pdfNome: nome, fimEm: agora(), numeroGuia: res.numero || '', valor: res.valor || '', vencimento: res.vencimento || '',
      resultado: 'guia ' + (res.numero || '') + ' · R$ ' + (res.valor || '?') + ' · vence ' + (res.vencimento || '?'),
      arquivadaEm: path.relative(DRIVE, final),
    });
    log('FGTS (Claude): guia emitida', p.cnpj, p.competencia, res.numero || '');
  }

  /**
   * Roda o Claude do PC com o Claude in Chrome. "PASSO [cnpj]: …" vai para aoPasso; "RESULTADO [cnpj]: {…}" para
   * aoResultado (sem o CNPJ: vale para o lote todo). Devolve o fim da conversa (para o erro de quando nada começou).
   */
  let processoAtual = null;
  function rodarClaude(texto, aoPasso, aoResultado, limiteMs) {
    return new Promise(resolve => {
      const filho = processoAtual = spawn(CLAUDE, ['-p', texto, '--chrome', '--model', MODELO, '--permission-mode', 'bypassPermissions',
        '--output-format', 'stream-json', '--verbose', '--no-session-persistence'], { cwd: __dirname, windowsHide: true, env: ambienteLimpo(), stdio: ['ignore', 'pipe', 'pipe'] });
      let resto = '', erros = '', final = '', algum = null;
      const vistos = new Set();
      const lerTexto = t => {
        for (const linha of String(t).split('\n')) {
          const l = linha.trim();
          const m = l.match(/^PASSO\s*(?:\[(\d{14})\])?\s*:\s*(.+)$/);
          if (m && !vistos.has(l)) { vistos.add(l); aoPasso(m[1] || '', m[2]); }
          const r = l.match(/^RESULTADO\s*(?:\[(\d{14})\])?\s*:\s*(\{.*\})\s*$/);
          if (r && !vistos.has(l)) {
            vistos.add(l);
            try { const res = JSON.parse(r[2]); algum = res; aoResultado(r[1] || '', res); } catch (_) { /* resultado mal escrito */ }
          }
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
      const relogio = setTimeout(() => { try { filho.kill(); } catch (_) {} }, limiteMs || LIMITE_MS);
      filho.on('error', err => { clearTimeout(relogio); resolve({ resultado: algum, erro: err.message }); });
      filho.on('close', () => { clearTimeout(relogio); processoAtual = null; resolve({ resultado: algum, erro: (final || erros).slice(-300) }); });
    });
  }
}

module.exports = { iniciarFgtsPeloClaude };
