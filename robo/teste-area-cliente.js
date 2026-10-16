// Testes do robô da Área do Cliente (area-cliente-regras.js). Rode antes de publicar:  node teste-area-cliente.js
// Não acessa o banco nem o Drive. Além das regras do robô, confere que o PORTE não se afastou do core: carrega os .ts do
// core que o Node consegue carregar sozinho (guias, chamados, envios, vencimentos) e compara; das rotinas e das listas,
// que o Node não carrega, lê o texto dos arquivos.
const fs = require('fs');
const path = require('path');
const R = require('./area-cliente-regras');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const joga = f => { try { f(); return ''; } catch (e) { return e.message; } };

const TOKEN = 'a'.repeat(40);
const OUTRO = 'b'.repeat(40);
const HOJE = new Date(2026, 9, 16, 10, 0, 0); // sexta, 16/10/2026

// ---------- 1. a validação do pedido de chamado ----------
const chamadoOk = { token: TOKEN, tipo: 'duvida', texto: '  Como faço a admissão?  ', criadoEm: '2026-10-16T10:00:00Z' };
igual('chamado bom: passa (texto sem os espaços)', R.validarPedidoDeChamado(chamadoOk).pedido, { token: TOKEN, tipo: 'duvida', texto: 'Como faço a admissão?', titulo: '', chamadoId: '' });
igual('chamado: token que não é 40 hex', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { token: 'abc' })).erro, 'token inválido');
igual('chamado: token em maiúsculas não vale', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { token: 'A'.repeat(40) })).erro, 'token inválido');
igual('chamado: assunto fora da lista', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { tipo: 'hack' })).erro, 'Escolha o assunto.');
igual('chamado: texto vazio', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { texto: '   ' })).erro, 'Conte o que você precisa.');
igual('chamado: texto que não é texto', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { texto: 42 })).erro, 'sem texto');
igual('chamado: texto com mais de 4000', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { texto: 'x'.repeat(4001) })).erro, 'O texto está muito grande. Resuma um pouco.');
igual('chamado: título com mais de 120', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { titulo: 't'.repeat(121) })).erro, 'título inválido');
igual('chamado: chamadoId com barra (caminho) não passa', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { chamadoId: '../x' })).erro, 'chamado inválido');
igual('chamado: resposta com chamadoId bom', R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { chamadoId: 'Abc_12-3' })).pedido.chamadoId, 'Abc_12-3');
igual('chamado: pedido vazio', R.validarPedidoDeChamado(null).erro, 'pedido vazio');

// ---------- 2. token inexistente: descartado ----------
const vCh = R.validarPedidoDeChamado(chamadoOk);
const ctxCh = { linkExiste: true, contagem: null, dia: '2026-10-16', espelhoExiste: false, chamado: null };
igual('chamado de link que existe: cria', R.decidirChamado(vCh, ctxCh), { acao: 'criar' });
igual('chamado de token inexistente (revogado): descartado', R.decidirChamado(vCh, Object.assign({}, ctxCh, { linkExiste: false })), { acao: 'descartar', motivo: 'o link não existe mais' });
igual('chamado inválido: descartado com o motivo', R.decidirChamado(R.validarPedidoDeChamado({ token: 'x' }), ctxCh).acao, 'descartar');
const vResp = R.validarPedidoDeChamado(Object.assign({}, chamadoOk, { chamadoId: 'c1' }));
igual('resposta num chamado de outro link (não está no espelho deste): descartada', R.decidirChamado(vResp, Object.assign({}, ctxCh, { espelhoExiste: false, chamado: { situacao: 'aberto' } })).acao, 'descartar');
igual('resposta num chamado que sumiu do interno: descartada', R.decidirChamado(vResp, Object.assign({}, ctxCh, { espelhoExiste: true, chamado: null })).acao, 'descartar');
igual('resposta num chamado concluído: descartada', R.decidirChamado(vResp, Object.assign({}, ctxCh, { espelhoExiste: true, chamado: { situacao: 'concluido' } })).motivo, 'o chamado já foi concluído');
igual('resposta num chamado deste link: responde', R.decidirChamado(vResp, Object.assign({}, ctxCh, { espelhoExiste: true, chamado: { situacao: 'respondido' } })), { acao: 'responder' });
igual('o cliente escreveu depois da resposta: volta para aberto', R.situacaoDepoisDoCliente('respondido'), 'aberto');
igual('em andamento continua em andamento', R.situacaoDepoisDoCliente('em andamento'), 'em andamento');

// ---------- 3. o limite por link por dia ----------
let cont = null;
for (let i = 0; i < 20; i++) cont = R.contarNoLimite(cont, '2026-10-16', TOKEN);
igual('20 pedidos no dia: contou 20', cont.porToken[TOKEN], 20);
igual('o 21º pedido do mesmo link no dia: descartado', R.decidirChamado(vCh, Object.assign({}, ctxCh, { contagem: cont })).motivo, 'passou de 20 pedidos hoje');
igual('19 pedidos: o 20º ainda passa', R.cabeNoLimite(R.contarNoLimite(null, '2026-10-16', TOKEN), '2026-10-16', TOKEN, 2), true);
igual('outro link no mesmo dia não é afetado', R.cabeNoLimite(cont, '2026-10-16', OUTRO, 20), true);
igual('no dia seguinte zera', R.cabeNoLimite(cont, '2026-10-17', TOKEN, 20), true);
igual('contar no dia seguinte recomeça do 1', R.contarNoLimite(cont, '2026-10-17', TOKEN), { dia: '2026-10-17', porToken: { [TOKEN]: 1 } });
let contEnv = null;
for (let i = 0; i < 50; i++) contEnv = R.contarNoLimite(contEnv, '2026-10-16', TOKEN);
const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 0x20)]);
const envioDe = (buf, extra) => Object.assign({ token: TOKEN, nome: 'extrato.pdf', tipo: 'extrato', mime: 'application/pdf', tamanho: buf.length, base64: buf.toString('base64'), criadoEm: 'x' }, extra);
igual('envio: o 51º arquivo do dia é descartado', R.decidirEnvio(R.validarPedidoDeEnvio(envioDe(pdf)), { linkExiste: true, contagem: contEnv, dia: '2026-10-16' }).acao, 'descartar');
igual('envio de token inexistente: descartado', R.decidirEnvio(R.validarPedidoDeEnvio(envioDe(pdf)), { linkExiste: false, contagem: null, dia: '2026-10-16' }), { acao: 'descartar', motivo: 'o link não existe mais' });
igual('envio bom de link que existe: guarda', R.decidirEnvio(R.validarPedidoDeEnvio(envioDe(pdf)), { linkExiste: true, contagem: null, dia: '2026-10-16' }), { acao: 'guardar' });

// ---------- 4. o tipo pelos primeiros bytes ----------
const jpg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(100, 1)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(100, 1)]);
const zip = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.alloc(100, 1)]);
const zipVazio = Buffer.concat([Buffer.from([0x50, 0x4B, 0x05, 0x06]), Buffer.alloc(18, 0)]);
const xml = Buffer.from('﻿  <?xml version="1.0"?><nfeProc></nfeProc>');
const xmlSemDeclaracao = Buffer.from('<nfeProc versao="4.00"><NFe/></nfeProc>');
const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100, 0)]);
igual('PDF pelos bytes', R.tipoPelosBytes(pdf), 'pdf');
igual('JPG pelos bytes', R.tipoPelosBytes(jpg), 'jpg');
igual('PNG pelos bytes', R.tipoPelosBytes(png), 'png');
igual('ZIP pelos bytes', R.tipoPelosBytes(zip), 'zip');
igual('ZIP vazio não serve', R.tipoPelosBytes(zipVazio), '');
igual('XML com BOM e espaços', R.tipoPelosBytes(xml), 'xml');
igual('XML da NF-e sem a declaração', R.tipoPelosBytes(xmlSemDeclaracao), 'xml');
igual('executável (MZ) não é nada', R.tipoPelosBytes(exe), '');
igual('texto solto não é XML', R.tipoPelosBytes(Buffer.from('ola, segue o extrato')), '');
igual('binário com byte zero não vira XML', R.tipoPelosBytes(Buffer.from([0x3C, 0x61, 0x00, 0x62])), '');
igual('envio de PDF bom passa', R.validarPedidoDeEnvio(envioDe(pdf)).envio.ext, 'pdf');
igual('executável com nome .pdf: recusado', R.validarPedidoDeEnvio(envioDe(exe, { nome: 'extrato.pdf' })).erro, 'o arquivo não é PDF, JPG, PNG, XML nem ZIP');
igual('PDF com nome .jpg: recusado', R.validarPedidoDeEnvio(envioDe(pdf, { nome: 'foto.jpg', mime: 'image/jpeg' })).erro, 'o arquivo é PDF, mas o nome diz JPG');
igual('.jpeg é JPG', R.validarPedidoDeEnvio(envioDe(jpg, { nome: 'Foto.JPEG', mime: 'image/jpeg' })).envio.ext, 'jpg');
igual('XML com text/xml (o que o navegador manda) passa', R.validarPedidoDeEnvio(envioDe(xml, { nome: 'nota.xml', mime: 'text/xml', tipo: 'nota' })).envio.mime, 'application/xml');
igual('ZIP do Windows (x-zip-compressed) passa', R.validarPedidoDeEnvio(envioDe(zip, { nome: 'notas.zip', mime: 'application/x-zip-compressed', tipo: 'nota' })).envio.ext, 'zip');
igual('mime que não bate com a extensão: recusado', R.validarPedidoDeEnvio(envioDe(pdf, { mime: 'image/png' })).erro, 'mime não aceito: image/png');
igual('extensão .exe: recusada', R.validarPedidoDeEnvio(envioDe(pdf, { nome: 'virus.exe' })).erro, 'virus.exe: só aceitamos PDF, JPG, PNG, XML e ZIP.');
igual('tamanho declarado diferente do arquivo: recusado', R.validarPedidoDeEnvio(envioDe(pdf, { tamanho: pdf.length + 1 })).erro, 'o tamanho não bate com o arquivo');
igual('acima de 700 KB: recusado', R.validarPedidoDeEnvio(envioDe(pdf, { tamanho: 716801 })).erro, 'extrato.pdf: passa de 700 KB. Mande um arquivo menor.');
igual('base64 com lixo: recusado', R.validarPedidoDeEnvio(envioDe(pdf, { base64: 'JVBER!!' })).erro, 'arquivo ilegível');
igual('tipo de documento fora da lista: recusado', R.validarPedidoDeEnvio(envioDe(pdf, { tipo: 'senha' })).erro, 'tipo de documento inválido');
igual('o nome no Drive: data, o que é e o nome do cliente sem caminho', R.nomeNoDrive({ nome: '..\\..\\Extrato: set?.pdf', tipo: 'extrato', ext: 'pdf' }, HOJE), '2026-10-16 - Extrato - Extrato set.pdf');

// ---------- 5. nenhum campo interno no espelho ----------
const INTERNOS = ['por', 'observacao', 'objecao', 'criadoPor', 'criadoPorUid', 'aviso', 'passos', 'erro', 'tentativas', 'token', 'codigos', 'pastaDrive', 'interna', 'cnpjPortal', 'resultado', 'arquivadaEm', 'liberadoCliente'];
function chaves(v, achadas = new Set()) {
  if (Array.isArray(v)) v.forEach(x => chaves(x, achadas));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { achadas.add(k); chaves(x, achadas); }
  return achadas;
}
const semInternos = (nome, v) => igual(nome, INTERNOS.filter(k => chaves(v).has(k)), []);
const pedidoCompleto = {
  id: 'p1', codigo: '58', empresa: 'TORNEARIA', cnpj: '11222333000181', competencia: '2026-09', status: 'pronto', modo: 'emitir',
  vencimento: '20/10/2026', valor: '1.917,42', numeroGuia: '123', aviso: 'débito antigo', liberadoCliente: true, pdfNome: 'fgts.pdf',
  criadoPor: 'Clara', criadoPorUid: 'u1', passos: [{ n: 1 }], erro: '', tentativas: 1, resultado: 'guia …', arquivadaEm: 'x', fimEm: '2026-10-10T10:00:00Z',
};
const guias = R.guiasDoFgtsDoLink([pedidoCompleto], [58], HOJE);
igual('a guia liberada sai', guias.length, 1);
semInternos('a guia do FGTS não leva campo interno', guias);
igual('a guia passa na lista branca', joga(() => guias.forEach(g => R.conferirListaBranca('guia', g))), '');
igual('com aviso e sem liberar: não sai', R.guiasDoFgtsDoLink([Object.assign({}, pedidoCompleto, { liberadoCliente: false })], [58], HOJE), []);
igual('sem aviso: sai sozinha', R.guiasDoFgtsDoLink([Object.assign({}, pedidoCompleto, { aviso: '', liberadoCliente: undefined })], [58], HOJE).length, 1);
igual('ensaio nunca sai', R.guiasDoFgtsDoLink([Object.assign({}, pedidoCompleto, { modo: 'ensaio' })], [58], HOJE), []);
igual('de outra empresa: não sai neste link', R.guiasDoFgtsDoLink([pedidoCompleto], [59], HOJE), []);
igual('com mais de 12 meses: não sai', R.guiasDoFgtsDoLink([Object.assign({}, pedidoCompleto, { competencia: '2025-09' })], [58], HOJE), []);
igual('reemissão: vale o pedido mais recente', R.guiasDoFgtsDoLink([pedidoCompleto, Object.assign({}, pedidoCompleto, { id: 'p2', numeroGuia: '999', fimEm: '2026-10-12T10:00:00Z' })], [58], HOJE).map(g => g.numero), ['999']);

const resumo = R.resumoDoCliente([{ codigo: 58, nome: 'TORNEARIA', cnpj: '11.222.333/0001-81', regime: 'Simples', dp: { obrigacoes: [] }, execucoes: {} }], { whatsapp: '(38) 9138-3638', email: 'x@y.com', senha: 'nunca' }, '2026-10-16T10:00:00Z');
igual('o resumo: só código, nome e CNPJ (só números); o contato só com os campos dele', resumo, { empresas: [{ codigo: 58, nome: 'TORNEARIA', cnpj: '11222333000181' }], escritorio: { email: 'x@y.com', whatsapp: '(38) 9138-3638' }, atualizadoEm: '2026-10-16T10:00:00Z' });
igual('o resumo passa na lista branca', joga(() => R.conferirListaBranca('resumo', resumo)), '');

const interno = {
  token: TOKEN, codigos: [58], empresa: 'TORNEARIA', tipo: 'duvida', titulo: 'Dúvida', situacao: 'respondido', criadoEm: 'x', atualizadoEm: 'y',
  mensagens: [
    { de: 'cliente', autor: 'Cliente', texto: 'oi', em: '2026-10-16T10:00:00Z' },
    { de: 'escritorio', autor: 'Clara Souza', texto: 'olá', em: { toDate: () => new Date('2026-10-16T11:00:00Z') } },
    { de: 'escritorio', autor: 'Clara', texto: 'cliente chato', em: '2026-10-16T11:01:00Z', interna: true },
  ],
};
const vistoPeloCliente = R.chamadoDoCliente(R.chamadoInterno('c1', interno));
igual('o chamado: a nota interna não sai, o nome de quem respondeu vira "Escritório", a hora vira ISO', vistoPeloCliente, {
  id: 'c1', tipo: 'duvida', titulo: 'Dúvida', situacao: 'respondido',
  mensagens: [{ de: 'cliente', autor: 'Você', texto: 'oi', em: '2026-10-16T10:00:00Z' }, { de: 'escritorio', autor: 'Escritório', texto: 'olá', em: '2026-10-16T11:00:00.000Z' }],
});
semInternos('o chamado não leva campo interno', vistoPeloCliente);
igual('o nome de quem respondeu não aparece em lugar nenhum', JSON.stringify(vistoPeloCliente).includes('Clara'), false);
igual('o chamado passa na lista branca', joga(() => R.conferirListaBranca('chamado', vistoPeloCliente)), '');

const recibo = R.reciboDoEnvio({ id: 'e1', nome: 'extrato.pdf', tipo: 'extrato', tamanho: 10, recebidoEm: 'z', pastaDrive: '2026\\58 - X', token: TOKEN, codigo: 58 });
igual('o recibo: só id, nome, tipo, tamanho e hora (a pasta do Drive não sai)', recibo, { id: 'e1', nome: 'extrato.pdf', tipo: 'extrato', tamanho: 10, recebidoEm: 'z' });
igual('a lista branca recusa campo a mais na guia', joga(() => R.conferirListaBranca('guia', Object.assign({}, guias[0], { aviso: 'x' }))), 'espelho: campo aviso não pode sair em guia');
igual('a lista branca recusa campo a mais dentro da mensagem', joga(() => R.conferirListaBranca('chamado', Object.assign({}, vistoPeloCliente, { mensagens: [{ de: 'cliente', autor: 'Você', texto: 'a', em: 'b', interna: false }] }))), 'espelho: campo interna não pode sair em mensagem');
igual('a lista branca recusa campo a mais no item da agenda', joga(() => R.conferirListaBranca('agenda', { mes: '2026-10', itens: [{ id: 'das', nome: 'DAS', vence: '2026-10-20', situacao: 'feito', por: 'Clara' }], atualizadoEm: 'x' })), 'espelho: campo por não pode sair em item');
igual('o hash ignora a hora (mudar só a hora não regrava)', R.hashDoEspelho(Object.assign({}, resumo, { atualizadoEm: 'outra' })), R.hashDoEspelho(resumo));
igual('o hash não depende da ordem das chaves', R.hashDoEspelho({ a: 1, b: { c: 2, d: 3 } }), R.hashDoEspelho({ b: { d: 3, c: 2 }, a: 1 }));
igual('a assinatura do PDF não muda com a situação do dia', R.assinaturaDoPdf(Object.assign({}, guias[0], { situacao: 'vencida' })), R.assinaturaDoPdf(guias[0]));

// ---------- 6. a agenda ----------
const comps = R.competenciasDaAgenda(HOJE);
igual('a agenda olha setembro e outubro em outubro', comps, ['2026-09', '2026-10']);
const exFiscal = { empresa: 'X', codigo: 58, competencia: '2026-09', departamento: 'fiscal', etapas: { 'fiscal-simples': { situacao: 'feita', por: 'Clara', em: '2026-10-05T10:00:00Z', observacao: 'ok' } } };
const simples = { codigo: 58, nome: 'TORNEARIA', regime: 'Simples', dp: { obrigacoes: ['s1299', 'dctfweb'], reinfAutorizada: false }, execucoes: { '2026-09': { fiscal: exFiscal, dp: null }, '2026-10': {} } };
const agenda = R.agendaDoLink([simples], comps);
igual('dois meses de vencimento: outubro e novembro', agenda.map(a => a.mes), ['2026-10', '2026-11']);
igual('outubro: DCTFWeb, eSocial e DAS feito (sem FGTS, que a empresa não tem; sem ICMS, que não é do Simples)', agenda[0].itens, [
  { id: 'dctfweb', nome: 'DCTFWeb (declaração da folha)', vence: '2026-10-15', situacao: 'a fazer' },
  { id: 'esocial', nome: 'Fechamento da folha no eSocial', vence: '2026-10-15', situacao: 'a fazer' },
  { id: 'das', nome: 'DAS do Simples Nacional', vence: '2026-10-20', situacao: 'feito', feitoEm: '2026-10-05T10:00:00Z' },
]);
semInternos('a agenda não leva quem fez nem a observação', agenda);
igual('a agenda passa na lista branca', joga(() => agenda.forEach(a => R.conferirListaBranca('agenda', Object.assign({}, a, { atualizadoEm: 'x' })))), '');
igual('sem regime e sem rotina: o fiscal não entra; sem planilha do DP e sem rotina: o DP não entra', R.agendaDoLink([{ codigo: 1, nome: 'X', regime: '', dp: null, execucoes: {} }], comps).map(a => a.itens.length), [0, 0]);
const presumido = { codigo: 49, nome: 'POSTO', regime: 'Presumido', dp: null, execucoes: {} };
igual('Presumido em setembro (fim do trimestre): IRPJ/CSLL do trimestre entra', R.agendaDoLink([presumido], ['2026-09'])[0].itens.map(i => i.id), ['icms', 'iss', 'pis-cofins', 'irpj-csll']);
igual('Presumido em outubro: sem IRPJ/CSLL do trimestre', R.agendaDoLink([presumido], ['2026-10'])[0].itens.map(i => i.id), ['icms', 'iss', 'pis-cofins']);
igual('a etapa retirada do mês não aparece', R.agendaDoLink([Object.assign({}, presumido, { execucoes: { '2026-10': { fiscal: { competencia: '2026-10', etapas: {}, retiradas: ['fiscal-iss'] } } } })], ['2026-10'])[0].itens.map(i => i.id), ['icms', 'pis-cofins']);
igual('dispensada: "não se aplica"', R.agendaDoLink([Object.assign({}, simples, { execucoes: { '2026-09': { fiscal: { competencia: '2026-09', etapas: { 'fiscal-simples': { situacao: 'dispensada', por: 'x', em: 'y' } } } } } })], ['2026-09'])[0].itens.find(i => i.id === 'das').situacao, 'nao se aplica');
const grupo = R.agendaDoLink([simples, Object.assign({}, simples, { codigo: 59, nome: 'OUTRA' })], ['2026-09']);
igual('link de grupo: o item diz de qual empresa (sem id repetido)', grupo[0].itens.filter(i => i.id.startsWith('das-')).map(i => [i.id, i.nome]), [['das-59', 'DAS do Simples Nacional · OUTRA'], ['das-58', 'DAS do Simples Nacional · TORNEARIA']]);
igual('o regime: o cadastro do nads vale primeiro', R.regimeQueVale({ cadastro: { regime: 'Real' }, entregas: { enquadramento: 'Simples' }, lista: { regime: 'Presumido' } }), 'Real');
igual('o regime: sem cadastro, o enquadramento do Entregas', R.regimeQueVale({ cadastro: {}, entregas: { enquadramento: 'Simples' }, lista: { regime: 'Presumido' } }), 'Simples');
igual('o regime: sem enquadramento, a Receita quando diz MEI', R.regimeQueVale({ entregas: { receita: { mei: true, simples: true } }, lista: { regime: 'Simples' } }), 'MEI');
igual('o regime: a Receita "fora do Simples" não decide; vale a lista', R.regimeQueVale({ entregas: { receita: { simples: false } }, lista: { regime: 'Presumido' } }), 'Presumido');

// ---------- 7. os chamados de um link trocado ----------
const links = new Map([[TOKEN, { codigos: [58, 59] }], [OUTRO, { codigos: [58] }]]);
igual('o chamado vai para o link dele', R.linksDoChamado({ token: OUTRO, codigos: [58] }, links), [OUTRO]);
igual('link trocado (o antigo apagado): vai para o link com as MESMAS empresas', R.linksDoChamado({ token: 'c'.repeat(40), codigos: [59, 58] }, links), [TOKEN]);
igual('link trocado: o de outra composição não recebe', R.linksDoChamado({ token: 'c'.repeat(40), codigos: [59] }, links), []);
const novo = R.chamadoNovo(vCh.pedido, { codigos: [58] }, 'TORNEARIA', '2026-10-16T10:00:00Z');
igual('o chamado interno novo: de quem é, aberto e a primeira mensagem', [novo.token, novo.codigos, novo.situacao, novo.titulo, novo.mensagens.length], [TOKEN, [58], 'aberto', 'Como faço a admissão?', 1]);

// ---------- 8. o PDF em pedaços ----------
const b64 = Buffer.alloc(1500 * 1024, 7).toString('base64');
const pedacos = R.pedacosDoPdf(b64);
igual('o PDF grande vira pedaços de até 700 KB, n de 0', pedacos.map(p => [p.n, p.total, p.base64.length <= 700 * 1024]), [[0, 3, true], [1, 3, true], [2, 3, true]]);
igual('os pedaços juntos são o PDF', pedacos.map(p => p.base64).join(''), b64);
igual('cada pedaço é base64 inteiro (múltiplo de 4)', pedacos.slice(0, -1).every(p => p.base64.length % 4 === 0), true);

// ---------- 9. os dados do core, lidos do arquivo ----------
const CORE = path.join(__dirname, '..', 'packages', 'core', 'src');
const lerCore = arq => fs.readFileSync(path.join(CORE, arq), 'utf8');
const lista = R.lerListaDoCore(lerCore('empresas/lista.ts'));
const dp = R.lerDpDoCore(lerCore('empresas/dp.ts'));
igual('a lista de empresas do core foi lida inteira', lista.size > 150, true);
igual('a lista: a 58 é do Simples', lista.get(58) && lista.get(58).regime, 'Simples');
igual('a lista: nome com apóstrofo', lista.get(493) && lista.get(493).nome, "ANTONIA'S LTDA");
igual('a planilha do DP foi lida inteira', dp.size > 100, true);
igual('o DP: a 51 (sem movimento) só tem S-1299 e DCTFWeb', dp.get(51), { obrigacoes: ['s1299', 'dctfweb'], reinfAutorizada: false });
igual('o DP: a 10 tem tudo e a REINF autorizada', dp.get(10), { obrigacoes: ['recibos', 'folha', 's1200', 's1210', 's1299', 'dctfweb', 'darf', 'fgts'], reinfAutorizada: true });
const ordemDoCore = [...lerCore('empresas/dp.ts').split('export const OBRIGACOES_DP')[1].split('] as const')[0].matchAll(/id: '([a-z0-9]+)'/g)].map(m => m[1]);
igual('a ordem das obrigações do DP é a do core', R.OBRIGACOES_DP, ordemDoCore);
const regimesDoCore = (/export const REGIMES = \[([^\]]*)\]/.exec(lerCore('empresas/cadastro/regras.ts')) || [])[1];
igual('os regimes são os do core', R.REGIMES, regimesDoCore ? [...regimesDoCore.matchAll(/'([^']+)'/g)].map(m => m[1]) : null);

// as restrições das etapas da agenda, conferidas no texto das rotinas do core
function restricoesNoCore(arq) {
  const t = lerCore('tarefas/rotinas/' + arq);
  const partes = t.split(/\n\s*etapa\('/).slice(1);
  const m = new Map();
  for (const p of partes) {
    const id = p.slice(0, p.indexOf("'"));
    const reg = /regimes:\s*\[([^\]]*)\]/.exec(p);
    const mes = /meses:\s*\[([^\]]*)\]/.exec(p);
    const ob = /obrigacaoDp:\s*'([a-z0-9-]+)'/.exec(p);
    m.set(id, Object.assign({ id },
      reg ? { regimes: [...reg[1].matchAll(/'([^']+)'/g)].map(x => x[1]) } : {},
      mes ? { meses: mes[1].split(',').map(Number) } : {},
      ob ? { obrigacaoDp: ob[1] } : {},
      /soQuandoAdicionada:\s*true/.test(p) ? { soQuandoAdicionada: true } : {}));
  }
  return m;
}
const noCore = new Map([...restricoesNoCore('fiscal.ts'), ...restricoesNoCore('dp.ts')]);
for (const dep of ['fiscal', 'dp']) for (const e of R.ROTINAS_DA_AGENDA[dep].etapas) igual('a etapa ' + e.id + ' tem as mesmas restrições do core', e, noCore.get(e.id) || null);
igual('toda etapa da tabela de vencimentos está na agenda do robô', R.VENCIMENTOS.every(v => [...R.ROTINAS_DA_AGENDA.fiscal.etapas, ...R.ROTINAS_DA_AGENDA.dp.etapas].some(e => e.id === v.etapa)), true);

// ---------- 10. o porte é igual ao core (carrega os .ts que o Node consegue) ----------
let C = null;
try {
  C = {
    v: require(path.join(CORE, 'areaCliente', 'vencimentos.ts')),
    g: require(path.join(CORE, 'areaCliente', 'guias.ts')),
    c: require(path.join(CORE, 'areaCliente', 'chamados.ts')),
    e: require(path.join(CORE, 'areaCliente', 'envios.ts')),
  };
} catch (e) { console.log('AVISO: não carreguei o core TypeScript (' + e.message.split('\n')[0] + '); a comparação com o core ficou de fora'); }
if (C) {
  igual('a tabela de vencimentos é a do core', R.VENCIMENTOS, C.v.VENCIMENTOS);
  const competencias = [];
  for (let a = 2026; a <= 2028; a++) for (let m = 1; m <= 12; m++) competencias.push(a + '-' + String(m).padStart(2, '0'));
  igual('os vencimentos de 3 anos são os do core', R.VENCIMENTOS.map(v => competencias.map(c => R.vencimentoNaCompetencia(v, c))), C.v.VENCIMENTOS.map(v => competencias.map(c => C.v.vencimentoNaCompetencia(v, c))));
  const pedidos = [pedidoCompleto, Object.assign({}, pedidoCompleto, { aviso: '' }), Object.assign({}, pedidoCompleto, { valor: 'x' }), Object.assign({}, pedidoCompleto, { vencimento: '31/02/2026', aviso: '' }), Object.assign({}, pedidoCompleto, { numeroGuia: ' ', pdfNome: '', aviso: '' })];
  igual('a guia do FGTS é a do core', pedidos.map(p => [R.guiaDoFgts(p, HOJE), R.guiaDoFgts(p, HOJE, true)]), pedidos.map(p => [C.g.guiaDoFgts(p, HOJE), C.g.guiaDoFgts(p, HOJE, true)]));
  igual('a situação da guia é a do core', ['15/10/2026', '16/10/2026', '17/10/2026', 'x'].map(v => R.situacaoDaGuia(v, HOJE)), ['15/10/2026', '16/10/2026', '17/10/2026', 'x'].map(v => C.g.situacaoDaGuia(v, HOJE)));
  igual('o chamado do cliente é o do core', R.chamadoDoCliente(R.chamadoInterno('c1', interno)), C.c.chamadoDoCliente(R.chamadoInterno('c1', interno)));
  igual('os tipos de chamado são os do core', R.TIPOS_DE_CHAMADO, C.c.TIPOS_DE_CHAMADO);
  const textos = [['duvida', ''], ['x', 'a'], ['outro', 'y'.repeat(4001)], ['ferias', 'Quero marcar\nas férias'], ['admissao', 'z'.repeat(80)]];
  igual('a conferência do chamado é a do core', textos.map(([t, x]) => R.erroDoNovoChamado(t, x)), textos.map(([t, x]) => C.c.erroDoNovoChamado(t, x)));
  igual('o título do chamado é o do core', textos.map(([t, x]) => R.tituloDoChamado(t, x)), textos.map(([t, x]) => C.c.tituloDoChamado(t, x)));
  const arquivos = [{ nome: 'a.pdf', tamanho: 10 }, { nome: 'a.exe', tamanho: 10 }, { nome: 'a.PNG', tamanho: 0 }, { nome: 'a.zip', tamanho: 716801 }, { nome: 'a.xml', tamanho: 716800 }];
  igual('a conferência do envio é a do core', arquivos.map(R.erroDoEnvio), arquivos.map(C.e.erroDoEnvio));
  igual('o teto do envio é o do core', R.MAIOR_ENVIO, C.e.MAIOR_ENVIO);
  igual('o mime de cada extensão é o do core', R.MIME_DO_ENVIO, C.e.MIME_DO_ENVIO);
  igual('as extensões aceitas são as do core', R.EXTENSOES_ACEITAS, C.e.EXTENSOES_ACEITAS);
  igual('o recibo é o do core', R.reciboDoEnvio({ id: 'e1', nome: 'n', tipo: 'hack', tamanho: 1, recebidoEm: 'z', pastaDrive: 'p' }), C.e.reciboDoEnvio({ id: 'e1', nome: 'n', tipo: 'hack', tamanho: 1, recebidoEm: 'z', pastaDrive: 'p' }));
}

// ---------- 11. a guia de DAS/DAE do envios-do-nads.js segue a MESMA lista de campos e os mesmos pedaços ----------
let nads = null;
try { nads = require('./envios-do-nads'); } catch (e) { console.log('AVISO: não carreguei o envios-do-nads.js (' + e.message.split('\n')[0] + ')'); }
if (nads && nads.docDaGuiaDoCliente) {
  const das = nads.docDaGuiaDoCliente({ tipo: 'DAS', vencimento: '20/10/2026', valor: 917.42, codigo: '58', competencia: '2026-09' }, HOJE);
  igual('a guia do DAS (envios-do-nads) passa na lista branca do espelho', joga(() => R.conferirListaBranca('guia', das)), '');
  igual('o id da guia do DAS não se confunde com o do FGTS (id do pedido)', das.id, 'das-2026-09-58');
}
if (nads && nads.pedacosDoPdfCliente) {
  igual('os pedaços do PDF são os mesmos do envios-do-nads', R.pedacosDoPdf(b64), nads.pedacosDoPdfCliente(Buffer.from(b64, 'base64')));
}

// ---------- 12. o módulo carrega ----------
let modulo = null;
try { modulo = require('./area-cliente'); } catch (e) { console.log('AVISO: não carreguei o area-cliente.js (' + e.message.split('\n')[0] + '): rode com as dependências do robô (npm install em robo/)'); }
if (modulo) igual('o area-cliente.js carrega e exporta o iniciar', typeof modulo.iniciarAreaDoCliente, 'function');

// ---------- 13. o espelho do link revogado (ou trocado) sai, com as subcoleções ----------
// um banco de mentira: listDocuments traz os links vivos e os tokens sem documento que ainda têm subcoleções
function bancoDeMentira(existem, faltam) {
  const apagados = [];
  const ref = id => ({ id, get: async () => ({ exists: existem.includes(id) }) });
  return {
    apagados,
    collection: nome => ({ listDocuments: async () => (nome === 'areasCliente' ? [...existem, ...faltam].map(ref) : []), doc: ref }),
    recursiveDelete: async r => { apagados.push(r.id); },
  };
}
const esperar = [];
if (modulo) {
  const VIVO = '1'.repeat(40), REVOGADO = '2'.repeat(40), TROCADO = '3'.repeat(40), RECEM = '4'.repeat(40);
  const logs = [];
  // RECEM existe no banco mas o ouvinte ainda não o viu: não é órfão
  const db1 = bancoDeMentira([VIVO, RECEM], [REVOGADO, TROCADO, 'lixo']);
  esperar.push(modulo.limparEspelhosOrfaos(db1, new Set([VIVO]), (...m) => logs.push(m.join(' ')), { lote: 1, pausaMs: 0 }).then(apagados => {
    igual('órfãos: apaga o espelho do revogado e do link antigo de uma troca', apagados, [REVOGADO, TROCADO]);
    igual('órfãos: o link vivo e o recém-criado ficam', db1.apagados.includes(VIVO) || db1.apagados.includes(RECEM), false);
    igual('órfãos: id que não é token não é tocado', db1.apagados.includes('lixo'), false);
    igual('órfãos: fica no registro', logs.some(l => l.includes('2 link(s) revogado(s)')), true);
  }));
  const db2 = bancoDeMentira([VIVO], [REVOGADO]);
  esperar.push(modulo.limparEspelhosOrfaos(db2, new Set([VIVO]), () => {}, { so: [REVOGADO], pausaMs: 0 }).then(apagados => {
    igual('o link que acabou de sumir: só ele sai, na hora', apagados, [REVOGADO]);
  }));
  const db3 = bancoDeMentira([VIVO], []);
  esperar.push(modulo.limparEspelhosOrfaos(db3, new Set(), () => {}, { so: [VIVO], pausaMs: 0 }).then(apagados => {
    igual('o ouvinte atrasado acha que sumiu, mas o link existe: não apaga', apagados, []);
  }));
}

Promise.all(esperar).then(() => {
console.log(falhas ? '\n' + falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
process.exit(falhas ? 1 : 0);
});
