'use strict';
// O RH NET da SCI no robô (25/11/2026; o dono: "quero que deixe tudo pronto para suportar a rhnet"). DESLIGADO até alguém
// ligar a chave "RH NET (folha)" em Configurações › Integração SCI (config/sci.rhNet) e pôr a empresa na lista.
//
//   1. node robo/rhnet.js testar [código]   o teste SÓ DE LEITURA, para rodar quando os tokens chegarem: entra, mostra o
//                                            número da empresa no RH NET e quantos cadastros e admissões há. Não grava
//                                            nada e não mostra dado pessoal (nem nome de funcionário, nem CPF).
//   2. atenderPedido(db, pedido)            a fila do robô da nuvem (vigia-robo.js, solicitacoesEmail tipo 'rhnet'):
//        acao 'cadastros'          busca os cadastros da empresa (departamentos, funções, centros de custo, horários,
//                                  sindicatos) e quantas admissões há por situação;
//        acao 'admissao'           cadastra a admissão no RH NET SEM liberar (fica "não liberado" lá);
//        acao 'liberarAdmissao'    libera (vai para a folha do SCI) ou volta para não liberado;
//        acao 'lancamentos'        cadastra lançamentos da planilha (sem liberar);
//        acao 'liberarLancamentos' libera a competência.
//      Os dados pessoais do pedido (pedido.dados) são apagados do banco assim que o robô termina, dando certo (aqui) ou não
//      (a fila do vigia-robo.js apaga no erro).
//
// O RH NET só aceita o Token de Cliente DA EMPRESA (gerado no SCI WEB por um usuário dela, Módulo Cliente): um por empresa.
// Os tokens NUNCA ficam no git nem no banco:
//   - o de Parceiro: SCI_TOKEN_PARCEIRO, ou o metadado segredo-sci-parceiro da VM, ou "parceiro" em robo/sci_credenciais.json;
//   - os das empresas: o metadado segredo-sci-rhnet da VM, ou "rhnet" em robo/sci_credenciais.json, no formato
//     { "583": { "token": "..." } } (o número da empresa no RH NET é o código; "empresaId" só se o código no SCI for outro);
//     para o teste, também vale "empresa": "<token>" (a empresa do comando testar).
//   - (26/11/2026: "vai ter uma maneira mais simples de cadastrar token de api de clientes?") o token colado na tela de
//     Configurações › Integração SCI: chega EMBARALHADO em config/sciTokens (a tela usa a chave pública do core) e só este
//     robô desembaralha, com a chave privada do metadado segredo-sci-chave da VM (ou "chaveDosTokens" no arquivo). O da
//     tela vale por cima do metadado. Cada token novo é testado (só leitura) e o resultado vai para config/sciTokensTeste.
const fs = require('fs');
const S = require('./gerado/sci');
const SCI = require('./sci');

const TOKENS_MS = 10 * 60 * 1000;
let guardados = null;
/** os tokens da tela já desembaralhados, só na memória: { [codigo]: { token } } (iniciarTokensDaTela os mantém) */
let daTela = {};

/** { parceiro, empresas: { [codigo]: { token, empresaId?, clienteId? } }, avulso } dos lugares de sempre (nunca do banco). */
async function lerTokens() {
  if (guardados && Date.now() - guardados.em < TOKENS_MS) return guardados.valor;
  let arquivo = {};
  try { arquivo = JSON.parse(fs.readFileSync(SCI.ARQUIVO, 'utf8')) || {}; } catch (e) { /* sem arquivo */ }
  const parceiro = String(process.env.SCI_TOKEN_PARCEIRO || '').trim() || (await SCI.lerMetadado('segredo-sci-parceiro')).trim() || String(arquivo.parceiro || '').trim();
  let empresas = {};
  const meta = await SCI.lerMetadado('segredo-sci-rhnet');
  try { if (meta) empresas = JSON.parse(meta) || {}; } catch (e) { /* metadado torto: fica vazio */ }
  if (!Object.keys(empresas).length && arquivo.rhnet && typeof arquivo.rhnet === 'object') empresas = arquivo.rhnet;
  // o da tela vale por cima (mantém o empresaId/clienteId que o metadado tiver)
  for (const [codigo, e] of Object.entries(daTela)) empresas = { ...empresas, [codigo]: { ...(empresas[codigo] || {}), token: e.token } };
  const valor = { parceiro, empresas, avulso: String(arquivo.empresa || '').trim() };
  guardados = { em: Date.now(), valor };
  return valor;
}

const clientes = new Map();
/** O cliente do RH NET de uma empresa do nads (um JWT por empresa, na memória). */
function clienteDa(codigo, { aceitarAvulso = false } = {}) {
  const chave = String(codigo) + (aceitarAvulso ? '|avulso' : '');
  if (!clientes.has(chave)) {
    clientes.set(chave, S.criarClienteRhNet({
      buscar: SCI.buscar,
      tokens: async () => {
        const t = await lerTokens();
        const e = t.empresas[String(codigo)] || {};
        const token = String(e.token || '').trim() || (aceitarAvulso ? t.avulso : '');
        // o número da empresa no RH NET é o CÓDIGO da empresa no SCI (o primeiro teste, 25/11/2026: o 566483 que vem no token
        // é o do SCI WEB e o RH NET responde "Usuário não está vinculado a essa empresa"; com 590, o código, respondeu os dados).
        // O código do nads é o mesmo do SCI; se algum dia não for, "empresaId" no arquivo dos tokens manda
        return { parceiro: t.parceiro, empresa: token, empresaId: Number(e.empresaId) || Number(codigo) || undefined, clienteId: Number(e.clienteId) || undefined };
      },
    }));
  }
  return clientes.get(chave);
}

const motivo = err => String((err && err.message) || err || '').slice(0, 300);
const agora = () => new Date().toISOString();

/** Quantas admissões há em cada situação (só números). */
function contarPorSituacao(admissoes) {
  const porSituacao = {};
  for (const a of admissoes) { const s = a.situacao || 'sem situação'; porSituacao[s] = (porSituacao[s] || 0) + 1; }
  return porSituacao;
}

/** A fila: um pedido do nads ao RH NET. Joga erro (a fila grava o erro no pedido) e sempre apaga os dados pessoais. */
async function atenderPedido(db, p) {
  const fim = { dados: null };
  try {
    const cfg = await SCI.config(db);
    if (!cfg.rhNet) throw new Error('o RH NET está desligado em Configurações › Integração SCI');
    if (!S.empresaNoSci(cfg, p.codigo)) throw new Error('a empresa ' + p.codigo + ' não está na lista do SCI em Configurações › Integração SCI');
    const rh = clienteDa(p.codigo);
    const d = p.dados && typeof p.dados === 'object' ? p.dados : {};
    let rhnet;
    let resumo;
    if (p.acao === 'cadastros') {
      const cadastros = await rh.cadastros();
      const admissoes = await rh.admissoes();
      rhnet = { cadastros, admissoes: contarPorSituacao(admissoes), empresaId: (await rh.identificacao()).empresaId };
      resumo = S.resumoDosCadastros(cadastros) + ' · Admissões ' + admissoes.length;
    } else if (p.acao === 'admissao') {
      const criada = await rh.criarAdmissao(d.admissao || {});
      rhnet = { admissao: criada };
      resumo = 'Admissão de ' + criada.primeiroNome + ' no RH NET (não liberada)';
    } else if (p.acao === 'liberarAdmissao') {
      const ids = (Array.isArray(d.ids) ? d.ids : [d.id]).map(Number).filter(n => n > 0);
      if (!ids.length) throw new Error('falta o funcionário a liberar');
      const chamadoRef = d.chamadoId && typeof d.chamadoId === 'string' ? db.collection('chamados').doc(d.chamadoId) : null;
      try {
        await rh.liberarAdmissoes(ids, d.situacao === 'nao_liberado' ? 'nao_liberado' : 'liberado', String(d.observacao || ('Liberado pelo nads (' + String(p.criadoPor || 'escritório') + ')')).slice(0, 250));
      } catch (err) {
        // (26/11/2026) o RH NET só libera com o cadastro completo: as pendências aparecem na solicitação
        if (chamadoRef) await chamadoRef.update({ 'rhnet.erroLiberacao': motivo(err), 'rhnet.tentouEm': agora() }).catch(() => {});
        throw err;
      }
      rhnet = { liberadas: ids.length };
      // (26/11/2026: "eu tenho que ter como aprovar pelo nads") a solicitação da Área que pediu a admissão mostra a liberação
      if (d.chamadoId && typeof d.chamadoId === 'string') {
        await db.collection('chamados').doc(d.chamadoId).update({ 'rhnet.situacao': d.situacao === 'nao_liberado' ? 'nao_liberado' : 'liberado', 'rhnet.liberadoEm': agora(), 'rhnet.liberadoPor': String(p.criadoPor || ''), 'rhnet.erroLiberacao': '' }).catch(() => {});
      }
      resumo = (d.situacao === 'nao_liberado' ? 'Voltou para não liberado: ' : 'Liberou para a folha: ') + ids.length + ' admissão(ões)';
    } else if (p.acao === 'excluirAdmissao') {
      // (27/11/2026: "Pode pôr") apaga a admissão no RH NET; só a desta empresa e antes de ir para a folha
      const id = Number(d.id) || 0;
      const da = (await rh.admissoes()).find(x => x.id === id);
      if (!da) throw new Error('a admissão não está no RH NET desta empresa');
      if (!S.podeApagarNoRhNet(da.situacao || 'nao_liberado')) throw new Error('a admissão já foi para a folha: apague pelo SCI do escritório');
      await rh.excluirAdmissao(id);
      if (d.chamadoId && typeof d.chamadoId === 'string') await db.collection('chamados').doc(d.chamadoId).update({ 'rhnet.situacao': 'excluido', 'rhnet.excluidoEm': agora(), 'rhnet.excluidoPor': String(p.criadoPor || '') }).catch(() => {});
      gravadoNaNuvem.delete(Number(p.codigo));
      rhnet = { excluida: id };
      resumo = 'Apagou a admissão ' + id + ' do RH NET';
    } else if (p.acao === 'lancamentos') {
      const n = await rh.criarLancamentos(Array.isArray(d.lancamentos) ? d.lancamentos : [], d.tipo || 'normais');
      rhnet = { lancamentos: n };
      resumo = n + ' lançamento(s) no RH NET (não liberados)';
    } else if (p.acao === 'liberarLancamentos') {
      await rh.liberarLancamentos(String(d.competencia || ''), d.situacao === 'nao_liberado' ? 'nao_liberado' : 'liberado', d.tipo || 'normais', Number(d.funcionarioId) || undefined);
      rhnet = { competencia: String(d.competencia || '') };
      resumo = 'Liberou os lançamentos de ' + String(d.competencia || '') + ' para a folha';
    } else throw new Error('ação do RH NET desconhecida: ' + p.acao);
    return Object.assign(fim, { status: 'concluido', concluidoEm: agora(), resumo, rhnet });
  } catch (err) { throw new Error(motivo(err)); }
}

// ---------- a Área do Cliente ----------
// (25/11/2026; o dono: "pode ser") Os tokens ficam SÓ na nuvem: o robô da nuvem busca no RH NET de hora em hora e grava a
// lista pronta (sem token e sem salário) em rhnetArea/{codigo}; o robô do servidor (area-cliente.js) só lê essa lista e copia
// para a aba Departamento pessoal. Assim o NILMA-SERVER nunca precisa dos tokens da SCI.

const COLECAO_DA_AREA = 'rhnetArea';
const HORA_MS = 60 * 60 * 1000;
const LEITURA_MS = 15 * 60 * 1000;

const gravadoNaNuvem = new Map();
/** Uma passada do robô da nuvem: a lista de cada empresa ligada; grava só o que mudou; tira a das empresas que saíram. */
async function atualizarListasDaArea(db, log = () => {}) {
  const cfg = await SCI.config(db);
  const t = await lerTokens().catch(() => null);
  const ligadas = cfg.rhNet && t && t.parceiro ? cfg.empresas.filter(c => (t.empresas[String(c)] || {}).token) : [];
  let gravadas = 0;
  for (const codigo of ligadas) {
    try {
      const lista = await clienteDa(codigo).cadastrosParaArea();
      // (26/11/2026: "funcao selecionavel puxando do rh net pois os cargos sao variaveis e criados por empresa") os nomes
      // das funções da empresa no RH NET, para o Cargo da admissão na Área ser escolhido da lista
      const cargos = await clienteDa(codigo).cadastros().then(c => S.cargosParaArea(c.funcoes)).catch(() => []);
      const marca = JSON.stringify([lista, cargos]);
      if (gravadoNaNuvem.get(codigo) === marca) continue;
      await db.collection(COLECAO_DA_AREA).doc(String(codigo)).set({ codigo, lista, cargos, em: new Date().toISOString() });
      await acompanharAdmissoes(db, codigo, log);
      gravadoNaNuvem.set(codigo, marca);
      gravadas++;
    } catch (err) { log('RH NET: não consegui ler as pessoas da empresa', codigo, 'para a Área do Cliente -', motivo(err)); }
  }
  // a empresa que saiu da lista (ou o RH NET desligado): a lista dela some do banco
  const antes = (await db.collection(COLECAO_DA_AREA).select().get()).docs.map(d => d.id);
  for (const id of antes) if (!ligadas.includes(Number(id))) { await db.collection(COLECAO_DA_AREA).doc(id).delete().catch(() => {}); gravadoNaNuvem.delete(Number(id)); }
  if (gravadas) log('RH NET: a lista da Área do Cliente de', gravadas, 'empresa(s) mudou');
  return gravadas;
}

/** O robô da nuvem: uma passada um minuto depois de ligar e depois de hora em hora (só age com config/sci.rhNet). */
function iniciarListasDaArea(db, log = () => {}) {
  const rodar = () => atualizarListasDaArea(db, log).catch(err => log('RH NET: a lista da Área do Cliente deu erro -', motivo(err)));
  setTimeout(rodar, 60 * 1000);
  setInterval(rodar, HORA_MS);
  log('RH NET: a lista da Área do Cliente ligada (só age com config/sci.rhNet)');
}

const lidoNoServidor = new Map();
/**
 * O robô do servidor (area-cliente.js): as pessoas do RH NET das empresas do link, lidas de rhnetArea/{codigo} (o que o robô
 * da nuvem grava): o nome, o CPF mascarado, o tipo, a entrada e a situação, sem salário. null = desligado (config/sci.rhNet
 * ou nenhuma empresa do link na lista). Uma leitura por empresa a cada 15 minutos; nunca joga erro.
 */
async function cadastrosParaArea(db, codigos, log = () => {}) {
  let cfg;
  try { cfg = await SCI.config(db); } catch (e) { return null; }
  if (!cfg.rhNet) return null;
  const todos = [];
  let algum = false;
  for (const codigo of codigos || []) {
    if (!S.empresaNoSci(cfg, codigo)) continue;
    algum = true;
    const guardado = lidoNoServidor.get(Number(codigo));
    if (guardado && Date.now() - guardado.em < LEITURA_MS) { todos.push(...guardado.lista); continue; }
    try {
      const d = await db.collection(COLECAO_DA_AREA).doc(String(codigo)).get();
      const lista = d.exists && Array.isArray(d.get('lista')) ? d.get('lista') : [];
      const cargos = d.exists && Array.isArray(d.get('cargos')) ? d.get('cargos') : [];
      lidoNoServidor.set(Number(codigo), { em: Date.now(), lista, cargos });
      todos.push(...lista);
    } catch (err) {
      log('RH NET: não consegui ler a lista da empresa', codigo, 'para a Área do Cliente -', motivo(err));
      if (guardado) todos.push(...guardado.lista);
    }
  }
  return algum ? todos : null;
}

// ---------- o cadastro completo (26/11/2026: "quero verificacao na tela de registro, que nao deixa nem passar") ----------
// O RH NET só libera com o cadastro completo. O que a tela da Área não sabe em código, o robô completa: o código IBGE da
// cidade do endereço (pelo CEP, no ViaCEP) e o da cidade de nascimento (pela lista de municípios da UF, no IBGE); e, quando
// a empresa tem um só sindicato e um só quadro de horário no RH NET, esses dois. O resto o escritório completa no RH NET.
const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/';
const municipios = new Map();
async function buscarJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function completarAdmissao(r, cadastros, log = () => {}) {
  const a = r.admissao;
  const c = r.cidades || {};
  try {
    if (c.endereco && a.endereco) {
      const v = await buscarJson('https://viacep.com.br/ws/' + String(c.endereco.cep).replace(/\D/g, '') + '/json/');
      if (v && /^\d{7}$/.test(String(v.ibge || ''))) a.endereco.cidadeIbge = Number(v.ibge);
    }
  } catch (err) { log('RH NET: não achei a cidade do CEP da admissão -', motivo(err)); }
  const pelaLista = async (cidade) => {
    if (!cidade || !/^[A-Z]{2}$/.test(cidade.uf)) return 0;
    if (!municipios.has(cidade.uf)) municipios.set(cidade.uf, (await buscarJson(IBGE + cidade.uf + '/municipios')).map(m => ({ id: Number(m.id), nome: String(m.nome) })));
    return S.codigoIbgeDaCidade(municipios.get(cidade.uf), cidade.nome);
  };
  try {
    // o CEP geral da cidade (39400-000) o ViaCEP não acha: vai pelo nome e a UF
    if (c.endereco && a.endereco && !a.endereco.cidadeIbge) { const id = await pelaLista(c.endereco); if (id) a.endereco.cidadeIbge = id; }
    const id = await pelaLista(c.nascimento);
    if (id) a.nascimentoCidadeIbge = id;
  } catch (err) { log('RH NET: não achei uma cidade da admissão no IBGE -', motivo(err)); }
  if (!a.sindicatoId && cadastros.sindicatos.length === 1) a.sindicatoId = cadastros.sindicatos[0].id;
  if (!a.quadroHorarioId && cadastros.quadrosHorario.length === 1) a.quadroHorarioId = cadastros.quadrosHorario[0].id;
}

/**
 * A situação de cada admissão pedida pela Área acompanha o RH NET (26/11/2026: "pesquisa como faz no rh net e faz baseado
 * nisso"): liberado → aguardando integração → integrado, ou recusado (só o SCI do escritório marca). Uma leitura das
 * admissões da empresa e das solicitações de admissão dela; grava só o que mudou.
 */
async function acompanharAdmissoes(db, codigo, log = () => {}) {
  try {
    const chamados = await db.collection('chamados').where('tipo', '==', 'admissao').where('codigos', 'array-contains', String(codigo)).get();
    const comId = chamados.docs.filter(c => Number((c.get('rhnet') || {}).id) > 0);
    if (!comId.length) return;
    const situacoes = new Map((await clienteDa(codigo).admissoes()).map(a => [a.id, a.situacao]));
    for (const c of comId) {
      const r = c.get('rhnet') || {};
      const nova = situacoes.get(Number(r.id));
      if (nova && nova !== r.situacao && !(r.situacao === 'cadastrado' && nova === 'nao_liberado')) await c.ref.update({ 'rhnet.situacao': nova, 'rhnet.vistoEm': agora() });
    }
  } catch (err) { log('RH NET: não consegui acompanhar as admissões da empresa', codigo, '-', motivo(err)); }
}

/** Os cargos (as funções do RH NET) das empresas do link, do que o cadastrosParaArea acabou de ler (sem ler de novo). */
function cargosParaArea(codigos) {
  const todos = new Set();
  for (const codigo of codigos || []) for (const c of (lidoNoServidor.get(Number(codigo)) || {}).cargos || []) todos.add(String(c));
  return [...todos].sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 300);
}

// ---------- o pedido de admissão da Área do Cliente (o robô da nuvem) ----------
// (25/11/2026; o dono: "pode fazer a 1") O cliente pede a admissão pela Área ("Solicitar admissão"); o robô do servidor vira
// o pedido em chamados/{id} (tipo 'admissao'). Aqui, para a empresa ligada (config/sci.rhNet, na lista e com o token dela),
// o pedido vai para o RH NET SEM LIBERAR: o DP confere e libera no SCI. O chamado ganha rhnet { situacao, id, erro, em }
// (só a equipe vê; a Área não copia esse campo). Marca antes de mandar (transação): nunca manda duas vezes, nem tenta de novo
// sozinho o que deu erro. Pedido com mais de 7 dias não vai (o religar do robô não manda os antigos).

const PRAZO_DO_PEDIDO_MS = 7 * 24 * HORA_MS;
let filaDasAdmissoes = Promise.resolve();

async function atenderAdmissaoDaArea(db, ref, log = () => {}) {
  const c = (await ref.get()).data() || {};
  if (c.tipo !== 'admissao' || c.rhnet || !(Date.now() - Date.parse(String(c.criadoEm || '')) < PRAZO_DO_PEDIDO_MS)) return null;
  const cfg = await SCI.config(db);
  const codigo = Number((Array.isArray(c.codigos) ? c.codigos : [])[0]) || 0;
  if (!cfg.rhNet || !S.empresaNoSci(cfg, codigo)) return null;
  const t = await lerTokens().catch(() => null);
  if (!t || !t.parceiro || !(t.empresas[String(codigo)] || {}).token) return null;
  const marcou = await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.get('rhnet')) return false;
    tx.update(ref, { rhnet: { situacao: 'enviando', em: agora() } });
    return true;
  });
  if (!marcou) return null;
  const texto = String(((Array.isArray(c.mensagens) ? c.mensagens : [])[0] || {}).texto || '');
  const rh = clienteDa(codigo);
  try {
    const cadastros = await rh.cadastros();
    const r = S.admissaoDoPedidoDaArea(texto, cadastros.funcoes);
    if (!r.erro) await completarAdmissao(r, cadastros, log);
    if (r.erro) {
      await ref.update({ rhnet: { situacao: 'nao-enviado', erro: r.erro, em: agora() } });
      log('RH NET: o pedido de admissão', ref.id, 'da empresa', codigo, 'não foi ao RH NET -', r.erro);
      return 'nao-enviado';
    }
    // (26/11/2026: "coloca aqui para a pessoa mesmo liberar, ela vai terminar de preencher os 36 campos e ela libera para o
    // cara do dp importar") o pedido que completa uma admissão já no RH NET: só se ela é desta empresa e ainda não foi
    // liberada; troca o cadastro inteiro (PUT) e libera para o DP importar
    if (r.idNoRhNet) {
      const da = (await rh.admissoes()).find(x => x.id === r.idNoRhNet);
      if (!da || (da.situacao !== 'nao_liberado' && da.situacao !== '')) {
        const erro = !da ? 'a admissão não é desta empresa no RH NET' : 'a admissão já foi liberada';
        await ref.update({ rhnet: { situacao: 'nao-enviado', erro, em: agora() } });
        return 'nao-enviado';
      }
      await rh.atualizarAdmissao(r.idNoRhNet, r.admissao);
      try {
        await rh.liberarAdmissoes([r.idNoRhNet], 'liberado', 'Completado e liberado pelo cliente na Área do Cliente');
        await ref.update({ rhnet: { situacao: 'liberado', id: r.idNoRhNet, liberadoPor: 'o cliente', liberadoEm: agora(), em: agora() } });
        log('RH NET: a admissão', r.idNoRhNet, 'da empresa', codigo, 'foi completada e liberada pelo cliente');
      } catch (err) {
        await ref.update({ rhnet: { situacao: 'nao_liberado', id: r.idNoRhNet, erroLiberacao: motivo(err), em: agora() } });
        log('RH NET: a admissão', r.idNoRhNet, 'da empresa', codigo, 'foi completada, mas não liberou -', motivo(err));
      }
      gravadoNaNuvem.delete(codigo);
      atualizarListasDaArea(db, log).catch(() => {});
      return 'cadastrado';
    }
    const criada = await rh.criarAdmissao(r.admissao);
    await ref.update({ rhnet: { situacao: 'cadastrado', id: criada.id, em: agora() } });
    log('RH NET: o pedido de admissão', ref.id, 'da empresa', codigo, 'foi para o RH NET (não liberado, id', criada.id + ')');
    // a lista da Área já mostra a pessoa "Em admissão"
    gravadoNaNuvem.delete(codigo);
    atualizarListasDaArea(db, log).catch(() => {});
    return 'cadastrado';
  } catch (err) {
    await ref.update({ rhnet: { situacao: 'erro', erro: motivo(err), em: agora() } }).catch(() => {});
    log('RH NET: o pedido de admissão', ref.id, 'da empresa', codigo, 'deu erro no RH NET -', motivo(err));
    return 'erro';
  }
}

/** O robô da nuvem: acompanha os chamados de admissão (só os que chegam ou mudam; um de cada vez). */
function iniciarAdmissoesDaArea(db, log = () => {}) {
  const { ouvir } = require('./ouvinte');
  ouvir('RH NET: admissões da Área do Cliente', () => db.collection('chamados').where('tipo', '==', 'admissao'), snap => {
    const mudados = typeof snap.docChanges === 'function' ? snap.docChanges().filter(m => m.type !== 'removed').map(m => m.doc) : snap.docs;
    for (const d of mudados) {
      if (d.get('rhnet')) continue;
      filaDasAdmissoes = filaDasAdmissoes.then(() => atenderAdmissaoDaArea(db, d.ref, log)).catch(err => log('RH NET: admissão da Área -', motivo(err)));
    }
  }, log);
  log('RH NET: os pedidos de admissão da Área do Cliente ligados (só agem com config/sci.rhNet)');
}

// ---------- o teste pela linha de comando ----------

/** A chave privada que desembaralha os tokens da tela: o metadado segredo-sci-chave, senão "chaveDosTokens" no arquivo. */
async function chaveDosTokens() {
  const meta = await SCI.lerMetadado('segredo-sci-chave');
  if (meta) return meta;
  try { return String(JSON.parse(fs.readFileSync(SCI.ARQUIVO, 'utf8')).chaveDosTokens || '').trim(); } catch (e) { return ''; }
}

/** Testa (só leitura) o token de uma empresa: entra e conta os cadastros. Devolve { ok, texto } sem dado pessoal. */
async function testarToken(codigo, token, parceiro) {
  const rh = S.criarClienteRhNet({ buscar: SCI.buscar, tokens: async () => ({ parceiro, empresa: token, empresaId: Number(codigo) || undefined }) });
  try {
    await rh.identificacao();
    return { ok: true, texto: S.resumoDosCadastros(await rh.cadastros()) };
  } catch (err) { return { ok: false, texto: motivo(err) }; }
}

/**
 * Os tokens colados na tela (26/11/2026), só no robô da nuvem: ouve config/sciTokens, desembaralha cada um, guarda na
 * memória (daTela) e testa os que mudaram desde o último teste, gravando o resultado em config/sciTokensTeste. Sem a chave
 * privada, avisa no log e não faz nada (os tokens do metadado continuam valendo).
 */
function iniciarTokensDaTela(db, log = () => {}) {
  const { ouvir } = require('./ouvinte');
  if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = require('crypto').webcrypto;
  const refTeste = db.collection('config').doc('sciTokensTeste');
  let fila = Promise.resolve();
  ouvir('RH NET: tokens da tela', () => db.collection('config').doc('sciTokens'), snap => {
    fila = fila.then(async () => {
      const tokens = S.tokensDoDocumento(snap.exists ? snap.data() : null);
      const chave = Object.keys(tokens).length ? await chaveDosTokens() : '';
      if (Object.keys(tokens).length && !chave) { log('RH NET: há tokens na tela, mas falta a chave (metadado segredo-sci-chave)'); return; }
      const novos = {};
      for (const [codigo, t] of Object.entries(tokens)) {
        try { novos[codigo] = { token: (await S.decifrarToken(t.cifrado, chave)).trim(), em: t.em }; }
        catch (err) { log('RH NET: não deu para ler o token da tela da empresa ' + codigo + ' (chave trocada?)'); }
      }
      daTela = novos;
      guardados = null;
      clientes.clear();
      const testes = S.testesDoDocumento((await refTeste.get()).data());
      const paraTestar = S.tokensParaTestar(tokens, testes);
      if (!paraTestar.length) return;
      const { parceiro } = await lerTokens();
      const empresas = {};
      for (const codigo of paraTestar) {
        const r = !novos[codigo] ? { ok: false, texto: 'o robô não conseguiu ler o token gravado; cole de novo' }
          : !parceiro ? { ok: false, texto: 'falta o Token de Parceiro no robô' }
            : await testarToken(codigo, novos[codigo].token, parceiro);
        empresas[codigo] = { ...r, em: agora(), doToken: tokens[codigo].em };
        log('RH NET: token da tela da empresa ' + codigo + (r.ok ? ' funcionando' : ' não funcionou - ' + r.texto));
      }
      await refTeste.set({ empresas }, { merge: true });
    }).catch(err => log('RH NET: tokens da tela deram erro -', motivo(err)));
  }, log);
}

async function testar(codigo) {
  const t = await lerTokens();
  console.log('RH NET: o teste só de leitura' + (codigo ? ' da empresa ' + codigo : ''));
  console.log('  Token de Parceiro: ' + (t.parceiro ? 'achado' : 'NÃO achado (SCI_TOKEN_PARCEIRO, metadado segredo-sci-parceiro ou "parceiro" em robo/sci_credenciais.json)'));
  const temDaEmpresa = !!((t.empresas[String(codigo)] || {}).token || t.avulso);
  console.log('  Token da empresa: ' + (temDaEmpresa ? 'achado' : 'NÃO achado ("rhnet" ou "empresa" em robo/sci_credenciais.json)'));
  if (!t.parceiro || !temDaEmpresa) return 1;
  const rh = clienteDa(codigo || 'teste', { aceitarAvulso: true });
  try {
    const { empresaId, clienteId } = await rh.identificacao();
    console.log('  Entrou. Empresa no RH NET: ' + empresaId + (clienteId ? ' · contabilidade: ' + clienteId : ''));
    const cadastros = await rh.cadastros();
    console.log('  Cadastros: ' + S.resumoDosCadastros(cadastros));
    for (const k of ['departamentos', 'funcoes']) if (cadastros[k].length) console.log('    ' + k + ': ' + cadastros[k].slice(0, 8).map(x => x.nome).join(', ') + (cadastros[k].length > 8 ? ', …' : ''));
    const admissoes = await rh.admissoes();
    console.log('  Admissões: ' + admissoes.length + (admissoes.length ? ' (' + Object.entries(contarPorSituacao(admissoes)).map(([s, n]) => (S.ROTULO_DA_SITUACAO_RH[s] || s) + ' ' + n).join(', ') + ')' : ''));
    console.log('Pronto: nada foi gravado no RH NET.');
    return 0;
  } catch (err) {
    console.log('  Não deu: ' + motivo(err));
    return 1;
  }
}

if (require.main === module) {
  const [comando, codigo] = process.argv.slice(2);
  if (comando !== 'testar') { console.log('uso: node robo/rhnet.js testar [código da empresa]'); process.exit(2); }
  testar(codigo).then(c => process.exit(c), err => { console.log('erro: ' + motivo(err)); process.exit(1); });
}

module.exports = { atenderPedido, cadastrosParaArea, cargosParaArea, atualizarListasDaArea, iniciarListasDaArea, atenderAdmissaoDaArea, iniciarAdmissoesDaArea, iniciarTokensDaTela, testar, lerTokens };
