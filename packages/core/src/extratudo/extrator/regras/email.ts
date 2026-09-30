// O HTML do e-mail "Pedir documentos" (a arte aprovada pelo Vitor em 30/09/2026, no estilo do e-mail da
// Reforma): a data do envio no topo, o logo, o nome da empresa, "Hora de fechar agosto.", o texto, os
// documentos em cartões, o prazo em destaque, "Como enviar" e o WhatsApp do escritório. Seguro para e-mail:
// tabelas, estilo inline, 600px. As imagens vão por endereço (o logo e os logos dos bancos, publicados no site).
import { competenciasPorExtenso, dataPorExtenso, type PedidoDeExtratos } from './pedido';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const C = { tinta: '#0B0B0C', texto: '#55555C', fraco: '#8C8C92', mais: '#A0A0A8', borda: '#E6E6E9', cinza: '#F7F7F8', fundo: '#F2F2F3', vinho: '#93282F' };
const F = "Montserrat,'Segoe UI',Helvetica,Arial,sans-serif";
const esc = (t: string) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export interface OpcoesDoEmail {
  pedido: PedidoDeExtratos;
  /** 'dd/mm/aaaa' (vazio = sem prazo) */
  prazo: string;
  enviadoEm: Date;
  /** o endereço do logo da Nilma */
  logo: string;
  /** o endereço do logo do banco (null = sem logo) */
  logoDoBanco: (marca: string) => string | null;
  /** o WhatsApp do escritório, no botão do fim */
  whatsapp?: { numero: string; rotulo: string };
}

/** "agosto", "julho e agosto" (só os meses, para a manchete). */
function mesesDaManchete(competencias: string[]): string {
  const cs = [...new Set(competencias)].sort();
  const nomes = cs.map(c => MESES[Number(c.slice(5, 7)) - 1]);
  return nomes.length <= 1 ? nomes[0] || '' : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

export function htmlDoPedido(o: OpcoesDoEmail): string {
  const { pedido: p } = o;
  const periodo = competenciasPorExtenso(p.competencias);
  const Periodo = periodo.charAt(0).toUpperCase() + periodo.slice(1);
  const manchete = 'Hora de fechar ' + mesesDaManchete(p.competencias) + '.';
  const prazoCurto = o.prazo ? o.prazo.slice(0, 5) : '';
  const pilula = '<span style="display:inline-block;font-size:9px;line-height:14px;letter-spacing:1.5px;font-weight:700;color:' + C.vinho + ';border:1px solid ' + C.vinho + ';border-radius:20px;padding:1px 8px;white-space:nowrap">PENDENTE</span>';
  const cartoes = p.documentos.map((d, i) => {
    const logo = d.banco ? o.logoDoBanco(d.banco) : null;
    return '<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>' +
      '<td bgcolor="' + C.cinza + '" style="background:' + C.cinza + ';border:1px solid ' + C.borda + ';border-radius:12px;padding:16px 18px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td width="40" valign="top" style="font-size:13px;line-height:22px;font-weight:800;letter-spacing:1px;color:' + C.vinho + '">' + String(i + 1).padStart(2, '0') + '</td>' +
      (logo ? '<td width="32" valign="top" style="padding-top:1px"><img src="' + esc(logo) + '" width="22" height="22" alt="" style="display:block;width:22px;height:22px;border:0;border-radius:5px"></td>' : '') +
      '<td valign="top"><p style="margin:0;font-size:15px;line-height:22px;font-weight:700;color:' + C.tinta + '">' + esc(d.nome) + '</p>' +
      (d.detalhe ? '<p style="margin:2px 0 0;font-size:13px;line-height:19px;color:' + C.texto + '">' + esc(d.detalhe) + '</p>' : '') + '</td>' +
      '<td class="hide-m" width="90" align="right" valign="top" style="padding-top:3px">' + pilula + '</td>' +
      '</tr></table></td></tr></table></td></tr>';
  }).join('');
  const separador = '<tr><td style="padding:52px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td height="1" style="font-size:0;line-height:0;background:' + C.borda + ';background-image:linear-gradient(90deg, rgba(0,0,0,0) 0%, ' + C.vinho + ' 50%, rgba(0,0,0,0) 100%)">&nbsp;</td></tr></table></td></tr>';
  const whats = o.whatsapp
    ? '<tr><td class="px" align="center" style="padding:36px 44px 56px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>' +
      '<td align="center" style="border-radius:40px;border:1px solid ' + C.tinta + '"><a href="https://wa.me/' + esc(o.whatsapp.numero) + '" target="_blank" style="display:inline-block;padding:13px 30px;font-family:' + F + ';font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + C.tinta + ';text-decoration:none;border-radius:40px">WhatsApp · ' + esc(o.whatsapp.rotulo) + '</a></td>' +
      '</tr></table></td></tr>'
    : '<tr><td style="padding:0 0 48px"></td></tr>';

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>' + esc('Documentos de ' + periodo + ' - ' + p.cliente) + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>body{margin:0;padding:0;background:' + C.fundo + ';-webkit-text-size-adjust:100%}table{border-collapse:collapse}img{border:0;display:block}a{text-decoration:none}' +
    '@media only screen and (max-width:620px){.container{width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}' +
    '.h1{font-size:30px!important;line-height:36px!important;white-space:normal!important}.h2{font-size:23px!important;line-height:28px!important}' +
    '.big{font-size:42px!important;line-height:46px!important}.logo{width:180px!important;height:auto!important}.hide-m{display:none!important}}</style></head>' +
    '<body style="margin:0;padding:0;background:' + C.fundo + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Documentos para o fechamento contábil de ' + esc(Periodo) + '.' + (prazoCurto ? ' Prazo: até ' + prazoCurto + '.' : '') + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + C.fundo + '" style="background:' + C.fundo + '"><tr><td align="center" style="padding:28px 10px">' +
    '<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ' + C.borda + ';border-radius:16px;overflow:hidden;font-family:' + F + ';color:' + C.tinta + '">' +
    // topo: a data do envio, no centro
    '<tr><td class="px" align="center" style="padding:16px 40px;border-bottom:1px solid ' + C.borda + ';font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:' + C.fraco + ';font-weight:600">' + esc(dataPorExtenso(o.enviadoEm)) + '</td></tr>' +
    // logo
    '<tr><td align="center" style="padding:44px 24px 4px;background:#FFFFFF"><img class="logo" src="' + esc(o.logo) + '" width="210" height="77" alt="Nilma Contabilidade" style="width:210px;height:77px;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:' + C.tinta + '"></td></tr>' +
    // manchete e texto
    '<tr><td class="px" align="center" style="padding:40px 44px 0">' +
      '<p style="margin:0 0 18px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;color:' + C.vinho + '">' + esc(p.cliente) + '</p>' +
      '<h1 class="h1" style="margin:0 0 22px;font-size:38px;line-height:44px;font-weight:800;letter-spacing:-0.8px;color:' + C.tinta + ';' + (manchete.length <= 24 ? 'white-space:nowrap;' : '') + '">' + esc(manchete) + '</h1>' +
      '<p style="margin:0 0 14px;font-size:15px;line-height:25px;color:' + C.texto + '">Olá, tudo bem?</p>' +
      '<p style="margin:0;font-size:15px;line-height:25px;color:' + C.texto + '">Viemos através deste e-mail pedir a relação de documentos para o fechamento contábil do período de <span style="color:' + C.tinta + ';font-weight:600">' + esc(Periodo) + '</span>.</p>' +
    '</td></tr>' +
    // o que precisamos
    '<tr><td class="px" align="center" style="padding:40px 44px 0"><h2 class="h2" style="margin:0 0 24px;font-size:28px;line-height:33px;font-weight:800;letter-spacing:-0.4px;color:' + C.tinta + '">O que precisamos:</h2></td></tr>' +
    '<tr><td class="px" style="padding:0 44px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + cartoes + '</table></td></tr>' +
    // prazo
    (prazoCurto
      ? '<tr><td class="px" align="center" style="padding:30px 44px 0"><p class="big" style="margin:0;font-size:52px;line-height:56px;font-weight:800;letter-spacing:-1px;color:' + C.vinho + '">até&nbsp;' + esc(prazoCurto) + '</p>' +
        '<p style="margin:8px 0 0;font-size:14px;line-height:21px;color:' + C.texto + '">para mantermos o fechamento de <span style="color:' + C.tinta + ';font-weight:600">' + esc(mesesDaManchete(p.competencias)) + '</span> em dia</p></td></tr>'
      : '') +
    separador +
    // como enviar
    '<tr><td class="px" align="center" style="padding:46px 44px 0"><h2 class="h2" style="margin:0 0 14px;font-size:28px;line-height:33px;font-weight:800;letter-spacing:-0.4px;color:' + C.tinta + '">Como enviar</h2>' +
      '<p style="margin:0;font-size:15px;line-height:25px;color:' + C.texto + '">Responda este e-mail com os arquivos em anexo: <span style="color:' + C.tinta + ';font-weight:600">PDF, OFX, planilha</span>.</p></td></tr>' +
    whats +
    // rodapé
    '<tr><td class="px" align="center" bgcolor="' + C.cinza + '" style="background:' + C.cinza + ';border-top:1px solid ' + C.borda + ';padding:24px 44px 28px">' +
      '<p style="margin:0 0 6px;font-size:10px;line-height:15px;color:' + C.mais + '">Se algum documento não se aplica a este mês, é só responder avisando.</p>' +
      '<p style="margin:0;font-size:10px;line-height:15px;color:' + C.mais + '">Você recebeu este e-mail por ser cliente da Nilma Contabilidade.</p></td></tr>' +
    '</table></td></tr></table></body></html>';
}
