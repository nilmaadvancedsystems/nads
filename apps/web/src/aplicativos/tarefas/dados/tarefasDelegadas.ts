// O delegador de tarefas (28/10/2026, o "Minhas Tarefas" do Toriba): qualquer pessoa da equipe cria a tarefa e delega
// para qualquer outra; cada uma vê as que são dela (responsável) e as que ela criou, ao vivo. Os anexos vão em pedaços,
// como os dos feedbacks. Interface + a versão de exemplo (na memória, com 4 tarefas); a do banco é
// tarefasDelegadas.firestore.ts (coleção nadsTarefasDelegadas do Entregas). As regras são do core (tarefas.delegadas).
import { tarefas } from '@nads/core';
import { bytesDoAnexo } from './encolherAnexo';

const d = tarefas.delegadas;
type TarefaDelegada = tarefas.delegadas.TarefaDelegada;
type Pessoa = tarefas.delegadas.Pessoa;

/**
 * Um arquivo escolhido para anexar, já encolhido (encolherAnexo): os bytes que vão ao banco, o tamanho do arquivo que a
 * pessoa baixa (sem ele, o dos bytes) e gzip = os bytes estão em gzip.
 */
export interface ArquivoParaAnexar { nome: string; bytes: Uint8Array; tamanho?: number; gzip?: boolean }

/** O tamanho do arquivo (o que os limites contam e a lista mostra). */
export const tamanhoDoArquivo = (a: ArquivoParaAnexar) => a.tamanho ?? a.bytes.length;

/** O anexo para a lista do documento (o gzip só entra quando é: o banco não aceita undefined). */
export const anexoDe = (a: ArquivoParaAnexar, o: { id: string; em: string; por: string; partes: number }): tarefas.delegadas.Anexo => {
  const nome = d.nomeDoAnexo(a.nome);
  return { id: o.id, nome, extensao: d.extensaoDe(nome), tamanho: tamanhoDoArquivo(a), em: o.em, por: o.por, partes: o.partes, ...(a.gzip ? { gzip: true as const } : {}) };
};

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
  /**
   * grava na tarefa só os campos que a pessoa mudou (tarefas.delegadas.mudancasDoRascunho), sobre a tarefa como está
   * agora; o histórico só desses campos vai junto
   */
  salvar(id: string, mudancas: Partial<tarefas.delegadas.Rascunho>): Promise<void>;
  comentar(id: string, texto: string): Promise<void>;
  /** quem recebeu abriu a tarefa: grava a hora (o Visualizado de quem delegou; 12/11/2026) */
  marcarVisualizada(id: string): Promise<void>;
  /** a conta da etapa delegada marcada (ou desmarcada) como feita por quem recebeu */
  marcarContaFeita(id: string, conta: tarefas.delegadas.ContaDelegada, feita: boolean): Promise<void>;
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
  const problema = d.problemaDosAnexos(arquivos.map(a => ({ nome: a.nome, tamanho: tamanhoDoArquivo(a) })), t?.anexos || []);
  if (problema) throw new Error(problema);
}

/** Um id curto e aleatório (o dos anexos e das tarefas de exemplo). */
export const idNovo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** As 4 tarefas de exemplo (Nilma recebe a maioria: é quem o escritório usa para testar; com eu, quem está usando), relativas a hoje. */
function exemplos(agora = new Date(), eu: Pessoa | null = null): TarefaDelegada[] {
  const ha = (h: number) => new Date(agora.getTime() - h * 3600_000).toISOString();
  const dia = (n: number) => d.hojeIso(new Date(agora.getTime() + n * 86400_000));
  const p = (uid: string, nome: string) => ({ uid, nome });
  const nilma = eu || p('exemplo-1', 'Nilma'), savio = p('exemplo-2', 'Sávio'), vitor = p('exemplo-3', 'Vitor'), clara = p('exemplo-6', 'Clara'), heverton = p('exemplo-7', 'Heverton');
  const base = { descricao: '', cliente: null, clientes: [], prazoHora: '', concluidaEm: '', pareceres: [], anexos: [] };
  return [
    { ...base, id: 'td-1', numero: 1, titulo: 'Conferir o balancete de setembro', descricao: 'O saldo de bancos não bateu com o extrato do Sicoob. Ver se faltou alguma tarifa.',
      cliente: { codigo: 292, nome: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA' }, clientes: [{ codigo: 292, nome: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA' }], prioridade: 'alta', prazo: dia(-2), status: 'pendente', criadaPor: vitor, responsavel: nilma,
      criadaEm: ha(72), atualizadaEm: ha(70),
      pareceres: [{ por: 'Vitor', em: ha(70), texto: 'Deixei o extrato anexado.' }],
      historico: [{ por: 'Vitor', em: ha(72), texto: 'Criou a tarefa' }, { por: 'Vitor', em: ha(72), texto: 'Delegou para ' + nilma.nome }, { por: 'Vitor', em: ha(70), texto: 'Anexou o arquivo observacoes.txt' }, { por: 'Vitor', em: ha(70), texto: 'Escreveu um parecer' }],
      anexos: [{ id: 'ax-1', nome: 'observacoes.txt', extensao: 'txt', tamanho: 74, em: ha(70), por: 'Vitor', partes: 1 }] },
    { ...base, id: 'td-2', numero: 2, titulo: 'Mandar a guia do DAS para o cliente', cliente: { codigo: 14, nome: 'ALFA COMERCIO LTDA' }, clientes: [{ codigo: 14, nome: 'ALFA COMERCIO LTDA' }], prioridade: 'urgente', prazo: dia(1),
      status: 'andamento', criadaPor: heverton, responsavel: nilma, criadaEm: ha(20), atualizadaEm: ha(5),
      historico: [{ por: 'Heverton', em: ha(20), texto: 'Criou a tarefa' }, { por: 'Heverton', em: ha(20), texto: 'Delegou para ' + nilma.nome }, { por: nilma.nome, em: ha(5), texto: 'Mudou o status de Pendente para Em andamento' }] },
    { ...base, id: 'td-3', numero: 3, titulo: 'Atualizar o cadastro dos sócios', descricao: 'A alteração contratual chegou por e-mail.', prioridade: 'normal', prazo: dia(5),
      status: 'pendente', criadaPor: nilma, responsavel: clara, criadaEm: ha(8), atualizadaEm: ha(8),
      historico: [{ por: nilma.nome, em: ha(8), texto: 'Criou a tarefa' }, { por: nilma.nome, em: ha(8), texto: 'Delegou para Clara' }] },
    { ...base, id: 'td-4', numero: 4, titulo: 'Revisar as férias de outubro', prioridade: 'normal', prazo: dia(-3), status: 'concluida', criadaPor: savio, responsavel: nilma,
      criadaEm: ha(120), concluidaEm: ha(30), atualizadaEm: ha(30),
      historico: [{ por: 'Sávio', em: ha(120), texto: 'Criou a tarefa' }, { por: 'Sávio', em: ha(120), texto: 'Delegou para ' + nilma.nome }, { por: nilma.nome, em: ha(30), texto: 'Mudou o status de Pendente para Concluída' }] },
    ...(eu ? maisExemplos(agora, eu) : []),
  ];
}

/**
 * Mais tarefas para o ⚡ do Início (o modo desenvolvedor; 13/11/2026: "SEMPRE desenvolver formas de preenchimento de dados
 * ficticios para meu teste"): enchem Hoje, Amanhã e Esta semana, os documentos delegados, os comentários e o Por cliente
 * do Início novo. Só empresas fictícias (o repositório é público).
 */
function maisExemplos(agora: Date, eu: Pessoa): TarefaDelegada[] {
  const ha = (h: number) => new Date(agora.getTime() - h * 3600_000).toISOString();
  const dia = (n: number) => d.hojeIso(new Date(agora.getTime() + n * 86400_000));
  const p = (uid: string, nome: string) => ({ uid, nome });
  const savio = p('exemplo-2', 'Sávio'), vitor = p('exemplo-3', 'Vitor'), clara = p('exemplo-6', 'Clara'), heverton = p('exemplo-7', 'Heverton'), fernando = p('exemplo-4', 'Fernando');
  const alfa = { codigo: 14, nome: 'ALFA COMERCIO LTDA' }, beta = { codigo: 27, nome: 'BETA SERVICOS LTDA' }, gama = { codigo: 33, nome: 'GAMA TRANSPORTES LTDA' }, delta = { codigo: 41, nome: 'DELTA AGROPECUARIA LTDA' };
  const base = { descricao: '', prazoHora: '', concluidaEm: '', pareceres: [], anexos: [] };
  const criada = (de: Pessoa, para: Pessoa, h: number) => [{ por: de.nome, em: ha(h), texto: 'Criou a tarefa' }, { por: de.nome, em: ha(h), texto: 'Delegou para ' + para.nome }];
  const t = (n: number, x: Omit<TarefaDelegada, 'id' | 'numero' | 'cliente' | 'descricao' | 'prazoHora' | 'concluidaEm' | 'pareceres' | 'anexos'> & Partial<TarefaDelegada>): TarefaDelegada =>
    ({ ...base, id: 'td-' + n, numero: n, cliente: x.clientes[0] || null, ...x });
  return [
    t(5, { titulo: 'Fechar a folha de novembro', clientes: [alfa], prioridade: 'alta', prazo: dia(0), prazoHora: '17:00', status: 'andamento', criadaPor: savio, responsavel: eu, criadaEm: ha(30), atualizadaEm: ha(3),
      pareceres: [{ por: 'Sávio', em: ha(3), texto: 'As horas extras do mês vieram na planilha anexada.' }],
      historico: [...criada(savio, eu, 30), { por: eu.nome, em: ha(10), texto: 'Iniciou a tarefa' }, { por: 'Sávio', em: ha(3), texto: 'Escreveu um parecer' }] }),
    t(6, { titulo: 'Conferir as notas de entrada', clientes: [beta], prioridade: 'normal', prazo: dia(0), status: 'pendente', criadaPor: heverton, responsavel: eu, criadaEm: ha(28), atualizadaEm: ha(28), historico: criada(heverton, eu, 28) }),
    t(7, { titulo: 'Emitir a guia do FGTS', clientes: [gama], prioridade: 'urgente', prazo: dia(1), status: 'pendente', criadaPor: savio, responsavel: eu, criadaEm: ha(12), atualizadaEm: ha(12), historico: criada(savio, eu, 12) }),
    t(8, { titulo: 'Responder o e-mail do sócio sobre o pró-labore', clientes: [alfa], prioridade: 'baixa', prazo: dia(1), status: 'pendente', criadaPor: eu, responsavel: eu, criadaEm: ha(6), atualizadaEm: ha(6),
      historico: [{ por: eu.nome, em: ha(6), texto: 'Criou a tarefa' }] }),
    t(9, { titulo: 'Lançar o extrato do Sicoob', clientes: [delta], prioridade: 'normal', prazo: dia(3), status: 'pausada', criadaPor: vitor, responsavel: eu, criadaEm: ha(40), atualizadaEm: ha(9),
      pareceres: [{ por: 'Vitor', em: ha(9), texto: 'O extrato de outubro ainda não chegou, pedi para o cliente.' }],
      historico: [...criada(vitor, eu, 40), { por: eu.nome, em: ha(20), texto: 'Iniciou a tarefa' }, { por: eu.nome, em: ha(9), texto: 'Pausou a tarefa' }, { por: 'Vitor', em: ha(9), texto: 'Escreveu um parecer' }] }),
    t(10, { titulo: 'Revisar o balancete do trimestre', clientes: [beta, gama], prioridade: 'alta', prazo: dia(5), status: 'pendente', criadaPor: fernando, responsavel: eu, criadaEm: ha(16), atualizadaEm: ha(16), historico: criada(fernando, eu, 16) }),
    t(11, { titulo: 'Organizar a pasta do Drive', clientes: [], prioridade: 'baixa', prazo: '', status: 'pendente', criadaPor: eu, responsavel: eu, criadaEm: ha(70), atualizadaEm: ha(70), historico: [{ por: eu.nome, em: ha(70), texto: 'Criou a tarefa' }] }),
    t(12, { titulo: 'Apurar o Simples de outubro', clientes: [delta], prioridade: 'normal', prazo: dia(12), status: 'pendente', criadaPor: heverton, responsavel: eu, criadaEm: ha(5), atualizadaEm: ha(5), historico: criada(heverton, eu, 5) }),
    // o que eu deleguei (o cartão Delegadas por mim)
    t(13, { titulo: 'Cadastrar os funcionários novos', clientes: [gama], prioridade: 'normal', prazo: dia(2), status: 'andamento', criadaPor: eu, responsavel: savio, criadaEm: ha(26), atualizadaEm: ha(4), visualizadaEm: ha(20),
      pareceres: [{ por: 'Sávio', em: ha(4), texto: 'Faltam os documentos de dois funcionários.' }],
      historico: [...criada(eu, savio, 26), { por: 'Sávio', em: ha(18), texto: 'Iniciou a tarefa' }, { por: 'Sávio', em: ha(4), texto: 'Escreveu um parecer' }] }),
    t(14, { titulo: 'Conferir o ICMS do mês', clientes: [beta], prioridade: 'alta', prazo: dia(4), status: 'pendente', criadaPor: eu, responsavel: heverton, criadaEm: ha(3), atualizadaEm: ha(3), historico: criada(eu, heverton, 3) }),
    // os documentos delegados (a aba Documentos)
    t(15, { tipo: 'documentos', titulo: d.TITULO_DO_PEDIDO, descricao: 'Os contratos de locação assinados.', clientes: [delta], prioridade: 'normal', prazo: dia(2), status: 'pendente', criadaPor: vitor, responsavel: eu, criadaEm: ha(8), atualizadaEm: ha(8), historico: criada(vitor, eu, 8) }),
    t(16, { tipo: 'documentos', titulo: d.TITULO_DO_PEDIDO, descricao: 'Os recibos de aluguel de setembro e outubro.', clientes: [alfa], prioridade: 'normal', prazo: dia(6), status: 'pendente', criadaPor: eu, responsavel: clara, criadaEm: ha(14), atualizadaEm: ha(14), historico: criada(eu, clara, 14) }),
  ];
}

/** paraQuemUsa: os exemplos ficam na conta de quem está usando (o ⚡ do Início no modo desenvolvedor) */
export function criarTarefasDelegadasMemoria(quem: () => Pessoa | null, paraQuemUsa = false): RepoTarefasDelegadas {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lista = exemplos(new Date(), paraQuemUsa ? quem() : null);
  let cache: { ver: number; uid: string; estado: { carregadas: boolean; tarefas: TarefaDelegada[] } } | null = null;
  // os bytes dos anexos (na memória; somem ao recarregar)
  const bytes = new Map<string, Uint8Array>([['ax-1', new TextEncoder().encode('Extrato do Sicoob de 09/2026: conferir a tarifa do dia 30 (R$ 12,90).')]]);
  const eu = () => { const q = quem(); if (!q) throw new Error('escolha quem está usando'); return q; };
  const daTarefa = (id: string) => { const t = lista.find(x => x.id === id); if (!t) throw new Error('a tarefa não existe mais'); return t; };
  const trocar = (t: TarefaDelegada) => { lista = lista.map(x => (x.id === t.id ? t : x)); mudou(); };
  const subir = (arquivos: readonly ArquivoParaAnexar[], por: string, em: string) => arquivos.map(a => {
    const id = 'ax-' + idNovo();
    bytes.set(id, a.bytes);
    return anexoDe(a, { id, em, por, partes: 1 });
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
    async marcarContaFeita(id, conta, feita) {
      trocar(d.comContaFeita(daTarefa(id), conta, feita, eu().nome, new Date().toISOString()));
    },
    async salvar(id, mudancas) {
      const t = daTarefa(id);
      const problema = d.problemaDaTarefa(d.comMudancas(t, mudancas));
      if (problema) throw new Error(problema);
      trocar(d.gravacaoDasMudancas(t, mudancas, eu(), new Date().toISOString()).tarefa);
    },
    async marcarVisualizada(id) {
      const t = daTarefa(id);
      if (!t.visualizadaEm) trocar({ ...t, visualizadaEm: new Date().toISOString() });
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
    async baixarAnexo(id, anexoId) {
      const b = bytes.get(anexoId);
      return b ? bytesDoAnexo(b, daTarefa(id).anexos.find(x => x.id === anexoId)?.gzip) : null;
    },
    async excluir(id) {
      for (const a of daTarefa(id).anexos) bytes.delete(a.id);
      lista = lista.filter(t => t.id !== id);
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
