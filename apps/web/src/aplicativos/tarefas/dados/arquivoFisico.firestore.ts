// O arquivo físico no banco do Entregas: arquivoFisico/{id} — uma caixa por documento, com os envelopes e as retiradas
// dentro (core arquivoFisico.lerCaixa / paraOBanco). Leituras econômicas (o projeto passa da cota grátis): a lista é lida
// uma vez quando a tela pede (getDocs, sem ficar ouvindo) e de novo só no botão de atualizar; cada mudança relê só a sua
// caixa, numa transação (dois mexendo na mesma caixa não apagam o envelope um do outro).
// A regra (lê e grava quem é da equipe; apagar, só a caixa sem envelopes) fica em firestore.rules do Entregas, e só vale
// depois de publicada. No modo desenvolvedor nada é gravado: a mudança fica só na tela.
import { arquivoFisico as af } from '@nads/core';
import { collection, deleteDoc as deleteDocBruto, doc, getDocs, query, runTransaction, setDoc as setDocBruto, where } from 'firebase/firestore';
import { guardar, modoDesenvolvedor } from '../../../comum/modoDesenvolvedor';
import { listaDeCaixas, problemaParaExcluir, type RepoArquivoFisico } from './arquivoFisico';
import { bancoDoEntregas } from './entregas.firestore';

const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const COLECAO = 'arquivoFisico';
/** os envelopes impressos que aguardam arquivamento (arquivoFisicoImpressos/{código do envelope}; 19/11/2026) */
const IMPRESSOS = 'arquivoFisicoImpressos';

const mensagem = (e: unknown) => {
  const codigo = (e as { code?: string })?.code || '';
  return codigo === 'permission-denied' ? 'Sem permissão para o arquivo físico no banco (a regra ainda não foi publicada?).' : e instanceof Error ? e.message : String(e);
};

export function criarArquivoFisicoFirestore(quem: () => string): RepoArquivoFisico {
  const db = bancoDoEntregas();
  const l = listaDeCaixas();
  let lendo = false;
  const ler = () => {
    if (lendo) return;
    lendo = true;
    getDocs(collection(db, COLECAO))
      .then(s => l.definir({ carregada: true, erro: '', lista: s.docs.map(d => af.lerCaixa(d.id, d.data())).filter((c): c is af.Caixa => !!c) }))
      .catch(e => l.definir({ carregada: true, erro: mensagem(e), lista: l.estado().lista }))
      .finally(() => { lendo = false; });
  };
  let pediu = false;
  let lendoImpressos = false;
  return {
    exemplos: false,
    caixas() { if (!pediu) { pediu = true; ler(); } return l.estado(); },
    recarregar: ler,
    async criar(c) {
      const nova = { ...c, atualizadaPor: c.atualizadaPor || quem() };
      if (modoDesenvolvedor()) {
        if (l.achar(c.id)) return 'Essa caixa já existe.';
        l.por(nova);
        return '';
      }
      const ref = doc(db, COLECAO, c.id);
      try {
        const problema = await runTransaction(db, async t => {
          if ((await t.get(ref)).exists()) return 'Essa caixa já existe (alguém acabou de criar): atualize a lista.';
          t.set(ref, af.paraOBanco(nova));
          return '';
        });
        if (!problema) l.por(nova);
        return problema;
      } catch (e) { return mensagem(e); }
    },
    async mudar(id, mudanca) {
      if (modoDesenvolvedor()) {
        const atual = l.achar(id);
        if (!atual) return 'A caixa não existe mais.';
        const r = mudanca(atual);
        if (!r.problema) l.por(r.caixa);
        return r.problema;
      }
      const ref = doc(db, COLECAO, id);
      try {
        const r = await runTransaction(db, async t => {
          const s = await t.get(ref);
          const atual = s.exists() ? af.lerCaixa(id, s.data()) : null;
          if (!atual) return { caixa: null, problema: 'A caixa não existe mais (alguém apagou?): atualize a lista.' };
          const feito = mudanca(atual);
          if (!feito.problema) t.set(ref, af.paraOBanco(feito.caixa));
          return feito;
        });
        if (r.caixa && !r.problema) l.por(r.caixa);
        return r.problema;
      } catch (e) { return mensagem(e); }
    },
    async excluir(id) {
      const p = problemaParaExcluir(l.achar(id));
      if (p) return p;
      try {
        await deleteDoc(doc(db, COLECAO, id));
        l.tirar(id);
        return '';
      } catch (e) { return mensagem(e); }
    },
    impressos() {
      // só os que ainda aguardam (o arquivado fica no banco, mas a tela não precisa dele): uma leitura por envelope esperando
      if (!lendoImpressos && !l.impressos().carregada) {
        lendoImpressos = true;
        getDocs(query(collection(db, IMPRESSOS), where('arquivadoEm', '==', '')))
          .then(r => l.definirImpressos({ carregada: true, erro: '', lista: r.docs.map(d => af.lerImpresso(d.id, d.data())).filter((x): x is af.EnvelopeImpresso => !!x) }))
          .catch(e => l.definirImpressos({ carregada: true, erro: mensagem(e), lista: [] }));
      }
      return l.impressos();
    },
    async registrarImpressos(lista) {
      try {
        // no modo desenvolvedor o setDoc finge que gravou: a fila fica só na tela
        for (const x of lista) await setDoc(doc(db, IMPRESSOS, x.id), af.impressoParaOBanco(x));
        l.porImpressos(lista);
        return '';
      } catch (e) { return mensagem(e); }
    },
    async confirmarArquivamento(id, caixa, quem, agora) {
      const x = l.achaImpresso(id);
      if (!x) return '';
      try {
        const feito = af.arquivarImpresso(x, caixa, quem, agora);
        await setDoc(doc(db, IMPRESSOS, id), af.impressoParaOBanco(feito));
        l.porImpressos([feito]);
        return '';
      } catch (e) { return mensagem(e); }
    },
    assinar: l.assinar,
    versao: l.versao,
  };
}
