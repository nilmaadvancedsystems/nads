// O que é só da pessoa, na Minha página (a janela do avatar):
//   - as cobranças que ela pediu (solicitacoesEmail com o e-mail dela: Pedir documentos, as respostas pelo robô);
//   - as anotações (usuarios/{uid}/notas — as mesmas das Anotações do Entregas: texto, feito, criadoEm, lembreteEm);
//   - o que ela já arquivou na caixa de entrada (usuarios/{uid}.nadsArquivados: a lista de ids, vale em todo
//     computador).
// Interface + a versão de exemplo (memória); a do banco é pessoal.firestore.ts.

export type TipoDeCobranca = 'um' | 'lote' | 'responder';

export interface CobrancaMinha {
  id: string;
  tipo: TipoDeCobranca;
  /** para quem (o e-mail, ou "N clientes" no lote) */
  para: string;
  clienteNome: string;
  assunto: string;
  /** pendente, processando, enviado ou erro (o robô) */
  status: string;
  criadoEm: string;
  enviadoEm: string;
  erro: string;
}

export interface Nota {
  id: string;
  texto: string;
  feito: boolean;
  criadoEm: string;
  /** o lembrete (ISO), se tiver */
  lembreteEm: string | null;
}

export interface RepoPessoal {
  exemplos: boolean;
  /** as cobranças dos últimos 30 dias, as mais novas primeiro */
  minhasCobrancas(): { carregadas: boolean; lista: CobrancaMinha[] };
  notas(): { carregadas: boolean; lista: Nota[] };
  novaNota(texto: string, lembreteEm: string | null): Promise<void>;
  editarNota(id: string, texto: string): Promise<void>;
  marcarNota(id: string, feito: boolean): Promise<void>;
  apagarNota(id: string): Promise<void>;
  /** os ids dos itens da caixa de entrada que a pessoa arquivou */
  arquivados(): string[];
  arquivar(id: string): Promise<void>;
  desarquivar(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** A ordem das Anotações do Entregas: as não feitas antes; com lembrete primeiro (o mais perto antes); o resto do mais novo. */
export function ordenarNotas(lista: Nota[]): Nota[] {
  return lista.slice().sort((a, b) => {
    if (a.feito !== b.feito) return a.feito ? 1 : -1;
    if (!!a.lembreteEm !== !!b.lembreteEm) return a.lembreteEm ? -1 : 1;
    if (a.lembreteEm && b.lembreteEm) return a.lembreteEm.localeCompare(b.lembreteEm);
    return b.criadoEm.localeCompare(a.criadoEm);
  });
}

/** Só as dos últimos 30 dias, as mais novas primeiro. */
export function cobrancasRecentes(lista: CobrancaMinha[], agora = new Date()): CobrancaMinha[] {
  const desde = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return lista.filter(c => c.criadoEm >= desde).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function criarPessoalMemoria(): RepoPessoal {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const agora = () => new Date().toISOString();
  const haDias = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
  const cobrancas: CobrancaMinha[] = [
    { id: 'c1', tipo: 'um', para: 'financeiro@tornearia.com.br', clienteNome: 'TORNEARIA VOLPONI', assunto: 'Documentos de setembro/2026', status: 'enviado', criadoEm: haDias(1), enviadoEm: haDias(1), erro: '' },
    { id: 'c2', tipo: 'um', para: 'contato@fito.com.br', clienteNome: 'FITO ALIMENTOS', assunto: 'Documentos de setembro/2026', status: 'erro', criadoEm: haDias(2), enviadoEm: '', erro: 'endereço recusado pelo Gmail' },
  ];
  let notas: Nota[] = [{ id: 'n1', texto: 'Ligar para a FITO sobre o extrato do Sicoob', feito: false, criadoEm: haDias(1), lembreteEm: null }];
  let arquivados: string[] = [];
  return {
    exemplos: true,
    minhasCobrancas: () => ({ carregadas: true, lista: cobrancasRecentes(cobrancas) }),
    notas: () => ({ carregadas: true, lista: ordenarNotas(notas) }),
    async novaNota(texto, lembreteEm) { notas = [...notas, { id: 'n' + Date.now(), texto, feito: false, criadoEm: agora(), lembreteEm }]; mudou(); },
    async editarNota(id, texto) { notas = notas.map(n => (n.id === id ? { ...n, texto } : n)); mudou(); },
    async marcarNota(id, feito) { notas = notas.map(n => (n.id === id ? { ...n, feito } : n)); mudou(); },
    async apagarNota(id) { notas = notas.filter(n => n.id !== id); mudou(); },
    arquivados: () => arquivados,
    async arquivar(id) { if (!arquivados.includes(id)) arquivados = [...arquivados, id]; mudou(); },
    async desarquivar(id) { arquivados = arquivados.filter(x => x !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
