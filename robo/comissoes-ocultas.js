// A comissão escondida (Vitor, 16/11/2026: a % própria de uma pessoa, "não deixe essa informacao visualizavel para NENHUM
// usuario, nem pro própio Vitor"; 23/11/2026: "NAO MOSTRA ISSO PARA O USUARIO DE MANEIRA ALGUMA"). A % fica em
// carteiraPropriaSegredo/{uid}, que a regra do banco não deixa nenhuma tela ler; a pessoa registra a comissão no nads sem o
// valor e sem a % ({oculta: true, calculo: 'fila'}). Aqui, com o Admin SDK, o robô:
//   - calcula a da fila: lê a %, grava o valor (valor do serviço × %), tira o valor do serviço (para o Financeiro, que vê o
//     valor, não fazer a conta) e marca calculo 'feito' (ou 'erro');
//   - esconde as outras comissões de quem tem a %: as de antes e as que o Financeiro ou o Diretor registram em nome da pessoa
//     (com a % e o valor do serviço): tira os dois e marca oculta; a ainda não paga tem o valor refeito com a % dela.
// O log não leva nem a %, nem o valor, nem o nome.
const { FieldValue } = require('firebase-admin/firestore');
const { ouvir } = require('./ouvinte');

const COLECAO = 'carteiraComissoes';
const SEGREDO = 'carteiraPropriaSegredo';

const pctDe = s => (s && typeof s.percentual === 'number' && s.percentual > 0 && s.percentual <= 100 ? s.percentual : 0);

async function calcularUma(db, ref, log) {
  const c = (await ref.get()).data() || {};
  if (c.oculta !== true || c.calculo !== 'fila') return;
  const agora = new Date().toISOString();
  try {
    const pct = pctDe((await db.collection(SEGREDO).doc(String(c.uid || '-')).get()).data());
    const vs = typeof c.valorServico === 'number' ? c.valorServico : 0;
    const valor = Math.round(vs * pct) / 100;
    if (!(pct > 0) || !(valor > 0)) {
      await ref.update({ calculo: 'erro', calculadoEm: agora });
      log('comissões escondidas: não calculei a', ref.id, '(sem a % ou sem o valor do serviço)');
      return;
    }
    await ref.update({ valor, valorServico: FieldValue.delete(), percentual: FieldValue.delete(), calculo: 'feito', calculadoEm: agora });
    log('comissões escondidas: calculei a', ref.id);
  } catch (err) {
    log('comissões escondidas: não calculei a', ref.id + ':', err.message);
  }
}

/** A comissão de quem tem a % que ainda mostra alguma coisa: sem a marca, com a % ou com o valor do serviço (fora a da fila). */
const aEsconder = c => !(c.oculta === true && c.calculo === 'fila') && (c.oculta !== true || 'percentual' in c || 'valorServico' in c);

async function esconderUma(db, ref, pct, log) {
  const c = (await ref.get()).data() || {};
  if (!aEsconder(c)) return;
  const mudar = { oculta: true, calculo: 'feito', calculadoEm: new Date().toISOString(), percentual: FieldValue.delete(), valorServico: FieldValue.delete() };
  // a que ainda não foi paga (lançada ou aprovada, como a que o Financeiro registra) ganha o valor pela % dela; a paga e a
  // recusada ficam com o valor de antes
  const vs = typeof c.valorServico === 'number' ? c.valorServico : 0;
  const valor = Math.round(vs * pct) / 100;
  if ((c.situacao === 'lancada' || c.situacao === 'aprovada') && valor > 0) mudar.valor = valor;
  try {
    await ref.update(mudar);
    log('comissões escondidas: escondi a', ref.id);
  } catch (err) {
    log('comissões escondidas: não escondi a', ref.id + ':', err.message);
  }
}

function iniciarComissoesOcultas(db, log) {
  let ocupado = false;
  let deNovo = false;
  async function varrer() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        const fila = await db.collection(COLECAO).where('calculo', '==', 'fila').get();
        for (const d of fila.docs) await calcularUma(db, d.ref, log);
        const segredos = await db.collection(SEGREDO).get();
        for (const s of segredos.docs) {
          const pct = pctDe(s.data());
          if (!pct) continue;
          const dela = await db.collection(COLECAO).where('uid', '==', s.id).get();
          for (const d of dela.docs) if (aEsconder(d.data())) await esconderUma(db, d.ref, pct, log);
        }
      } while (deNovo);
    } catch (err) { log('comissões escondidas: não li as comissões:', err.message); } finally { ocupado = false; }
  }
  // a fila, as % (pessoa nova ou % mudada) e as comissões de quem tem a % (refeito quando a lista muda)
  ouvir('Comissões escondidas', () => db.collection(COLECAO).where('calculo', '==', 'fila'), () => { void varrer(); }, log);
  let pararDelas = null;
  let de = '';
  ouvir('Comissões escondidas (as %)', () => db.collection(SEGREDO), snap => {
    const uids = snap.docs.map(d => d.id).sort().slice(0, 30);
    if (uids.join('|') !== de) {
      de = uids.join('|');
      if (pararDelas) pararDelas();
      pararDelas = uids.length ? ouvir('Comissões escondidas (as delas)', () => db.collection(COLECAO).where('uid', 'in', uids), () => { void varrer(); }, log) : null;
    }
    void varrer();
  }, log);
  log('comissões escondidas: ligado');
}

module.exports = { iniciarComissoesOcultas, calcularUma, esconderUma, aEsconder };
