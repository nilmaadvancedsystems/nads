// Versão em HTML da cobrança que o robô manda pelo Gmail.
//
// O texto é o dos modelos (Pendências › Configurações) e continua no meio do
// e-mail. Em volta dele:
//   - faixa com o mês e manchete "Faltam N documentos", barra do que já
//     chegou e o prazo;
//   - no lugar da lista "- Extrato Bancário", um cartão por documento; o
//     extrato mostra os bancos do cliente com o logo e se já chegou;
//   - no lugar do link solto, o botão pra mandar pela página do cliente e o
//     passo a passo de responder com anexo.
// Vai junto a versão em texto puro (o próprio modelo).
//
// Imagens: logos em scripts/logos-bancos/<id>.png e ícones em
// scripts/icones-email/*.png, anexados no e-mail (cid:), então aparecem mesmo
// com imagens externas bloqueadas. Banco sem logo vira selo com a sigla.
// Tudo em tabela e estilo inline: é o que Gmail e Outlook respeitam.
const fs = require('fs');
const path = require('path');
const { POR_ID } = require('./bancos');

const PASTA_LOGOS = path.join(__dirname, 'logos-bancos');
const PASTA_ICONES = path.join(__dirname, 'icones-email');
// As cores do app (nilma-ui.css, tema claro): o e-mail tem a cara das telas.
const COR = {
  tinta: '#1D1C1F', suave: '#5E5D64', fraca: '#8C8C92', borda: '#DADADF', fundo: '#F7F7F8', faixa: '#EEEEF0',
  vinho: '#B0262D', vinhoClaro: '#F9E7E7', ok: '#116329', okClaro: '#DAFBE1', okBorda: '#ACE8BA',
  falta: '#953800', faltaClaro: '#FFF1E5', faltaBorda: '#FFD8B5',
};
const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const TIPOS = {
  extrato: { nome: 'Extrato bancário', icone: 'extrato', rotulos: /extrato banc|extrato do banco/i, dica: 'O mês inteiro, de cada conta.' },
  comprovante: { nome: 'Comprovantes de pagamento', icone: 'comprovante', rotulos: /comprovante/i, dica: 'Dos pagamentos feitos no mês.' },
  aplicacao: { nome: 'Extrato de aplicação', icone: 'aplicacao', rotulos: /aplica/i, dica: 'Das aplicações e investimentos.' },
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const tipoDaLinha = linha => Object.keys(TIPOS).find(k => TIPOS[k].rotulos.test(linha)) || '';

// Anexa a imagem uma vez e devolve o <img>; sem o arquivo, null. lado pode
// ser [largura, altura] (o logo não é quadrado).
function imagem(imagens, pasta, nome, lado, estilo) {
  const arquivo = path.join(pasta, nome + '.png');
  if (!fs.existsSync(arquivo)) return null;
  const cid = (pasta === PASTA_LOGOS ? 'banco-' : 'icone-') + nome;
  if (!imagens.some(i => i.cid === cid)) imagens.push({ cid, arquivo, mime: 'image/png' });
  const [w, h] = Array.isArray(lado) ? lado : [lado, lado];
  return '<img src="cid:' + cid + '" width="' + w + '" height="' + h + '" alt="" style="display:block;width:' + w + 'px;height:' + h + 'px;border:0;' + (estilo || '') + '">';
}

function marcaDoBanco(b, imagens, lado) {
  lado = lado || 18;
  return imagem(imagens, PASTA_LOGOS, b.id, lado, 'display:inline-block;vertical-align:middle;border-radius:5px;margin-right:6px') ||
    '<span style="display:inline-block;vertical-align:middle;width:' + lado + 'px;height:' + lado + 'px;border-radius:5px;margin-right:6px;background:' + b.cor + ';color:' + b.tinta +
    ';font:700 7px/' + lado + 'px ' + FONTE + ';text-align:center;white-space:nowrap;overflow:hidden">' + esc(b.sigla) + '</span>';
}

// Selo no desenho do app (.badge): texto pequeno, borda e fundo claros.
function selo(texto, tipo) {
  const c = tipo === 'ok' ? [COR.okClaro, COR.okBorda, COR.ok] : tipo === 'falta' ? [COR.faltaClaro, COR.faltaBorda, COR.falta] : ['#FFFFFF', COR.borda, COR.suave];
  return '<span style="display:inline-block;padding:3px 8px;border-radius:2em;border:1px solid ' + c[1] + ';background:' + c[0] +
    ';font:500 12px/16px ' + FONTE + ';color:' + c[2] + ';white-space:nowrap">' + esc(texto) + '</span>';
}

// Um banco dentro da linha do documento: selo pequeno com o logo e se chegou.
function seloDoBanco(b, recebido, imagens) {
  return '<span style="display:inline-block;margin:8px 6px 0 0;padding:3px 10px 3px 4px;border-radius:2em;white-space:nowrap;' +
    'border:1px solid ' + (recebido ? COR.okBorda : COR.borda) + ';background:' + (recebido ? COR.okClaro : '#FFFFFF') + ';font:500 13px/18px ' + FONTE + ';color:' + COR.tinta + '">' +
    marcaDoBanco(b, imagens) + '<span style="vertical-align:middle">' + esc(b.nome) + '</span>' +
    '<span style="vertical-align:middle;color:' + (recebido ? COR.ok : COR.falta) + '">&nbsp;·&nbsp;' + (recebido ? '✓ Recebido' : 'Falta') + '</span></span>';
}

// Uma linha por documento que falta, todas numa lista só: ícone, nome, o que
// mandar e, com bancos conhecidos, um selo por banco (os que faltam primeiro).
// Vale pros três documentos, que saem todos do banco.
// mostrar = false (padrão): só os bancos que faltam, sem "✓ Recebido"
// (Pendências › Configurações › "Mostrar no e-mail o que já chegou").
function linhaDoDocumento(tipo, cliente, recebidosPorTipo, imagens, nota, mostrar) {
  const t = nota ? Object.assign({}, TIPOS[tipo], { dica: nota }) : TIPOS[tipo];
  const recebidos = (recebidosPorTipo && recebidosPorTipo[tipo]) || [];
  const bancos = (cliente.bancos || []).map(id => POR_ID.get(id)).filter(Boolean);
  const faltam = bancos.filter(b => !recebidos.includes(b.id)).length;
  const icone = imagem(imagens, PASTA_ICONES, t.icone, 20) || '';
  // com um banco só, o selo já diz qual: o resumo fica "Falta"
  const resumo = bancos.length > 1
    ? (faltam === 1 ? 'Falta 1 banco' : faltam ? 'Faltam ' + faltam + ' bancos' : 'Todos chegaram')
    : 'Falta';
  const ordem = bancos.slice().sort((a, b) => recebidos.includes(a.id) - recebidos.includes(b.id))
    .filter(b => mostrar || !recebidos.includes(b.id));
  const selos = ordem.map(b => seloDoBanco(b, recebidos.includes(b.id), imagens)).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td width="48" style="vertical-align:top;padding-top:1px"><table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" style="background:' + COR.vinhoClaro + ';border-radius:9px"><tr><td align="center" valign="middle" style="height:36px">' + icone + '</td></tr></table></td>' +
    '<td style="vertical-align:top">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td class="nm" style="vertical-align:top;font:600 15px/1.35 ' + FONTE + ';color:' + COR.tinta + '">' + esc(t.nome) +
          '<div style="font:13px/1.45 ' + FONTE + ';color:' + COR.suave + ';font-weight:400;margin-top:1px">' + esc(t.dica) + '</div></td>' +
        '<td class="res" align="right" style="vertical-align:top;white-space:nowrap;padding-left:8px">' + selo(resumo, 'falta') + '</td>' +
      '</tr></table>' +
      (selos ? '<div style="margin-top:2px">' + selos + '</div>' : '') +
    '</td></tr></table>';
}

// Quanto já chegou: cada documento conta um por banco conhecido. Cliente
// com três bancos deve nove documentos, não três.
function progresso(cliente, faltando, recebidosPorTipo) {
  const naoAplica = Array.isArray(cliente.documentosNaoAplicaveis) ? cliente.documentosNaoAplicaveis : [];
  const bancos = (cliente.bancos || []).filter(id => POR_ID.has(id));
  let total = 0, feitos = 0;
  Object.keys(TIPOS).filter(k => !naoAplica.includes(k)).forEach(k => {
    const recebidos = (recebidosPorTipo && recebidosPorTipo[k]) || [];
    if (bancos.length) {
      total += bancos.length;
      feitos += faltando.includes(k) ? bancos.filter(id => recebidos.includes(id)).length : bancos.length;
    } else { total += 1; if (!faltando.includes(k)) feitos += 1; }
  });
  return { total, feitos, faltam: total - feitos };
}

function textoDoPrazo(competencia, diaLimite, agora) {
  const p = String(competencia || '').split('-').map(Number);
  if (!diaLimite || p.length !== 2 || !p[0]) return null;
  const limite = new Date(p[0], p[1], Number(diaLimite));            // mês seguinte à competência
  const hoje = new Date((agora || new Date()).getFullYear(), (agora || new Date()).getMonth(), (agora || new Date()).getDate());
  const dias = Math.round((limite - hoje) / 864e5);
  const data = pad2(limite.getDate()) + '/' + pad2(limite.getMonth() + 1);
  if (dias < 0) return { texto: 'O prazo era ' + data + ' (' + (-dias === 1 ? 'ontem' : 'há ' + -dias + ' dias') + ')', atrasado: true };
  if (dias === 0) return { texto: 'O prazo é hoje, ' + data, atrasado: true };
  return { texto: 'Prazo: até ' + data + ' (' + (dias === 1 ? 'amanhã' : 'faltam ' + dias + ' dias') + ')', atrasado: false };
}

// Moldura comum dos e-mails do escritório: barra da marca (vinho, com o logo
// e o nome), o título grande, o conteúdo em cartões e o rodapé. Um <style>
// pequeno arruma o celular (Gmail, Apple Mail e Outlook novo respeitam);
// quem ignora fica com o estilo inline, que já funciona.
// { assinatura, caixa, chip, previa, titulo, sobre, cabecalho, corpo, imagens, rodape }
function moldura(o) {
  const logo = imagem(o.imagens, PASTA_ICONES, 'marca', [15, 24], 'display:block;margin:0 auto') || '';
  const nome = o.assinatura || 'Nilma Contabilidade';
  const css = '@media only screen and (max-width:520px){' +
    '.px{padding-left:18px!important;padding-right:18px!important}' +
    '.titulo{font-size:22px!important;line-height:28px!important}' +
    '.nm,.res{display:block!important;width:100%!important;box-sizing:border-box}.res{text-align:left!important;padding:8px 0 0!important}' +
    '.cta a{display:block!important;text-align:center!important}' +
    '.fora{padding:12px 8px 24px!important}}';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>' + esc(o.titulo || nome) + '</title>' +
    '<style>' + css + '</style></head>' +
    '<body style="margin:0;padding:0;background:' + COR.fundo + ';-webkit-text-size-adjust:100%">' +
    // pré-cabeçalho: a linha cinza que aparece na lista do Gmail
    (o.previa ? '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + esc(o.previa) + '&#8199;&#65279;&#847;'.repeat(20) + '</div>' : '') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + COR.fundo + '"><tr><td class="fora" align="center" style="padding:28px 12px 36px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid ' + COR.borda + ';border-radius:12px;border-collapse:separate;overflow:hidden">' +

    // barra da marca
    '<tr><td class="px" style="background:' + COR.vinho + ';border-radius:11px 11px 0 0;padding:14px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="font:700 15px/28px ' + FONTE + ';color:#FFFFFF">' +
        (logo ? '<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;vertical-align:middle;margin-right:10px"><tr><td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;background:#FFFFFF;border-radius:7px">' + logo + '</td></tr></table>' : '') +
        '<span style="vertical-align:middle">' + esc(nome) + '</span></td>' +
      (o.chip ? '<td align="right" style="white-space:nowrap"><span style="display:inline-block;padding:3px 10px;border-radius:2em;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);font:600 12px/16px ' + FONTE + ';color:#FFFFFF;letter-spacing:.04em">' + esc(o.chip) + '</span></td>' : '') +
    '</tr></table></td></tr>' +

    // título
    '<tr><td class="px" style="padding:28px 28px 22px;border-bottom:1px solid ' + COR.borda + '">' +
      (o.sobre ? '<div style="font:600 12px/16px ' + FONTE + ';color:' + COR.vinho + ';text-transform:uppercase;letter-spacing:.06em">' + esc(o.sobre) + '</div>' : '') +
      '<h1 class="titulo" style="margin:6px 0 0;font:700 24px/31px ' + FONTE + ';color:' + COR.tinta + '">' + esc(o.titulo || '') + '</h1>' +
      (o.cabecalho || '') +
    '</td></tr>' +

    '<tr><td class="px" style="padding:24px 28px 8px">' + o.corpo + '</td></tr>' +

    // rodapé
    '<tr><td class="px" style="background:' + COR.fundo + ';border-top:1px solid ' + COR.borda + ';border-radius:0 0 11px 11px;padding:16px 28px;font:12px/1.6 ' + FONTE + ';color:' + COR.suave + '">' +
      '<b style="color:' + COR.tinta + '">' + esc(nome) + '</b>' + (o.caixa ? ' · <a href="mailto:' + esc(o.caixa) + '" style="color:' + COR.suave + '">' + esc(o.caixa) + '</a>' : '') +
      (o.rodape ? '<br>' + esc(o.rodape) : '') +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

// Botão do e-mail (tabela com fundo: o Outlook não pinta <a>).
function botao(texto, href) {
  return '<table role="presentation" class="cta" cellpadding="0" cellspacing="0" style="margin:18px 0 2px"><tr><td style="background:' + COR.vinho + ';border-radius:8px">' +
    '<a href="' + esc(href) + '" style="display:inline-block;padding:12px 22px;font:600 15px/20px ' + FONTE + ';color:#FFFFFF;text-decoration:none;border-radius:8px">' + esc(texto) + ' &rarr;</a></td></tr></table>';
}

// Cartão do app: cabeçalho cinza com título e o conteúdo embaixo.
function cartao(titulo, conteudo, iconeHtml) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ' + COR.borda + ';border-radius:10px;border-collapse:separate">' +
    '<tr><td style="background:' + COR.fundo + ';border-bottom:1px solid ' + COR.borda + ';border-radius:9px 9px 0 0;padding:11px 16px;font:600 14px/20px ' + FONTE + ';color:' + COR.tinta + '">' +
      (iconeHtml || '') + '<span style="vertical-align:middle">' + esc(titulo) + '</span></td></tr>' +
    '<tr><td style="padding:14px 16px">' + conteudo + '</td></tr></table>';
}

// Parágrafos do texto (linhas em branco separam).
function paragrafos(texto) {
  return String(texto || '').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
    .map(b => '<p style="margin:0 0 14px;font:15px/1.6 ' + FONTE + ';color:' + COR.tinta + '">' + b.split('\n').map(esc).join('<br>') + '</p>').join('');
}

// { corpo, cliente, competencia, faltando?, bancosPorTipo | bancosRecebidos, diaLimite, assinatura, caixa, agora, mostrarRecebidos } -> { html, imagens }
function htmlDaCobranca(o) {
  const imagens = [];
  const cliente = o.cliente || {};
  // bancosPorTipo é o formato de agora; bancosRecebidos era só do extrato e
  // segue valendo pro mês gravado antes desta mudança.
  const recebidos = (o.bancosPorTipo && typeof o.bancosPorTipo === 'object')
    ? o.bancosPorTipo
    : { extrato: Array.isArray(o.bancosRecebidos) ? o.bancosRecebidos : [] };
  const linhas = String(o.corpo || '').replace(/\r/g, '').split('\n');
  const faltando = Array.isArray(o.faltando) && o.faltando.length ? o.faltando
    : [...new Set(linhas.filter(l => /^\s*-\s+/.test(l)).map(tipoDaLinha).filter(Boolean))];
  const link = (linhas.find(l => /^\s*https?:\/\/\S+\s*$/.test(l)) || '').trim();

  // o texto do modelo, com a lista virando uma caixa no mesmo lugar
  const blocos = [];
  let paragrafo = [], cartoes = null;
  const fechaP = () => { if (paragrafo.length) blocos.push('<p style="margin:0 0 14px;font:15px/1.6 ' + FONTE + ';color:' + COR.tinta + '">' + paragrafo.map(esc).join('<br>') + '</p>'); paragrafo = []; };
  // a lista "- Extrato Bancário" vira uma caixa só, uma linha por documento
  const fechaC = () => {
    if (cartoes && cartoes.length) blocos.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#FFFFFF;border:1px solid ' + COR.borda + ';border-radius:10px;border-collapse:separate">' +
      cartoes.map((c, k) => '<tr><td style="padding:14px 16px;' + (k ? 'border-top:1px solid ' + COR.borda : '') + '">' + c + '</td></tr>').join('') + '</table>');
    cartoes = null;
  };
  linhas.forEach((bruta, i) => {
    const l = bruta.trim();
    if (/^-\s+/.test(l)) {
      fechaP();
      const tipo = tipoDaLinha(l);
      cartoes = cartoes || [];
      // "Extrato Bancário — veio só até 15/08, falta o resto do mês": a linha avisa
      const parte = (l.match(/—\s*veio\s+(.+?),\s*falta o resto do mês/) || [])[1];
      const nota = parte ? 'Chegou ' + parte + '. Falta o resto do mês.' : '';
      if (tipo && !cartoes.some(c => c.tipo === tipo)) { const c = new String(linhaDoDocumento(tipo, cliente, recebidos, imagens, nota, o.mostrarRecebidos === true)); c.tipo = tipo; cartoes.push(c); }
      else if (!tipo) cartoes.push('<div style="font:600 15px/1.4 ' + FONTE + ';color:' + COR.tinta + '">' + esc(l.replace(/^-\s+/, '')) + '</div>');
    } else if (/^https?:\/\//.test(l)) {
      fechaP(); fechaC();                                   // o link vira o botão lá embaixo
    } else if (l.endsWith(':') && /^https?:\/\//.test((linhas[i + 1] || '').trim())) {
      fechaP();                                             // "…fica sempre atualizado aqui:" sai junto com o link
    } else if (!l) { fechaP(); fechaC(); }
    else { fechaC(); paragrafo.push(l); }
  });
  fechaP(); fechaC();

  const p = progresso(cliente, faltando, recebidos);
  const comp = String(o.competencia || '').split('-');
  const mesNome = MESES[Number(comp[1]) - 1] || '';
  const chip = MES_CURTO[Number(comp[1]) - 1] ? MES_CURTO[Number(comp[1]) - 1] + ' ' + comp[0] : '';
  const prazo = textoDoPrazo(o.competencia, o.diaLimite, o.agora);
  const nomeCliente = (cliente.nomeFantasia || '').trim() || cliente.nome || '';
  const pct = p.total ? Math.round(p.feitos / p.total * 100) : 0;
  const barra = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;border-radius:99px;background:' + COR.faixa + '"><tr>' +
    (pct > 0 ? '<td width="' + pct + '%" style="height:10px;line-height:10px;font-size:0;background:' + COR.ok + ';border-radius:99px">&nbsp;</td>' : '') +
    (pct < 100 ? '<td style="height:10px;line-height:10px;font-size:0">&nbsp;</td>' : '') + '</tr></table>';
  const iconePrazo = prazo ? imagem(imagens, PASTA_ICONES, 'prazo', 16, 'display:inline-block;vertical-align:-3px;margin-right:6px') : '';
  const iconeAnexo = imagem(imagens, PASTA_ICONES, 'anexo', 16, 'display:inline-block;vertical-align:middle;margin-right:8px') || '';
  const passo = (n, texto) => '<tr><td width="30" style="padding:4px 0;vertical-align:top"><div style="width:20px;height:20px;border-radius:99px;border:1px solid ' + COR.borda +
    ';background:' + COR.fundo + ';color:' + COR.tinta + ';font:600 11px/20px ' + FONTE + ';text-align:center">' + n + '</div></td><td style="padding:5px 0 4px;font:14px/1.45 ' + FONTE + ';color:' + COR.suave + '">' + texto + '</td></tr>';

  // o que já chegou só aparece se o escritório ligou isso nas configurações
  const mostrar = o.mostrarRecebidos === true;
  const cabecalho = (mostrar ? barra +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="font:13px/18px ' + FONTE + ';color:' + COR.suave + '">' + p.feitos + ' de ' + p.total + ' já chegaram</td>' +
      '<td align="right" style="font:700 13px/18px ' + FONTE + ';color:' + COR.ok + '">' + pct + '%</td></tr></table>' : '') +
    (prazo ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:' + (mostrar ? 16 : 18) + 'px"><tr><td style="padding:10px 14px;border-radius:8px;background:' + (prazo.atrasado ? COR.faltaClaro : COR.fundo) +
      ';border:1px solid ' + (prazo.atrasado ? COR.faltaBorda : COR.borda) + ';font:600 14px/20px ' + FONTE + ';color:' + (prazo.atrasado ? COR.falta : COR.tinta) + '">' + (iconePrazo || '') + esc(prazo.texto) + '</td></tr></table>' : '') +
    (link ? botao('Enviar pela sua página', link) : '');

  const comoMandar = cartao('Como mandar',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      passo(1, 'Responda este e-mail.') +
      passo(2, 'Anexe os PDFs ou as fotos dos documentos.') +
      passo(3, 'Pronto: o recebimento é marcado sozinho, sem precisar avisar.') +
    '</table>' +
    (link ? botao('Enviar ou conferir pela sua página', link) +
      '<div style="font:12px/1.5 ' + FONTE + ';color:' + COR.suave + ';margin-top:8px">Na página dá pra mandar a foto do documento direto do celular' + (mostrar ? ' e ver o que já chegou' : '') + '.</div>' : ''),
    iconeAnexo);

  const html = moldura({
    imagens, assinatura: o.assinatura, caixa: o.caixa, chip,
    previa: (p.faltam === 1 ? 'Falta 1 documento' : 'Faltam ' + p.faltam + ' documentos') + ' de ' + mesNome + (prazo ? '. ' + prazo.texto : ''),
    titulo: (p.faltam === 1 ? 'Falta 1 documento' : 'Faltam ' + p.faltam + ' documentos') + (mesNome ? ' de ' + mesNome : ''),
    sobre: nomeCliente, cabecalho,
    corpo: blocos.join('') + comoMandar,
    rodape: 'Mensagem enviada pelo sistema do escritório. Se já mandou, desconsidere: o registro atualiza em poucas horas.',
  });
  return { html, imagens };
}

// Disparo pra vários clientes (Robô do Gmail › Disparo): o texto que a pessoa
// escreveu e o arquivo anexado, na mesma moldura.
// { assunto, corpo, assinatura, caixa, anexo: { nome, tamanho } } -> { html, imagens }
function htmlDoDisparo(o) {
  const imagens = [];
  const a = o.anexo || null;
  const kb = a && a.tamanho ? (a.tamanho >= 1048576 ? (a.tamanho / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(a.tamanho / 1024)) + ' KB') : '';
  const iconeAnexo = imagem(imagens, PASTA_ICONES, 'anexo', 16, 'display:inline-block;vertical-align:middle;margin-right:8px') || '';
  const ext = a ? (String(a.nome || '').match(/\.([a-z0-9]{2,5})$/i) || [, 'arq'])[1].toUpperCase() : '';
  const arquivo = a ? cartao('Arquivo anexado',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td width="54" style="vertical-align:middle"><table role="presentation" width="42" height="42" cellpadding="0" cellspacing="0" style="background:' + COR.vinhoClaro + ';border-radius:9px"><tr><td align="center" valign="middle" style="height:42px;font:800 11px/1 ' + FONTE + ';color:' + COR.vinho + ';letter-spacing:.03em">' + esc(ext.slice(0, 4)) + '</td></tr></table></td>' +
      '<td style="vertical-align:middle"><div style="font:600 14px/20px ' + FONTE + ';color:' + COR.tinta + ';overflow-wrap:anywhere">' + esc(a.nome) + '</div>' +
      '<div style="font:12px/16px ' + FONTE + ';color:' + COR.suave + ';margin-top:2px">' + (kb ? kb + ' · ' : '') + 'está no fim deste e-mail, é só abrir ou baixar.</div></td>' +
    '</tr></table>', iconeAnexo) : '';
  const html = moldura({
    imagens, assinatura: o.assinatura, caixa: o.caixa, sobre: 'Comunicado',
    previa: String(o.corpo || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    titulo: o.assunto || '', corpo: paragrafos(o.corpo) + arquivo,
    rodape: 'Mensagem enviada pelo sistema do escritório para os clientes.',
  });
  return { html, imagens };
}

// ---------- O desenho "Recibo" (05/11/2026, Vitor escolheu a opção 1 de 3) ----------
// A NFS-e e o envio do DP/Fiscal: fundo cinza, o logo no alto, um cartão branco só com o destaque grande no centro (o
// valor da nota, ou o mês dos documentos), um selo, o texto do modelo, os dados em linhas finas e os anexos; o rodapé
// solto embaixo. Sem faixa colorida: o vinho fica só nos detalhes. A cobrança e o disparo seguem na moldura antiga.
const kbDe = t => (t >= 1048576 ? (t / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round((t || 0) / 1024)) + ' KB');
// "10/2026" ou "2026-10" -> "outubro de 2026"; o que não for mês fica como veio
function mesPorExtenso(c) {
  const s = String(c || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{4})$/), mes, ano;
  if (m) { mes = Number(m[1]); ano = m[2]; } else if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) { mes = Number(m[2]); ano = m[1]; }
  return mes >= 1 && mes <= 12 ? MESES[mes - 1] + ' de ' + ano : s;
}
// a chave de 50 dígitos em grupos de 4 (quebra bonita e dá pra conferir de olho)
const chaveEmGrupos = c => String(c || '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');

function seloRecibo(texto, tipo) {
  const c = tipo === 'ok' ? [COR.okClaro, COR.ok] : tipo === 'falta' ? [COR.faltaClaro, COR.falta] : [COR.faixa, COR.suave];
  return '<span style="display:inline-block;padding:4px 12px;border-radius:99px;background:' + c[0] + ';font:600 12px/16px ' + FONTE + ';color:' + c[1] + '">' + esc(texto) + '</span>';
}
// os dados em linhas finas: o rótulo à esquerda, o valor à direita
function linhasRecibo(dados) {
  const ds = dados.filter(d => d[1]);
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px">' + ds.map((d, k) => {
    const b = k < ds.length - 1 ? 'border-bottom:1px solid ' + COR.faixa + ';' : '';
    return '<tr><td style="padding:12px 12px 12px 0;' + b + 'font:14px/20px ' + FONTE + ';color:' + COR.suave + ';white-space:nowrap;vertical-align:top">' + esc(d[0]) + '</td>' +
      '<td align="right" style="padding:12px 0;' + b + 'font:600 14px/20px ' + FONTE + ';color:' + COR.tinta + ';overflow-wrap:anywhere">' + esc(d[1]) + '</td></tr>';
  }).join('') + '</table>';
}
// os arquivos anexados, um por linha: a sigla da extensão, o nome e o tamanho
function anexosRecibo(anexos) {
  const as = anexos || [];
  if (!as.length) return '';
  return '<div style="margin:24px 0 0;font:600 12px/16px ' + FONTE + ';color:' + COR.suave + ';text-transform:uppercase;letter-spacing:.06em">' + (as.length === 1 ? 'Arquivo anexado' : as.length + ' arquivos anexados') + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">' + as.map((a, k) => {
      const ext = (String(a.nome || '').match(/\.([a-z0-9]{2,5})$/i) || [, 'arq'])[1].toUpperCase().slice(0, 4);
      const b = k < as.length - 1 ? 'border-bottom:1px solid ' + COR.faixa + ';' : '';
      return '<tr><td width="52" style="padding:10px 0;' + b + 'vertical-align:middle"><table role="presentation" width="40" height="40" cellpadding="0" cellspacing="0" style="background:' + COR.vinhoClaro + ';border-radius:10px"><tr><td align="center" valign="middle" style="height:40px;font:800 10px/1 ' + FONTE + ';color:' + COR.vinho + ';letter-spacing:.03em">' + esc(ext) + '</td></tr></table></td>' +
        '<td style="padding:10px 0;' + b + 'vertical-align:middle"><div style="font:600 14px/20px ' + FONTE + ';color:' + COR.tinta + ';overflow-wrap:anywhere">' + esc(a.nome) + '</div>' +
        '<div style="font:12px/16px ' + FONTE + ';color:' + COR.fraca + '">' + (ext ? ext + ' · ' : '') + 'no fim deste e-mail</div></td></tr>';
    }).join('') + '</table>';
}
// o texto do modelo, à esquerda (pode ter vários parágrafos)
const textoRecibo = t => String(t || '').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  .map(b => '<p style="margin:0 0 14px;font:15px/24px ' + FONTE + ';color:#3A393E">' + b.split('\n').map(l => esc(l).replace(/R\$ (?=\d)/g, 'R$&nbsp;')).join('<br>') + '</p>').join('');

// { titulo, previa, rotulo, destaque, selo, corpo, assinatura, caixa, rodape, imagens }
function recibo(o) {
  const logo = imagem(o.imagens, PASTA_ICONES, 'marca', [20, 32], 'display:block;margin:0 auto') || '';
  const nome = o.assinatura || 'Nilma Contabilidade';
  const css = '@media only screen and (max-width:520px){.fora{padding:24px 10px 28px!important}.px{padding-left:20px!important;padding-right:20px!important}' +
    '.destaque{font-size:36px!important;line-height:44px!important}}';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>' + esc(o.titulo || nome) + '</title>' +
    '<style>' + css + '</style></head>' +
    '<body style="margin:0;padding:0;background:#F4F4F5;-webkit-text-size-adjust:100%">' +
    (o.previa ? '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + esc(o.previa) + '&#8199;&#65279;&#847;'.repeat(20) + '</div>' : '') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5"><tr><td class="fora" align="center" style="padding:40px 12px 36px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">' +
      (logo ? '<tr><td align="center" style="padding-bottom:22px">' + logo + '</td></tr>' : '') +
      '<tr><td class="px" style="background:#FFFFFF;border-radius:16px;padding:36px 40px 32px">' +
        '<div style="font:500 13px/18px ' + FONTE + ';color:' + COR.suave + ';text-align:center">' + esc(o.rotulo || '') + '</div>' +
        '<div class="destaque" style="font:700 44px/52px ' + FONTE + ';color:' + COR.tinta + ';text-align:center;letter-spacing:-1px;margin:8px 0 10px">' + esc(o.destaque || '') + '</div>' +
        (o.selo ? '<div style="text-align:center;margin-bottom:28px">' + o.selo + '</div>' : '<div style="height:18px;line-height:18px;font-size:0">&nbsp;</div>') +
        o.corpo +
      '</td></tr>' +
      '<tr><td align="center" style="padding:22px 20px 0;font:12px/18px ' + FONTE + ';color:' + COR.fraca + '">' +
        '<b style="color:' + COR.suave + '">' + esc(nome) + '</b>' + (o.caixa ? ' · <a href="mailto:' + esc(o.caixa) + '" style="color:' + COR.fraca + '">' + esc(o.caixa) + '</a>' : '') +
        '<br>' + esc(o.rodape || 'Dúvidas? É só responder este e-mail.') +
      '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

// A NFS-e autorizada para o tomador (nfse-email.js): o valor em destaque, o texto da configuração (Financeiro ›
// Configurações › E-mail ao cliente), os dados, a chave e os dois arquivos anexados.
// { assunto, texto, cliente, numero, valor, competencia, chave, anexos: [{ nome, tamanho }], semValor, assinatura, caixa } -> { html, imagens }
function htmlDaNfse(o) {
  const imagens = [];
  const chave = chaveEmGrupos(o.chave);
  const corpo = textoRecibo(o.texto) +
    linhasRecibo([['Tomador', o.cliente], ['Competência', mesPorExtenso(o.competencia)], ['Número da nota', o.numero]]) +
    (chave ? '<div style="margin-top:16px;padding:14px 16px;background:' + COR.fundo + ';border-radius:10px;font:12px/18px ' + FONTE + ';color:' + COR.suave + '">Chave de acesso<br>' +
      '<span style="font:600 12px/20px Consolas,Menlo,monospace;color:' + COR.tinta + '">' + esc(chave) + '</span></div>' : '') +
    anexosRecibo(o.anexos);
  const html = recibo({
    imagens, assinatura: o.assinatura, caixa: o.caixa,
    titulo: o.assunto || ('NFS-e ' + (o.numero || '')),
    previa: String(o.texto || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    rotulo: 'Nota fiscal de serviço' + (o.numero ? ' nº ' + o.numero : ''),
    destaque: o.valor || '',
    selo: o.semValor ? seloRecibo('Teste · sem valor fiscal', 'falta') : seloRecibo('● Autorizada', 'ok'),
    corpo, rodape: 'Dúvidas? É só responder este e-mail.',
  });
  return { html, imagens };
}

// O envio do DP ao cliente (DP › Envios, envios-do-dp.js) e as guias do Fiscal (lote-fiscal.js, com o chip 'Fiscal'), no
// desenho "Banco digital" (05/11/2026, Vitor escolheu entre 3; a NFS-e ficou no "Recibo"): o bloco vinho no alto com a área,
// o cliente e "Seus documentos de outubro chegaram"; um cartão branco encostado nele com um arquivo por linha (o ícone de
// arquivo vermelho, o nome e o tamanho; a guia com valor e vencimento lidos mostra os dois à direita); embaixo o texto do
// modelo (config/envioDp ou config/envioFiscal, já preenchido) e o rodapé solto. A cobrança e o disparo seguem na moldura antiga.
// O cartão "sobe" no bloco vinho por um degradê no fundo da linha (sem margem negativa, que o Gmail tira); quem não pinta
// degradê mostra o cartão logo abaixo do bloco, que também fica bom.
// { assunto, texto, cliente, competencia, anexos: [{ nome, tamanho, rotulo?, valor?, vencimento? }], assinatura, caixa, chip, rodape } -> { html, imagens }
const VINHO_FUNDO = '#8E1C22', FUNDO_DP = '#F2EEEE';
const reaisDe = v => (typeof v === 'number' && Number.isFinite(v)) ? 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
// "25/11/2026" ou "2026-11-25" -> "25/11"
function diaMes(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0');
  m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? m[2] + '/' + m[1] : '';
}
function linhaDoArquivo(a, k, icone) {
  const ext = (String(a.nome || '').match(/\.([a-z0-9]{2,5})$/i) || [, ''])[1].toUpperCase();
  const titulo = a.rotulo || String(a.nome || '').replace(/\.[a-z0-9]{2,5}$/i, '');
  // sem o tamanho (05/11/2026, Vitor): embaixo do título vai o nome do arquivo anexado
  const valor = reaisDe(a.valor), venc = diaMes(a.vencimento);
  const b = k ? 'border-top:1px solid #F0EAEA;' : '';
  return '<tr><td style="padding:12px 0;' + b + '"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td width="52" valign="middle"><table role="presentation" width="40" height="40" cellpadding="0" cellspacing="0" style="background:' + COR.vinhoClaro + ';border-radius:12px"><tr><td align="center" valign="middle" style="height:40px">' + icone + '</td></tr></table></td>' +
    '<td valign="middle"><div style="font:600 15px/20px ' + FONTE + ';color:' + COR.tinta + ';overflow-wrap:anywhere">' + esc(titulo) + '</div>' +
      (a.rotulo ? '<div style="font:12px/16px ' + FONTE + ';color:' + COR.fraca + ';overflow-wrap:anywhere">' + esc(a.nome) + '</div>' : (ext ? '<div style="font:12px/16px ' + FONTE + ';color:' + COR.fraca + '">' + esc(ext) + '</div>' : '')) + '</td>' +
    (valor || venc ? '<td align="right" valign="middle" style="white-space:nowrap;padding-left:10px">' +
      (valor ? '<div style="font:700 14px/20px ' + FONTE + ';color:' + COR.tinta + '">' + esc(valor) + '</div>' : '') +
      (venc ? '<div style="font:12px/16px ' + FONTE + ';color:' + COR.falta + '">vence ' + esc(venc) + '</div>' : '') + '</td>' : '') +
    '</tr></table></td></tr>';
}

function htmlDoEnvioDp(o) {
  const imagens = [];
  const chip = o.chip || 'DP';
  const fiscal = chip === 'Fiscal';
  const nome = o.assinatura || 'Nilma Contabilidade';
  const mes = mesPorExtenso(o.competencia).replace(/ de \d{4}$/, '');
  const anexos = o.anexos || [];
  const logo = imagem(imagens, PASTA_ICONES, 'marca', [14, 22], 'display:block;margin:0 auto') || '';
  const icone = imagem(imagens, PASTA_ICONES, 'arquivo', [22, 26], 'display:block;margin:0 auto') || '';
  const area = fiscal ? 'Fiscal' : 'Departamento Pessoal';
  const manchete = (fiscal ? (anexos.length === 1 ? 'Sua guia de ' : 'Suas guias de ') : (anexos.length === 1 ? 'Seu documento de ' : 'Seus documentos de ')) + mes + (anexos.length === 1 ? ' chegou' : ' chegaram');
  const css = '@media only screen and (max-width:520px){.px{padding-left:16px!important;padding-right:16px!important}.hero{padding:28px 22px 56px!important}.manchete{font-size:24px!important;line-height:31px!important}}';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>' + esc(o.assunto || nome) + '</title>' +
    '<style>' + css + '</style></head>' +
    '<body style="margin:0;padding:0;background:' + FUNDO_DP + ';-webkit-text-size-adjust:100%">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + esc(String(o.texto || '').replace(/\s+/g, ' ').trim().slice(0, 140)) + '&#8199;&#65279;&#847;'.repeat(20) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + FUNDO_DP + '"><tr><td align="center" style="padding:0 0 36px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">' +
      // o bloco vinho
      '<tr><td class="hero" bgcolor="' + VINHO_FUNDO + '" style="background:' + VINHO_FUNDO + ';background-image:linear-gradient(180deg,' + COR.vinho + ',' + VINHO_FUNDO + ');padding:34px 40px 64px">' +
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
          (logo ? '<td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;background:#FFFFFF;border-radius:10px">' + logo + '</td>' : '') +
          '<td style="padding-left:10px;font:700 15px/20px ' + FONTE + ';color:#FFFFFF">' + esc(nome) + '</td>' +
          '<td style="padding-left:10px"><span style="display:inline-block;padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.18);font:600 12px/16px ' + FONTE + ';color:#FFFFFF">' + esc(chip) + '</span></td>' +
        '</tr></table>' +
        '<div style="font:500 14px/20px ' + FONTE + ';color:#F6CFD1;margin-top:30px">' + esc(area + (o.cliente ? ' · ' + o.cliente : '')) + '</div>' +
        '<div class="manchete" style="font:700 28px/36px ' + FONTE + ';color:#FFFFFF;margin-top:4px">' + esc(manchete) + '</div>' +
      '</td></tr>' +
      // o cartão encostado no bloco
      '<tr><td class="px" bgcolor="' + FUNDO_DP + '" style="padding:0 24px;background-image:linear-gradient(180deg,' + VINHO_FUNDO + ' 0,' + VINHO_FUNDO + ' 40px,' + FUNDO_DP + ' 40px)">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;border-collapse:separate;box-shadow:0 8px 24px rgba(80,20,24,.10)"><tr><td style="padding:8px 24px">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + anexos.map((a, k) => linhaDoArquivo(a, k, icone)).join('') + '</table>' +
          '<div style="padding:2px 0 12px;font:12px/16px ' + FONTE + ';color:' + COR.fraca + '">' + (anexos.length === 1 ? 'O arquivo está' : 'Os arquivos estão') + ' no fim deste e-mail.</div>' +
        '</td></tr></table>' +
      '</td></tr>' +
      // o texto do modelo e o rodapé
      '<tr><td class="px" style="padding:24px 28px 0">' + textoRecibo(o.texto) + '</td></tr>' +
      '<tr><td align="center" class="px" style="padding:12px 28px 0;font:12px/18px ' + FONTE + ';color:#8C7A7B">' +
        '<b style="color:' + COR.suave + '">' + esc(nome) + '</b>' + (o.caixa ? ' · <a href="mailto:' + esc(o.caixa) + '" style="color:#8C7A7B">' + esc(o.caixa) + '</a>' : '') +
        '<br>' + esc(o.rodape || 'Dúvidas? É só responder este e-mail.') +
      '</td></tr>' +
    '</table></td></tr></table></body></html>';
  return { html, imagens };
}

module.exports = { htmlDaCobranca, htmlDoDisparo, htmlDaNfse, htmlDoEnvioDp, textoDoPrazo, progresso, PASTA_LOGOS, PASTA_ICONES };
