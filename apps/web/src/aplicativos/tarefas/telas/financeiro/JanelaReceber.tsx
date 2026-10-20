// A janela Receber (19/10/2026, Honorários), no desenho da janela do lançamento: o valor (já com o do contrato), a data
// (hoje), a forma (Dinheiro, PIX, Boleto, Depósito, Outro) e as observações. Em dinheiro, o recebimento também entra no
// Caixa. Ctrl+Enter grava.
import { financeiro } from '@nads/core';
import { BotaoFechar, CampoData, Icone, Segmentado, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Propriedade } from './partes/Propriedade';
import { useJanelaReceber } from './useJanelaReceber';

export function JanelaReceber({ contratoId, competencia, fechar }: { contratoId: string; competencia: string; fechar: () => void }) {
  const vm = useJanelaReceber(contratoId, competencia, fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  if (!vm.contrato) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Receber honorário">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Honorários<Icone nome="chevronRight" /><b>Receber {financeiro.competenciaBr(competencia)}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-busca"><Icone nome="briefcase" /><span className="nf-escolhido"><b>{vm.contrato.codigo || '—'}</b> · {vm.contrato.nome}</span></div>
          <div className="registro-props">
            <Propriedade icone="dinheiro" rotulo="Valor">
              <input type="text" inputMode="decimal" autoFocus value={vm.valor} onChange={e => vm.setValor(e.target.value)} placeholder="0,00" aria-label="Valor recebido" />
            </Propriedade>
            <Propriedade icone="calendar" rotulo="Recebido em"><CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data do recebimento" /></Propriedade>
            <Propriedade icone="repeat" rotulo="Forma">
              <Segmentado valor={vm.forma} opcoes={financeiro.FORMAS_DE_RECEBIMENTO} onMudar={vm.setForma} />
            </Propriedade>
            <Propriedade icone="mensagem" rotulo="Observações">
              <textarea className="nf-texto" rows={2} value={vm.observacoes} onChange={e => vm.setObservacoes(e.target.value)} placeholder="Opcional" aria-label="Observações" />
            </Propriedade>
          </div>
          {vm.vaiParaOCaixa && <p className="registro-dica"><Icone nome="dinheiro" />Em dinheiro: o valor também entra no Caixa como entrada.</p>}
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.salvar()} title="Registrar (Ctrl+Enter)">
            {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" />}Registrar
          </button>
        </footer>
      </div>
    </div>
  );
}
