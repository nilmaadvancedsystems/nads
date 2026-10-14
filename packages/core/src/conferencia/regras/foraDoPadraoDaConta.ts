// Verificar por conta: o "Lançamento fora do padrão" só das notas da conta conferida (Vitor, 14/10/2026: "acoplar no
// verificar por conta, o fluxo vai ficar melhor", na tela de subir o relatório). A nota fiscal é da conta pela natureza
// do CFOP (Cadastro › Entradas/Saídas); a de serviço, pela categoria do participante (Cadastro › Tomados/Prestados).
import type { Empresa, FiltroMovimento, TipoNotaFiscal, TipoServico } from '../tipos';
import { chaveNaturezaNota, somaValores, type OrdemGrupos } from './cfop';
import type { Divergencia } from './divergencias';
import { contasDaNatureza } from './empresa';
import { foraDoPadraoFiscal, type ForaDoPadraoFiscal, type GrupoForaDoPadrao } from './foraDoPadraoFiscal';
import { contasDoPart } from './servicos';
import { conferirServicos, type GrupoForaDoPadraoServ, type OrdemServ } from './servicosConferencia';

const daConta = (contas: string[], codigos: string[]) => contas.some(c => codigos.indexOf(c) > -1);

/** As notas de entrada ou saída fora do padrão do CFOP cuja natureza é dessas contas. */
export function foraDoPadraoFiscalDaConta(e: Empresa, tipo: TipoNotaFiscal, ordem: OrdemGrupos, codigos: string[]): ForaDoPadraoFiscal {
  const f = foraDoPadraoFiscal(e, tipo, ordem);
  const tNf = tipo === 'entradas' ? 'Entrada' : 'Saída';
  const dela = (d: Divergencia) => daConta(contasDaNatureza(e, chaveNaturezaNota(d.nota, tNf)), codigos);
  const filtrar = (gs: GrupoForaDoPadrao[]) => gs
    .map(g => { const itens = g.itens.filter(dela); return { ...g, itens, total: somaValores(itens.map(d => d.nota)) }; })
    .filter(g => g.itens.length);
  const pendentes = filtrar(f.pendentes);
  const corrigidos = filtrar(f.corrigidos);
  return { temDivergencias: pendentes.length + corrigidos.length > 0, pendentes, corrigidos, qtdCorrigidos: corrigidos.reduce((s, g) => s + g.itens.length, 0) };
}

export interface ForaDoPadraoServDaConta { temDivergencias: boolean; pendentes: GrupoForaDoPadraoServ[]; corrigidos: GrupoForaDoPadraoServ[]; qtdCorrigidos: number }

/** As notas de serviço tomado ou prestado fora do padrão (no período) cujo participante é dessas contas. */
export function foraDoPadraoServDaConta(e: Empresa, tipo: TipoServico, f: FiltroMovimento, ordem: OrdemServ, codigos: string[]): ForaDoPadraoServDaConta {
  const r = conferirServicos(e, tipo, f, ordem);
  const dela = (g: GrupoForaDoPadraoServ) => daConta(contasDoPart(e, tipo, g.nome), codigos);
  const pendentes = r.pendentes.filter(dela);
  const corrigidos = r.corrigidos.filter(dela);
  return { temDivergencias: pendentes.length + corrigidos.length > 0, pendentes, corrigidos, qtdCorrigidos: corrigidos.reduce((s, g) => s + g.itens.length, 0) };
}
