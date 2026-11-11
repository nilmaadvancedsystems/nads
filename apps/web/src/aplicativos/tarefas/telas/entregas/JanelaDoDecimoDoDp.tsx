// A janela "13º do DP" da Rota (11/11/2026): as empresas do DP que recebem pelo office boy com o 13º da parcela pronto, e
// "Pôr na rota". Só desenha: o estado e as ações estão em useJanelaDoDecimoDoDp.
import { BotaoAcao, Esqueleto, Icone } from '@nads/ui';
import { MolduraDaJanela } from './MolduraDaJanela';
import { useJanelaDoDecimoDoDp } from './useJanelaDoDecimoDoDp';

export function JanelaDoDecimoDoDp({ onFechar }: { onFechar: () => void }) {
  const vm = useJanelaDoDecimoDoDp(onFechar);
  return (
    <MolduraDaJanela icone="caminhao" caminho="Rota" titulo={vm.titulo} sub={vm.sub} onFechar={vm.fechar}
      rodape={<>
        <span className="hint">{vm.carregando ? 'Carregando…' : vm.quantasVao ? vm.quantasVao + ' para pôr na rota' : 'Nenhuma empresa para pôr na rota agora'}</span>
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" onClick={vm.fechar}>Fechar</button>
        <BotaoAcao className="btn btn-primary" carregando={vm.gravando} textoCarregando="Pondo na rota…" disabled={vm.carregando || !vm.quantasVao} onClick={() => void vm.porNaRota()}>
          <Icone nome="plus" />Pôr na rota{vm.quantasVao ? ' (' + vm.quantasVao + ')' : ''}
        </BotaoAcao>
      </>}>
      <div className="chip-row" role="group" aria-label="Parcela">
        {vm.parcelas.map(p => (
          <button key={p.valor} type="button" className={'chip-f' + (vm.parcela === p.valor ? ' on' : '')} aria-pressed={vm.parcela === p.valor} onClick={() => vm.setParcela(p.valor)}>{p.rotulo}</button>
        ))}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {vm.carregando ? <Esqueleto linhas={5} /> : vm.linhas.length === 0 ? (
        <p className="hint">Nenhuma empresa do DP com folha recebe pelo office boy.</p>
      ) : (
        <ul className="ent-docs">
          {vm.linhas.map(l => (
            <li key={l.chave} className="ent-doc-grupo">
              <div className="ent-doc"><span className="ent-doc-tipo">{l.nome}</span><span className={'badge badge-' + l.tom}>{l.rotulo}</span></div>
            </li>
          ))}
        </ul>
      )}
    </MolduraDaJanela>
  );
}
