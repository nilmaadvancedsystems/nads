// O chat com a IA na Tarefas, no banco do Entregas (02/10/2026) — o MESMO caminho do "Perguntar à IA" do Entregas,
// nas regras de lá (conversa é de quem criou; o navegador não escreve resposta):
//   - conversasIA/{id}: {criadoPor: e-mail, criadoEm, atualizadoEm, titulo, estado: 'ocioso' | 'pendente'};
//   - conversasIA/{id}/mensagens: a pergunta {papel: 'user', texto, ordem, criadoEm}; a resposta o robô escreve
//     ({papel: 'model', texto, estado: gerando/pronta/erro, consultando, erro, acoes});
//   - robo/estado.ia (só leitura): se a IA está de pé — o motor (claude no PC do escritório, gemini na nuvem) e o
//     ponto que ele bate. Quem não pode ler robo/estado (só admin, contábil e fiscal) vê a IA como desligada.
import { addDoc as addDocBruto, collection, deleteDoc as deleteDocBruto, doc, onSnapshot, orderBy, query, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { ConversaIA, MensagemIA, RepoIA } from './ia';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

type Quem = { uid: string; email: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));

export function criarIAFirestore(quem: () => Quem): RepoIA {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let disponivel = { carregada: false, ligada: false, motor: '' };
  let estadoDoRobo: Record<string, unknown> | null = null;
  let conversas: { carregadas: boolean; lista: ConversaIA[] } = { carregadas: false, lista: [] };
  const mensagens = new Map<string, { carregadas: boolean; lista: MensagemIA[] }>();
  const pararMensagens = new Map<string, () => void>();
  let ouvindoDe = '';
  const paradas: (() => void)[] = [];

  // como o Entregas decide (entregas.html, cqAplicarEstadoRobo_): ligada, e o motor de pé — o Claude bate o ponto em
  // ia.em (até 5 min); o Gemini depende do vigia da nuvem (vigia.em, até 3 min)
  function calcularDisponivel() {
    const d = estadoDoRobo || {};
    const ia = (d.ia || {}) as { ligado?: boolean; motor?: string; em?: string };
    const vigia = (d.vigia || {}) as { em?: string };
    const motor = ia.motor || 'gemini';
    const emVigia = vigia.em ? Date.parse(vigia.em) : 0;
    const emIa = ia.em ? Date.parse(ia.em) : 0;
    const vigiaLigado = !!emVigia && Date.now() - emVigia < 3 * 60 * 1000;
    const iaLigada = !!ia.ligado && (motor !== 'claude' || (!!emIa && Date.now() - emIa < 5 * 60 * 1000));
    disponivel = { carregada: true, ligada: iaLigada && (motor === 'claude' || vigiaLigado), motor };
  }

  function ouvir() {
    const q = quem();
    const chave = q ? q.email : '';
    if (chave === ouvindoDe) return;
    ouvindoDe = chave;
    paradas.splice(0).forEach(f => f());
    pararMensagens.forEach(f => f());
    pararMensagens.clear();
    mensagens.clear();
    conversas = { carregadas: !q, lista: [] };
    if (!q) return;
    paradas.push(onSnapshot(doc(db, 'robo', 'estado'), s => { estadoDoRobo = s.data() || {}; calcularDisponivel(); mudou(); },
      () => { disponivel = { carregada: true, ligada: false, motor: '' }; mudou(); }));
    // o ponto do robô envelhece sem o documento mudar: confere de minuto em minuto
    const relogio = setInterval(() => { if (estadoDoRobo) { calcularDisponivel(); mudou(); } }, 60 * 1000);
    paradas.push(() => clearInterval(relogio));
    paradas.push(onSnapshot(query(collection(db, 'conversasIA'), where('criadoPor', '==', q.email)), s => {
      conversas = { carregadas: true, lista: s.docs.map(d => {
        const x = d.data();
        return { id: d.id, titulo: texto(x.titulo) || 'Conversa', atualizadoEm: texto(x.atualizadoEm), estado: texto(x.estado) };
      }).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)).slice(0, 30) };
      mudou();
    }, () => { conversas = { carregadas: true, lista: [] }; mudou(); }));
  }

  function ouvirMensagens(id: string) {
    if (pararMensagens.has(id)) return;
    mensagens.set(id, { carregadas: false, lista: [] });
    pararMensagens.set(id, onSnapshot(query(collection(db, 'conversasIA', id, 'mensagens'), orderBy('ordem')), s => {
      mensagens.set(id, { carregadas: true, lista: s.docs.map(d => {
        const x = d.data();
        return {
          id: d.id, papel: x.papel === 'model' ? 'model' : 'user', texto: texto(x.texto),
          estado: (['gerando', 'pronta', 'erro'].includes(texto(x.estado)) ? texto(x.estado) : '') as MensagemIA['estado'],
          consultando: texto(x.consultando), erro: texto(x.erro), ordem: Number(x.ordem) || 0,
          temAcoes: Array.isArray(x.acoes) && x.acoes.length > 0,
        };
      }) });
      mudou();
    }, () => { mensagens.set(id, { carregadas: true, lista: [] }); mudou(); }));
  }

  function eu(): { uid: string; email: string } {
    const q = quem();
    if (!q || !q.email) throw new Error('Sem login.');
    return q;
  }

  return {
    exemplos: false,
    disponivel: () => { ouvir(); return disponivel; },
    conversas: () => { ouvir(); return conversas; },
    mensagens: id => { ouvir(); ouvirMensagens(id); return mensagens.get(id) || { carregadas: false, lista: [] }; },
    async perguntar(conversa, t) {
      const q = eu();
      const agora = new Date().toISOString();
      let id = conversa;
      if (!id) {
        // a conversa nasce 'ocioso' e só vira 'pendente' depois que a pergunta foi gravada (o robô pega na hora)
        const ref = await addDoc(collection(db, 'conversasIA'), { criadoPor: q.email, criadoEm: agora, atualizadoEm: agora, titulo: t.slice(0, 60), estado: 'ocioso', origem: 'tarefas' });
        id = ref.id;
      }
      await addDoc(collection(db, 'conversasIA', id, 'mensagens'), { papel: 'user', texto: t, ordem: Date.now(), criadoEm: agora });
      await updateDoc(doc(db, 'conversasIA', id), { estado: 'pendente', atualizadoEm: agora });
      return id;
    },
    async apagar(id) {
      pararMensagens.get(id)?.();
      pararMensagens.delete(id);
      mensagens.delete(id);
      await deleteDoc(doc(db, 'conversasIA', id));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
