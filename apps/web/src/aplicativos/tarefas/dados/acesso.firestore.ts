// O acesso ao nads no banco do Entregas (com o login de lá):
//   config/nads                     { protecaoLogin }  — a proteção do login (só o admin grava)
//   nadsPedidos/{id}                o pedido de liberação de um login (a pessoa cria; o admin aprova ou recusa)
//   nadsPedidos/{id}/codigo/atual   { codigo }         — o código de 6 dígitos (só o admin lê e grava)
//   nadsSessoes/{uid}_{authTime}    o login liberado (a pessoa cria com o código; as regras conferem; o admin revoga:
//                                   a sessão some, o pedido vira 'revogado' e o código é apagado)
//   usuarios/{uid}                  a equipe: departamento, nível, papéis (roles) e ativo (só o admin grava)
//   nadsPresenca/{uid}              { vistoEm, onde } — o ponto do online e a etapa do Contábil (a própria pessoa grava;
//                                   só a tela de Usuários escuta)
// As regras do Entregas (firestore.rules) só deixam ler e gravar os dados do nads (rotinas, cadastro) com o login
// liberado, quando a proteção está ligada; o admin não precisa de liberação.
import { usuarios as u } from '@nads/core';
import { addDoc as addDocBruto, collection, collectionGroup, deleteDoc as deleteDocBruto, deleteField, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc as setDocBruto, Timestamp, updateDoc as updateDocBruto, where, writeBatch as writeBatchBruto, limit } from 'firebase/firestore';
import type { RepoAcesso } from './acesso';
import { bancoDoEntregas, criarLoginNoEntregas, horaDoLogin } from './entregas.firestore';
import { guardar, guardarLote, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

type Quem = { uid: string; nome: string; email: string; admin: boolean } | null;

const DIA = 24 * 60 * 60 * 1000;
/** O código do convite: 32 letras e números ao acaso (como o do Entregas, um UUID sem os traços). */
const novoCodigo = () => crypto.randomUUID().replace(/-/g, '');
// o último ponto do online gravado por esta aba (ms): o ponto e o sinal da etapa não gravam um logo depois do outro
let ultimoPonto = 0;
// o banco negou nadsPresenca (a regra ainda não está no ar): o ponto volta para usuarios até recarregar
let presencaSemRegra = false;

export function criarAcessoFirestore(quem: () => Quem): RepoAcesso {
  // o registro das alterações sensíveis (22/11/2026, ficha E20; o dono: "pode fazer tudo"): na auditoria, depois da ação;
  // se o registro falhar, a ação já foi (o trabalho nunca trava por causa dele)
  const registrar = (acao: u.AcaoDoRegistro, detalhe: string) => {
    const q = quem();
    if (!q) return;
    addDoc(collection(bancoDoEntregas(), 'auditoria'), u.linhaDoRegistro(acao, q, detalhe, new Date())).catch(e => console.warn('[nads] o registro não gravou', acao, e instanceof Error ? e.message : e));
  };
  const nomeDe = (uid: string) => String(equipe.docs[uid]?.nome || 'alguém');
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let config = { carregada: false, protecao: false };
  let sessao = { carregada: false, liberada: false };
  let pedido: u.PedidoDeLiberacao | null = null;
  let pendentes: u.PedidoDeLiberacao[] = [];
  let sessoes: u.SessaoLiberada[] = [];
  let equipe: { carregada: boolean; lista: u.Usuario[]; docs: Record<string, u.DocUsuario> } = { carregada: false, lista: [], docs: {} };
  let authTime = '';
  let ouvindoDe = '';
  const paradas: (() => void)[] = [];
  let presencas: Record<string, u.DocPresenca> = {};
  let ouvindoPresencas = 0;
  let pararPresencas: (() => void) | null = null;

  /**
   * Grava o ponto em nadsPresenca/{uid}. Sem a regra de nadsPresenca no ar (o banco nega), grava como antes, em
   * usuarios/{uid}, e esta aba não tenta mais o novo até recarregar.
   */
  async function gravarPonto(uid: string, novo: Record<string, unknown>, antigo: Record<string, unknown>) {
    if (!presencaSemRegra) {
      try { await setDoc(doc(db, 'nadsPresenca', uid), novo, { merge: true }); return; } catch (e) {
        if ((e as { code?: string }).code !== 'permission-denied') throw e;
        presencaSemRegra = true;
      }
    }
    await updateDoc(doc(db, 'usuarios', uid), antigo);
  }

  /** Começa a ouvir o que é da pessoa logada (e, se for admin, o que é do admin); troca quando a pessoa troca. */
  function ouvir() {
    const q = quem();
    const chave = q ? q.uid + (q.admin ? ':admin' : '') : '';
    if (chave === ouvindoDe) return;
    ouvindoDe = chave;
    paradas.splice(0).forEach(f => f());
    sessao = { carregada: false, liberada: false };
    pedido = null;
    if (!q) return;
    paradas.push(onSnapshot(doc(db, 'config', 'nads'), s => { config = { carregada: true, protecao: (s.data() || {}).protecaoLogin === true }; mudou(); },
      () => { config = { carregada: true, protecao: false }; mudou(); }));
    horaDoLogin().then(t => {
      authTime = t;
      if (!t) { sessao = { carregada: true, liberada: false }; mudou(); return; }
      paradas.push(onSnapshot(doc(db, 'nadsSessoes', u.idDaSessao(q.uid, t)), s => { sessao = { carregada: true, liberada: s.exists() }; mudou(); },
        () => { sessao = { carregada: true, liberada: false }; mudou(); }));
      paradas.push(onSnapshot(query(collection(db, 'nadsPedidos'), where('uid', '==', q.uid), where('authTime', '==', t)), s => {
        const lista = s.docs.map(d => u.pedidoDoDocumento(d.id, d.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
        pedido = lista[0] || null;
        mudou();
      }, () => {}));
    });
    if (q.admin) {
      paradas.push(onSnapshot(query(collection(db, 'nadsPedidos'), where('status', '==', 'pendente')), s => {
        pendentes = s.docs.map(d => u.pedidoDoDocumento(d.id, d.data())).filter(p => !u.pedidoVencido(p) && p.uid !== q.uid).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
        mudou();
      }, () => {}));
      paradas.push(onSnapshot(query(collection(db, 'nadsSessoes'), orderBy('liberadoEm', 'desc'), limit(300)), s => {
        sessoes = s.docs.map(d => u.sessaoDoDocumento(d.id, d.data()));
        mudou();
      }, () => {}));
    }
    paradas.push(onSnapshot(collection(db, 'usuarios'), s => {
      // o ponto de presença de cada pessoa, a cada 10 min, não redesenha o app de todos: a tela de Usuários lê no relógio dela
      const soOPonto = equipe.carregada && s.docChanges().every(ch => ch.type === 'modified' && u.mudouSoOPonto(equipe.docs[ch.doc.id], ch.doc.data() as u.DocUsuario));
      const docs: Record<string, u.DocUsuario> = {};
      s.docs.forEach(d => { docs[d.id] = d.data() as u.DocUsuario; });
      equipe = { carregada: true, lista: Object.entries(docs).map(([id, d]) => u.lerUsuario(id, d)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), docs };
      if (!soOPonto) mudou();
    }, () => { equipe = { carregada: true, lista: [], docs: {} }; mudou(); }));
  }

  const eu = () => { const q = quem(); if (!q) throw new Error('entre com a conta do Entregas'); return q; };

  return {
    exemplos: false,
    config: () => { ouvir(); return config; },
    async gravarProtecao(ligada) {
      const q = eu();
      await setDoc(doc(db, 'config', 'nads'), { protecaoLogin: ligada, atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome }, { merge: true });
    },
    minhaSessao: () => { ouvir(); return sessao; },
    meuPedido: () => { ouvir(); return pedido; },
    async pedir(computador) {
      const q = eu();
      const t = authTime || await horaDoLogin();
      await addDoc(collection(db, 'nadsPedidos'), { uid: q.uid, nome: q.nome, email: q.email, computador, authTime: t, status: 'pendente', criadoEm: new Date().toISOString() });
    },
    async confirmar(codigo) {
      const q = eu();
      const t = authTime || await horaDoLogin();
      if (!pedido || pedido.status !== 'aprovado') throw new Error('o pedido ainda não foi aprovado');
      if (u.codigoVencido(pedido)) throw new Error('o código venceu');
      await setDoc(doc(db, 'nadsSessoes', u.idDaSessao(q.uid, t)), {
        uid: q.uid, nome: q.nome, email: q.email, computador: pedido.computador, pedidoId: pedido.id, codigo: u.codigoDigitado(codigo), liberadoEm: new Date().toISOString(),
      });
    },
    pendentes: () => { ouvir(); return pendentes; },
    async aprovar(p) {
      const q = eu();
      const codigo = u.codigoNovo();
      const b = writeBatch(db);
      b.set(doc(db, 'nadsPedidos', p.id, 'codigo', 'atual'), { codigo });
      b.update(doc(db, 'nadsPedidos', p.id), {
        status: 'aprovado', aprovadoPor: q.nome, aprovadoPorUid: q.uid, aprovadoEm: new Date().toISOString(),
        // o código só vale por um tempo (as regras conferem com a hora do servidor)
        validoAte: Timestamp.fromMillis(Date.now() + u.PRAZO_DO_CODIGO_MS),
      });
      await b.commit();
      registrar('acesso-liberado', p.nome + ' · ' + p.computador);
      return codigo;
    },
    async recusar(p) {
      const q = eu();
      await updateDoc(doc(db, 'nadsPedidos', p.id), { status: 'recusado', aprovadoPor: q.nome, aprovadoEm: new Date().toISOString() });
      registrar('acesso-recusado', p.nome + ' · ' + p.computador);
    },
    sessoes: () => { ouvir(); return sessoes; },
    async revogar(s) {
      const q = eu();
      const b = writeBatch(db);
      b.delete(doc(db, 'nadsSessoes', s.id));
      // o código daquele pedido deixa de valer: para entrar de novo, outro pedido e outro código
      if (s.pedidoId) {
        b.update(doc(db, 'nadsPedidos', s.pedidoId), { status: 'revogado', revogadoPor: q.nome, revogadoEm: new Date().toISOString() });
        b.delete(doc(db, 'nadsPedidos', s.pedidoId, 'codigo', 'atual'));
      }
      await b.commit();
      registrar('acesso-revogado', s.nome + ' · ' + s.computador);
    },
    // os acessos da própria pessoa e o "Não fui eu" (22/11/2026, ficha E21; regra: a pessoa lê e apaga as sessões dela, e cria o alerta dela)
    async meusAcessos() {
      const q = eu();
      try {
        const snap = await getDocs(query(collection(db, 'nadsSessoes'), where('uid', '==', q.uid), limit(30)));
        return u.meusAcessosOrdenados(snap.docs.map(d => u.sessaoDoDocumento(d.id, d.data())));
      } catch (e) { throw new Error(/permission/i.test(String((e as { code?: string }).code ?? e)) ? 'Ainda não dá para ver os seus acessos (falta a regra nova no banco).' : 'Não deu para ler os seus acessos agora.', { cause: e }); }
    },
    async naoFuiEu(s) {
      const q = eu();
      if (s.uid !== q.uid) throw new Error('Este acesso não é seu.');
      const b = writeBatch(db);
      b.delete(doc(db, 'nadsSessoes', s.id));
      b.set(doc(collection(db, 'nadsAlertas')), u.alertaNaoFuiEu(s, new Date()));
      try { await b.commit(); }
      catch (e) { throw new Error('Não deu para encerrar o acesso agora. Avise o Diretor.', { cause: e }); }
      registrar('acesso-revogado', s.nome + ' · ' + s.computador + ' (Não fui eu)');
    },
    equipe: () => { ouvir(); return equipe; },
    async salvarCargo(uid, departamento, nivel) {
      const atual = equipe.docs[uid];
      if (!atual) throw new Error('pessoa não encontrada');
      const m = u.mudancaDeCargo(atual, departamento, nivel);
      // o "—" (sem departamento ou sem nível) vem como undefined, que o banco ignora (ignoreUndefinedProperties): o campo
      // antigo ficava gravado, e as regras (doSetor, ehDiretorNads) e a tela continuavam lendo o cargo que saiu. Apaga.
      await updateDoc(doc(db, 'usuarios', uid), { roles: m.roles, departamento: m.departamento ?? deleteField(), nivel: m.nivel ?? deleteField() });
      registrar('usuario-cargo', nomeDe(uid) + ': ' + (departamento || 'sem departamento') + ' · ' + (nivel || 'sem nível'));
    },
    async salvarPapeis(uid, papeis) { await updateDoc(doc(db, 'usuarios', uid), { roles: papeis }); registrar('usuario-papeis', nomeDe(uid) + ': ' + papeis.join(', ')); },
    minhaFoto: () => { ouvir(); const q = quem(); return (q && equipe.docs[q.uid]?.fotoPerfil) || null; },
    // as regras deixam o dono mexer na própria foto (usuarios/{uid}.fotoPerfil), como as Configurações do Entregas
    async salvarMinhaFoto(foto) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await updateDoc(doc(db, 'usuarios', q.uid), { fotoPerfil: foto || '' });
    },
    // o ponto de quem está online (17/11/2026, consumo do banco): em nadsPresenca/{uid}, que só a tela de Usuários escuta.
    // Em usuarios, cada ponto virava uma leitura em toda aba do nads, em todo aparelho com o Entregas e no robô do login
    // por nome (todos escutam usuarios inteira). O ponto que o sinal da etapa acabou de levar junto não grava de novo.
    async marcarPresenca() {
      const q = quem();
      if (!q || !u.ehHoraDoPonto(ultimoPonto, Date.now())) return;
      ultimoPonto = Date.now();
      await gravarPonto(q.uid, { vistoEm: new Date().toISOString() }, { nadsVistoEm: new Date().toISOString() });
    },
    // o sinal da etapa leva o ponto do online junto (uma gravação, não duas)
    async marcarOnde(onde) {
      const q = quem();
      if (!q) return;
      ultimoPonto = Date.now();
      const em = new Date().toISOString();
      await gravarPonto(q.uid, { onde: onde ?? deleteField(), vistoEm: em }, { nadsOnde: onde ?? deleteField(), nadsVistoEm: em });
    },
    presencas: () => presencas,
    ouvirPresencas() {
      if (ouvindoPresencas++ === 0) {
        pararPresencas = onSnapshot(collection(db, 'nadsPresenca'), s => {
          presencas = Object.fromEntries(s.docs.map(d => [d.id, d.data() as u.DocPresenca]));
          mudou();
        }, () => { presencas = {}; mudou(); });
      }
      let parado = false;
      return () => {
        if (parado) return;
        parado = true;
        if (--ouvindoPresencas === 0 && pararPresencas) { pararPresencas(); pararPresencas = null; }
      };
    },
    async ativar(uid, ativo) { await updateDoc(doc(db, 'usuarios', uid), { ativo }); registrar(ativo ? 'usuario-ativado' : 'usuario-desativado', nomeDe(uid)); },
    // excluir usuário (16/11/2026): um documento basta em cada lugar (limit 1); as buscas vão juntas. O lugar que não deu para
    // ler (negado, fora do ar) volta em semConferir, e a tela não deixa excluir sem conferir
    async registrosDe(p) {
      const buscas = u.LUGARES_DE_REGISTRO.flatMap(l => u.buscasDoLugar(l, p));
      const consultas = buscas.map(b => getDocs(query(b.lugar.grupo ? collectionGroup(db, b.lugar.colecao) : collection(db, b.lugar.colecao),
        where(b.lugar.campo, b.lugar.forma === 'lista' ? 'array-contains' : '==', b.valor), limit(1))).then(r => !r.empty));
      // as listas de objetos (participantes, histórico, quem leu): a coleção inteira, procurando a pessoa em cada documento
      const varridas = u.COLECOES_VARRIDAS.map(v => getDocs(collection(db, v.colecao)).then(r => r.docs.some(d => u.contemAPessoa(d.data(), p))));
      const lugares = [...buscas.map(b => ({ rotulo: b.lugar.rotulo, onde: b.lugar.colecao + '.' + b.lugar.campo })), ...u.COLECOES_VARRIDAS.map(v => ({ rotulo: v.rotulo, onde: v.colecao }))];
      const r = await Promise.allSettled([...consultas, ...varridas]);
      const achados: string[] = [];
      const semConferir: string[] = [];
      r.forEach((x, i) => {
        if (x.status === 'fulfilled') { if (x.value) achados.push(lugares[i].rotulo); return; }
        console.warn('Excluir usuário: não consegui ler ' + lugares[i].onde, x.reason);
        semConferir.push(lugares[i].rotulo);
      });
      return { achados: [...new Set(achados)], semConferir: [...new Set(semConferir)] };
    },
    // a regra do banco: só o Diretor e o Dono apagam, e nunca o Dono (o login no Firebase fica, mas sem o cadastro não entra em nada)
    async excluir(uid) {
      const d = equipe.docs[uid];
      if (!d) throw new Error('Não achei essa pessoa.');
      if (d.ativo !== false) throw new Error('Só uma conta inativa pode ser excluída.');
      await deleteDoc(doc(db, 'usuarios', uid));
      registrar('usuario-excluido', String(d.nome || 'alguém'));
      // o último ponto dela (sem a regra no ar, ou já apagado, não faz falta)
      await deleteDoc(doc(db, 'nadsPresenca', uid)).catch(() => undefined);
    },
    // o "Criar acesso" do Entregas: o login (numa instância à parte) e o cadastro gravado pela sessão do admin (a regra
    // só deixa o admin criar usuarios/{uid} de outra pessoa)
    async criarConta(c) {
      const erros = u.conferirNovaConta(c, Object.values(equipe.docs).map(d => String(d.email || '')), Object.values(equipe.docs).map(d => String(d.nome || '')));
      if (erros.length) throw new Error(erros.join(' '));
      const novo = u.docDaContaNova(c, new Date());
      const uid = await criarLoginNoEntregas(String(novo.email), c.senha);
      await setDoc(doc(db, 'usuarios', uid), novo);
      registrar('usuario-criado', String(novo.nome || '') + (novo.departamento ? ' · ' + novo.departamento : ''));
      return String(novo.email);
    },
    // os convites (15/10/2026), no formato do Entregas (convites/{codigo}; as regras de lá conferem): o código é a senha,
    // vale 24 h e uma vez só; a página pública /tarefas/convite/<código> (convite.firestore.ts) é quem usa
    async criarConviteDeCadastro(c) {
      const q = eu();
      if (!q.admin) throw new Error('Só um administrador gera o link de cadastro.');
      const codigo = novoCodigo();
      await setDoc(doc(db, 'convites', codigo), {
        tipo: 'novo', roles: u.papeisDaContaNova(c.departamento, c.nivel, c.extras), departamento: c.departamento, nivel: c.nivel,
        usado: false, criadoPor: q.email, criadoPorNome: q.nome, criadoEm: new Date().toISOString(), expiraEm: Timestamp.fromDate(new Date(Date.now() + DIA)), origem: 'nads',
      });
      return codigo;
    },
    async criarConviteDeSenha(uid) {
      const q = eu();
      if (!q.admin) throw new Error('Só um administrador gera o link de nova senha.');
      const d = equipe.docs[uid];
      if (!d) throw new Error('Não achei essa pessoa.');
      // o endereço do serviço de contas vai no convite: quem abre o link está sem login e não lê config/integracoes
      const contasUrl = String(((await getDoc(doc(db, 'config', 'integracoes'))).data() || {}).contasUrl || '');
      if (!contasUrl) throw new Error('Falta o endereço do serviço de contas (config/integracoes), que troca a senha.');
      const codigo = novoCodigo();
      await setDoc(doc(db, 'convites', codigo), {
        tipo: 'reset', uidAlvo: uid, nome: String(d.nome || ''), email: String(d.email || ''), contasUrl,
        usado: false, criadoPor: q.email, criadoPorNome: q.nome, criadoEm: new Date().toISOString(), expiraEm: Timestamp.fromDate(new Date(Date.now() + DIA)), origem: 'nads',
      });
      return codigo;
    },
    async trocarEmail(uid, email) {
      const q = eu();
      // o próprio e-mail, qualquer um (Vitor, 12/11/2026: "deixa o próprio usuário alterar o e-mail dele também"); o dos outros, só o Diretor e o Dono
      if (!q.admin && uid !== q.uid) throw new Error('Só o Diretor ou o Dono troca o e-mail de outra pessoa.');
      const ref = await addDoc(collection(db, 'pedidosConta'), {
        acao: 'trocarEmail', uidAlvo: uid, emailNovo: email.trim().toLowerCase(), pedidoPor: { uid: q.uid, nome: q.nome }, em: new Date().toISOString(), status: 'fila',
      });
      registrar('usuario-email', nomeDe(uid));
      // o robô da nuvem troca em segundos; sem resposta em 2 min, o pedido fica na fila e a tela avisa
      await new Promise<void>((ok, falhou) => {
        let parar = () => {};
        const fim = setTimeout(() => { parar(); falhou(new Error('O robô ainda não trocou (o pedido ficou na fila). Confira daqui a pouco.')); }, 2 * 60 * 1000);
        parar = onSnapshot(ref, s => {
          const d = s.data();
          if (d?.status === 'feito') { clearTimeout(fim); parar(); ok(); }
          else if (d?.status === 'erro') { clearTimeout(fim); parar(); falhou(new Error(String(d.erro || 'O robô não trocou o e-mail.'))); }
        }, e => { clearTimeout(fim); falhou(e); });
      });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
