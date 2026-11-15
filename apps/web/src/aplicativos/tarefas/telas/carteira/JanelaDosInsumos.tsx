// A lista dos insumos e os preços (Vitor, 15/11/2026: "o preço do insumo é o financeiro que decide, e quais insumos são, o
// usuário só registra o tipo e quantidade"): só quem é do Financeiro abre. O nome e o preço de cada unidade; acrescentar, mudar e
// tirar. Mudar o preço não mexe no que já foi registrado: cada registro guarda o preço do dia.
import { BotaoFechar, BotaoIcone, CampoReais, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useJanelaDosInsumos } from './useInsumos';

export function JanelaDosInsumos({ fechar }: { fechar: () => void }) {
  const vm = useJanelaDosInsumos(fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo cart-servicos-janela" role="dialog" aria-modal="true" aria-label="Insumos e preços">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="impressora" />Insumos<Icone nome="chevronRight" /><b>Insumos e preços</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <p className="registro-dica"><Icone nome="lampada" />Quem registra só escolhe o insumo e a quantidade. O valor sai da quantidade × o preço do dia do registro.</p>
          {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Insumo</th><th className="num">Preço de cada um</th><th aria-label="Tirar" /></tr></thead>
              <tbody>
                {vm.lista.map(t => (
                  <tr key={t.id}>
                    <td><input type="text" value={t.nome} maxLength={80} onChange={e => vm.mudar(t.id, 'nome', e.target.value)} aria-label="Nome do insumo" /></td>
                    <td className="num"><CampoReais valor={t.preco} onMudar={v => vm.mudar(t.id, 'preco', v)} rotulo={'Preço de ' + t.nome} /></td>
                    <td><BotaoIcone icone="lixeira" titulo={'Tirar ' + t.nome} pequeno onClick={() => vm.tirar(t.id)} /></td>
                  </tr>
                ))}
                <tr>
                  <td><input type="text" value={vm.novo} maxLength={80} onChange={e => vm.setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') vm.acrescentar(); }} placeholder="Insumo novo" aria-label="Insumo novo" /></td>
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
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.salvar()}><Icone nome="check" />Gravar</button>
        </footer>
      </div>
    </div>
  );
}
