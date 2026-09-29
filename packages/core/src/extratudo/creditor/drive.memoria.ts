// Drive de EXEMPLO do Creditor: a empresa 901 tem CONTÁBIL › RECEBIMENTO DE CLIENTES com o relatório
// de exemplo em 08/2026 (e um de 07/2026, para a busca ter o que descartar). Nada sai do navegador.
import type { RepoDrive } from './drive';
import { EXEMPLO_RELATORIO } from './exemplos';
import type { ItemDrive } from './regras/drive';

const ITENS_901: ItemDrive[] = [
  { i: 'ex-contabil', n: 'CONTÁBIL', p: 'ex-901', t: 'd' },
  { i: 'ex-fiscal', n: 'FISCAL', p: 'ex-901', t: 'd' },
  { i: 'ex-rec', n: 'RECEBIMENTO DE CLIENTES', p: 'ex-contabil', t: 'd' },
  { i: 'ex-rec-07', n: 'CREDLIQUIDAÇÃO 07-2026.txt', p: 'ex-rec', t: 'f', m: '2026-08-02T10:00:00.000Z' },
  { i: 'ex-rec-08', n: 'CREDLIQUIDAÇÃO 08-2026.txt', p: 'ex-rec', t: 'f', m: '2026-09-02T10:00:00.000Z' },
];

export function criarDriveMemoria(): RepoDrive {
  return {
    exemplos: true,
    acesso: () => ({ pronto: true, entrou: true, quem: 'exemplo' }),
    async entrar() { /* nos exemplos já está dentro */ },
    async sair() { /* idem */ },
    async pastaDoCliente(codigo) {
      return codigo === 901 ? { raiz: 'ex-901', nome: '901 - EXEMPLO COMERCIO DE ALIMENTOS LTDA', itens: ITENS_901 } : null;
    },
    async baixar(id, _nome, passo) {
      passo?.('lendo o exemplo');
      if (id !== 'ex-rec-08' && id !== 'ex-rec-07') throw new Error('arquivo de exemplo inexistente');
      return new TextEncoder().encode(EXEMPLO_RELATORIO).buffer as ArrayBuffer;
    },
    assinar: () => () => {},
    versao: () => 0,
  };
}
