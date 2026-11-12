// A janela de registrar (ou mudar) uma comissão (12/11/2026), no desenho das janelas do Financeiro: o mês do pagamento, a
// data, o cliente, a descrição e o valor. Depois de aprovada pelo Financeiro, só ver (a pessoa não muda mais).
import { carteira } from '@nads/core';
import { BotaoFechar, CampoData, Icone, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useJanelaDaComissao } from './useCarteiraDaPessoa';

export function JanelaDaComissao({ comissao, fechar }: { comissao: carteira.Comissao | null; fechar: () => void }) {
  const vm = useJanelaDaComissao(comissao, fechar);
  const { competencia, setCompetencia, data, setData, cliente, setCliente, descricao, setDescricao, valor, setValor, erros, salvando, travada } = vm;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = !comissao ? 'Registrar comissão' : travada ? 'Comissão' : 'Mudar comissão';
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Carteira<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          {travada && <p className="registro-dica"><Icone nome="lock" />{comissao!.situacao === 'recusada' ? 'Recusada pelo Financeiro' + (comissao!.motivo ? ': ' + comissao!.motivo : '.') : 'Já ' + carteira.rotuloDaSituacao(comissao!.situacao).toLowerCase() + ' pelo Financeiro: não muda mais.'}</p>}
          <div className="registro-props">
            <Propriedade icone="calendar" rotulo="Pagar em">
              <select className="pessoal-select" value={competencia} disabled={travada} onChange={e => setCompetencia(e.target.value)} aria-label="O mês do pagamento">
                {vm.meses.map(x => <option key={x} value={x}>{carteira.mesPorExtenso(x)}</option>)}
              </select>
            </Propriedade>
            <Propriedade icone="calendar" rotulo="Data">{travada ? <span>{data}</span> : <CampoData valor={data} onMudar={setData} rotulo="Data da venda ou do serviço" />}</Propriedade>
            <Propriedade icone="predio" rotulo="Cliente">
              <input type="text" autoFocus={!comissao} value={cliente} disabled={travada} maxLength={150} onChange={e => setCliente(e.target.value)} placeholder="A empresa ou o cliente" aria-label="Cliente" />
            </Propriedade>
            <Propriedade icone="fileText" rotulo="Descrição">
              <input type="text" value={descricao} disabled={travada} maxLength={500} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: abertura de empresa, indicação" aria-label="Descrição" />
            </Propriedade>
            <Propriedade icone="dinheiro" rotulo="Valor">
              <input type="text" inputMode="decimal" value={valor} disabled={travada} onChange={e => setValor(e.target.value)} placeholder="0,00" aria-label="Valor da comissão" />
            </Propriedade>
          </div>
          {erros.length > 0 && <ul className="registro-erros">{erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          {comissao && !travada && <button type="button" className="btn btn-outline btn-danger" onClick={() => void vm.apagar()}><Icone nome="lixeira" />Apagar</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>{travada ? 'Fechar' : 'Cancelar'}</button>
          {!travada && <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => void vm.salvar()} title="Gravar (Ctrl+Enter)"><Icone nome="check" />{comissao ? 'Gravar' : 'Registrar'}</button>}
        </footer>
      </div>
    </div>
  );
}
