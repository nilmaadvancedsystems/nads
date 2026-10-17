// Os papéis da entrega (16/10/2026, a cópia fiel do Entregas): o protocolo de um punhado de entregas (uma parada, a rota
// do dia, as escolhidas nos Protocolos), o protocolo do mês do cliente (com o código e o QR de conferência), o fechamento do
// dia e o extrato do mês. Cada um abre numa aba própria, pronto para imprimir ou salvar em PDF pela impressão do navegador
// — o mesmo documento que o entregas.html monta (é papel: as cores e as fontes são as de lá, não as da tela).
import { entregas } from '@nads/core';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;
type Cliente = ReturnType<typeof entregas.clienteDaRotaDoDocumento>;

const h = (t: unknown) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const dh = entregas.dataHoraDaEntrega;
const dinheiro = entregas.dinheiro;

/** A aba aberta já no clique (senão o navegador bloqueia), com "Preparando…" até o papel ficar pronto. */
export function abrirAbaDoPapel(aviso = 'Preparando o protocolo...'): Window | null {
  const aba = window.open('', '_blank');
  if (aba) aba.document.write('<!doctype html><meta charset="utf-8"><title>Protocolo</title><body style="font:14px system-ui;padding:24px">' + h(aviso) + '</body>');
  return aba;
}
export function escreverNaAba(aba: Window, html: string) {
  aba.document.open();
  aba.document.write(html);
  aba.document.close();
}

const ESTILO_PROTOCOLO = '@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px/1.45 -apple-system,"Segoe UI",Inter,Arial,sans-serif;color:#111;margin:0 auto;padding:24px;max-width:900px}'
  + 'h1{font-size:18px;margin:0 0 2px}header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}'
  + '.m{color:#555;font-size:11px}.v{color:#555}table{width:100%;border-collapse:collapse}'
  + 'th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#555;border-bottom:1px solid #999;padding:6px 8px}'
  + 'td{vertical-align:top;padding:8px;border-bottom:1px solid #ddd}tr{break-inside:avoid}'
  + 'td.n{color:#777;width:24px}td.a{width:160px}td.a img{width:150px;border:1px solid #ccc;display:block}'
  + '.linha{display:block;border-bottom:1px solid #111;height:24px}'
  + '.assina{margin-top:20px;border:1px solid #bbb;padding:14px;display:flex;gap:20px;align-items:flex-start;break-inside:avoid}'
  + '.assina img{width:260px;border:1px solid #ccc;display:block}.assina .quem{flex:1}'
  + 'footer{margin-top:16px;display:flex;justify-content:space-between;gap:24px;font-size:11px;color:#555;border-top:1px solid #ddd;padding-top:10px}'
  + '.barra{margin:0 0 14px}.barra button{font:inherit;padding:8px 14px;cursor:pointer}'
  + '.conf{margin-top:20px;display:flex;gap:16px;align-items:center;border:1px solid #bbb;padding:12px;break-inside:avoid}.conf img{width:96px;height:96px;flex:none}'
  + '.cod{font:600 16px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.08em;margin:6px 0 2px}'
  + '@media print{.barra{display:none}body{padding:0}}';

const itensComValor = (e: Entrega, soma: { total: number }) => e.itens.map(it => {
  if (it.valor) soma.total += it.valor;
  return h(it.tipo) + (it.valor != null ? ' <span class="v">' + h(dinheiro(it.valor)) + '</span>' : '');
}).join('<br>');

/**
 * O papel de QUALQUER conjunto de entregas (abrirProtocoloDeEntregas_): sem QR nem código, para o arquivo físico. A mesma
 * assinatura em várias linhas (a parada assinada de uma vez) sai uma vez só, no pé, dizendo por quantas responde.
 */
export function protocoloDeEntregas(titulo: string, ordenadas: readonly Entrega[], assinaturas: readonly (string | null)[], emitidoPor: string): string {
  const colhidas = assinaturas.filter(Boolean) as string[];
  const unica = colhidas.length > 1 && colhidas.every(a => a === colhidas[0]) ? colhidas[0] : null;
  const soma = { total: 0 };
  const linhas = ordenadas.map((e, i) => {
    const entregue = e.status === 'confirmada';
    const ass = unica ? '' : assinaturas[i] ? '<img src="' + h(assinaturas[i]) + '" alt="assinatura">'
      : e.recebidoPeloLink ? '<span class="m">confirmado pelo link</span>' : e.temFoto ? '<span class="m">comprovado por foto</span>' : entregue ? '' : '<span class="linha"></span>';
    return '<tr><td class="n">' + (i + 1) + '</td><td><b>' + h(e.clienteNome || 'sem nome') + '</b>' + (e.competencia ? '<div class="m">competência ' + h(entregas.rotuloDaCompetencia(e.competencia)) + '</div>' : '') + '</td>'
      + '<td>' + (itensComValor(e, soma) || 'documentos') + (e.vencimento ? '<div class="m">vence ' + h(entregas.dataBr(e.vencimento)) + '</div>' : '') + '</td>'
      + '<td><b>' + h(entregas.situacaoPorExtenso(e)) + '</b><div class="m">' + h(dh(entregas.quandoFoi(e))) + '</div>' + (entregue && e.recebedor ? '<div class="m">recebido por ' + h(e.recebedor) + '</div>' : '') + '</td>'
      + '<td class="a">' + ass + '</td></tr>';
  }).join('');
  const entregues = ordenadas.filter(e => e.status === 'confirmada').length;
  const quemRecebeu = ordenadas.map(e => e.recebedor).find(Boolean) || '';
  const quemEntregou = ordenadas.map(e => e.entregadoPorNome).find(Boolean) || emitidoPor;
  const quando = ordenadas.map(e => e.confirmadoEm).find(Boolean) || '';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Protocolo - ' + h(titulo) + '</title><style>' + ESTILO_PROTOCOLO + '</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">Imprimir ou salvar em PDF</button></div>'
    + '<header><div><h1>Protocolo de entrega de documentos</h1><div class="m">Nilma Contabilidade</div></div>'
    + '<div style="text-align:right"><b>' + h(titulo) + '</b>' + (quemEntregou ? '<div class="m">Entregue por: ' + h(quemEntregou) + '</div>' : '')
    + '<div class="m">' + h(dh(quando || new Date().toISOString())) + '</div></div></header>'
    + '<table><thead><tr><th></th><th>Empresa</th><th>Documentos</th><th>Situação</th><th>' + (unica ? '' : 'Assinatura') + '</th></tr></thead><tbody>' + linhas + '</tbody></table>'
    + (unica ? '<div class="assina"><img src="' + h(unica) + '" alt="Assinatura de recebimento"><div class="quem"><b>Recebimento</b><div class="m">As ' + ordenadas.length
      + ' entregas acima foram entregues juntas e assinadas de uma vez' + (quando ? ', em ' + h(dh(quando)) : '') + '.</div>'
      + (quemRecebeu ? '<div style="margin-top:12px">Recebido por: <b>' + h(quemRecebeu) + '</b></div>' : '<div class="m" style="margin-top:10px">Nome de quem recebeu</div><span class="linha"></span>')
      + '</div></div>' : '')
    + '<footer><div>' + ordenadas.length + ' registro(s), ' + entregues + ' entregue(s)' + (soma.total ? ' · total das guias ' + h(dinheiro(soma.total)) : '') + '</div>'
    + '<div>Emitido em ' + h(dh(new Date().toISOString())) + ' por ' + h(emitidoPor) + '</div></footer></body></html>';
}

/** O protocolo do mês de um cliente (abrirProtocoloDoMes_): cada entrega com o recebimento, a assinatura e o código de conferência. */
export function protocoloDoMes(cliente: Pick<Cliente, 'nome' | 'documento' | 'codigoOrigem'>, comp: string, ordenadas: readonly Entrega[], assinaturas: readonly (string | null)[],
  conferir: { legivel: string; endereco: string; qr: string } | null, emitidoPor: string): string {
  const soma = { total: 0 };
  const linhas = ordenadas.map((e, i) => {
    const detalhe = e.status === 'confirmada'
      ? [e.recebedor ? 'Recebido por <b>' + h(e.recebedor) + '</b>' : 'Recebedor não informado', e.recebidoPeloLink ? 'Confirmado pelo próprio cliente na página dele, sem assinatura' : '',
        e.entregadoPorNome ? 'Entregue por ' + h(e.entregadoPorNome) : '', e.semComprovante ? 'Sem comprovante: ' + h(e.motivoSemComprovante) : '',
        e.geo ? 'Local: ' + e.geo.lat.toFixed(5) + ', ' + e.geo.lng.toFixed(5) + (e.localDivergente ? ' (longe do endereço do cliente)' : '') : '']
      : e.status === 'falha' ? ['Motivo: ' + h(e.motivoFalha || 'não informado'), e.entregadoPorNome ? 'Registrado por ' + h(e.entregadoPorNome) : ''] : ['Ainda não entregue'];
    return '<tr><td class="n">' + (i + 1) + '</td><td>' + itensComValor(e, soma) + (e.vencimento ? '<div class="m">vence ' + h(entregas.dataBr(e.vencimento)) + '</div>' : '') + '</td>'
      + '<td><b>' + h(entregas.situacaoPorExtenso(e)) + '</b><div class="m">' + h(dh(entregas.quandoFoi(e))) + '</div></td>'
      + '<td>' + detalhe.filter(Boolean).join('<br>') + '</td>'
      + '<td class="a">' + (assinaturas[i] ? '<img src="' + h(assinaturas[i]) + '" alt="assinatura">' : e.recebidoPeloLink ? '<span class="m">confirmado pelo link</span>' : e.temFoto ? '<span class="m">comprovado por foto</span>' : '') + '</td></tr>';
  }).join('');
  const entregues = ordenadas.filter(e => e.status === 'confirmada').length;
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Protocolo ' + h(entregas.rotuloDaCompetencia(comp)) + ' - ' + h(cliente.nome) + '</title><style>' + ESTILO_PROTOCOLO
    + 'td.a{width:150px}td.a img{width:140px}footer{border-top:0}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">Imprimir ou salvar em PDF</button></div>'
    + '<header><div><h1>Protocolo de entrega de documentos</h1><div class="m">Nilma Contabilidade</div></div>'
    + '<div style="text-align:right"><b>' + h(cliente.nome) + '</b><div class="m">' + h([cliente.documento, cliente.codigoOrigem ? 'cód. ' + cliente.codigoOrigem : ''].filter(Boolean).join(' · ')) + '</div>'
    + '<div class="m">Competência ' + h(entregas.rotuloDaCompetencia(comp)) + '</div></div></header>'
    + '<table><thead><tr><th></th><th>Documentos</th><th>Situação</th><th>Recebimento</th><th>Assinatura</th></tr></thead><tbody>' + linhas + '</tbody></table>'
    + '<footer><div>' + ordenadas.length + ' registro(s), ' + entregues + ' entregue(s)' + (soma.total ? ' · total das guias ' + h(dinheiro(soma.total)) : '') + '</div>'
    + '<div>Emitido em ' + h(dh(new Date().toISOString())) + ' por ' + h(emitidoPor) + '</div></footer>'
    + (conferir ? '<section class="conf">' + (conferir.qr ? '<img src="' + h(conferir.qr) + '" alt="">' : '')
      + '<div><b>Confira este protocolo</b><div class="m">Aponte a câmera para o código ao lado ou abra o endereço abaixo e digite o código. '
      + 'A página mostra o que foi registrado no escritório; se algo aqui estiver diferente, este papel foi alterado.</div>'
      + '<div class="cod">' + h(conferir.legivel) + '</div><div class="m">' + h(conferir.endereco) + '</div></div></section>' : '')
    + '</body></html>';
}

/** O fechamento do dia (gerarFechamentoDoDia_): entregues, não entregues, por pessoa; e, se for hoje, quantas ainda na rota. */
export function fechamentoDoDia(dia: string, f: ReturnType<typeof entregas.fechamentoDoDia>, aindaNaRota: number | null, emitidoPor: string): string {
  const dataLonga = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const hora = (e: Entrega) => new Date(String(e.confirmadoEm)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const tabela = (l: readonly Entrega[], colunas: string[], linha: (e: Entrega) => string) => (!l.length ? '<p class="vazio">Nenhuma.</p>'
    : '<table><thead><tr>' + colunas.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + l.map(linha).join('') + '</tbody></table>');
  const pessoas = f.porPessoa.map(p => '<tr><td>' + h(p.nome) + '</td><td class="n">' + p.entregues + '</td><td class="n">' + p.falhas + '</td></tr>').join('');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento do dia ' + h(entregas.dataBr(dia)) + '</title>'
    + '<style>body{font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:28px}h1{font-size:19px;margin:0 0 2px}'
    + '.sub{color:#555;margin:0 0 18px}.resumo{display:flex;gap:28px;margin:0 0 18px}.resumo b{display:block;font-size:22px}'
    + 'h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}table{width:100%;border-collapse:collapse}'
    + 'th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #ddd;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#555}'
    + '.n{text-align:right;width:90px}.vazio{color:#777}.rodape{margin-top:28px;color:#777;font-size:11px}'
    + '@media print{body{margin:12mm}button{display:none}}</style></head><body>'
    + '<button onclick="print()" style="float:right;padding:6px 12px">Imprimir / salvar PDF</button>'
    + '<h1>Fechamento do dia</h1><p class="sub">' + h(dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)) + '</p>'
    + '<div class="resumo"><div><b>' + f.entregues.length + '</b>entregues</div><div><b>' + f.falhas.length + '</b>não entregues</div>'
    + (aindaNaRota !== null ? '<div><b>' + aindaNaRota + '</b>ainda na rota</div>' : '') + '</div>'
    + '<h2>Por pessoa</h2>' + (pessoas ? '<table><thead><tr><th>Quem entregou</th><th class="n">Entregues</th><th class="n">Não entregues</th></tr></thead><tbody>' + pessoas + '</tbody></table>' : '<p class="vazio">Nenhuma entrega.</p>')
    + '<h2>Entregues (' + f.entregues.length + ')</h2>' + tabela(f.entregues, ['Hora', 'Cliente', 'Documentos', 'Quem entregou', 'Comprovante'], e =>
      '<tr><td>' + hora(e) + '</td><td>' + h(e.clienteNome) + '</td><td>' + h(entregas.textoDosItens(e.itens)) + '</td><td>' + h(entregas.quemEntregou(e)) + '</td><td>' + h(entregas.comprovanteEmPalavras(e)) + '</td></tr>')
    + '<h2>Não entregues (' + f.falhas.length + ')</h2>' + tabela(f.falhas, ['Hora', 'Cliente', 'Motivo', 'Quem foi'], e =>
      '<tr><td>' + hora(e) + '</td><td>' + h(e.clienteNome) + '</td><td>' + h(e.motivoFalha) + '</td><td>' + h(entregas.quemEntregou(e)) + '</td></tr>')
    + '<p class="rodape">Gerado em ' + h(new Date().toLocaleString('pt-BR')) + ' por ' + h(emitidoPor) + '.</p>'
    + '<script>setTimeout(function(){print()},400)</' + 'script></body></html>';
}

/** O extrato do mês do cliente (abrirExtratoDoMes_): o que entregamos, o que ele mandou e o que ainda falta. */
export function extratoDoMes(cliente: Pick<Cliente, 'nome' | 'documento' | 'codigoOrigem' | 'documentosNaoAplicaveis'>, comp: string, doMes: readonly Entrega[], docs: Record<string, unknown>, emitidoPor: string): string {
  const TIPOS: [string, string][] = [['extrato', 'Extrato bancário'], ['comprovante', 'Comprovantes de pagamento'], ['aplicacao', 'Extrato de aplicação']];
  const naoAplica = cliente.documentosNaoAplicaveis;
  // (no Entregas, "recebidos" testava !naoAplica.indexOf(t), que só é verdade para o 1º da lista dos que não se aplicam: a
  // coluna "O que você nos mandou" saía sempre vazia. Aqui vale o que a conta queria dizer: o que se aplica e chegou.)
  const recebidos = TIPOS.filter(t => !naoAplica.includes(t[0]) && docs[t[0]]);
  const faltando = TIPOS.filter(t => !naoAplica.includes(t[0]) && !docs[t[0]]);
  const entregues = doMes.filter(e => e.status === 'confirmada');
  const total = doMes.reduce((s, e) => s + entregas.totalDosItens(e.itens), 0);
  const linhas = doMes.map(e => '<tr><td>' + e.itens.map(i => h(i.tipo) + (i.valor != null ? ' <span class="m">' + h(dinheiro(i.valor)) + '</span>' : '')).join('<br>') + '</td><td>'
    + h(entregas.situacaoPorExtenso(e)) + '<div class="m">' + h(dh(entregas.quandoFoi(e))) + '</div></td><td>' + h(e.recebedor || (e.status === 'confirmada' ? 'não informado' : '')) + '</td></tr>').join('');
  const cobrancas = Array.isArray(docs.cobrancas) ? docs.cobrancas.length : 0;
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Extrato ' + h(entregas.rotuloDaCompetencia(comp)) + ' - ' + h(cliente.nome) + '</title><style>'
    + '@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans",Helvetica,Arial,sans-serif;color:#111;margin:0 auto;padding:24px;max-width:900px}'
    + 'h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;margin:18px 0 6px}header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}'
    + '.m{color:#555;font-size:11px}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#555;border-bottom:1px solid #999;padding:6px 8px}'
    + 'td{vertical-align:top;padding:8px;border-bottom:1px solid #ddd}ul{margin:4px 0 0;padding-left:18px}li{margin-bottom:2px}'
    + '.linha{display:flex;gap:24px;flex-wrap:wrap}.bloco{flex:1;min-width:220px}.falta{color:#8A2018;font-weight:600}'
    + 'footer{margin-top:16px;font-size:11px;color:#555}.barra{margin:0 0 14px}.barra button{font:inherit;padding:8px 14px;cursor:pointer}'
    + '@media print{.barra{display:none}body{padding:0}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">Imprimir ou salvar em PDF</button></div>'
    + '<header><div><h1>Extrato do mês</h1><div class="m">Nilma Contabilidade</div></div>'
    + '<div style="text-align:right"><b>' + h(cliente.nome) + '</b><div class="m">' + h([cliente.documento, cliente.codigoOrigem ? 'cód. ' + cliente.codigoOrigem : ''].filter(Boolean).join(' · ')) + '</div>'
    + '<div class="m">Competência ' + h(entregas.rotuloDaCompetencia(comp)) + '</div></div></header>'
    + '<h2>O que entregamos a você</h2>' + (linhas ? '<table><thead><tr><th>Documentos</th><th>Situação</th><th>Quem recebeu</th></tr></thead><tbody>' + linhas + '</tbody></table>' : '<p class="m">Nenhuma entrega registrada neste mês.</p>')
    + '<div class="linha" style="margin-top:18px"><div class="bloco"><h2>O que você nos mandou</h2>'
    + (recebidos.length ? '<ul>' + recebidos.map(t => '<li>' + h(t[1]) + '</li>').join('') + '</ul>' : '<p class="m">Nada registrado neste mês.</p>') + '</div>'
    + '<div class="bloco"><h2>O que ainda falta</h2>' + (faltando.length ? '<ul>' + faltando.map(t => '<li class="falta">' + h(t[1]) + '</li>').join('') + '</ul>' : '<p class="m">Nada — está tudo em dia.</p>') + '</div></div>'
    + '<footer>' + doMes.length + ' entrega(s), ' + entregues.length + ' confirmada(s)' + (total ? ' · total das guias ' + h(dinheiro(total)) : '') + (cobrancas ? ' · ' + cobrancas + ' cobrança(s) de documento neste mês' : '')
    + '<br>Emitido em ' + h(dh(new Date().toISOString())) + ' por ' + h(emitidoPor) + '</footer></body></html>';
}
