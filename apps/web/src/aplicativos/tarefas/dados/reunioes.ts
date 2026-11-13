// As reuniões das Notificações do Início novo (13/11/2026): o Sênior pede, o Diretor e o Dono decidem e marcam direto; no
// fim, o Problema identificado e a Solução proposta (arquivos) e o comentário de quem participou. Interface + a versão de
// exemplo (na memória); a do banco é reunioes.firestore.ts (coleção nadsReunioes do Entregas, que só passa quando a regra
// estiver no ar). As regras (os status e quem faz o quê) são do core: tarefas.reunioes.
import { tarefas } from '@nads/core';
import { anexoDe, idNovo, type ArquivoParaAnexar } from './tarefasDelegadas';

type Reuniao = tarefas.reunioes.Reuniao;
type Pessoa = { uid: string; nome: string };
export type QualArquivo = 'problema' | 'solucao';

export interface RepoReunioes {
  exemplos: boolean;
  /** as reuniões, ao vivo (quem vê o quê é do core: tarefas.reunioes.ve) */
  lista(): { carregadas: boolean; reunioes: Reuniao[] };
  /** direta: o Diretor ou o Dono marcando (já entra aprovada) */
  pedir(p: tarefas.reunioes.PedidoDeReuniao, direta: boolean): Promise<void>;
  revisar(id: string, prazo: string): Promise<void>;
  decidir(id: string, aprovar: boolean, observacao: string): Promise<void>;
  remarcar(id: string, quando: string): Promise<void>;
  /** o convidado responde se vai */
  confirmar(id: string, vai: boolean): Promise<void>;
  anexar(id: string, qual: QualArquivo, arquivo: ArquivoParaAnexar): Promise<void>;
  /** os bytes do arquivo, para baixar (null = não achou) */
  baixar(id: string, qual: QualArquivo): Promise<Uint8Array | null>;
  finalizar(id: string): Promise<void>;
  comentar(id: string, texto: string): Promise<void>;
  encerrar(id: string): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

const r = tarefas.reunioes;

/** As reuniões de exemplo do ⚡ (o Início no modo desenvolvedor): uma em cada passo, com quem está usando no meio. */
function exemplos(eu: Pessoa): Reuniao[] {
  const ha = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const dia = (n: number, hora: string) => tarefas.delegadas.hojeIso(new Date(Date.now() + n * 86400_000)) + 'T' + hora;
  const fernando = { uid: 'exemplo-4', nome: 'Fernando' }, nilma = { uid: 'exemplo-1', nome: 'Nilma' }, clara = { uid: 'exemplo-6', nome: 'Clara' }, felipe = { uid: 'exemplo-5', nome: 'Felipe' };
  const arquivo = (id: string, nome: string, por: string) => ({ id, nome, extensao: nome.split('.').pop() || '', tamanho: 48_200, em: ha(2), por, partes: 1 });
  const base = (id: string, titulo: string, pauta: string, quando: string, criadaPor: Pessoa, participantes: Pessoa[], h: number) =>
    r.nova({ titulo, pauta, quando, link: '', participantes, comDiretor: false }, { id, por: criadaPor, em: ha(h), direta: false });
  return [
    // as que pedem a decisão do Diretor
    base('rn-1', 'Revisão das empresas do Simples', 'Passar as empresas que mudam de faixa no mês que vem.', dia(2, '15:00'), fernando, [clara, eu], 5),
    r.revisar(base('rn-2', 'Treinamento do eSocial', 'Uma hora com a equipe do DP sobre o leiaute novo.', dia(4, '10:00'), eu, [felipe, clara], 8), dia(1, '00:00').slice(0, 10), nilma.nome, ha(4)),
    // aprovada, para daqui a pouco
    r.confirmarPresenca(r.decidir(base('rn-3', 'Alinhamento com o cliente novo', 'Entender a rotina da empresa antes do primeiro fechamento.', dia(1, '09:30'), eu, [clara, felipe], 30), true, 'Pode usar a sala de reunião.', nilma.nome, ha(20)), clara, true, ha(18)),
    // aprovada, pedida por outro, esperando a minha presença
    r.decidir(base('rn-9', 'Organização do arquivo morto', 'Quem separa as pastas de 2021 e onde guardar.', dia(2, '10:00'), fernando, [eu, clara], 26), true, '', nilma.nome, ha(22)),
    // em andamento agora (o dia e a hora já passaram), com o Problema anexado
    r.anexar(r.decidir(base('rn-4', 'Fechamento de outubro', 'O que ficou pendente e quem fecha cada empresa.', dia(0, '00:01'), eu, [clara, felipe], 50), true, '', nilma.nome, ha(40)), 'problema', arquivo('rn-4-p', 'problemas-outubro.pdf', eu.nome), eu.nome, ha(2)),
    // finalizada, esperando o meu comentário
    r.comentar(r.finalizar(r.anexar(r.anexar(r.decidir(base('rn-5', 'Padronizar os históricos', 'Os históricos do Contábil que cada um escreve de um jeito.', dia(-2, '14:00'), fernando, [clara, eu], 80), true, '', nilma.nome, ha(70)), 'problema', arquivo('rn-5-p', 'problema.docx', 'Fernando'), 'Fernando', ha(30)), 'solucao', arquivo('rn-5-s', 'solucao.xlsx', 'Fernando'), 'Fernando', ha(30)), 'Fernando', ha(29)), clara, 'Ficou claro; vou usar a planilha nova.', ha(20)),
    // concluída, esperando o Diretor encerrar
    r.comentar(r.finalizar(r.anexar(r.anexar(r.decidir(base('rn-6', 'Prazo das guias do DAS', 'Por que as guias atrasaram em setembro.', dia(-5, '11:00'), eu, [felipe], 140), true, 'Tragam os números.', nilma.nome, ha(130)), 'problema', arquivo('rn-6-p', 'atrasos.pdf', eu.nome), eu.nome, ha(60)), 'solucao', arquivo('rn-6-s', 'novo-fluxo.pdf', eu.nome), eu.nome, ha(60)), eu.nome, ha(59)), felipe, 'Concordo com o fluxo novo.', ha(50)),
    // recusada, com a observação
    r.decidir(base('rn-7', 'Folga coletiva de dezembro', 'Combinar os dias de folga do fim do ano.', dia(6, '17:00'), eu, [], 60), false, 'Vamos tratar na reunião geral do dia 18.', nilma.nome, ha(48)),
    // marcada direto pelo Diretor (todos veem)
    r.nova({ titulo: 'Reunião geral do escritório', pauta: 'Metas de dezembro e a confraternização.', quando: dia(3, '08:30'), link: 'https://meet.google.com/', participantes: [], comDiretor: true }, { id: 'rn-8', por: nilma, em: ha(10), direta: true }),
  ];
}

/** paraQuemUsa: o ⚡ do Início (modo desenvolvedor) põe as reuniões de exemplo */
export function criarReunioesMemoria(quem: () => Pessoa | null, paraQuemUsa = false): RepoReunioes {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const eu = () => quem() || { uid: 'exemplo-3', nome: 'Vitor' };
  let lista: Reuniao[] = paraQuemUsa ? exemplos(eu()) : [];
  const bytes = new Map<string, Uint8Array>();
  let estado = { carregadas: true, reunioes: lista };
  const trocar = (id: string, f: (x: Reuniao) => Reuniao) => {
    const x = lista.find(y => y.id === id);
    if (!x) throw new Error('a reunião não existe mais');
    lista = lista.map(y => (y.id === id ? f(x) : y));
    estado = { carregadas: true, reunioes: lista };
    mudou();
  };
  const agora = () => new Date().toISOString();
  return {
    exemplos: true,
    lista: () => estado,
    async pedir(p, direta) {
      const problema = r.problemaDoPedido(p);
      if (problema) throw new Error(problema);
      lista = [...lista, r.nova(p, { id: 'rn-' + idNovo(), por: eu(), em: agora(), direta })];
      estado = { carregadas: true, reunioes: lista };
      mudou();
    },
    async revisar(id, prazo) { trocar(id, x => r.revisar(x, prazo, eu().nome, agora())); },
    async decidir(id, aprovar, observacao) { trocar(id, x => r.decidir(x, aprovar, observacao, eu().nome, agora())); },
    async remarcar(id, quando) { trocar(id, x => r.remarcar(x, quando, eu().nome, agora())); },
    async confirmar(id, vai) { trocar(id, x => r.confirmarPresenca(x, eu(), vai, agora())); },
    async anexar(id, qual, arquivo) {
      const anexoId = 'ax-' + idNovo();
      bytes.set(anexoId, arquivo.bytes);
      trocar(id, x => r.anexar(x, qual, anexoDe(arquivo, { id: anexoId, em: agora(), por: eu().nome, partes: 1 }), eu().nome, agora()));
    },
    async baixar(id, qual) {
      const a = lista.find(y => y.id === id)?.[qual];
      if (!a) return null;
      return bytes.get(a.id) || new TextEncoder().encode('Arquivo de exemplo: ' + a.nome);
    },
    async finalizar(id) { trocar(id, x => r.finalizar(x, eu().nome, agora())); },
    async comentar(id, texto) { trocar(id, x => r.comentar(x, eu(), texto, agora())); },
    async encerrar(id) { trocar(id, x => r.encerrar(x, eu().nome, agora())); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
