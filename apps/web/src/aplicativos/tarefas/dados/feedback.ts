// Os feedbacks do nads (Vitor, 07/10/2026: "uma função de feedbacks, onde a pessoa pode tirar a foto e explicar o que
// quer melhorar"): o print da tela (a imagem já comprimida), o texto, a tela onde estava, a versão e quem mandou. O admin
// vê todos nos Feedbacks (o pé da gaveta ☰) e marca como visto ou feito. Desde 19/10/2026, com a prioridade (Baixa, Média,
// Alta) que quem manda escolhe; o admin filtra e ordena por ela. Interface + a versão de exemplo; a do banco é
// feedback.firestore.ts (coleção feedbacks do Entregas).

/** resolvendo (Vitor, 26/10/2026): o admin está resolvendo; quem mandou é avisado */
export type SituacaoDoFeedback = 'novo' | 'visto' | 'resolvendo' | 'feito';

/** Um passo do andamento da resolução pelo Claude do PC do Vitor (o botão Resolver; 26/10/2026). */
export interface PassoDaResolucao { em: string; texto: string }

/**
 * A resolução pelo Claude do PC do Vitor (Vitor, 26/10/2026: "um botão de resolver, onde você usa um chat aqui da minha
 * máquina… mande um feedback no chat do usuário do progresso"; 27/10/2026: "a versão com o seu ok"): o admin clica em
 * Resolver (status 'resolver' no banco: a fila), o robô do PC (robo/resolver.js) pega, passa para Resolvendo e escreve o
 * andamento; o Claude corrige numa cópia do nads e para em aprovar (o card mostra o que mudou e o Publicar); o admin
 * clica em Publicar (status 'publicar') e o robô publica (publicando → pronto). Ou: precisa (precisa do Vitor) ou erro.
 */
export interface ResolucaoDoFeedback {
  estado: 'fila' | 'trabalhando' | 'aprovar' | 'publicando' | 'pronto' | 'precisa' | 'erro';
  andamento: PassoDaResolucao[];
  resumo: string;
  /** os arquivos que o Claude mudou (o que o Publicar leva) */
  mudancas: string[];
}

/** Um feedback de quem mandou (o aviso do Resolvendo): o que a regra deixa a pessoa ler dos seus. */
export interface MeuFeedback {
  id: string; texto: string; status: SituacaoDoFeedback; criadoEm: string;
  /** o andamento da resolução pelo Claude (o balão do suporte mostra para quem mandou) */
  andamento: PassoDaResolucao[];
  estado: ResolucaoDoFeedback['estado'] | '';
}

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
  /** o bug: o primeiro arquivo mandado (nome e tamanho); vazio = sem arquivo */
  arquivo: { nome: string; tamanho: number; partes: number } | null;
  /**
   * o bug: todos os arquivos mandados (Vitor, 26/10/2026: "só tá dando para anexar somente 1"), cada um com os pedaços dele em
   * partes/ (de = o primeiro pedaço); o de antes, só o `arquivo`
   */
  arquivos: { nome: string; tamanho: number; de: number; partes: number }[];
  /** o bug: a análise do robô ('pendente' → 'analisando' → 'pronta' ou 'erro') e o report */
  analise: 'pendente' | 'analisando' | 'pronta' | 'erro' | '';
  relatorio: string;
  /** a resolução pelo Claude do PC do Vitor (o botão Resolver); null = não pediu */
  resolucao: ResolucaoDoFeedback | null;
}

/** O bug mandado pelo balão do suporte. */
export interface BugDoSuporte {
  texto: string;
  tela: string;
  versao: string;
  caminho: string;
  contexto: { empresa: string; codigo: number | null; tela: string; meses: string[] };
  /** os arquivos que deram problema (um ou mais) */
  arquivos: { nome: string; bytes: Uint8Array }[];
}

export interface RepoFeedback {
  exemplos: boolean;
  /** arquivos: os anexos além do print (Vitor, 26/10/2026: "deixa o usuário anexar mais de um arquivo, para enviar junto") */
  enviar(f: { texto: string; imagem: string; tela: string; versao: string; prioridade: PrioridadeDoFeedback; arquivos?: { nome: string; bytes: Uint8Array }[] }): Promise<void>;
  /** o bug do suporte de leitura: o documento e o arquivo em pedaços; o robô do PC do escritório escreve o report */
  enviarBug(b: BugDoSuporte): Promise<string>;
  /** um arquivo do bug (o i-ésimo; o primeiro, por padrão), de volta (só o admin), para baixar */
  arquivoDoBug(id: string, i?: number): Promise<{ nome: string; bytes: Uint8Array } | null>;
  /** todos os feedbacks (só o admin lê); pedir já começa a ouvir */
  todos(): { carregados: boolean; lista: Feedback[] };
  marcar(id: string, status: SituacaoDoFeedback): Promise<void>;
  /** o Resolver: o Claude do PC do Vitor resolve (corrige, publica) e conta o andamento para quem mandou */
  resolver(id: string): Promise<void>;
  /** o Publicar: o admin aprova a correção que o Claude fez, e o robô do PC publica */
  publicarResolucao(id: string): Promise<void>;
  /** os feedbacks de quem está usando (a regra deixa ler os seus); pedir já começa a ouvir */
  meus(): MeuFeedback[];
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarFeedbackMemoria(quem: () => string): RepoFeedback {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  // uns de exemplo, para ver a lista do admin com as prioridades (nada vai para o banco)
  const ha = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const base = { imagem: '', versao: '', email: '', status: 'novo' as const, tipo: 'feedback' as const, caminho: '', empresa: '', arquivo: null, arquivos: [], analise: '' as const, relatorio: '', resolucao: null };
  let lista: Feedback[] = [
    { id: 'fx-1', ...base, nome: 'Vitor', tela: '/tarefas/cadastro/empresas', criadoEm: ha(3), prioridade: 'alta', texto: 'No Cadastro, o sênior precisa trocar o regime sem pedir para o diretor.' },
    { id: 'fx-2', ...base, nome: 'Clara', tela: '/tarefas/minhas-empresas/empresas', criadoEm: ha(1), prioridade: 'baixa', texto: 'Seria bom a lista de empresas lembrar o filtro quando eu volto.' },
    { id: 'fx-3', ...base, nome: 'Heverton', tela: '/tarefas/fiscal/painel', criadoEm: ha(26), prioridade: 'media', texto: 'O painel do Fiscal demora para abrir de manhã.' },
    { id: 'fx-5', ...base, nome: 'Clara', tela: '/tarefas/executar/1/2026-08', criadoEm: ha(2), prioridade: 'alta', tipo: 'bug', empresa: '1 · EMPRESA EXEMPLO',
      caminho: 'Faltou lançamento › Bradesco › 08/2026 › Não resolveu', arquivo: { nome: 'extrato 08-2026.pdf', tamanho: 70000, partes: 1 }, arquivos: [{ nome: 'extrato 08-2026.pdf', tamanho: 70000, de: 0, partes: 1 }], analise: 'pronta',
      texto: 'Faltou a tarifa do dia 31.',
      relatorio: 'O extrato termina com o quadro "Últimos Lançamentos", e o leitor juntava esse quadro ao mês.\n\nRealmente, isso é erro do sistema' },
    { id: 'fx-4', ...base, nome: 'Sávio', tela: '/tarefas/dp/resumo', criadoEm: ha(50), prioridade: null, status: 'visto', texto: 'Mandado antes da prioridade: a etiqueta da folha saiu cortada.' },
  ];
  return {
    exemplos: true,
    async enviar({ arquivos: anexos = [], ...f }) {
      lista = [{ id: 'f' + Date.now(), ...f, nome: quem(), email: '', criadoEm: new Date().toISOString(), status: 'novo', tipo: 'feedback', caminho: '', empresa: '',
        arquivo: anexos[0] ? { nome: anexos[0].nome, tamanho: anexos[0].bytes.length, partes: 1 } : null,
        arquivos: anexos.map((a, i) => ({ nome: a.nome, tamanho: a.bytes.length, de: i, partes: 1 })), analise: '', relatorio: '', resolucao: null }, ...lista];
      mudou();
    },
    async enviarBug(b) {
      const id = 'b' + Date.now().toString(36);
      lista = [{
        id, texto: b.texto, imagem: '', tela: b.tela, versao: b.versao, nome: quem(), email: '', criadoEm: new Date().toISOString(),
        status: 'novo', prioridade: 'alta', tipo: 'bug', caminho: b.caminho, empresa: b.contexto.empresa,
        arquivo: b.arquivos[0] ? { nome: b.arquivos[0].nome, tamanho: b.arquivos[0].bytes.length, partes: 1 } : null,
        arquivos: b.arquivos.map((a, i) => ({ nome: a.nome, tamanho: a.bytes.length, de: i, partes: 1 })), analise: 'pendente', relatorio: '', resolucao: null,
      }, ...lista];
      mudou();
      return id;
    },
    async arquivoDoBug() { return null; },
    todos: () => ({ carregados: true, lista }),
    async marcar(id, status) { lista = lista.map(x => (x.id === id ? { ...x, status } : x)); mudou(); },
    // nos exemplos não há o PC do Vitor: fica na fila
    async resolver(id) { lista = lista.map(x => (x.id === id ? { ...x, status: 'resolvendo', resolucao: { estado: 'fila', andamento: [], resumo: '', mudancas: [] } } : x)); mudou(); },
    async publicarResolucao(id) { lista = lista.map(x => (x.id === id && x.resolucao ? { ...x, resolucao: { ...x.resolucao, estado: 'publicando' } } : x)); mudou(); },
    meus: () => lista.filter(x => x.nome === quem()).map(x => ({ id: x.id, texto: x.texto, status: x.status, criadoEm: x.criadoEm, andamento: x.resolucao?.andamento || [], estado: x.resolucao?.estado || '' })),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
