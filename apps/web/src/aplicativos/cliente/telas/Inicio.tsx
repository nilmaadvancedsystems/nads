// A Visão geral da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: o card de boas-vindas
// com os dois atalhos, os quatro números (stat do nads), e embaixo as obrigações e guias próximas (com as já pagas) ao lado
// do atendimento.
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { useInicio } from './useInicio';
import type { AreaCliente, DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca & { empresa: string; contato: AreaCliente['contato'] }) {
  const vm = useInicio(props);
  const c = props.contato;
  return (
    <>
      <section className="card cli-boas-vindas">
        <h1 className="page-title">Bem-vindo à sua área exclusiva</h1>
        <p className="page-desc">Aqui ficam as guias para pagar, os documentos do escritório, os seus funcionários e os pedidos ao escritório.</p>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => vm.irPara('guias')}>Guias deste mês</button>
          <button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Abrir chamado</button>
        </div>
      </section>

      <div className="stat-grid cli-numeros">
        <div className="stat">
          <p className="stat-label">Guias a vencer</p>
          <p className="stat-value">{vm.totalDeGuias}</p>
          <p className="hint">{vm.guiasEmPoucas || 'Nenhuma em aberto'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Empregados ativos</p>
          <p className="stat-value">{vm.pessoal.ativos}</p>
          <p className="hint">{vm.pessoal.emFerias === 1 ? '1 em férias' : vm.pessoal.emFerias ? vm.pessoal.emFerias + ' em férias' : 'Ninguém em férias'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Chamados em aberto</p>
          <p className="stat-value">{vm.chamadosEmAberto}</p>
          <p className="hint" title={vm.primeiroEmAberto}>{vm.primeiroEmAberto || 'Nenhum'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Documentos do mês</p>
          <p className="stat-value">{vm.docsDoMes}</p>
          <p className="hint">{vm.docsNovos === 1 ? '1 ainda não baixado' : vm.docsNovos ? vm.docsNovos + ' ainda não baixados' : 'Todos baixados'}</p>
        </div>
      </div>

      <div className="cli-duas">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Obrigações e guias próximas</h3>
              <p className="hint" style={{ margin: 0 }}>As guias que a Nilma Contabilidade gerou para a sua empresa</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas</button>
          </div>
          {vm.guias.length || vm.pagas.length ? (
            <ul>
              {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
              {vm.pagas.map(p => (
                <li key={p.id} className="cli-linha">
                  <span className="cli-sigla" aria-hidden="true">PAGO</span>
                  <div className="cli-linha-txt">
                    <b>{p.nome}</b>
                    <p className="hint">Pago em {p.pagoEm} · <span className="cli-valor">{formatos.reais(p.valor)}</span></p>
                  </div>
                  <div className="cli-linha-dir">
                    <span className="badge badge-ok">Pago</span>
                    {p.temComprovante && (
                      <button type="button" className="icon-btn" title="Baixar o comprovante" aria-label={'Baixar o comprovante de ' + p.nome} onClick={() => void vm.baixarComprovante(p.id)}>
                        <Icone nome="fileDown" width={16} height={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="empty">Nenhuma guia por enquanto.</p>}
        </section>

        <section className="card cli-atendimento">
          <div className="card-head"><h3>Atendimento</h3></div>
          <p><b>{c.equipe}</b></p>
          <dl className="cli-dados">
            {c.email && <><dt>E-mail</dt><dd>{c.email}</dd></>}
            {c.telefone && <><dt>Telefone</dt><dd>{c.telefone}</dd></>}
            {c.whatsapp && <><dt>WhatsApp</dt><dd>{c.whatsapp}</dd></>}
            {c.horario && <><dt>Horário</dt><dd>{c.horario}</dd></>}
          </dl>
          <button type="button" className="btn btn-primary cli-largo" onClick={() => vm.irPara('chamados')}>Solicitar documento ou serviço</button>
        </section>
      </div>
    </>
  );
}
