// Os feedbacks do nads (Vitor, 07/10/2026: "uma função de feedbacks, onde a pessoa pode tirar a foto e explicar o que
// quer melhorar"): o print da tela (a imagem já comprimida), o texto, a tela onde estava, a versão e quem mandou. O admin
// vê todos nos Feedbacks (o pé da gaveta ☰) e marca como visto ou feito. Desde 19/10/2026, com a prioridade (Baixa, Média,
// Alta) que quem manda escolhe; o admin filtra e ordena por ela. Interface + a versão de exemplo; a do banco é
// feedback.firestore.ts (coleção feedbacks do Entregas).

export type SituacaoDoFeedback = 'novo' | 'visto' | 'feito';

/** A prioridade que quem manda escolhe (Vitor, 19/10/2026: feedbacks com "prioridade"). */
export type PrioridadeDoFeedback = 'baixa' | 'media' | 'alta';

/** Da mais alta para a mais baixa (a ordem do filtro e da lista). */
export const PRIORIDADES: readonly { valor: PrioridadeDoFeedback; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];

export const ehPrioridade = (v: unknown): v is PrioridadeDoFeedback => PRIORIDADES.some(p => p.valor === v);

const PESO: Record<PrioridadeDoFeedback, number> = { alta: 0, media: 1, baixa: 2 };

/**
 * A ordem por prioridade: Alta, Média, Baixa; os antigos, de antes da prioridade, depois da Média (contam como Média, mas
 * atrás dos que escolheram). Na mesma prioridade, o mais novo em cima.
 */
export function ordenarPorPrioridade<T extends Pick<Feedback, 'prioridade' | 'criadoEm'>>(lista: readonly T[]): T[] {
  const peso = (f: T) => (f.prioridade ? PESO[f.prioridade] : 1.5);
  return [...lista].sort((a, b) => peso(a) - peso(b) || b.criadoEm.localeCompare(a.criadoEm));
}

export interface Feedback {
  id: string;
  texto: string;
  /** o print, em data URL (JPEG comprimido) — vazio se não mandou imagem */
  imagem: string;
  /** a tela onde a pessoa estava (o caminho) */
  tela: string;
  versao: string;
  nome: string;
  email: string;
  /** ISO */
  criadoEm: string;
  status: SituacaoDoFeedback;
  /** null = mandado antes de existir a prioridade (19/10/2026) */
  prioridade: PrioridadeDoFeedback | null;
  /** 'bug' = veio do suporte de leitura (o balão), com o arquivo e o report do robô (Vitor, 20/10/2026) */
  tipo: 'feedback' | 'bug';
  /** o bug: a conversa das cápsulas ("Faltou lançamento › Bradesco › 08/2026 › Não resolveu") */
  caminho: string;
  /** o bug: a empresa e a tela de onde veio */
  empresa: string;
  /** o bug: o arquivo mandado (nome e tamanho); vazio = sem arquivo */
  arquivo: { nome: string; tamanho: number; partes: number } | null;
  /** o bug: a análise do robô ('pendente' → 'analisando' → 'pronta' ou 'erro') e o report */
  analise: 'pendente' | 'analisando' | 'pronta' | 'erro' | '';
  relatorio: string;
}

/** O bug mandado pelo balão do suporte. */
export interface BugDoSuporte {
  texto: string;
  tela: string;
  versao: string;
  caminho: string;
  contexto: { empresa: string; codigo: number | null; tela: string; meses: string[] };
  arquivo: { nome: string; bytes: Uint8Array } | null;
}

export interface RepoFeedback {
  exemplos: boolean;
  enviar(f: { texto: string; imagem: string; tela: string; versao: string; prioridade: PrioridadeDoFeedback }): Promise<void>;
  /** o bug do suporte de leitura: o documento e o arquivo em pedaços; o robô do PC do escritório escreve o report */
  enviarBug(b: BugDoSuporte): Promise<void>;
  /** o arquivo do bug, de volta (só o admin), para baixar */
  arquivoDoBug(id: string): Promise<{ nome: string; bytes: Uint8Array } | null>;
  /** todos os feedbacks (só o admin lê); pedir já começa a ouvir */
  todos(): { carregados: boolean; lista: Feedback[] };
  marcar(id: string, status: SituacaoDoFeedback): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarFeedbackMemoria(quem: () => string): RepoFeedback {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  // uns de exemplo, para ver a lista do admin com as prioridades (nada vai para o banco)
  const ha = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const base = { imagem: '', versao: '', email: '', status: 'novo' as const, tipo: 'feedback' as const, caminho: '', empresa: '', arquivo: null, analise: '' as const, relatorio: '' };
  let lista: Feedback[] = [
    { id: 'fx-1', ...base, nome: 'Vitor', tela: '/tarefas/cadastro/empresas', criadoEm: ha(3), prioridade: 'alta', texto: 'No Cadastro, o sênior precisa trocar o regime sem pedir para o diretor.' },
    { id: 'fx-2', ...base, nome: 'Clara', tela: '/tarefas/minhas-empresas/empresas', criadoEm: ha(1), prioridade: 'baixa', texto: 'Seria bom a lista de empresas lembrar o filtro quando eu volto.' },
    { id: 'fx-3', ...base, nome: 'Heverton', tela: '/tarefas/fiscal/painel', criadoEm: ha(26), prioridade: 'media', texto: 'O painel do Fiscal demora para abrir de manhã.' },
    { id: 'fx-5', ...base, nome: 'Clara', tela: '/tarefas/executar/1/2026-08', criadoEm: ha(2), prioridade: 'alta', tipo: 'bug', empresa: '1 · EMPRESA EXEMPLO',
      caminho: 'Faltou lançamento › Bradesco › 08/2026 › Não resolveu', arquivo: { nome: 'extrato 08-2026.pdf', tamanho: 70000, partes: 1 }, analise: 'pronta',
      texto: 'Faltou a tarifa do dia 31.',
      relatorio: 'O extrato termina com o quadro "Últimos Lançamentos", e o leitor juntava esse quadro ao mês.\n\nRealmente, isso é erro do sistema' },
    { id: 'fx-4', ...base, nome: 'Sávio', tela: '/tarefas/dp/resumo', criadoEm: ha(50), prioridade: null, status: 'visto', texto: 'Mandado antes da prioridade: a etiqueta da folha saiu cortada.' },
  ];
  return {
    exemplos: true,
    async enviar(f) {
      lista = [{ id: 'f' + Date.now(), ...f, nome: quem(), email: '', criadoEm: new Date().toISOString(), status: 'novo', tipo: 'feedback', caminho: '', empresa: '', arquivo: null, analise: '', relatorio: '' }, ...lista];
      mudou();
    },
    async enviarBug(b) {
      lista = [{
        id: 'b' + Date.now(), texto: b.texto, imagem: '', tela: b.tela, versao: b.versao, nome: quem(), email: '', criadoEm: new Date().toISOString(),
        status: 'novo', prioridade: 'alta', tipo: 'bug', caminho: b.caminho, empresa: b.contexto.empresa,
        arquivo: b.arquivo ? { nome: b.arquivo.nome, tamanho: b.arquivo.bytes.length, partes: 1 } : null, analise: 'pendente', relatorio: '',
      }, ...lista];
      mudou();
    },
    async arquivoDoBug() { return null; },
    todos: () => ({ carregados: true, lista }),
    async marcar(id, status) { lista = lista.map(x => (x.id === id ? { ...x, status } : x)); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
