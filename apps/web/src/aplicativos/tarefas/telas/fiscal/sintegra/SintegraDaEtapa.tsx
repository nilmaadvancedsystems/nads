// O leitor do SINTEGRA dentro do item "Entradas x SINTEGRA" da rotina do Fiscal (15/10/2026): a empresa e o mês da etapa.
import { LeitorSintegra } from './LeitorSintegra';
import { useLeitorSintegra } from './useLeitorSintegra';

export function SintegraDaEtapa({ codigo, competencia }: { codigo: string; competencia: string }) {
  const vm = useLeitorSintegra({ codigo, competencia });
  return <div className="fs-etapa"><LeitorSintegra vm={vm} id={'sintegra-' + codigo + '-' + competencia} /></div>;
}
