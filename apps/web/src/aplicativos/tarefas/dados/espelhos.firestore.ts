// Os espelhos dos clientes e do cadastro (12/11/2026, consumo do banco; quem mantém é o robô da nuvem, robo/espelhos.js).
// As telas liam as coleções inteiras (os ~400 clientes, os ~230 do cadastro) a cada página nova, e o cache do navegador
// não segurava: quase metade das leituras dos navegadores. O robô guarda cada coleção inteira num documento só,
// cadastro/_espelhos/plano/{clientes|cadastro} (a regra deixa quem está no nads ler; em partes, se passar de 1 MB), e as
// telas ouvem esse documento: 1 leitura em vez de centenas, e 1 a cada mudança.
// Sem o espelho (o robô ainda não gravou, ou não dá sinal há 12 h) ou sem permissão, ouve a coleção, como antes.
import { collection, doc, onSnapshot, type DocumentData, type Firestore } from 'firebase/firestore';

/** O espelho vale se o robô deu sinal nas últimas 12 h (ele grava a cada mudança e, sem mudança, a cada 6 h). */
const VALE_MS = 12 * 36e5;

export interface DocDoEspelho { id: string; data: () => DocumentData }
type Chegou = (docs: DocDoEspelho[]) => void;
type Falhou = (e: Error) => void;

const comoDocs = (m: Record<string, DocumentData> | undefined): DocDoEspelho[] =>
  Object.entries(m || {}).map(([id, d]) => ({ id, data: () => d }));

/** O espelho do documento principal vale (existe, com documentos ou partes, e com o sinal do robô em dia)? */
export function espelhoVale(d: DocumentData | undefined, agora = Date.now()): boolean {
  if (!d) return false;
  const vivo = Date.parse(String(d.vivoEm || d.em || ''));
  return Number.isFinite(vivo) && agora - vivo < VALE_MS && (typeof d.docs === 'object' || Number(d.partes) > 0);
}

/** Ouve a coleção pelo espelho (as partes juntas); sem espelho válido, a coleção. Devolve como parar. */
export function ouvirPeloEspelho(db: Firestore, nome: 'clientes' | 'cadastro', chegou: Chegou, falhou: Falhou): () => void {
  let pararColecao: (() => void) | null = null;
  const pararPartes = new Map<number, () => void>();
  const partes = new Map<number, Record<string, DocumentData>>();
  let quantas = 0;
  let parado = false;

  const pelaColecao = () => {
    if (pararColecao || parado) return;
    pararPartes.forEach(p => p()); pararPartes.clear(); partes.clear(); quantas = 0;
    pararColecao = onSnapshot(collection(db, nome), s => chegou(s.docs.map(d => ({ id: d.id, data: () => d.data() }))), falhou);
  };
  const largarColecao = () => { if (pararColecao) { pararColecao(); pararColecao = null; } };
  const entregarPartes = () => {
    if (partes.size < quantas) return;
    const todos: Record<string, DocumentData> = {};
    for (let i = 1; i <= quantas; i++) Object.assign(todos, partes.get(i));
    chegou(comoDocs(todos));
  };

  const pararPrincipal = onSnapshot(doc(db, 'cadastro', '_espelhos', 'plano', nome), s => {
    const d = s.exists() ? s.data() : undefined;
    if (!espelhoVale(d)) { pelaColecao(); return; }
    largarColecao();
    const n = Number(d!.partes) || 0;
    if (!n) {
      pararPartes.forEach(p => p()); pararPartes.clear(); partes.clear(); quantas = 0;
      chegou(comoDocs(d!.docs as Record<string, DocumentData>));
      return;
    }
    // em partes: ouve cada uma (a que passou do número novo sai)
    quantas = n;
    for (const [i, p] of pararPartes) if (i > n) { p(); pararPartes.delete(i); partes.delete(i); }
    for (let i = 1; i <= n; i++) {
      if (pararPartes.has(i)) continue;
      pararPartes.set(i, onSnapshot(doc(db, 'cadastro', '_espelhos', 'plano', nome + '-' + i), ps => {
        partes.set(i, (ps.data()?.docs || {}) as Record<string, DocumentData>);
        entregarPartes();
      }, () => pelaColecao()));
    }
    entregarPartes();
  }, () => pelaColecao());

  return () => { parado = true; pararPrincipal(); largarColecao(); pararPartes.forEach(p => p()); pararPartes.clear(); };
}

/** Uma leitura só (o primeiro que chegar, do espelho ou da coleção). */
export function lerPeloEspelho(db: Firestore, nome: 'clientes' | 'cadastro'): Promise<DocDoEspelho[]> {
  return new Promise((pronto, falha) => {
    let parar: (() => void) | null = null;
    let chegou = false;
    parar = ouvirPeloEspelho(db, nome, docs => {
      if (chegou) return;
      chegou = true;
      pronto(docs);
      if (parar) parar(); else queueMicrotask(() => parar?.());
    }, falha);
  });
}
