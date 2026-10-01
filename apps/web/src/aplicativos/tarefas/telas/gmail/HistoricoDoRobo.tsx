// Gmail › Histórico: as últimas leituras do robô do Gmail.
import { Icone, useCarregando, useEntradaAnimada } from '@nads/ui';
import { useHistoricoDoRobo } from './useHistoricoDoRobo';

export function HistoricoDoRobo() {
  const vm = useHistoricoDoRobo();
  useCarregando(vm.carregando);
  const tabela = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vm.carregando], 'lista', 12);
  if (vm.erro) return <div className="alert"><Icone nome="alert" /><div><p className="alert-text">Não consegui ler o robô ({vm.erro}).</p></div></div>;
  return !vm.carregando && !vm.linhas.length ? <p className="empty">O robô ainda não leu nada.</p> : (
    <div ref={tabela} className="table-wrap">
      <table className="tabela-empresas">
        <thead><tr><th>Quando</th><th>Dias lidos</th><th>E-mails</th><th>Marcados</th><th>Anexos</th><th>Sem cliente</th><th>Conversas</th><th>Erros</th><th>Duração</th></tr></thead>
        <tbody>
          {vm.linhas.map(x => (
            <tr key={x.em}>
              <td className="num">{x.quando}</td>
              <td className="num fraco">{x.dias}</td>
              <td className="num">{x.emails}</td>
              <td className="num">{x.marcados}</td>
              <td className="num">{x.baixados}</td>
              <td className="num">{x.naoReconhecidos}</td>
              <td className="num fraco">{x.conversas}</td>
              <td className={'num' + (x.erros ? ' gmail-erro' : ' fraco')}>{x.erros}</td>
              <td className="num fraco">{x.duracao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
