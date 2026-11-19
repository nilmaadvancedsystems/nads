// A seção Boleto dos honorários (Efí) em Financeiro › Configurações (19/11/2026): a multa, os juros ao mês e o dia de
// vencimento padrão do boleto com Pix que o robô emite pelo Efí. Cada campo grava ao sair dele.
import { ConfigLinha, ConfigSecao } from '@nads/ui';
import { useConfigDoBoleto } from './useConfigDoBoleto';

const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };

export function ConfigDoBoleto() {
  const vm = useConfigDoBoleto();
  const campo = (valor: string, rotulo: string, aoSair: (t: string) => void, placeholder: string) => (
    <input key={rotulo + '|' + valor} type="text" inputMode="decimal" className="nf-entrada" aria-label={rotulo} placeholder={placeholder} defaultValue={valor}
      onKeyDown={enter} onBlur={e => { if (e.target.value.trim() !== valor) aoSair(e.target.value); }} />
  );
  return (
    <ConfigSecao titulo="Boleto dos honorários (Efí)">
      <ConfigLinha titulo="Multa por atraso (%)" descricao="De 0 a 10%. 0 = sem multa." aviso={vm.avisos.multa}>
        {campo(vm.multa, 'Multa por atraso em porcentagem', vm.definirMulta, '2')}
      </ConfigLinha>
      <ConfigLinha titulo="Juros ao mês (%)" descricao="De 0 a 10% ao mês, cobrados por dia de atraso. 0 = sem juros." aviso={vm.avisos.jurosAoMes}>
        {campo(vm.juros, 'Juros ao mês em porcentagem', vm.definirJuros, '1')}
      </ConfigLinha>
      <ConfigLinha titulo="Dia de vencimento padrão" descricao="Para o cliente sem o dia dele (Boletos › Mais › Gerenciar clientes). Vence no mês seguinte à competência." aviso={vm.avisos.diaPadrao}>
        {campo(vm.dia, 'Dia de vencimento padrão', vm.definirDia, '10')}
      </ConfigLinha>
    </ConfigSecao>
  );
}
