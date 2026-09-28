// Montadores pequenos para os testes (empresa em memória, notas, contas, linhas do razão).
import { comp } from '../../formatos';
import { empresaNova } from '../regras/empresa';
import type { LinhaRazao } from '../regras/verificarConta';
import type { Conta, Empresa, Grupo, Nota, NotaServico } from '../tipos';

export function nota(cfop: string, lanc: string, valor: number, numero: string, extra: Partial<Nota> = {}): Nota {
  const data = extra.data || '05/07/2026';
  return { cfop, lanc, valor, numero, nome: 'FORNECEDOR X LTDA', data, desc: '', doc: '11222333000100', exportado: '', comp: comp(data), ...extra };
}

export function servico(numero: string, nome: string, valor: number, lanc: string, data = '05/07/2026'): NotaServico {
  return { data, comp: comp(data), numero, lanc, codPart: '', cnpj: '', nome, valor, iss: 0, issRet: 0, exportado: '' };
}

export function conta(codigo: string, nome: string, valor = 0, grupo: Grupo = 'Despesa', dc: 'D' | 'C' = 'D'): Conta {
  return { codigo, nome, valor, grupo, dc };
}

export function empresa(campos: Partial<Empresa> = {}): Empresa {
  return { ...empresaNova('EMPRESA DE TESTE LTDA'), ...campos };
}

/** Linha do razão no formato fiscal do Alterdata: "conf NF-e ? - 100-11222333000100-FORN". */
export function linha(numero: string, valor: number, extra: Partial<LinhaRazao> = {}): LinhaRazao {
  return { txt: 'conf NF-e ? - ' + numero + '-11222333000100-FORNECEDOR X LTDA', data: '05/07/2026', valor, sinal: 1, contra: '', ...extra };
}
