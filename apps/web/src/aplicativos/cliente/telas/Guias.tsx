// Guias e obrigações da Área do Cliente (Vitor, 16/10/2026), no layout da "Agenda de tributos e obrigações" do protótipo
// com as peças do nads: o título com o seletor de mês e as três colunas — Próximos vencimentos (cartões de guia), Quitados
// no mês (com o comprovante) e Avisos da contabilidade (os recados e o certificado digital) —, cada uma com o contador;
// embaixo, o que o escritório entrega no mês.
import { formatos } from '@nads/core';
import { SeletorMes } from '@nads/ui';
import { CartaoDeGuia } from '../partes/CartaoDeGuia';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  const avisos = vm.avisos.length + (vm.certificado ? 1 : 0);
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Guias e obrigações</h1>
          <p className="page-desc">O que vence no mês, o que já foi pago e os avisos do escritório.</p>
        </div>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês" max={vm.ultimo} />
      </div>

      <div className="cli-tres">
        <section>
          <div className="cli-coluna-topo"><h2>Próximos vencimentos</h2><span className="subnav-count">{vm.guias.length}</span></div>
          {vm.guias.length ? vm.guias.map(g => (
            <CartaoDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} faltam={vm.faltam(g)} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />
          )) : <p className="empty">Nenhuma guia vence neste mês.</p>}
        </section>

        <section>
          <div className="cli-coluna-topo"><h2>Quitados no mês</h2><span className="subnav-count">{vm.pagas.length}</span></div>
          {vm.pagas.length ? vm.pagas.map(p => (
            <article key={p.id} className="card cli-cartao">
              <div className="cli-cartao-l1">
                <span className="cli-sigla" aria-hidden="true">{p.sigla}</span>
                <b className="cli-cartao-nome">{p.nome}</b>
                <b className="cli-valor">{formatos.reais(p.valor)}</b>
              </div>
              <div className="cli-cartao-l2">
                <span className="hint"><span className="cli-selo bom">Pago</span> em {p.pagoEm.slice(0, 5)}</span>
                {p.temComprovante && <button type="button" className="btn" disabled={vm.baixando === p.id} onClick={() => void vm.comprovante(p.id)}>Comprovante</button>}
              </div>
            </article>
          )) : <p className="empty">Nada quitado neste mês.</p>}
        </section>

        <section>
          <div className="cli-coluna-topo"><h2>Avisos da contabilidade</h2><span className="subnav-count">{avisos}</span></div>
          {vm.avisos.map(a => (
            <article key={a.id} className="card cli-cartao">
              <b className="cli-cartao-nome">{a.titulo}</b>
              <p className="hint">{a.texto}</p>
              {a.ir && <div className="cli-cartao-l2"><span /><button type="button" className="btn" onClick={() => vm.irPara(a.ir!)}>{a.ir === 'documentos' ? 'Enviar agora' : 'Abrir'}</button></div>}
            </article>
          ))}
          {vm.certificado && (
            <article className="card cli-cartao">
              <div className="cli-cartao-l1">
                <b className="cli-cartao-nome">Certificado digital {vm.certificado.tipo}</b>
                {vm.certificado.tom !== 'ok' && <span className={'cli-selo ' + (vm.certificado.tom === 'bad' ? 'ruim' : 'atencao')}>{vm.certificado.tom === 'bad' ? 'Vencido' : 'Vence logo'}</span>}
              </div>
              <p className="hint">{vm.certificado.texto}</p>
              {vm.certificado.tom !== 'ok' && <div className="cli-cartao-l2"><span /><button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Pedir a renovação</button></div>}
            </article>
          )}
          {!avisos && <p className="empty">Nenhum aviso.</p>}
        </section>
      </div>

      {vm.agenda.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>O que o escritório entrega no mês</h3></div>
          <ul>{vm.agenda.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
        </section>
      )}
    </>
  );
}
