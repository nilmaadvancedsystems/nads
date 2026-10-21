// A janela Clientes dos honorários (19/10/2026): quem controla honorário. Em cima o Adicionar cliente (busca na lista do
// escritório por código ou nome); embaixo cada contrato com o valor, as observações e o interruptor de ativo (quem sai de
// ativo some da lista do mês, mas o histórico fica).
import { BotaoFechar, Icone, Interruptor, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { ValorEditavel } from './partes/ValorEditavel';
import { useContratosDeHonorario } from './useContratosDeHonorario';

export function JanelaDosContratos({ fechar }: { fechar: () => void }) {
  const vm = useContratosDeHonorario();
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo fin-contratos-janela" role="dialog" aria-modal="true" aria-label="Clientes dos honorários">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Honorários<Icone nome="chevronRight" /><b>Clientes</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-busca">
            <Icone nome="plus" />
            <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Adicionar cliente: código ou nome" aria-label="Adicionar cliente por código ou nome" autoComplete="off" />
          </div>
          {vm.achados.length > 0 && (
            <ul className="nf-achados" aria-label="Clientes encontrados">
              {vm.achados.map(e => (
                <li key={e.nome + '|' + e.codigo}>
                  <button type="button" className="popover-item" onClick={() => void vm.adicionar(e)}>
                    <span className="nf-achado-codigo">{e.codigo ?? '—'}</span>
                    <span className="popover-texto">{e.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="fin-contratos-filtro"><Interruptor ligado={vm.somenteAtivos} onMudar={() => vm.setSomenteAtivos(!vm.somenteAtivos)} rotulo="Só os ativos" /><span>Só os ativos ({vm.contratos.length} de {vm.total})</span></label>
          {vm.contratos.length === 0 ? (
            <p className="registro-dica"><Icone nome="ajuda" />Nenhum cliente controla honorário ainda. Busque acima para adicionar.</p>
          ) : (
            <ul className="fin-contratos">
              {vm.contratos.map(c => (
                <li key={c.id} className={'fin-contrato' + (c.ativo ? '' : ' fin-conta-inativa')}>
                  <span className="emp-cod">{c.codigo || '—'}</span>
                  <span className="fin-contrato-nome" title={c.nome}>{c.nome}</span>
                  <ValorEditavel valor={c.valor} rotulo={'Valor do honorário de ' + c.nome} aoSalvar={t => void vm.definirValor(c.id, t)} />
                  <input type="text" className="fin-contrato-obs" defaultValue={c.observacoes ?? ''} placeholder="Observações" aria-label={'Observações de ' + c.nome}
                    onBlur={e => void vm.salvarObservacoes(c, e.target.value)} />
                  <Interruptor ligado={c.ativo} onMudar={() => void vm.alternarAtivo(c)} rotulo={'Honorário de ' + c.nome + ' ativo'} />
                </li>
              ))}
            </ul>
          )}
          <p className="registro-dica">O valor é o honorário mensal. Clientes parados (inativos) não entram na lista do mês.</p>
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-primary" onClick={fechar}>Pronto</button>
        </footer>
      </div>
    </div>
  );
}
