// Card "Conferir conta": conta (travada, vem do Relatório), modo serviços ou CFOP, relatório(s)
// da conta, Limpar e Conferir. Origem: conferencia.html ~L1268-1297; vcCarregarContas (~L3858),
// vcRenderMulti (~L3717), vcMontarCfopSelect (~L3944), vcInfoLidos (~L3713), alerta (~L2639).
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { useEffect, useRef } from 'react';
import type { InfoRelatorio, useVerificarConta } from '../useVerificarConta';
import { AlertaVerde } from './Tabelas';

type Vm = ReturnType<typeof useVerificarConta>;
type Relatorio = Vm['relatorios'][number];

const DICA = 'Contábil > Lançamentos > Mesmo período do Balancete Anterior > Exportar para Excel';

export function Formulario({ vm, oculto }: { vm: Vm; oculto: boolean }) {
  const unico = vm.relatorios[0];
  return (
    <div className="card" id="vcFormCard" hidden={oculto}>
      <h3>Conferir conta</h3>
      <div id="vcSemPlano">{vm.semPlano && <p className="empty">Importe o balancete em Importação › Balancete antes de conferir.</p>}</div>
      <div className="field">
        <label htmlFor="vcContaTxt">Conta contábil</label>
        <input type="text" id="vcContaTxt" autoComplete="off" readOnly disabled={vm.semPlano} value={vm.contaTexto} />
      </div>
      <div id="vcContaEscolhida" hidden>
        {vm.conta && <p className="hint">Conferindo a conta <b style={{ color: 'var(--ink)' }}>[{vm.conta.codigo}] {vm.conta.nome}</b>.</p>}
      </div>
      <div className="field" id="vcServCampo" hidden={!vm.servico}>
        <label>Notas conferidas</label>
        <p className="hint" id="vcServInfo" style={{ margin: 0 }}>
          {vm.servico && <>{vm.servico.rotulo} ligados a essa conta em Cadastro › Configurações: <b style={{ color: 'var(--ink)' }}>{vm.servico.qtdNotas} nota(s)</b> de {vm.servico.qtdParticipantes} {vm.servico.rotParticipantes} · {formatos.brl(vm.servico.soma)}</>}
        </p>
      </div>
      <div className="field" id="vcCfopCampo" hidden={!vm.cfop}>
        <label htmlFor="vcCfopSel">CFOP</label>
        <select id="vcCfopSel" disabled={!vm.cfop || vm.cfop.desabilitado} value={vm.cfop ? vm.cfop.valor : ''} onChange={ev => vm.escolherCfop(ev.target.value)}>
          {(vm.cfop ? vm.cfop.opcoes : [{ valor: '', rotulo: '— importe as notas de entradas/saídas primeiro —' }]).map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>
      <div id="vcRazaoMulti" hidden={!vm.multi}>
        {vm.multi && (
          <>
            {vm.relatorios.map((r, i) => (
              <div className="field" key={r.codigo}>
                <label htmlFor={'vcRazaoF' + i}>Relatório da conta <b>{r.codigo}</b> — {r.nome}</label>
                <CampoRelatorio id={'vcRazaoF' + i} r={r} nome={r.linhas ? r.arquivo || 'Arquivo lido' : ''} vm={vm} />
                <div className="vc-razao-info"><InfoDoRelatorio r={r} /></div>
              </div>
            ))}
            <p className="hint" style={{ marginBottom: 16 }}>{DICA}</p>
          </>
        )}
      </div>
      <div className="field" id="vcRazaoCampo" style={{ marginBottom: 0 }} hidden={vm.multi}>
        <label htmlFor="vcRazaoFile">Relatório da conta (Excel)</label>
        {!vm.multi && unico && <CampoRelatorio id="vcRazaoFile" r={unico} nome={unico.arquivo} vm={vm} idNome="vcRazaoFileNome" idIcone="vcRazaoIco" />}
        <p className="hint">{DICA}</p>
        <div id="vcRazaoInfo">{!vm.multi && unico && <InfoDoRelatorio r={unico} />}</div>
      </div>
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-danger" id="vcBtExcluir3" type="button" onClick={vm.limpar}>Limpar</button>
        <button className="btn btn-primary" id="vcBtConferir" type="button" disabled={vm.comparando} onClick={vm.conferir}>{vm.comparando ? 'Comparando…' : 'Conferir'}</button>
      </div>
    </div>
  );
}

/** O "Escolher arquivo" do relatório (sem ×, como no original). Abre sozinho no "Corrigi, quero reconferir". */
function CampoRelatorio({ id, r, nome, vm, idNome, idIcone }: { id: string; r: Relatorio; nome: string; vm: Vm; idNome?: string; idIcone?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const pedido = vm.abrirArquivo;
  useEffect(() => {
    if (!pedido || pedido.codigo !== r.codigo || !input.current) return;
    input.current.value = '';
    input.current.click();
  }, [pedido, r.codigo]);
  useEffect(() => { if (!nome && input.current) input.current.value = ''; }, [nome]);
  return (
    <>
      <label className={'file-picker' + (nome ? ' has-file' : '')} htmlFor={id}>
        {idIcone ? <span id={idIcone}><Icone nome="upload" /></span> : <Icone nome="upload" />}
        <span className="file-picker-name" id={idNome}>{nome || 'Escolher arquivo'}</span>
      </label>
      <input ref={input} type="file" id={id} accept=".xls,.xlsx,.csv" className="sr-only" onChange={ev => void vm.escolherRelatorio(r.codigo, ev.target.files?.[0] || null)} />
    </>
  );
}

function InfoDoRelatorio({ r }: { r: { linhas: number; info: InfoRelatorio | null } }) {
  if (r.info?.tom === 'lendo') return <p className="hint">Lendo…</p>;
  if (r.info?.tom === 'erro') {
    return (
      <div className="alert">
        <Icone nome="alert" />
        <div><p className="alert-title">{r.info.titulo}</p><p className="alert-text">{r.info.texto}</p></div>
      </div>
    );
  }
  return r.linhas ? <AlertaVerde titulo={r.linhas + ' lançamento(s) lidos do relatório'} /> : null;
}
