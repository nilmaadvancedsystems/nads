// Coluna "Situação" das tabelas que conferem com o saldo do balancete: o selo e, com
// diferença, o atalho Revisar (data-ir-verificar). Origem: conferencia.html
// renderCcBalancete (~L3530-3543) e renderConfServ (~L4666-4673).
import { conferencia as c, formatos } from '@nads/core';
import { BotaoIcone, Icone } from '@nads/ui';

const { reais } = formatos;

export function Situacao({ sit, contas, servico, onRevisar }: { sit: c.Situacao; contas: string[]; servico?: boolean; onRevisar: (contas: string[]) => void }) {
  const vazio = <span className="sit-vazio" />;
  const revisar = <BotaoIcone icone="fileSearch" titulo="Revisar esta conta" pequeno onClick={() => onRevisar(contas)} />;
  switch (sit.tipo) {
    case 'sem-conta':
      return <><span className="badge badge-neutral">Configure em Cadastro › Configurações</span>{vazio}</>;
    case 'soma-zero':
      return servico
        ? <><span className="badge badge-neutral">0,00</span>{vazio}</>
        : <><span className="badge badge-neutral" title="A soma das notas deste CFOP é zero — fica fora da conferência com o balancete">0,00</span>{vazio}</>;
    case 'fora-do-balancete':
      return <><span className="badge badge-neutral">Conta fora do balancete lido</span>{vazio}</>;
    case 'ok':
      return <><span className="badge badge-ok">Ok</span>{vazio}</>;
    case 'ok-pela-revisao':
      return <><span className="badge badge-ok" title={'Diferença de ' + reais(sit.diferenca) + ' no balancete lido — o relatório da conta foi conferido sem pendências'}>Ok</span>{vazio}</>;
    case 'conferido':
      return <><span className="badge badge-conferido" title={'Diferença de ' + reais(sit.diferenca) + ' — conferido manualmente'}>Conferido</span>{revisar}</>;
    case 'diferenca':
      return <><span className="badge badge-bad">{reais(sit.diferenca)}</span>{revisar}</>;
  }
}

/** Saldo do balancete; com contas somadas fora do balancete lido, soma só as lidas e marca com *. */
export function SaldoCelula({ saldo, contasFora }: { saldo: number | null; contasFora: string[] }) {
  if (saldo == null) return <>—</>;
  if (!contasFora.length) return <>{reais(saldo)}</>;
  const aviso = (contasFora.length > 1 ? 'As contas ' + contasFora.join(', ') + ' não estão' : 'A conta ' + contasFora[0] + ' não está') + ' no balancete lido: o saldo é só das outras.';
  return <span title={aviso}>{reais(saldo)}<span className="saldo-parcial">*</span></span>;
}

/** Ícone de alerta da conta do Passivo (vínculo errado vindo de antes) — o avisoPassivo (~L2282). */
export function IconePassivo({ aviso }: { aviso: string | null }) {
  if (!aviso) return null;
  return <span className="ico-passivo" title={aviso}><Icone nome="alert" /></span>;
}

/** Props da <tr> com conta do Passivo. */
export function linhaPassivo(aviso: string | null) {
  return aviso ? { className: 'linha-passivo', title: aviso } : {};
}
