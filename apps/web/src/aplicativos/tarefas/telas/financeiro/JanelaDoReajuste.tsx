// A janela Reajustar honorários (22/10/2026, o item 5 da lista do Painel), no desenho da janela Receber: o índice (%), o
// arredondamento e a prévia de cada contrato (hoje → novo), com o total do mês antes e depois; Reajustar pergunta antes.
import { formatos } from '@nads/core';
import { BotaoFechar, Icone, Segmentado, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { Propriedade } from './partes/Propriedade';
import { useReajuste } from './useReajuste';

export function JanelaDoReajuste({ fechar }: { fechar: () => void }) {
  const vm = useReajuste(fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Reajustar honorários">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Honorários<Icone nome="chevronRight" /><b>Reajustar</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="hash" rotulo="Índice (%)">
              <input type="text" inputMode="decimal" autoFocus value={vm.indice} onChange={e => vm.setIndice(e.target.value)} placeholder="Ex.: 4,5" aria-label="Índice do reajuste em %" />
            </Propriedade>
            <Propriedade icone="repeat" rotulo="Arredondar">
              <Segmentado valor={vm.arredondar} opcoes={vm.arredondamentos} onMudar={vm.setArredondar} />
            </Propriedade>
          </div>
          {vm.valido && (
            <>
              <p className="registro-dica"><Icone nome="dinheiro" />{vm.previa.length} {vm.previa.length === 1 ? 'contrato' : 'contratos'}: o total por mês passa de <b>{formatos.reais(vm.antes)}</b> para <b>{formatos.reais(vm.depois)}</b>.</p>
              <div className="table-wrap fin-reajuste-lista">
                <table className="table-compact">
                  <thead><tr><th>Cliente</th><th className="num">Hoje</th><th className="num">Novo</th></tr></thead>
                  <tbody>{vm.previa.map(l => <tr key={l.contrato.id}><td>{l.contrato.nome}</td><td className="num fraco">{formatos.reais(l.atual)}</td><td className="num">{formatos.reais(l.novo)}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!vm.valido || !vm.previa.length || vm.aplicando} onClick={() => void vm.aplicar()}>
            {vm.aplicando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" />}Reajustar
          </button>
        </footer>
      </div>
    </div>
  );
}
