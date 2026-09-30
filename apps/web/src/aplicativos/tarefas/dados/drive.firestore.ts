// O Drive do escritório na Tarefas, pelo robô do Entregas (o mesmo das Pendências), no banco do Entregas com o
// login de lá. O navegador não fala com o Drive:
//   driveIndice/raiz e driveIndice/{pasta}/partes   SÓ LEITURA: o mapa das pastas que o robô mantém (admin/contábil)
//   aberturasDrive                                   o pedido de abrir, baixar ou juntar num .zip; o robô responde
//                                                    no próprio pedido com um link temporário (30 min). Cada um lê só o seu.
// As partes de uma pasta só são lidas de novo quando o robô atualiza a pasta (atualizadoEm), como nas Pendências.
import { entregas as e } from '@nads/core';
import { addDoc, collection, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';

interface Pasta { carregados: boolean; itens: e.ItemDoDrive[]; atualizadoEm: string }

export function criarDriveFirestore(quem: () => e.Quem | null): e.RepoDriveDoEntregas {
  const db = bancoDoEntregas();
  let mapa: e.MapaDoDrive = e.MAPA_VAZIO;
  let ouvindoMapa = false;
  const pastas = new Map<string, Pasta>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  function ouvirMapa() {
    if (ouvindoMapa) return;
    ouvindoMapa = true;
    onSnapshot(doc(db, 'driveIndice', 'raiz'), s => { mapa = e.mapaDaRaiz(s.exists() ? s.data() : null); mudou(); },
      err => { mapa = { ...e.MAPA_VAZIO, carregado: true, erro: err.message }; mudou(); });
  }

  function ouvirPasta(id: string): Pasta {
    const pronta = pastas.get(id);
    if (pronta) return pronta;
    const p: Pasta = { carregados: false, itens: [], atualizadoEm: '' };
    pastas.set(id, p);
    onSnapshot(doc(db, 'driveIndice', id), s => {
      const em = String((s.data() || {}).atualizadoEm || '');
      if (p.carregados && em === p.atualizadoEm) return;
      p.atualizadoEm = em;
      getDocs(collection(db, 'driveIndice', id, 'partes')).then(ps => {
        p.itens = e.itensDasPartes(ps.docs.map(d => d.data()));
        p.carregados = true;
        mudou();
      }, () => { p.carregados = true; mudou(); });
    }, () => { p.carregados = true; mudou(); });
    return p;
  }

  return {
    exemplos: false,
    mapa: () => { ouvirMapa(); return mapa; },
    itens: id => { const p = ouvirPasta(id); return { carregados: p.carregados, itens: p.itens }; },
    pedir(pedido, aoMudar) {
      const q = quem();
      let parar = () => {};
      let vivo = true;
      if (!q) { aoMudar({ status: 'erro', erro: 'entre com a conta do Entregas' }); return parar; }
      const dados: Record<string, unknown> = { status: 'pendente', fileId: pedido.fileId, nome: pedido.nome, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid };
      if (pedido.modo !== 'abrir') dados.modo = pedido.modo;
      if (pedido.fileIds) dados.fileIds = pedido.fileIds;
      if (pedido.pastaId) dados.pastaId = pedido.pastaId;
      if (pedido.nomeZip) dados.nomeZip = pedido.nomeZip;
      addDoc(collection(db, 'aberturasDrive'), dados).then(ref => {
        if (!vivo) return;
        parar = onSnapshot(ref, s => aoMudar(e.andamentoDoDocumento(s.data())), err => aoMudar({ status: 'erro', erro: err.message }));
      }, (err: Error) => aoMudar({ status: 'erro', erro: err.message }));
      return () => { vivo = false; parar(); };
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
