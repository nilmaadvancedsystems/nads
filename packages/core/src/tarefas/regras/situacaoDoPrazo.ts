// Os prazos do mês (plano do Acessórias, ficha E04): cada obrigação com prazo de cada empresa numa competência, com a
// situação dela: a fazer, no prazo interno, atrasada, entregue antes do interno, entregue no prazo, entregue com atraso ou
// dispensada. A empresa entra só nas etapas que a rotina dela tem no mês (etapaNoMes: regime, mês do ano e o ajuste do
// Cadastro › Obrigações) e o prazo vem da tabela única (prazoDaEtapa, com o dia da empresa). Só a lógica.
import { diaEmBrasilia } from '../../formatos';
import type { Departamento } from '../../usuarios/tipos';
import type { EstadoEtapa, Etapa, Execucao } from '../tipos';
import { ajusteDaEtapa, estadoDa, etapaNoMes, execucaoNova } from './execucao';
import { linhaDoPrazo, prazoDaEtapa, type DepartamentoDoPrazo } from './prazos';

export type SituacaoDoPrazo = 'a-fazer' | 'prazo-interno' | 'atrasada' | 'entregue-antes' | 'entregue-no-prazo'
  | 'entregue-com-atraso' | 'dispensada' | 'sem-prazo';

export const ROTULO_DA_SITUACAO_DO_PRAZO: Record<SituacaoDoPrazo, string> = {
  'a-fazer': 'A fazer', 'prazo-interno': 'No prazo interno', atrasada: 'Atrasada', 'entregue-antes': 'Entregue antes',
  'entregue-no-prazo': 'Entregue no prazo', 'entregue-com-atraso': 'Entregue com atraso', dispensada: 'Dispensada', 'sem-prazo': 'Sem prazo',
};

/** As situações na ordem da tela (as que pedem ação primeiro). */
export const SITUACOES_DO_PRAZO: readonly SituacaoDoPrazo[] = ['atrasada', 'prazo-interno', 'a-fazer', 'entregue-com-atraso', 'entregue-no-prazo', 'entregue-antes', 'dispensada', 'sem-prazo'];

export interface LinhaDoPrazo {
  codigo: number | null;
  empresa: string;
  departamento: Departamento;
  etapa: string;
  nomeDaEtapa: string;
  competencia: string;
  /** 'aaaa-mm-dd'; null = a etapa não tem prazo na tabela */
  legal: string | null;
  interno: string | null;
  multa: boolean;
  /** a linha da tabela ainda tem o que o setor confirmar (o atraso pode ser falso) */
  aConfirmar: boolean;
  situacao: SituacaoDoPrazo;
  /** o responsável pelo prazo (o do Cadastro) */
  responsavel: string;
  /** quem entregou (ou dispensou) e quando ('aaaa-mm-dd', em Brasília) */
  feitaPor: string;
  feitaEm: string;
}

/**
 * A situação de uma etapa pelo prazo. Feita: pelo dia em que foi feita (em Brasília). Dispensada: dispensada. O resto
 * (pendente ou parada): pelo dia de hoje ('aaaa-mm-dd').
 */
export function situacaoDoPrazo(estado: EstadoEtapa | null | undefined, legal: string | null, interno: string | null, hoje: string): SituacaoDoPrazo {
  if (estado?.situacao === 'dispensada') return 'dispensada';
  if (!legal) return 'sem-prazo';
  const limiteInterno = interno || legal;
  if (estado?.situacao === 'feita') {
    const dia = diaEmBrasilia(estado.em) || hoje;
    return dia < limiteInterno ? 'entregue-antes' : dia <= legal ? 'entregue-no-prazo' : 'entregue-com-atraso';
  }
  return hoje > legal ? 'atrasada' : hoje >= limiteInterno ? 'prazo-interno' : 'a-fazer';
}

export interface EntradaDosPrazos {
  /** as execuções da competência no departamento */
  execucoes: readonly Execucao[];
  empresas: readonly { nome: string; codigo: number | null }[];
  departamento: Departamento;
  competencia: string;
  hoje: string;
  /** as etapas da rotina da empresa no departamento (rotinaDaEmpresa) */
  etapasDaEmpresa: (codigo: number | null) => readonly Etapa[];
  responsavelDe: (empresa: { nome: string; codigo: number | null }) => string;
  /** true = inclui as etapas sem prazo na tabela (situação sem-prazo) */
  comSemPrazo?: boolean;
}

/** Uma linha por empresa × etapa com prazo que a rotina dela tem no mês (a empresa sem execução no mês também entra). */
export function linhasDoMes(e: EntradaDosPrazos): LinhaDoPrazo[] {
  const dep = e.departamento as DepartamentoDoPrazo;
  const porCodigo = new Map<number, Execucao>();
  const porNome = new Map<string, Execucao>();
  for (const ex of e.execucoes) {
    if (ex.competencia !== e.competencia || ex.departamento !== e.departamento) continue;
    if (ex.codigo != null) porCodigo.set(ex.codigo, ex);
    porNome.set(ex.empresa, ex);
  }
  const linhas: LinhaDoPrazo[] = [];
  for (const emp of e.empresas) {
    const ex = (emp.codigo != null ? porCodigo.get(emp.codigo) : undefined) || porNome.get(emp.nome)
      || execucaoNova(emp.nome, emp.codigo, e.competencia, e.departamento);
    const responsavel = e.responsavelDe(emp);
    for (const etapa of e.etapasDaEmpresa(emp.codigo)) {
      if (!etapaNoMes(ex, etapa.id)) continue;
      const prazo = prazoDaEtapa(dep, etapa.id, e.competencia, ajusteDaEtapa(ex, etapa.id)?.dia);
      if (!prazo && !e.comSemPrazo) continue;
      const estado = estadoDa(ex, etapa.id);
      const feita = estado && (estado.situacao === 'feita' || estado.situacao === 'dispensada');
      linhas.push({
        codigo: emp.codigo, empresa: emp.nome, departamento: e.departamento, etapa: etapa.id, nomeDaEtapa: etapa.nome,
        competencia: e.competencia, legal: prazo?.legal ?? null, interno: prazo?.interno ?? null, multa: !!prazo?.multa,
        aConfirmar: !!linhaDoPrazo(dep, etapa.id)?.conferir,
        situacao: situacaoDoPrazo(estado, prazo?.legal ?? null, prazo?.interno ?? null, e.hoje),
        responsavel, feitaPor: feita ? estado.por : '', feitaEm: feita ? diaEmBrasilia(estado.em) : '',
      });
    }
  }
  return linhas;
}

/** Quantas linhas em cada situação. */
export function contarPrazos(linhas: readonly LinhaDoPrazo[]): Record<SituacaoDoPrazo, number> {
  const r = Object.fromEntries(SITUACOES_DO_PRAZO.map(s => [s, 0])) as Record<SituacaoDoPrazo, number>;
  for (const l of linhas) r[l.situacao]++;
  return r;
}
