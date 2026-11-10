// A revisão de um boleto do lote (10/11/2026), no desenho das janelas do Financeiro: o cliente (dá para trocar), o valor e o
// vencimento impressos no PDF, para quem vai (dá para corrigir), a linha digitável e o que trava ou merece um olhar.
import { financeiro, formatos } from '@nads/core';
import { BotaoFechar, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { useRef, useState } from 'react';
import { dataBr, dataHoraBr } from './formatosDaNota';
import { Propriedade } from './partes/Propriedade';
import { CLASSE_DA_SITUACAO, type LinhaDoLote, type VmLoteDeBoletos } from './useLoteDeBoletos';

function MenuDoCliente({ vm, linha }: { vm: VmLoteDeBoletos; linha: LinhaDoLote }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const achados = (q ? vm.clientes.filter(c => `${c.codigo} ${c.nome}`.toLowerCase().includes(q)) : vm.clientes).slice(0, 60);
  return (
    <MenuSuspenso rotulo={linha.contrato ? `${linha.contrato.codigo} · ${linha.contrato.nome}` : 'Escolher o cliente'} className="btn btn-outline" largura={340} dica="O cliente do boleto"
      conteudo={fechar => (
        <>
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente" value={busca} autoFocus onChange={e => setBusca(e.target.value)} />
          </label>
          {achados.map(c => (
            <button key={c.id} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); setBusca(''); void vm.escolherCliente(linha.boleto.id, c.id); }}>
              <span className="popover-texto"><b>{c.codigo}</b><br /><span className="hint">{c.nome}</span></span>
            </button>
          ))}
          {!achados.length && <p className="hint">Nenhum cliente com essa busca.</p>}
        </>
      )} />
  );
}

export function JanelaDoBoleto({ vm, linha }: { vm: VmLoteDeBoletos; linha: LinhaDoLote }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  const b = linha.boleto, c = linha.conferencia, envio = b.envio;
  const travado = c.situacao === 'fila' || c.situacao === 'enviando' || c.situacao === 'enviado';
  const destinatarios = b.destinatarios.join(', ');
  const esperado = financeiro.vencimentoDoContrato(linha.contrato?.diaVencimento, b.competencia);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Revisar o boleto">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Boletos<Icone nome="chevronRight" /><b>{financeiro.competenciaBr(b.competencia)}</b></span>
          <BotaoFechar onClick={vm.fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="briefcase" rotulo="Cliente">
              {travado ? <span>{linha.contrato?.nome || '—'}</span> : <MenuDoCliente vm={vm} linha={linha} />}
            </Propriedade>
            <Propriedade icone="dinheiro" rotulo="Valor no PDF">
              <span className="num">{b.valor == null ? '—' : formatos.reais(b.valor)}</span>
              {!!linha.contrato?.valor && <span className="fraco"> · honorário {formatos.reais(linha.contrato.valor)}</span>}
            </Propriedade>
            <Propriedade icone="clock" rotulo="Vencimento no PDF">
              <span className="num">{b.vencimento ? dataBr(b.vencimento) : '—'}</span>
              {esperado && <span className="fraco"> · cadastro {dataBr(esperado)}</span>}
            </Propriedade>
            <Propriedade icone="envelope" rotulo="Para">
              {travado ? <span>{destinatarios || '—'}</span> : (
                <input key={b.id + destinatarios} type="text" defaultValue={destinatarios} placeholder="E-mail do cliente" aria-label="E-mails de quem recebe o boleto"
                  onBlur={e => { if (e.target.value.trim() !== destinatarios) void vm.definirDestinatarios(b.id, e.target.value); }} />
              )}
            </Propriedade>
            <Propriedade icone="codigoBarras" rotulo="Linha digitável"><span className="num">{financeiro.linhaFormatada(b.linha) || '—'}</span></Propriedade>
            <Propriedade icone="fileText" rotulo="Arquivo"><span className="fin-corta" title={b.arquivo}>{b.arquivo}</span></Propriedade>
            <Propriedade icone="check" rotulo="Situação">
              <span className={CLASSE_DA_SITUACAO[c.situacao]}>{financeiro.ROTULO_DA_SITUACAO_DO_BOLETO[c.situacao]}</span>
              {envio && <span className="fraco"> · {dataHoraBr(envio.em)}{envio.por ? ' · ' + envio.por : ''}</span>}
            </Propriedade>
          </div>
          {(envio?.erro || c.pendencias.length > 0) && (
            <ul className="registro-erros">{[...(envio?.erro ? [envio.erro] : []), ...c.pendencias].map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>
          )}
          {c.avisos.map(a => <p key={a} className="registro-dica"><Icone nome="alert" />{a}</p>)}
        </div>
        <footer className="registro-pe">
          {!travado && (
            <button type="button" className="btn btn-outline" onClick={() => { void vm.tirar(b.id, !b.fora); if (!b.fora) vm.fechar(); }}>
              <Icone nome={b.fora ? 'repeat' : 'x'} />{b.fora ? 'Pôr de volta no lote' : 'Tirar do lote'}
            </button>
          )}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-primary" onClick={vm.fechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
