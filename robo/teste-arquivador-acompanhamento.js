// Testes do acompanhamento do arquivador novo (arquivador-acompanhamento.js). Rode:  node teste-arquivador-acompanhamento.js
// Sem banco de verdade: um banco de mentira guarda o que seria gravado; a pasta de controle é temporária.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('./arquivador-acompanhamento');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- o motivo, a sugestão e as evidências em português ----------
igual('motivo conhecido', A.motivoLegivel('CLIENTE_NAO_LOCALIZADO'), 'CNPJ não cadastrado');
igual('motivo desconhecido vira texto', A.motivoLegivel('ALGO_NOVO'), 'algo novo');
igual('sem motivo', A.motivoLegivel(null), 'sem motivo');
igual('duas empresas: escolha entre', A.sugestao({ motivo: 'CLIENTE_AMBIGUO', evidencias: ['candidatos 544, 564'] }), 'Escolha entre 544 e 564 e mova o arquivo para a pasta do certo.');
igual('três empresas', A.sugestao({ motivo: 'CLIENTE_AMBIGUO', evidencias: ['título: DAS (x)', 'candidatos 12, 58, 292'] }), 'Escolha entre 12, 58 e 292 e mova o arquivo para a pasta do certo.');
igual('pouca certeza: a sugestão do robô', A.sugestao({ motivo: 'CONFIANCA_ABAIXO_DO_LIMIAR', destinoSugerido: 'G:\\Meu Drive\\2026\\58 - X\\CONTÁBIL\\a.pdf' }), 'Sugestão do robô: 58 - X\\CONTÁBIL\\a.pdf. Se estiver certa, mova para lá.');
igual('sem cadastro: cadastre', /cadastre o CNPJ/.test(A.sugestao({ motivo: 'CLIENTE_NAO_LOCALIZADO', evidencias: [] })), true);
igual('evidência sem a referência do Dicionário', A.evidenciaLegivel('PDF sem camada de texto (escaneado): sem OCR, o robô não lê; a rotina antiga lia a imagem (Dicionário §12)'), 'PDF sem camada de texto (escaneado): sem OCR, o robô não lê; a rotina antiga lia a imagem');
igual('evidência sem o "05d §1:"', A.evidenciaLegivel('05d §1: emitida (emitente da chave = cliente)'), 'Emitida (emitente da chave = cliente)');
igual('evidência sem o "(03)"', A.evidenciaLegivel('conta 12345 já arquivada só deste cliente (03)'), 'Conta 12345 já arquivada só deste cliente');
igual('título → tipo', A.evidenciaLegivel('título: COMPROVANTE (Comprovante de pagamento)'), 'Título "Comprovante de pagamento" → tipo COMPROVANTE');
igual('OCR em português', A.evidenciaLegivel('texto por OCR (Tesseract 78%): confiança limitada a 0.9'), 'Texto lido por OCR (leitura 78%): certeza limitada a 90%');
igual('evidência vazia', A.evidenciaLegivel(''), '');

// ---------- os erros ----------
igual('travado', A.classificarErro("EBUSY: resource busy or locked, open 'G:\\x.pdf'").tipo, 'travado');
igual('sem permissão', A.classificarErro('EPERM: operation not permitted, rename').tipo, 'permissao');
igual('Drive fora', A.classificarErro('a pasta de origem não está acessível (G:\\Meu Drive\\Claudio Secretario)').tipo, 'drive');
igual('PDF corrompido', A.classificarErro('Invalid PDF structure').tipo, 'corrompido');
igual('OCR', A.classificarErro('OCR: tempo esgotado').tipo, 'ocr');
igual('cópia não conferiu', A.classificarErro('hash não confere depois da cópia: G:\\a.pdf').tipo, 'conferencia');
igual('outro', A.classificarErro('qualquer coisa').tipo, 'outro');

// ---------- a ação e o item ----------
igual('arquivou em produção', A.acaoDoItem({ acao: 'ARQUIVAR' }, 'PRODUCAO'), 'arquivou');
igual('arquivaria em simulação', A.acaoDoItem({ acao: 'ARQUIVAR' }, 'SIMULACAO'), 'arquivaria');
igual('produção, tipo ainda em simulação', A.acaoDoItem({ acao: 'ARQUIVAR', naoAplicado: 'tipo ainda em simulação' }, 'PRODUCAO'), 'arquivaria');
igual('erro manda', A.acaoDoItem({ acao: 'ARQUIVAR', erro: 'EBUSY' }, 'PRODUCAO'), 'erro');
igual('não identificado', A.acaoDoItem({ acao: 'NAO_IDENTIFICADO' }, 'PRODUCAO'), 'naoIdentificado');
igual('fica', A.acaoDoItem({ acao: 'FICA' }, 'PRODUCAO'), 'fica');

const EM = '2026-10-22T13:00:00.000Z';
const arq = { rel: '2026-10\\comprovante sicoob.pdf', nome: 'comprovante sicoob.pdf', hash: 'abcdef0123456789ff', acao: 'ARQUIVAR', confianca: 0.96, tipo: 'COMPROVANTE', cliente: 380, clienteNome: 'LEONARDO EXEMPLO ME',
  onde: 'G:\\Meu Drive\\2026\\380 - LEONARDO EXEMPLO ME\\CONTÁBIL\\EXTRATOS\\2026\\01\\COMPROVANTES\\SICOOB\\COMPROVANTE 01-2026.pdf', criarPastaCliente: true, pastaCliente: '380 - LEONARDO EXEMPLO ME',
  evidencias: ['título: COMPROVANTE (Comprovante de pagamento)', 'CNPJ/CPF do documento', 'CNPJ/CPF do documento'], ocr: { confianca: 81.4, ms: 12400 }, copias: [] };
const it = A.itemCompacto(arq, 'PRODUCAO', EM, false);
igual('item: a ação, o cliente e a confiança', [it.acao, it.cliente, it.confianca], ['arquivou', '380', 96]);
igual('item: o destino sem o G:\\Meu Drive\\2026', it.destino, '380 - LEONARDO EXEMPLO ME\\CONTÁBIL\\EXTRATOS\\2026\\01\\COMPROVANTES\\SICOOB\\COMPROVANTE 01-2026.pdf');
igual('item: o nome final', it.nomeFinal, 'COMPROVANTE 01-2026.pdf');
igual('item: a pasta nova', it.pastaNova, '380 - LEONARDO EXEMPLO ME');
igual('item: evidências sem repetir', it.evidencias, ['Título "Comprovante de pagamento" → tipo COMPROVANTE', 'CNPJ/CPF do documento é de um cliente só']);
igual('item: o OCR', it.ocr, { confianca: 81, segundos: 12, erro: null });
igual('item arquivado não leva motivo', it.motivo, undefined);
const ni = A.itemCompacto({ rel: 'a.pdf', nome: 'a.pdf', hash: 'h', acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.5, tipo: 'DAS', evidencias: ['candidatos 544, 564'] }, 'PRODUCAO', EM, false);
igual('não identificado: motivo e sugestão', [ni.motivoTexto, ni.sugestao], ['Duas empresas possíveis', 'Escolha entre 544 e 564 e mova o arquivo para a pasta do certo.']);
const er = A.itemCompacto({ rel: 'b.pdf', acao: 'ARQUIVAR', erro: 'EBUSY: resource busy or locked' }, 'PRODUCAO', EM, false);
igual('erro: o tipo e o que fazer', [er.acao, er.erroTipo, !!er.oQueFazer, er.nome], ['erro', 'travado', true, 'b.pdf']);
igual('histórico: no máximo 4 evidências', A.itemCompacto(Object.assign({}, arq, { evidencias: ['a', 'b', 'c', 'd', 'e', 'f'] }), 'PRODUCAO', EM, true).evidencias.length, 4);

// ---------- as contagens ----------
const c = A.contagemVazia('2026-10-22');
A.somar(c, it); A.somar(c, it); A.somar(c, ni);
A.somar(c, A.itemCompacto(Object.assign({}, arq, { cliente: 58, clienteNome: 'B', tipo: 'XML NF-e', criarPastaCliente: false }), 'SIMULACAO', EM, false));
const pub = A.contagemPublicada(c);
igual('por ação', pub.porAcao, { arquivou: 2, arquivaria: 1, jaArquivado: 0, naoIdentificado: 1, fica: 0, erro: 0, descartado: 0 });
// o resumo do mês (23/10/2026): a soma dos dias, os arquivados à mão e a contagem de cada dia
const rm = A.resumoDoMes('2026-10', { '2026-10-22': { porAcao: { arquivou: 3, naoIdentificado: 1 }, aMao: 1, porTipo: { DAS: 3 }, porCliente: { 58: { nome: 'A', n: 3 } }, pastasNovas: ['58 - A'] }, '2026-10-23': { porAcao: { arquivou: 2, descartado: 1 }, aMao: 0, porTipo: { DAS: 2 }, porCliente: { 58: { nome: 'A', n: 2 } } }, '2026-09-30': { porAcao: { arquivou: 9 } } }, 'x');
igual('resumo do mês: somas, à mão e os dias do mês', [rm.porAcao, rm.aMao, rm.porTipo, rm.porCliente, Object.keys(rm.dias)], [{ arquivou: 5, naoIdentificado: 1, descartado: 1 }, 1, { DAS: 5 }, { 58: { nome: 'A', n: 5 } }, ['2026-10-22', '2026-10-23']]);
igual('por tipo', pub.porTipo, { COMPROVANTE: 2, 'XML NF-e': 1 });
igual('clientes: o que mais recebeu primeiro', pub.clientes.map(x => x.codigo + ':' + x.n), ['380:2', '58:1']);
igual('total de clientes e a pasta nova uma vez só', [pub.totalDeClientes, pub.pastasNovas], [2, ['380 - LEONARDO EXEMPLO ME']]);
igual('por motivo', pub.porMotivo, { CLIENTE_AMBIGUO: 1 });

// ---------- a pasta, o ritmo e a passada ----------
const T = Date.parse(EM);
const pasta = A.situacaoDaPasta({ vistos: [{ rel: 'novo.pdf', tam: 1, mtime: T - 5000 }, { rel: 'pronto.pdf', tam: 1, mtime: T - 600000 }, { rel: 'ni.pdf', tam: 1, mtime: T - 900000 }, { rel: 'lendo.pdf', tam: 1, mtime: T - 700000 }],
  pendentes: ['pronto.pdf', 'lendo.pdf'], lendo: ['lendo.pdf'], mapa: new Map(), estavelMs: 45000 }, T);
igual('pasta: as contagens', [pasta.naPasta, pasta.chegando, pasta.naFila, pasta.sendoLidos, pasta.parados], [4, 1, 1, 1, 1]);
igual('pasta: lendo primeiro, depois chegando e a fila', pasta.lista.map(x => x.situacao), ['lendo', 'chegando', 'fila']);
igual('ritmo: 20 em 9,5 min = 2,1/min', A.ritmo(Array.from({ length: 20 }, (_, i) => T - i * 30000 - 1), T), 2.1);
igual('ritmo: nada recente', A.ritmo([T - 3600e3], T), 0);
let p = A.avancarPassada(null, 0, T);
igual('sem fila: sem passada', p, null);
p = A.avancarPassada(null, 100, T);
igual('fila apareceu: passada nova', [p.feitos, p.total, p.fim], [0, 100, null]);
p.feitos = 40;
p = A.avancarPassada(p, 70, T + 60000);
igual('a pasta cresceu: o total acompanha', [p.feitos, p.total], [40, 110]);
p.feitos = 110;
p = A.avancarPassada(p, 0, T + 120000);
igual('fila zerou: a passada termina', [p.total, !!p.fim], [110, true]);
igual('passada terminada fica até a próxima', A.avancarPassada(p, 0, T + 180000).fim, p.fim);
igual('passada nova depois da terminada', A.avancarPassada(p, 5, T + 240000).total, 5);

// ---------- o acompanhamento inteiro, com um banco de mentira ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-acomp-'));
try {
  const gravados = [];
  const doc = (caminho) => ({
    set: async (dados, opcoes) => { gravados.push({ caminho, dados, opcoes }); },
    collection: (n) => ({ doc: (id) => doc(caminho + '/' + n + '/' + id) }),
  });
  const db = { collection: (n) => ({ doc: (id) => doc(n + '/' + id) }) };
  let agora = T;
  const ac = A.criar({ db, controle: tmp, origem: 'G:\\x', agora: () => agora, freioMs: 45000 });
  ac.config({ modo: 'producao', tiposProducao: ['todos'], moverNaoIdentificados: true, emProducao: true });
  ac.varredura({ vistos: [{ rel: 'a.pdf', tam: 1, mtime: T - 600000 }], pendentes: ['a.pdf'], mapa: new Map(), estavelMs: 45000 });
  ac.lendo(['a.pdf']);
  ac.decisoes([arq, { acao: 'CONTEINER', rel: 'z.zip' }, { rel: 'n.pdf', nome: 'n.pdf', hash: 'n', acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', evidencias: [] }], 'PRODUCAO');
  ac.decisoes(null, 'PRODUCAO');               // nada: não derruba
  ac.varredura(null);                          // entrada ruim: engole o erro
  ac.situacao('sem-drive');
  const m = ac._montar();
  igual('montado: o modo e o config', [m.modo, m.config.emProducao, m.config.tiposProducao], ['producao', true, ['todos']]);
  igual('montado: listas', [m.ultimos.length, m.pendentes.length, m.erros.length], [1, 1, 0]);
  igual('montado: a passada andou', [m.passada.feitos, m.passada.total], [2, 1]);
  igual('montado: o alerta do Drive', m.alertas.map(a => a.tipo), ['drive']);
  igual('montado: o histórico do dia', [m.historico.partes, m.historico.itens], [1, 2]);
  await0();
  async function await0() {
    await ac._gravar();
    const principal = gravados.find(g => g.caminho === 'robo/arquivadorNovo');
    igual('grava só o campo painel (o config fica)', principal && principal.opcoes, { mergeFields: ['painel'] });
    const parte = gravados.find(g => /^robo\/arquivadorNovo\/dias\/\d{4}-\d{2}-\d{2}-0$/.test(g.caminho));
    igual('grava a parte 0 do dia', parte && parte.dados.itens.length, 2);
    const antes = gravados.length;
    await ac._gravar();
    igual('a parte que não mudou não é regravada', gravados.slice(antes).map(g => g.caminho), ['robo/arquivadorNovo', 'robo/arquivadorResumo']);
    // o resumo da janela do Drive (o contábil lê): sem o nome original do arquivo
    const res = gravados.filter(g => g.caminho === 'robo/arquivadorResumo').pop();
    igual('resumo do Drive: o modo, a situação, os números de hoje e o último sem o nome original', [res.dados.modo, res.dados.situacao, res.dados.hoje.arquivados, res.dados.paraResolver, res.dados.ultimo && Object.keys(res.dados.ultimo).includes('nome')], ['producao', 'sem-drive', 1, 1, false]);
    // 23/10/2026: o banco que não responde (o robô perdeu o Firestore às 13:18) não prende a gravação nem acumula a fila
    {
      const pedidos = [];
      const travado = { collection: () => ({ doc: () => ({ set: () => { pedidos.push(1); return new Promise(() => {}); }, collection: () => ({ doc: () => ({ set: () => { pedidos.push(1); return new Promise(() => {}); } }) }) }) }) };
      const dirT = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-acomp-'));
      let agoraT = T;
      const acT = A.criar({ db: travado, controle: dirT, origem: 'G:\\x', agora: () => agoraT, prazoMs: 50 });
      const t0 = Date.now();
      await acT._gravar();
      igual('banco travado: a gravação desiste no prazo', [Date.now() - t0 < 2000, pedidos.length], [true, 1]);
      agoraT += 10 * 60000;   // passou a pausa, mas o pedido de antes ainda não voltou: não manda outro
      await acT._gravar();
      igual('banco travado: o que não voltou segura as próximas (a fila não acumula)', pedidos.length, 1);
      await acT.parar();
    }
    // a parte aberta do histórico vai no máximo a cada 3 min (era a cada 45 s, com até 700 KB)
    {
      const g = [];
      const docT = (c) => ({ set: async () => { g.push(c); }, collection: (n) => ({ doc: (id) => docT(c + '/' + n + '/' + id) }) });
      const dbT = { collection: (n) => ({ doc: (id) => docT(n + '/' + id) }) };
      const dirT = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-acomp-'));
      let agoraT = T;
      const acT = A.criar({ db: dbT, controle: dirT, origem: 'G:\\x', agora: () => agoraT });
      acT.decisoes([arq], 'PRODUCAO'); await acT._gravar();
      const partes = () => g.filter(c => /\/dias\//.test(c)).length;
      const antes = partes();
      agoraT += 60000; acT.decisoes([Object.assign({}, arq, { hash: 'outro' })], 'PRODUCAO'); await acT._gravar();
      igual('histórico: a parte aberta não é regravada antes de 3 min', partes() - antes, 0);
      agoraT += 3 * 60000; await acT._gravar();
      igual('histórico: depois de 3 min, vai', partes() - antes, 1);
      await acT.parar();
    }
    // a varredura igual à anterior não grava de novo (só o batimento de 10 min)
    const g4 = [];
    const db4 = { collection: () => ({ doc: () => ({ set: async (d) => { if (d.painel) g4.push(d); }, collection: () => ({ doc: () => ({ set: async () => {} }) }) }) }) };
    let agora4 = T;
    const ac4 = A.criar({ db: db4, controle: fs.mkdtempSync(path.join(os.tmpdir(), 'teste-acomp-')), origem: 'G:\\x', agora: () => agora4, freioMs: 0 });
    const v4 = () => ({ vistos: [{ rel: 'a.pdf', tam: 1, mtime: T - 600000 }], pendentes: ['a.pdf'], mapa: new Map(), estavelMs: 45000 });
    const espera = () => new Promise(r => setTimeout(r, 15));
    ac4.varredura(v4()); await espera();
    agora4 += 60000; ac4.varredura(v4()); await espera();
    igual('varredura igual: uma gravação só', g4.length, 1);
    agora4 += 11 * 60000; ac4.varredura(v4()); await espera();
    igual('varredura igual depois de 10 min: o batimento grava', g4.length, 2);
    ac4.varredura({ vistos: [], pendentes: [], mapa: new Map() }); await espera();
    igual('a pasta mudou: grava', g4.length, 3);
    // a limpeza do histórico de mais de 24 meses (no PC e no banco), na primeira gravação e a cada virada do dia
    const dir5 = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-acomp-'));
    fs.writeFileSync(path.join(dir5, 'arquivados-2024-08-01.jsonl'), '{}\n');
    fs.writeFileSync(path.join(dir5, 'arquivados-2026-10-20.jsonl'), '{}\n');
    const apagados = [], filtros = [];
    const col5 = { doc: () => ({ set: async () => {} }), where: (c, op, v) => { filtros.push([c, op, v]); return { limit: () => ({ get: async () => ({ docs: [{ ref: { delete: async () => { apagados.push('2026-08-01-0'); } } }] }) }) }; } };
    const db5 = { collection: () => ({ doc: () => ({ set: async () => {}, collection: () => col5 }) }) };
    const ac5 = A.criar({ db: db5, controle: dir5, origem: 'G:\\x', agora: () => T });
    await ac5._gravar();
    igual('limpeza: o arquivo velho do PC sai, o recente fica', fs.readdirSync(dir5).filter(f => /^arquivados-/.test(f)), ['arquivados-2026-10-20.jsonl']);
    igual('limpeza: no banco, as partes de antes de 24 meses', [filtros[0] && filtros[0][0], filtros[0] && filtros[0][1], apagados.length], ['dia', '<', 1]);
    igual('o PC guarda o estado e o histórico', [fs.existsSync(path.join(tmp, 'acompanhamento.json')), fs.readdirSync(tmp).some(f => /^arquivados-.*\.jsonl$/.test(f))], [true, true]);
    // religar: as listas e o histórico voltam do PC
    const ac2 = A.criar({ db: null, controle: tmp, origem: 'G:\\x', agora: () => agora });
    const m2 = ac2._montar();
    igual('religado: as listas voltaram', [m2.ultimos.length, m2.pendentes.length, m2.historico.itens], [1, 1, 2]);
    // o dia virou: a contagem do dia zera, a do mês continua
    agora = T + 864e5;
    ac2.varredura({ vistos: [], pendentes: [], mapa: new Map() });
    const m3 = ac2._montar();
    igual('dia novo: contagem do dia zerada, a do mês não', [m3.hoje.porAcao.arquivou, m3.mes.porAcao.arquivou], [0, 1]);
    // partes: muitos itens viram várias partes
    const ac3 = A.criar({ db: null, controle: fs.mkdtempSync(path.join(os.tmpdir(), 'teste-acomp-')), origem: 'G:\\x', agora: () => agora });
    const muitos = Array.from({ length: 2500 }, (_, i) => Object.assign({}, arq, { hash: 'h' + i, nome: 'arquivo ' + i + ' com um nome comprido para encher a parte do dia.pdf', evidencias: ['a'.repeat(150), 'b'.repeat(150), 'c'.repeat(150), 'd'.repeat(150)] }));
    ac3.decisoes(muitos, 'PRODUCAO');
    const d3 = ac3._dia();
    igual('2.500 itens: mais de uma parte, nenhuma passa de 700 KB', [d3.partes.length > 1, d3.partes.every(pp => JSON.stringify(pp).length < 760 * 1024)], [true, true]);
    igual('as listas do painel têm teto', ac3._montar().ultimos.length, 50);
    fim();
  }
} catch (e) { falhas++; console.log('ERRO', e.stack); fim(); }

function fim() {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* temporário */ }
  console.log(falhas ? falhas + ' de ' + total + ' falharam' : 'ok: ' + total + ' testes');
  process.exitCode = falhas ? 1 : 0;
}
