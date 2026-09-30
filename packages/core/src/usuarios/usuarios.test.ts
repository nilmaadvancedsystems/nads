import { describe, expect, it } from 'vitest';
import {
  conferirNovaConta, departamentoDaConta, docDaContaNova, emailDoLogin, emailDoNome, EQUIPE_EXEMPLO, iniciais, lerUsuario, mensagemDeErroDeLogin,
  mudancaDeCargo, nivelPeloMenos, papeisAoMudarCargo, papeisDaContaNova, papeisDoDoc, papeisFaltando, pode, recursosDe, rotuloDoCargo,
} from '.';

describe('login pelo nome (igual ao Entregas)', () => {
  it('nome vira e-mail @nilma.local', () => {
    expect(emailDoNome('José da Silva')).toBe('jose.da.silva@nilma.local');
    expect(emailDoNome('  Sávio  ')).toBe('savio@nilma.local');
    expect(emailDoNome('Ana-Maria  O\'Neil')).toBe('ana.maria.o.neil@nilma.local');
    expect(emailDoLogin(' sistemasnilma@gmail.com ')).toBe('sistemasnilma@gmail.com');
    expect(emailDoLogin('Vitor')).toBe('vitor@nilma.local');
  });
  it('iniciais e mensagens de erro', () => {
    expect(iniciais('Gustavo Santos')).toBe('GS');
    expect(iniciais('clara')).toBe('C');
    expect(iniciais('  ')).toBe('?');
    expect(mensagemDeErroDeLogin('auth/too-many-requests')).toMatch(/Muitas tentativas/);
    expect(mensagemDeErroDeLogin('auth/invalid-credential')).toBe('Nome ou senha inválidos.');
  });
});

describe('papéis a partir do cargo', () => {
  it('departamento dá o papel dele; diretor é admin; staff sempre', () => {
    expect(papeisDaContaNova('contabil', 'junior')).toEqual(['staff', 'contabil']);
    expect(papeisDaContaNova('fiscal', 'diretor')).toEqual(['staff', 'admin', 'fiscal']);
    expect(papeisDaContaNova('dp', 'diretor')).toEqual(['staff', 'admin', 'dp']);
    expect(papeisDaContaNova('contabil', 'senior', ['office_boy'])).toEqual(['staff', 'office_boy', 'contabil']);
  });
  it('ler o documento como o Entregas lê (roles, depois role, depois staff)', () => {
    expect(papeisDoDoc({ roles: ['admin'] })).toEqual(['admin']);
    expect(papeisDoDoc({ role: 'contabil' })).toEqual(['contabil']);
    expect(papeisDoDoc({})).toEqual(['staff']);
    const u = lerUsuario('u1', { nome: ' Clara ', email: 'clara@nilma.local', roles: ['contabil'], departamento: 'contabil', nivel: 'junior' });
    expect(u).toMatchObject({ nome: 'Clara', papeis: ['staff', 'contabil'], departamento: 'contabil', nivel: 'junior', ativo: true });
    expect(lerUsuario('u2', { departamento: 'vendas', nivel: 'chefe', ativo: false })).toMatchObject({ departamento: null, nivel: null, ativo: false });
  });
  it('mudar o cargo troca só os papéis do cargo e mantém os dados à mão', () => {
    const atuais = ['staff', 'contabil', 'office_boy'];
    expect(papeisAoMudarCargo(atuais, { departamento: 'contabil', nivel: 'pleno' }, { departamento: 'fiscal', nivel: 'pleno' }))
      .toEqual(['staff', 'office_boy', 'fiscal']);
    // um Admin dado à mão a um sênior continua quando ele muda de nível
    expect(papeisAoMudarCargo(['staff', 'admin', 'contabil'], { departamento: 'contabil', nivel: 'senior' }, { departamento: 'contabil', nivel: 'pleno' }))
      .toEqual(['staff', 'admin', 'contabil']);
    // diretor que deixa de ser diretor perde o Admin que vinha do cargo
    expect(papeisAoMudarCargo(['staff', 'admin', 'fiscal'], { departamento: 'fiscal', nivel: 'diretor' }, { departamento: 'fiscal', nivel: 'senior' }))
      .toEqual(['staff', 'fiscal']);
  });
  it('rótulo, nível mínimo e papéis faltando', () => {
    const vitor = EQUIPE_EXEMPLO.find(u => u.nome === 'Vitor')!;
    expect(rotuloDoCargo(vitor)).toBe('Contábil · Sênior');
    expect(rotuloDoCargo({ departamento: null, nivel: null, papeis: ['staff', 'office_boy'] })).toBe('Office boy');
    expect(rotuloDoCargo({ departamento: null, nivel: null, papeis: ['staff'] })).toBe('Equipe');
    expect(nivelPeloMenos(vitor, 'pleno')).toBe(true);
    expect(nivelPeloMenos(vitor, 'diretor')).toBe(false);
    expect(papeisFaltando({ departamento: 'fiscal', nivel: 'diretor', papeis: ['staff', 'fiscal'] })).toEqual(['admin']);
  });
});

describe('quem pode o quê', () => {
  const por = (nome: string) => EQUIPE_EXEMPLO.find(u => u.nome === nome)!;
  it('contábil usa a Conferência e as ferramentas; fiscal não', () => {
    expect(pode(por('Clara'), 'conferencia')).toBe(true);
    expect(pode(por('Clara'), 'conciliadorzinho')).toBe(true);
    expect(pode(por('Heverton'), 'conferencia')).toBe(false);
    expect(pode(por('Heverton'), 'fiscal-lcdpr')).toBe(true);
  });
  it('diretor (admin) pode tudo, inclusive gerenciar a equipe', () => {
    expect(pode(por('Nilma'), 'equipe')).toBe(true);
    expect(pode(por('Sávio'), 'conferencia')).toBe(true);
    expect(pode(por('Vitor'), 'equipe')).toBe(false);
  });
  it('conta desativada não pode nada', () => {
    expect(recursosDe({ ...por('Nilma'), ativo: false })).toEqual([]);
  });
});

describe('conta nova', () => {
  it('confere nome, senha, departamento, nível e nome repetido', () => {
    expect(conferirNovaConta({ nome: 'Ana', senha: '123456', departamento: 'contabil', nivel: 'junior' }, [])).toEqual([]);
    expect(conferirNovaConta({ nome: ' ', senha: '12', departamento: '', nivel: '' }, [])).toEqual([
      'Escreva o nome da pessoa.', 'A senha precisa de pelo menos 6 caracteres.', 'Escolha o departamento.', 'Escolha o nível.',
    ]);
    expect(conferirNovaConta({ nome: 'Clara', senha: '123456', departamento: 'contabil', nivel: 'junior' }, ['clara@nilma.local']))
      .toEqual(['Já existe um acesso com esse nome.']);
  });
  it('documento com os campos do Entregas + departamento/nível/ativo', () => {
    const d = docDaContaNova({ nome: '  Clara   Souza ', senha: 'x', departamento: 'contabil', nivel: 'junior', extras: ['equipe_geral'] }, new Date('2026-09-29T10:00:00Z'));
    expect(d).toEqual({
      nome: 'Clara Souza', email: 'clara.souza@nilma.local', roles: ['staff', 'contabil', 'equipe_geral'],
      departamento: 'contabil', nivel: 'junior', ativo: true, criadoEm: '2026-09-29T10:00:00.000Z',
    });
  });
  it('mudança de cargo devolve os campos a gravar', () => {
    expect(mudancaDeCargo({ roles: ['staff', 'contabil'], departamento: 'contabil', nivel: 'pleno' }, 'contabil', 'senior'))
      .toEqual({ departamento: 'contabil', nivel: 'senior', roles: ['staff', 'contabil'] });
    // conta antiga, sem cargo: ganha o cargo e mantém o que tinha
    expect(mudancaDeCargo({ roles: ['office_boy'] }, 'dp', 'pleno')).toEqual({ departamento: 'dp', nivel: 'pleno', roles: ['staff', 'office_boy', 'dp'] });
  });
  it('a equipe de exemplo tem as 8 pessoas com os papéis certos', () => {
    expect(EQUIPE_EXEMPLO.map(u => [u.nome, u.papeis.join(',')])).toEqual([
      ['Nilma', 'staff,admin,fiscal'], ['Sávio', 'staff,admin,dp'], ['Vitor', 'staff,contabil'], ['Fernando', 'staff,contabil'],
      ['Felipe', 'staff,contabil'], ['Clara', 'staff,contabil'], ['Heverton', 'staff,fiscal'], ['Adivania', 'staff,fiscal'],
    ]);
  });
});

describe('departamento da conta (a rotina da Tarefas)', () => {
  it('o do cargo; na conta antiga, o que os papéis dizem', () => {
    expect(departamentoDaConta(lerUsuario('a', { roles: ['staff', 'contabil'], departamento: 'fiscal' }))).toBe('fiscal');
    expect(departamentoDaConta(lerUsuario('b', { roles: ['staff', 'admin', 'fiscal'] }))).toBe('fiscal');
    expect(departamentoDaConta(lerUsuario('c', { roles: ['staff', 'contabil'] }))).toBe('contabil');
    expect(departamentoDaConta(lerUsuario('d', { roles: ['staff', 'admin'] }))).toBeNull();
  });
});

describe('liberação do login do nads', () => {
  it('sessão, código, computador e pedidos', async () => {
    const l = await import('./regras/liberacao');
    expect(l.idDaSessao('u1', '1727710000')).toBe('u1_1727710000');
    expect(l.codigoNovo(() => 0.0123)).toBe('012300');
    expect(l.codigoNovo(() => 0.999999)).toBe('999999');
    expect(l.computadorDoNavegador('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537')).toBe('Chrome · Windows');
    expect(l.computadorDoNavegador('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Edg/130')).toBe('Edge · Windows');
    expect(l.codigoDigitado(' 48-29 13x')).toBe('482913');
    const p = l.pedidoDoDocumento('p1', { uid: 'u1', status: 'estranho', criadoEm: '2026-09-30T12:00:00Z' });
    expect(p.status).toBe('pendente');
    expect(l.pedidoVencido(p, Date.parse('2026-09-30T12:10:00Z'))).toBe(false);
    expect(l.pedidoVencido(p, Date.parse('2026-09-30T13:00:00Z'))).toBe(true);
  });
});
