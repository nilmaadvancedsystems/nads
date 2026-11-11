// O 13º do DP na rota do Entregas (11/11/2026: "quero que as empresas do dp que estão como office boy e estão com o 13
// salario pronto suba para a rota", "no modulo do entregas como um botão"): o botão "13º do DP" da Rota lista as empresas
// do DP que recebem pelo office boy e têm folha, com a parcela toda marcada na tabela do 13º (DP › Obrigações), e põe na
// rota, de uma vez, as que ainda não estão lá: uma parada com "13º Salário 1ª parcela" (competência novembro) ou "13º
// Salário 2ª parcela" (dezembro), sem valor, na região do cliente, com o vencimento da lei.
import { rotuloDoCliente, jaNaRota, tipoPelaChave, type ClienteDaRota, type Entrega } from './documentos';
import { vencimentoAutomatico } from './guiasDoPdf';
import type { EntregaNova } from './confirmacaoDaEntrega';

/** A empresa do DP candidata: o código, o nome e se a parcela está toda marcada no 13º. */
export interface EmpresaDoDecimo { codigo: number; nome: string; pronta: boolean }
/**
 * vai: entra na rota agora; na-rota: já tem o 13º desta parcela numa parada não entregue; entregue: já foi entregue;
 * sem-cadastro: o código não está no cadastro do Entregas (ou está inativo); falta-marcar: a parcela não está toda marcada.
 */
export type SituacaoDoDecimo = 'vai' | 'na-rota' | 'entregue' | 'sem-cadastro' | 'falta-marcar';
export interface LinhaDoDecimo { codigo: number; nome: string; cliente: ClienteDaRota | null; situacao: SituacaoDoDecimo }

/** O documento e a competência da parcela no Entregas ('13º Salário 1ª parcela', '2026-11'). */
export function documentoDoDecimo(parcela: '1' | '2', ano: number): { tipo: string; competencia: string } {
  return { tipo: tipoPelaChave(parcela === '1' ? 'decimo_terceiro_1' : 'decimo_terceiro_2')?.rotulo || '', competencia: ano + '-' + (parcela === '1' ? '11' : '12') };
}

/** Cada empresa e o que acontece com ela; doMes: as entregas da competência da parcela (as da rota e as já feitas). */
export function decimoParaARota(p: {
  parcela: '1' | '2'; ano: number; empresas: readonly EmpresaDoDecimo[]; clientes: readonly ClienteDaRota[];
  doMes: readonly Pick<Entrega, 'clienteId' | 'competencia' | 'status' | 'itens'>[];
}): LinhaDoDecimo[] {
  const { tipo, competencia } = documentoDoDecimo(p.parcela, p.ano);
  const porCodigo = new Map(p.clientes.filter(c => c.ativo && c.codigoOrigem).map(c => [c.codigoOrigem.trim(), c]));
  const ORDEM: Record<SituacaoDoDecimo, number> = { vai: 0, 'na-rota': 1, entregue: 2, 'sem-cadastro': 3, 'falta-marcar': 4 };
  return p.empresas.map((e): LinhaDoDecimo => {
    const cliente = porCodigo.get(String(e.codigo)) || null;
    const base = { codigo: e.codigo, nome: cliente ? rotuloDoCliente(cliente) : e.codigo + ' - ' + e.nome, cliente };
    if (!e.pronta) return { ...base, situacao: 'falta-marcar' };
    if (!cliente) return { ...base, situacao: 'sem-cadastro' };
    const doCliente = p.doMes.filter(x => x.clienteId === cliente.id && x.competencia === competencia);
    if (doCliente.some(x => x.status === 'confirmada' && x.itens.some(i => i.tipo === tipo))) return { ...base, situacao: 'entregue' };
    if (jaNaRota({ clienteId: cliente.id, competencia, itens: [{ tipo }] }, doCliente).length) return { ...base, situacao: 'na-rota' };
    return { ...base, situacao: 'vai' };
  }).sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** A parada do 13º de um cliente: o documento da parcela, sem valor, na região dele e com o vencimento da lei. */
export function entregaDoDecimo(cliente: ClienteDaRota, parcela: '1' | '2', ano: number): EntregaNova {
  const { tipo, competencia } = documentoDoDecimo(parcela, ano);
  return {
    modo: 'rota', para: { tipo: 'cliente', cliente }, competencia, vencimento: vencimentoAutomatico(competencia, [{ tipo }]) || '',
    itens: [{ tipo, valor: null }], zona: cliente.zona, codigoPagamento: null, foto: null, fotoEhGuia: false,
  };
}
