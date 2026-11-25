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
//     { "583": { "token": "...", "empresaId": 900001, "clienteId": 1234 } } (empresaId e clienteId só se o token não trouxer);
//     para o teste, também vale "empresa": "<token>" (a empresa do comando testar).
const fs = require('fs');
const S = require('./gerado/sci');
const SCI = require('./sci');

const TOKENS_MS = 10 * 60 * 1000;
let guardados = null;

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
        return { parceiro: t.parceiro, empresa: token, empresaId: Number(e.empresaId) || undefined, clienteId: Number(e.clienteId) || undefined };
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
      await rh.liberarAdmissoes(ids, d.situacao === 'nao_liberado' ? 'nao_liberado' : 'liberado', String(d.observacao || ''));
      rhnet = { liberadas: ids.length };
      resumo = (d.situacao === 'nao_liberado' ? 'Voltou para não liberado: ' : 'Liberou para a folha: ') + ids.length + ' admissão(ões)';
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

// ---------- o teste pela linha de comando ----------

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

module.exports = { atenderPedido, testar, lerTokens };
