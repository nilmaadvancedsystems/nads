// Certidão, procuração e certificado digital vencendo.
//
// O cadastro de cada cliente guarda clientes.papeis = [{tipo, vence, observacao}].
// Uma vez por dia, a partir das 8h, o PC do robô olha a lista inteira e avisa
// no celular de quem é admin ou contábil o que vence em 30, 15 e 3 dias — e o
// que já venceu, uma vez só.
//
// Barato: usa o arquivo local de clientes que o vigia já mantém, então na
// maioria dos dias não lê nada do banco.
const cacheDeClientes = require('./clientes-cache');

const HORA_MINIMA = 8;
const MARCOS = [30, 15, 3, 0];        // dias antes; 0 = venceu hoje ou já passou
const MAX_POR_DIA = 20;

const pad2 = n => String(n).padStart(2, '0');
const diaIso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const NOMES = {
  'cnd-federal': 'CND Federal', 'cnd-estadual': 'CND Estadual', 'cnd-municipal': 'CND Municipal',
  'fgts': 'CRF do FGTS', 'trabalhista': 'Certidão trabalhista',
  'procuracao': 'Procuração eletrônica', 'certificado': 'Certificado digital', 'outro': 'Documento',
};

function diasAte(vence, hoje) {
  const p = String(vence || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) return null;
  const alvo = new Date(p[0], p[1] - 1, p[2]);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 864e5);
}

// O que avisar hoje: só quem cai exatamente num marco (pra não repetir o mesmo
// documento todo santo dia) e o que venceu, uma vez.
function papeisParaAvisar(clientes, hoje) {
  const fora = [];
  (clientes || []).forEach(c => {
    if (!c || c.ativo === false) return;
    (Array.isArray(c.papeis) ? c.papeis : []).forEach(p => {
      if (!p || !p.vence) return;
      const dias = diasAte(p.vence, hoje);
      if (dias === null) return;
      const marco = dias < 0 ? (dias === -1 ? 0 : null) : (MARCOS.indexOf(dias) !== -1 ? dias : null);
      if (marco === null) return;
      fora.push({
        cliente: c.nomeFantasia || c.nome || 'cliente',
        nome: NOMES[p.tipo] || NOMES.outro,
        dias,
        vence: p.vence,
      });
    });
  });
  return fora.sort((a, b) => a.dias - b.dias).slice(0, MAX_POR_DIA);
}

function textoDoAviso(lista) {
  const frase = x => x.nome + ' de ' + x.cliente +
    (x.dias < 0 ? ' venceu ontem' : (x.dias === 0 ? ' vence hoje' : ' vence em ' + x.dias + ' dias'));
  if (lista.length === 1) return { titulo: 'Documento vencendo', corpo: frase(lista[0]) };
  return {
    titulo: lista.length + ' documentos vencendo',
    corpo: lista.slice(0, 3).map(frase).join(' · ') + (lista.length > 3 ? ' …' : ''),
  };
}

// O documento vencendo vira tarefa (22/11/2026, ficha M03; o dono: "pode fazer tudo"): a 30 dias de vencer, uma tarefa no
// Início do responsável do Contábil da empresa (o Cadastro do nads; sem ele, um Diretor), com o id determinístico (create:
// se já existe, não faz nada). Só com config/papeisViramTarefa.ligado == true (Robôs › Ajustes; vem desligado).
// deps: { db, core, log, clientes: [{ codigoOrigem, nome, nomeFantasia, ativo, papeis }], hoje: 'aaaa-mm-dd', agora: Date }
async function criarTarefasDosPapeis({ db, core, log, clientes, hoje, agora = new Date() }) {
  const P = core();
  const vencendo = [];
  for (const c of clientes || []) {
    if (!c || c.ativo === false) continue;
    for (const p of Array.isArray(c.papeis) ? c.papeis : []) if (p && p.vence && P.papelViraTarefaHoje(p.vence, hoje)) vencendo.push({ c, p });
  }
  if (!vencendo.length) return 0;
  // a equipe: o responsável pelo nome; sem ele, o primeiro Diretor ativo
  const equipe = (await db.collection('usuarios').get()).docs.map(d => Object.assign({ uid: d.id }, d.data())).filter(u => u.ativo !== false && u.nome);
  const diretor = equipe.find(u => u.nivel === 'diretor' || u.nivel === 'dono') || null;
  let criadas = 0;
  for (const { c, p } of vencendo.slice(0, MAX_POR_DIA)) {
    // o código do ERP mora em codigoOrigem nos clientes do Entregas
    const bruto = c.codigoOrigem != null && String(c.codigoOrigem).trim() !== '' ? c.codigoOrigem : c.codigo;
    const codigo = bruto != null && String(bruto).trim() !== '' && Number.isFinite(Number(bruto)) ? Number(bruto) : null;
    const nomeCli = String(c.nomeFantasia || c.nome || 'cliente').slice(0, 80);
    const id = P.idDaTarefaDoPapel(codigo, p.tipo, p.vence);
    const ref = db.collection('nadsTarefasDelegadas').doc(id);
    if ((await ref.get()).exists) continue;
    let nomeResp = '';
    if (codigo != null) {
      const cad = await db.collection('cadastro').where('codigo', '==', codigo).limit(1).get().catch(() => null);
      nomeResp = cad && !cad.empty ? String(((cad.docs[0].data() || {}).responsaveis || {}).contabil || '') : '';
    }
    const u = (nomeResp && equipe.find(x => P.chaveDoNome(x.nome) === P.chaveDoNome(nomeResp) && (x.departamento === 'contabil' || (x.roles || []).includes('contabil')))) || diretor;
    if (!u) { log('documento vencendo: ninguém para receber a tarefa de', nomeCli); continue; }
    const ultima = await db.collection('nadsTarefasDelegadas').orderBy('numero', 'desc').limit(1).get();
    const numero = (Number(ultima.empty ? 0 : ultima.docs[0].get('numero')) || 0) + 1;
    const t = P.tarefaDoPapel(p, { codigo, nome: nomeCli }, { uid: u.uid, nome: String(u.nome) }, { numero, em: agora.toISOString() });
    const campos = Object.assign({}, t, { pessoas: P.pessoasDaTarefa(t) });
    delete campos.id;
    try { await ref.create(campos); criadas++; } catch (e) { if (e.code !== 6) throw e; }
  }
  if (criadas) log('documento vencendo: ' + criadas + ' tarefa(s) criada(s)');
  return criadas;
}

function iniciarPapeisVencendo({ db, log, avisos, core }) {
  if (!avisos) { log('papéis vencendo: sem aviso no celular, módulo parado'); return; }
  const estadoRef = db.collection('robo').doc('estado');
  let rodando = false;
  let feitoEm = '';

  async function talvez() {
    const agora = new Date();
    const hoje = diaIso(agora);
    if (rodando || feitoEm === hoje || agora.getHours() < HORA_MINIMA) return;
    rodando = true;
    try {
      const clientes = [];
      (await cacheDeClientes.clientesAtivos(db, log)).forEach(d => clientes.push(Object.assign({ id: d.id }, d.data())));
      // as tarefas dos papéis a 30 dias (só ligado; rodar de novo no mesmo dia não cria outra)
      if (core) {
        try {
          const cfg = (await db.collection('config').doc('papeisViramTarefa').get()).data() || {};
          if (cfg.ligado === true) await criarTarefasDosPapeis({ db, core, log, clientes, hoje, agora });
        } catch (e) { log('documento vencendo: as tarefas não saíram -', e.message); }
      }
      const lista = papeisParaAvisar(clientes, agora);
      if (!lista.length) { feitoEm = hoje; return; }
      const estado = (await estadoRef.get()).data() || {};
      if (estado.papeisEm === hoje) { feitoEm = hoje; return; }
      // marca antes de avisar: vigia religado não manda de novo
      await estadoRef.set({ papeisEm: hoje }, { merge: true });
      feitoEm = hoje;
      const texto = textoDoAviso(lista);
      await avisos.enviar('admin', '', texto.titulo, texto.corpo, 'papeis');
      await avisos.enviar('contabil', '', texto.titulo, texto.corpo, 'papeis').catch(() => {});
      log('aviso de documento vencendo:', lista.map(x => x.nome + '/' + x.cliente).join(', '));
    } catch (err) {
      log('aviso de documento vencendo falhou:', err.message);
    } finally { rodando = false; }
  }

  setTimeout(talvez, 5 * 60 * 1000);
  setInterval(talvez, 60 * 60 * 1000);
  log('aviso de certidão/procuração/certificado ligado (a partir das ' + HORA_MINIMA + 'h)');
}

module.exports = { diasAte, papeisParaAvisar, textoDoAviso, iniciarPapeisVencendo, criarTarefasDosPapeis };
