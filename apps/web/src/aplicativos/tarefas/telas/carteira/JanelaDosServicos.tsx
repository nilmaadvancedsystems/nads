// Os serviços comissionados (Vitor, 12/11/2026: "no financeiro, pode adicionar mais serviços e definir qual a porcentagem de
// cada serviço"): a lista que aparece na janela de registrar a comissão e a % de cada um. Começa com os 9 do Vitor, sem a %.
import { BotaoFechar, BotaoIcone, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useJanelaDosServicos } from './useCarteiraDaPessoa';

export function JanelaDosServicos({ fechar }: { fechar: () => void }) {
  const vm = useJanelaDosServicos(fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Serviços comissionados">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Comissões da equipe<Icone nome="chevronRight" /><b>Serviços comissionados</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <p className="registro-dica"><Icone nome="lampada" />A comissão sai do valor do serviço × a %. Serviço sem a % não pode ser registrado.</p>
          {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Serviço</th><th className="num">% da comissão</th><th aria-label="Tirar" /></tr></thead>
              <tbody>
                {vm.lista.map(s => (
                  <tr key={s.id}>
                    <td><input type="text" value={s.nome} maxLength={80} onChange={e => vm.mudar(s.id, 'nome', e.target.value)} aria-label="Nome do serviço" /></td>
                    <td className="num"><input type="text" inputMode="decimal" value={s.percentual} onChange={e => vm.mudar(s.id, 'percentual', e.target.value)} placeholder="0" aria-label={'% de ' + s.nome} /></td>
                    <td><BotaoIcone icone="lixeira" titulo={'Tirar ' + s.nome} pequeno onClick={() => vm.tirar(s.id)} /></td>
                  </tr>
                ))}
                <tr>
                  <td><input type="text" value={vm.novo} maxLength={80} onChange={e => vm.setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') vm.acrescentar(); }} placeholder="Serviço novo" aria-label="Serviço novo" /></td>
                  <td />
                  <td><button type="button" className="btn btn-outline" disabled={!vm.novo.trim()} onClick={vm.acrescentar}><Icone nome="plus" />Acrescentar</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando || !vm.carregada} onClick={() => void vm.salvar()}><Icone nome="check" />Gravar</button>
        </footer>
      </div>
    </div>
  );
}
