// Guias e obrigações da Área do Cliente (Vitor, 16 e 17/10/2026: "melhora essa aba"), no layout da "Agenda de tributos e
// obrigações" do protótipo com as peças do nads. Versão D: à esquerda (2/3), as guias a pagar e as pagas no mês em listas
// de grade (as mesmas colunas da Visão geral: logo, nome, situação, valor e ações), com o baixar carmim só na vencida (ou
// na mais urgente); à direita (1/3), o resumo do mês (o total a pagar, o total pago e o próximo vencimento) e os avisos
// da contabilidade (os recados e o certificado digital); embaixo, o que o escritório entrega no mês. Com o banco
// (17/10/2026) as guias pagas ainda não têm fonte: somem o card "Pagas no mês" e o "Total pago" do resumo. Polida de
// 17/10/2026: sem recado nem certificado (sempre, com o banco), o card dos avisos some em vez de dizer "Nenhum aviso"; o
// contador some no zero; o vazio diz o que importa ("Nada para pagar neste mês"). "Melhora mais" de 17/10/2026: o Baixar
// com nome (carmim na próxima a pagar) e, na vencida, o "Pedir nova", que abre o chamado já com o assunto e o título.
import { formatos } from '@nads/core';
import { Icone, SeletorMes } from '@nads/ui';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { LinhaDePaga } from '../partes/LinhaDePaga';
import { Vazio } from '../partes/Vazio';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  const temAvisos = vm.avisos.length > 0 || !!vm.certificado;
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Guias e obrigações</h1>
        </div>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês" max={vm.ultimo} />
      </div>

      <div className="cli-duas cli-guias">
        <div className="cli-coluna">
          <section className="card">
            <div className="card-head"><h3>A pagar</h3>{vm.guias.length > 0 && <span className="cli-conta">{vm.guias.length}</span>}</div>
            {vm.guias.length ? (
              <ul className="cli-lista">
                {vm.guias.map(g => (
                  <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} faltam={vm.faltam(g)} destaque={g.id === vm.urgente}
                    ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} onPedirNova={vm.pedirGuiaNova} />
                ))}
              </ul>
            ) : <Vazio icone="checkCircle" titulo="Nada para pagar neste mês" />}
          </section>

          {vm.mostraPagas && (
            <section className="card">
              <div className="card-head"><h3>Pagas no mês</h3>{vm.pagas.length > 0 && <span className="cli-conta">{vm.pagas.length}</span>}</div>
              {vm.pagas.length ? (
                <ul className="cli-lista cli-pagas">
                  {vm.pagas.map(p => <LinhaDePaga key={p.id} paga={p} ocupado={vm.baixando === p.id} onComprovante={id => void vm.comprovante(id)} />)}
                </ul>
              ) : <Vazio icone="recibo" titulo="Nada pago neste mês" />}
            </section>
          )}
        </div>

        <div className="cli-coluna">
          <section className="card cli-resumo">
            <div className="card-head"><h3>Resumo do mês</h3></div>
            <dl>
              <div><dt>Total a pagar</dt><dd className="cli-valor">{formatos.reais(vm.totalAPagar)}</dd></div>
              {vm.mostraPagas && <div><dt>Total pago</dt><dd className="cli-valor">{formatos.reais(vm.totalPago)}</dd></div>}
              <div>
                <dt>Próximo vencimento</dt>
                <dd>{vm.proxima ? <><b>{vm.proxima.vencimento.slice(0, 5)}</b> <span className="hint">{vm.faltam(vm.proxima) || 'hoje'}</span></> : <span className="hint">Nenhum</span>}</dd>
              </div>
            </dl>
          </section>

          {temAvisos && (
            <section className="card cli-avisos-card">
              <div className="card-head"><h3>Avisos da contabilidade</h3></div>
              <ul className="cli-lista">
                {vm.avisos.map(a => (
                  <li key={a.id} className="cli-linha cli-aviso-bloco">
                    <span className="cli-aviso-ico" aria-hidden="true"><Icone nome="sino" width={16} height={16} /></span>
                    <div className="cli-g-txt"><b>{a.titulo}</b><p className="hint cli-quebra">{a.texto}</p>
                      {a.ir && <button type="button" className="btn btn-ghost cli-link" onClick={() => vm.irPara(a.ir!)}>{a.ir === 'documentos' ? 'Enviar agora' : 'Abrir'}<Icone nome="chevronRight" width={16} height={16} /></button>}
                    </div>
                  </li>
                ))}
                {vm.certificado && (
                  <li className="cli-linha cli-aviso-bloco">
                    <span className="cli-aviso-ico" aria-hidden="true"><Icone nome="escudo" width={16} height={16} /></span>
                    <div className="cli-g-txt">
                      <div className="cli-aviso-titulo">
                        <b>Certificado digital {vm.certificado.tipo}</b>
                        <span className={'badge ' + (vm.certificado.tom === 'bad' ? 'badge-bad' : vm.certificado.tom === 'ok' ? 'badge-ok' : 'badge-warn')}>{vm.certificado.tom === 'bad' ? 'Vencido' : vm.certificado.tom === 'ok' ? 'Em dia' : 'Vence logo'}</span>
                      </div>
                      <p className="hint cli-quebra">{vm.certificado.texto}</p>
                      {vm.certificado.tom !== 'ok' && <button type="button" className="btn btn-ghost cli-link" onClick={() => vm.irPara('chamados')}>Pedir a renovação<Icone nome="chevronRight" width={16} height={16} /></button>}
                    </div>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
      </div>

      {vm.agenda.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>O que o escritório entrega no mês</h3></div>
          <ul className="cli-lista cli-agenda">{vm.agenda.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
        </section>
      )}
    </>
  );
}
