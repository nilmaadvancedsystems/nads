import { describe, expect, it } from 'vitest';
import {
  atrasada, buscar, celulaDoCsv, comAnexos, comoEncolher, nomeDaImagemEncolhida, valeEncolher, comParecer, contarAbas, daAba, emAberto, extensaoDe, historicoDaCriacao, historicoDaMudanca, lerTarefa,
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
    id: 't', numero: 1, titulo: 'Conferir o balancete', descricao: '', cliente: null, prioridade: 'normal', prazo: '', status: 'pendente',
    criadaPor: VITOR, responsavel: NILMA, criadaEm: EM, concluidaEm: '', atualizadaEm: EM, pareceres: [], historico: [], anexos: [], ...p,
  };
}
const rascunho = (p: Partial<Rascunho> = {}): Rascunho => ({ ...rascunhoVazio(NILMA), titulo: 'Tarefa', ...p });

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
    expect(problemaDaTarefa(rascunho({ cliente: { codigo: 292, nome: ' ' } }))).toMatch(/cliente/);
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
    expect(statusDaAba('minhas')).toEqual(['pendente', 'andamento']);
    expect(statusDaAba('concluidas')).toEqual(['concluida', 'cancelada']);
  });
  it('busca no número, título, descrição e cliente, sem acento', () => {
    const l = [
      tarefa({ id: 'a', numero: 12, titulo: 'Guia do DAS', cliente: { codigo: 292, nome: 'Exemplo Comércio' } }),
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
    const antes = tarefa({ prazo: '2026-11-10', cliente: { codigo: 292, nome: 'Exemplo' } });
    const r = { ...rascunhoDe(antes), titulo: 'Novo título', descricao: 'agora tem', responsavel: CLARA, status: 'andamento' as const, prioridade: 'alta' as const, prazo: '2026-11-12', cliente: null };
    expect(historicoDaMudanca(antes, r, 'Vitor', EM).map(n => n.texto)).toEqual([
      'Mudou o título para "Novo título"',
      'Mudou a descrição',
      'Tirou o cliente 292 · Exemplo',
      'Delegou de Nilma para Clara',
      'Mudou o status de Pendente para Em andamento',
      'Mudou a prioridade de Normal para Alta',
      'Mudou o prazo de 10/11/2026 para 12/11/2026',
    ]);
    expect(historicoDaMudanca(tarefa(), { ...rascunhoDe(tarefa()), prazo: '2026-11-01', cliente: { codigo: 14, nome: 'Alfa' } }, 'V', EM).map(n => n.texto))
      .toEqual(['Vinculou o cliente 14 · Alfa', 'Pôs o prazo 01/11/2026']);
    expect(historicoDaMudanca(antes, { ...rascunhoDe(antes), prazo: '', cliente: { codigo: 14, nome: 'Alfa' } }, 'V', EM).map(n => n.texto))
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

describe('criar e mudar', () => {
  it('a nova: o texto limpo, o histórico da criação e a conclusão', () => {
    const t = nova(rascunho({ titulo: '  Guia  ', responsavel: CLARA, cliente: { codigo: 292, nome: ' Exemplo ' } }), { id: 'x', numero: 7, por: NILMA, em: EM });
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
    expect(feita.historico.at(-1)?.texto).toBe('Mudou o status de Pendente para Concluída');
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
    const l = linhasDaPlanilha([tarefa({ numero: 4, prazo: '2026-11-10', cliente: { codigo: 292, nome: 'Exemplo' }, status: 'concluida', concluidaEm: EM })]);
    expect(l[0]).toEqual([4, 'Concluída', 'Conferir o balancete', 'Normal', '10/11/2026', '292 · Exemplo', 'Nilma', 'Vitor', '28/10/2026', '28/10/2026', '']);
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
