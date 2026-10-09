// Drive de EXEMPLO do Creditor e do Extrator: a empresa 901 tem CONTÁBIL › RECEBIMENTO DE CLIENTES com o
// relatório de exemplo em 08/2026 (e um de 07/2026, para a busca ter o que descartar) e CONTÁBIL › EXTRATOS
// com o extrato de 08/2026 (OFX). Nada sai do navegador.
import type { RepoDrive } from './drive';
import { EXEMPLO_RELATORIO } from './exemplos';
import type { ItemDrive } from './regras/drive';

const ITENS_901: ItemDrive[] = [
  { i: 'ex-contabil', n: 'CONTÁBIL', p: 'ex-901', t: 'd' },
  { i: 'ex-fiscal', n: 'FISCAL', p: 'ex-901', t: 'd' },
  { i: 'ex-rec', n: 'RECEBIMENTO DE CLIENTES', p: 'ex-contabil', t: 'd' },
  { i: 'ex-rec-07', n: 'CREDLIQUIDAÇÃO 07-2026.txt', p: 'ex-rec', t: 'f', m: '2026-08-02T10:00:00.000Z' },
  { i: 'ex-rec-08', n: 'CREDLIQUIDAÇÃO 08-2026.txt', p: 'ex-rec', t: 'f', m: '2026-09-02T10:00:00.000Z' },
  { i: 'ex-ext', n: 'EXTRATOS', p: 'ex-contabil', t: 'd' },
  { i: 'ex-ext-08', n: 'EXTRATO 08-2026.ofx', p: 'ex-ext', t: 'f', m: '2026-09-03T10:00:00.000Z' },
];

/** O extrato de exemplo (OFX) de 08/2026. */
const EXEMPLO_EXTRATO_OFX = [
  'OFXHEADER:100',
  '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>',
  ...[
    ['20260803', '1500.00', 'PIX RECEBIDO CLIENTE DRIVE'],
    ['20260806', '-320.40', 'TARIFA BANCARIA DRIVE'],
    ['20260815', '-1200.00', 'PAGTO FORNECEDOR DRIVE'],
    ['20260820', '980.55', 'TED RECEBIDA DRIVE'],
  ].map(([data, valor, memo]) => '<STMTTRN><DTPOSTED>' + data + '<TRNAMT>' + valor + '<MEMO>' + memo + '</STMTTRN>'),
  '</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
].join('\n');

function conteudo(id: string): string {
  if (id === 'ex-rec-08' || id === 'ex-rec-07') return EXEMPLO_RELATORIO;
  if (id === 'ex-ext-08') return EXEMPLO_EXTRATO_OFX;
  throw new Error('arquivo de exemplo inexistente');
}

export function criarDriveMemoria(): RepoDrive {
  // nos exemplos, um extrato "chegou por e-mail" para a 901 (o OFX de exemplo); importado ou ignorado, sai da lista
  const marcados = new Set<string>();
  return {
    async extratosRecebidos(codigo, competencia) {
      if (codigo !== 901) return [];
      const em = new Date().toISOString();
      return [
        { id: 'ex-email-1', nome: 'EXTRATO SICOOB ' + competencia + ' (TESTE).ofx', competencia, bancos: ['sicoob'], contas: [], em, remetente: 'financeiro@exemplo.com.br', origem: 'email' as const },
        { id: 'ex-drive-1', nome: 'EXTRATO ITAU ' + competencia + ' (TESTE).ofx', competencia, bancos: ['itau'], contas: [], em, remetente: '', origem: 'drive' as const, fileId: 'ex-drive-arquivo-1' },
      ].filter(r => !marcados.has(r.id));
    },
    async baixarRecebido() { return new TextEncoder().encode(EXEMPLO_EXTRATO_OFX).buffer as ArrayBuffer; },
    async marcarRecebido(id) { marcados.add(id); },
    exemplos: true,
    acesso: () => ({ pronto: true, entrou: true, quem: 'exemplo' }),
    async entrar() { /* nos exemplos já está dentro */ },
    async entrarComGoogle() { /* idem */ },
    async sair() { /* idem */ },
    async pastaDoCliente(codigo) {
      return codigo === 901 ? { raiz: 'ex-901', nome: '901 - EXEMPLO COMERCIO DE ALIMENTOS LTDA', itens: ITENS_901 } : null;
    },
    async baixar(id, _nome, passo) {
      passo?.('lendo o exemplo');
      return new TextEncoder().encode(conteudo(id)).buffer as ArrayBuffer;
    },
    async link(id) {
      // nos exemplos, o próprio conteúdo num endereço do navegador
      return URL.createObjectURL(new Blob([conteudo(id)], { type: 'text/plain' }));
    },
    async contatoDoCliente(codigo) {
      // sem nome: vale o da empresa aberta
      return { id: 'exemplo-' + codigo, nome: '', emails: ['financeiro@exemplo.com.br', 'contato@exemplo.com.br'], telefone: '(38) 99999-0000' };
    },
    async remetente() {
      return { setor: 'contabil', caixa: 'robo', email: 'nilmacontabilidade@gmail.com', respostas: 'setorcontabilnilma@gmail.com' };
    },
    async enviarAoDrive() {
      // nos exemplos nada sai daqui: só finge a fila do robô
      await new Promise(ok => setTimeout(ok, 300));
    },
    async pedirEmail(_p, passo) {
      // nos exemplos nada sai daqui: só finge a fila do robô
      passo?.('na fila do robô (exemplo)');
      await new Promise(ok => setTimeout(ok, 600));
      return { id: 'exemplo-' + Date.now(), situacao: 'enviado' };
    },
    async situacaoDosEmails(ids) {
      return Object.fromEntries(ids.map(id => [id, { status: 'enviado' as const }]));
    },
    assinar: () => () => {},
    versao: () => 0,
  };
}
