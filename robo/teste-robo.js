// Testes do robô do Gmail, com casos reais que já deram problema.
// Rode antes de publicar qualquer mudança no robô:  node teste-robo.js
// Não acessa Gmail nem Firestore: só as funções de detecção.
const r = require('./download-attachments');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

const SET_18 = Date.parse('2026-09-18T12:00:00Z');
const SET_15 = Date.parse('2026-09-15T12:00:00Z');
const JAN_10 = Date.parse('2027-01-10T12:00:00Z');

// ---------- mês a que o documento se refere ----------
igual('abreviação + ano', r.competenciaDoTexto('EXTRATOS BANCÁRIOS EMPRESAS VOLPONI AGO2026', SET_15), '2026-08');
igual('mês inteiro + ano colado', r.competenciaDoTexto('TÍTULOS PAGOS VOLPONI REF AGOSTO2026', SET_15), '2026-08');
igual('mm.aaaa no nome do arquivo', r.competenciaDoTexto('ArqEFD-11222333000181-07.2026.txt', SET_18), '2026-07');
igual('mês por extenso sem ano vale o mais recente', r.competenciaDoTexto('Extrato agosto', SET_15), '2026-08');
igual('dezembro visto em janeiro é do ano anterior', r.competenciaDoTexto('extrato dezembro', JAN_10), '2026-12');
igual('sem mês nenhum', r.competenciaDoTexto('bom dia, segue em anexo', SET_15), null);
igual('abreviação solta sem ano não conta ("mar", "out")', r.competenciaDoTexto('boleto mar aberto out', SET_15), null);
igual('corpo do e-mail: data de envio não define mês', r.competenciaDoTexto('Bom dia, enviado em 18/09/2026, segue', SET_18, true), null);
igual('corpo do e-mail: mês por extenso ainda vale', r.competenciaDoTexto('segue o extrato de agosto', SET_18, true), '2026-08');
igual('dígitos de CNPJ não viram mês', r.competenciaDoTexto('CNPJ 11222333000181', SET_18), null);
igual('chave de NF-e não vira mês', r.competenciaDoTexto('Nfe_000155-1-31260811222333000181550010000001551192419083.xml', SET_18), null);

// ---------- documento sem mês escrito: vale o dia limite do escritório ----------
const SET_02 = new Date(2026, 8, 2, 10).getTime();
const SET_11 = new Date(2026, 8, 11, 10).getTime();
const JAN_05 = new Date(2027, 0, 5, 10).getTime();
igual('chegou antes do dia limite: é do mês anterior', r.competenciaPresumida(SET_02, 10), '2026-08');
igual('chegou depois do dia limite: é do mês do e-mail', r.competenciaPresumida(SET_11, 10), '2026-09');
igual('janeiro antes do limite volta pra dezembro do ano anterior', r.competenciaPresumida(JAN_05, 10), '2026-12');
igual('sem dia limite configurado, nada muda', r.competenciaPresumida(SET_02, 0), '2026-09');

// ---------- portal do cliente: o que ainda falta ----------
igual('portal mostra os dois últimos meses fechados', r.mesesDoPortal(new Date(2026, 8, 18)), ['2026-08', '2026-07']);
igual('portal em janeiro olha dezembro e novembro', r.mesesDoPortal(new Date(2027, 0, 5)), ['2026-12', '2026-11']);
igual('nada recebido: faltam os três', r.faltamNoMes({}, null), ['extrato', 'comprovante', 'aplicacao']);
igual('recebeu extrato, não tem aplicação', r.faltamNoMes({ documentosNaoAplicaveis: ['aplicacao'] }, { extrato: true }), ['comprovante']);
igual('mês sem movimento não deve nada', r.faltamNoMes({}, { semMovimento: true }), []);

// ---------- spam: o que a tela lista para salvar ou marcar "É spam" ----------
const cliVolponi = { id: 'c1', nome: 'VOLPONI LTDA' };
const spamEmail = new Map([['maria@gmail.com', [{ id: 'c2', nome: '', nomeFantasia: 'Padaria da Maria' }]]]);
const spamDominio = new Map([['volponi.com.br', [cliVolponi]]]);
const msgSpam = (id, from, quando, anexos) => ({ id, internalDate: String(Date.parse(quando)),
  payload: { headers: [{ name: 'From', value: from }, { name: 'Subject', value: 'assunto ' + id }],
    parts: (anexos || []).map(f => ({ filename: f, body: { attachmentId: 'a' + f, size: 10 }, headers: [] })) } });
const spam = r.montarSpam([
  msgSpam('m1', 'Loja <promo@loja.com>', '2026-09-20T10:00:00Z', ['cupom.pdf']),
  msgSpam('m2', '"Financeiro" <fin@volponi.com.br>', '2026-09-18T10:00:00Z', ['extrato.pdf', 'image001.png']),
  msgSpam('m3', 'Maria <MARIA@gmail.com>', '2026-09-19T10:00:00Z'),
  msgSpam('m4', 'golpe@banco-falso.com', '2026-09-21T10:00:00Z', ['boleto.zip']),
  { id: 'm5' },
], spamEmail, spamDominio, new Set(['golpe@banco-falso.com']));
igual('spam: de cliente primeiro, depois o mais novo; ignorado some', spam.map(x => x.mensagemId), ['m3', 'm2', 'm1']);
igual('spam: cliente pelo domínio próprio, sem logo de assinatura', [spam[1].clienteId, spam[1].clienteNome, spam[1].nome, spam[1].arquivos], ['c1', 'VOLPONI LTDA', 'Financeiro', ['extrato.pdf']]);
igual('spam: e-mail em minúsculas e nome fantasia quando falta o nome', [spam[0].remetente, spam[0].clienteNome], ['maria@gmail.com', 'Padaria da Maria']);
igual('spam: quem não é cliente fica sem cliente', [spam[2].clienteId, spam[2].clienteNome, spam[2].em], [null, '', '2026-09-20T10:00:00.000Z']);
igual('spam: no máximo ' + r.MAX_SPAM, r.montarSpam(Array.from({ length: 130 }, (_, i) => msgSpam('x' + i, 'a' + i + '@x.com', '2026-09-20T10:00:00Z')), spamEmail, spamDominio, new Set()).length, r.MAX_SPAM);

// ---------- vigia de CNPJ: o que mudou na Receita ----------
const cnpj = require('./vigia-cnpj');
const daApi = { descricao_situacao_cadastral: 'Ativa', opcao_pelo_simples: true, opcao_pelo_mei: false, razao_social: 'PADARIA EXEMPLO LTDA', cnae_fiscal: 1091102,
  cnae_fiscal_descricao: 'Padaria', descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '120', bairro: 'CENTRO', municipio: 'TAIOBEIRAS', uf: 'MG',
  qsa: [{ nome_socio: 'MARIA EXEMPLO', cnpj_cpf_do_socio: '***123456**', faixa_etaria: 'Entre 41 a 50 anos' }, { nome_socio: 'ANA EXEMPLO' }] };
const r1 = cnpj.retrato(daApi);
igual('retrato guarda situação em maiúsculas', r1.situacao, 'ATIVA');
igual('retrato monta o endereço', r1.endereco, 'RUA DAS FLORES, 120, CENTRO, TAIOBEIRAS/MG');
igual('retrato não guarda CPF nem idade de sócio', JSON.stringify(r1).includes('123456') || JSON.stringify(r1).includes('anos'), false);
igual('sócios em ordem, só o nome', r1.socios, ['ANA EXEMPLO', 'MARIA EXEMPLO']);
igual('nada mudou: nenhuma diferença', cnpj.diferencas(r1, cnpj.retrato(daApi)), []);
const r2 = cnpj.retrato(Object.assign({}, daApi, { opcao_pelo_simples: false, descricao_situacao_cadastral: 'INAPTA', descricao_motivo_situacao_cadastral: 'OMISSAO DE DECLARACOES', qsa: [{ nome_socio: 'ANA EXEMPLO' }, { nome_socio: 'JOSE NOVO' }] }));
igual('saiu do Simples e ficou inapta são graves', cnpj.diferencas(r1, r2).filter(m => m.grave).map(m => m.texto),
  ['Situação cadastral: ATIVA → INAPTA (omissao de declaracoes)', 'Saiu do Simples Nacional']);
igual('troca de sócio aparece, sem ser grave', cnpj.diferencas(r1, r2).filter(m => !m.grave).map(m => m.texto),
  ['Saiu do quadro de sócios: MARIA EXEMPLO', 'Entrou no quadro de sócios: JOSE NOVO']);
igual('primeira conferência de cliente ativo não avisa nada', cnpj.avisosDaPrimeiraVez(r1), []);
igual('resposta de outro CNPJ é recusada', cnpj.respostaValida(Object.assign({ cnpj: '11222333000181' }, daApi), '12.345.678/0001-95'), false);
igual('resposta sem situação é recusada', cnpj.respostaValida({ cnpj: '11222333000181' }, '11222333000181'), false);
igual('resposta boa passa', cnpj.respostaValida(Object.assign({ cnpj: '11222333000181' }, daApi), '11.222.333/0001-81'), true);
const semCampos = cnpj.retrato(Object.assign({}, daApi, { opcao_pelo_simples: null, opcao_pelo_mei: null, qsa: null }), r1);
igual('Simples e sócios que vieram vazios mantêm o que já se sabia (sem falso alarme)', cnpj.diferencas(r1, semCampos), []);
igual('retrato igual não é regravado', cnpj.mesmoRetrato(r1, cnpj.retrato(daApi)), true);
igual('retrato diferente é regravado', cnpj.mesmoRetrato(r1, r2), false);
igual('primeira conferência de cliente inapto avisa', cnpj.avisosDaPrimeiraVez(r2).length, 1);

// ---------- lembrete de vencimento pro cliente ----------
const venc = require('./avisos-vencimento');
const guias = [
  { id: 'a', vencimento: '2026-11-19', status: 'confirmada', itens: [{ tipo: 'DAS', valor: 1240.5 }] },
  { id: 'b', vencimento: '2026-11-20', status: 'pendente', itens: [{ tipo: 'FGTS', valor: null }] },
  { id: 'c', vencimento: '2026-11-20', status: 'falha', itens: [{ tipo: 'DARF', valor: 10 }] },
  { id: 'd', vencimento: '2026-11-23', status: 'confirmada', itens: [{ tipo: 'INSS', valor: 99 }] },
  { id: 'e', vencimento: '', status: 'confirmada', itens: [] },
];
igual('quinta avisa o de hoje e o de amanhã, sem o que falhou', venc.guiasParaAvisar(guias, new Date(2026, 10, 19, 9)).map(a => a.entrega.id + ':' + a.quando), ['a:hoje', 'b:amanhã']);
igual('sexta olha até segunda', venc.guiasParaAvisar(guias, new Date(2026, 10, 20, 9)).map(a => a.entrega.id + ':' + a.quando), ['b:hoje', 'd:segunda']);
igual('dia sem vencimento não avisa', venc.guiasParaAvisar(guias, new Date(2026, 10, 10, 9)), []);
igual('texto de uma guia', venc.textoDoAviso(venc.guiasParaAvisar(guias, new Date(2026, 10, 18, 9))).titulo, 'Vence amanhã: DAS R$ 1.240,50');
igual('texto de várias', venc.textoDoAviso(venc.guiasParaAvisar(guias, new Date(2026, 10, 19, 9))).titulo, '2 guias vencendo');

// ---------- lista local de clientes (o robô não relê o cadastro a cada rodada) ----------
const cache = require('./clientes-cache');
const fsT = require('fs');
const guardado = fsT.existsSync(cache.ARQUIVO) ? fsT.readFileSync(cache.ARQUIVO) : null;
fsT.writeFileSync(cache.ARQUIVO, JSON.stringify({ em: new Date().toISOString(), clientes: [{ id: 'x', dados: { nome: 'EXEMPLO', email: 'a@exemplo.com.br' } }] }));
igual('arquivo fresco é usado', (cache.lerDoArquivo() || []).length, 1);
igual('arquivo com mais de 20 min é ignorado', cache.lerDoArquivo(Date.now() + cache.VALIDADE_MS + 1000), null);
const vistos = [];
cache.comoSnap(cache.lerDoArquivo()).forEach(d => vistos.push(d.id + ':' + d.data().email));
igual('tem o mesmo formato que o robô espera do banco', vistos, ['x:a@exemplo.com.br']);
fsT.writeFileSync(cache.ARQUIVO, 'lixo');
igual('arquivo estragado é ignorado', cache.lerDoArquivo(), null);
if (guardado) fsT.writeFileSync(cache.ARQUIVO, guardado); else fsT.unlinkSync(cache.ARQUIVO);

// ---------- resumo da semana ----------
const sem = require('./resumo-semanal');
igual('quinta ainda não é hora do resumo', sem.horaDoResumo(new Date(2026, 8, 17, 18)), false);
igual('sexta às 16h ainda não', sem.horaDoResumo(new Date(2026, 8, 18, 16)), false);
igual('sexta às 17h é', sem.horaDoResumo(new Date(2026, 8, 18, 17)), true);
igual('PC desligado na sexta: sábado e domingo ainda mandam', [sem.horaDoResumo(new Date(2026, 8, 19, 9)), sem.horaDoResumo(new Date(2026, 8, 20, 9))], [true, true]);
igual('segunda já é outra semana', sem.horaDoResumo(new Date(2026, 8, 21, 9)), false);
igual('PC desligado de sexta a domingo: na segunda a semana devida é a ANTERIOR', sem.segundaDaSemana(sem.semanaDevida(new Date(2026, 8, 21, 9))).getDate(), 14);
igual('na sexta às 17h a semana devida é a atual', sem.segundaDaSemana(sem.semanaDevida(new Date(2026, 8, 18, 17))).getDate(), 14);
igual('na quinta ainda se deve a semana anterior', sem.segundaDaSemana(sem.semanaDevida(new Date(2026, 8, 17, 9))).getDate(), 7);
igual('segunda da semana de um domingo é a anterior', sem.segundaDaSemana(new Date(2026, 8, 20, 9)).getDate(), 14);
const textoSem = sem.montarTexto({ de: '14/09/2026', ate: '18/09/2026', mesDosDocumentos: 'agosto de 2026',
  entregas: [{ status: 'confirmada', entregadoPorNome: 'João' }, { status: 'confirmada', entregadoPorNome: 'João' }, { status: 'falha', clienteNome: 'PADARIA EXEMPLO', motivoFalha: 'Fechado' }],
  portais: { total: 5, abriram: ['MERCEARIA EXEMPLO'] }, devendo: [{ nome: 'OFICINA EXEMPLO', faltam: ['extrato', 'aplicacao'] }],
  receita: [{ nome: 'MERCEARIA EXEMPLO', textos: ['Saiu do Simples Nacional'] }], backup: null });
igual('assunto do resumo', textoSem.assunto, 'Resumo da semana: 2 entregas, 1 não realizada, 1 devendo documento');
igual('resumo traz cada bloco', ['- João: 2', '! PADARIA EXEMPLO: Fechado', '1 cliente abriu o link', 'OFICINA EXEMPLO: extrato, aplicação', 'Saiu do Simples Nacional', 'Ainda não há registro de backup']
  .map(p => textoSem.texto.includes(p)), [true, true, true, true, true, true]);

// ---------- entrega pelo link ----------
const elk = require('./entrega-pelo-link');
igual('toque bem formado', elk.lerToque('2026-09-19T12:00:00.000Z|Maria  Souza'), { em: '2026-09-19T12:00:00.000Z', nome: 'Maria Souza' });
igual('toque sem nome ainda vale', elk.lerToque('2026-09-19T12:00:00.000Z|'), { em: '2026-09-19T12:00:00.000Z', nome: '' });
igual('toque com lixo no lugar da data é recusado', elk.lerToque('ontem|Maria'), null);
igual('nome gigante é cortado em 60', elk.lerToque('2026-09-19T12:00:00.000Z|' + 'a'.repeat(200)).nome.length, 60);
igual('entrega esperando no link: confirma', elk.podeConfirmar({ status: 'link' }), true);
igual('entrega da rota não é confirmada por toque', elk.podeConfirmar({ status: 'pendente' }), false);
igual('entrega já confirmada não é mexida de novo', elk.podeConfirmar({ status: 'confirmada' }), false);
const linkDeTeste = { entregas: { lista: [{ id: 'abcdef1', status: 'link' }, { id: 'abcdef2', status: 'confirmada' }] },
  recebido: { abcdef1: '2026-09-19T12:00:00.000Z|Maria', abcdef2: '2026-09-19T12:00:00.000Z|Maria', deOutroLink: '2026-09-19T12:00:00.000Z|X', 'a/b': 'lixo', abcdef9: 'sem data|X' } };
const tri = elk.triar(linkDeTeste);
igual('só o toque de entrega que a EQUIPE pôs no link como "link" vai pra conferência', tri.conferir.map(c => c.id), ['abcdef1']);
igual('o resto é apagado sem ler nada do banco (entrega de fora, já confirmada, lixo)', tri.descartar.sort(), ['a/b', 'abcdef2', 'abcdef9', 'deOutroLink']);
igual('link sem toque nenhum não faz nada', elk.triar({ entregas: { lista: [] } }), { conferir: [], descartar: [] });
igual('hora do toque dentro da janela vale', elk.horaConfiavel('2026-09-19T12:00:00.000Z', '2026-09-18T10:00:00.000Z', '2026-09-19T12:01:00.000Z'), '2026-09-19T12:00:00.000Z');
igual('hora do toque retrodatada vira a hora do robô', elk.horaConfiavel('2020-01-01T00:00:00.000Z', '2026-09-18T10:00:00.000Z', '2026-09-19T12:01:00.000Z'), '2026-09-19T12:01:00.000Z');
igual('hora do toque no futuro vira a hora do robô', elk.horaConfiavel('2030-01-01T00:00:00.000Z', '2026-09-18T10:00:00.000Z', '2026-09-19T12:01:00.000Z'), '2026-09-19T12:01:00.000Z');

// ---------- tipo de documento ----------
igual('títulos pagos = comprovante', r.detectarTipos('TITULOS PAGOS SICOOB AGO2026.pdf'), ['comprovante']);
igual('tit liquidados = comprovante', r.detectarTipos('TIT LIQUIDADOS BBDVCM AGO2026.pdf'), ['comprovante']);
igual('boletos pagos = comprovante', r.detectarTipos('BOLETOS PAGOS BNB AGO2026.pdf'), ['comprovante']);
igual('extrato', r.detectarTipos('EXTRATO SICOOB AGO2026.pdf'), ['extrato']);
igual('aplicação', r.detectarTipos('APLICACAO CDB AGO2026.pdf'), ['aplicacao']);
igual('antecipação de recebíveis não é documento da cobrança', r.detectarTipos('RELATÓRIO DE ANTECIPAÇÃO DE RECEBÍVEIS SICOOB'), []);

// ---------- anexos: assinatura e logo não contam ----------
igual('image001.png é assinatura', r.IMAGEM_DE_ASSINATURA.test('image001.png'), true);
igual('~WRD0000.jpg é assinatura do Word', r.IMAGEM_DE_ASSINATURA.test('~WRD0000.jpg'), true);
igual('Outlook-ab12.png é assinatura', r.IMAGEM_DE_ASSINATURA.test('Outlook-ab12.png'), true);
igual('foto.jpg de cliente não é assinatura', r.IMAGEM_DE_ASSINATURA.test('foto.jpg'), false);
igual('PDF não é assinatura', r.IMAGEM_DE_ASSINATURA.test('EXTRATO.pdf'), false);
const parte = (filename, disp, mime) => ({ filename, mimeType: mime || 'application/pdf', body: { attachmentId: 'x' + filename, size: 10 }, headers: disp ? [{ name: 'Content-Disposition', value: disp }] : [] });
const email = { parts: [
  { mimeType: 'text/plain', body: { size: 3 } },
  parte('LOGO EMPRESAS VOLPONI °.jpeg', 'inline; filename="LOGO.jpeg"', 'image/jpeg'),
  parte('image003.png', 'attachment; filename="image003.png"', 'image/png'),
  parte('EXTRATO SICOOB AGO2026.pdf', 'attachment; filename="EXTRATO.pdf"'),
] };
igual('só o documento de verdade é anexo', r.coletarAnexos(email, []).map(a => a.filename), ['EXTRATO SICOOB AGO2026.pdf']);

// ---------- remetente ----------
igual('noreply é automático', r.AUTOMATICO.test('Banco <noreply@banco.com.br>'), true);
igual('cliente não é automático', r.AUTOMATICO.test('Cássia Volponi <torneariavolponi@hotmail.com>'), false);
igual('e-mail do cabeçalho From', r.extrairEmail('"Cássia Volponi" <TorneariaVolponi@Hotmail.com>'), 'torneariavolponi@hotmail.com');
igual('nome do cabeçalho From', r.extrairNome('"Cássia Volponi" <torneariavolponi@hotmail.com>'), 'Cássia Volponi');
igual('domínio', r.dominioDe('financeiro@volponi.com.br'), 'volponi.com.br');
igual('gmail é domínio público', r.DOMINIOS_PUBLICOS.has('gmail.com'), true);
igual('entidades do trecho do Gmail', r.decodificarEntidades('Olá &#39;teste&#39; &amp; &quot;mais&quot;'), 'Olá \'teste\' & "mais"');

// ---------- filiais no mesmo e-mail ----------
const matriz = { id: 'a', documento: '12.345.678/0001-95' };
const filial = { id: 'b', documento: '12.345.678/0002-76' };
igual('CNPJ da filial no texto decide', (r.desempatarPorDocumento([matriz, filial], 'extrato filial 12.345.678/0002-76 agosto') || {}).id, 'b');
igual('sem CNPJ no texto, não decide', r.desempatarPorDocumento([matriz, filial], 'extrato agosto'), null);
igual('os dois CNPJs no texto, não decide', r.desempatarPorDocumento([matriz, filial], '12345678000195 e 12345678000276'), null);
const a7 = { id: 'a7', nome: 'A7 COMERCIO DE VEICULOS LTDA' }, pecas = { id: 'pc', nome: 'A7 AUTO PECAS LTDA' }, dono = { id: 'pf', nome: 'ALISSON RODRIGUES' };
const porNome = (c, t) => (r.desempatarPorNome(c, t) || {}).id || null;
igual('nome da empresa no assunto decide', porNome([a7, pecas], 'NOTAS FISCAIS ENTRADA - A7 COMÉRCIO DE VEÍCULOS LTDA (MÊS: AGOSTO/2026)'), 'a7');
igual('palavras só daquela empresa decidem', porNome([a7, pecas], 'notas da A7 auto peças de agosto'), 'pc');
igual('sem nome no texto, não decide', porNome([a7, pecas], 'extrato de agosto'), null);
igual('os dois nomes no texto, não decide', porNome([a7, pecas], 'A7 COMERCIO DE VEICULOS e A7 AUTO PECAS'), null);
igual('nome mais comprido vence o que está dentro dele', porNome([{ id: 'm', nome: 'PADARIA SAO JOSE LTDA' }, { id: 'f', nome: 'PADARIA SAO JOSE FILIAL LTDA' }], 'extrato PADARIA SAO JOSE FILIAL'), 'f');
igual('assinatura do dono não escolhe a pessoa física', porNome([a7, dono], r.semAssinatura('Segue o extrato.\nAtt,\nAlisson Rodrigues', 'Alisson Rodrigues')), null);
const base = [{ id: 'm', nome: 'A7 MOBILE LTDA' }, { id: 'c', nome: 'A7 COMERCIO DE VEICULOS LTDA' }, { id: 'x', nome: 'PADARIA COMERCIO LTDA' },
  { id: 'y', nome: 'SUPERMERCADO COMERCIO LTDA' }, { id: 'z', nome: 'FERRAGENS COMERCIO LTDA' }, { id: 'w', nome: 'OUTRO COMERCIO LTDA' },
  { id: 'g', nome: 'LOJA DO ZE', grupoLocal: 'x' }, { id: 'f1', nome: 'MATRIZ SA', documento: '12.345.678/0001-95' }, { id: 'f2', nome: 'LOJA NOVA', documento: '12.345.678/0002-76' }];
const irmas = id => r.empresasIrmas(base.find(c => c.id === id), base, r.frequenciaDePalavras(base)).map(c => c.id);
igual('irmã pela palavra rara do nome (A7)', irmas('c'), ['m']);
igual('irmã pelo grupo local', irmas('x'), ['g']);
igual('irmã pela raiz do CNPJ (filial)', irmas('f1'), ['f2']);
igual('palavra comum (COMERCIO) não faz irmã', irmas('w'), []);
igual('e-mail da A7 Comércio com nota da A7 Mobile vai pra Mobile', porNome([base[1], base[0]], 'NOTAS FISCAIS DE SAÍDA - A7 MOBILE LTDA - AGOSTO/2026'), 'm');

// ---------- régua de cobrança automática ----------
const rg = require('./regua-cobranca');
igual('dias da régua: texto solto, fora da faixa e repetidos', rg.diasDaRegua('15, 5; 10 5 31 0'), [5, 10, 15]);
igual('dias da régua: lista', rg.diasDaRegua([20, '3']), [3, 20]);
igual('competência anterior na virada do ano', rg.competenciaAnterior(new Date(2027, 0, 5)), '2026-12');
const qui10 = new Date(2026, 8, 10, 10, 0);   // quinta, 10/09
igual('dia marcado, ainda não rodou: roda', rg.diaDeRodar(qui10, [10], ''), true);
igual('já rodou depois do dia marcado: não roda', rg.diaDeRodar(qui10, [10], '2026-09-10'), false);
igual('antes das 9h: espera', rg.diaDeRodar(new Date(2026, 8, 10, 8, 0), [10], ''), false);
igual('dia 5 caiu no sábado: roda na segunda 7', rg.diaDeRodar(new Date(2026, 8, 7, 10, 0), [5], '2026-08-20'), true);
igual('sábado não roda', rg.diaDeRodar(new Date(2026, 8, 5, 10, 0), [5], ''), false);
igual('antes do primeiro dia da régua: não roda', rg.diaDeRodar(new Date(2026, 8, 3, 10, 0), [5, 15], '2026-08-15'), false);
const cli = { id: 'c1', nome: 'PADARIA SAO JORGE LTDA', email: 'Padaria@Exemplo.com', documentosNaoAplicaveis: ['aplicacao'] };
igual('falta só o que se aplica e não chegou', rg.faltandoDo(cli, { extrato: { em: 'x' } }).map(t => t.chave), ['comprovante']);
igual('sem movimento: nada falta', rg.faltandoDo(cli, { semMovimento: true }), []);
const agoraMs = qui10.getTime();
igual('sem e-mail fica de fora', rg.cobrancaDo({ id: 'x', nome: 'X' }, null, {}, '2026-08', agoraMs).pula, 'sem e-mail');
igual('cobrado há 2 dias fica de fora', rg.cobrancaDo(cli, { cobrancas: [{ em: new Date(agoraMs - 2 * 864e5).toISOString(), canal: 'gmail' }] }, {}, '2026-08', agoraMs).pula, 'cobrado há pouco');
const segunda = rg.cobrancaDo(Object.assign({ portalToken: 'tok' }, cli), { cobrancas: [{ em: '2026-09-01T12:00:00Z', canal: 'gmail' }, { em: '2026-09-02T12:00:00Z', canal: 'coleta' }] }, { diaLimite: 15 }, '2026-08', agoraMs);
igual('coleta não conta: vira a 2ª cobrança, com prazo e link', [segunda.n, segunda.para, segunda.assunto, /dia 15\/09/.test(segunda.corpo), /cliente\.html\?portal=tok$/.test(segunda.corpo), segunda.tipos],
  [2, 'padaria@exemplo.com', 'Lembrete: documentos de agosto de 2026 - PADARIA SAO JORGE LTDA', true, true, ['extrato', 'comprovante']]);
igual('modelo do admin vale no lugar do padrão', rg.cobrancaDo(cli, null, { modelos: { '1': { assunto: 'Docs {mes}' } } }, '2026-12', agoraMs).assunto, 'Docs dezembro de 2026');
// caixas por departamento (01/10/2026): a cobrança do fiscal não conta na régua do contábil; {caixa} é a que envia
const comFiscal = rg.cobrancaDo(cli, { cobrancas: [{ em: new Date(agoraMs - 864e5).toISOString(), canal: 'gmail', departamento: 'fiscal' }] }, {}, '2026-08', agoraMs, 'contabil@nilma.com');
igual('cobrança do fiscal não conta para o contábil', [comFiscal.pula, comFiscal.n], [undefined, 1]);
igual('{caixa} é a caixa que envia', rg.cobrancaDo(cli, null, { modelos: { '1': { corpo: 'responda para {caixa}' } } }, '2026-08', agoraMs, 'contabil@nilma.com').corpo.startsWith('responda para contabil@nilma.com'), true);

// ---------- comprovante de entrega por e-mail ----------
const ce = require('./comprovante-email');
const agoraCe = Date.parse('2026-09-19T15:00:00Z');
igual('entrega confirmada agora pede comprovante', ce.precisaDeComprovante({ status: 'confirmada', confirmadoEm: '2026-09-19T14:00:00Z' }, agoraCe), true);
igual('pelo link não pede', ce.precisaDeComprovante({ status: 'confirmada', recebidoPeloLink: true, confirmadoEm: '2026-09-19T14:00:00Z' }, agoraCe), false);
igual('já mandado não pede de novo', ce.precisaDeComprovante({ status: 'confirmada', comprovanteEmail: { em: 'x' }, confirmadoEm: '2026-09-19T14:00:00Z' }, agoraCe), false);
igual('de anteontem não pede', ce.precisaDeComprovante({ status: 'confirmada', confirmadoEm: '2026-09-17T14:00:00Z' }, agoraCe), false);
igual('não entregue não pede', ce.precisaDeComprovante({ status: 'falha', confirmadoEm: '2026-09-19T14:00:00Z' }, agoraCe), false);
const comp = ce.textoDoComprovante({ nome: 'PADARIA', portalToken: 'tok' }, [
  { itens: [{ tipo: 'DAS', valor: 1240.5 }], competencia: '2026-08', vencimento: '2026-09-22', recebedor: 'Maria', confirmadoEm: '2026-09-19T13:00:00Z' },
  { itens: [{ tipo: 'Guia INSS', valor: null }], competencia: '2026-08', recebedor: 'Maria', confirmadoEm: '2026-09-19T13:01:00Z' }], 'Escritório');
igual('comprovante de duas guias num e-mail só', [comp.assunto, /- DAS R\$ 1\.240,50 \(agosto de 2026, vence 22\/09\/2026\)/.test(comp.corpo), /Recebido por Maria em /.test(comp.corpo), /\?portal=tok/.test(comp.corpo), /Escritório$/.test(comp.corpo)],
  ['Entrega registrada: 2 documentos', true, true, true, true]);
igual('assunto de uma guia só', ce.textoDoComprovante({ nome: 'X' }, [{ itens: [{ tipo: 'DAS', valor: 50 }], competencia: '2026-08', confirmadoEm: '2026-09-19T13:00:00Z' }]).assunto, 'Entrega registrada: DAS R$ 50,00');

// ---------- documento enviado pelo link do cliente ----------
const ep = require('./envios-do-portal');
const pdf = Buffer.from('%PDF-1.4\n%fim');
igual('PDF pelos primeiros bytes', ep.tipoReal(pdf), 'pdf');
igual('JPEG pelos primeiros bytes', ep.tipoReal(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0])), 'jpg');
igual('texto com nome de .pdf não passa', ep.tipoReal(Buffer.from('<html>oi</html>')), '');
const envioOk = { competencia: '2026-08', tipo: 'extrato', nome: 'C:\\fakepath\\extrato: agosto?.PDF', dados: pdf.toString('base64') };
igual('envio certo passa', [ep.conferirEnvio(envioOk).ext, !!ep.conferirEnvio(envioOk).buffer], ['pdf', true]);
igual('mês inválido não passa', ep.conferirEnvio(Object.assign({}, envioOk, { competencia: '2026-13' })).erro, 'competência inválida');
igual('tipo fora da lista não passa', ep.conferirEnvio(Object.assign({}, envioOk, { tipo: 'contrato' })).erro, 'tipo de documento inválido');
igual('arquivo disfarçado não passa', ep.conferirEnvio(Object.assign({}, envioOk, { dados: Buffer.from('MZ executável').toString('base64') })).erro, 'não é PDF nem foto');
igual('nome no Drive sem caminho nem caractere proibido', ep.nomeNoDrive(envioOk, 'pdf', new Date(2026, 8, 19)), 'Pelo link 2026-09-19 - Extrato - extrato agosto.pdf');

// ---------- bancos dos extratos ----------
const bk = require('./bancos');
igual('BB pelo cabeçalho', bk.bancosDoTexto('BANCO DO BRASIL S.A.\nSISBB - Sistema de Informações\nExtrato de conta corrente'), ['bb']);
igual('Sicoob (Bancoob) pelo cabeçalho', bk.bancosDoTexto('SICOOB CREDINOR\nCooperativa de Crédito\nExtrato'), ['sicoob']);
igual('banco citado no meio do extrato não conta', bk.bancosDoTexto('SICREDI Extrato\n' + 'x'.repeat(2000) + ' TED para BANCO DO BRASIL'), ['sicredi']);

// Cabeçalhos de verdade, dos extratos que o escritório recebe. Só o pedaço
// que identifica a instituição: sem nome de cliente, CNPJ, conta ou valor.
// Dois destes NÃO eram reconhecidos — o banco não escreve o próprio nome.
const miolo = ' PIX RECEBIDO REM: FULANO 03/08 1743583 1.400,00 '.repeat(60);
igual('BB: o extrato não diz "Banco do Brasil" em lugar nenhum',
  bk.bancosDoTexto('Extrato Mensal / Por Período\n\nFolha 1/4\n\nAgência | Conta Total Disponível (R$)\n' + miolo + '\nSaldos Invest Fácil / Plus'), ['bb']);
igual('BB consolidado, mesmo caso',
  bk.bancosDoTexto('Extrato Consolidado / Por Período\n\nFolha 1/5\n' + miolo), ['bb']);
igual('BNB: o nome só aparece no fundo automático do saldo',
  bk.bancosDoTexto('Extrato de Conta Corrente - no período\n\nAgência/Conta Corrente: 060 - SALINAS\n\nDetalhamento do Saldo\nInvestimentos BNB AUTOMATICO FIF (*)'), ['bnb']);
igual('Sicoob do internet banking',
  bk.bancosDoTexto('Sicoob | Internet banking\n\nEXTRATO DE CONTA CORRENTE 01/09/2026\n\nCooperativa: 3144-5 / SICOOB CREDINOR'), ['sicoob']);
igual('Stone diz a instituição no alto',
  bk.bancosDoTexto('Extrato de conta corrente Emitido em 14 setembro 2026\n\nDados da conta\n\nInstituição Stone Instituição de Pagamento S.A.'), ['stone']);
// O Nubank só assina no rodapé; num extrato com movimento isso fica longe do topo.
igual('Nubank assina no rodapé',
  bk.bancosDoTexto('01 DE AGOSTO DE 2026 a 31 DE AGOSTO DE 2026 VALORES EM R$\nSaldo final do período\n' + miolo +
    '\nNu Financeira S.A. - Sociedade de Credito, Financiamento e Investimento\nNu Pagamentos S.A. - Instituição de Pagamento'), ['nubank']);
// e a assinatura no rodapé não pode abrir a porta pra nome de banco no miolo
igual('assinatura no rodapé não vale pra nome solto no fim',
  bk.bancosDoTexto('Sicoob | Internet banking\n' + miolo + '\nPIX ENVIADO DES: BANCO DO BRASIL'), ['sicoob']);
igual('Nu Pagamentos', bk.bancosDoTexto('Nu Pagamentos S.A. - Instituição de Pagamento\nExtrato'), ['nubank']);
igual('vários PDFs, cada um o seu', bk.bancosDosTextos(['Banco do Nordeste do Brasil', 'CAIXA ECONOMICA FEDERAL']).sort(), ['bnb', 'caixa']);
igual('texto sem banco', bk.bancosDoTexto('Extrato mensal'), []);
igual('banco novo pro cadastro, sem o que o admin recusou', r.bancosNovos({ bancos: ['bb'], bancosRecusados: ['itau'] }, ['bb', 'itau', 'sicoob']), ['sicoob']);

// ---------- cobrança em HTML ----------
const eh = require('./email-html');
const visual = eh.htmlDaCobranca({
  corpo: 'Olá,\n\nFaltam:\n\n- Extrato Bancário\n- Comprovante\n\nVeja aqui:\nhttps://x.github.io/cliente.html?portal=t\n\nObrigado,\nNilma',
  cliente: { bancos: ['bb', 'sicoob', 'inexistente'], documentosNaoAplicaveis: ['aplicacao'] }, competencia: '2026-08', bancosRecebidos: ['bb'],
  diaLimite: 15, assinatura: 'Nilma <Contabilidade>', agora: new Date(2026, 8, 19), mostrarRecebidos: true,
});
// Dois bancos e dois documentos exigidos = quatro coisas; só o extrato do BB
// chegou. O campo antigo (bancosRecebidos) continua valendo como extrato.
igual('HTML: manchete, mês, bancos, botão, prazo vencido e texto escapado', [
  /Faltam 3 documentos de agosto/.test(visual.html), />AGO 2026</.test(visual.html), /1 de 4 já chegaram/.test(visual.html),
  /Banco do Brasil[\s\S]*?Recebido/.test(visual.html), /Sicoob[\s\S]*?Falta/.test(visual.html), /inexistente/.test(visual.html),
  /href="https:\/\/x\.github\.io\/cliente\.html\?portal=t"/.test(visual.html), /Veja aqui:/.test(visual.html),
  /O prazo era 15\/09 \(há 4 dias\)/.test(visual.html), /Nilma &lt;Contabilidade&gt;/.test(visual.html),
], [true, true, true, true, true, false, true, false, true, true]);
igual('HTML: logos e ícones anexados por cid, uma vez cada', [visual.imagens.some(i => i.cid === 'banco-bb'), visual.imagens.some(i => i.cid === 'icone-extrato'),
  new Set(visual.imagens.map(i => i.cid)).size === visual.imagens.length], [true, true, true]);
// Agora cada documento é por banco: o comprovante também nomeia o banco.
const visual2 = eh.htmlDaCobranca({
  corpo: 'Olá,\n\nFaltam:\n\n- Extrato Bancário\n- Comprovante\n\nObrigado,\nNilma',
  cliente: { bancos: ['bb', 'sicoob'], documentosNaoAplicaveis: ['aplicacao'] }, competencia: '2026-08',
  bancosPorTipo: { extrato: ['bb', 'sicoob'], comprovante: ['bb'] },
  diaLimite: 15, assinatura: 'Nilma', agora: new Date(2026, 8, 19), mostrarRecebidos: true,
});
igual('HTML: o comprovante também conta por banco', [
  /3 de 4 já chegaram/.test(visual2.html),
  (visual2.html.match(/Sicoob/g) || []).length === 2,
  /Falta 1 banco/.test(visual2.html),
], [true, true, true]);

// Padrão: o e-mail só fala do que falta (sem "Recebido" nem "já chegaram").
const visual3 = eh.htmlDaCobranca({
  corpo: 'Olá,\n\nFaltam:\n\n- Extrato Bancário\n- Comprovante\n\nObrigado,\nNilma',
  cliente: { bancos: ['bb', 'sicoob'], documentosNaoAplicaveis: ['aplicacao'] }, competencia: '2026-08',
  bancosPorTipo: { extrato: ['bb'], comprovante: [] }, diaLimite: 15, assinatura: 'Nilma', agora: new Date(2026, 8, 19),
});
igual('HTML padrão: sem "Recebido", sem "já chegaram", só o banco que falta no extrato', [
  /Recebido/.test(visual3.html), /já chegaram/.test(visual3.html), /Faltam 3 documentos de agosto/.test(visual3.html),
  (visual3.html.match(/Banco do Brasil/g) || []).length, (visual3.html.match(/Sicoob/g) || []).length,
], [false, false, true, 1, 2]);

// ---------- aprender com as escolhas da equipe ----------
const pal = r.palavrasDaEscolha('RES: Notas fiscais de saída - Oficina Centro (agosto/2026)', ['NF 123 OFICINA.pdf']);
igual('palavras da escolha sem as comuns, meses e números', pal, ['OFICINA', 'CENTRO']);
const mob = { id: 'm', nome: 'A7 MOBILE' }, com = { id: 'c', nome: 'A7 COMERCIO DE VEICULOS' };
const esc = [{ remetente: 'a7@x.com', clienteId: 'm', palavras: ['OFICINA', 'CENTRO'] }, { remetente: 'a7@x.com', clienteId: 'c', palavras: ['LOJA', 'MATRIZ'] }];
igual('assunto parecido com uma escolha antiga decide', (r.desempatarPeloAprendido([com, mob], 'a7@x.com', ['OFICINA', 'CENTRO', 'SETEMBRO'], esc) || {}).id, 'm');
igual('assunto que não lembra nenhuma escolha não decide', r.desempatarPeloAprendido([com, mob], 'a7@x.com', ['OUTRA', 'COISA'], esc), null);
igual('outro remetente não usa a escolha', r.desempatarPeloAprendido([com, mob], 'outro@x.com', ['OFICINA', 'CENTRO'], esc), null);
const sempre = [{ remetente: 'b@x.com', clienteId: 'm', palavras: ['X1'] }, { remetente: 'b@x.com', clienteId: 'm', palavras: ['Y2'] }];
igual('remetente que sempre foi pra mesma empresa: ela', (r.desempatarPeloAprendido([com, mob], 'b@x.com', ['NADA'], sempre) || {}).id, 'm');
igual('a mesma escolha não se repete na lista', r.juntarEscolha(esc, { remetente: 'a7@x.com', clienteId: 'm', palavras: ['OFICINA', 'CENTRO'] }).length, 2);

// ---------- extrato que não cobre o mês ----------
const pe = require('./periodo-extrato');
const aval = (t, c) => pe.avaliarPeriodo(pe.periodoDoTexto(t), c || '2026-08');
igual('extrato só até o dia 15', aval('SICOOB Período: 01/08/2026 a 15/08/2026'), { completo: false, de: '2026-08-01', ate: '2026-08-15', texto: 'só até 15/08' });
igual('extrato do mês inteiro', aval('PERÍODO DE 01/08/2026 ATÉ 31/08/2026').completo, true);
igual('começa no 1º dia útil (01/08 é sábado)', aval('Extrato de 03/08/2026 até 31/08/2026').completo, true);
igual('começa no meio do mês', aval('Data inicial: 10/08/2026  Data final: 31/08/2026').texto, 'só a partir de 10/08');
igual('só datas de lançamento não decidem', aval('05/08/2026 PIX 12/08/2026'), null);
igual('período de outro mês não conta', aval('Período: 01/07/2026 a 31/07/2026'), null);
const esperarExtratos = (async () => {
  const pdf = (nome, texto) => ({ filename: nome, mimeType: 'application/pdf', buffer: Buffer.from('x'), _texto: texto });
  const so15 = await r.conferirPeriodoDosExtratos([pdf('extrato sicoob.pdf', 'Extrato conta corrente SICOOB Período: 01/08/2026 a 15/08/2026')], '2026-08');
  igual('extrato só de parte do mês não conta como inteiro', [so15.inteiro, so15.incompletos.length, so15.incompletos[0].texto], [false, 1, 'só até 15/08']);
  const comComprovante = await r.conferirPeriodoDosExtratos([pdf('extrato.pdf', 'Extrato Período: 01/08/2026 a 15/08/2026'), pdf('comprovante pix.pdf', 'Comprovante de pagamento PIX')], '2026-08');
  igual('comprovante no mesmo e-mail não "completa" o extrato', comComprovante.inteiro, false);
  const semPeriodo = await r.conferirPeriodoDosExtratos([pdf('extrato agosto.pdf', 'Extrato bancário lançamentos 05/08 PIX')], '2026-08');
  igual('extrato sem período escrito conta como antes', semPeriodo.inteiro, true);
})().catch(e => { console.error(e); falhas++; });
const rc = require('./regua-cobranca');
if (rc.cobrancaDo) {
  const cob = rc.cobrancaDo({ email: 'a@x.com', nome: 'PADARIA' }, { extratoIncompleto: { texto: 'só até 15/08' } }, {}, '2026-08', Date.now());
  igual('cobrança automática diz até onde o extrato veio', /Extrato Bancário — veio só até 15\/08, falta o resto do mês/.test(cob.corpo), true);
  const vis = eh.htmlDaCobranca({ corpo: 'Olá\n\n' + cob.corpo.split('\n').filter(l => /^- /.test(l)).join('\n'), cliente: {}, competencia: '2026-08' });
  igual('e-mail HTML avisa na linha do extrato', /Chegou só até 15\/08\. Falta o resto do mês\./.test(vis.html), true);
}

// ---------- mensagem do Gmail com anexo (Disparo) ----------
const mg = require('./mensagem-gmail');
const cru = t => Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const comAnexo = cru(mg.montarMensagem({ de: 'nilma@x.com', cco: ['a@x.com', 'b@x.com'], assunto: 'Calendário de outubro', corpo: 'Olá', html: '<p>Olá</p>',
  anexos: [{ nome: 'Calendário.pdf', mime: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') }] }));
igual('disparo: Cco, multipart/mixed, anexo com nome acentuado e HTML', [
  /^Bcc: a@x.com, b@x.com$/m.test(comAnexo), /Content-Type: multipart\/mixed/.test(comAnexo),
  /Content-Disposition: attachment; filename="=\?UTF-8\?B\?/.test(comAnexo), /Content-Type: text\/html/.test(comAnexo),
  comAnexo.includes(Buffer.from('%PDF-1.4 teste').toString('base64')),
], [true, true, true, true, true]);
igual('sem anexo continua sem multipart/mixed', /multipart\/mixed/.test(cru(mg.montarMensagem({ de: 'n@x.com', assunto: 'Oi', corpo: 'x' }))), false);
const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pronto = mg.prepararHtmlPronto('<html><body onload="x()"><h1>Aviso</h1><img src="data:image/png;base64,' + png1x1 + '"><img src="https://x.com/a.png"><script>alert(1)</script></body></html>');
igual('HTML pronto: sem script/onload, imagem data: vira cid, link externo fica', [
  /<script/i.test(pronto.html), /onload/i.test(pronto.html), /src="cid:img-1"/.test(pronto.html), /src="https:\/\/x\.com\/a\.png"/.test(pronto.html),
  pronto.imagens.length, pronto.imagens[0].mime,
], [false, false, true, true, 1, 'image/png']);
const comFigura = cru(mg.montarMensagem({ de: 'n@x.com', assunto: 'A', corpo: 'a', html: pronto.html, imagens: pronto.imagens }));
igual('HTML pronto: imagem vai embutida (multipart/related, Content-ID)', [/multipart\/related/.test(comFigura), /Content-ID: <img-1>/.test(comFigura)], [true, true]);
const disp = eh.htmlDoDisparo({ assunto: 'Aviso <importante>', corpo: 'Olá\n\nSegue.', anexo: { nome: 'a.pdf', tamanho: 348000 } });
igual('HTML do disparo: título escapado, arquivo e tamanho', [/Aviso &lt;importante&gt;/.test(disp.html), /a\.pdf/.test(disp.html), /340 KB/.test(disp.html)], [true, true, true]);

igual('prazo: no futuro', eh.textoDoPrazo('2026-08', 22, new Date(2026, 8, 19)).texto, 'Prazo: até 22/09 (faltam 3 dias)');
igual('prazo: sem dia limite não aparece', eh.textoDoPrazo('2026-08', null), null);

// ---------- lembretes do escritório ----------
const lb = require('./lembretes');
const semFeriado = new Set();
const comFeriado = new Set(['2026-09-07']);
igual('dia útil comum', lb.ehDiaUtil(new Date(2026, 8, 10), semFeriado), true);
igual('sábado não é dia útil', lb.ehDiaUtil(new Date(2026, 8, 5), semFeriado), false);
igual('feriado não é dia útil', lb.ehDiaUtil(new Date(2026, 8, 7), comFeriado), false);
igual('dia 10 (quinta) sai no próprio dia', lb.diaDoAviso(2026, 8, 10, semFeriado), '2026-09-10');
igual('dia 5 (sábado) escorrega pra segunda', lb.diaDoAviso(2026, 8, 5, semFeriado), '2026-09-07');
igual('dia 5 com a segunda feriado vai pra terça', lb.diaDoAviso(2026, 8, 5, comFeriado), '2026-09-08');
const lembretes = [{ texto: 'GFIP', dia: 5, quem: 'contabil' }, { texto: 'Boletos', dia: 25 }, { texto: 'sem dia' }];
igual('só o que cai hoje', lb.lembretesDeHoje(lembretes, new Date(2026, 8, 7), semFeriado).map(l => l.texto), ['GFIP']);
igual('dia sem lembrete devolve vazio', lb.lembretesDeHoje(lembretes, new Date(2026, 8, 10), semFeriado), []);

// ---------- recado da página do cliente ----------
const pp = require('./pedidos-do-portal');
const solic = pp.solicitacaoDoPedido(
  { assunto: 'segunda-via', texto: 'Perdi a guia do DAS de agosto' },
  { id: 'c1', nome: 'PADARIA SAO JORGE LTDA', nomeFantasia: 'Padaria São Jorge' },
  new Date('2026-09-20T12:00:00Z'));
igual('recado vira solicitação com nome e texto', [solic.tipo, solic.status, solic.clienteId, solic.descricao],
  ['documento', 'pendente', 'c1', 'Segunda via de guia — Padaria São Jorge: Perdi a guia do DAS de agosto']);
igual('assunto desconhecido cai em "outro"', pp.solicitacaoDoPedido({ assunto: 'xxx', texto: 'oi' }, { nome: 'X' }).tipo, 'outro');
igual('texto comprido é cortado em 400', pp.solicitacaoDoPedido({ assunto: 'duvida', texto: 'a'.repeat(500) }, { nome: 'X' }).descricao.length,
  'Dúvida do cliente — X: '.length + 400);

// ---------- certidão, procuração e certificado vencendo ----------
const pv = require('./papeis-vencendo');
const hojePv = new Date(2026, 8, 20);            // 20/09/2026
igual('dias até uma data futura', pv.diasAte('2026-10-05', hojePv), 15);
igual('data passada dá negativo', pv.diasAte('2026-09-18', hojePv), -2);
igual('data inválida não conta', pv.diasAte('', hojePv), null);
const clientesPv = [
  { nome: 'PADARIA', papeis: [{ tipo: 'certificado', vence: '2026-10-20' }, { tipo: 'cnd-federal', vence: '2026-10-05' }, { tipo: 'outro', vence: '2026-09-25' }] },
  { nome: 'MERCEARIA', papeis: [{ tipo: 'procuracao', vence: '2026-09-19' }] },
  { nome: 'INATIVO', ativo: false, papeis: [{ tipo: 'fgts', vence: '2026-09-23' }] },
  { nome: 'SEM PAPEL' }
];
const avisar = pv.papeisParaAvisar(clientesPv, hojePv);
igual('avisa só nos marcos (30, 15, 3) e no dia seguinte ao vencimento',
  avisar.map(x => x.nome + '/' + x.dias), ['Procuração eletrônica/-1', 'CND Federal/15', 'Certificado digital/30']);
igual('cliente inativo fica de fora', avisar.some(x => x.cliente === 'INATIVO'), false);
igual('dia sem marco não avisa nada', pv.papeisParaAvisar(clientesPv, new Date(2026, 8, 21)), []);
igual('texto de um documento só', pv.textoDoAviso([{ nome: 'CND Federal', cliente: 'PADARIA', dias: 15 }]),
  { titulo: 'Documento vencendo', corpo: 'CND Federal de PADARIA vence em 15 dias' });
igual('texto de vários', pv.textoDoAviso(avisar).titulo, '3 documentos vencendo');

// ---------- planilha do backup: separar código do nome ----------
const bp = require('./backup-planilha');
igual('código colado no nome', bp.separarCodigo('207 - BMJ SOM AUTOMOTIVO LTDA'), { codigo: '207', nome: 'BMJ SOM AUTOMOTIVO LTDA' });
igual('sem código no nome, usa o solto', bp.separarCodigo('GAS TAIOBEIRAS LTDA', '600'), { codigo: '600', nome: 'GAS TAIOBEIRAS LTDA' });
igual('sem código nenhum', bp.separarCodigo('ALVES CRUZ ACADEMIA'), { codigo: '', nome: 'ALVES CRUZ ACADEMIA' });
igual('nome que começa com número mas não é código (sem traço)', bp.separarCodigo('2894'), { codigo: '', nome: '2894' });

const clientesJson = {
  a: { dados: { nome: '207 - BMJ SOM AUTOMOTIVO LTDA', ativo: true, entrega: true, documento: '12.673.416/0001-50', receita: { situacao: 'ATIVA', simples: true } } },
  b: { dados: { nome: 'ALVES CRUZ ACADEMIA', codigoOrigem: '600', ativo: false } },
};
const abaClientes = bp.montarAba_Clientes(clientesJson);
igual('aba de clientes vem ordenada por nome', abaClientes.map(l => l['Cliente']), ['ALVES CRUZ ACADEMIA', 'BMJ SOM AUTOMOTIVO LTDA']);
igual('código separado do nome na planilha', abaClientes[1]['Código'], '207');
igual('inativo aparece como Não', abaClientes[0]['Ativo'], 'Não');

const entregasJson = {
  x: { dados: { clienteNome: '10 - PADARIA', criadoEm: '2026-09-10T10:00:00Z', itens: [{ tipo: 'DAS', valor: 100.5 }, { tipo: 'FGTS', valor: 20 }], status: 'confirmada' } },
  y: { dados: { clienteNome: '5 - ACADEMIA', criadoEm: '2026-09-09T10:00:00Z', itens: [{ tipo: 'Honorário', valor: null }], status: 'pendente' } },
};
const abaEntregas = bp.montarAba_Entregas(entregasJson);
igual('entregas ordenadas por cliente', abaEntregas.map(l => l['Cliente']), ['ACADEMIA', 'PADARIA']);
igual('soma o valor dos itens', abaEntregas[1]['Valor total'], 120.5);
igual('item sem valor não quebra a soma', abaEntregas[0]['Valor total'], '');
igual('itens viram texto legível', abaEntregas[1]['Itens'], 'DAS (R$ 100,50), FGTS (R$ 20,00)');


// ---------- arquivamento: leitura do manifesto da rotina ----------
const arq = require('./arquivo-manifesto');
// o manifesto grava a barra do Windows sem escapar: JSON inválido de verdade
const linhaCrua = '{"nome_original":"EXTRATO BNB JUN2026.pdf","destino_final":"G:\\Meu Drive\\2026\\58 - TORNEARIA VOLPONI LTDA\\CONTÁBIL\\EXTRATOS\\2026\\06\\\\","nome_final":"06-2026.pdf","id_execucao":"EXEC-20260923-171757"}';
igual('linha com barra sem escape ainda é lida', !!arq.lerLinhaJson(linhaCrua), true);
igual('linha vazia ou quebrada vira null', [arq.lerLinhaJson(''), arq.lerLinhaJson('{quebrado')], [null, null]);
igual('destino separa código, cliente e subpasta', arq.destinoPorPartes('G:/Meu Drive/2026/58 - TORNEARIA VOLPONI LTDA/CONTÁBIL/EXTRATOS/2026/06/'),
  { codigo: '58', cliente: 'TORNEARIA VOLPONI LTDA', subpasta: 'CONTÁBIL/EXTRATOS/2026/06' });
igual('destino sem pasta de cliente não inventa código', arq.destinoPorPartes('G:/Meu Drive/Claudio Secretario/NÃO IDENTIFICADOS/x').codigo, null);
const grupos = arq.agruparManifesto(linhaCrua + '\n\n' + linhaCrua.replace('JUN2026', 'JUL2026'));
igual('manifesto agrupa por execução', grupos.get('EXEC-20260923-171757').length, 2);
const rel = arq.lerRelatorio('ARQUIVADO: a.pdf -> x\nDUPLICADO: b.xml -> y\nDUPLICADO: c.xml -> y\nNAO_IDENTIFICADO: video.mp4 -> (E101 · CLIENTE_NAO_LOCALIZADO)\nlinha solta: não conta\n');
igual('relatório conta só as linhas CATEGORIA:', rel.contagens, { ARQUIVADO: 1, DUPLICADO: 2, NAO_IDENTIFICADO: 1 });
igual('não identificado traz nome e motivo', rel.naoIdentificados, [{ nome: 'video.mp4', motivo: 'E101 · CLIENTE_NAO_LOCALIZADO' }]);
igual('modo sai do prefixo do id', ['EXEC-20260924-130945', 'SIM-20260901-094722', 'BACKFILL-20260827-181438', 'X'].map(arq.modoDoId),
  ['PRODUCAO', 'SIMULACAO', 'CARGA_INICIAL', null]);
igual('reprocessamento também tem data', !!arq.dataDoId('EXEC-20260902-132202-REPROC1'), true);
const ex = arq.montarExecucao('EXEC-20260923-171757', grupos.get('EXEC-20260923-171757'), { naoIdentificados: 0, alerta: 'NENHUM' }, 'DUPLICADO: z');
igual('resumo da execução', [ex.resumo.arquivados, ex.resumo.codigos, ex.resumo.duplicados, ex.resumo.alerta], [2, ['58'], 1, null]);


// ---------- mapa do Drive: status pelo que está na pasta ----------
const di = require('./drive-indice');
const itensPasta = [
  { i: 'c', n: 'CONTÁBIL', p: 'R', t: 'd' }, { i: 'e', n: 'EXTRATOS', p: 'c', t: 'd' }, { i: 'a', n: '2026', p: 'e', t: 'd' },
  { i: 'm', n: '06', p: 'a', t: 'd' }, { i: 'b', n: 'BANCA\u0301RIOS', p: 'm', t: 'd' }, { i: 'bb', n: 'BNB', p: 'b', t: 'd' },
  { i: 'f1', n: '06-2026.pdf', p: 'bb', t: 'f', s: 10 }, { i: 'q', n: 'MAQUININHAS', p: 'm', t: 'd' }, { i: 'f2', n: 'cielo.pdf', p: 'q', t: 'f' },
  { i: 'k', n: 'COMPROVANTES', p: 'm', t: 'd' }, { i: 'f3', n: 'pix.pdf', p: 'k', t: 'f' },
  { i: 'ap', n: 'APLICAÇÕES', p: 'm', t: 'd' }, { i: 'vazia', n: 'SICOOB', p: 'ap', t: 'd' },
  { i: 'x', n: '13', p: 'a', t: 'd' }, { i: 'xb', n: 'BANCÁRIOS', p: 'x', t: 'd' }, { i: 'f4', n: 'mes13.pdf', p: 'xb', t: 'f' },
  { i: 'fi', n: 'FISCAL', p: 'R', t: 'd' }, { i: 'f5', n: 'nota.xml', p: 'fi', t: 'f' },
];
const achadosPasta = di.documentosNaPasta(itensPasta, 'R');
igual('pasta BANCÁRIOS do mês vira extrato (acento em qualquer forma)', (achadosPasta.get('2026-06|extrato') || []).map(a => a.id), ['f1']);
igual('COMPROVANTES vira comprovante', (achadosPasta.get('2026-06|comprovante') || []).map(a => a.id), ['f3']);
igual('pasta vazia não prova nada', achadosPasta.has('2026-06|aplicacao'), false);
igual('maquininha, mês inválido e FISCAL ficam de fora', Array.from(achadosPasta.keys()).sort(), ['2026-06|comprovante', '2026-06|extrato']);
igual('código e nome saem do nome da pasta', di.codigoDaPasta('58 - TORNEARIA VOLPONI LTDA'), { codigo: '58', nome: 'TORNEARIA VOLPONI LTDA' });
igual('pasta sem código', di.codigoDaPasta('MODELOS').codigo, null);
igual('totais contam arquivos e pastas', [di.totais(itensPasta).arquivos, di.totais(itensPasta).pastas], [5, 13]);
igual('o extrato em SUBSTITUÍDOS não prova o mês (06/11/2026)',
  (di.documentosNaPasta([...itensPasta, { i: 'sb', n: 'SUBSTITUÍDOS', p: 'bb', t: 'd' }, { i: 'f9', n: '06-2026.pdf', p: 'sb', t: 'f' }], 'R').get('2026-06|extrato') || []).map(a => a.id), ['f1']);
// o seletor de ano (12/11/2026): as pastas de ano da raiz do Meu Drive, sem o ano corrente, do mais novo ao mais velho
igual('pastas de ano: só pastas com 4 dígitos, sem o corrente e sem repetir', di.pastasDeAno([
  { i: 'p24', n: '2024', t: 'd' }, { i: 'p26', n: '2026', t: 'd' }, { i: 'p25', n: ' 2025 ', t: 'd' }, { i: 'x', n: 'Claudio Secretario', t: 'd' },
  { i: 'arq', n: '2023', t: 'f' }, { i: 'p25b', n: '2025', t: 'd' }, { i: 'p202', n: '202', t: 'd' },
], '2026'), [{ nome: '2025', id: 'p25' }, { nome: '2024', id: 'p24' }]);

// ---------- texto completo do e-mail (painel da tela do Robô) ----------
const lg = require('./leituras-gmail');
const b64url = t => Buffer.from(t).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
igual('texto: prefere o text/plain e junta linhas em branco demais', lg.textoDoEmail({ mimeType: 'multipart/mixed', parts: [
  { mimeType: 'multipart/alternative', parts: [
    { mimeType: 'text/plain', body: { data: b64url('Olá Nilma,\r\nsegue o extrato.\r\n\r\n\r\n\r\nAbraço') } },
    { mimeType: 'text/html', body: { data: b64url('<p>outro</p>') } }] },
  { mimeType: 'text/plain', filename: 'nota.txt', body: { attachmentId: 'a1' } }] }), 'Olá Nilma,\nsegue o extrato.\n\nAbraço');
igual('texto: e-mail em ISO-8859-1 não vira ???', lg.textoDoEmail({ mimeType: 'text/plain',
  headers: [{ name: 'Content-Type', value: 'text/plain; charset=iso-8859-1' }],
  body: { data: Buffer.from('Não, ação', 'latin1').toString('base64') } }), 'Não, ação');
const embaralhar = t => new TextDecoder('windows-1252').decode(Buffer.from(t, 'utf8'));
igual('texto: e-mail que diz ISO-8859-1 e manda UTF-8', lg.textoDoEmail({ mimeType: 'text/plain',
  headers: [{ name: 'Content-Type', value: 'text/plain; charset=iso-8859-1' }],
  body: { data: Buffer.from('notas de SAÍDA da A7 COMÉRCIO no mês', 'utf8').toString('base64') } }), 'notas de SAÍDA da A7 COMÉRCIO no mês');
igual('texto: acentos que já chegam embaralhados são consertados', lg.textoDoEmail({ mimeType: 'text/plain',
  body: { data: b64url(embaralhar('A7 COMÉRCIO DE VEÍCULOS, SAÍDA, mês, agradeço — “ok”')) } }), 'A7 COMÉRCIO DE VEÍCULOS, SAÍDA, mês, agradeço — “ok”');
const ac = require('./acentos');
igual('acentos: texto certo não muda', ac.consertarAcentos('Ação, É“x” Â, 100 °C, São Paulo'), 'Ação, É“x” Â, 100 °C, São Paulo');
igual('acentos: trecho do Gmail embaralhado', r.decodificarEntidades(embaralhar('Segue as notas de SAÍDA &amp; ENTRADA')), 'Segue as notas de SAÍDA & ENTRADA');
igual('texto: só HTML sai sem as marcas', lg.htmlParaTexto('<head><style>p{}</style></head><p>Bom dia&nbsp;&amp; tudo</p><div>Linha 2<br>Linha 3</div><ul><li>um</li></ul>&#233;'),
  'Bom dia & tudo\nLinha 2\nLinha 3\n• um\né');

// ---------- uso do banco (cartão Saúde do sistema) ----------
const ub = require('./uso-banco');
igual('cota do dia começa à meia-noite da Califórnia (verão: 7h UTC)', ub.inicioDoDiaDaCota(new Date('2026-09-26T03:30:00Z')).toISOString(), '2026-09-25T07:00:00.000Z');
igual('cota do dia no inverno (8h UTC)', ub.inicioDoDiaDaCota(new Date('2026-12-10T20:00:00Z')).toISOString(), '2026-12-10T08:00:00.000Z');
igual('soma os pontos de todas as séries', ub.somaDaResposta({ timeSeries: [{ points: [{ value: { int64Value: '1200' } }, { value: { int64Value: '34' } }] }, { points: [{ value: { int64Value: '6' } }] }] }), 1240);
igual('sem série é zero', ub.somaDaResposta({}), 0);

// ---------- parcela paga pelo comprovante (parcela-paga.js) ----------
const ppg = require('./parcela-paga');
const guiaPgfn = ppg.lerGuiaPaga('Comprovante de Pagamento\nDocumento de Arrecadação de Receitas Federais - DARF\nPGFN - Transação Excepcional\nParcela 012/060\nNúmero da negociação: 1234567\nValor total: R$ 1.302,45\nData do pagamento: 25/09/2026\nAutenticação: ABC123');
igual('comprovante PGFN: órgão, valor, parcela, nº e data', guiaPgfn, { orgao: 'pgfn', valor: 1302.45, parcela: 12, de: 60, numero: '1234567', pagoEm: '2026-09-25', soPeloNumero: false });
igual('DAS do parcelamento do Simples', ppg.lerGuiaPaga('COMPROVANTE DE PAGAMENTO\nDocumento de Arrecadação do Simples Nacional\nParcelamento do Simples Nacional - Parcela 6\nValor pago R$ 480,00\nPago em 29/09/2026').orgao, 'simples');
igual('DAS do mês não é parcela', ppg.lerGuiaPaga('COMPROVANTE DE PAGAMENTO\nDocumento de Arrecadação do Simples Nacional\nPeríodo de apuração 08/2026\nValor pago R$ 2.130,00\nPago em 20/09/2026'), null);
igual('guia a pagar (sem pagamento) não conta', ppg.lerGuiaPaga('DARF\nPGFN Parcela 13/60\nVencimento 30/10/2026 Valor R$ 1.300,00'), null);
const guiaRef = ppg.lerGuiaPaga('BANCO DO BRASIL\nCOMPROVANTE DE PAGAMENTO DE DARF\nCODIGO DA RECEITA 1124\nNUMERO DE REFERENCIA 10010.000123/2026\nVALOR TOTAL 350,90\nDATA DO PAGAMENTO 18/09/2026');
igual('DARF de banco sem "parcela" vale só pelo nº de referência', [guiaRef.soPeloNumero, guiaRef.numero, guiaRef.valor], [true, '10010.000123/2026', 350.9]);
const parcsT = [
  { id: 'p1', orgao: 'pgfn', numero: '1234567', parcelas: 60, primeira: '2025-10', valorParcela: 1234.56, pagas: { '2025-10': {}, '2025-11': {} } },
  { id: 'p2', orgao: 'simples', parcelas: 12, primeira: '2026-04', valorParcela: 480, pagas: { '2026-04': {}, '2026-05': {}, '2026-06': {}, '2026-07': {}, '2026-08': {} } },
  { id: 'p3', orgao: 'receita', numero: '10010.000123/2026', parcelas: 24, primeira: '2026-09', valorParcela: 350.9, pagas: {} },
];
const achou = (g, dia) => { const r = ppg.acharParcela(parcsT, g, dia); return r.p ? r.p.id + ' ' + r.ym : r.motivo; };
igual('PGFN: a parcela 12 escrita no comprovante', achou(guiaPgfn, '2026-09-26'), 'p1 2026-09');
igual('Simples sem nº da parcela: a mais antiga em aberto até o mês pago', achou({ orgao: 'simples', valor: 480, pagoEm: '2026-09-29' }, '2026-09-29'), 'p2 2026-09');
igual('DARF de banco acha pelo nº de referência', achou(guiaRef, '2026-09-18'), 'p3 2026-09');
igual('nº de referência de outro débito não marca', achou({ orgao: 'receita', numero: '99999999', soPeloNumero: true, valor: 350.9 }, '2026-09-18'), 'o nº de referência 99999999 não é de nenhum parcelamento cadastrado');
igual('valor muito diferente não marca', achou({ orgao: 'simples', valor: 1500, pagoEm: '2026-09-29' }, '2026-09-29'), 'valor 1500.00 não bate com nenhum parcelamento de simples');
igual('parcela já paga não marca de novo', achou({ orgao: 'pgfn', valor: 1234.56, parcela: 2, de: 60 }, '2026-09-26'), 'a parcela de 2025-11 já estava paga');
igual('dois parecidos: não marca', ppg.acharParcela([{ orgao: 'pgfn', parcelas: 10, primeira: '2026-01', valorParcela: 500, pagas: {} }, { orgao: 'pgfn', parcelas: 10, primeira: '2026-01', valorParcela: 510, pagas: {} }], { orgao: 'pgfn', valor: 505 }, '2026-09-10').motivo, 'mais de um parcelamento de pgfn com valor parecido');
igual('situação: atrasadas e a do mês', (() => { const x = ppg.situacao(parcsT[0], '2026-09-26'); return [x.nPagas, x.atrasadas.length, x.atual, x.vencAtual]; })(), [2, 9, '2026-09', '2026-09-30']);
igual('vencimento no último dia útil (fim de semana volta pra sexta)', ppg.vencimentoDe({ dia: 'util' }, '2026-05'), '2026-05-29');
igual('vencimento em dia fixo', ppg.vencimentoDe({ dia: 20 }, '2026-02'), '2026-02-20');

// ---------- aviso diário de atrasados (avisos-atrasados.js) ----------
const aa = require('./avisos-atrasados');
const clientesAA = new Map([['c1', { id: 'c1', nome: 'PADARIA SAO JOSE LTDA', nomeFantasia: 'Padaria São José', responsavelUid: 'ana' }], ['c2', { id: 'c2', nome: 'A7 MOBILE LTDA', responsavelUid: 'nilma' }]]);
const montado = aa.montarAvisos({
  tarefas: [
    { titulo: 'DCTFWeb', prazo: '2026-09-25', responsavelUid: 'ana', aberta: true },
    { titulo: 'Certidão', prazo: '2026-09-28', responsavelUid: 'nilma', aberta: true },
    { titulo: 'Sem dono', prazo: '2026-09-01', aberta: true },
    { titulo: 'Futura', prazo: '2026-10-10', responsavelUid: 'nilma', aberta: true },
  ],
  parcelamentos: [
    Object.assign({ clienteId: 'c1', aberto: true, status: 'ativo' }, parcsT[0]),
    { clienteId: 'c2', orgao: 'receita', parcelas: 5, primeira: '2026-09', valorParcela: 100, dia: 30, pagas: {}, aberto: true, status: 'ativo' },
  ],
  clientes: clientesAA,
  ausencias: new Map([['ana', { de: '2026-09-20', ate: '2026-10-05', cobreUid: 'carlos' }]]),
  admins: ['nilma'], hoje: '2026-09-28',
});
const comoLista = m => Object.fromEntries([...m.porPessoa].map(([u, x]) => [u, x && Object.fromEntries(Object.entries(x).filter(([, v]) => v.length))]));
igual('aviso: férias vão pra quem cobre, sem dono vai pro admin, parcela perto do vencimento', comoLista(montado), {
  carlos: { tarefasAtrasadas: ['DCTFWeb'], parcelasAtrasadas: ['PGFN de Padaria São José'] },
  nilma: { tarefasAtrasadas: ['Sem dono'], tarefasHoje: ['Certidão'], parcelasPerto: ['Receita de A7 MOBILE LTDA'] },
});
igual('aviso: resumo do escritório', montado.escritorio, { tarefas: 2, parcelamentos: 1 });
igual('aviso: texto do admin com o escritório', aa.textoDoAviso(montado.porPessoa.get('nilma'), montado.escritorio), {
  titulo: 'Você tem coisa atrasada', corpo: 'Parcela vence esta semana: Receita de A7 MOBILE LTDA · 1 tarefa atrasada (Sem dono) · 1 tarefa vence hoje · Escritório: 2 tarefas atrasadas, 1 parcelamento atrasado',
  link: 'https://nilmaadvancedsystems.github.io/Entregas/tarefas.html#minhas' });
igual('aviso: nada pra dizer', aa.textoDoAviso(null, { tarefas: 0, parcelamentos: 0 }), null);

// ---------- responder e-mail pela tela (responder-gmail.js) ----------
const rgm = require('./responder-gmail');
const hdr = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
const resp1 = rgm.montarResposta({
  headers: hdr({ From: 'José da Padaria <padaria@x.com>', To: 'nilmacontabilidade@gmail.com, socio@padaria.com', Cc: 'contador@y.com', Subject: 'Extrato de setembro', 'Message-ID': '<abc@mail.x.com>', References: '<zzz@mail.x.com>' }),
  textoOriginal: 'Bom dia,\nsegue o extrato.', corpo: 'Recebido, obrigado!', todos: true, caixa: 'nilmacontabilidade@gmail.com', dataOriginal: Date.UTC(2026, 8, 25, 13, 5),
});
igual('resposta: para quem mandou, Cc dos outros sem a própria caixa', [resp1.para, resp1.cc], ['padaria@x.com', ['socio@padaria.com', 'contador@y.com']]);
igual('resposta: "Re:" e na mesma conversa', [resp1.assunto, resp1.cabecalhos], ['Re: Extrato de setembro', ['In-Reply-To: <abc@mail.x.com>', 'References: <zzz@mail.x.com> <abc@mail.x.com>']]);
igual('resposta: o original citado embaixo', resp1.corpo, 'Recebido, obrigado!\n\nEm 25/09/2026, 10:05, José da Padaria <padaria@x.com> escreveu:\n> Bom dia,\n> segue o extrato.');
igual('resposta: HTML escapa o texto e recolhe a citação', /gmail_quote/.test(resp1.html) && !/<script/.test(rgm.montarResposta({ headers: hdr({ From: 'a@b.com', Subject: 'x' }), textoOriginal: '<script>', corpo: '<b>oi</b>', caixa: 'c@d.com' }).html), true);
const resp2 = rgm.montarResposta({ headers: hdr({ From: 'a@b.com', 'Reply-To': 'financeiro@b.com', To: 'nilmacontabilidade@gmail.com', Subject: 'RE: Boleto' }), textoOriginal: '', corpo: 'ok', todos: false, caixa: 'nilmacontabilidade@gmail.com' });
igual('resposta: Reply-To manda; "RE:" não vira "Re: RE:"; sem todos, sem Cc', [resp2.para, resp2.assunto, resp2.cc], ['financeiro@b.com', 'RE: Boleto', []]);
igual('resposta a e-mail que a própria caixa mandou vai pro destinatário', rgm.montarResposta({ headers: hdr({ From: 'Nilma <nilmacontabilidade@gmail.com>', To: 'cliente@z.com', Subject: 'Cobrança' }), corpo: 'x', caixa: 'nilmacontabilidade@gmail.com' }).para, 'cliente@z.com');
const mimeResp = Buffer.from(require('./mensagem-gmail').montarMensagem({ de: 'n@x.com', para: 'a@b.com', cc: ['c@d.com'], assunto: 'Re: x', corpo: 'oi', cabecalhos: ['In-Reply-To: <abc@x>', 'Bad\r\nInjected: y'] }).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
igual('mensagem: Cc e In-Reply-To entram; cabeçalho com quebra de linha não', [/\r\nCc: c@d.com\r\n/.test(mimeResp), /In-Reply-To: <abc@x>/.test(mimeResp), /Injected/.test(mimeResp)], [true, true, false]);

// ---------- fotos dos remetentes e troca do token ----------
const fr = require('./fotos-remetentes');
igual('fotos: e-mail em minúsculas, tamanho 96, foto padrão fica de fora', fr.fotosDasPessoas([
  { emailAddresses: [{ value: 'Jose@Padaria.com' }], photos: [{ url: 'https://lh3.googleusercontent.com/a/abc=s100', default: false }] },
  { emailAddresses: [{ value: 'semfoto@x.com' }], photos: [{ url: 'https://lh3.googleusercontent.com/a/def=s100', default: true }] },
  { emailAddresses: [{ value: 'b@x.com' }, { value: 'c@x.com' }], photos: [{ url: 'https://lh3.googleusercontent.com/a/ghi' }] },
]), { 'jose@padaria.com': 'https://lh3.googleusercontent.com/a/abc=s96-c', 'b@x.com': 'https://lh3.googleusercontent.com/a/ghi=s96-c', 'c@x.com': 'https://lh3.googleusercontent.com/a/ghi=s96-c' });
igual('fotos: todos os e-mails das pessoas, com ou sem foto', fr.emailsDasPessoas([{ emailAddresses: [{ value: ' A@B.com ' }] }, { photos: [] }, { emailAddresses: [{ value: 'c@d.com.br' }] }]), ['a@b.com', 'c@d.com.br']);
igual('fotos: domínio do e-mail e e-mail pessoal fica sem logo', [fr.dominioDe('Jose@Padaria.COM.br'), fr.dominioDe('sem-arroba'), fr.PESSOAIS.has('hotmail.com'), fr.PESSOAIS.has('padaria.com.br')], ['padaria.com.br', '', true, false]);
igual('fotos: Gravatar pelo md5 do e-mail em minúsculas', fr.urlGravatar(' A@B.com '), fr.urlGravatar('a@b.com'));
const tn = require('./token-novo');
igual('token novo: troca quando o refresh_token ou as permissões mudam', [
  !!tn.tokenParaTrocar('{"refresh_token":"b","scope":"x y"}', '{"refresh_token":"a","scope":"x"}'),
  !!tn.tokenParaTrocar('{"refresh_token":"a","scope":"x y"}', '{"refresh_token":"a","scope":"x"}'),
  tn.tokenParaTrocar('{"refresh_token":"a","scope":"x"}', '{"refresh_token":"a","scope":"x"}'),
  tn.tokenParaTrocar('lixo', '{}'), tn.tokenParaTrocar('{"access_token":"so"}', '{}'),
], [true, true, null, null, null]);

// ---------- agência e conta do cliente, do cabeçalho do extrato (Cadastro do nads) ----------
const cb = require('./contas-bancarias');
igual('Sicoob: cooperativa e conta',
  cb.contasDoTexto('Sicoob | Internet banking\n\nEXTRATO DE CONTA CORRENTE 01/09/2026\n\nCooperativa: 3144-5 / SICOOB CREDINOR\nConta: 12.345-6 / FULANO LTDA'),
  [{ agencia: '3144-5', conta: '12.345-6' }]);
igual('BB: "Agência | Conta" com os números na linha de baixo',
  cb.contasDoTexto('Extrato Mensal / Por Período\n\nFolha 1/4\n\nAgência | Conta Total Disponível (R$)\n1234-5 | 12345-6 1.000,00'),
  [{ agencia: '1234-5', conta: '12345-6' }]);
igual('BNB: "Agência/Conta Corrente: 060 - SALINAS" não vira conta',
  cb.contasDoTexto('Extrato de Conta Corrente - no período\n\nAgência/Conta Corrente: 060 - SALINAS\n\nDetalhamento do Saldo'), []);
igual('Itaú: agência e conta na mesma linha', cb.contasDoTexto('Itaú Unibanco\nagência: 1234 conta: 12345-6\nextrato'), [{ agencia: '1234', conta: '12345-6' }]);
igual('Caixa: operação no meio', cb.contasDoTexto('CAIXA ECONÔMICA FEDERAL\nAgência: 1234 Operação: 003 Conta: 00012345-6'), [{ agencia: '1234', conta: '00012345-6' }]);
igual('Nubank sem dois-pontos', cb.contasDoTexto('Nu Pagamentos\nAgência 0001 Conta 1234567-8'), [{ agencia: '0001', conta: '1234567-8' }]);
igual('conta antes da cooperativa', cb.contasDoTexto('SICREDI\nConta: 98765-4 Cooperativa: 0101'), [{ agencia: '0101', conta: '98765-4' }]);
igual('agência e conta no miolo (PIX de outro) não contam',
  cb.contasDoTexto('SICREDI Extrato\n' + 'x'.repeat(2600) + ' AG 1234 CC 56789'), []);
igual('só a agência: não guarda', cb.contasDoTexto('Bradesco\nAgência: 1234\nSaldo'), []);
igual('mesma conta com e sem zeros à esquerda',
  cb.contasNovas({ contasBancarias: [{ banco: 'itau', agencia: '0412', conta: '0099887-7' }] }, [{ banco: 'itau', agencia: '412', conta: '99887-7' }, { banco: 'itau', agencia: '412', conta: '1111-1' }]),
  [{ banco: 'itau', agencia: '412', conta: '1111-1' }]);

// --- arquivo mandado pelo nads para o Claudio Secretario (envios-do-nads.js) ---
const en = require('./envios-do-nads');
const envioNads = { competencia: '2026-09', partes: 2, tamanho: 5, nome: 'pasta/sub/extrato.pdf' };
igual('junta os pedaços na ordem', en.montarEnvio(envioNads, [{ n: 1, dados: Buffer.from('de') }, { n: 0, dados: Buffer.from('abc') }]).buffer.toString(), 'abcde');
igual('nome sem caminho', en.montarEnvio(envioNads, [{ n: 0, dados: Buffer.from('abc') }, { n: 1, dados: Buffer.from('de') }]).nome, 'extrato.pdf');
igual('faltou pedaço', en.montarEnvio(envioNads, [{ n: 0, dados: Buffer.from('abc') }]).erro, 'faltam partes do arquivo (1 de 2)');
igual('tamanho diferente do anunciado', en.montarEnvio(envioNads, [{ n: 0, dados: Buffer.from('ab') }, { n: 1, dados: Buffer.from('de') }]).erro, 'o arquivo chegou incompleto');
igual('competência inválida', en.montarEnvio(Object.assign({}, envioNads, { competencia: '2026-13' }), []).erro, 'competência inválida');
const porCod = new Map([['58', { nome: 'TORNEARIA VOLPONI LTDA' }]]);
igual('pasta: nome do cadastro pelo código', en.nomeDaPastaDoCliente({ codigo: '58', cliente: '58 - TORNEARIA' }, porCod), 'TORNEARIA VOLPONI LTDA');
igual('pasta: o nome que veio', en.nomeDaPastaDoCliente({ codigo: '9', cliente: 'X LTDA' }, porCod), 'X LTDA');
igual('pasta: sem cliente', en.nomeDaPastaDoCliente({ codigo: '', cliente: '' }, porCod), 'Enviados pelo nads');

// --- o extrato da Importação direto na pasta do banco (19/10/2026) ---
igual('extrato: o nome da Importação', en.extratoDoNome('Extrato SICOOB 06-2026.pdf'), { banco: 'SICOOB', mes: '06', ano: '2026', ext: '.pdf' });
igual('extrato: outro arquivo não é', en.extratoDoNome('comprovante.pdf'), null);
// a pasta da empresa no mapa (itens fictícios): a do banco já existe em maio com outro nome; junho ainda não tem pasta
const itensDoMapa = [
  { i: 'c', n: 'CONTÁBIL', p: 'cli', t: 'd' }, { i: 'e', n: 'EXTRATOS', p: 'c', t: 'd' }, { i: 'a', n: '2026', p: 'e', t: 'd' },
  { i: 'm5', n: '05', p: 'a', t: 'd' }, { i: 'b5', n: 'BANCÁRIOS', p: 'm5', t: 'd' }, { i: 's5', n: 'BANCOOB', p: 'b5', t: 'd' },
];
igual('extrato: cria só o que falta, com o nome da pasta do banco que a empresa usa',
  en.caminhoDoExtratoNoIndice(itensDoMapa, 'cli', en.extratoDoNome('Extrato SICOOB 06-2026.pdf')),
  { existente: 'a', faltam: ['06', 'BANCÁRIOS', 'BANCOOB'], caminho: 'CONTÁBIL/EXTRATOS/2026/06/BANCÁRIOS/BANCOOB', nomeFinal: '06-2026.pdf' });
igual('extrato: a pasta do mês e do banco já existem',
  en.caminhoDoExtratoNoIndice(itensDoMapa, 'cli', en.extratoDoNome('Extrato SICOOB 05-2026.pdf')).faltam, []);
igual('extrato: banco que a empresa ainda não tem vira o nome do arquivo',
  en.caminhoDoExtratoNoIndice(itensDoMapa, 'cli', en.extratoDoNome('Extrato NUBANK 05-2026.ofx')),
  { existente: 'b5', faltam: ['NUBANK'], caminho: 'CONTÁBIL/EXTRATOS/2026/05/BANCÁRIOS/NUBANK', nomeFinal: '05-2026.ofx' });

// --- o comprovante da aba Comprovantes direto na pasta do banco, igual ao extrato (27/10/2026) ---
igual('comprovante: o nome da aba Comprovantes', en.comprovanteDoNome('Comprovante BANCO DO BRASIL 02-2026 - TITULOS PAGOS FEV2026 (2).pdf'),
  { banco: 'BANCO DO BRASIL', mes: '02', ano: '2026', ext: '.pdf', original: 'TITULOS PAGOS FEV2026 (2).pdf' });
igual('comprovante: o extrato não é comprovante', en.comprovanteDoNome('Extrato SICOOB 06-2026.pdf'), null);
igual('comprovante: o nome solto não é', en.comprovanteDoNome('COMPROVANTE - SICOOB - pix.pdf'), null);
igual('comprovante: na pasta COMPROVANTES do mês, com o nome da pasta do banco que a empresa usa, e o nome original',
  en.caminhoDoExtratoNoIndice(itensDoMapa, 'cli', en.comprovanteDoNome('Comprovante SICOOB 05-2026 - pix fornecedor.pdf'), 'COMPROVANTES', 'pix fornecedor.pdf'),
  { existente: 'm5', faltam: ['COMPROVANTES', 'BANCOOB'], caminho: 'CONTÁBIL/EXTRATOS/2026/05/COMPROVANTES/BANCOOB', nomeFinal: 'pix fornecedor.pdf' });

// --- a guia DAS/DAE na Área do Cliente (envios-do-nads.js) ---
const envioGuia = { guia: 'DAS', vencimento: '20/10/2026', valor: '1.234,56', codigo: 58, competencia: '2026-09', criadoPorUid: 'u1' };
igual('guia do envio: conferida', en.guiaDoEnvio(envioGuia), { tipo: 'DAS', vencimento: '20/10/2026', valor: 1234.56, valorTexto: '1.234,56', codigo: '58', competencia: '2026-09' });
igual('guia do envio: sem os dados é arquivo comum', en.guiaDoEnvio({ codigo: 58, competencia: '2026-09' }), null);
igual('guia do envio: tipo estranho', en.guiaDoEnvio(Object.assign({}, envioGuia, { guia: 'GPS' })), null);
igual('guia do envio: data impossível', en.guiaDoEnvio(Object.assign({}, envioGuia, { vencimento: '31/02/2026' })), null);
igual('guia do envio: valor que não é dinheiro', en.guiaDoEnvio(Object.assign({}, envioGuia, { valor: 'abc' })), null);
igual('guia do envio: sem código da empresa', en.guiaDoEnvio(Object.assign({}, envioGuia, { codigo: '' })), null);
igual('guia do envio: o cliente do link não põe guia', en.guiaDoEnvio(Object.assign({}, envioGuia, { criadoPorUid: 'mandei' })), null);
igual('id da guia: tipo, mês e código', en.idDaGuiaDoCliente(en.guiaDoEnvio(Object.assign({}, envioGuia, { guia: 'DAE' }))), 'dae-2026-09-58');
igual('doc da guia: lista branca e situação',
  en.docDaGuiaDoCliente(en.guiaDoEnvio(envioGuia), new Date(2026, 9, 16)),
  { id: 'das-2026-09-58', tipo: 'DAS', competencia: '2026-09', vencimento: '20/10/2026', valor: 1234.56, situacao: 'a vencer', temPdf: true });
igual('doc da guia: vencida', en.docDaGuiaDoCliente(en.guiaDoEnvio(envioGuia), new Date(2026, 9, 21)).situacao, 'vencida');
const pdfGrande = Buffer.alloc(1000, 7);
const peds = en.pedacosDoPdfCliente(pdfGrande, 400);
igual('pedaços do PDF: de 0, com o total', peds.map(p => [p.n, p.total]), [[0, 4], [1, 4], [2, 4], [3, 4]]);
igual('pedaços do PDF: juntos voltam o arquivo', Buffer.from(peds.map(p => p.base64).join(''), 'base64').equals(pdfGrande), true);
igual('pedaços do PDF: pequeno é um só', en.pedacosDoPdfCliente(Buffer.from('abc')).length, 1);

// --- onde o envio foi parar depois do arquivamento (envios-do-nads.js) ---
const run1 = { id: 'EXEC-20261001-120000', em: '2026-10-01T12:00:00Z' };
const det1 = {
  arquivos: [{ original: 'Extrato Agosto.pdf', final: '08-2026.pdf', codigo: '58', cliente: 'TORNEARIA', subpasta: 'CONTÁBIL/EXTRATOS/2026/08' }],
  naoIdentificados: [{ nome: 'Claudio Secretario/2026-10/Enviados pelo nads/foto.jpg', motivo: 'sem CNPJ' }],
  relatorio: ['OK', 'DUPLICADO: nota 55.xml -> G:/Meu Drive/2026/58/x.xml (E401)', ''].join(String.fromCharCode(10)),
};
igual('arquivado: pelo nome sem acento e pelo código', en.destinoNoArquivamento({ nomeFinal: 'extrato agôsto.pdf', codigo: '58' }, run1, det1).final, '08-2026.pdf');
igual('código diferente não casa', en.destinoNoArquivamento({ nomeFinal: 'Extrato Agosto.pdf', codigo: '9' }, run1, det1), null);
igual('não identificado', en.destinoNoArquivamento({ nomeFinal: 'foto.jpg' }, run1, det1).situacao, 'nao_identificado');
igual('duplicado pelo relatório', en.destinoNoArquivamento({ nomeFinal: 'nota 55.xml' }, run1, det1).situacao, 'duplicado');
igual('a rodada não fala do arquivo', en.destinoNoArquivamento({ nomeFinal: 'outro.pdf' }, run1, det1), null);

// --- aviso de liberação do nads no celular dos admins (avisos-liberacao-nads.js) ---
const al = require('./avisos-liberacao-nads');
const agoraAl = Date.parse('2026-10-01T15:00:00Z');
igual('pedido novo avisa', al.avisoDoPedido({ status: 'pendente', nome: 'teste5', computador: 'Chrome · Windows', criadoEm: '2026-10-01T14:59:00Z' }, agoraAl).corpo,
  'teste5 quer entrar no nads (Chrome · Windows). Toque para aprovar e ver o código.');
igual('pedido já avisado não repete', al.avisoDoPedido({ status: 'pendente', criadoEm: '2026-10-01T14:59:00Z', avisadoEm: 'x' }, agoraAl), null);
igual('pedido velho não avisa', al.avisoDoPedido({ status: 'pendente', criadoEm: '2026-10-01T13:00:00Z' }, agoraAl), null);
igual('pedido aprovado não avisa', al.avisoDoPedido({ status: 'aprovado', criadoEm: '2026-10-01T14:59:00Z' }, agoraAl), null);

// --- aviso da REINF transmitida pelo Fiscal no celular do responsável do DP (avisos-reinf-nads.js) ---
const ar = require('./avisos-reinf-nads');
const agoraAr = Date.parse('2026-10-07T15:00:00Z');
const exAr = e => ({ empresa: 'A7 MOBILE LTDA', codigo: 515, competencia: '2026-09', etapas: { 'dp-reinf': e } });
igual('REINF do Fiscal avisa o responsável', ar.avisoDaReinf(exAr({ situacao: 'feita', por: 'Heverton (Fiscal)', em: '2026-10-07T14:50:00Z', avisar: 'Fabiana' }), agoraAr),
  { link: 'https://tarefas-nilma.web.app/tarefas/dp/obrigacoes?competencia=2026-09', para: 'Fabiana', titulo: 'REINF transmitida', corpo: '515 · A7 MOBILE LTDA · 09/2026 — transmitida por Heverton (Fiscal)' });
igual('REINF já avisada não repete', ar.avisoDaReinf(exAr({ situacao: 'feita', por: 'x', em: '2026-10-07T14:50:00Z', avisar: 'Fabiana', avisadoEm: 'y' }), agoraAr), null);
igual('REINF marcada no DP (sem avisar) não avisa', ar.avisoDaReinf(exAr({ situacao: 'feita', por: 'Fabiana', em: '2026-10-07T14:50:00Z' }), agoraAr), null);
igual('REINF velha não avisa', ar.avisoDaReinf(exAr({ situacao: 'feita', por: 'x', em: '2026-10-01T14:50:00Z', avisar: 'Fabiana' }), agoraAr), null);
const usAr = [{ id: 'u1', data: () => ({ nome: 'Fabiana Souza', email: 'fabiana@nilma.local' }) }, { id: 'u2', data: () => ({ nome: 'Gustavo P', email: 'gustavo.p@nilma.local' }) }];
igual('responsável pelo primeiro nome', (ar.usuarioDoNome(usAr, 'Fabiana') || {}).id, 'u1');
igual('responsável pelo começo do e-mail', (ar.usuarioDoNome(usAr, 'Gustavo.P') || {}).id, 'u2');
igual('responsável que não existe', ar.usuarioDoNome(usAr, 'Ninguém'), null);

// --- SIEG (sieg.js): o .zip que o baixar-xmls manda direto, e a nota e o cancelamento lidos do XML ---
const sg = require('./sieg');
const zlibT = require('zlib');
function zipDe(arquivos) {
  const partes = [];
  for (const [nome, texto] of arquivos) {
    const dados = zlibT.deflateRawSync(Buffer.from(texto));
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(0, 6); cab.writeUInt16LE(8, 8);
    cab.writeUInt32LE(dados.length, 18); cab.writeUInt32LE(Buffer.byteLength(texto), 22); cab.writeUInt16LE(Buffer.byteLength(nome), 26);
    partes.push(cab, Buffer.from(nome), dados);
  }
  return Buffer.concat(partes);
}
const nfeT = '<nfeProc><NFe><infNFe Id="NFe31260919449248000162550010000102701620070002"><ide><mod>55</mod><serie>1</serie><nNF>10270</nNF></ide><total><ICMSTot><vNF>39134.51</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
const cancT = '<procEventoNFe><evento><infEvento><chNFe>31260919449248000162550010000102701620070002</chNFe><tpEvento>110111</tpEvento></infEvento></evento></procEventoNFe>';
const xmlsT = sg.xmlsDaResposta(zipDe([['xml_1.xml', nfeT], ['xml_2.xml', cancT]]));
igual('SIEG: o .zip direto vira os XMLs', xmlsT.length, 2);
igual('SIEG: a nota do XML', sg.lerXml(xmlsT[0]), { chave: '31260919449248000162550010000102701620070002', modelo: '55', serie: '1', numero: 10270, valor: 39134.51 });
igual('SIEG: o cancelamento do XML', sg.lerXml(xmlsT[1]), { cancela: '31260919449248000162550010000102701620070002' });
igual('SIEG: resposta vazia', sg.xmlsDaResposta([]).length, 0);
// o .zip que o robô monta (sieg-xmls.js) abre no mesmo leitor; e o resumo da NF-e com os itens
const sxT = require('./sieg-xmls');
const zipT = sxT.zipDe([{ nome: 'a-nfe.xml', xml: nfeT }, { nome: 'b-evento.xml', xml: cancT }]);
igual('SIEG: o .zip montado tem os 2 XMLs', sg.lerZip(zipT), [nfeT, cancT]);
igual('SIEG: o CRC32 de "abc"', sxT.crc32(Buffer.from('abc')), 0x352441c2);
const nfeItensT = '<nfeProc><NFe><infNFe Id="NFe31260919449248000162550010000102701620070002"><ide><mod>55</mod><serie>1</serie><nNF>10270</nNF><dhEmi>2026-09-03T10:00:00-03:00</dhEmi></ide><emit><CNPJ>19449248000162</CNPJ><xNome>FITO</xNome></emit><dest><CNPJ>11111111000111</CNPJ><xNome>CLIENTE</xNome></dest><det nItem="1"><prod><NCM>21069090</NCM><CFOP>5102</CFOP><CEST>1704900</CEST><vProd>100.50</vProd></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS></imposto></det><total><ICMSTot><vNF>100.50</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
igual('SIEG: o resumo da NF-e com o item', sxT.resumoDaNota(nfeItensT).itens, [{ ncm: '21069090', cfop: '5102', cst: '000', cest: '1704900', valor: 100.5 }]);
// os itens com o ICMS, o ICMS-ST, o IPI e o CST do PIS (13/10/2026: a apuração do Presumido e do Real)
const nfeImpostosT = nfeItensT.replace('<ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS>', '<ICMS><ICMS10><orig>0</orig><CST>10</CST><vBC>100.50</vBC><vICMS>18.09</vICMS><vICMSST>7.20</vICMSST></ICMS10></ICMS><IPI><IPITrib><CST>50</CST><vIPI>5.03</vIPI></IPITrib></IPI><PIS><PISAliq><CST>01</CST><vPIS>0.65</vPIS></PISAliq></PIS>');
igual('SIEG: o item com ICMS, ST, IPI e o CST do PIS', sxT.resumoDaNota(nfeImpostosT).itens, [{ ncm: '21069090', cfop: '5102', cst: '010', cest: '1704900', valor: 100.5, icms: 18.09, st: 7.2, ipi: 5.03, cstPis: '01', bc: 100.5 }]);
// a base, a alíquota e as despesas do item (22/10/2026: a antecipação do ICMS do ES)
const nfeBaseT = nfeItensT.replace('<vProd>100.50</vProd>', '<vProd>100.50</vProd><vFrete>10.00</vFrete><vOutro>2.00</vOutro><vDesc>1.50</vDesc>').replace('<ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS>', '<ICMS><ICMS00><orig>1</orig><CST>00</CST><vBC>111.00</vBC><pICMS>4.0000</pICMS><vICMS>4.44</vICMS></ICMS00></ICMS>');
igual('SIEG: o item com a base, a alíquota e as despesas', sxT.resumoDaNota(nfeBaseT).itens, [{ ncm: '21069090', cfop: '5102', cst: '100', cest: '1704900', valor: 100.5, icms: 4.44, bc: 111, aliq: 4, desp: 10.5 }]);
// o frete e o desconto da nota (22/10/2026: o Rateio de frete)
const nfeFreteT = nfeItensT.replace('<vNF>100.50</vNF>', '<vFrete>12.30</vFrete><vDesc>2.00</vDesc><vNF>110.80</vNF>');
igual('SIEG: o frete e o desconto da NF-e', [sxT.resumoDaNota(nfeFreteT).frete, sxT.resumoDaNota(nfeFreteT).desconto, sxT.resumoDaNota(nfeItensT).frete], [12.3, 2, undefined]);
// o LCDPR (11/11/2026): a nota de entrada, a IE do destinatário e os produtos (sem repetir, até 80 letras), só quando têm
const nfeLcdprT = nfeItensT.replace('<mod>55</mod>', '<mod>55</mod><tpNF>0</tpNF>').replace('<xNome>CLIENTE</xNome>', '<xNome>CLIENTE</xNome><IE>0011288860080</IE>')
  .replace('<NCM>21069090</NCM>', '<xProd>ADUBO NPK 20-05-20</xProd><NCM>21069090</NCM>');
const lcdprR = sxT.resumoDaNota(nfeLcdprT);
igual('SIEG: a NF-e de entrada, a IE do destinatário e o produto', [lcdprR.entrada, lcdprR.ieDest, lcdprR.produto], [true, '0011288860080', 'ADUBO NPK 20-05-20']);
igual('SIEG: a NF-e de saída sem IE e sem produto não ganha os campos', ['entrada', 'ieDest', 'produto'].map(k => k in sxT.resumoDaNota(nfeItensT)), [false, false, false]);
const doisItensT = nfeLcdprT.replace('</det>', '</det><det nItem="2"><prod><xProd>ADUBO NPK 20-05-20</xProd><NCM>31052000</NCM><vProd>1</vProd></prod></det><det nItem="3"><prod><xProd>' + 'X'.repeat(90) + '</xProd><NCM>31052000</NCM><vProd>1</vProd></prod></det>');
igual('SIEG: os produtos sem repetir e cortados em 80 letras', sxT.resumoDaNota(doisItensT).produto, ('ADUBO NPK 20-05-20 | ' + 'X'.repeat(90)).slice(0, 80));
igual('SIEG: o resumo que não cabe perde primeiro os produtos', (() => { const n = { chave: 'k', produto: 'P'.repeat(500), itens: [{ ncm: '1' }] }; const r = sg.resumoQueCabe({ emitidas: [], recebidas: Array.from({ length: 2000 }, () => n) }); return [r.recebidas[0].produto, !!r.recebidas[0].itens, !!r.itensCortados]; })(), [undefined, true, false]);
// as NF-e do CT-e e o ICMS dele (23/10/2026: o Rateio de frete pelo CT-e)
const cteT = '<cteProc><CTe><infCte Id="CTe31260919449248000162570010000000011000000017"><ide><CFOP>6353</CFOP><nCT>1</nCT><serie>1</serie><dhEmi>2026-09-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>19449248000162</CNPJ><xNome>TRANSP</xNome></emit><rem><CNPJ>22222222000122</CNPJ><xNome>REM</xNome></rem><dest><CNPJ>11111111000111</CNPJ><xNome>DEST</xNome></dest><vPrest><vTPrest>500.00</vTPrest><vRec>500.00</vRec></vPrest><imp><ICMS><ICMS00><CST>00</CST><vBC>500.00</vBC><pICMS>12.00</pICMS><vICMS>60.00</vICMS></ICMS00></ICMS></imp><infCTeNorm><infDoc><infNFe><chave>31260922222222000122550010000020751000020751</chave></infNFe><infNFe><chave>31260922222222000122550010000020761000020761</chave></infNFe></infDoc></infCTeNorm></infCte></CTe></cteProc>';
const cteR = sxT.resumoDaNota(cteT);
igual('SIEG: o CT-e com as NF-e que transporta e o ICMS', [cteR.tipo, cteR.valor, cteR.icms, cteR.nfes], ['CT-e', 500, 60, ['31260922222222000122550010000020751000020751', '31260922222222000122550010000020761000020761']]);
igual('SIEG: o nome do arquivo da NF-e', sxT.nomeDoArquivo(nfeItensT), '31260919449248000162550010000102701620070002-nfe.xml');
igual('SIEG: o cancelamento no resumo', sxT.resumoDaNota(cancT), { cancela: '31260919449248000162550010000102701620070002' });
// o tipo de nota de qualquer XML, a nota ou o evento (pelo modelo na chave; 08/10/2026: o Drive como atalho)
igual('SIEG: o tipo da NF-e', sxT.tipoDeNota(nfeItensT), 'NF-e');
igual('SIEG: o tipo do cancelamento da NF-e (pela chave do evento)', sxT.tipoDeNota(cancT), 'NF-e');
igual('SIEG: o evento de uma NFC-e', sxT.tipoDeNota('<evento><tpEvento>110111</tpEvento><chNFe>31260919449248000162650010000102701620070002</chNFe></evento>'), 'NFC-e');
// os XMLs que o cliente mandou (08/10/2026): só os dele (a nota em que ele aparece e o cancelamento dela)
const spT = require('./sieg-portal');
igual('SIEG: XMLs do cliente, a nota e o cancelamento dele', spT.soDoCliente('19449248000162', [nfeItensT, cancT]).length, 2);
igual('SIEG: XMLs do cliente, de outra empresa ficam de fora', spT.soDoCliente('22222222000122', [nfeItensT, cancT]).length, 0);
igual('SIEG: XMLs do cliente, o destinatário também é dele', spT.soDoCliente('11111111000111', [nfeItensT]).length, 1);
// o CT-e pelo tomador (10/11/2026): remetente paga, o destinatário que só recebe fica de fora, com o evento
const cteTomT = '<cteProc><CTe><infCte Id="CTe31260240470754000120570010000000171041317010" versao="4.00"><ide><nCT>17</nCT><toma3><toma>0</toma></toma3></ide><emit><CNPJ>11111111000111</CNPJ></emit><rem><CNPJ>22222222000122</CNPJ></rem><dest><CNPJ>33333333000133</CNPJ></dest></infCte></CTe></cteProc>';
const cteEvT = '<procEventoCTe><eventoCTe><infEvento Id="ID1"><chCTe>31260240470754000120570010000000171041317010</chCTe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento></infEvento></eventoCTe></procEventoCTe>';
igual('SIEG: CT-e, o tomador pelo toma3', sxT.tomadorDoCte(cteTomT).doc, '22222222000122');
igual('SIEG: CT-e, o tomador e o evento ficam', sxT.cteQueEntram('22222222000122', [cteTomT, cteEvT]).length, 2);
igual('SIEG: CT-e, quem emitiu fica', sxT.cteQueEntram('11111111000111', [cteTomT]).length, 1);
igual('SIEG: CT-e, destinatário que não paga sai, com o evento', sxT.cteQueEntram('33333333000133', [cteTomT, cteEvT]).length, 0);
igual('SIEG: montar os XMLs marca a cancelada', spT.montarXmls('19449248000162', [nfeItensT, cancT]).resumo.emitidas.map(n => !!n.cancelada), [true]);
// os XMLs que chegam por e-mail (08/10/2026): o mês da nota, e o evento vai com a nota dele (o AAMM da chave)
const xeT = require('./xmls-do-email');
igual('XMLs do e-mail: o mês da nota', xeT.mesDaNota(nfeItensT, '2026-10'), '2026-09');
igual('XMLs do e-mail: o cancelamento vai com a nota', xeT.mesDaNota(cancT, '2026-10'), '2026-09');
igual('XMLs do e-mail: só os XMLs de nota dos anexos', xeT.xmlsDosAnexos([{ filename: 'a.xml', buffer: Buffer.from(nfeItensT) }, { filename: 'b.xml', buffer: Buffer.from('<x/>') }, { filename: 'c.pdf', buffer: Buffer.from('x') }]).length, 1);
// as saídas montadas das notas do "Baixar XMLs" (08/10/2026): só NF-e e NFC-e, por série, a cancelada fora do valor
const siegT = require('./sieg');
igual('SIEG: as saídas do resumo das notas', siegT.seriesDasNotas(siegT.saidasDoResumo([
  { tipo: 'NF-e', serie: '1', numero: '12', valor: 10, chave: 'a' },
  { tipo: 'NF-e', serie: '1', numero: '10', valor: 5, chave: 'b', cancelada: true },
  { tipo: 'NFC-e', serie: '2', numero: '7', valor: 3, chave: 'c' },
  { tipo: 'NFS-e', numero: '1', valor: 99 },
])), [
  { modelo: '55', serie: '1', numeros: [10, 12], canceladas: [10], valor: 10 },
  { modelo: '65', serie: '2', numeros: [7], canceladas: [], valor: 3 },
]);

// a ordem da fila do SIEG (31/10/2026: "Quero que melhore a velocidade do sieg"): o "Contar agora" na frente dos XMLs, a
// madrugada por último, e entre as pessoas um de cada uma por vez (o lote de 10 meses não segura o pedido único de outra)
{
  const fila = [
    { p: { id: 'g1', tipo: 'xmls', criadoEm: '2026-10-29T15:58:34', criadoPorUid: 'gustavo' } },
    { p: { id: 'g2', tipo: 'xmls', criadoEm: '2026-10-29T15:58:35', criadoPorUid: 'gustavo' } },
    { p: { id: 'g3', tipo: 'xmls', criadoEm: '2026-10-29T15:58:36', criadoPorUid: 'gustavo' } },
    { p: { id: 'h1', tipo: 'xmls', criadoEm: '2026-10-29T16:01:00', criadoPorUid: 'heverton' } },
    { p: { id: 'm1', tipo: 'xmls', criadoEm: '2026-10-29T03:00:00', criadoPorUid: 'robo', madrugada: true } },
    { p: { id: 'c1', tipo: 'contagem', criadoEm: '2026-10-29T16:05:00', criadoPorUid: 'heverton' } },
    { p: { id: 'z1', tipo: 'zipFaltam', criadoEm: '2026-10-29T16:04:00', criadoPorUid: 'gustavo' } },
  ].map(x => Object.assign(x, { u: siegT.urgenciaDoPedido(x.p) }));
  igual('SIEG: a ordem da fila (contagem e zipFaltam, um de cada pessoa, a madrugada por último)', siegT.ordemDaFila(fila).map(x => x.p.id), ['z1', 'c1', 'g1', 'h1', 'g2', 'g3', 'm1']);
  // depois de atender o 1º mês do Gustavo, o pedido do Heverton (que chegou depois) passa na frente do 2º mês
  const semG1 = fila.filter(x => !['g1', 'z1', 'c1', 'm1'].includes(x.p.id));
  igual('SIEG: a vez de cada pessoa conta quem o robô atendeu por último', siegT.ordemDaFila(semG1, new Map([['gustavo', 1]])).map(x => x.p.id), ['h1', 'g2', 'g3']);
  igual('SIEG: atendido o Heverton, volta o Gustavo', siegT.ordemDaFila(semG1.filter(x => x.p.id !== 'h1'), new Map([['gustavo', 1], ['heverton', 2]])).map(x => x.p.id), ['g2', 'g3']);
  igual('SIEG: sem ninguém atendido, a ordem de chegada', siegT.ordemDaFila(semG1, new Map()).map(x => x.p.id), ['g2', 'h1', 'g3']);
  igual('SIEG: a fila de uma pessoa só segue a ordem de chegada', siegT.ordemDaFila(fila.filter(x => x.p.criadoPorUid === 'gustavo' && x.p.tipo === 'xmls').reverse()).map(x => x.p.id), ['g1', 'g2', 'g3']);
}
// o portal do SIEG desde 30/10/2026: { downloadUrl } no lugar do .zip; a página de login é a sessão vencida
const esperarSieg = (async () => {
  const zipT = sxT.zipDe([{ nome: 'a.xml', xml: '<a/>' }]);
  const json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const pedidos = [];
  const buscar = async (url, op) => { pedidos.push([url, op.headers.Cookie]); return new Response(zipT, { status: 200, headers: { 'content-type': 'application/zip' } }); };
  const veio = await spT.zipDaResposta(json({ downloadUrl: 'https://down2.sieg.com/api/download/zip-stream?req=abc' }), 'COFRE.AUTH=x', null, buscar);
  igual('SIEG portal: segue o downloadUrl com a sessão e devolve o .zip', [Buffer.isBuffer(veio) && veio.readUInt32LE(0) === 0x04034b50, pedidos], [true, [['https://down2.sieg.com/api/download/zip-stream?req=abc', 'COFRE.AUTH=x']]]);
  igual('SIEG portal: o .zip direto (como antes) continua valendo', (await spT.zipDaResposta(new Response(zipT, { status: 200, headers: { 'content-type': 'application/zip' } }), '')).length, zipT.length);
  igual('SIEG portal: 204 é mês sem documentos', await spT.zipDaResposta(new Response(null, { status: 204 }), ''), null);
  const erro = async r => { try { await spT.zipDaResposta(r, '', null, async () => new Response('<html><title>SIEG - Login</title></html>', { status: 200, headers: { 'content-type': 'text/html' } })); return 'sem erro'; } catch (e) { return e.message.split(' (')[0]; } };
  igual('SIEG portal: a página de login no lugar do .zip pede a sessão de novo', await erro(json({ downloadUrl: 'https://down2.sieg.com/x' })), spT.SEM_LOGIN);
  igual('SIEG portal: endereço fora do SIEG não é seguido', await erro(json({ downloadUrl: 'https://outro.com/x' })), spT.SEM_NADA);
  igual('SIEG portal: JSON sem endereço não é .zip', await erro(json({ mensagem: 'x' })), spT.SEM_NADA);
  // a conferência com o Drive que ficou sem serventia desiste antes de gastar a vez no limite de 5 contagens por minuto
  let desistiu = '';
  try { await siegT.contagemDoMes({}, '11222333000181', '2026-10', null, () => true); } catch (e) { desistiu = e.message; }
  igual('SIEG: a contagem desiste sem chamar o SIEG', desistiu, 'a consulta não é mais necessária');

  // os trabalhadores da fila (31/10/2026): até 2 pedidos juntos, a mesma empresa e mês nunca juntos, ninguém pega o mesmo
  const dormirT = ms => new Promise(r => setTimeout(r, ms));
  const filaT = (lista, paralelo, demora = () => 20) => {
    const pendentes = lista.map(x => Object.assign({}, x));
    const rodando = new Set();
    const chaves = new Set();
    const r = { max: 0, juntos: [], feitos: [], dobrados: 0 };
    const t = siegT.criarTrabalhadores({
      paralelo,
      // a leitura do banco demora e pode ainda ver o que foi pego (como o Firestore antes do "processando" chegar)
      escolher: async (ocupadas, pegos) => { await dormirT(3); const x = pendentes.find(p => !pegos.has(p.id) && !ocupadas.has(p.chave)); return x || null; },
      atender: async x => {
        if (rodando.has(x.id)) r.dobrados++;
        if (chaves.has(x.chave)) r.juntos.push(x.id);
        rodando.add(x.id); chaves.add(x.chave);
        r.max = Math.max(r.max, rodando.size);
        await dormirT(demora(x));
        pendentes.splice(pendentes.findIndex(p => p.id === x.id), 1);
        rodando.delete(x.id); chaves.delete(x.chave);
        r.feitos.push(x.id);
      },
    });
    return { t, r, pendentes };
  };
  const seis = [['a', '380|2026-10'], ['b', '309|2026-10'], ['c', '380|2026-10'], ['d', '207|2026-09'], ['e', '380|2026-09'], ['f', '309|2026-10']].map(([id, chave]) => ({ id, chave }));
  const f2 = filaT(seis, 2);
  const t0 = Date.now();
  await f2.t.acordar();
  const ms2 = Date.now() - t0;
  igual('SIEG fila: com 2, todos atendidos, uma vez cada', f2.r.feitos.slice().sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
  igual('SIEG fila: com 2, nunca mais de 2 juntos, nenhum pego duas vezes', [f2.r.max, f2.r.dobrados], [2, 0]);
  igual('SIEG fila: a mesma empresa e mês nunca juntos', f2.r.juntos, []);
  igual('SIEG fila: a mesma empresa e mês na ordem de chegada', f2.r.feitos.filter(x => x === 'a' || x === 'c'), ['a', 'c']);
  igual('SIEG fila: livre depois de esvaziar', f2.t.ativos(), 0);
  const f1 = filaT(seis, 1);
  const t1 = Date.now();
  await f1.t.acordar();
  const ms1 = Date.now() - t1;
  igual('SIEG fila: com 1, um por vez (como antes)', [f1.r.max, f1.r.feitos], [1, ['a', 'b', 'c', 'd', 'e', 'f']]);
  igual('SIEG fila: com 2 leva perto da metade do tempo de 1', ms2 < ms1 * 0.75, true);
  // um pedido só da mesma empresa: o 2º trabalhador não tem o que pegar e sai; o 1º faz os dois
  const fMesma = filaT([{ id: 'x', chave: '1|2026-10' }, { id: 'y', chave: '1|2026-10' }], 2);
  await fMesma.t.acordar();
  igual('SIEG fila: dois da mesma empresa e mês, um depois do outro', [fMesma.r.max, fMesma.r.feitos], [1, ['x', 'y']]);
  // o pedido que chega com os dois ocupados é pego por quem terminar primeiro (acordar de novo não abre um 3º)
  const fChega = filaT([{ id: 'p', chave: '1|x' }, { id: 'q', chave: '2|x' }], 2, x => (x.id === 'p' ? 200 : 20));
  const fim = fChega.t.acordar();
  await dormirT(10);
  fChega.pendentes.push({ id: 'r', chave: '3|x' });
  fChega.t.acordar();
  await fim;
  igual('SIEG fila: o que chegou com os dois ocupados também é atendido, sem passar de 2', [fChega.r.feitos, fChega.r.max], [['q', 'r', 'p'], 2]);
  // o erro num pedido não para o trabalhador
  const fErro = siegT.criarTrabalhadores({ paralelo: 2, escolher: (() => { const l = [{ id: '1', chave: 'a' }, { id: '2', chave: 'b' }, { id: '3', chave: 'c' }]; return async (o, pg) => l.find(x => !pg.has(x.id) && !x.feito) || null; })(),
    atender: async x => { x.feito = true; if (x.id === '1') throw new Error('falhou'); }, log: () => {} });
  await fErro.acordar();
  igual('SIEG fila: o erro de um pedido não para os outros', fErro.ativos(), 0);
  igual('SIEG fila: a chave é a empresa e o mês', siegT.chaveDaPasta({ codigo: '0380', competencia: '2026-10' }), '0380|2026-10');

  // sem esperar o Drive (31/10/2026): só quando o último resumo do mês está todo no que o portal trouxe agora
  const nA = { chave: '1'.repeat(44), tipo: 'NF-e' };
  const nB = { chave: '2'.repeat(44), tipo: 'NFC-e' };
  const sB = { chave: '', tipo: 'NFS-e', numero: '15', emitente: { doc: '11.222.333/0001-81' }, data: '2026-10-05' };
  const agoraT = { emitidas: [nA, sB], recebidas: [] };
  igual('SIEG Drive: o último resumo todo no portal, não espera', siegT.cobreOUltimo({ emitidas: [nA], recebidas: [] }, agoraT), true);
  igual('SIEG Drive: a NFS-e (sem chave) vale pelo número, prestador e data', siegT.cobreOUltimo({ emitidas: [Object.assign({}, sB, { emitente: { doc: '11222333000181' } })], recebidas: [] }, agoraT), true);
  igual('SIEG Drive: nota que só o Drive tinha (a NFC-e de MG), espera', siegT.cobreOUltimo({ emitidas: [nA, nB], recebidas: [] }, agoraT), false);
  igual('SIEG Drive: outra NFS-e do mesmo número, espera', siegT.cobreOUltimo({ emitidas: [Object.assign({}, sB, { data: '2026-10-06' })], recebidas: [] }, agoraT), false);
  igual('SIEG Drive: o primeiro download do mês (sem resumo), espera', [siegT.cobreOUltimo(null, agoraT), siegT.cobreOUltimo({ codigo: '1' }, agoraT)], [false, false]);
  // o que só o Drive tem entra no resumo; o que o portal já trouxe não entra duas vezes
  const baixadoT = spT.montarXmls('19449248000162', [nfeItensT]);
  const jT = siegT.juntarOsDoDrive('19449248000162', baixadoT, [nfeItensT, cancT]);
  igual('SIEG Drive: o cancelamento que só o Drive tinha entra e marca a nota', [jT.extras, jT.baixado.arquivos.length, jT.baixado.resumo.emitidas.map(n => !!n.cancelada)], [1, 2, [true]]);
  igual('SIEG Drive: nada a mais no Drive, o download fica como veio', siegT.juntarOsDoDrive('19449248000162', baixadoT, [nfeItensT]).baixado === baixadoT, true);

  // a madrugada não repete o mês que não mudou (31/10/2026): o 137 (o SIEG conta 1 NF-e recebida, a API entrega 0) e o 54
  // (668 NFC-e só no Drive) eram pedidos toda noite
  const zeros = () => ({ NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 });
  const contDe = (rec, emi, em) => ({ emitidas: Object.assign(zeros(), emi), recebidas: Object.assign(zeros(), rec), em });
  const c137 = contDe({ NFe: 1 }, {}, '2026-10-31T07:22:42.273Z');
  const n137 = { em: '2026-10-31T07:22:42.314Z', arquivos: 0, emitidas: [], recebidas: [] };
  igual('SIEG madrugada: o 137 não fecha pela regra de antes (1 contada, 0 no nads)', siegT.completoNoNads(c137, n137), false);
  igual('SIEG madrugada: resumo de antes de 31/10 usa a contagem gravada junto com ele', siegT.contagemDoUltimoDownload(n137, c137).recebidas.NFe, 1);
  igual('SIEG madrugada: o SIEG conta hoje o mesmo que antes do último download, não baixa', siegT.semMudancaNoSieg(n137, c137, contDe({ NFe: 1 }, {})), true);
  igual('SIEG madrugada: nota nova de verdade (2 NF-e recebidas), baixa', siegT.semMudancaNoSieg(n137, c137, contDe({ NFe: 2 }, {})), false);
  igual('SIEG madrugada: nota nova de outro tipo (a NFS-e emitida), baixa', siegT.semMudancaNoSieg(n137, c137, contDe({ NFe: 1 }, { NFSe: 1 })), false);
  igual('SIEG madrugada: sem conseguir contar agora, baixa (como antes)', siegT.semMudancaNoSieg(n137, c137, null), false);
  // a contagem gravada longe do resumo (o "Contar agora" de outro dia) não diz o que havia no download: baixa
  igual('SIEG madrugada: contagem de outra hora não vale como a do download', siegT.contagemDoUltimoDownload(n137, Object.assign({}, c137, { em: '2026-10-29T12:00:00Z' })), null);
  // o resumo novo guarda a contagem de antes do download (contagemSieg): vale ela, mesmo com a siegContagens de outra hora
  const n54 = { em: '2026-11-01T07:40:00Z', emitidas: [...Array.from({ length: 120 }, () => ({ tipo: 'NF-e' })), ...Array.from({ length: 668 }, () => ({ tipo: 'NFC-e' }))], recebidas: [], contagemSieg: contDe({}, { NFe: 120 }) };
  const c54 = contDe({}, { NFe: 120 }, '2026-11-02T04:00:00Z');
  igual('SIEG madrugada: o 54 (NFC-e só no Drive) não fecha pela regra de antes', siegT.completoNoNads(c54, n54), false);
  igual('SIEG madrugada: o 54 sem nota nova no SIEG não baixa', siegT.semMudancaNoSieg(n54, c54, contDe({}, { NFe: 120 })), true);
  igual('SIEG madrugada: o 54 com uma NF-e nova baixa', siegT.semMudancaNoSieg(n54, c54, contDe({}, { NFe: 121 })), false);
  // o tipo que veio pela metade sem erro (100 de 120) pode ser um download que parou no meio: segue sendo pedido
  const nMetade = { em: '2026-11-01T07:40:00Z', emitidas: Array.from({ length: 100 }, () => ({ tipo: 'NF-e' })), recebidas: [], contagemSieg: contDe({}, { NFe: 120 }) };
  igual('SIEG madrugada: veio pela metade (100 de 120), baixa mesmo sem mudança no SIEG', siegT.semMudancaNoSieg(nMetade, c54, contDe({}, { NFe: 120 })), false);
  igual('SIEG madrugada: o primeiro download do mês (sem resumo) baixa', [siegT.contagemDoUltimoDownload(null, c137), siegT.semMudancaNoSieg(null, c137, c137)], [null, false]);
  igual('SIEG madrugada: quem fecha continua sem pedido', siegT.completoNoNads(contDe({ NFe: 1 }, {}), { emitidas: [], recebidas: [{ tipo: 'NF-e' }] }), true);
  igual('SIEG madrugada: contagem sem os números não é igual a nada', [siegT.mesmaContagem(c137, {}), siegT.mesmaContagem(c137, c137)], [false, true]);

  // a pasta EVENTOS junta todos os meses: o evento com data de antes do mês não é lido (o 380 de 10/2026: 3918 → 667 arquivos)
  igual('SIEG Drive: evento de antes do mês fica de fora', siegT.eventoDeAntes('29-09-2026 - CIENCIA DA OPERACAO NF-e 155769.xml', '2026-10'), true);
  igual('SIEG Drive: evento do mês e de depois são lidos', [siegT.eventoDeAntes('01-10-2026 - CANCELAMENTO NF-e 1.xml', '2026-10'), siegT.eventoDeAntes('03-11-2026 - CIENCIA DA OPERACAO NF-e 1.xml', '2026-10')], [false, false]);
  igual('SIEG Drive: de outro ano conta o ano', [siegT.eventoDeAntes('15-12-2025 - X.xml', '2026-01'), siegT.eventoDeAntes('15-01-2027 - X.xml', '2026-12')], [true, false]);
  igual('SIEG Drive: sem a data no nome, lê (como antes)', [siegT.eventoDeAntes('31260919449248000162550010000102701620070002-evento-110111-1.xml', '2026-10'), siegT.eventoDeAntes('', '2026-10')], [false, false]);
})();

// --- razão social vale mais que o nome fantasia (FITO, 01/10/2026) ---
const fitos = [{ id: '292', nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', nomeFantasia: 'FITO ALIMENTOS' }, { id: '309', nome: 'FITO ALIMENTOS LTDA', nomeFantasia: 'FITO ALIMENTOS', grupoLocal: '292' }];
igual('razão social da irmã no assunto: é dela', (r.desempatarPorNome(fitos, 'Arquivos 09/2026 - Fito Alimentos LTDA') || {}).id, '309');
igual('razão social da dona do e-mail: é dela', (r.desempatarPorNome(fitos, 'Arquivos 09/2026 - Fito Indústria e Comércio de Alimentos LTDA') || {}).id, '292');
igual('sem nome no assunto: não decide pelo nome', r.desempatarPorNome(fitos, 'Faturas'), null);

// ---------- DP › Envios: os documentos do DP de cada mês na pasta do cliente ----------
{
  const dp = require('./envios-do-dp');
  const di2 = require('./drive-indice');
  const itens = [
    { i: 'dp', n: 'DEPARTAMENTO PESSOAL', p: 'R', t: 'd' }, { i: 'm10', n: '10', p: 'dp', t: 'd' }, { i: 'fg', n: 'FGTS', p: 'm10', t: 'd' },
    { i: 'a1', n: 'FGTS 10-2026.pdf', p: 'fg', t: 'f', s: 1200 }, { i: 'a2', n: 'Resumo.pdf', p: 'm10', t: 'f', s: 300 },
    { i: 'fu', n: 'FUNCIONÁRIOS', p: 'dp', t: 'd' }, { i: 'jo', n: 'JOAO', p: 'fu', t: 'd' }, { i: 'a3', n: 'ASO 01-10-2026.pdf', p: 'jo', t: 'f' },
    { i: 'so', n: 'SOCIETÁRIO', p: 'R', t: 'd' }, { i: 'fp', n: 'FOLHA DE PAGAMENTO', p: 'so', t: 'd' }, { i: 'y', n: '2026', p: 'fp', t: 'd' },
    { i: 'y9', n: '09', p: 'y', t: 'd' }, { i: 'a4', n: 'Holerites.pdf', p: 'y9', t: 'f', s: 50 }, { i: 'g1', n: 'Planilha', p: 'y9', t: 'g' },
    { i: 'fi', n: 'FISCAL', p: 'R', t: 'd' }, { i: 'sn', n: 'SIMPLES NACIONAL', p: 'fi', t: 'd' }, { i: 'da', n: '16. DARF', p: 'sn', t: 'd' },
    { i: 'a5', n: '10-2026 - DARF INSS - VALOR 1.234,56 - VENCIMENTO 20-11-2026.pdf', p: 'da', t: 'f' },
    { i: 'a6', n: '10-2026 - DARF IRPJ - VALOR 10,00 - VENCIMENTO 30-11-2026.pdf', p: 'da', t: 'f' },
    { i: 'a7', n: 'solto.pdf', p: 'dp', t: 'f' },
  ];
  const porMes = dp.arquivosDoDpNaPasta(itens, 'R', '2026', di2.caminhos, di2.chaveDeNome);
  // 11/11/2026: separado por setor — a DARF do INSS da pasta FISCAL é do Fiscal e não entra mais no DP
  igual('DP: o mês junta a pasta do mês e a FGTS; nada da pasta FISCAL', (porMes.get('2026-10') || []).map(a => a.i), ['a2', 'a1']);
  igual('DP: a folha vai pelo ano e mês da pasta', (porMes.get('2026-09') || []).map(a => a.i), ['a4']);
  igual('DP: a pasta onde o arquivo está vai junto', (porMes.get('2026-10') || [])[1].c, 'DEPARTAMENTO PESSOAL/10/FGTS');
  igual('DP: FUNCIONÁRIOS, a pasta FISCAL, Google Docs e arquivo solto ficam de fora', [...porMes.keys()].sort(), ['2026-09', '2026-10']);
  igual('DP: a lista já gravada com a DARF da pasta FISCAL não manda a DARF (com ou sem escolha)', [dp.escolhidos([{ i: 'x', c: 'DEPARTAMENTO PESSOAL/10' }, { i: 'f', c: 'FISCAL/SIMPLES NACIONAL/16. DARF' }], []).map(a => a.i), dp.escolhidos([{ i: 'f', c: 'FISCAL/LUCRO PRESUMIDO/05. DARF' }], ['f']).map(a => a.i)], [['x'], []]);
  igual('DP: sem escolha vão todos', dp.escolhidos([{ i: 'x' }, { i: 'y' }], []).map(a => a.i), ['x', 'y']);
  igual('DP: só vai o escolhido que está na lista (nunca um id de fora)', dp.escolhidos([{ i: 'x' }, { i: 'y' }], ['y', 'zzz']).map(a => a.i), ['y']);
  igual('DP: o arquivo tirado da lista não vai', dp.tirarOsDeFora([{ i: 'x' }, { i: 'y' }], { tudo: false, arquivos: ['y'] }, '2026-10').map(a => a.i), ['x']);
  igual('DP: sem nada tirado vão todos', dp.tirarOsDeFora([{ i: 'x' }], undefined, '2026-10').map(a => a.i), ['x']);
  igual('DP: o cliente tirado não recebe', (() => { try { dp.tirarOsDeFora([{ i: 'x' }], { tudo: true, arquivos: [] }, '2026-10'); return 'foi'; } catch (e) { return e.message; } })(), 'o cliente foi tirado da lista de envios de 10/2026');
  igual('DP: o mês por extenso', dp.mesPorExtenso('2026-03'), 'março de 2026');
  igual('DP: os três meses recentes (virando o ano)', dp.mesesRecentes(new Date(Date.UTC(2027, 0, 15))), ['2027-01', '2026-12', '2026-11']);
  const email = require('./email-html').htmlDoEnvioDp({ assunto: 'Documentos <DP>', texto: 'Olá!\n\nSeguem os documentos.', cliente: 'TESTE & CIA', competencia: '10/2026', anexos: [{ nome: 'FGTS 10-2026.pdf', tamanho: 2048 }] });
  { const E = require('./email-html'); const nf = E.htmlDaNfse({ texto: 'Olá, X!\n\nValor de R$ 1.518,00.', cliente: 'X', numero: '1', valor: 'R$ 1.518,00', competencia: '10/2026', chave: '1234', anexos: [{ nome: 'NFS-e 1 - X.pdf' }] }).html;
    igual('NF: o R$ sai uma vez só (sem o $& do replace) e a saudação não repete', [nf.includes('RR$'), nf.includes('R$&nbsp;1.518,00'), nf.includes('Sua nota fiscal de outubro chegou'), (nf.match(/Olá, X!/g) || []).length], [false, true, true, 1]); }
  igual('DP: o e-mail tem o texto, a manchete do mês e o anexo, com o HTML escapado', [email.html.includes('FGTS 10-2026'), email.html.includes('TESTE &amp; CIA'), email.html.includes('Seguem os documentos.'), email.html.includes('Seu documento de outubro chegou')], [true, true, true, true]);
  igual('DP: o nome no Drive vai sem o cliente, e o código solto do sistema vira "Documento"', dp.nomesNoEmail([{ nome: '00463_14843_23-11-2026.PDF' }, { nome: 'Recibo de Pró Labore.pdf', tipo: 'PRO-LABORE' }, { nome: 'recibo_mensal_horista_2026_10_01_2026_10_31.pdf' }], '2026-10', '').map(x => x.nome), ['Documento 10-2026.pdf', 'Pró-labore 10-2026.pdf', 'Recibo mensal horista 10-2026.pdf']);
  igual('DP: o nome limpo do anexo no e-mail (pasta, boleto, rótulo da guia, repetido e o nome solto)', dp.nomesNoEmail([{ nome: 'FGTS 10-2026.pdf', pasta: 'DEPARTAMENTO PESSOAL/10/FGTS' }, { nome: 'Relatorio_folha.pdf', pasta: 'DEPARTAMENTO PESSOAL/10/FOLHA' }, { nome: 'holerites.PDF', pasta: 'DEPARTAMENTO PESSOAL/10/FOLHA' }, { nome: 'Fatura_NILMA_11-2026.pdf', pasta: 'X' }, { nome: 'das.pdf', rotulo: 'DARF PIS' }, { nome: 'recibo_ferias_10-2026.pdf', pasta: 'DEPARTAMENTO PESSOAL/10' }], '2026-10', 'ACME: LTDA').map(x => x.nome), ['FGTS 10-2026 - ACME LTDA.pdf', 'Folha de pagamento 10-2026 - ACME LTDA.pdf', 'Folha de pagamento 10-2026 - ACME LTDA (2).pdf', 'Boleto de honorários - ACME LTDA.pdf', 'DARF PIS 10-2026 - ACME LTDA.pdf', 'Recibo ferias 10-2026 - ACME LTDA.pdf']);
  // o boleto do escritório não vai mais no DP (11/11/2026: sai pelo Financeiro › Boletos; separado por setor)
  const boleto = [
    { i: 'ct', n: 'CONTÁBIL', p: 'R', t: 'd' }, { i: 'pf', n: 'PAGAMENTOS DE FORNECEDORES', p: 'ct', t: 'd' }, { i: 'pa', n: '2026', p: 'pf', t: 'd' },
    { i: 'p11', n: '11', p: 'pa', t: 'd' }, { i: 'ni', n: 'NILMA DIAS OLIVEIRA', p: 'p11', t: 'd' },
    { i: 'b1', n: 'Fatura_NILMA DIAS OLIVEIRA_R$250,00_11-2026.pdf', p: 'ni', t: 'f' },
    { i: 'nc', n: 'BOLETO NILMA CONTADOR', p: 'p11', t: 'd' }, { i: 'b2', n: 'BOLETO NILMA CONTADOR NF3301 R$900,00.pdf', p: 'nc', t: 'f' },
    { i: 'b3', n: '09-11-2026 NILMA CONTADOR R$900,00.jpg', p: 'nc', t: 'f' }, { i: 'b4', n: 'NFSE 3301 NILMA CONTADOR R$900,00.pdf', p: 'nc', t: 'f' },
    { i: 'po', n: 'POSTO 116', p: 'p11', t: 'd' }, { i: 'b5', n: 'BOLETO POSTO 116.pdf', p: 'po', t: 'f' },
    { i: 'p01', n: '01', p: 'pa', t: 'd' }, { i: 'nj', n: 'NILMA CONT', p: 'p01', t: 'd' }, { i: 'b6', n: 'BOLETO NILMA CONT.pdf', p: 'nj', t: 'f' },
  ];
  const porMesB = dp.arquivosDoDpNaPasta(boleto, 'R', '2026', di2.caminhos, di2.chaveDeNome);
  igual('DP: nada da pasta CONTÁBIL (o boleto e a fatura da Nilma saem pelo Financeiro)', [...porMesB.keys()], []);
  igual('DP: a lista já gravada com o boleto do escritório não manda o boleto', dp.escolhidos([{ i: 'x', c: 'DEPARTAMENTO PESSOAL/10' }, { i: 'b', c: 'CONTÁBIL/PAGAMENTOS DE FORNECEDORES/2026/11/NILMA DIAS OLIVEIRA' }], []).map(a => a.i), ['x']);
  const m = dp.mensagemDoEnvio({ assunto: 'DP {competencia} - {cliente} {xyz}', texto: '' }, { cliente: 'ACME', competencia: '10/2026', mes: 'outubro de 2026' });
  igual('DP: o modelo troca os campos, deixa o que não conhece, e o texto vazio vira o padrão', [m.assunto, m.texto.startsWith('Olá, ACME!'), m.texto.includes('outubro de 2026')], ['DP 10/2026 - ACME {xyz}', true, true]);
  // o e-mail do Cadastro do nads manda; o do Entregas só sem ele (28/10/2026)
  igual('DP: o e-mail do Cadastro do nads vale no lugar do Entregas', dp.paraQuem([{ contato: { email: ' Novo@Cliente.com ' } }], { email: 'velho@x.com' }), ['novo@cliente.com']);
  igual('DP: sem e-mail no nads, vão os do Entregas (sem repetir)', dp.paraQuem([{ contato: {} }], { email: 'a@x.com', emails: ['B@x.com', 'a@x.com'] }), ['a@x.com', 'b@x.com']);
  igual('DP: e-mail inválido não conta', dp.paraQuem([{ contato: { email: 'sem-arroba' } }], { email: 'ruim' }), []);
  // o lote do DP (28/10/2026): a leitura do arquivador, a escolha na revisão, os grupos e os valores
  const L = require('./lote-dp');
  igual('lote: o valor da guia vira número', [L.valorNumero('R$1234,56'), L.valorNumero('1.234,56'), L.valorNumero('')], [1234.56, 1234.56, null]);
  igual('lote: o tributo da DARF pelo nome final', L.tributoDoNome('10-2026 - DARF INSS - VALOR R$165,33 - VENCIMENTO 19-11-2026.pdf'), 'INSS');
  const leit = L.leituraDe({ acao: 'ARQUIVAR', cliente: 191, clienteNome: 'PEDRO', tipo: 'FGTS', competencia: { mes: 10, ano: 2026 }, nomeFinal: 'FGTS 10-2026.pdf', anoRaiz: 2026, pastaCliente: '191 - PEDRO', caminho: ['DEPARTAMENTO PESSOAL', '10', 'FGTS'] }, { valor: 'R$129,68', vencimento: '19-11-2026' }, { texto: ['GUIA'] });
  igual('lote: a leitura leva o cliente, a competência, o valor e a pasta', [leit.cliente, leit.competencia, leit.valor, leit.destino.join('/')], [191, '2026-10', 'R$129,68', '2026/191 - PEDRO/DEPARTAMENTO PESSOAL/10/FGTS']);
  const pastaL = c => (c === 191 ? '191 - PEDRO' : '');
  const lote = [
    { nome: 'FGTS.pdf', leitura: leit },
    { nome: 'guia.pdf', leitura: { cliente: 191, tipo: 'DARF', tributo: 'INSS', competencia: '2026-10', valor: 'R$165,33', nomeFinal: 'n.pdf', destino: ['2026', '191 - PEDRO', 'FISCAL', 'PESSOA FISICA', '02. DARF'] } },
    { nome: 'scan.pdf', leitura: { cliente: null, tipo: '', competencia: '' }, escolha: { cliente: 191, tipo: 'FOLHA', competencia: '2026-10' } },
    { nome: 'x.pdf', leitura: { cliente: 191, competencia: '2026-10' }, fora: true },
    { nome: 'sem.pdf', leitura: { cliente: null, competencia: '' } },
  ];
  const gL = L.grupos(lote, pastaL);
  igual('lote: um grupo por cliente e competência; o fora e o não identificado ficam de fora', [[...gL.porChave.keys()], gL.fora.map(a => a.nome)], [['191_2026-10'], ['x.pdf', 'sem.pdf']]);
  igual('lote: o escolhido à mão vai para a pasta do DP do mês, com o nome original', gL.porChave.get('191_2026-10')[2].vai.destino.join('/'), '2026/191 - PEDRO/DEPARTAMENTO PESSOAL/10/FOLHA');
  igual('lote: os valores do mês (FGTS e DARF do INSS)', L.valoresDoGrupo(gL.porChave.get('191_2026-10')), { fgts: 129.68, darf: 165.33 });
}

// ---------- Fiscal › Enviar guias (03/11/2026): a leitura da guia, a coluna do Relatório e a linha depois do envio ----------
{
  const F = require('./lote-fiscal');
  const R = require('./arquivador-regras');
  const darf = R.norm('DOCUMENTO DE ARRECADAÇÃO DE RECEITAS FEDERAIS\nPeríodo de Apuração 30/09/2026\nCódigo da Receita 8109\nData de Vencimento 24/10/2026\nValor Total do Documento 1.234,56');
  const g = F.camposDaGuiaFiscal('DARF', darf);
  igual('fiscal: a DARF pelo código da receita, o valor, o vencimento e a apuração', [g.tributo, g.valor, g.vencimento, g.competencia], ['PIS', 'R$1234,56', '24-10-2026', { mes: 9, ano: 2026 }]);
  igual('fiscal: o que não é guia não tem campos', F.camposDaGuiaFiscal('FGTS', darf), null);
  igual('fiscal: a coluna do ICMS do Simples pela receita do DAE', [F.colunaDaGuia('sn', 'DAE', 'ICMS', false, '0327-7 ICMS REC.ANTECIPADO-INDUSTRIA'), F.colunaDaGuia('sn', 'DAE', 'ICMS', false, '0317-8 ICMS DIFERENCA DE ALIQUOTA'), F.colunaDaGuia('sn', 'DAE', 'ICMS', false, 'ICMS ST - SAIDA'), F.colunaDaGuia('sn', 'DAE', 'ICMS', false, 'OUTRA'), F.colunaDaGuia('lp', 'DAE', 'ICMS', false, '0317-8 ICMS DIFERENCA DE ALIQUOTA'), F.colunaDaGuia('sn', 'DAE', 'ICMS', true, '0327-7 ICMS REC.ANTECIPADO')], ['icms-ant', 'icms-dif', 'st-sai', '', 'icms', '']);
  {
    // o DAE do SIARE como o PDF sai (o texto normalizado do arquivador): a receita na linha do Histórico
    const u = 'HISTORICO ORGAO: SECRET EST FAZENDA-DAE ON LINE RECEITA: 0327-7 ICMS REC.ANTECIPADO-INDUSTRIA PERIODO REF. DOC. ORIGEM VENCIMENTO VALOR MULTA JUROS TOTAL 01 A 31/10/2026 3417 21/12/2026 344.12 0.00 0.00 344.12\n\nSECRETARIA DE ESTADO DE FAZENDA DE MINAS GERAIS\n\nDOCUMENTO DE ARRECADACAO ESTADUAL - DAE\n\nMES ANO DE REFERENCIA 10 / 2026\n';
    const g = F.camposDaGuiaFiscal('DAE', u);
    igual('fiscal: a receita do DAE do SIARE', [g.receita, g.tributo, F.colunaDaGuia('sn', 'DAE', g.tributo, g.parcelamento, g.receita)], ['0327-7 ICMS REC.ANTECIPADO-INDUSTRIA', 'ICMS', 'icms-ant']);
  }
  {
    // 05/11/2026 (o lote da 356 e da 444): o DAE do ICMS normal sem o "Doc. Origem" no Histórico, como o arquivador lê o PDF
    const u = 'DOCUMENTO DE ARRECADACAO ESTADUAL - DAE\nNOME\nTOTAL\nA7 COMERCIO DE VEICULOS LTDA\n905,21\n905,21\nMG\n10/2026\n09/11/2026\nHISTORICO\nORGAO: SECRET EST FAZENDA-DAE ON LINE\nRECEITA: 0104-0 ICMS VEICULOS AUTOMOTORES\nPERIODO REF. DOC. ORIGEM VENCIMENTO VALOR MULTA JUROS TOTAL\n01 A 31/10/2026 09/11/2026 905.21 0.00 0.00 905.21\nMOD.06.01.88\nPAGUE COM PIX\n09/11/2026\n10/2026\nMES ANO DE REFERENCIA\n';
    const g = F.camposDaGuiaFiscal('DAE', u);
    igual('fiscal: o DAE do SIARE sem o Doc. Origem (valor e vencimento)', [g.valor, g.vencimento, g.competencia, F.colunaDaGuia('lp', 'DAE', g.tributo, g.parcelamento, g.receita)], ['R$905,21', '09-11-2026', { mes: 10, ano: 2026 }, 'icms']);
    // com o Doc. Origem continua lendo
    const comDoc = F.camposDaGuiaFiscal('DAE', u.replace('01 A 31/10/2026 09/11/2026 905.21', '01 A 31/10/2026 105706 09/11/2026 905.21'));
    igual('fiscal: o DAE do SIARE com o Doc. Origem', [comDoc.valor, comDoc.vencimento], ['R$905,21', '09-11-2026']);
    // o DAM de Taiobeiras: o mês em "Mês/Ano" e o vencimento longe do rótulo
    const dam = 'PREFEITURA MUNICIPAL DE TAIOBEIRAS\nDOCUMENTO DE\nARRECADACAO\nMUNICIPAL\nDAM\nCODIGO FEBRABAN:EXERCICIO:CONTROLE PARCELA:PARCELA:\nPROCESSO:DATA EMISSAO:VENCIMENTO ORIGINAL:DATA VENCIMENTO:\nA7 COMERCIO DE VEICULOS LTDA\nCPF / CNPJ : 13.728.235/0001-46\nRUA RUA CAICARA, 001000 - CENTRO TAIOBEIRAS - MG CEP.: 39550000\nINSCRICAO: 170114/5713\n03/11/26 09:5320/11/2026\nUNICA\n20/11/2026\n - LANCAMENTO: MES/ANO: 10/2026 | PARC.: 1 DECLARACAO Nº: 10 | OBS.:\nVALOR TOTAL:\nR$ 110,02\nISSQN MENSAL\n';
    const d = F.camposDaGuiaFiscal('DAM', dam);
    igual('fiscal: o DAM de Taiobeiras (mês, vencimento e valor)', [d.tributo, d.valor, d.vencimento, d.competencia], ['ISS', 'R$110,02', '20-11-2026', { mes: 10, ano: 2026 }]);
    // o DARF de PIS e COFINS juntos: cada um na coluna dele
    const darf = 'DOCUMENTO DE ARRECADACAO\nDE RECEITAS FEDERAIS\n42.469.613/0001-12\nGALPAO VEICULOS E LOCADORA LTDA\nPERIODO DE APURACAODATA DE VENCIMENTONUMERO DO DOCUMENTO\n07.16.26309.2719227-7\nPAGAR ESTE DOCUMENTO ATE\n25/11/2026\nVALOR TOTAL DO DOCUMENTO\n109,50\nOUTUBRO/202625/11/2026\nCODIGOPRINCIPALDENOMINACAOTOTALMULTAJUROS\nCOMPOSICAO DO DOCUMENTO DE ARRECADACAO\n2172COFINS - CONTRIB P/ FIN. SEG. SOCIAL\n90,0090,00\n01 COFINS - FATURAMENTO/PJ EM GERAL\nPA:10/2026 VENCIMENTO:25/11/2026\n8109PIS - FATURAMENTO\n19,5019,50\n02 PIS - FATURAMENTO - PJ EM GERAL\nPA:10/2026 VENCIMENTO:25/11/2026\nTOTAIS\n109,50109,50\n';
    const p = F.camposDaGuiaFiscal('DARF', darf);
    igual('fiscal: o DARF de PIS e COFINS juntos (as partes)', [p.valor, p.partes], ['R$109,50', [{ tributo: 'COFINS', valor: 'R$90,00' }, { tributo: 'PIS', valor: 'R$19,50' }]]);
    const lido = F.leituraDaGuia({ acao: 'ARQUIVAR', cliente: 444, clienteNome: 'GALPAO', tipo: 'DARF', competencia: { mes: 10, ano: 2026 }, nomeFinal: 'x.pdf', anoRaiz: 2026, pastaCliente: '444 - GALPAO', caminho: ['FISCAL', 'LUCRO PRESUMIDO', '05. DARF'] }, p, { texto: [] }, 'lp');
    const g2 = F.gruposFiscais([{ id: '0', nome: 'DARF.pdf', status: 'lido', leitura: lido }], 'lp', () => null);
    igual('fiscal: o DARF de PIS e COFINS vai dividido no Relatório', F.valoresPorColuna(g2.porChave.get('444_2026-10')), { cofins: 90, pis: 19.5 });
    // escolheu uma coluna só na revisão: vale o total nela
    const g3 = F.gruposFiscais([{ id: '0', nome: 'DARF.pdf', status: 'lido', leitura: lido, escolha: { cliente: 444, tipo: 'DARF', competencia: '2026-10', coluna: 'pis' } }], 'lp', () => null);
    igual('fiscal: o DARF de PIS e COFINS com uma coluna escolhida', F.valoresPorColuna(g3.porChave.get('444_2026-10')), { pis: 109.5 });
    // um DARF de um tributo só não tem partes
    igual('fiscal: o DARF de um tributo só', F.camposDaGuiaFiscal('DARF', darf.replace(/8109PIS - FATURAMENTO\n19,5019,50\n/, '')).partes, null);
    // o "0" do Relatório não segura a guia
    igual('fiscal: o 0 do Relatório recebe o valor da guia', F.linhaDepoisDoEnvio({ grupo: 'lp', valores: { cofins: '0', pis: '19,50' }, data: '', marcas: {}, entregue: '' }, { competencia: '2026-10', codigo: 444, grupo: 'lp', valores: { cofins: 90, pis: 20 }, dia: '2026-11-05', agora: 'x', quem: 'robô' }).preenchidos, ['cofins']);
  }
  igual('fiscal: a coluna pelo grupo', [F.colunaDaGuia('sn', 'DAS', ''), F.colunaDaGuia('lp', 'DAS', ''), F.colunaDaGuia('lp', 'DARF', 'COFINS'), F.colunaDaGuia('lp', 'DARF', 'IRRF'), F.colunaDaGuia('lp', 'DAE', 'ICMS'), F.colunaDaGuia('sn', 'DAE', 'ICMS'), F.colunaDaGuia('lp', 'DAM', 'ISS'), F.colunaDaGuia('sn', 'DAS', '', true)], ['das', '', 'cofins', '', 'icms', '', 'iss', '']);
  const decisao = { acao: 'ARQUIVAR', cliente: 58, clienteNome: 'ACME', tipo: 'DARF', competencia: { mes: 10, ano: 2026 }, nomeFinal: '09-2026 - DARF PIS - VALOR R$1234,56 - VENCIMENTO 24-10-2026.pdf', anoRaiz: 2026, pastaCliente: '58 - ACME', caminho: ['FISCAL', 'LUCRO PRESUMIDO', '05. DARF'] };
  const lg = F.leituraDaGuia(decisao, g, { texto: ['DARF'] }, 'lp');
  igual('fiscal: a leitura leva a coluna, o valor e a competência da APURAÇÃO (a da guia, não a do arquivador)', [lg.cliente, lg.tipo, lg.tributo, lg.coluna, lg.valor, lg.competencia, lg.destino.join('/')], [58, 'DARF', 'PIS', 'pis', 'R$1234,56', '2026-09', '2026/58 - ACME/FISCAL/LUCRO PRESUMIDO/05. DARF']);
  igual('fiscal: o DAM sem o período escrito fica sem competência (a do arquivador é a do vencimento)', F.leituraDaGuia(Object.assign({}, decisao, { tipo: 'DAM' }), { tributo: 'ISS', valor: 'R$10,00', vencimento: '10-10-2026', competencia: null, parcelamento: false }, { texto: ['x'] }, 'lp').competencia, '');
  const manual = (codigo, tipo, comp, nome) => (tipo === 'DAS' ? { destino: ['2026', codigo + ' - X', 'FISCAL', 'SIMPLES NACIONAL', '01. DAS'], nome } : null);
  const guias = [
    { nome: 'pis.pdf', leitura: lg },
    { nome: 'cofins.pdf', leitura: Object.assign({}, lg, { tributo: 'COFINS', coluna: 'cofins', valor: 'R$100,00' }) },
    { nome: 'outra-cofins.pdf', leitura: Object.assign({}, lg, { tributo: 'COFINS', coluna: 'cofins', valor: 'R$50,50' }) },
    { nome: 'irrf.pdf', leitura: Object.assign({}, lg, { tributo: 'IRRF', coluna: '', valor: 'R$7,00' }) },
    { nome: 'trocada.pdf', leitura: Object.assign({}, lg, { coluna: 'pis' }), escolha: { cliente: 58, tipo: 'DARF', competencia: '2026-09', coluna: '' } },
    { nome: 'scan.pdf', leitura: { cliente: null, tipo: '', competencia: '', valor: '' }, escolha: { cliente: 77, tipo: 'DAS', competencia: '2026-09', coluna: 'das' } },
    { nome: 'fora.pdf', leitura: lg, fora: true },
    { nome: 'sem.pdf', leitura: { cliente: null, competencia: '' } },
  ];
  const gf = F.gruposFiscais(guias, 'lp', manual);
  igual('fiscal: um grupo por cliente e competência da apuração; o fora e o sem cliente ficam de fora', [[...gf.porChave.keys()], gf.fora.map(a => a.nome)], [['58_2026-09', '77_2026-09'], ['fora.pdf', 'sem.pdf']]);
  igual('fiscal: os valores por coluna (somados; sem coluna e a coluna tirada na revisão não contam)', F.valoresPorColuna(gf.porChave.get('58_2026-09')), { pis: 1234.56, cofins: 150.5 });
  igual('fiscal: a coluna escolhida que não é do grupo fica sem coluna; o escolhido à mão vai pela árvore do regime', [gf.porChave.get('77_2026-09')[0].vai.coluna, gf.porChave.get('77_2026-09')[0].vai.destino.join('/')], ['', '2026/77 - X/FISCAL/SIMPLES NACIONAL/01. DAS']);
  igual('fiscal: o texto do valor no Relatório', [F.textoDoValor(1234.5), F.textoDoValor(1234567.891), F.textoDoValor(0.5)], ['1.234,50', '1.234.567,89', '0,50']);
  igual('fiscal: o dia do envio é o de Brasília', F.diaEmBrasilia(new Date('2026-11-01T01:00:00Z')), '2026-10-31');
  const envio = { competencia: '2026-09', codigo: 58, grupo: 'lp', valores: { pis: 1234.56, cofins: 150.5 }, dia: '2026-10-20', agora: '2026-10-20T13:00:00.000Z', quem: 'robô' };
  const nova = F.linhaDepoisDoEnvio(null, envio);
  igual('fiscal: sem linha, ela nasce com os valores, a data, o e-mail e o grupo do lote', [nova.linha.valores, nova.linha.data, nova.linha.entregue, nova.linha.grupo, nova.linha.codigo, nova.preenchidos, nova.mudou], [{ pis: '1.234,56', cofins: '150,50' }, '2026-10-20', 'email', 'lp', 58, ['pis', 'cofins'], true]);
  const escrita = { competencia: '2026-09', codigo: 58, grupo: 'sn', valores: { pis: '999,00', irpj: '—' }, data: '2026-10-05', marcas: { dctf: 'ok' }, entregue: 'impresso' };
  const depois = F.linhaDepoisDoEnvio(escrita, envio);
  igual('fiscal: o que já estava escrito à mão fica (o valor, a data, a entrega, as marcas e o grupo); só o em branco é preenchido', [depois.linha.valores, depois.linha.data, depois.linha.entregue, depois.linha.marcas, depois.linha.grupo, depois.preenchidos], [{ pis: '999,00', irpj: '—', cofins: '150,50' }, '2026-10-05', 'impresso', { dctf: 'ok' }, 'sn', ['cofins']]);
  igual('fiscal: tudo já preenchido, não grava de novo', F.linhaDepoisDoEnvio(depois.linha, envio).mudou, false);
  // o impresso (04/11/2026): a entrega na rota do Entregas e o Relatório com Entregue = Impresso, sem a data
  const imp = F.linhaDepoisDoEnvio(null, Object.assign({}, envio, { dia: '', entregue: 'impresso' }));
  igual('fiscal impresso: o Relatório fica com o valor e Entregue = Impresso, sem a data', [imp.linha.entregue, imp.linha.data, imp.linha.valores.pis], ['impresso', '', '1.234,56']);
  igual('fiscal impresso: a entrega escrita à mão fica', F.linhaDepoisDoEnvio(escrita, Object.assign({}, envio, { dia: '', entregue: 'email' })).linha.entregue, 'impresso');
  // o que já está na rota não vai de novo (11/11/2026): o mesmo documento, cliente e competência numa parada não entregue
  const doCliente = [
    { competencia: '2026-10', status: 'pendente', itens: [{ tipo: 'DAE ICMS' }, { tipo: 'DAS' }] },
    { competencia: '2026-09', status: 'pendente', itens: [{ tipo: 'DARF PIS' }] },
    { competencia: '2026-10', status: 'confirmada', itens: [{ tipo: 'DARF COFINS' }] },
    { competencia: '2026-10', status: 'link', itens: [{ tipo: 'DAM ISS' }] },
  ];
  igual('fiscal impresso: já na rota é o mesmo documento do mês, pendente ou no link (o entregue e o de outro mês podem)',
    F.jaNaRota(['dae  icms', 'DAS', 'DARF PIS', 'DARF COFINS', 'DAM ISS', 'DARF IRPJ'], doCliente, '2026-10'), [true, true, false, false, true, false]);
  igual('fiscal impresso: o dia da guia em ISO', [F.diaIso('20/10/2026'), F.diaIso('20-10-2026'), F.diaIso('2026-10-20'), F.diaIso('')], ['2026-10-20', '2026-10-20', '2026-10-20', '']);
  igual('fiscal impresso: os anexos, um por guia, sem repetir', F.idsDosAnexos([{ tipo: 'DARF', tributo: 'PIS' }, { tipo: 'DARF', tributo: 'PIS' }, { tipo: 'DAS', tributo: '' }, { tipo: '', tributo: '' }]), ['guia-darf-pis', 'guia-darf-pis-2', 'guia-das', 'guia-outra']);
  const ent = F.entregaDoImpresso({ id: 'c1', codigoOrigem: '58', nome: 'ACME ', zona: 'centro' }, '2026-09', [{ tipo: 'DARF PIS', valor: 10, vencimento: '25/10/2026' }, { tipo: 'DAS', valor: null, vencimento: '20/10/2026' }], { email: 'f@x', nome: 'Ana' }, 'T');
  igual('fiscal impresso: a entrega pendente na rota, como a Nova entrega do Entregas', [ent.status, ent.clienteId, ent.clienteNome, ent.competencia, ent.vencimento, ent.zona, ent.itens, ent.entregadoPor, ent.confirmadoEm], ['pendente', 'c1', '58 - ACME', '2026-09', '2026-10-20', 'centro', [{ tipo: 'DARF PIS', valor: 10 }, { tipo: 'DAS', valor: null }], 'f@x', null]);
  igual('fiscal: o modelo do e-mail do Fiscal (vazio = o padrão dele)', require('./envios-do-dp').mensagemDoEnvio({}, { cliente: 'ACME', competencia: '09/2026', mes: 'setembro de 2026' }, F.MODELO_PADRAO).assunto, 'Guias de impostos · 09/2026 · ACME');
  const emailF = require('./email-html').htmlDoEnvioDp({ assunto: 'Guias', texto: 'Olá', cliente: 'ACME', competencia: '09/2026', anexos: [{ nome: 'das.pdf', tamanho: 10 }], chip: 'Fiscal', rodape: 'com as guias do mês.' });
  igual('fiscal: o e-mail com o chip e o rodapé do Fiscal', [emailF.html.includes('Fiscal'), emailF.html.includes('com as guias do mês.')], [true, true]);
}

// ---------- a faxina do banco (01/11/2026: o banco chegou a 1.009 MB de 1 GB) ----------
const fx = require('./faxina-banco');
const DIA_FX = 864e5;
const AGORA_FX = Date.parse('2026-11-01T12:00:00Z');
const haDias = n => new Date(AGORA_FX - n * DIA_FX).toISOString();
igual('faxina: extrato importado há 8 dias perde os pedaços', fx.oQueApagar('extratosRecebidos', { status: 'importado', importadoEm: haDias(8) }, AGORA_FX).apagar, ['partes']);
igual('faxina: extrato importado ontem fica', fx.oQueApagar('extratosRecebidos', { status: 'importado', importadoEm: haDias(1) }, AGORA_FX), null);
igual('faxina: extrato ainda novo fica (o Extratudo vai ler)', fx.oQueApagar('extratosRecebidos', { status: 'novo', em: haDias(60) }, AGORA_FX), null);
igual('faxina: extrato ignorado sem a data da importação vale a de chegada', fx.oQueApagar('extratosRecebidos', { status: 'ignorado', em: haDias(30) }, AGORA_FX).apagar, ['partes']);
igual('faxina: FGTS terminado há 15 dias perde as telas, nunca o PDF da guia', fx.oQueApagar('pedidosFgts', { status: 'pronto', fimEm: haDias(15) }, AGORA_FX).apagar, ['telas', 'ao-vivo']);
igual('faxina: FGTS ainda trabalhando fica', fx.oQueApagar('pedidosFgts', { status: 'trabalhando', criadoEm: haDias(40) }, AGORA_FX), null);
igual('faxina: FGTS terminado há 3 dias fica', fx.oQueApagar('pedidosFgts', { status: 'erro', fimEm: haDias(3) }, AGORA_FX), null);
igual('faxina: feedback feito de 31 dias perde o arquivo; o resolvendo fica', [fx.oQueApagar('feedbacks', { status: 'feito', criadoEm: haDias(31) }, AGORA_FX).apagar, fx.oQueApagar('feedbacks', { status: 'resolvendo', criadoEm: haDias(90) }, AGORA_FX)], [['partes'], null]);
igual('faxina: o que já foi faxinado não volta; coleção fora da lista, nada', [fx.oQueApagar('extratosRecebidos', { status: 'importado', importadoEm: haDias(30), partesApagadasEm: haDias(20) }, AGORA_FX), fx.oQueApagar('entregas', { status: 'confirmada', criadoEm: haDias(90) }, AGORA_FX)], [null, null]);
igual('faxina: data do Firestore (Timestamp) também vale', fx.quando({ toMillis: () => 5 }), 5);
igual('faxina: o modo pelo ambiente', [fx.modoDaFaxina(''), fx.modoDaFaxina('simular'), fx.modoDaFaxina('desligada')], ['apagar', 'simular', 'desligada']);
// a limpeza única (limpar-banco.js): os argumentos e o dia do arquivador remontado
const lbz = require('./limpar-banco');
igual('limpeza: sem argumento é simulação dos itens seguros', [lbz.lerArgumentos([]).apagar, lbz.lerArgumentos([]).so], [false, null]);
igual('limpeza: --apagar, --so e os prazos', (() => { const x = lbz.lerArgumentos(['--apagar', '--so=dias,fgts-pdf', '--dias=feedbacks:0', '--dias-pdf=120']); return [x.apagar, x.so, x.dias, x.diasPdf]; })(), [true, ['dias', 'fgts-pdf'], { feedbacks: 0 }, 120]);
igual('limpeza: item desconhecido para (não apaga o que não devia)', (() => { try { lbz.lerArgumentos(['--so=entregas']); return 'passou'; } catch (e) { return 'parou'; } })(), 'parou');
{
  const itensDia = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: 'j' + i, acao: 'jaArquivado', nome: 'x'.repeat(100) })),
    { id: 'a1', acao: 'arquivou', nome: 'a' }, { id: 'a1', acao: 'arquivou', nome: 'a' },   // repetido (uma rodada que parou no meio)
    { id: 'n1', acao: 'naoIdentificado', nome: 'n' }, { id: 'j9', acao: 'jaArquivado', nome: 'j' },
  ];
  const rd = lbz.remontarDia('2026-10-27', itensDia, 3);
  igual('limpeza do dia: os já arquivados até o teto, o resto todo, sem repetir', [rd.ficam, rd.saem, rd.partes.flat().map(x => x.id)], [5, 4, ['j0', 'j1', 'j2', 'a1', 'n1']]);
  const grande = Array.from({ length: 3000 }, (_, i) => ({ id: 'g' + i, acao: 'arquivou', nome: 'y'.repeat(200) }));
  const rg2 = lbz.remontarDia('2026-10-27', grande, 300);
  igual('limpeza do dia: as partes novas têm até 250 KB', [rg2.partes.length > 1, rg2.partes.every(p => p.reduce((s, x) => s + JSON.stringify(x).length, 0) <= 250 * 1024)], [true, true]);
  igual('limpeza do dia: antes de 24/10 as partes eram de 700 KB', lbz.bytesDaParte('2026-10-22'), 700 * 1024);
}
// --- o extrato do Drive trocado pelo importado à mão vai para SUBSTITUÍDOS (envios-do-nads.js, 06/11/2026) ---
const esperarSubstituidos = (async () => {
  const crypto = require('crypto');
  const itens = [{ i: 'c', n: 'CONTÁBIL', p: 'cli', t: 'd' }, { i: 'bb', n: 'BRADESCO', p: 'c', t: 'd' }, { i: 'velho', n: '01-2026.pdf', p: 'bb', t: 'f' }];
  const falso = (md5Velho, paiNome = 'BRADESCO') => {
    const feito = { movido: null, criadas: [] };
    const drive = { files: {
      get: async ({ fileId }) => ({ data: fileId === 'velho' ? { id: 'velho', name: '01-2026.pdf', parents: ['bb'], md5Checksum: md5Velho } : { name: paiNome } }),
      list: async () => ({ data: { files: [] } }),
      create: async ({ requestBody }) => { feito.criadas.push(requestBody.name + '<' + requestBody.parents[0]); return { data: { id: 'subs' } }; },
      update: async p => { feito.movido = [p.fileId, p.addParents, p.removeParents]; return { data: {} }; },
    } };
    return { drive, feito };
  };
  const novo = Buffer.from('extrato certo');
  const a = falso('outro-md5');
  igual('substituir: o antigo vai para SUBSTITUÍDOS, dentro da pasta dele', [await en.moverParaSubstituidos(a.drive, itens, 'cli', 'velho', novo), a.feito.criadas, a.feito.movido],
    ['movido', ['SUBSTITUÍDOS<bb'], ['velho', 'subs', 'bb']]);
  const b = falso(crypto.createHash('md5').update(novo).digest('hex'));
  igual('substituir: o mesmo conteúdo fica onde está', [await en.moverParaSubstituidos(b.drive, itens, 'cli', 'velho', novo), b.feito.movido], ['igual', null]);
  const c = falso('outro-md5');
  igual('substituir: arquivo fora da pasta da empresa não mexe', [await en.moverParaSubstituidos(c.drive, itens, 'cli', 'de-outro', novo), c.feito.movido], ['', null]);
  const d = falso('outro-md5', 'SUBSTITUÍDOS');
  igual('substituir: já está em SUBSTITUÍDOS (tentado de novo) não mexe', [await en.moverParaSubstituidos(d.drive, itens, 'cli', 'velho', novo), d.feito.movido], ['', null]);
})();

const esperarFaxina = (async () => {
  // um banco de mentira: 2 extratos (1 velho importado com 2 pedaços, 1 novo) e 1 FGTS pronto com 1 tela
  const apagados = [], marcados = [];
  const pedaco = (caminho, dados) => ({ data: () => dados, ref: { delete: async () => { apagados.push(caminho); } } });
  const pai = (col, id, dados, subs) => ({ data: () => dados, ref: {
    collection: s => ({ get: async () => ({ docs: (subs[s] || []).map((d, i) => pedaco(col + '/' + id + '/' + s + '/' + i, d)) }) }),
    update: async (m) => { marcados.push([col + '/' + id, Object.keys(m)]); },
  } });
  const docs = {
    extratosRecebidos: [pai('extratosRecebidos', 'a', { status: 'importado', importadoEm: haDias(10) }, { partes: [{ dados: 'x'.repeat(1000) }, { dados: 'y'.repeat(500) }] }), pai('extratosRecebidos', 'b', { status: 'importado', importadoEm: haDias(2) }, { partes: [{ dados: 'z' }] })],
    pedidosFgts: [pai('pedidosFgts', 'f', { status: 'pronto', fimEm: haDias(20) }, { telas: [{ imagem: 'i'.repeat(100) }], arquivo: [{ base64: 'NAO' }] })],
    feedbacks: [],
  };
  const db = { collection: c => ({ where: () => ({ get: async () => ({ docs: docs[c] || [] }) }) }) };
  const simulado = await fx.faxinar(db, () => {}, { modo: 'simular', agora: AGORA_FX });
  igual('faxina simulada: conta e não apaga nada', [simulado.pedacos, simulado.bytes, apagados.length, marcados.length], [3, 1600, 0, 0]);
  const r = await fx.faxinar(db, () => {}, { modo: 'apagar', agora: AGORA_FX });
  igual('faxina: apaga só os pedaços usados (nunca o PDF da guia) e marca o documento de cima', [r.pedacos, apagados, marcados.map(m => m[0])], [3, ['extratosRecebidos/a/partes/0', 'extratosRecebidos/a/partes/1', 'pedidosFgts/f/telas/0'], ['extratosRecebidos/a', 'pedidosFgts/f']]);
  const comErro = await fx.faxinar({ collection: () => ({ where: () => ({ get: async () => { throw new Error('sem rede'); } }) }) }, () => {}, { agora: AGORA_FX });
  igual('faxina: o erro vira uma linha, não derruba', comErro.erros.length, 3);
})();

// os testes que leem PDF são assíncronos: o resultado espera por eles
// a data da entrega do impresso no Relatório do Fiscal (13/11/2026): a entrega confirmada preenche a data da linha Impresso
const esperarDataDoImpresso = (async () => {
  const F = require('./lote-fiscal');
  const linha = { competencia: '2026-10', codigo: 58, grupo: 'sn', valores: { das: '100,00' }, data: '', marcas: {}, entregue: 'impresso' };
  igual('fiscal impresso entregue: a linha Impresso sem data ganha o dia da entrega', F.linhaComADataDaEntrega(linha, '2026-11-13', 'x').data, '2026-11-13');
  igual('fiscal impresso entregue: os valores e o resto ficam', F.linhaComADataDaEntrega(linha, '2026-11-13', 'x').valores, { das: '100,00' });
  igual('fiscal impresso entregue: a data escrita à mão fica', F.linhaComADataDaEntrega(Object.assign({}, linha, { data: '2026-11-10' }), '2026-11-13', 'x'), null);
  igual('fiscal impresso entregue: o Entregue trocado (não é mais Impresso) fica', F.linhaComADataDaEntrega(Object.assign({}, linha, { entregue: 'email' }), '2026-11-13', 'x'), null);
  igual('fiscal impresso entregue: sem a linha, não cria', F.linhaComADataDaEntrega(null, '2026-11-13', 'x'), null);
  // o fluxo com um banco de mentira: o registro do envio aponta a entrega; a linha do Relatório ganha a data
  const banco = (registros, linhas) => {
    const gravadas = {};
    const db = {
      collection: nome => ({
        where: (campo, op, valor) => ({ limit: () => ({ get: async () => ({ docs: registros.filter(r => r[campo] === valor).map(r => ({ data: () => r })) }) }) }),
        doc: id => ({ nome, id }),
      }),
      runTransaction: async fn => fn({
        get: async ref => ({ exists: !!linhas[ref.id], data: () => linhas[ref.id] }),
        set: (ref, v) => { gravadas[ref.id] = v; },
      }),
    };
    return { db, gravadas };
  };
  const regs = [
    { tipo: 'envioFiscal', via: 'impresso', entregaId: 'e1', competencia: '2026-10', codigo: '58' },
    { tipo: 'envioFiscal', via: 'email', entregaId: 'e1', competencia: '2026-10', codigo: '77' },
  ];
  const b1 = banco(regs, { '2026-10_58': linha, '2026-10_77': Object.assign({}, linha, { codigo: 77 }) });
  // confirmada às 01h UTC do dia 14 = dia 13 em Brasília
  const feitas = await F.dataDaEntregaDoImpresso(b1.db, { id: 'e1', status: 'confirmada', confirmadoEm: '2026-11-14T01:30:00Z' });
  igual('fiscal impresso entregue: só a linha do registro impresso, com o dia de Brasília', [feitas, b1.gravadas['2026-10_58'] && b1.gravadas['2026-10_58'].data, Object.keys(b1.gravadas)], [['2026-10_58'], '2026-11-13', ['2026-10_58']]);
  const b2 = banco(regs, { '2026-10_58': linha });
  igual('fiscal impresso entregue: a entrega não realizada (falha) não preenche', await F.dataDaEntregaDoImpresso(b2.db, { id: 'e1', status: 'falha', confirmadoEm: '2026-11-13T15:00:00Z' }), []);
  igual('fiscal impresso entregue: a entrega que não veio do Fiscal não mexe no Relatório', await F.dataDaEntregaDoImpresso(b2.db, { id: 'outra', status: 'confirmada', confirmadoEm: '2026-11-13T15:00:00Z' }), []);
})();

Promise.all([esperarExtratos, esperarSieg, esperarFaxina, esperarSubstituidos, esperarDataDoImpresso]).then(() => {
  console.log(falhas ? '\n' + falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
  process.exit(falhas ? 1 : 0);
});
