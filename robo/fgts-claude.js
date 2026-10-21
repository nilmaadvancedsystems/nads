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
// o painel do robô (21/10/2026): o que está emitindo agora, as guias emitidas e os erros
const painel = require('./painel');
/** "62 EMPRESA (10/2026)" para o painel. */
const quemNoPainel = p => ((p.codigo ? p.codigo + ' ' : '') + (p.empresa || cnpjComPontos(p.cnpj || ''))).trim()
  + (/^\d{4}-\d{2}$/.test(String(p.competencia || '')) ? ' (' + p.competencia.slice(5) + '/' + p.competencia.slice(0, 4) + ')' : '');

const CLAUDE = process.env.CLAUDE_EXE || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const BAIXADOS = path.join(DRIVE, 'Claudio Secretario');
const MODELO = process.env.FGTS_MODELO || 'sonnet';
const LIMITE_MS = 8 * 60 * 1000;
const PORTAL = 'https://fgtsdigital.sistema.gov.br/portal/servicos';
// o atalho da Emissão de Guia Rápida (o endereço da tela, visto em 09/10/2026): pula os dois cliques do menu
const GUIA_RAPIDA = 'https://fgtsdigital.sistema.gov.br/cobranca/#/gestao-guias/emissao-guia-rapida';

const cnpjComPontos = c => String(c).length === 11
  ? String(c).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  : String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
/**
 * O CNPJ da matriz (a raiz com 0001 e os dígitos). O portal só aceita o perfil de procurador na matriz ("Só é permitida a
 * troca de perfil para estabelecimento matriz…", 10/10/2026), e o FGTS da filial vai na guia da matriz (13/10/2026).
 */
function matrizDe(cnpj) {
  const c = String(cnpj);
  if (c.length !== 14 || c.slice(8, 12) === '0001') return c;
  const base = c.slice(0, 8) + '0001';
  const dv = b => { let soma = 0, peso = b.length - 7; for (const d of b) { soma += Number(d) * peso; peso = peso === 2 ? 9 : peso - 1; } const r = soma % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(base);
  return base + d1 + dv(base + d1);
}
const agora = () => new Date().toISOString();
const dormir = ms => new Promise(r => setTimeout(r, ms));
// o empregador pessoa física (CPF/CAEPF, ex. produtor rural) também entra pelo procurador (13/10/2026)
const cnpjValido = c => /^(\d{11}|\d{14})$/.test(String(c || ''));
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
// o CNPJ do próprio escritório (a 284, NILMA CONTABILIDADE; Vitor, 09/10/2026: "ele tem que ir no meu perfil, já que é o do
// escritório"): entra pelo "Meu Perfil", sem Procurador e sem digitar CNPJ
const CNPJ_DO_ESCRITORIO = '27872981000113';

// Os dois roteiros valem para qualquer cliente: o Claude só troca a linha "const DADOS = {…}" no começo (o CNPJ ou a
// competência). Assim o texto do pedido não cresce com o tamanho do lote (13/10/2026: com 25 clientes o texto estourava o
// limite do Windows, ENAMETOOLONG, e o lote inteiro ficou pendurado).
const ROTEIRO_PERFIL = `await (async () => {
  const DADOS = { cnpj: '00.000.000/0000-00', proprio: false };
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const visivel = e => e && e.offsetParent !== null;
  const botao = t => [...document.querySelectorAll('button')].find(b => visivel(b) && b.innerText.trim() === t);
  for (let i = 0; i < 20 && !botao('Trocar Perfil') && !visivel(document.querySelector('input[role=combobox]')); i++) await dormir(300);
  if (!visivel(document.querySelector('input[role=combobox]'))) { const tp = botao('Trocar Perfil'); if (!tp) return 'ERRO: sem Trocar Perfil'; tp.click(); await dormir(600); }
  const sel = [...document.querySelectorAll('ng-select')].find(visivel);
  if (!sel) return 'ERRO: sem a lista Perfil';
  sel.querySelector('.ng-select-container').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await dormir(400);
  const opcao = nome => [...document.querySelectorAll('.ng-option')].find(o => o.innerText.trim() === nome);
  if (DADOS.proprio) {
    const meu = opcao('Meu Perfil');
    if (!meu) return 'ERRO: sem a opção Meu Perfil';
    meu.click(); await dormir(500);
  } else {
    const proc = opcao('Procurador');
    if (!proc) return 'ERRO: sem a opção Procurador';
    proc.click(); await dormir(500);
    const campo = [...document.querySelectorAll('input')].find(i => visivel(i) && /CNPJ ou CPF/i.test(i.placeholder || ''));
    if (!campo) return 'ERRO: sem o campo do CNPJ';
    campo.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(campo, DADOS.cnpj);
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('blur', { bubbles: true }));
    await dormir(300);
  }
  const ok = botao('Definir') || botao('Selecionar');
  if (!ok) return 'ERRO: sem o botão Definir';
  setTimeout(() => ok.click(), 100);
  // se a janela continua aberta depois do Definir, o portal recusou: a mensagem dele vira o resultado (13/10/2026: sem
  // procuração, procuração vencida, CPF/CNPJ inválido); se a página trocou, a ferramenta pode reclamar que navegou (é o esperado)
  await dormir(2500);
  const ainda = botao('Definir') || botao('Selecionar');
  if (ainda) {
    const janela = ainda.closest('[role=dialog], .modal, .br-modal, ngb-modal-window, form') || document.body;
    const msg = [...janela.querySelectorAll('[role=alert], .br-message, .alert, .feedback, .mensagem, .invalid-feedback, .text-danger, small, p, span')]
      .filter(visivel).map(e => e.innerText.trim()).filter(m => m && m.length > 8 && /procura|n[ãa]o |inv[áa]lid|erro|permit|vencid|autoriza/i.test(m));
    return 'ERRO_PORTAL: ' + (msg[0] || 'o portal não aceitou o perfil').slice(0, 160);
  }
  return 'OK: definindo ' + (DADOS.proprio ? 'Meu Perfil' : DADOS.cnpj);
})()`;

const ROTEIRO_GUIA = `await (async () => {
  const DADOS = { cnpj: '00.000.000/0000-00', competencia: '00/0000', emitir: true };
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const visivel = e => e && e.offsetParent !== null;
  const num = v => Number(String(v || '0').replace(/\\./g, '').replace(',', '.')) || 0;
  const reais = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (let i = 0; i < 20 && ![...document.querySelectorAll('ng-select')].some(visivel); i++) await dormir(300);
  const texto = document.body.innerText;
  // a janela "Mensagem de Erro" do portal (13/10/2026: a sessão expirou e a tela mostrou "Erro 200 / OK (HTTP200)")
  if (/Mensagem de Erro/.test(texto)) return JSON.stringify({ erro: 'roteiro: o portal mostrou "' + (texto.split('Mensagem de Erro')[1] || '').trim().split('\\n').slice(0, 2).join(' ') + '" (a sessão pode ter expirado: entre de novo)' });
  // o portal recusa a troca de perfil de alguns estabelecimentos (visto em 10/10/2026): o motivo vira o resultado
  const recusa = (texto.match(/s[óo] [ée] permitida[^.\\n]*/i) || texto.match(/s[óo] permite[^.\\n]*/i) || [])[0];
  if (recusa) return JSON.stringify({ erro: 'o portal recusou o perfil: ' + recusa.trim().slice(0, 120) });
  const empregador = ((texto.match(/Empregador:\\s*([^\\n]*)/) || [])[1] || '').trim();
  if (!empregador || empregador === '|') return JSON.stringify({ erro: 'roteiro: o portal está sem perfil (a sessão pode ter expirado: entre de novo e defina o perfil)' });
  if (!texto.includes(DADOS.cnpj)) return JSON.stringify({ erro: 'o perfil não é o do cliente (o portal ficou em ' + empregador.slice(0, 80) + '): confira a procuração' });
  const sel = [...document.querySelectorAll('ng-select')].find(visivel);
  if (!sel) return JSON.stringify({ erro: 'roteiro: sem a lista de competência' });
  sel.querySelector('.ng-select-container').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await dormir(400);
  const opcoes = [...document.querySelectorAll('.ng-option')];
  // outras competências em aberto antes da pedida (o débito antigo não pago; 13/10/2026): vira aviso
  const chave = c => c.split('/').reverse().join('-');
  const anteriores = opcoes.map(o => o.innerText.trim()).filter(c => /^\\d{2}\\/\\d{4}$/.test(c) && chave(c) < chave(DADOS.competencia));
  const avisos = anteriores.length ? ['há débito em aberto também em ' + anteriores.join(', ')] : [];
  const op = opcoes.find(o => o.innerText.trim() === DADOS.competencia);
  if (!op) return JSON.stringify(Object.assign({ erro: 'sem débito em aberto na competência' }, avisos.length ? { aviso: avisos.join('; ') } : {}));
  op.click(); await dormir(300);
  const pesquisar = [...document.querySelectorAll('button')].find(b => visivel(b) && b.innerText.trim() === 'Pesquisar');
  if (!pesquisar) return JSON.stringify({ erro: 'roteiro: sem o Pesquisar' });
  pesquisar.click();
  let txt = '';
  for (let i = 0; i < 50; i++) { await dormir(300); txt = document.body.innerText; if (/Total Devedor/.test(txt) && /Vencimento da Guia/.test(txt)) break; }
  await dormir(500);
  txt = document.body.innerText;
  if (!/Vencimento da Guia/.test(txt)) return JSON.stringify({ erro: 'roteiro: a pesquisa não mostrou o total' });
  // a competência pode ter mais de um vencimento, cada um com o seu "Emitir guia" (13/10/2026, OURO VERDE: a rescisão vence
  // dia 16 e já tinha guia aguardando pagamento; a mensal vence dia 20). Emite só o vencimento que ainda não tem guia.
  // Cada bloco termina na linha Total: Mensal, [Rescisório, Indenização, Processo Trabalhista, Consignado…], Encargos, Total.
  const resumo = txt.slice(txt.indexOf('Resumo da Pesquisa'));
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const partes = resumo.split(/Vencimento da Guia:\\s*/).slice(1).map(t => {
    const vencimento = (t.match(/^(\\d{2}\\/\\d{2}\\/\\d{4})/) || [])[1] || '';
    const linhaTotal = [];
    for (const l of t.split(/\\nTotal\\n/).pop().split('\\n').map(x => x.trim()).filter(Boolean)) { if (!/^[\\d.]+,\\d{2}$/.test(l)) break; linhaTotal.push(l); }
    const valores = linhaTotal.map(num);
    const mensal = valores[0] || 0, total = valores[valores.length - 1] || 0;
    const encargos = valores.length >= 3 ? valores[valores.length - 2] : 0;
    const outros = valores.slice(1, -2).reduce((a, b) => a + b, 0);
    const [d, m, a] = vencimento.split('/').map(Number);
    return {
      vencimento, mensal, outros, encargos, valor: reais(total),
      vencida: !!vencimento && new Date(a, m - 1, d) < hoje,
      temBotao: /^\\S+\\s*\\n\\s*Emitir guia/.test(t),
      aguardando: (/aguardando pagamento/i.test(t) && (t.match(/\\d{16}-\\d/g) || [])) || (/^\\S+\\s*\\n\\s*-?\\s*\\d{16}-\\d/.test(t) ? t.match(/\\d{16}-\\d/g) : null),
    };
  });
  partes.forEach((pt, i) => { pt.botao = partes.slice(0, i + 1).filter(x => x.temBotao).length - 1; });
  const comAviso = o => JSON.stringify(Object.assign(o, avisos.length ? { aviso: avisos.join('; ') } : {}));
  const abertas = partes.filter(pt => pt.temBotao && !pt.aguardando);
  // rescisório, indenização, processo trabalhista ou consignado junto do mensal: não emite, o DP decide (13/10/2026)
  const misturadas = abertas.filter(pt => pt.outros > 0);
  const livres = abertas.filter(pt => !(pt.outros > 0));
  const jaTem = partes.filter(pt => pt.aguardando);
  if (!livres.length && misturadas.length) return comAviso({ erro: 'a guia de ' + misturadas.map(pt => pt.vencimento + ' tem R$ ' + reais(pt.outros) + ' além do mensal (rescisório, indenização, processo trabalhista ou consignado; mensal R$ ' + reais(pt.mensal) + ')').join('; ') + ': confira à mão; nada emitido' });
  if (!livres.length && jaTem.length === 1) return comAviso({ existente: true, numero: jaTem[0].aguardando[0], valor: jaTem[0].valor, vencimento: jaTem[0].vencimento });
  if (!livres.length) return comAviso(jaTem.length ? { erro: 'já existem guias aguardando pagamento: ' + jaTem.map(pt => pt.aguardando[0] + ' (vence ' + pt.vencimento + ')').join(', ') + '; nada emitido' } : { erro: 'roteiro: sem o Emitir guia' });
  if (livres.length > 1) return comAviso({ erro: 'mais de um vencimento sem guia (' + livres.map(pt => pt.vencimento + ' R$ ' + pt.valor).join(', ') + '); confira à mão' });
  const alvo = livres[0];
  if (misturadas.length) avisos.push('não emiti a de ' + misturadas.map(pt => pt.vencimento).join(', ') + ' (tem valor além do mensal)');
  if (alvo.encargos > 0 || alvo.vencida) avisos.push('emitida depois do vencimento' + (alvo.encargos > 0 ? ': inclui R$ ' + reais(alvo.encargos) + ' de encargos' : ''));
  const valor = alvo.valor, vencimento = alvo.vencimento;
  if (!DADOS.emitir) return comAviso({ ensaio: true, valor, vencimento });
  const botoes = [...document.querySelectorAll('button')].filter(b => visivel(b) && b.innerText.trim() === 'Emitir guia');
  const emitirBotao = botoes[alvo.botao];
  if (!emitirBotao) return JSON.stringify({ erro: 'roteiro: sem o Emitir guia' });
  const antes = new Set(document.body.innerText.match(/\\d{16}-\\d/g) || []);
  emitirBotao.click();
  let numero = '';
  for (let i = 0; i < 60 && !numero; i++) { await dormir(500); numero = (document.body.innerText.match(/\\d{16}-\\d/g) || []).find(n => !antes.has(n)) || ''; }
  if (!numero) return JSON.stringify({ erro: 'roteiro: a guia não mostrou o número' });
  return comAviso({ numero, valor, vencimento });
})()`;

function instrucoesDoLote(itens) {
  const lista = itens.map((p, i) => {
    const [ano, mes] = p.competencia.split('-');
    return (i + 1) + '. ' + (p.empresa || '') + ' — ' + (p.cnpj.length === 11 ? 'CPF ' : 'CNPJ ') + p.cnpj + ' — competência ' + mes + '/' + ano + ' — ' + (p.modo === 'emitir' ? 'EMITIR' : 'ENSAIO (não emitir)');
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
    'Para cada cliente da lista, o CAMINHO RÁPIDO (use a ferramenta de rodar JavaScript na página):',
    '  a) abra ' + PORTAL + ' na aba e rode o ROTEIRO PERFIL, trocando só a linha "const DADOS = {…}" pela do cliente (abaixo);',
    '     ele responde "OK: …" e a página troca sozinha (se a ferramenta reclamar que a página navegou, é o esperado). Espere 2 s.',
    '  b) abra ' + GUIA_RAPIDA + ' e rode o ROTEIRO GUIA, trocando só a linha "const DADOS = {…}" pela do cliente; ele responde um',
    '     JSON, que é o resultado do cliente: escreva RESULTADO [<cnpj>]: <o JSON> (cnpj só em números).',
    '  Se o ROTEIRO PERFIL responder "ERRO_PORTAL: <mensagem>", o portal recusou o perfil: o resultado dele é',
    '  RESULTADO [<cnpj>]: {"erro":"<a mensagem>"} e siga para o próximo (não tente o caminho manual).',
    '  Se um roteiro responder começando com "ERRO" ou com {"erro":"roteiro: …"}, faça aquele cliente pelo caminho manual abaixo',
    '  (se o portal tiver saído do login, entre de novo como no passo B e refaça o cliente).',
    '  Qualquer outro JSON (com "erro", "existente", "aviso"…) é o resultado dele: escreva RESULTADO [<cnpj>]: <o JSON> exatamente',
    '  como veio e siga para o próximo.',
    '',
    'As linhas DADOS de cada cliente (cole a do cliente no lugar da linha const DADOS do roteiro):',
    ...itens.map(p => {
      const [ano, mes] = p.competencia.split('-');
      const doc = p.portal || p.cnpj;
      return '  ' + p.cnpj + ':  PERFIL -> const DADOS = ' + JSON.stringify({ cnpj: cnpjComPontos(doc), proprio: doc === CNPJ_DO_ESCRITORIO })
        + '   |   GUIA -> const DADOS = ' + JSON.stringify({ cnpj: cnpjComPontos(doc), competencia: mes + '/' + ano, emitir: p.modo === 'emitir' });
    }),
    '',
    '=== ROTEIRO PERFIL ===',
    ROTEIRO_PERFIL,
    '',
    '=== ROTEIRO GUIA ===',
    ROTEIRO_GUIA,
    '',
    'O CAMINHO MANUAL (só quando um roteiro falhar), para aquele cliente:',
    '0. Se o CNPJ é ' + CNPJ_DO_ESCRITORIO + ' (o do próprio escritório, NILMA CONTABILIDADE), o perfil é o "Meu Perfil": abra a lista',
    '   Perfil, escolha "Meu Perfil" e clique em Definir (sem Procurador e sem digitar CNPJ).',
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

  if (!fs.existsSync(CLAUDE)) { marcar({ ligado: false, motivo: 'falta o Claude no PC do escritório' }); log('FGTS: desligado (falta o Claude em ' + CLAUDE + ')'); painel.modulo('fgts', 'FGTS Digital', false, 'falta o Claude no PC do escritório'); return; }
  if (!fs.existsSync(BAIXADOS)) { marcar({ ligado: false, motivo: 'falta a pasta Claudio Secretario no Drive do PC' }); log('FGTS: desligado (falta ' + BAIXADOS + ')'); painel.modulo('fgts', 'FGTS Digital', false, 'falta a pasta Claudio Secretario no Drive do PC'); return; }
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
    const lote = fila.splice(0, 12);
    try { await atenderLote(lote); } catch (err) {
      log('FGTS: erro no lote', err.message);
      painel.erro('fgts', 'O lote do FGTS não abriu', err.message);
      // o lote não abriu (13/10/2026: nenhum pedido pode ficar pendurado "esperando a vez"): quem não terminou vira erro com o motivo
      await Promise.all(lote.map(d => d.ref.get().then(s => {
        const st = (s.data() || {}).status;
        return st === 'pendente' || st === 'trabalhando' ? d.ref.update({ status: 'erro', erro: 'o robô não conseguiu fazer este lote: ' + String(err.message).slice(0, 150) + '; peça de novo', fimEm: agora() }) : null;
      }).catch(() => {})));
    }
    ocupado = false;
    painel.fazendo('fgts', null);
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
      const item = { p: Object.assign({}, p, { modo: p.modo === 'emitir' ? 'emitir' : 'ensaio', portal: matrizDe(p.cnpj) }), ref: doc.ref, passos: [], fim: false, comecou: false, tarefa: null, seguidores: [] };
      item.passo = nome => {
        item.passos.push({ n: item.passos.length + 1, nome: String(nome).slice(0, 200), url: '', texto: '', quando: agora() });
        return item.ref.update({ passos: item.passos }).catch(() => {});
      };
      itens.push(item);
    }
    if (!itens.length) return;
    // a filial vai pela matriz (13/10/2026): o mesmo empregador e a mesma competência no lote viram um cliente só para o
    // Claude; os outros pedidos ("seguidores") recebem a mesma guia no fim
    const lideres = [];
    for (const it of itens) {
      const lider = lideres.find(l => l.p.portal === it.p.portal && l.p.competencia === it.p.competencia && l.p.modo === it.p.modo);
      if (lider) lider.seguidores.push(it); else lideres.push(it);
    }
    const porCnpj = new Map(lideres.map(it => [it.p.cnpj, it]));
    painel.fazendo('fgts', 'FGTS Digital: abrindo o lote de ' + lideres.length + (lideres.length === 1 ? ' guia' : ' guias'));
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
      if (lideres.every(x => x.fim) && processoAtual) { try { processoAtual.kill(); } catch (_) {} }
    }, () => {}));
    const comecar = it => {
      if (it.comecou || it.cancelado) return;
      it.comecou = true;
      painel.fazendo('fgts', 'Emitindo FGTS ' + lideres.filter(x => x.comecou).length + '/' + lideres.length + ' — ' + quemNoPainel(it.p));
      void it.ref.update({ status: 'trabalhando', inicioEm: agora() }).catch(() => {});
      for (const seg of it.seguidores) if (!seg.cancelado) void seg.passo('vai na guia de ' + cnpjComPontos(it.p.portal) + ' (feita junto com ' + (it.p.empresa || it.p.cnpj) + ')');
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
        for (const it of lideres) if (!it.fim) { it.fim = true; it.tarefa = concluir(it, res, desde); }
        return;
      }
      const it = porCnpj.get(cnpj);
      if (!it || it.fim) return;
      it.fim = true;
      comecar(it);
      it.tarefa = concluir(it, res, desde);
    };
    const limite = 4 * 60 * 1000 + itens.length * 3 * 60 * 1000;
    let r = await rodarClaude(instrucoesDoLote(lideres.map(it => it.p)), aoPasso, aoResultado, limite);
    // a extensão ainda não estava pronta (nenhum cliente começou): espera e tenta o lote de novo, uma vez
    // (13/10/2026: com a sessão que fica ligada, a sessão que nasceu sem a extensão era reaproveitada e cada lote falhava em
    // segundos; agora ela é encerrada e a nova tentativa abre outra)
    if (!lideres.some(it => it.comecou || it.fim) && extensaoFora(r)) {
      matarSessao();
      for (const it of itens) await it.passo('a extensão do Claude não respondeu; tentando de novo');
      await dormir(20000);
      r = await rodarClaude(instrucoesDoLote(lideres.map(it => it.p)), aoPasso, aoResultado, limite);
      if (!lideres.some(it => it.comecou || it.fim) && extensaoFora(r)) {
        matarSessao();
        // a extensão continua fora: o resto da fila também para, com o mesmo aviso (em vez de cada lote falhar sozinho)
        const resto = fila.splice(0, fila.length);
        await Promise.all(resto.map(d => d.ref.update({ status: 'erro', erro: 'a extensão Claude in Chrome não está conectada no PC: abra o Chrome, clique no ícone do Claude e peça de novo', fimEm: agora() }).catch(() => {})));
        if (resto.length) log('FGTS (Claude): extensão fora; parei a fila (' + resto.length + ' pedido(s) voltaram como erro)');
      }
    }
    for (const it of lideres) {
      if (it.fim) continue;
      it.fim = true;
      const motivo = !it.comecou && extensaoFora(r)
        ? 'a extensão Claude in Chrome não está conectada no PC: abra o Chrome, clique no ícone do Claude e peça de novo'
        : 'o Claude não terminou este cliente' + (r.erro ? ': ' + r.erro.slice(0, 200) : '');
      it.tarefa = it.ref.update({ status: 'erro', erro: motivo, fimEm: agora() }).catch(() => {});
      painel.erro('fgts', 'A guia do FGTS de ' + quemNoPainel(it.p) + ' não saiu', motivo);
    }
    await Promise.all(lideres.map(it => it.tarefa));
    // os seguidores (a filial cuja guia é a da matriz, ou o mesmo pedido em dobro): a mesma guia, na pasta de cada um
    for (const lider of lideres) for (const seg of lider.seguidores) {
      if (seg.cancelado) continue;
      await copiarResultado(lider, seg).catch(err => seg.ref.update({ status: 'erro', erro: 'não deu para copiar a guia da matriz: ' + err.message, fimEm: agora() }).catch(() => {}));
    }
    vigias.forEach(parar => parar());
  }

  /** O fim de um cliente: o erro, o ensaio ou a guia (o PDF do Claudio Secretario arquivado e no pedido). */
  async function concluir(it, res, desde) {
    const { p, ref } = it;
    // os avisos (13/10/2026): a filial pela matriz, débito antigo em aberto, emitida depois do vencimento, a guia que já existia
    const avisos = [];
    if (p.portal && p.portal !== p.cnpj) avisos.push('o FGTS da filial vai na guia da matriz ' + cnpjComPontos(p.portal));
    if (res.aviso) avisos.push(String(res.aviso));
    if (res.existente) avisos.push('já estava emitida e aguardando pagamento');
    const aviso = avisos.join('; ');
    it.resultadoFinal = { res, aviso };
    if (res.erro) {
      const e = String(res.erro);
      const motivo = e === 'login' ? 'o login no FGTS Digital não foi no Chrome do PC: entre com o certificado lá e peça de novo'
        : e === 'captcha' ? 'o gov.br pediu a verificação "não sou um robô" no Chrome do PC: faça o login lá e peça de novo'
          : /procura/i.test(e) && !/^sem procuração/i.test(e) ? 'sem procuração no FGTS Digital para este ' + (p.cnpj.length === 11 ? 'CPF' : 'CNPJ') + ' (o portal disse: ' + e.slice(0, 160) + ')'
            : e;
      await ref.update({ status: 'erro', erro: motivo + (aviso ? ' · ' + aviso : ''), aviso, fimEm: agora() });
      log('FGTS (Claude): erro', p.cnpj, motivo);
      painel.erro('fgts', 'A guia do FGTS de ' + quemNoPainel(p) + ' não saiu', motivo);
      return;
    }
    if (p.modo === 'ensaio') {
      await ref.update({ status: 'pronto', aviso, resultado: 'ensaio: total R$ ' + (res.valor || '?') + ', vence ' + (res.vencimento || '?') + ' (nada emitido)' + (aviso ? ' · ' + aviso : ''), fimEm: agora() });
      log('FGTS (Claude): ensaio ok', p.cnpj);
      painel.atividade('fgts', 'Conferiu o FGTS de ' + quemNoPainel(p) + ' (ensaio, nada emitido)', 'total R$ ' + (res.valor || '?') + ' · vence ' + (res.vencimento || '?'));
      return;
    }
    await it.passo('esperando o PDF da guia ' + (res.numero || '') + ' no Claudio Secretario');
    // a guia que já existia não baixa sozinha: o Claude baixa pelo caminho de reimpressão (quando houver) ou ela fica como aviso
    const baixado = await esperarPdf(res.numero, desde, res.existente ? 20000 : 90000);
    if (!baixado) {
      const motivo = res.existente
        ? 'a guia ' + (res.numero || '') + ' já estava emitida (vence ' + (res.vencimento || '?') + ', R$ ' + (res.valor || '?') + ') e aguarda pagamento; o PDF dela não veio'
        : 'a guia ' + (res.numero || '') + ' foi emitida, mas o PDF não chegou no Claudio Secretario';
      await ref.update({ status: 'erro', erro: motivo, aviso, numeroGuia: res.numero || '', valor: res.valor || '', vencimento: res.vencimento || '', fimEm: agora() });
      painel.erro('fgts', 'O PDF da guia do FGTS de ' + quemNoPainel(p) + ' não veio', motivo);
      return;
    }
    const pdf = fs.readFileSync(baixado);
    if (pdf.slice(0, 4).toString() !== '%PDF') {
      await ref.update({ status: 'erro', erro: 'o arquivo baixado não é um PDF', fimEm: agora() });
      painel.erro('fgts', 'A guia do FGTS de ' + quemNoPainel(p) + ' não veio em PDF', 'o arquivo baixado não é um PDF');
      return;
    }
    const final = arquivarGuia(baixado, p, res.numero || 'sem-numero');
    await it.passo('arquivada em ' + path.relative(DRIVE, final));
    const nome = path.basename(final);
    await ref.collection('arquivo').doc('pdf').set({ base64: pdf.toString('base64'), nome, tamanho: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex'), quando: agora() });
    await ref.update({
      status: 'pronto', pdfNome: nome, fimEm: agora(), numeroGuia: res.numero || '', valor: res.valor || '', vencimento: res.vencimento || '', aviso,
      resultado: 'guia ' + (res.numero || '') + ' · R$ ' + (res.valor || '?') + ' · vence ' + (res.vencimento || '?') + (aviso ? ' · ' + aviso : ''),
      arquivadaEm: path.relative(DRIVE, final),
    });
    it.pdfFinal = final;
    log('FGTS (Claude): guia emitida', p.cnpj, p.competencia, res.numero || '');
    painel.atividade('fgts', 'Emitiu a guia do FGTS de ' + quemNoPainel(p),
      'guia ' + (res.numero || '') + ' · R$ ' + (res.valor || '?') + ' · vence ' + (res.vencimento || '?') + ' · ' + path.relative(DRIVE, final));
  }

  /** O seguidor (a filial, ou o mesmo pedido em dobro no lote) recebe a guia do líder, na pasta dele. */
  async function copiarResultado(lider, seg) {
    const fim = lider.resultadoFinal;
    if (!fim) { await seg.ref.update({ status: 'erro', erro: 'o Claude não terminou ' + (lider.p.empresa || lider.p.cnpj) + ', que leva a guia deste', fimEm: agora() }); return; }
    const { res } = fim;
    const aviso = [seg.p.portal !== seg.p.cnpj ? 'o FGTS da filial vai na guia da matriz ' + cnpjComPontos(seg.p.portal) : 'pedido repetido no lote', fim.aviso].filter(Boolean).join('; ');
    if (res.erro || !lider.pdfFinal) {
      const l = await lider.ref.get();
      const d = l.data() || {};
      if (d.status === 'pronto' && seg.p.modo === 'ensaio') { await seg.ref.update({ status: 'pronto', resultado: d.resultado || '', aviso, fimEm: agora() }); return; }
      await seg.ref.update({ status: 'erro', erro: (d.erro || 'a guia de ' + (lider.p.empresa || lider.p.cnpj) + ' não saiu') + ' · ' + aviso, aviso, fimEm: agora() });
      return;
    }
    const [ano, mes] = seg.p.competencia.split('-');
    const destino = path.join(pastaDoCliente(ano, String(seg.p.codigo || ''), seg.p.empresa || ''), 'DEPARTAMENTO PESSOAL', mes, 'FGTS');
    fs.mkdirSync(destino, { recursive: true });
    const final = path.join(destino, path.basename(lider.pdfFinal));
    if (path.resolve(final) !== path.resolve(lider.pdfFinal)) fs.copyFileSync(lider.pdfFinal, final);
    const pdf = fs.readFileSync(final);
    const nome = path.basename(final);
    await seg.ref.collection('arquivo').doc('pdf').set({ base64: pdf.toString('base64'), nome, tamanho: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex'), quando: agora() });
    await seg.ref.update({
      status: 'pronto', pdfNome: nome, fimEm: agora(), numeroGuia: res.numero || '', valor: res.valor || '', vencimento: res.vencimento || '', aviso,
      resultado: 'guia ' + (res.numero || '') + ' · R$ ' + (res.valor || '?') + ' · vence ' + (res.vencimento || '?') + ' · ' + aviso,
      arquivadaEm: path.relative(DRIVE, final),
    });
    log('FGTS (Claude): guia da matriz para', seg.p.cnpj, res.numero || '');
    painel.atividade('fgts', 'Guia do FGTS da matriz copiada para ' + quemNoPainel(seg.p), 'guia ' + (res.numero || '') + ' · ' + path.relative(DRIVE, final));
  }

  /**
   * Uma sessão do Claude que fica ligada entre os lotes (Vitor, 13/10/2026: "em vez de puxar vários grupos, por que não
   * baixa tudo na mesma aba?"): cada sessão do Claude in Chrome tem o seu grupo de abas, então um Claude por lote deixava
   * um grupo novo a cada lote. Agora cada lote é uma mensagem nova para o mesmo Claude, na mesma aba. Ela fecha o próprio
   * grupo e encerra depois de SESSAO_OCIOSA_MS sem pedido ou de SESSAO_LOTES lotes (para a conversa não crescer demais).
   */
  const SESSAO_OCIOSA_MS = 15 * 60 * 1000;
  const SESSAO_LOTES = 4;
  let sessao = null;
  let processoAtual = null;

  function abrirSessao() {
    const filho = spawn(CLAUDE, ['-p', '--chrome', '--model', MODELO, '--permission-mode', 'bypassPermissions',
      '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--no-session-persistence'],
    { cwd: __dirname, windowsHide: true, env: ambienteLimpo(), stdio: ['pipe', 'pipe', 'pipe'] });
    const s = { filho, lotes: 0, vez: null, erros: '', viva: true, ociosa: null };
    filho.stdin.on('error', () => { /* o processo saiu; o close resolve a vez */ });
    let resto = '';
    filho.stdout.on('data', b => {
      resto += String(b);
      const linhas = resto.split('\n');
      resto = linhas.pop();
      for (const l of linhas) {
        let ev = null; try { ev = JSON.parse(l); } catch (_) { continue; }
        if (!s.vez) continue;
        if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) for (const c of ev.message.content) if (c.type === 'text') s.vez.lerTexto(c.text);
        if (ev.type === 'result') { s.vez.lerTexto(String(ev.result || '')); s.vez.fim(String(ev.result || '')); }
      }
    });
    filho.stderr.on('data', b => { s.erros += String(b); if (s.erros.length > 3000) s.erros = s.erros.slice(-3000); });
    const morreu = err => {
      if (!s.viva) return;
      s.viva = false;
      clearTimeout(s.ociosa);
      if (sessao === s) sessao = null;
      if (processoAtual === filho) processoAtual = null;
      if (s.vez) s.vez.fim('', err ? err.message : s.erros);
    };
    filho.on('error', morreu);
    filho.on('close', () => morreu(null));
    return s;
  }

  function matarSessao() {
    const s = sessao;
    sessao = null;
    if (s && s.viva) { try { s.filho.kill(); } catch (_) { /* já saiu */ } }
  }

  function mandar(s, texto) {
    s.filho.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: texto } }) + '\n', 'utf8');
  }

  /** Pede ao Claude para fechar o grupo de abas dele e encerra a sessão. */
  function encerrarSessao(s, motivo) {
    if (!s || !s.viva) return;
    if (sessao === s) sessao = null;
    log('FGTS (Claude): encerrando a sessão do Claude (' + motivo + ')');
    const fim = setTimeout(() => { try { s.filho.kill(); } catch (_) {} }, 90000);
    s.vez = { lerTexto: () => {}, fim: () => { clearTimeout(fim); s.vez = null; try { s.filho.stdin.end(); } catch (_) {} } };
    try { mandar(s, 'Acabaram os lotes. Feche as abas do seu grupo no Chrome (com a ferramenta de fechar abas) e responda só FIM.'); } catch (_) { s.vez.fim(); }
  }

  /**
   * Roda um lote na sessão do Claude. "PASSO [cnpj]: …" vai para aoPasso; "RESULTADO [cnpj]: {…}" para aoResultado (sem o
   * CNPJ: vale para o lote todo). Devolve o fim da resposta (para o erro de quando nada começou).
   */
  function rodarClaude(texto, aoPasso, aoResultado, limiteMs) {
    return new Promise(resolve => {
      // o pedido vai pela entrada padrão: na linha de comando estourava o limite do Windows com lotes grandes (ENAMETOOLONG,
      // 10/10/2026), e por arquivo ("leia e faça o que ele manda") o classificador do Claude Code negava os roteiros (13/10/2026)
      if (sessao && !sessao.viva) sessao = null;
      const continua = !!sessao;
      if (!sessao) sessao = abrirSessao();
      const s = sessao;
      clearTimeout(s.ociosa);
      processoAtual = s.filho;
      let algum = null;
      const vistos = new Set();
      const relogio = setTimeout(() => { try { s.filho.kill(); } catch (_) {} }, limiteMs || LIMITE_MS);
      s.vez = {
        lerTexto: t => {
          for (const linha of String(t).split('\n')) {
            const l = linha.trim();
            const m = l.match(/^PASSO\s*(?:\[(\d{14}|\d{11})\])?\s*:\s*(.+)$/);
            if (m && !vistos.has(l)) { vistos.add(l); aoPasso(m[1] || '', m[2]); }
            const r = l.match(/^RESULTADO\s*(?:\[(\d{14}|\d{11})\])?\s*:\s*(\{.*\})\s*$/);
            if (r && !vistos.has(l)) {
              vistos.add(l);
              try { const res = JSON.parse(r[2]); algum = res; aoResultado(r[1] || '', res); } catch (_) { /* resultado mal escrito */ }
            }
          }
        },
        fim: (final, erro) => {
          clearTimeout(relogio);
          s.vez = null;
          s.lotes++;
          resolve({ resultado: algum, erro: String(final || erro || '').slice(-300) });
          if (!s.viva) return;
          if (s.lotes >= SESSAO_LOTES) encerrarSessao(s, s.lotes + ' lotes');
          else s.ociosa = setTimeout(() => encerrarSessao(s, 'sem pedido há 15 min'), SESSAO_OCIOSA_MS);
        },
      };
      const aviso = continua
        ? 'NOVO LOTE. Continue na MESMA aba do portal que você já está usando (não abra outra aba nem outro grupo); o login já está feito.\n\n'
        : '';
      try { mandar(s, aviso + texto); } catch (err) { s.vez.fim('', err.message); }
    });
  }
}

module.exports = { iniciarFgtsPeloClaude };
