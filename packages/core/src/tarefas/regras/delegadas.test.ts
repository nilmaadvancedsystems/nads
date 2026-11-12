import * as d from './delegadas';
import { acoesDoStatus, filtrarPorSituacao, grupoDoPrazo, numerosDaLista, prazoComHora, ultimoMovimento, type Status } from './delegadas';
import { describe, expect, it } from 'vitest';
import {
  atrasada, buscar, celulaDoCsv, comAnexos, comMudancas, gravacaoDasMudancas, mudancasDoRascunho, comoEncolher, nomeDaImagemEncolhida, valeEncolher, comParecer, contarAbas, daAba, emAberto, extensaoDe, historicoDaCriacao, historicoDaMudanca, lerTarefa,
  linhasDaPlanilha, MAIOR_ANEXO, MAIOR_HISTORICO, MAIOR_TITULO, MAIS_ANEXOS, MAIS_PARECERES, mudar, mudouAlgo, noHistorico, nomeDoAnexo, nova, ordenar,
  pessoasDaTarefa, podeExcluir, podeMudar, prazoDaTela, prazoParaTela, prazoValido, problemaDaTarefa, problemaDoParecer, problemaDosAnexos,
  rascunhoDe, rascunhoVazio, semAnexo, statusDaAba, type Rascunho, type TarefaDelegada,
} from './delegadas';

const NILMA = { uid: 'u1', nome: 'Nilma' };
const VITOR = { uid: 'u2', nome: 'Vitor' };
const CLARA = { uid: 'u3', nome: 'Clara' };
const EM = '2026-10-28T12:00:00.000Z';

function tarefa(p: Partial<TarefaDelegada> = {}): TarefaDelegada {
  return {
    id: 't', numero: 1, titulo: 'Conferir o balancete', descricao: '', cliente: p.clientes?.[0] ?? null, clientes: [], prazoHora: '', prioridade: 'normal', prazo: '', status: 'pendente',
    criadaPor: VITOR, responsavel: NILMA, criadaEm: EM, concluidaEm: '', atualizadaEm: EM, pareceres: [], historico: [], anexos: [], ...p,
  };
}
const rascunho = (p: Partial<Rascunho> = {}): Rascunho => ({ ...rascunhoVazio(NILMA), titulo: 'Tarefa', ...p });

describe('o grupo do prazo na lista (09/11/2026)', () => {
  const com = (prazo: string, prazoHora = '') => ({ status: 'pendente' as Status, prazo, prazoHora });
  it('separa pelo prazo: atrasada, hoje, 7 dias, depois e sem prazo', () => {
    expect(grupoDoPrazo(com('2026-11-08'), '2026-11-09', '10:00')).toBe('atrasadas');
    expect(grupoDoPrazo(com('2026-11-09', '09:00'), '2026-11-09', '10:00')).toBe('atrasadas');
    expect(grupoDoPrazo(com('2026-11-09', '18:00'), '2026-11-09', '10:00')).toBe('hoje');
    expect(grupoDoPrazo(com('2026-11-16'), '2026-11-09', '10:00')).toBe('proximos');
    expect(grupoDoPrazo(com('2026-11-17'), '2026-11-09', '10:00')).toBe('depois');
    expect(grupoDoPrazo(com(''), '2026-11-09', '10:00')).toBe('sem-prazo');
  });
});

describe('os números do alto da lista (09/11/2026)', () => {
  const HOJE = '2026-11-09';
  const l = [tarefa({ status: 'pendente', prazo: '2026-11-01' }), tarefa({ status: 'andamento' }), tarefa({ status: 'pausada' }), tarefa({ status: 'andamento', prazo: '2026-11-30' })];
  it('em aberto: o total, um por status e as atrasadas', () => {
    expect(numerosDaLista(l, 'minhas', HOJE).map(n => [n.filtro, n.quantas])).toEqual([['', 4], ['pendente', 1], ['andamento', 2], ['pausada', 1], ['atrasadas', 1]]);
  });
  it('nas encerradas não tem atrasadas', () => {
    expect(numerosDaLista([tarefa({ status: 'concluida' }), tarefa({ status: 'cancelada' })], 'concluidas', HOJE).map(n => n.rotulo)).toEqual(['Encerradas', 'Concluídas', 'Canceladas']);
  });
  it('clicar num número filtra; vazio mostra todas', () => {
    expect(filtrarPorSituacao(l, 'andamento', HOJE)).toHaveLength(2);
    expect(filtrarPorSituacao(l, 'atrasadas', HOJE)).toHaveLength(1);
    expect(filtrarPorSituacao(l, '', HOJE)).toHaveLength(4);
  });
});

describe('a tarefa aprimorada (09/11/2026)', () => {
  it('os botões do responsável seguem o status', () => {
    const ids = (s: Status) => acoesDoStatus(s).map(a => a.id);
    expect(ids('pendente')).toEqual(['iniciar', 'concluir']);
    expect(ids('andamento')).toEqual(['pausar', 'concluir']);
    expect(ids('pausada')).toEqual(['retomar', 'concluir']);
    expect(ids('concluida')).toEqual([]);
    expect(ids('cancelada')).toEqual([]);
  });
  it('a pausada segue em aberto, na aba de quem faz', () => {
    expect(emAberto({ status: 'pausada' })).toBe(true);
  });
  it('vários clientes: o primeiro vai no campo de antes, e a tarefa de antes vira lista', () => {
    const t = nova(rascunho({ clientes: [{ codigo: 1, nome: 'A' }, { codigo: 2, nome: 'B' }] }), { id: 'x', numero: 1, por: VITOR, em: EM });
    expect(t.cliente).toEqual({ codigo: 1, nome: 'A' });
    expect(t.clientes).toHaveLength(2);
    expect(lerTarefa('y', { cliente: { codigo: 9, nome: 'Velho' } }).clientes).toEqual([{ codigo: 9, nome: 'Velho' }]);
    expect(lerTarefa('y', {}).clientes).toEqual([]);
    expect(buscar([t], 'B')).toHaveLength(1);
  });
  it('a hora do prazo: valida, pede a data e conta no atraso de hoje', () => {
    expect(problemaDaTarefa(rascunho({ prazo: '2026-11-10', prazoHora: '25:00' }))).toMatch(/hora/);
    expect(problemaDaTarefa(rascunho({ prazoHora: '10:00' }))).toMatch(/data do prazo/);
    expect(problemaDaTarefa(rascunho({ prazo: '2026-11-10', prazoHora: '10:00' }))).toBe('');
    expect(prazoComHora({ prazo: '2026-11-10', prazoHora: '10:00' })).toBe('10/11/2026 10:00');
    const t = tarefa({ prazo: '2026-11-10', prazoHora: '10:00' });
    expect(atrasada(t, '2026-11-10', '10:01')).toBe(true);
    expect(atrasada(t, '2026-11-10', '09:59')).toBe(false);
  });
  it('o último movimento é de quem iniciou, pausou ou concluiu', () => {
    const t = tarefa({ historico: [{ por: 'V', em: EM, texto: 'Criou a tarefa' }, { por: 'N', em: EM, texto: 'Iniciou a tarefa' }, { por: 'N', em: EM, texto: 'Pausou a tarefa' }, { por: 'N', em: EM, texto: 'Escreveu um parecer' }] });
    expect(ultimoMovimento(t)?.texto).toBe('Pausou a tarefa');
    expect(ultimoMovimento(tarefa())).toBeNull();
  });
});

describe('validação', () => {
  it('título obrigatório e com limite', () => {
    expect(problemaDaTarefa(rascunho({ titulo: '   ' }))).toBe('Escreva o título da tarefa.');
    expect(problemaDaTarefa(rascunho({ titulo: 'x'.repeat(MAIOR_TITULO + 1) }))).toMatch(/título passou/);
    expect(problemaDaTarefa(rascunho())).toBe('');
  });
  it('descrição, responsável, prazo e cliente', () => {
    expect(problemaDaTarefa(rascunho({ descricao: 'x'.repeat(5001) }))).toMatch(/descrição passou/);
    expect(problemaDaTarefa(rascunho({ responsavel: null }))).toBe('Escolha para quem delegar.');
    expect(problemaDaTarefa(rascunho({ prazo: '2026-02-30' }))).toMatch(/prazo/);
    expect(problemaDaTarefa(rascunho({ clientes: [{ codigo: 292, nome: ' ' }] }))).toMatch(/cliente/);
  });
  it('parecer', () => {
    expect(problemaDoParecer(' \n ')).toBe('Escreva o parecer.');
    expect(problemaDoParecer('x'.repeat(2001))).toMatch(/passou/);
    expect(problemaDoParecer('ok', { pareceres: Array.from({ length: MAIS_PARECERES }, () => ({ por: '', em: '', texto: '' })) })).toMatch(/limite/);
    expect(problemaDoParecer('Feito, conferi.')).toBe('');
  });
  it('anexos: vazio, 10 MB, 20 arquivos e 30 MB na tarefa', () => {
    expect(problemaDosAnexos([{ nome: 'a.pdf', tamanho: 0 }])).toMatch(/vazio/);
    expect(problemaDosAnexos([{ nome: 'a.pdf', tamanho: MAIOR_ANEXO + 1 }])).toMatch(/10 MB/);
    expect(problemaDosAnexos([{ nome: 'a.pdf', tamanho: 10 }], Array.from({ length: MAIS_ANEXOS }, () => ({ tamanho: 1 })))).toMatch(/até 20/);
    expect(problemaDosAnexos([{ nome: 'a.pdf', tamanho: MAIOR_ANEXO }], [{ tamanho: MAIOR_ANEXO }, { tamanho: MAIOR_ANEXO }])).toBe('');
    expect(problemaDosAnexos([{ nome: 'a.pdf', tamanho: 1 }], [{ tamanho: MAIOR_ANEXO }, { tamanho: MAIOR_ANEXO }, { tamanho: MAIOR_ANEXO }])).toMatch(/30 MB/);
    expect(problemaDosAnexos([{ nome: 'a.pdf', tamanho: 1000 }])).toBe('');
  });
  it('nome e extensão do arquivo', () => {
    expect(extensaoDe('Balancete 09.PDF')).toBe('pdf');
    expect(extensaoDe('sem-extensao')).toBe('');
    expect(nomeDoAnexo('C:\\pasta\\nota:1?.xml')).toBe('nota_1_.xml');
    expect(nomeDoAnexo('x'.repeat(300) + '.pdf')).toMatch(/^x+\.pdf$/);
    expect(nomeDoAnexo('x'.repeat(300) + '.pdf').length).toBe(160);
  });
});

describe('datas', () => {
  it('prazo válido e conversões', () => {
    expect(prazoValido('')).toBe(true);
    expect(prazoValido('2026-11-10')).toBe(true);
    expect(prazoValido('2026-13-01')).toBe(false);
    expect(prazoParaTela('2026-11-10')).toBe('10/11/2026');
    expect(prazoParaTela('')).toBe('');
    expect(prazoDaTela('10/11/2026')).toBe('2026-11-10');
    expect(prazoDaTela('')).toBe('');
    expect(prazoDaTela('10/11')).toBeNull();
    expect(prazoDaTela('31/02/2026')).toBeNull();
  });
});

describe('lista', () => {
  const hoje = '2026-10-28';
  it('em aberto e atrasada', () => {
    expect(emAberto(tarefa({ status: 'andamento' }))).toBe(true);
    expect(emAberto(tarefa({ status: 'cancelada' }))).toBe(false);
    expect(atrasada(tarefa({ prazo: '2026-10-27' }), hoje)).toBe(true);
    expect(atrasada(tarefa({ prazo: '2026-10-28' }), hoje)).toBe(false);
    expect(atrasada(tarefa({ prazo: '2026-10-27', status: 'concluida' }), hoje)).toBe(false);
    expect(atrasada(tarefa(), hoje)).toBe(false);
  });
  it('atrasadas, depois urgentes, depois o prazo; as encerradas no fim, a mais recente em cima', () => {
    const l = [
      tarefa({ id: 'sem-prazo' }),
      tarefa({ id: 'prazo-longe', prazo: '2026-12-01' }),
      tarefa({ id: 'concluida-antes', status: 'concluida', concluidaEm: '2026-10-01T10:00:00Z' }),
      tarefa({ id: 'urgente', prioridade: 'urgente', prazo: '2026-12-20' }),
      tarefa({ id: 'atrasada', prazo: '2026-10-20' }),
      tarefa({ id: 'prazo-perto', prazo: '2026-10-30' }),
      tarefa({ id: 'concluida-depois', status: 'concluida', concluidaEm: '2026-10-20T10:00:00Z' }),
    ];
    expect(ordenar(l, hoje).map(t => t.id)).toEqual(['atrasada', 'urgente', 'prazo-perto', 'prazo-longe', 'sem-prazo', 'concluida-depois', 'concluida-antes']);
  });
  it('no mesmo prazo, a prioridade maior primeiro', () => {
    const l = [tarefa({ id: 'baixa', prioridade: 'baixa', prazo: '2026-11-01' }), tarefa({ id: 'alta', prioridade: 'alta', prazo: '2026-11-01' })];
    expect(ordenar(l, hoje).map(t => t.id)).toEqual(['alta', 'baixa']);
  });
  it('abas: minhas, delegadas por mim e concluídas', () => {
    const l = [
      tarefa({ id: 'pra-mim', criadaPor: VITOR, responsavel: NILMA }),
      tarefa({ id: 'eu-pra-mim', criadaPor: NILMA, responsavel: NILMA }),
      tarefa({ id: 'eu-pra-clara', criadaPor: NILMA, responsavel: CLARA, status: 'andamento' }),
      tarefa({ id: 'fechada-minha', criadaPor: VITOR, responsavel: NILMA, status: 'concluida' }),
      tarefa({ id: 'cancelada-que-criei', criadaPor: NILMA, responsavel: CLARA, status: 'cancelada' }),
      tarefa({ id: 'dos-outros', criadaPor: VITOR, responsavel: CLARA }),
    ];
    expect(daAba(l, 'minhas', 'u1').map(t => t.id)).toEqual(['pra-mim', 'eu-pra-mim']);
    expect(daAba(l, 'delegadas', 'u1').map(t => t.id)).toEqual(['eu-pra-clara']);
    expect(daAba(l, 'concluidas', 'u1').map(t => t.id)).toEqual(['fechada-minha', 'cancelada-que-criei']);
    expect(contarAbas(l, 'u1')).toEqual({ minhas: 2, delegadas: 1, concluidas: 2 });
    expect(statusDaAba('minhas')).toEqual(['pendente', 'andamento', 'pausada']);
    expect(statusDaAba('concluidas')).toEqual(['concluida', 'cancelada']);
  });
  it('busca no número, título, descrição e cliente, sem acento', () => {
    const l = [
      tarefa({ id: 'a', numero: 12, titulo: 'Guia do DAS', clientes: [{ codigo: 292, nome: 'Exemplo Comércio' }] }),
      tarefa({ id: 'b', numero: 13, titulo: 'Férias', descricao: 'conferir o recibo' }),
    ];
    expect(buscar(l, 'comercio').map(t => t.id)).toEqual(['a']);
    expect(buscar(l, '292').map(t => t.id)).toEqual(['a']);
    expect(buscar(l, 'ferias recibo').map(t => t.id)).toEqual(['b']);
    expect(buscar(l, '13').map(t => t.id)).toEqual(['b']);
    expect(buscar(l, '  ').length).toBe(2);
  });
  it('quem pode mudar e excluir', () => {
    const t = tarefa({ criadaPor: VITOR, responsavel: NILMA });
    expect(podeMudar(t, 'u1')).toBe(true);
    expect(podeMudar(t, 'u2')).toBe(true);
    expect(podeMudar(t, 'u3')).toBe(false);
    expect(podeExcluir(t, 'u1')).toBe(false);
    expect(podeExcluir(t, 'u2')).toBe(true);
    expect(podeExcluir(t, 'u3', true)).toBe(true);
  });
});

describe('histórico', () => {
  it('a criação: criou e delegou (para outra pessoa)', () => {
    expect(historicoDaCriacao({ criadaPor: VITOR, responsavel: NILMA }, EM).map(n => n.texto)).toEqual(['Criou a tarefa', 'Delegou para Nilma']);
    expect(historicoDaCriacao({ criadaPor: NILMA, responsavel: NILMA }, EM).map(n => n.texto)).toEqual(['Criou a tarefa']);
  });
  it('cada mudança vira uma linha', () => {
    const antes = tarefa({ prazo: '2026-11-10', clientes: [{ codigo: 292, nome: 'Exemplo' }] });
    const r = { ...rascunhoDe(antes), titulo: 'Novo título', descricao: 'agora tem', responsavel: CLARA, status: 'andamento' as const, prioridade: 'alta' as const, prazo: '2026-11-12', clientes: [], prazoHora: '' };
    expect(historicoDaMudanca(antes, r, 'Vitor', EM).map(n => n.texto)).toEqual([
      'Mudou o título para "Novo título"',
      'Mudou a descrição',
      'Tirou o cliente 292 · Exemplo',
      'Delegou de Nilma para Clara',
      'Iniciou a tarefa',
      'Mudou a prioridade de Normal para Alta',
      'Mudou o prazo de 10/11/2026 para 12/11/2026',
    ]);
    expect(historicoDaMudanca(tarefa(), { ...rascunhoDe(tarefa()), prazo: '2026-11-01', clientes: [{ codigo: 14, nome: 'Alfa' }] }, 'V', EM).map(n => n.texto))
      .toEqual(['Vinculou o cliente 14 · Alfa', 'Pôs o prazo 01/11/2026']);
    expect(historicoDaMudanca(antes, { ...rascunhoDe(antes), prazo: '', clientes: [{ codigo: 14, nome: 'Alfa' }] }, 'V', EM).map(n => n.texto))
      .toEqual(['Trocou o cliente de 292 · Exemplo para 14 · Alfa', 'Tirou o prazo 10/11/2026']);
  });
  it('sem mudança, nada (os espaços das pontas não contam)', () => {
    const t = tarefa({ titulo: 'Conferir' });
    expect(mudouAlgo(t, { ...rascunhoDe(t), titulo: '  Conferir ' })).toBe(false);
    expect(mudar(t, rascunhoDe(t), NILMA, EM)).toBe(t);
  });
  it('guarda só as últimas', () => {
    const muitas = Array.from({ length: MAIOR_HISTORICO }, (_, i) => ({ por: '', em: '', texto: String(i) }));
    const h = noHistorico(muitas, [{ por: '', em: '', texto: 'nova' }]);
    expect(h.length).toBe(MAIOR_HISTORICO);
    expect(h[0].texto).toBe('1');
    expect(h[h.length - 1].texto).toBe('nova');
  });
});

describe('gravar só o que a pessoa mudou (30/10/2026)', () => {
  it('as mudanças são só os campos diferentes do que ela abriu (os espaços das pontas não contam)', () => {
    const t = tarefa({ clientes: [{ codigo: 292, nome: 'Exemplo' }] });
    const inicial = rascunhoDe(t);
    expect(mudancasDoRascunho(inicial, { ...inicial, titulo: '  Conferir o balancete ' })).toEqual({});
    expect(mudancasDoRascunho(inicial, { ...inicial, clientes: [{ codigo: 292, nome: 'Exemplo' }] })).toEqual({});
    expect(mudancasDoRascunho(inicial, { ...inicial, prioridade: 'alta', prazo: '2026-11-12' })).toEqual({ prioridade: 'alta', prazo: '2026-11-12' });
    expect(mudancasDoRascunho(inicial, { ...inicial, responsavel: { ...NILMA } })).toEqual({});
    expect(mudancasDoRascunho(inicial, { ...inicial, responsavel: CLARA })).toEqual({ responsavel: CLARA });
  });
  it('não desfaz o que outra pessoa mudou enquanto o formulário estava aberto', () => {
    // a Nilma abriu a tarefa pendente com ela; enquanto isso o Vitor pôs em andamento e delegou para a Clara
    const aberta = tarefa();
    const noBanco = tarefa({ status: 'andamento', responsavel: CLARA, atualizadaEm: '2026-10-28T13:00:00.000Z' });
    const m = mudancasDoRascunho(rascunhoDe(aberta), { ...rascunhoDe(aberta), prioridade: 'urgente' });
    expect(comMudancas(noBanco, m)).toEqual({ ...rascunhoDe(noBanco), prioridade: 'urgente' });
    const g = gravacaoDasMudancas(noBanco, m, NILMA, EM);
    expect(g.campos).toEqual({ prioridade: 'urgente' });
    expect(g.linhas.map(n => n.texto)).toEqual(['Mudou a prioridade de Normal para Urgente']);
    expect(g.tarefa.status).toBe('andamento');
    expect(g.tarefa.responsavel).toEqual(CLARA);
  });
  it('concluir grava a data de conclusão junto; o que já está igual no banco não grava nada', () => {
    const t = tarefa();
    const g = gravacaoDasMudancas(t, { status: 'concluida' }, NILMA, EM);
    expect(g.campos).toEqual({ status: 'concluida', concluidaEm: EM });
    const igual = gravacaoDasMudancas(tarefa({ status: 'concluida', concluidaEm: EM }), { status: 'concluida' }, NILMA, '2026-10-29T00:00:00Z');
    expect(igual.campos).toEqual({});
    expect(igual.linhas).toEqual([]);
  });
});

describe('criar e mudar', () => {
  it('a nova: o texto limpo, o histórico da criação e a conclusão', () => {
    const t = nova(rascunho({ titulo: '  Guia  ', responsavel: CLARA, clientes: [{ codigo: 292, nome: ' Exemplo ' }] }), { id: 'x', numero: 7, por: NILMA, em: EM });
    expect(t.titulo).toBe('Guia');
    expect(t.cliente).toEqual({ codigo: 292, nome: 'Exemplo' });
    expect(t.criadaPor).toEqual(NILMA);
    expect(t.responsavel).toEqual(CLARA);
    expect(t.concluidaEm).toBe('');
    expect(t.historico.map(n => n.texto)).toEqual(['Criou a tarefa', 'Delegou para Clara']);
    expect(pessoasDaTarefa(t)).toEqual(['u1', 'u3']);
    expect(pessoasDaTarefa(nova(rascunho(), { id: 'y', numero: 8, por: NILMA, em: EM }))).toEqual(['u1']);
  });
  it('concluir põe a data; reabrir tira', () => {
    const t = tarefa();
    const feita = mudar(t, { ...rascunhoDe(t), status: 'concluida' }, NILMA, EM);
    expect(feita.concluidaEm).toBe(EM);
    expect(feita.historico.at(-1)?.texto).toBe('Concluiu a tarefa');
    const depois = mudar(feita, { ...rascunhoDe(feita), prioridade: 'alta' }, NILMA, '2026-10-29T00:00:00Z');
    expect(depois.concluidaEm).toBe(EM);
    const reaberta = mudar(feita, { ...rascunhoDe(feita), status: 'andamento' }, NILMA, '2026-10-29T00:00:00Z');
    expect(reaberta.concluidaEm).toBe('');
  });
  it('parecer e anexos entram no histórico', () => {
    const t = comParecer(tarefa(), '  Conferi tudo. ', 'Nilma', EM);
    expect(t.pareceres).toEqual([{ por: 'Nilma', em: EM, texto: 'Conferi tudo.' }]);
    expect(t.historico.at(-1)?.texto).toBe('Escreveu um parecer');
    const a = { id: 'a1', nome: 'nota.pdf', extensao: 'pdf', tamanho: 100, em: EM, por: 'Nilma', partes: 1 };
    const com = comAnexos(t, [a], 'Nilma', EM);
    expect(com.anexos).toEqual([a]);
    expect(com.historico.at(-1)?.texto).toBe('Anexou o arquivo nota.pdf');
    const sem = semAnexo(com, 'a1', 'Vitor', EM);
    expect(sem.anexos).toEqual([]);
    expect(sem.historico.at(-1)).toEqual({ por: 'Vitor', em: EM, texto: 'Tirou o arquivo nota.pdf' });
    expect(semAnexo(sem, 'nao-tem', 'Vitor', EM)).toBe(sem);
  });
});

describe('ler do banco e exportar', () => {
  it('o documento torto fica no padrão', () => {
    const t = lerTarefa('d1', { numero: '3', titulo: 'X', prioridade: 'qualquer', status: 'sumido', prazo: '2026-99-99', cliente: { codigo: '292', nome: 'Exemplo' },
      criadaPor: { uid: 'u2', nome: 'Vitor' }, responsavel: { uid: 'u1', nome: 'Nilma' }, criadaEm: EM, historico: [{ por: 'Vitor', em: EM, texto: 'Criou a tarefa' }, 'lixo'],
      anexos: [{ id: 'a1', nome: 'n.pdf', tamanho: 10, partes: 1 }, { id: 'a2', nome: 'sem-partes.pdf' }] });
    expect(t.numero).toBe(3);
    expect(t.prioridade).toBe('normal');
    expect(t.status).toBe('pendente');
    expect(t.prazo).toBe('');
    expect(t.cliente).toEqual({ codigo: 292, nome: 'Exemplo' });
    expect(t.atualizadaEm).toBe(EM);
    expect(t.historico.length).toBe(1);
    expect(t.anexos.map(a => a.id)).toEqual(['a1']);
    expect(lerTarefa('d2', { cliente: { codigo: null, nome: '' } }).cliente).toBeNull();
    expect(lerTarefa('d3', { cliente: { codigo: null, nome: 'Nova' } }).cliente).toEqual({ codigo: null, nome: 'Nova' });
  });
  it('as linhas da planilha e a célula do CSV', () => {
    const l = linhasDaPlanilha([tarefa({ numero: 4, prazo: '2026-11-10', clientes: [{ codigo: 292, nome: 'Exemplo' }], status: 'concluida', concluidaEm: EM })]);
    expect(l[0]).toEqual([4, 'Concluída', 'Conferir o balancete', 'Normal', '10/11/2026', '292 · Exemplo', 'Nilma', 'Vitor', '28/10/2026', '28/10/2026', '']);
    // criada e concluída às 22h de Brasília (01h do dia seguinte em UTC): a planilha mostra o dia daqui
    const noite = linhasDaPlanilha([tarefa({ criadaEm: '2026-10-29T01:30:00.000Z', status: 'concluida', concluidaEm: '2026-10-30T01:00:00.000Z' })]);
    expect(noite[0].slice(8, 10)).toEqual(['28/10/2026', '29/10/2026']);
    expect(celulaDoCsv('a;b')).toBe('"a;b"');
    expect(celulaDoCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaDoCsv(12)).toBe('12');
  });
});

describe('encolher os anexos', () => {
  it('imagem redesenha, o já comprimido fica, o resto vai em gzip', () => {
    expect(comoEncolher('print.PNG')).toBe('imagem');
    expect(comoEncolher('foto.jpeg')).toBe('imagem');
    expect(comoEncolher('planilha.xlsx')).toBe('nada');
    expect(comoEncolher('notas.zip')).toBe('nada');
    expect(comoEncolher('animado.gif')).toBe('nada');
    expect(comoEncolher('nota.xml')).toBe('gzip');
    expect(comoEncolher('balancete.pdf')).toBe('gzip');
    expect(comoEncolher('sem-extensao')).toBe('gzip');
  });
  it('só vale se tirou 5%', () => {
    expect(valeEncolher(1000, 950)).toBe(true);
    expect(valeEncolher(1000, 960)).toBe(false);
    expect(valeEncolher(1000, 0)).toBe(false);
  });
  it('a imagem encolhida vira .webp', () => {
    expect(nomeDaImagemEncolhida('Print 1.PNG')).toBe('Print 1.webp');
    expect(nomeDaImagemEncolhida('foto')).toBe('foto.webp');
  });
  it('lê o gzip do banco só quando é true', () => {
    const base = { id: 'a', nome: 'n.xml', extensao: 'xml', tamanho: 10, em: EM, por: 'Nilma', partes: 1 };
    expect(lerTarefa('t', { anexos: [{ ...base, gzip: true }] }).anexos[0].gzip).toBe(true);
    expect('gzip' in lerTarefa('t', { anexos: [{ ...base, gzip: 'sim' }] }).anexos[0]).toBe(false);
  });
});

describe('a etapa delegada (Clientes e Fornecedores, 10/11/2026)', () => {
  const por = { uid: 'a', nome: 'Ana' };
  const etapaDelegada = { etapa: 'clientes' as const, rota: '901', periodo: '2026-09', todas: false, contas: [{ codigo: '111', nome: 'Exemplo' }], feitas: [] };
  const base = d.nova({ ...d.rascunhoVazio({ uid: 'b', nome: 'Bia' }), titulo: 'Clientes', etapaDelegada }, { id: 'x', numero: 1, por, em: '2026-11-10T10:00:00.000Z' });
  it('a escolhida está na delegação; a outra não; com todas, qualquer uma', () => {
    expect(d.contaNaDelegacao(etapaDelegada, '111')).toBe(true);
    expect(d.contaNaDelegacao(etapaDelegada, '222')).toBe(false);
    expect(d.contaNaDelegacao({ ...etapaDelegada, todas: true, contas: [] }, '222')).toBe(true);
  });
  it('marcar e desmarcar como feita, com o histórico; volta igual do banco', () => {
    const feita = d.comContaFeita(base, etapaDelegada.contas[0], true, 'Bia', '2026-11-10T11:00:00.000Z');
    expect(feita.etapaDelegada?.feitas).toEqual(['111']);
    expect(feita.historico.at(-1)?.texto).toBe('Marcou como feita: 111 Exemplo');
    expect(d.comContaFeita(feita, etapaDelegada.contas[0], false, 'Bia', '2026-11-10T12:00:00.000Z').etapaDelegada?.feitas).toEqual([]);
    expect(d.lerTarefa('x', feita as unknown as Record<string, unknown>).etapaDelegada).toEqual(feita.etapaDelegada);
  });
});

describe('o expediente: pausa sozinha no almoço e à noite (12/11/2026)', () => {
  // horas de Brasília (UTC−3)
  const br = (dia: string, hora: string) => new Date(dia + 'T' + hora + ':00.000-03:00');
  const DIA = '2026-11-12';
  it('pausa às 11:05, volta às 13:00, pausa às 18:05 e volta às 07:00', () => {
    expect(d.noIntervalo(br(DIA, '11:04'))).toBe(false);
    expect(d.noIntervalo(br(DIA, '11:05'))).toBe(true);
    expect(d.noIntervalo(br(DIA, '12:59'))).toBe(true);
    expect(d.noIntervalo(br(DIA, '13:00'))).toBe(false);
    expect(d.noIntervalo(br(DIA, '18:04'))).toBe(false);
    expect(d.noIntervalo(br(DIA, '18:05'))).toBe(true);
    expect(d.noIntervalo(br(DIA, '23:30'))).toBe(true);
    expect(d.noIntervalo(br('2026-11-13', '06:59'))).toBe(true);
    expect(d.noIntervalo(br('2026-11-13', '07:00'))).toBe(false);
  });
  it('não depende do fuso do computador: 11:05 em Brasília é 14:05 UTC', () => {
    expect(d.noIntervalo('2026-11-12T14:04:00.000Z')).toBe(false);
    expect(d.noIntervalo('2026-11-12T14:05:00.000Z')).toBe(true);
  });
  it('a em andamento aparece Pausada no intervalo, com a hora da volta, e só tem o Concluir', () => {
    const t = tarefa({ status: 'andamento' });
    expect(d.situacaoNoHorario(t, br(DIA, '12:00'))).toEqual({ status: 'pausada', automatica: true, volta: '13:00' });
    expect(d.rotuloNoHorario(t, br(DIA, '20:00'))).toBe('Pausada até 07:00');
    expect(d.rotuloNoHorario(t, br(DIA, '02:00'))).toBe('Pausada até 07:00');
    expect(d.acoesNoHorario(t, br(DIA, '12:00')).map(a => a.id)).toEqual(['concluir']);
    expect(d.situacaoNoHorario(t, br(DIA, '13:00'))).toEqual({ status: 'andamento', automatica: false, volta: '' });
    expect(d.acoesNoHorario(t, br(DIA, '13:00')).map(a => a.id)).toEqual(['pausar', 'concluir']);
  });
  it('a pendente, a pausada à mão e a encerrada não mudam no intervalo', () => {
    for (const status of ['pendente', 'pausada', 'concluida'] as Status[]) expect(d.situacaoNoHorario(tarefa({ status }), br(DIA, '12:00')).automatica).toBe(false);
    expect(d.acoesNoHorario(tarefa({ status: 'pendente' }), br(DIA, '20:00')).map(a => a.id)).toEqual(['iniciar', 'concluir']);
  });
  it('a próxima virada: a tela se redesenha na pausa e na volta', () => {
    expect(d.proximaVirada(br(DIA, '10:00')).getTime()).toBe(br(DIA, '11:05').getTime());
    expect(d.proximaVirada(br(DIA, '11:05')).getTime()).toBe(br(DIA, '13:00').getTime());
    expect(d.proximaVirada(br(DIA, '18:10')).getTime()).toBe(br('2026-11-13', '07:00').getTime());
    expect(d.proximaVirada(br(DIA, '05:00')).getTime()).toBe(br(DIA, '07:00').getTime());
  });
  it('o tempo de expediente desconta o almoço e a noite', () => {
    const m = (a: Date, b: Date) => d.minutosDeExpediente(a.getTime(), b.getTime());
    expect(m(br(DIA, '10:00'), br(DIA, '14:00'))).toBe(65 + 60);
    expect(m(br(DIA, '17:00'), br('2026-11-13', '08:00'))).toBe(65 + 60);
    expect(m(br(DIA, '12:00'), br(DIA, '12:50'))).toBe(0);
    expect(m(br(DIA, '07:00'), br('2026-11-13', '07:00'))).toBe(245 + 305);
    expect(m(br(DIA, '14:00'), br(DIA, '10:00'))).toBe(0);
  });
  it('o tempo trabalhado vem do histórico: Iniciou, Pausou, Retomou e Concluiu', () => {
    const h = (hora: string, texto: string) => ({ por: 'Clara', em: br(DIA, hora).toISOString(), texto });
    const t = tarefa({ status: 'concluida', responsavel: CLARA, historico: [
      h('08:00', 'Criou a tarefa'), h('09:00', 'Iniciou a tarefa'), h('10:00', 'Pausou a tarefa'), h('10:30', 'Retomou a tarefa'), h('14:00', 'Concluiu a tarefa'),
    ] });
    // 09–10 (60) + 10:30–11:05 (35) + 13:00–14:00 (60)
    expect(d.minutosTrabalhados(t, br(DIA, '20:00'))).toBe(155);
    expect(d.duracaoParaTela(155)).toBe('2h 35min');
    expect(d.duracaoParaTela(40)).toBe('40min');
    expect(d.duracaoParaTela(120)).toBe('2h');
  });
  it('a em andamento conta até agora, pulando a noite', () => {
    const t = tarefa({ status: 'andamento', historico: [{ por: 'Clara', em: br(DIA, '17:00').toISOString(), texto: 'Iniciou a tarefa' }] });
    expect(d.minutosTrabalhados(t, br('2026-11-13', '07:30'))).toBe(65 + 30);
  });
  it('a nascida em andamento ("Já estava fazendo") leva o Iniciou e conta desde a criação', () => {
    const t = nova(rascunho({ status: 'andamento' }), { id: 'x', numero: 1, por: NILMA, em: br(DIA, '09:00').toISOString() });
    expect(t.historico.map(n => n.texto)).toEqual(['Criou a tarefa', 'Iniciou a tarefa']);
    expect(d.minutosTrabalhados(t, br(DIA, '09:45'))).toBe(45);
    // a de antes, sem a linha do Iniciou: conta desde criadaEm
    const antiga = tarefa({ status: 'andamento', criadaEm: br(DIA, '09:00').toISOString(), historico: [] });
    expect(d.minutosTrabalhados(antiga, br(DIA, '09:30'))).toBe(30);
  });
  it('concluída direto da pendente: sem tempo trabalhado', () => {
    const t = tarefa({ status: 'concluida', historico: [{ por: 'Clara', em: br(DIA, '09:00').toISOString(), texto: 'Concluiu a tarefa' }] });
    expect(d.minutosTrabalhados(t, br(DIA, '10:00'))).toBe(0);
  });
  it('quem recebeu conclui a pendente pelo botão: grava concluida e a data', () => {
    const t = tarefa({ status: 'pendente', responsavel: CLARA });
    const { campos, linhas } = gravacaoDasMudancas(t, { status: 'concluida' }, CLARA, EM);
    expect(campos).toEqual({ status: 'concluida', concluidaEm: EM });
    expect(linhas.map(l => l.texto)).toEqual(['Concluiu a tarefa']);
    expect(podeMudar(t, CLARA.uid)).toBe(true);
  });
});
