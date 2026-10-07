// ViewModel da linha do período em todas as etapas do Contábil (Vitor, 07/10/2026: "esse botão em todas as telas…
// TODAS AS ETAPAS"): o mesmo botão da Importação (📅 01/2026 a 08/2026 ▾) e o número de bancos ao lado. Fora da
// Importação ele só mostra os meses: o período continua se trocando só na Importação (o período à risca).
import { extrator as x, tarefas } from '@nads/core';
import { useCadastro } from '../../../dados/repo';
import { useExtratorDaEmpresa } from '../../../dados/extrator';

export function usePeriodoDaTarefa(nome: string, codigo: number | null, meses: readonly string[]) {
  const vivo = useCadastro(nome, codigo);
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const empresa = useExtratorDaEmpresa(nome);
  const ultimo = meses[meses.length - 1] || '';
  const { bancos } = x.bancosDaEmpresaNa(empresa, cadastro, codigo, ultimo);
  const mmaaaa = tarefas.rotuloNumericoCompetencia;
  const emLote = meses.length > 1;
  return {
    /** como no seletor da Importação: "01/2026 a 08/2026" no Em lote, "ago 2026" num mês só */
    rotulo: emLote ? mmaaaa(meses[0]) + ' a ' + mmaaaa(meses[meses.length - 1]) : ultimo ? tarefas.rotuloCurtoCompetencia(ultimo) : '',
    emLote,
    meses: meses.map(m => ({ valor: m, rotulo: tarefas.rotuloCompetencia(m), curto: mmaaaa(m) })),
    dica: emLote ? 'Em lote: ' + meses.map(mmaaaa).join(', ') : 'A competência da tarefa',
    bancos: bancos.length,
  };
}
