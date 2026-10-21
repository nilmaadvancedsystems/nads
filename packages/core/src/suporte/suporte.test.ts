import { describe, expect, it } from 'vitest';
import { caminhoDaConversa, codigoDoPedido, mensagemDoBug, NAO_RESOLVEU, nomeDoBotao, ondeEsta, OUTRO, passoDoSuporte, telaPeloRotulo, vereditoDoReport, type ContextoDoSuporte } from './index';

const ctx: ContextoDoSuporte = {
  tela: 'bancos', rotuloDaTela: 'Bancos', pagina: 'Importação › Bancos', empresa: 'EMPRESA EXEMPLO', codigo: 1,
  meses: ['2026-07', '2026-08'], bancos: ['Bradesco', 'Sicoob'], botoes: ['Importar extrato', 'Importar razão'],
};

describe('suporte de leitura: a conversa por cápsulas', () => {
  it('começa pelo problema da tela, com o Outro no fim', () => {
    const p = passoDoSuporte(ctx, []);
    expect(p.tipo).toBe('pergunta');
    if (p.tipo === 'pergunta') expect(p.opcoes.map(o => o.id)).toEqual(['leu-errado', 'faltou', 'mes', 'travou', 'drive', OUTRO]);
  });
  it('nos bancos, pergunta o banco e o mês (com Outro) e termina nas instruções, dizendo onde a pessoa está', () => {
    const banco = passoDoSuporte(ctx, ['faltou']);
    expect(banco).toMatchObject({ tipo: 'pergunta', texto: 'Qual banco?' });
    if (banco.tipo === 'pergunta') {
      expect(banco.multipla).toBe(true);
      expect(banco.opcoes.slice(-2)).toEqual([{ id: 'b:*', rotulo: 'Todos' }, { id: 'b:outro', rotulo: 'Outro' }]);
    }
    expect(passoDoSuporte(ctx, ['faltou', 'b:Bradesco'])).toMatchObject({ tipo: 'pergunta', texto: 'Qual mês?' });
    const fim = passoDoSuporte(ctx, ['faltou', 'b:Bradesco', 'm:2026-08']);
    expect(fim.tipo).toBe('instrucoes');
    if (fim.tipo === 'instrucoes') {
      expect(fim.aviso).toBe('Você está na página Importação › Bancos, na empresa 1 · EMPRESA EXEMPLO, em 07/2026 a 08/2026.');
      expect(fim.passos[0]).toBe('Clique no ✓ de 08/2026 do Bradesco para tirar o importado.');
    }
  });
  it('não resolveu: o botão da página, o que aconteceu, o arquivo, e só então o envio (o banco e o mês já respondidos não voltam)', () => {
    const base = ['faltou', 'b:Bradesco', 'm:2026-08', NAO_RESOLVEU];
    const botao = passoDoSuporte(ctx, base);
    expect(botao).toMatchObject({ tipo: 'pergunta', texto: 'Qual dos botões de importação está com problema?' });
    if (botao.tipo === 'pergunta') expect(botao.opcoes.map(o => o.rotulo)).toEqual(['Importar extrato', 'Importar razão', 'Todos', 'Outro']);
    expect(passoDoSuporte(ctx, [...base, 'i:Importar extrato'])).toMatchObject({ texto: 'O que aconteceu ao importar?' });
    expect(passoDoSuporte(ctx, [...base, 'i:Importar extrato', 'e:faltaram'])).toMatchObject({ texto: 'Que arquivo você subiu?' });
    expect(passoDoSuporte(ctx, [...base, 'i:Importar extrato', 'e:faltaram', 'a:pdf']).tipo).toBe('encaminhar');
  });
  it('a lista de botões que chega depois não faz a pergunta voltar no meio do report', () => {
    const semBotoes = { ...ctx, botoes: [] };
    const escolhas = ['faltou', 'b:Bradesco', 'm:2026-08', NAO_RESOLVEU];
    expect(passoDoSuporte(semBotoes, escolhas)).toMatchObject({ texto: 'O que aconteceu ao importar?' });
    // os botões apareceram depois da resposta: segue para o arquivo, sem perguntar o botão
    expect(passoDoSuporte(ctx, [...escolhas, 'e:valores'])).toMatchObject({ texto: 'Que arquivo você subiu?' });
  });
  it('o Outro de primeira: diz onde a pessoa está e vai direto ao texto livre e ao arquivo', () => {
    expect(passoDoSuporte(ctx, [OUTRO])).toEqual({
      tipo: 'encaminhar', aviso: ondeEsta(ctx), livre: true, texto: 'Escreva o que aconteceu e anexe o arquivo, se tiver. Vai para o suporte.',
    });
    expect(mensagemDoBug(ctx, [OUTRO], 'O saldo não bate', '')).toContain('Comentário: O saldo não bate');
  });
  it('várias respostas e o Todos: as instruções e a mensagem com todas', () => {
    const p = passoDoSuporte(ctx, ['faltou', 'b:*', 'm:2026-07|2026-08']);
    expect(p.tipo).toBe('instrucoes');
    if (p.tipo === 'instrucoes') expect(p.passos[0]).toBe('Clique no ✓ de 07/2026 e 08/2026 do Bradesco e Sicoob para tirar o importado.');
    const escolhas = ['faltou', 'b:*', 'm:2026-07|2026-08', NAO_RESOLVEU, 'i:Importar extrato|Importar razão', 'e:faltaram|datas', 'a:pdf'];
    expect(caminhoDaConversa(ctx, escolhas)).toBe('Faltou lançamento › Todos › 07/2026, 08/2026 › Não resolveu › Importar extrato, Importar razão › Faltaram lançamentos, Datas ou mês errados › PDF do banco');
    expect(mensagemDoBug(ctx, escolhas, '', '')).toContain('Mês: 07/2026, 08/2026');
  });
  it('um banco só e um mês só: não pergunta', () => {
    const um = { ...ctx, bancos: ['Bradesco'], meses: ['2026-08'] };
    const p = passoDoSuporte(um, ['leu-errado']);
    expect(p.tipo).toBe('instrucoes');
    if (p.tipo === 'instrucoes') expect(p.passos[2]).toBe('Suba o PDF em 08/2026 do Bradesco.');
  });
  it('a mensagem para o Vitor, sempre no mesmo formato', () => {
    const escolhas = ['faltou', 'b:Bradesco', 'm:2026-08', NAO_RESOLVEU, 'i:Importar extrato', 'e:faltaram', 'a:pdf'];
    expect(caminhoDaConversa(ctx, escolhas)).toBe('Faltou lançamento › Bradesco › 08/2026 › Não resolveu › Importar extrato › Faltaram lançamentos › PDF do banco');
    expect(mensagemDoBug(ctx, escolhas, 'Faltou a tarifa do dia 31', 'extrato 08-2026.pdf')).toBe([
      'Página: Importação › Bancos', 'Empresa: 1 · EMPRESA EXEMPLO', 'Período: 07/2026 a 08/2026', 'Problema: Faltou lançamento',
      'Procedimentos: feitos, não resolveu', 'Botão: Importar extrato', 'Banco: Bradesco', 'Mês: 08/2026', 'O que aconteceu: Faltaram lançamentos',
      'Arquivo: PDF do banco · extrato 08-2026.pdf', 'Comentário: Faltou a tarifa do dia 31',
    ].join('\n'));
  });
  it('o nome do botão sem o mês e o detalhe', () => {
    expect(nomeDoBotao('Importar extrato de 08/2026')).toBe('Importar extrato');
    expect(nomeDoBotao('Importar o razão dos meses que faltam')).toBe('Importar razão');
    expect(nomeDoBotao('importar o balancete dinâmico (XLS do Alterdata)')).toBe('Importar balancete dinâmico');
  });
  it('a tela pelo nome da aba', () => {
    expect(telaPeloRotulo('Bancos')).toBe('bancos');
    expect(telaPeloRotulo('Balancete e razões')).toBe('balancete');
    expect(telaPeloRotulo('Saídas')).toBe('notas');
    expect(telaPeloRotulo('Caixa')).toBe('razao');
    expect(telaPeloRotulo('Cheque especial')).toBe('outra');
  });
  it('o número do pedido, pelo id do documento', () => {
    expect(codigoDoPedido('k3f9qZ7abcDEF')).toBe('#K3F9QZ');
    expect(codigoDoPedido('')).toBe('');
  });
  it('o veredito pela última linha do report', () => {
    expect(vereditoDoReport('A causa é…\n\n**Realmente, isso é erro do sistema.**')).toBe('erro');
    expect(vereditoDoReport('O usuário quer outro fluxo.\nPrecisa da sua análise')).toBe('analise');
    expect(vereditoDoReport('sem final')).toBeNull();
  });
});
