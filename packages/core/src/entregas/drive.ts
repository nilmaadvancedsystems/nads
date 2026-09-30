// O Drive do escritório como o robô do Entregas mapeia (a pasta do ano, uma pasta por cliente). O navegador não
// fala com o Drive: lê o mapa que o robô mantém no banco (driveIndice) e pede a ele os arquivos (aberturasDrive).
//   driveIndice/raiz                    { pastaId, pastaNome, atualizadoEm, clientes: [{ id, nome, nomePasta, codigo, arquivos, pastas, bytes, mod }] }
//   driveIndice/{pasta}/partes/{n}      { itens: [{ i, n, p, t: 'd'|'f'|'g', s?, m?, x? }] }  (lista plana; a árvore sai do p)

/** Um item do mapa: pasta (d), arquivo (f) ou documento do Google (g). */
export interface ItemDoDrive {
  i: string;
  n: string;
  /** a pasta de cima */
  p: string;
  t: 'd' | 'f' | 'g';
  /** bytes */
  s?: number;
  /** modificado em (ISO) */
  m?: string;
  /** tipo (mime) */
  x?: string;
}

/** A pasta de um cliente no mapa (driveIndice/raiz.clientes). */
export interface PastaDeCliente {
  id: string;
  nome: string;
  nomePasta: string;
  /** o código do ERP ("58 - NOME" → "58") */
  codigo: string;
  arquivos: number;
  pastas: number;
  bytes: number;
  mod: string | null;
}

export interface MapaDoDrive {
  /** já chegou do banco (ou falhou) */
  carregado: boolean;
  /** a pasta do ano (2026) */
  pastaAno: { id: string; nome: string } | null;
  clientes: PastaDeCliente[];
  atualizadoEm: string;
  /** sem permissão, robô sem mapa… */
  erro?: string;
}

export const MAPA_VAZIO: MapaDoDrive = { carregado: false, pastaAno: null, clientes: [], atualizadoEm: '' };

const texto = (v: unknown) => (v == null ? '' : String(v));
const numero = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);

/** O documento driveIndice/raiz conferido. */
export function mapaDaRaiz(doc: Record<string, unknown> | null | undefined): MapaDoDrive {
  if (!doc) return { ...MAPA_VAZIO, carregado: true };
  const clientes = Array.isArray(doc.clientes)
    ? (doc.clientes as Record<string, unknown>[]).map(c => ({
      id: texto(c?.id), nome: texto(c?.nome), nomePasta: texto(c?.nomePasta), codigo: texto(c?.codigo),
      arquivos: numero(c?.arquivos), pastas: numero(c?.pastas), bytes: numero(c?.bytes), mod: texto(c?.mod) || null,
    })).filter(c => c.id)
    : [];
  return {
    carregado: true,
    pastaAno: doc.pastaId ? { id: texto(doc.pastaId), nome: texto(doc.pastaNome) || 'Drive' } : null,
    clientes, atualizadoEm: texto(doc.atualizadoEm),
  };
}

/** Os itens das partes de uma pasta de cliente (itens estranhos ficam de fora). */
export function itensDasPartes(partes: readonly { itens?: unknown }[]): ItemDoDrive[] {
  const lista: ItemDoDrive[] = [];
  for (const parte of partes) {
    if (!Array.isArray(parte.itens)) continue;
    for (const x of parte.itens as Record<string, unknown>[]) {
      const t = x?.t === 'd' || x?.t === 'f' || x?.t === 'g' ? x.t : null;
      if (!t || !x.i) continue;
      const it: ItemDoDrive = { i: texto(x.i), n: texto(x.n), p: texto(x.p), t };
      if (typeof x.s === 'number') it.s = x.s;
      if (x.m) it.m = texto(x.m);
      if (x.x) it.x = texto(x.x);
      lista.push(it);
    }
  }
  return lista;
}

const ordemNatural = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Os itens de dentro de uma pasta: pastas primeiro, depois os arquivos, em ordem natural ("2" antes de "10"). */
export function filhosDe(itens: readonly ItemDoDrive[], pastaId: string): ItemDoDrive[] {
  return itens.filter(x => x.p === pastaId)
    .sort((a, b) => (a.t === 'd' ? 0 : 1) - (b.t === 'd' ? 0 : 1) || ordemNatural.compare(a.n, b.n));
}

/** O caminho da pasta raiz até o item (sem a raiz): para a trilha "2026 › cliente › …". */
export function caminhoAte(itens: readonly ItemDoDrive[], id: string, raizId: string): ItemDoDrive[] {
  const porId = new Map(itens.map(x => [x.i, x]));
  const caminho: ItemDoDrive[] = [];
  let atual = porId.get(id);
  for (let passos = 0; atual && atual.i !== raizId && passos < 60; passos++) {
    caminho.unshift(atual);
    atual = porId.get(atual.p);
  }
  return caminho;
}

/** Tudo o que está dentro da pasta, em qualquer nível. */
export function descendentesDe(itens: readonly ItemDoDrive[], pastaId: string): ItemDoDrive[] {
  const filhos = new Map<string, ItemDoDrive[]>();
  for (const x of itens) { const l = filhos.get(x.p); if (l) l.push(x); else filhos.set(x.p, [x]); }
  const saida: ItemDoDrive[] = [];
  const fila = [pastaId];
  while (fila.length) {
    for (const x of filhos.get(fila.shift() as string) || []) { saida.push(x); if (x.t === 'd') fila.push(x.i); }
  }
  return saida;
}

/** Quantos arquivos e pastas há dentro (em qualquer nível). */
export function quantosDentro(itens: readonly ItemDoDrive[], pastaId: string): { arquivos: number; pastas: number } {
  const d = descendentesDe(itens, pastaId);
  return { arquivos: d.filter(x => x.t !== 'd').length, pastas: d.filter(x => x.t === 'd').length };
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface AchadoNoDrive { item: ItemDoDrive; /** "CONTÁBIL › EXTRATOS › 2026" (as pastas de cima, dentro da pasta da busca) */ onde: string }

/** Busca pelo nome dentro de uma pasta (em qualquer nível): as pastas primeiro. */
export function buscarNaPasta(itens: readonly ItemDoDrive[], pastaId: string, q: string, limite = 500): AchadoNoDrive[] {
  const termos = semAcento(q.trim()).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  const porId = new Map(itens.map(x => [x.i, x]));
  const onde = (x: ItemDoDrive) => {
    const nomes: string[] = [];
    let p = porId.get(x.p);
    for (let passos = 0; p && p.i !== pastaId && passos < 60; passos++) { nomes.unshift(p.n); p = porId.get(p.p); }
    return nomes.join(' › ');
  };
  return descendentesDe(itens, pastaId)
    .filter(x => { const n = semAcento(x.n); return termos.every(t => n.includes(t)); })
    .sort((a, b) => (a.t === 'd' ? 0 : 1) - (b.t === 'd' ? 0 : 1) || ordemNatural.compare(a.n, b.n))
    .slice(0, limite)
    .map(item => ({ item, onde: onde(item) }));
}

/** As pastas de cliente que batem com a busca (código ou nome). */
export function buscarClientes(clientes: readonly PastaDeCliente[], q: string): PastaDeCliente[] {
  const t = semAcento(q.trim());
  const ordenadas = [...clientes].sort((a, b) => (Number(a.codigo) || 1e9) - (Number(b.codigo) || 1e9) || ordemNatural.compare(a.nome, b.nome));
  if (!t) return ordenadas;
  return ordenadas.filter(c => c.codigo === t || c.codigo.startsWith(t) || semAcento(c.nomePasta + ' ' + c.nome).includes(t));
}

/** "1,2 MB" */
export function tamanhoLegivel(bytes: number | undefined): string {
  if (!bytes) return '';
  const u = ['bytes', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i === 0 ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })) + ' ' + u[i];
}

export const ehPdf = (x: Pick<ItemDoDrive, 'n' | 'x'>) => x.x === 'application/pdf' || /\.pdf$/i.test(x.n);

/** Um pedido ao robô: abrir no navegador, baixar, ou juntar vários (ou uma pasta) num .zip. */
export interface PedidoAoDrive {
  modo: 'abrir' | 'baixar' | 'zip';
  /** o arquivo (no zip, o primeiro da lista ou a pasta: a regra do banco exige) */
  fileId: string;
  nome: string;
  fileIds?: string[];
  pastaId?: string;
  nomeZip?: string;
}

/** Até quantos arquivos um .zip leva (a regra do banco). */
export const MAX_NO_ZIP = 500;

/** O pedido de .zip dos itens escolhidos (só arquivos; as pastas entram inteiras pelo pedido da pasta). */
export function pedidoDeZip(itens: readonly ItemDoDrive[], nomeZip: string): PedidoAoDrive | null {
  const arquivos = itens.filter(x => x.t !== 'd').slice(0, MAX_NO_ZIP);
  if (!arquivos.length) return null;
  return { modo: 'zip', fileId: arquivos[0].i, nome: nomeZip, fileIds: arquivos.map(x => x.i), nomeZip: nomeZip.slice(0, 200) };
}

export function pedidoDaPasta(pasta: ItemDoDrive | { i: string; n: string }): PedidoAoDrive {
  return { modo: 'zip', fileId: pasta.i, nome: pasta.n, pastaId: pasta.i, nomeZip: pasta.n.slice(0, 200) };
}

/** Como o robô está respondendo um pedido. */
export interface AndamentoDoPedido {
  status: 'pendente' | 'buscando' | 'pronto' | 'erro';
  url?: string;
  progresso?: string;
  erro?: string;
  tamanho?: number;
  arquivos?: number;
}

export function andamentoDoDocumento(doc: Record<string, unknown> | null | undefined): AndamentoDoPedido {
  const d = doc || {};
  const status = d.status === 'buscando' || d.status === 'pronto' || d.status === 'erro' ? d.status : 'pendente';
  const a: AndamentoDoPedido = { status };
  if (d.url) a.url = texto(d.url);
  if (d.progresso) a.progresso = texto(d.progresso);
  if (d.erro) a.erro = texto(d.erro);
  if (typeof d.tamanho === 'number') a.tamanho = d.tamanho;
  if (typeof d.arquivos === 'number') a.arquivos = d.arquivos;
  return a;
}
