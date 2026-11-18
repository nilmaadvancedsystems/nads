// Os feedbacks no banco do Entregas (coleção feedbacks; regra em firestore.rules): quem está no nads cria o seu (com o
// uid dele, status 'novo' e a prioridade baixa/media/alta); só o admin lê todos e muda o status. A imagem vai no próprio
// documento (JPEG comprimido, até ~900 KB), sem Storage. Quem mandou lê os seus (o aviso do Resolvendo; 26/10/2026).
// A conversa (16/11/2026): cada mensagem em feedbacks/{id}/mensagens, ouvida só com a conversa aberta; o resumo (`conversa`)
// vai no próprio feedback, no mesmo lote, e chega a quem já ouve o feedback (a lista do admin, os seus de quem mandou).
import { Bytes, collection, doc, getDocs, increment, limit, onSnapshot, orderBy, query, where, setDoc as setDocBruto, updateDoc as updateDocBruto, writeBatch as writeBatchBruto } from 'firebase/firestore';
import { entregas, suporte } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import { ehPrioridade, type Feedback, type MeuFeedback, type RepoFeedback, type SituacaoDoFeedback } from './feedback';
import { guardar, guardarLote, guardarPedido } from '../../../comum/modoDesenvolvedor';
import { ouvirInsistindo } from './ouvirInsistindo.firestore';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const setDoc = guardarPedido(setDocBruto) as typeof setDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

type Quem = { uid: string; email: string; nome: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));
const STATUS: readonly SituacaoDoFeedback[] = ['novo', 'visto', 'resolvendo', 'testando', 'feito'];

export function criarFeedbackFirestore(quem: () => Quem): RepoFeedback {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let todos: { carregados: boolean; lista: Feedback[] } | null = null;
  let meus: { uid: string; lista: MeuFeedback[] } | null = null;
  return {
    exemplos: false,
    async enviar(f) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      // os anexos (26/10/2026): como os do bug, os pedaços em partes/ e a lista no mapa arquivo (a regra já aceita)
      const anexos = f.arquivos || [];
      for (const a of anexos) {
        const problema = entregas.problemaDoArquivo({ nome: a.nome, tamanho: a.bytes.length });
        if (problema) throw new Error(a.nome + ': ' + problema);
      }
      const partes: Uint8Array[] = [];
      const lista = anexos.map(a => { const ps = entregas.partesDoArquivo(a.bytes); const de = partes.length; partes.push(...ps); return { nome: a.nome, tamanho: a.bytes.length, de, partes: ps.length }; });
      const ref = doc(collection(db, 'feedbacks'));
      await setDoc(ref, {
        uid: q.uid, nome: q.nome, email: q.email, texto: f.texto, imagem: f.imagem, tela: f.tela, versao: f.versao,
        criadoEm: new Date().toISOString(), status: 'novo', prioridade: f.prioridade,
        ...(lista.length ? { arquivo: { nome: lista[0].nome, tamanho: lista[0].tamanho, partes: lista[0].partes, total: partes.length, arquivos: lista } } : {}),
      });
      for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
    },
    // o bug do suporte de leitura (Vitor, 20/10/2026): o documento com a conversa e o contexto, e o arquivo em pedaços em
    // feedbacks/{id}/partes (como o enviosSecretario); o robô do PC do escritório espera os pedaços, investiga e escreve o
    // report (analise 'pronta'). Prioridade Alta: chega para o admin na aba Bugs.
    async enviarBug(b) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      for (const a of b.arquivos) {
        const problema = entregas.problemaDoArquivo({ nome: a.nome, tamanho: a.bytes.length });
        if (problema) throw new Error(a.nome + ': ' + problema);
      }
      // os arquivos em pedaços, um atrás do outro (de = o primeiro pedaço de cada um); o primeiro também no `arquivo` de antes
      const partes: Uint8Array[] = [];
      const lista = b.arquivos.map(a => { const ps = entregas.partesDoArquivo(a.bytes); const de = partes.length; partes.push(...ps); return { nome: a.nome, tamanho: a.bytes.length, de, partes: ps.length }; });
      const ref = doc(collection(db, 'feedbacks'));
      await setDoc(ref, {
        uid: q.uid, nome: q.nome, email: q.email, texto: b.texto, imagem: '', tela: b.tela, versao: b.versao,
        criadoEm: new Date().toISOString(), status: 'novo', prioridade: 'alta',
        tipo: 'bug', caminho: b.caminho, contexto: b.contexto, analise: 'pendente',
        ...(lista.length ? { arquivo: { nome: lista[0].nome, tamanho: lista[0].tamanho, partes: lista[0].partes, total: partes.length, arquivos: lista } } : {}),
      });
      for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
      // o id volta para o balão mostrar o número do pedido (#)
      return ref.id;
    },
    async arquivoDoBug(id, i = 0) {
      const d = todos?.lista.find(x => x.id === id);
      const a = d?.arquivos[i];
      if (!a) return null;
      const s = await getDocs(collection(db, 'feedbacks', id, 'partes'));
      const pedacos = s.docs.sort((p, q) => Number(p.id) - Number(q.id)).slice(a.de, a.de + a.partes).map(p => (p.data().dados as Bytes).toUint8Array());
      const bytes = new Uint8Array(pedacos.reduce((t, p) => t + p.length, 0));
      let k = 0;
      for (const p of pedacos) { bytes.set(p, k); k += p.length; }
      return { nome: a.nome, bytes };
    },
    todos() {
      if (!todos) {
        todos = { carregados: false, lista: [] };
        onSnapshot(query(collection(db, 'feedbacks'), orderBy('criadoEm', 'desc'), limit(200)), s => {
          todos = {
            carregados: true,
            lista: s.docs.map(d => {
              const x = d.data();
              return {
                id: d.id, texto: texto(x.texto), imagem: texto(x.imagem), tela: texto(x.tela), versao: texto(x.versao), nome: texto(x.nome),
                email: texto(x.email), criadoEm: texto(x.criadoEm), status: (STATUS.includes(x.status) ? x.status : 'novo') as SituacaoDoFeedback,
                prioridade: ehPrioridade(x.prioridade) ? x.prioridade : null,
                tipo: x.tipo === 'bug' ? 'bug' as const : 'feedback' as const, caminho: texto(x.caminho),
                empresa: x.contexto && typeof x.contexto === 'object' ? texto((x.contexto as { empresa?: unknown }).empresa) : '',
                arquivo: x.arquivo && typeof x.arquivo === 'object' ? { nome: texto(x.arquivo.nome), tamanho: Number(x.arquivo.tamanho) || 0, partes: Number(x.arquivo.partes) || 0 } : null,
                // todos os arquivos (o de antes tinha um só, do pedaço 0)
                arquivos: x.arquivo && typeof x.arquivo === 'object'
                  ? (Array.isArray(x.arquivo.arquivos) ? (x.arquivo.arquivos as Record<string, unknown>[]) : [{ ...x.arquivo, de: 0 }])
                    .map(a => ({ nome: texto(a.nome), tamanho: Number(a.tamanho) || 0, de: Number(a.de) || 0, partes: Number(a.partes) || 0 })).filter(a => a.partes > 0)
                  : [],
                analise: (['pendente', 'analisando', 'pronta', 'erro'].includes(x.analise) ? x.analise : '') as Feedback['analise'],
                relatorio: texto(x.relatorio),
                delegacao: suporte.lerDelegacao(x.delegacao),
                conversa: suporte.lerResumoDaConversa(x.conversa),
              };
            }),
          };
          mudou();
        }, () => { todos = { carregados: true, lista: [] }; mudou(); });
      }
      return todos;
    },
    async marcar(id, status) { await updateDoc(doc(db, 'feedbacks', id), { status, ...(status === 'feito' ? { resolvidoEm: new Date().toISOString() } : {}) }); },
    // a quem foi delegada (16/11/2026): o mapa delegacao { uid, nome, por, em }; a regra deixa só o admin gravar
    async delegar(id, d) {
      try { await updateDoc(doc(db, 'feedbacks', id), { delegacao: { uid: d.uid, nome: d.nome, por: d.por, em: d.em } }); }
      catch (e) {
        if ((e as { code?: string } | null)?.code === 'permission-denied') throw new Error('o banco ainda não aceita a delegação (falta publicar a regra dos feedbacks).', { cause: e });
        throw e;
      }
    },
    // a conversa (16/11/2026): só a do feedback aberto (o admin, na janela dele; quem mandou, na janela grande da conversa).
    // Negada, insiste (16/11/2026: com a regra fora do ar, a conversa aberta parou de ouvir e as perguntas gravadas depois
    // não apareciam: "mandei e não aconteceu nada"); enquanto isso, fica com o que já tinha chegado
    ouvirMensagens(id, aoMudar) {
      let ultima: suporte.MensagemDoFeedback[] = [];
      aoMudar({ carregadas: false, lista: [] });
      return ouvirInsistindo(query(collection(db, 'feedbacks', id, 'mensagens'), limit(300)), s => {
        ultima = suporte.emOrdem(s.docs.map(d => suporte.lerMensagem(d.id, d.data())).filter(m => m !== null));
        aoMudar({ carregadas: true, lista: ultima });
      }, e => aoMudar({ carregadas: true, lista: ultima, erro: /permission|insufficient/i.test(e instanceof Error ? e.message : String(e))
        ? 'O banco não deixou ler a conversa (a regra dos feedbacks no ar não tem a conversa). Vou tentar de novo sozinho a cada minuto.'
        : 'Não consegui abrir a conversa: ' + (e instanceof Error ? e.message : String(e)) }));
    },
    // a mensagem e o resumo no mesmo lote: a regra confere quem escreve (o admin, ou o dono depois que o admin perguntou) e
    // que a contagem só sobe de um em um
    async escrever(id, de, txt) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      const f = todos?.lista.find(x => x.id === id) ?? meus?.lista.find(x => x.id === id);
      if (f && !suporte.podeEscrever(de, f.status, f.conversa)) throw new Error('a conversa está fechada (o pedido já foi resolvido).');
      const { mensagem, resumo } = suporte.mensagemNova(f?.conversa ?? null, de, q.nome || q.email, txt, new Date());
      const ref = doc(db, 'feedbacks', id);
      const lote = writeBatch(db);
      lote.set(doc(collection(ref, 'mensagens')), { ...mensagem, uid: q.uid });
      lote.update(ref, { 'conversa.qtd': increment(1), 'conversa.ultimaDe': resumo.ultimaDe, 'conversa.ultimaEm': resumo.ultimaEm, 'conversa.ultimoTexto': resumo.ultimoTexto });
      try { await lote.commit(); }
      catch (e) {
        if ((e as { code?: string } | null)?.code === 'permission-denied') throw new Error('o banco ainda não aceita a conversa (falta publicar a regra dos feedbacks).', { cause: e });
        throw e;
      }
    },
    // quem mandou responde o teste (a regra só deixa o dono, e só com o ticket em Testando)
    async responderTeste(id, funcionou) { await updateDoc(doc(db, 'feedbacks', id), funcionou ? { status: 'feito', resolvidoEm: new Date().toISOString() } : { status: 'resolvendo' }); },
    // os seus (Vitor, 26/10/2026: o aviso do Resolvendo): a regra deixa cada um ler os que mandou (uid); sem orderBy, para
    // não pedir índice composto
    meus() {
      const q = quem();
      if (!q) return [];
      if (!meus || meus.uid !== q.uid) {
        const estes: { uid: string; lista: MeuFeedback[] } = { uid: q.uid, lista: [] };
        meus = estes;
        onSnapshot(query(collection(db, 'feedbacks'), where('uid', '==', q.uid), limit(200)), s => {
          estes.lista = s.docs.map(d => { const x = d.data(); return { id: d.id, texto: texto(x.texto), status: (STATUS.includes(x.status) ? x.status : 'novo') as SituacaoDoFeedback, criadoEm: texto(x.criadoEm), tipo: x.tipo === 'bug' ? 'bug' as const : 'feedback' as const, caminho: texto(x.caminho), conversa: suporte.lerResumoDaConversa(x.conversa), ...(x.resolvidoEm ? { resolvidoEm: texto(x.resolvidoEm) } : {}) }; });
          mudou();
        }, () => { estes.lista = []; mudou(); });
      }
      return meus.lista;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
