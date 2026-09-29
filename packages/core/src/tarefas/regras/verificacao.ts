// Check automático: o que o "Próximo" confere antes de dar a etapa como feita. Lê o que as
// ferramentas guardaram (hoje, os arquivos do Extrator) — nunca a tela delas.
import type { ArquivoImportado } from '../../extratudo/extrator/tipos';
import type { Etapa } from '../tipos';

/** Arquivos de um lado com pelo menos um lançamento na competência ('aaaa-mm'). */
function temNaCompetencia(arquivos: readonly ArquivoImportado[], lado: 'banco' | 'sistema', competencia: string): boolean {
  return arquivos.some(a => a.lado === lado && a.lancamentos.some(l => l.data.startsWith(competencia)));
}

export interface Resultado { ok: boolean; motivo: string }

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesDe = (competencia: string) => MES[Number(competencia.slice(5, 7)) - 1] + '/' + competencia.slice(0, 4);

/**
 * Confere a etapa. `arquivosDoExtrator` = o que o Extrator tem da empresa (só é usado nas etapas que
 * dependem dele). Etapa manual: a pessoa já confirmou ao clicar em Próximo.
 */
export function verificar(etapa: Etapa, competencia: string, arquivosDoExtrator: readonly ArquivoImportado[]): Resultado {
  switch (etapa.verificacao) {
    case 'manual':
      return { ok: true, motivo: '' };
    case 'extratos':
      return temNaCompetencia(arquivosDoExtrator, 'banco', competencia)
        ? { ok: true, motivo: '' }
        : { ok: false, motivo: 'Ainda não há extrato de ' + mesDe(competencia) + ' importado.' };
    case 'extrato-e-sistema': {
      const banco = temNaCompetencia(arquivosDoExtrator, 'banco', competencia);
      const sistema = temNaCompetencia(arquivosDoExtrator, 'sistema', competencia);
      if (banco && sistema) return { ok: true, motivo: '' };
      return { ok: false, motivo: !banco ? 'Falta o extrato de ' + mesDe(competencia) + '.' : 'Falta importar o razão do sistema de ' + mesDe(competencia) + '.' };
    }
  }
}

/** Precisa dos arquivos do Extrator para conferir? (evita ler o banco à toa) */
export function precisaDoExtrator(etapa: Etapa): boolean {
  return etapa.verificacao === 'extratos' || etapa.verificacao === 'extrato-e-sistema';
}
