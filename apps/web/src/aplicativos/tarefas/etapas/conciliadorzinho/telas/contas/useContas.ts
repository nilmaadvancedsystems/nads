// ViewModel da etapa Contas contábeis: conta de vendas, de taxas e "O caixa é 10101?".
// "Concluir conciliação" faz a conciliação e a conferência dos totais e abre a etapa Totais.
// Origem: conciliadorZINHO.html accountsValid/checkStep3Ready/finishBtn (~L1595-1630).
// A barra "Conciliando…" do original era só animação e não entrou.
import { useSessao, conciliarTudo, type ContasTela } from '../../casca/sessao';

export function useContas() {
  const s = useSessao();
  const c = s.estado.contas;
  const mudar = (p: Partial<ContasTela>) => s.mudar(e => ({ ...e, contas: { ...e.contas, ...p } }));
  const valido = !!(c.vendas.trim() && c.taxas.trim() && c.caixaPadrao !== null && (c.caixaPadrao || c.caixa.trim()));

  function concluir() {
    if (!valido) return;
    s.mudar(e => ({ ...e, resultado: conciliarTudo(e) }));
    s.proxima();
  }

  return {
    ...c,
    setVendas: (v: string) => mudar({ vendas: v }),
    setTaxas: (v: string) => mudar({ taxas: v }),
    setCaixaPadrao: (sim: boolean) => mudar(sim ? { caixaPadrao: true, caixa: '10101' } : { caixaPadrao: false }),
    setCaixa: (v: string) => mudar({ caixa: v }),
    valido, concluir, voltar: s.anterior,
  };
}
