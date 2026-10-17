// A Visão geral da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: a faixa de boas-vindas
// com os dois atalhos, os quatro números (stat do nads), e embaixo as obrigações e guias próximas (com as pagas) ao lado do
// atendimento.
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
        <div className="cli-boas-vindas-txt">
          <h1 className="page-title">Bem-vindo à sua área exclusiva</h1>
          <p className="page-desc">Guias, documentos, funcionários e pedidos ao escritório.</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => vm.irPara('guias')}>Guias deste mês</button>
          <button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Abrir chamado</button>
        </div>
      </section>

      <div className="stat-grid dp-numeros cli-numeros">
        <div className="stat">
          <p className="stat-label">Guias a vencer</p>
          <p className={'stat-value' + (vm.vencidas ? ' cli-ruim' : '')}>{vm.totalDeGuias}</p>
          <p className="hint">{vm.vencidas ? <span className="cli-ruim">{vm.vencidas === 1 ? '1 vencida' : vm.vencidas + ' vencidas'}</span> : 'Nenhuma vencida'}{vm.proximaGuia ? ' · a próxima em ' + vm.proximaGuia : ''}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Empregados ativos</p>
          <p className="stat-value">{vm.pessoal.ativos}</p>
          <p className="hint">{vm.pessoal.emFerias === 1 ? '1 em férias' : vm.pessoal.emFerias ? vm.pessoal.emFerias + ' em férias' : 'Ninguém em férias'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Chamados em aberto</p>
          <p className="stat-value">{vm.chamadosEmAberto}</p>
          <p className="hint">{vm.chamadosEmPoucas || 'Nenhum'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Documentos do mês</p>
          <p className="stat-value">{vm.docsDoMes}</p>
          <p className="hint">{vm.docsNovos === 1 ? '1 novo' : vm.docsNovos ? vm.docsNovos + ' novos' : 'Todos baixados'}</p>
        </div>
      </div>

      <div className="cli-duas">
        <section className="card">
          <div className="card-head">
            <h3>Obrigações e guias próximas</h3>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas<Icone nome="seta" width={14} height={14} /></button>
          </div>
          {vm.guias.length || vm.pagas.length ? (
            <ul>
              {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
              {vm.pagas.map(p => (
                <li key={p.id} className="cli-linha cli-linha-guia">
                  <span className="cli-sigla bom" aria-hidden="true">{p.sigla}</span>
                  <div className="cli-linha-txt">
                    <b>{p.nome}</b>
                    <p className="hint">Pago em {p.pagoEm}</p>
                  </div>
                  <span className="cli-valor">{formatos.reais(p.valor)}</span>
                  <span className="cli-coluna-selo"><span className="cli-selo bom">Pago</span></span>
                  <span className="cli-acoes-linha">
                    {p.temComprovante && (
                      <button type="button" className="icon-btn" title="Baixar o comprovante" aria-label={'Baixar o comprovante de ' + p.nome} onClick={() => void vm.baixarComprovante(p.id)}>
                        <Icone nome="fileDown" width={16} height={16} />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="empty">Nenhuma guia por enquanto.</p>}
        </section>

        <section className="card cli-atendimento">
          <div className="card-head"><h3>Atendimento</h3></div>
          <div className="cli-atendimento-caixa">
            <div className="cli-pessoa">
              <span className="cli-iniciais t0 grande" aria-hidden="true">NC</span>
              <div><b>{c.equipe}</b><span className="hint">Seu escritório de contabilidade</span></div>
            </div>
            <ul className="cli-contatos">
              {c.email && <li><Icone nome="envelope" width={16} height={16} />{c.email}</li>}
              {c.telefone && <li><Icone nome="telefone" width={16} height={16} />{c.telefone}</li>}
              {c.whatsapp && <li><Icone nome="mensagem" width={16} height={16} />{c.whatsapp} (WhatsApp)</li>}
              {c.horario && <li><Icone nome="clock" width={16} height={16} />{c.horario}</li>}
            </ul>
          </div>
          <button type="button" className="btn cli-largo" onClick={() => vm.irPara('chamados')}><Icone nome="aviao" width={16} height={16} />Solicitar documento ou serviço</button>
        </section>
      </div>
    </>
  );
}
