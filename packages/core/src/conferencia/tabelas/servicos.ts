// Serviços prestados e tomados: configuração e categorias fixas do escritório.
// Origem: conferencia.html SV (~L4266) e SERV_CAT (~L4417).
import type { TipoServico } from '../tipos';

export interface ConfigServico {
  campo: 'servPrestados' | 'servTomados';
  rotulo: string;
  rotValor: string;
  /** lançamento padrão quando o participante não está numa categoria */
  lancPadrao: string;
  part: string;
  parts: string;
}

export const SV: Readonly<Record<TipoServico, ConfigServico>> = {
  prestados: { campo: 'servPrestados', rotulo: 'Serviços prestados', rotValor: 'Valor base', lancPadrao: '160', part: 'cliente', parts: 'clientes' },
  tomados: { campo: 'servTomados', rotulo: 'Serviços tomados', rotValor: 'Valor do documento', lancPadrao: '527', part: 'fornecedor', parts: 'fornecedores' },
};

export interface CategoriaServico {
  id: string;
  nome: string;
  /** lançamento fixo da categoria */
  lanc: string;
  /** permanente: ninguém tira nem coloca participante */
  travado?: boolean;
  /** participantes que sempre são desta categoria (comparação normalizada, por trecho) */
  fixos?: string[];
  fixosRot?: string[];
  dica?: string;
}

/** Categorias padrão do escritório (iguais em todas as empresas); a conta é de cada empresa. */
export const SERV_CAT: Readonly<Record<TipoServico, readonly CategoriaServico[]>> = {
  tomados: [
    { id: 'geral', nome: 'Serviços tomados gerais', lanc: '527' },
    { id: 'honorario', nome: 'Honorário', lanc: '42', travado: true, fixos: ['NILMA DIAS OLIVEIRA', 'NILMA CONTABILIDADE'], fixosRot: ['NILMA DIAS OLIVEIRA - ME', 'NILMA CONTABILIDADE LTDA'] },
    { id: 'telefone', nome: 'Telefone', lanc: '38' },
    { id: 'internet', nome: 'Internet', lanc: '52' },
    { id: 'viagem', nome: 'Despesas de viagem', lanc: '259' },
    { id: 'sistemas', nome: 'Locação de sistemas', lanc: '503' },
  ],
  prestados: [
    { id: 'geral', nome: 'Serviços prestados', lanc: '160' },
  ],
};

export function ehServ(t: string): t is TipoServico {
  return t === 'prestados' || t === 'tomados';
}
