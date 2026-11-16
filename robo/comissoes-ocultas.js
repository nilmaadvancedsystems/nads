// A comissão escondida (Vitor, 16/11/2026: a % própria de uma pessoa, "não deixe essa informacao visualizavel para NENHUM
// usuario, nem pro própio Vitor"). A % fica em carteiraPropriaSegredo/{uid}, que a regra do banco não deixa nenhuma tela ler;
// a pessoa registra a comissão no nads sem o valor e sem a % ({oculta: true, calculo: 'fila'}). Aqui, com o Admin SDK, o robô
// lê a %, grava o valor (valor do serviço × %), tira o valor do serviço (para o Financeiro, que vê o valor, não fazer a conta)
// e marca calculo 'feito' (ou 'erro'). O log não leva nem a %, nem o valor, nem o nome.
const { FieldValue } = require('firebase-admin/firestore');
const { ouvir } = require('./ouvinte');

const COLECAO = 'carteiraComissoes';
const SEGREDO = 'carteiraPropriaSegredo';

async function calcularUma(db, ref, log) {
  const c = (await ref.get()).data() || {};
  if (c.oculta !== true || c.calculo !== 'fila') return;
  const agora = new Date().toISOString();
  try {
    const s = (await db.collection(SEGREDO).doc(String(c.uid || '-')).get()).data() || {};
    const pct = typeof s.percentual === 'number' ? s.percentual : 0;
    const vs = typeof c.valorServico === 'number' ? c.valorServico : 0;
    const valor = Math.round(vs * pct) / 100;
    if (!(pct > 0 && pct <= 100) || !(valor > 0)) {
      await ref.update({ calculo: 'erro', calculadoEm: agora });
      log('comissões escondidas: não calculei a', ref.id, '(sem a % ou sem o valor do serviço)');
      return;
    }
    await ref.update({ valor, valorServico: FieldValue.delete(), calculo: 'feito', calculadoEm: agora });
    log('comissões escondidas: calculei a', ref.id);
  } catch (err) {
    log('comissões escondidas: não calculei a', ref.id + ':', err.message);
  }
}

function iniciarComissoesOcultas(db, log) {
  let ocupado = false;
  let deNovo = false;
  async function calcular() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        const snap = await db.collection(COLECAO).where('calculo', '==', 'fila').get();
        for (const d of snap.docs) await calcularUma(db, d.ref, log);
      } while (deNovo);
    } catch (err) { log('comissões escondidas: não li as comissões:', err.message); } finally { ocupado = false; }
  }
  ouvir('Comissões escondidas', () => db.collection(COLECAO).where('calculo', '==', 'fila'), () => { void calcular(); }, log);
  log('comissões escondidas: ligado');
}

module.exports = { iniciarComissoesOcultas, calcularUma };
