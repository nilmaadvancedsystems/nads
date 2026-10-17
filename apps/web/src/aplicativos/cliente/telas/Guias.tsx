// Guias e obrigações da Área do Cliente (Vitor, 16/10/2026), no layout da "Agenda de tributos e obrigações" do protótipo
// com as peças do nads: o título com o seletor de mês e as três colunas — Próximos vencimentos (cartões de guia), Quitados
// no mês (com o comprovante) e Avisos da contabilidade (os recados e o certificado digital) —, cada uma com o contador;
// embaixo, o que o escritório entrega no mês. Versão D: os títulos das colunas em sobrelinha, o valor grande nos cartões,
// o botão carmim só na guia mais urgente e a agenda com a data em folhinha.
import { formatos } from '@nads/core';
import { Icone, SeletorMes } from '@nads/ui';
import { CartaoDeGuia } from '../partes/CartaoDeGuia';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { Vazio } from '../partes/Vazio';
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
          <p className="page-desc">Os vencimentos dos impostos e das obrigações da sua empresa no mês.</p>
        </div>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês" max={vm.ultimo} />
      </div>

      <div className="cli-tres">
        <section>
          <div className="cli-coluna-topo"><h2>Próximos vencimentos</h2><span className="cli-conta">{vm.guias.length}</span></div>
          {vm.guias.length ? vm.guias.map((g, i) => (
            <CartaoDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} faltam={vm.faltam(g)} ocupado={vm.baixando === g.id} destaque={i === 0} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />
          )) : <div className="card cli-vazio-cartao"><Vazio icone="checkCircle" titulo="Nada vence neste mês" /></div>}
        </section>

        <section>
          <div className="cli-coluna-topo"><h2>Quitados no mês</h2><span className="cli-conta">{vm.pagas.length}</span></div>
          {vm.pagas.length ? vm.pagas.map(p => (
            <article key={p.id} className="card cli-cartao">
              <div className="cli-cartao-topo"><span className="cli-etiqueta">Quitado</span><span className="badge badge-ok">Pago</span></div>
              <p className="cli-cartao-valor">{formatos.reais(p.valor)}</p>
              <p className="cli-cartao-nome">{p.nome}</p>
              <p className="hint">Pago em {p.pagoEm}</p>
              {p.temComprovante && (
                <div className="cli-cartao-pe">
                  <button type="button" className="btn" disabled={vm.baixando === p.id} onClick={() => void vm.comprovante(p.id)}><Icone nome="fileDown" width={16} height={16} />Ver comprovante</button>
                </div>
              )}
            </article>
          )) : <div className="card cli-vazio-cartao"><Vazio icone="recibo" titulo="Nada quitado neste mês" /></div>}
        </section>

        <section>
          <div className="cli-coluna-topo"><h2>Avisos da contabilidade</h2><span className="cli-conta">{avisos}</span></div>
          {vm.avisos.map(a => (
            <article key={a.id} className="card cli-cartao">
              <div className="cli-cartao-topo"><span className="cli-etiqueta">Aviso</span></div>
              <p className="cli-cartao-nome">{a.titulo}</p>
              <p className="hint">{a.texto}</p>
              {a.ir && <div className="cli-cartao-pe"><button type="button" className="btn" onClick={() => vm.irPara(a.ir!)}>{a.ir === 'documentos' ? 'Enviar agora' : 'Abrir'}</button></div>}
            </article>
          ))}
          {vm.certificado && (
            <article className="card cli-cartao">
              <div className="cli-cartao-topo">
                <span className="cli-etiqueta">Certificado digital</span>
                <span className={'badge ' + (vm.certificado.tom === 'bad' ? 'badge-bad' : vm.certificado.tom === 'ok' ? 'badge-ok' : 'badge-warn')}>{vm.certificado.tom === 'bad' ? 'Vencido' : vm.certificado.tom === 'ok' ? 'Em dia' : 'Vence logo'}</span>
              </div>
              <p className="cli-cartao-nome">Certificado {vm.certificado.tipo}</p>
              <p className="hint">{vm.certificado.texto}</p>
              {vm.certificado.tom !== 'ok' && <div className="cli-cartao-pe"><button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Pedir a renovação</button></div>}
            </article>
          )}
          {!avisos && <div className="card cli-vazio-cartao"><Vazio icone="sino" titulo="Nenhum aviso" /></div>}
        </section>
      </div>

      {vm.agenda.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>O que o escritório entrega no mês</h3></div>
          <ul className="cli-lista">{vm.agenda.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
        </section>
      )}
    </>
  );
}
