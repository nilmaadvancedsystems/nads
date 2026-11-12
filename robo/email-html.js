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

// O Checklist mensal do Fiscal (12/11/2026, cartas-fiscal.js): o texto do e-mail, o prazo em destaque, cada bloco do
// checklist num cartão (a nota, os itens em lista e a observação) e o aviso do fim; o mesmo checklist vai em PDF, anexo.
// { assunto, texto, prazo ('02/12/2026'), mes ('novembro de 2026'), introducao, secoes (cartasFiscal.CHECKLIST), atencao,
//   anexo: { nome, tamanho }, assinatura, caixa } -> { html, imagens }
function htmlDoChecklist(o) {
  const imagens = [];
  const p = (t, estilo) => '<p style="margin:0 0 10px;font:14px/1.6 ' + FONTE + ';color:' + (estilo || COR.tinta) + '">' + esc(t) + '</p>';
  const lista = itens => '<ul style="margin:0 0 10px;padding:0 0 0 20px">' +
    itens.map(i => '<li style="margin:0 0 4px;font:14px/1.5 ' + FONTE + ';color:' + COR.tinta + '">' + esc(i) + '</li>').join('') + '</ul>';
  const blocos = (o.secoes || []).map(s => cartao(s.titulo,
    (s.paragrafos || []).map(x => p(x)).join('') +
    (s.nota ? p(s.nota, COR.suave) : '') +
    s.grupos.map(g => (g.titulo ? '<div style="margin:4px 0 4px;font:600 13px/18px ' + FONTE + ';color:' + COR.vinho + '">' + esc(g.titulo) + '</div>' : '') + lista(g.itens)).join('') +
    (s.obs ? '<div style="margin:4px 0 0;padding:10px 12px;background:' + COR.faltaClaro + ';border:1px solid ' + COR.faltaBorda + ';border-radius:8px;font:13px/1.5 ' + FONTE + ';color:' + COR.falta + '"><b>Obs.:</b> ' + esc(s.obs) + '</div>' : ''))).join('');
  const prazo = '<div style="margin:14px 0 0;padding:12px 14px;background:' + COR.vinhoClaro + ';border-radius:10px;font:700 16px/22px ' + FONTE + ';color:' + COR.vinho + '">' +
    'Prazo de envio: até ' + esc(o.prazo) + '</div><div style="margin:6px 0 0;font:13px/18px ' + FONTE + ';color:' + COR.suave + '">2º dia útil do mês, com os documentos de ' + esc(o.mes) + '.</div>';
  const a = o.anexo;
  const anexo = a ? '<div style="margin:0 0 18px;font:13px/18px ' + FONTE + ';color:' + COR.suave + '">' +
    (imagem(imagens, PASTA_ICONES, 'anexo', 14, 'display:inline-block;vertical-align:middle;margin-right:6px;opacity:.7') || '') +
    'Em anexo: <b style="color:' + COR.tinta + '">' + esc(a.nome) + '</b>' + (a.tamanho ? ' (' + kbDe(a.tamanho) + ')' : '') + '</div>' : '';
  const atencao = o.atencao ? '<div style="margin:0 0 18px;padding:12px 14px;border:1px solid ' + COR.vinho + ';border-radius:10px;font:13px/1.55 ' + FONTE + ';color:' + COR.tinta + '">' +
    '<b style="color:' + COR.vinho + '">Atenção:</b> ' + esc(o.atencao) + '</div>' : '';
  const html = moldura({
    imagens, assinatura: o.assinatura, caixa: o.caixa, chip: 'Fiscal', sobre: 'Checklist mensal de documentos',
    previa: 'Envie os documentos de ' + (o.mes || 'este mês') + ' até ' + (o.prazo || 'o 2º dia útil') + '.',
    titulo: 'O que enviar de ' + (o.mes || 'este mês'), cabecalho: prazo,
    corpo: paragrafos(o.texto) + (o.introducao ? p(o.introducao, COR.suave) : '') + anexo + blocos + atencao,
    rodape: 'Mensagem enviada pelo sistema do escritório no último dia útil de cada mês. Departamento Fiscal.',
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
  .map(b => '<p style="margin:0 0 14px;font:15px/24px ' + FONTE + ';color:#3A393E">' + b.split('\n').map(l => esc(l).replace(/R\$ (?=\d)/g, () => 'R$&nbsp;')).join('<br>') + '</p>').join('');

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

// A NFS-e autorizada para o tomador (nfse-email.js), no desenho "Banco digital" do DP/Fiscal (06/11/2026, Vitor: "Quero
// esse estilo pra nf também"): o bloco vinho com a saudação, a manchete e o valor grande; o cartão encostado com a nota em
// grade (número, competência, serviço, emissão); os arquivos (ícone vermelho, sem o tamanho); o botão da consulta pública;
// a chave em grupos e o rodapé.
// { assunto, texto, cliente, numero, valor, competencia, servico, emitidaEm, chave, anexos: [{ nome }], semValor, assinatura, caixa } -> { html, imagens }
const PORTAL_NFSE = 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=';
function htmlDaNfse(o) {
  const imagens = [];
  const nome = o.assinatura || 'Nilma Contabilidade';
  const mesAno = mesPorExtenso(o.competencia);
  const mes = mesAno.replace(/ de \d{4}$/, '');
  const anexos = o.anexos || [];
  const chave = chaveEmGrupos(o.chave);
  const logo = imagem(imagens, PASTA_ICONES, 'marca', [14, 22], 'display:block;margin:0 auto') || '';
  const icone = imagem(imagens, PASTA_ICONES, 'arquivo', [22, 26], 'display:block;margin:0 auto') || '';
  const primeiroNome = String(o.cliente || '').trim();
  // o bloco já diz "Olá, cliente!": o primeiro parágrafo do modelo, se for a saudação, sai do texto
  const texto = String(o.texto || '').replace(/\r/g, '').replace(/^\s*ol[áa][^\n]*\n\s*\n/i, '');
  const manchete = mes && /^[a-zç]+$/.test(mes) ? 'Sua nota fiscal de ' + mes + ' chegou' : 'Sua nota fiscal chegou';
  const servico = String(o.servico || '').split(/\r?\n/)[0].trim().slice(0, 70);
  const celula = (rotulo, valor) => '<td class="meia" width="50%" valign="top" style="padding:10px 0">' +
    '<div style="font:12px/16px ' + FONTE + ';color:' + COR.fraca + '">' + esc(rotulo) + '</div>' +
    '<div style="font:600 15px/21px ' + FONTE + ';color:' + COR.tinta + ';overflow-wrap:anywhere;margin-top:2px">' + esc(valor || '—') + '</div></td>';
  const grade = [['Nota nº', o.numero], ['Competência', mesAno], ['Serviço', servico], ['Emitida em', o.emitidaEm]].filter(d => d[1]);
  const linhasDaGrade = [];
  for (let k = 0; k < grade.length; k += 2) linhasDaGrade.push('<tr>' + celula(grade[k][0], grade[k][1]) + (grade[k + 1] ? celula(grade[k + 1][0], grade[k + 1][1]) : '<td class="meia" width="50%"></td>') + '</tr>');
  const cartaoBranco = (dentro, classe) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;border-collapse:separate' + (classe === 'sombra' ? ';box-shadow:0 10px 30px rgba(80,20,24,.12)' : '') + '"><tr><td class="cartao" style="padding:14px 26px">' + dentro + '</td></tr></table>';
  const arquivos = anexos.map((a, k) => linhaDoArquivo({ nome: a.nome, rotulo: '' }, k, icone)).join('');
  const css = '@media only screen and (max-width:520px){.px{padding-left:16px!important;padding-right:16px!important}.hero{padding:26px 22px 60px!important}' +
    '.manchete{font-size:22px!important;line-height:29px!important}.valor{font-size:34px!important;line-height:42px!important}.cartao{padding:10px 18px!important}.texto{padding:20px 18px 6px!important}}';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>' + esc(o.assunto || nome) + '</title>' +
    '<style>' + css + '</style></head>' +
    '<body style="margin:0;padding:0;background:' + FUNDO_DP + ';-webkit-text-size-adjust:100%">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + esc(texto.replace(/\s+/g, ' ').trim().slice(0, 140)) + '&#8199;&#65279;&#847;'.repeat(20) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + FUNDO_DP + '"><tr><td align="center" style="padding:0 0 32px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">' +
      // o bloco vinho
      '<tr><td class="hero" bgcolor="' + VINHO_FUNDO + '" style="background:' + VINHO_FUNDO + ';padding:30px 40px 68px">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
            (logo ? '<td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;background:#FFFFFF;border-radius:10px">' + logo + '</td>' : '') +
            '<td style="padding-left:10px;font:700 15px/20px ' + FONTE + ';color:#FFFFFF">' + esc(nome) + '</td></tr></table></td>' +
          '<td align="right" valign="middle"><span style="display:inline-block;padding:4px 12px;border-radius:99px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);font:600 12px/16px ' + FONTE + ';color:#FFFFFF;white-space:nowrap">' + (o.semValor ? 'Teste · sem valor fiscal' : 'NFS-e') + '</span></td>' +
        '</tr></table>' +
        (primeiroNome ? '<div style="font:500 14px/20px ' + FONTE + ';color:#F6CFD1;margin-top:30px">Olá, ' + esc(primeiroNome) + '!</div>' : '<div style="height:30px;line-height:30px;font-size:0">&nbsp;</div>') +
        '<div class="manchete" style="font:700 26px/34px ' + FONTE + ';color:#FFFFFF;margin-top:6px">' + esc(manchete) + '</div>' +
        (o.valor ? '<div class="valor" style="font:800 40px/48px ' + FONTE + ';color:#FFFFFF;letter-spacing:-.5px;margin-top:14px;white-space:nowrap">' + esc(o.valor).replace(/R\$ /, () => 'R$&nbsp;') + '</div>' : '') +
      '</td></tr>' +
      // a nota em grade, encostada no bloco
      '<tr><td class="px" bgcolor="' + FUNDO_DP + '" style="padding:0 24px;background-image:linear-gradient(180deg,' + VINHO_FUNDO + ' 0,' + VINHO_FUNDO + ' 44px,' + FUNDO_DP + ' 44px)">' +
        cartaoBranco('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + linhasDaGrade.join('') + '</table>', 'sombra') +
      '</td></tr>' +
      // os arquivos
      (arquivos ? '<tr><td class="px" style="padding:16px 24px 0">' + cartaoBranco(
        '<div style="padding:4px 0 0;font:700 13px/18px ' + FONTE + ';color:' + COR.tinta + '">' + (anexos.length === 1 ? 'Arquivo no fim deste e-mail' : 'Arquivos no fim deste e-mail') + '</div>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + arquivos + '</table>') + '</td></tr>' : '') +
      // o texto do modelo
      (texto.trim() ? '<tr><td class="px" style="padding:16px 24px 0">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;border-collapse:separate"><tr><td class="texto" style="padding:24px 28px 10px">' + textoRecibo(texto) + '</td></tr></table></td></tr>' : '') +
      // o botão da consulta pública e a chave
      (chave ? '<tr><td class="px" style="padding:18px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="' + VINHO_FUNDO + '" style="background:' + VINHO_FUNDO + ';border-radius:99px">' +
        '<a href="' + esc(PORTAL_NFSE + String(o.chave).replace(/\D/g, '')) + '" style="display:block;padding:15px 20px;font:700 15px/20px ' + FONTE + ';color:#FFFFFF;text-decoration:none;border-radius:99px">Ver a nota no portal &rarr;</a></td></tr></table></td></tr>' +
        '<tr><td align="center" class="px" style="padding:16px 28px 0;font:12px/18px ' + FONTE + ';color:#8C7A7B">Chave de acesso: ' + esc(chave) + '</td></tr>' : '') +
      // o rodapé
      '<tr><td align="center" class="px" style="padding:16px 28px 0;font:12px/18px ' + FONTE + ';color:#8C7A7B">' +
        '<b style="color:' + COR.suave + '">' + esc(nome) + '</b>' + (o.caixa ? ' · <a href="mailto:' + esc(o.caixa) + '" style="color:#8C7A7B">' + esc(o.caixa) + '</a>' : '') +
        '<br>Dúvidas? É só responder este e-mail.' +
      '</td></tr>' +
    '</table></td></tr></table></body></html>';
  return { html, imagens };
}

// O envio do DP ao cliente (DP › Envios, envios-do-dp.js), as guias do Fiscal (lote-fiscal.js, com o chip 'Fiscal') e o boleto
// dos honorários (boletos-financeiro.js, com o chip 'Financeiro'), no
// desenho "Banco digital" (05/11/2026, Vitor escolheu entre 3; a NFS-e ficou no "Recibo"):
//   - o bloco vinho no alto: a marca, a área e o cliente, a manchete ("Suas guias de outubro chegaram") e um resumo — nas
//     guias com valor lido, o total a pagar e o vencimento mais perto; senão, quantos documentos e o mês;
//   - um cartão branco encostado no bloco com um arquivo por linha: o ícone de arquivo vermelho, o documento, o nome do
//     anexo e, na guia, o valor e o vencimento num selo;
//   - o texto do modelo (config/envioDp ou config/envioFiscal, já preenchido) num segundo cartão e o rodapé solto.
// O cartão "sobe" no bloco por um degradê no fundo da linha (sem margem negativa, que o Gmail tira); quem não pinta degradê
// mostra o cartão logo abaixo do bloco, que também fica bom. A cobrança e o disparo seguem na moldura antiga.
// { assunto, texto, cliente, competencia, anexos: [{ nome, tamanho, rotulo?, valor?, vencimento? }], assinatura, caixa, chip, rodape } -> { html, imagens }
const VINHO_FUNDO = '#A3232A', FUNDO_DP = '#F4F2F2';
const reaisDe = v => (typeof v === 'number' && Number.isFinite(v)) ? 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// "25/11/2026" ou "2026-11-25" -> { dm: '25/11', curto: '25 nov', chave: '20261125' }
function diaMes(v) {
  const s = String(v || '').trim();
  let d, m, a = '';
  let x = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (x) { d = +x[1]; m = +x[2]; a = x[3] || ''; } else if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { a = x[1]; m = +x[2]; d = +x[3]; }
  if (!d || !m || m > 12) return null;
  return { dm: pad2(d) + '/' + pad2(m), curto: d + ' ' + MES_ABREV[m - 1], chave: String(a).padStart(4, '0') + pad2(m) + pad2(d) };
}
function linhaDoArquivo(a, k, icone) {
  const ext = (String(a.nome || '').match(/\.([a-z0-9]{2,5})$/i) || [, ''])[1].toUpperCase();
  const titulo = a.rotulo || String(a.nome || '').replace(/\.[a-z0-9]{2,5}$/i, '');
  const valor = reaisDe(a.valor), venc = diaMes(a.vencimento);
  const b = k ? 'border-top:1px solid #F0EAEA;' : '';
  // embaixo do título: o nome do arquivo anexado (sem o tamanho, 05/11/2026)
  const sub = a.rotulo ? String(a.nome || '') : ext;
  return '<tr><td style="padding:14px 0;' + b + '"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td width="54" valign="middle"><table role="presentation" width="42" height="42" cellpadding="0" cellspacing="0" style="background:' + COR.vinhoClaro + ';border-radius:12px"><tr><td align="center" valign="middle" style="height:42px">' + icone + '</td></tr></table></td>' +
    '<td valign="middle"><div style="font:600 15px/20px ' + FONTE + ';color:' + COR.tinta + ';overflow-wrap:anywhere">' + esc(titulo) + '</div>' +
      (sub ? '<div style="font:12px/17px ' + FONTE + ';color:' + COR.fraca + ';overflow-wrap:anywhere;margin-top:1px">' + esc(sub) + '</div>' : '') + '</td>' +
    (valor || venc ? '<td class="vl" align="right" valign="middle" style="white-space:nowrap;padding-left:12px">' +
      (valor ? '<div style="font:700 15px/20px ' + FONTE + ';color:' + COR.tinta + '">' + esc(valor) + '</div>' : '') +
      (venc ? '<div style="margin-top:4px"><span style="display:inline-block;padding:2px 8px;border-radius:99px;background:' + COR.faltaClaro + ';font:600 11px/16px ' + FONTE + ';color:' + COR.falta + '">vence ' + esc(venc.dm) + '</span></div>' : '') + '</td>' : '') +
    '</tr></table></td></tr>';
}
// um número do resumo no bloco vinho: o rótulo claro em cima e o valor grande embaixo
const numeroDoBloco = (rotulo, valor, primeiro) => '<td valign="top" style="' + (primeiro ? '' : 'padding-left:28px;') + '">' +
  '<div style="font:500 12px/16px ' + FONTE + ';color:#F6CFD1">' + esc(rotulo) + '</div>' +
  '<div style="font:700 22px/30px ' + FONTE + ';color:#FFFFFF;white-space:nowrap">' + esc(valor) + '</div></td>';

function htmlDoEnvioDp(o) {
  const imagens = [];
  const chip = o.chip || 'DP';
  const fiscal = chip === 'Fiscal';
  // o boleto dos honorários (Financeiro › Boletos, boletos-financeiro.js; 10/11/2026)
  const boleto = chip === 'Financeiro';
  const nome = o.assinatura || 'Nilma Contabilidade';
  const mesAno = mesPorExtenso(o.competencia);
  const mes = mesAno.replace(/ de \d{4}$/, '');
  const anexos = o.anexos || [];
  const um = anexos.length === 1;
  const logo = imagem(imagens, PASTA_ICONES, 'marca', [14, 22], 'display:block;margin:0 auto') || '';
  const icone = imagem(imagens, PASTA_ICONES, 'arquivo', [22, 26], 'display:block;margin:0 auto') || '';
  const clipe = imagem(imagens, PASTA_ICONES, 'anexo', 14, 'display:inline-block;vertical-align:middle;margin-right:6px;opacity:.7') || '';
  const cadeado = imagem(imagens, PASTA_ICONES, 'cadeado', 18, 'display:block') || '';
  const area = boleto ? 'Financeiro' : fiscal ? 'Fiscal' : 'Departamento Pessoal';
  const manchete = boleto ? 'Seu boleto de honorários de ' + mes + ' chegou' : (fiscal ? (um ? 'Sua guia de ' : 'Suas guias de ') : (um ? 'Seu documento de ' : 'Seus documentos de ')) + mes + (um ? ' chegou' : ' chegaram');
  // o resumo: o total e o vencimento mais perto (as guias com valor lido); senão, quantos e o mês
  const comValor = anexos.filter(a => typeof a.valor === 'number' && Number.isFinite(a.valor));
  const vencs = anexos.map(a => diaMes(a.vencimento)).filter(Boolean).sort((x, y) => x.chave.localeCompare(y.chave));
  const total = comValor.length ? reaisDe(Math.round(comValor.reduce((s, a) => s + a.valor, 0) * 100) / 100) : '';
  const resumo = total
    ? numeroDoBloco(comValor.length === 1 ? 'Valor a pagar' : 'Total a pagar', total, true) + (vencs.length ? numeroDoBloco(boleto ? 'Vencimento' : 'Vence primeiro', vencs[0].curto) : '')
    : numeroDoBloco(boleto ? 'Boleto' : fiscal ? 'Guias' : 'Documentos', String(anexos.length), true) + (mesAno ? numeroDoBloco('Competência', mesAno.replace(' de ', '/')) : '');
  const css = '@media only screen and (max-width:520px){.px{padding-left:16px!important;padding-right:16px!important}.hero{padding:26px 22px 60px!important}' +
    '.manchete{font-size:24px!important;line-height:31px!important}.cartao{padding:4px 18px!important}.texto{padding:20px 18px 6px!important}}';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>' + esc(o.assunto || nome) + '</title>' +
    '<style>' + css + '</style></head>' +
    '<body style="margin:0;padding:0;background:' + FUNDO_DP + ';-webkit-text-size-adjust:100%">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + esc(String(o.texto || '').replace(/\s+/g, ' ').trim().slice(0, 140)) + '&#8199;&#65279;&#847;'.repeat(20) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + FUNDO_DP + '"><tr><td align="center" style="padding:0 0 32px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">' +
      // o bloco vinho
      '<tr><td class="hero" bgcolor="' + VINHO_FUNDO + '" style="background:' + VINHO_FUNDO + ';padding:30px 40px 68px">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
            (logo ? '<td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;background:#FFFFFF;border-radius:10px">' + logo + '</td>' : '') +
            '<td style="padding-left:10px;font:700 15px/20px ' + FONTE + ';color:#FFFFFF">' + esc(nome) + '</td></tr></table></td>' +
          '<td align="right" valign="middle"><span style="display:inline-block;padding:4px 12px;border-radius:99px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);font:600 12px/16px ' + FONTE + ';color:#FFFFFF;white-space:nowrap">' + esc(area) + '</span></td>' +
        '</tr></table>' +
        (o.cliente ? '<div style="font:600 12px/16px ' + FONTE + ';color:#F6CFD1;margin-top:30px;text-transform:uppercase;letter-spacing:.07em">' + esc(o.cliente) + '</div>' : '<div style="height:30px;line-height:30px;font-size:0">&nbsp;</div>') +
        '<div class="manchete" style="font:700 28px/36px ' + FONTE + ';color:#FFFFFF;margin-top:6px">' + esc(manchete) + '</div>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>' + resumo + '</tr></table>' +
      '</td></tr>' +
      // o cartão dos arquivos, encostado no bloco
      '<tr><td class="px" bgcolor="' + FUNDO_DP + '" style="padding:0 24px;background-image:linear-gradient(180deg,' + VINHO_FUNDO + ' 0,' + VINHO_FUNDO + ' 44px,' + FUNDO_DP + ' 44px)">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;border-collapse:separate;box-shadow:0 10px 30px rgba(80,20,24,.12)"><tr><td class="cartao" style="padding:6px 24px">' +
          '<div style="padding:14px 0 2px;font:700 12px/16px ' + FONTE + ';color:' + COR.suave + ';text-transform:uppercase;letter-spacing:.06em">' + clipe +
            '<span style="vertical-align:middle">' + (um ? '1 arquivo anexado' : anexos.length + ' arquivos anexados') + '</span></div>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + anexos.map((a, k) => linhaDoArquivo(a, k, icone)).join('') + '</table>' +
          '<div style="padding:12px 0 16px;border-top:1px solid #F0EAEA;font:12px/17px ' + FONTE + ';color:' + COR.fraca + '">' + (um ? 'O arquivo está' : 'Os arquivos estão') + ' no fim deste e-mail: é só abrir ou baixar.</div>' +
        '</td></tr></table>' +
      '</td></tr>' +
      // o texto do modelo num segundo cartão
      '<tr><td class="px" style="padding:16px 24px 0">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;border-collapse:separate"><tr><td class="texto" style="padding:24px 28px 10px">' + textoRecibo(o.texto) + '</td></tr></table>' +
      '</td></tr>' +
      // o aviso de segurança (05/11/2026, como os bancos): a guia é dinheiro, e guia falsa por e-mail é golpe comum
      '<tr><td class="px" style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6DCDC;border-radius:14px;border-collapse:separate"><tr>' +
        '<td width="40" valign="top" style="padding:14px 0 14px 16px">' + (cadeado || '') + '</td>' +
        '<td style="padding:14px 16px 14px 8px;font:12px/18px ' + FONTE + ';color:' + COR.suave + '"><b style="color:' + COR.tinta + '">Para sua segurança:</b> a ' + esc(nome) + ' manda ' + (boleto ? 'o boleto' : fiscal ? 'as guias' : 'os documentos') + ' só por este e-mail (' + esc(o.caixa || 'o do escritório') + ') e nunca pede senha. ' +
          (boleto ? 'Antes de pagar, confira se o beneficiário é a ' + esc(nome) + ' e se o valor é o combinado. ' : fiscal ? 'Antes de pagar, confira se o CNPJ e o valor da guia são os da sua empresa. ' : '') + 'Na dúvida, fale com a gente antes.</td>' +
      '</tr></table></td></tr>' +
      // o rodapé
      '<tr><td align="center" class="px" style="padding:22px 28px 0;font:12px/18px ' + FONTE + ';color:#8C7A7B">' +
        '<b style="color:' + COR.suave + '">' + esc(nome) + '</b>' + (o.caixa ? ' · <a href="mailto:' + esc(o.caixa) + '" style="color:#8C7A7B">' + esc(o.caixa) + '</a>' : '') +
        '<br>Dúvidas? É só responder este e-mail.' + (o.rodape ? '<br><span style="color:#A89B9C">' + esc(o.rodape) + '</span>' : '') +
      '</td></tr>' +
    '</table></td></tr></table></body></html>';
  return { html, imagens };
}

module.exports = { htmlDaCobranca, htmlDoDisparo, htmlDoChecklist, htmlDaNfse, htmlDoEnvioDp, textoDoPrazo, progresso, PASTA_LOGOS, PASTA_ICONES };
