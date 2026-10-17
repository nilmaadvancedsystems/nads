// A Visão geral da Área do Cliente (Vitor, 16/10/2026): o resumo do mês no estilo do nads — os números (guias para pagar,
// funcionários, chamados em aberto e documentos do mês), as próximas guias ao lado do atendimento, os avisos do escritório
// (com o certificado digital) e as últimas conversas.
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { useInicio } from './useInicio';
import type { DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca & { empresa: string; onCanais: () => void }) {
  const vm = useInicio(props);
  const c = vm.contato;
  const at = vm.atendimento;
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">{props.empresa ? 'Olá, ' + props.empresa : 'Olá'}</h1>
          <p className="page-desc">Resumo de {vm.mesAtual}.</p>
        </div>
      </div>

      <div className="stat-grid cli-app-stats">
        <div className="stat">
          <p className="stat-label">Guias para pagar</p>
          <p className="stat-value">{vm.totalDeGuias}</p>
          <p className="hint" title={vm.guiasEmPoucas}>{vm.totalDeGuias ? formatos.reais(vm.valorEmAberto) + (vm.vencidas ? ' · ' + vm.vencidas + ' vencida(s)' : '') : 'Nenhuma em aberto'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Funcionários</p>
          <p className="stat-value">{vm.pessoal.ativos}</p>
          <p className="hint">{vm.pessoal.emFerias ? vm.pessoal.emFerias + ' de férias' : 'Ninguém de férias'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Chamados em aberto</p>
          <p className="stat-value">{vm.chamadosEmAberto}</p>
          <p className="hint" title={vm.primeiroEmAberto}>{vm.primeiroEmAberto || 'Nenhum'}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Documentos do mês</p>
          <p className="stat-value">{vm.docsDoMes}</p>
          <p className="hint">{vm.docsNovos ? vm.docsNovos + ' ainda não baixado(s)' : 'Todos baixados'}</p>
        </div>
      </div>

      <div className="cli-duas">
        <section className="card">
          <div className="card-head">
            <h3>Próximas guias</h3>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('guias')}>Ver todas</button>
          </div>
          {vm.guias.length ? (
            <ul>
              {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={vm.baixar} onCopiar={cod => vm.copiar(cod, 'Código')} />)}
            </ul>
          ) : <p className="empty">Nenhuma guia por enquanto.</p>}
        </section>

        <section className="card">
          <div className="card-head"><h3>Atendimento</h3></div>
          <p style={{ fontWeight: 600 }}>{at?.equipe || 'Nilma Contabilidade'}</p>
          {at?.horario && <p className="hint">{at.horario}</p>}
          <ul style={{ marginTop: 12 }}>
            {c.telefone && <li className="cli-linha cli-contato"><Icone nome="telefone" width={16} height={16} /><span>{c.telefone}</span></li>}
            {c.whatsapp && <li className="cli-linha cli-contato"><Icone nome="mensagem" width={16} height={16} /><span>{c.whatsapp} (WhatsApp)</span></li>}
            {c.email && <li className="cli-linha cli-contato"><Icone nome="envelope" width={16} height={16} /><span>{c.email}</span></li>}
          </ul>
          <div className="cli-acoes" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Pedir documento ou serviço</button>
            <button type="button" className="btn btn-ghost" onClick={props.onCanais}>Todos os contatos</button>
          </div>
        </section>
      </div>

      <div className="cli-duas metade">
        <section className="card">
          <div className="card-head"><h3>Avisos do escritório</h3></div>
          <ul>
            {vm.certificado && (
              <li className="cli-linha">
                <div className="cli-linha-txt">
                  <b>Certificado digital {vm.certificado.tipo}</b>{' '}
                  {vm.certificado.tom !== 'ok' && <span className={'badge ' + (vm.certificado.tom === 'bad' ? 'badge-bad' : 'badge-warn')}>{vm.certificado.tom === 'bad' ? 'Vencido' : 'Vence logo'}</span>}
                  <p className="hint">{vm.certificado.texto}</p>
                </div>
              </li>
            )}
            {vm.avisos.map(a => (
              <li key={a.id} className="cli-linha">
                <div className="cli-linha-txt"><b>{a.titulo}</b><p className="hint">{a.texto}</p></div>
                {a.ir && <button type="button" className="btn" onClick={() => vm.irPara(a.ir!)}>{a.ir === 'documentos' ? 'Enviar' : 'Abrir'}</button>}
              </li>
            ))}
            {vm.pendencias.length > 0 && (
              <li className="cli-linha">
                <div className="cli-linha-txt"><b>O escritório ainda faz {vm.pendencias.length} obrigação(ões) neste mês</b><p className="hint">{vm.pendencias.map(i => i.nome).join(', ')}</p></div>
                <button type="button" className="btn" onClick={() => vm.irPara('guias')}>Agenda</button>
              </li>
            )}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Últimas conversas</h3>
            <button type="button" className="btn btn-ghost" onClick={() => vm.irPara('chamados')}>Ver todas</button>
          </div>
          {vm.ultimosChamados.length ? (
            <ul>
              {vm.ultimosChamados.map(ch => {
                const ultima = vm.ultimaMensagem(ch);
                return (
                  <li key={ch.id} className="cli-linha">
                    <div className="cli-linha-txt">
                      <b>{ch.titulo}</b>{' '}
                      {ch.situacao === 'respondido' && <span className="badge badge-ok">Respondido</span>}
                      {ultima && <p className="hint">{ultima.de === 'escritorio' ? 'Escritório: ' : 'Você: '}{ultima.texto.split('\n')[0]}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty">Você ainda não abriu nenhum chamado.</p>}
        </section>
      </div>
    </>
  );
}
