// O delegador de tarefas (28/10/2026, o "Minhas Tarefas" do Toriba): qualquer pessoa da equipe cria a tarefa e delega
// para qualquer outra; cada uma vê as que são dela (responsável) e as que ela criou, ao vivo. Os anexos vão em pedaços,
// como os dos feedbacks. Interface + a versão de exemplo (na memória, com 4 tarefas); a do banco é
// tarefasDelegadas.firestore.ts (coleção nadsTarefasDelegadas do Entregas). As regras são do core (tarefas.delegadas).
import { tarefas } from '@nads/core';

const d = tarefas.delegadas;
type TarefaDelegada = tarefas.delegadas.TarefaDelegada;
type Pessoa = tarefas.delegadas.Pessoa;

/** Um arquivo escolhido para anexar (o nome e os bytes). */
export interface ArquivoParaAnexar { nome: string; bytes: Uint8Array }

export interface RepoTarefasDelegadas {
  exemplos: boolean;
  /** quem está usando (o uid do login e o nome); null = ninguém entrou */
  eu(): Pessoa | null;
  /**
   * as tarefas de quem está usando (o responsável ou quem criou), ao vivo; pedir já começa a ouvir. erro: o banco recusou
   * (a regra ainda não está no ar, ou caiu a conexão)
   */
  lista(): { carregadas: boolean; tarefas: TarefaDelegada[]; erro?: string };
  /** cria a tarefa (o rascunho já validado) e sobe os anexos; devolve o id */
  criar(r: tarefas.delegadas.Rascunho, anexos: ArquivoParaAnexar[]): Promise<string>;
  /** grava o rascunho na tarefa (o histórico do que mudou vai junto) */
  salvar(id: string, r: tarefas.delegadas.Rascunho): Promise<void>;
  comentar(id: string, texto: string): Promise<void>;
  anexar(id: string, arquivos: ArquivoParaAnexar[]): Promise<void>;
  tirarAnexo(id: string, anexoId: string): Promise<void>;
  /** os bytes do anexo, para baixar (null = não achou) */
  baixarAnexo(id: string, anexoId: string): Promise<Uint8Array | null>;
  excluir(id: string): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

/** Confere os arquivos antes de subir (lança o erro com o motivo). */
export function conferirAnexos(t: Pick<TarefaDelegada, 'anexos'> | null, arquivos: readonly ArquivoParaAnexar[]): void {
  const problema = d.problemaDosAnexos(arquivos.map(a => ({ nome: a.nome, tamanho: a.bytes.length })), t?.anexos || []);
  if (problema) throw new Error(problema);
}

/** Um id curto e aleatório (o dos anexos e das tarefas de exemplo). */
export const idNovo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** As 4 tarefas de exemplo (Nilma recebe a maioria: é quem o escritório usa para testar), relativas a hoje. */
function exemplos(agora = new Date()): TarefaDelegada[] {
  const ha = (h: number) => new Date(agora.getTime() - h * 3600_000).toISOString();
  const dia = (n: number) => d.hojeIso(new Date(agora.getTime() + n * 86400_000));
  const p = (uid: string, nome: string) => ({ uid, nome });
  const nilma = p('exemplo-1', 'Nilma'), savio = p('exemplo-2', 'Sávio'), vitor = p('exemplo-3', 'Vitor'), clara = p('exemplo-6', 'Clara'), heverton = p('exemplo-7', 'Heverton');
  const base = { descricao: '', cliente: null, concluidaEm: '', pareceres: [], anexos: [] };
  return [
    { ...base, id: 'td-1', numero: 1, titulo: 'Conferir o balancete de setembro', descricao: 'O saldo de bancos não bateu com o extrato do Sicoob. Ver se faltou alguma tarifa.',
      cliente: { codigo: 292, nome: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA' }, prioridade: 'alta', prazo: dia(-2), status: 'pendente', criadaPor: vitor, responsavel: nilma,
      criadaEm: ha(72), atualizadaEm: ha(70),
      pareceres: [{ por: 'Vitor', em: ha(70), texto: 'Deixei o extrato anexado.' }],
      historico: [{ por: 'Vitor', em: ha(72), texto: 'Criou a tarefa' }, { por: 'Vitor', em: ha(72), texto: 'Delegou para Nilma' }, { por: 'Vitor', em: ha(70), texto: 'Anexou o arquivo observacoes.txt' }, { por: 'Vitor', em: ha(70), texto: 'Escreveu um parecer' }],
      anexos: [{ id: 'ax-1', nome: 'observacoes.txt', extensao: 'txt', tamanho: 74, em: ha(70), por: 'Vitor', partes: 1 }] },
    { ...base, id: 'td-2', numero: 2, titulo: 'Mandar a guia do DAS para o cliente', cliente: { codigo: 14, nome: 'ALFA COMERCIO LTDA' }, prioridade: 'urgente', prazo: dia(1),
      status: 'andamento', criadaPor: heverton, responsavel: nilma, criadaEm: ha(20), atualizadaEm: ha(5),
      historico: [{ por: 'Heverton', em: ha(20), texto: 'Criou a tarefa' }, { por: 'Heverton', em: ha(20), texto: 'Delegou para Nilma' }, { por: 'Nilma', em: ha(5), texto: 'Mudou o status de Pendente para Em andamento' }] },
    { ...base, id: 'td-3', numero: 3, titulo: 'Atualizar o cadastro dos sócios', descricao: 'A alteração contratual chegou por e-mail.', prioridade: 'normal', prazo: dia(5),
      status: 'pendente', criadaPor: nilma, responsavel: clara, criadaEm: ha(8), atualizadaEm: ha(8),
      historico: [{ por: 'Nilma', em: ha(8), texto: 'Criou a tarefa' }, { por: 'Nilma', em: ha(8), texto: 'Delegou para Clara' }] },
    { ...base, id: 'td-4', numero: 4, titulo: 'Revisar as férias de outubro', prioridade: 'normal', prazo: dia(-3), status: 'concluida', criadaPor: savio, responsavel: nilma,
      criadaEm: ha(120), concluidaEm: ha(30), atualizadaEm: ha(30),
      historico: [{ por: 'Sávio', em: ha(120), texto: 'Criou a tarefa' }, { por: 'Sávio', em: ha(120), texto: 'Delegou para Nilma' }, { por: 'Nilma', em: ha(30), texto: 'Mudou o status de Pendente para Concluída' }] },
  ];
}

export function criarTarefasDelegadasMemoria(quem: () => Pessoa | null): RepoTarefasDelegadas {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lista = exemplos();
  let cache: { ver: number; uid: string; estado: { carregadas: boolean; tarefas: TarefaDelegada[] } } | null = null;
  // os bytes dos anexos (na memória; somem ao recarregar)
  const bytes = new Map<string, Uint8Array>([['ax-1', new TextEncoder().encode('Extrato do Sicoob de 09/2026: conferir a tarifa do dia 30 (R$ 12,90).')]]);
  const eu = () => { const q = quem(); if (!q) throw new Error('escolha quem está usando'); return q; };
  const daTarefa = (id: string) => { const t = lista.find(x => x.id === id); if (!t) throw new Error('a tarefa não existe mais'); return t; };
  const trocar = (t: TarefaDelegada) => { lista = lista.map(x => (x.id === t.id ? t : x)); mudou(); };
  const subir = (arquivos: readonly ArquivoParaAnexar[], por: string, em: string) => arquivos.map(a => {
    const id = 'ax-' + idNovo();
    bytes.set(id, a.bytes);
    const nome = d.nomeDoAnexo(a.nome);
    return { id, nome, extensao: d.extensaoDe(nome), tamanho: a.bytes.length, em, por, partes: 1 };
  });
  return {
    exemplos: true,
    eu: quem,
    // o de exemplo mostra o que é da pessoa escolhida (como o banco faz pela busca); a mesma lista até mudar algo
    lista: () => {
      const uid = quem()?.uid || '';
      if (!cache || cache.ver !== ver || cache.uid !== uid) {
        cache = { ver, uid, estado: { carregadas: true, tarefas: uid ? lista.filter(t => t.criadaPor.uid === uid || t.responsavel.uid === uid) : [] } };
      }
      return cache.estado;
    },
    async criar(r, anexos) {
      const por = eu();
      const problema = d.problemaDaTarefa(r);
      if (problema) throw new Error(problema);
      conferirAnexos(null, anexos);
      const em = new Date().toISOString();
      const numero = lista.reduce((m, t) => Math.max(m, t.numero), 0) + 1;
      const t = d.comAnexos(d.nova(r, { id: 'td-' + idNovo(), numero, por, em }), subir(anexos, por.nome, em), por.nome, em);
      lista = [...lista, t];
      mudou();
      return t.id;
    },
    async salvar(id, r) {
      const problema = d.problemaDaTarefa(r);
      if (problema) throw new Error(problema);
      trocar(d.mudar(daTarefa(id), r, eu(), new Date().toISOString()));
    },
    async comentar(id, texto) {
      const t = daTarefa(id);
      const problema = d.problemaDoParecer(texto, t);
      if (problema) throw new Error(problema);
      trocar(d.comParecer(t, texto, eu().nome, new Date().toISOString()));
    },
    async anexar(id, arquivos) {
      const t = daTarefa(id);
      conferirAnexos(t, arquivos);
      const em = new Date().toISOString();
      trocar(d.comAnexos(t, subir(arquivos, eu().nome, em), eu().nome, em));
    },
    async tirarAnexo(id, anexoId) {
      bytes.delete(anexoId);
      trocar(d.semAnexo(daTarefa(id), anexoId, eu().nome, new Date().toISOString()));
    },
    async baixarAnexo(_id, anexoId) { return bytes.get(anexoId) || null; },
    async excluir(id) {
      for (const a of daTarefa(id).anexos) bytes.delete(a.id);
      lista = lista.filter(t => t.id !== id);
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
