// O Início da Área do Cliente (Vitor, 16/10/2026): o resumo do mês, em português simples — o que pagar, o que o escritório
// ainda está fazendo, as últimas conversas e como falar com a gente. No visual do protótipo: o cartão de boas-vindas em
// degradê, os quatro números com ícone, as próximas guias em linha ao lado do cartão de atendimento e, embaixo, a agenda e
// as conversas lado a lado.
import { formatos } from '@nads/core';
import { Icone, MarcaN } from '@nads/ui';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { useInicio } from './useInicio';
import type { DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca & { empresa: string }) {
  const vm = useInicio(props);
  const c = vm.contato;
  return (
    <>
      <section className="cli-banner">
        <div className="cli-banner-conteudo">
          <span className="cli-banner-selo"><Icone nome="escudo" width={14} height={14} />Escritório: Nilma Contabilidade</span>
          <h1>Bem-vindo(a){props.empresa ? ', ' + props.empresa : ''}</h1>
          <p>Veja as guias para pagar, acompanhe o que o escritório está fazendo neste mês, envie seus documentos e converse com a gente, tudo num só lugar.</p>
          <div className="cli-acoes">
            <button type="button" className="cli-btn cli-btn-claro" onClick={() => vm.irPara('guias')}><Icone nome="recibo" width={16} height={16} />Ver as guias</button>
            <button type="button" className="cli-btn cli-btn-vidro" onClick={() => vm.irPara('enviar')}><Icone nome="upload" width={16} height={16} />Enviar documentos</button>
          </div>
        </div>
        <span className="cli-banner-deco" aria-hidden="true"><MarcaN /></span>
      </section>

      <div className="cli-kpis">
        <div className="cli-kpi">
          <div className="cli-kpi-topo"><span className="cli-kpi-rotulo">Guias para pagar</span><span className="cli-kpi-ico"><Icone nome="recibo" width={18} height={18} /></span></div>
          <div className="cli-kpi-linha">
            <span className="cli-kpi-valor">{vm.totalDeGuias}</span>
            {vm.totalDeGuias > 0 && (vm.precisaAtencao
              ? <span className="cli-kpi-status warn"><Icone nome="alert" width={13} height={13} />Atenção ao prazo</span>
              : <span className="cli-kpi-status ok"><Icone nome="check" width={13} height={13} />No prazo</span>)}
          </div>
          <p className="cli-kpi-nota" title={vm.guiasEmPoucas}>{vm.guiasEmPoucas || 'Nenhuma guia em aberto'}</p>
        </div>
        <div className="cli-kpi">
          <div className="cli-kpi-topo"><span className="cli-kpi-rotulo">Valor total</span><span className="cli-kpi-ico cinza"><Icone nome="dinheiro" width={18} height={18} /></span></div>
          <div className="cli-kpi-linha"><span className="cli-kpi-valor">{formatos.reais(vm.valorEmAberto)}</span></div>
          <p className="cli-kpi-nota">Soma das guias para pagar</p>
        </div>
        <div className="cli-kpi">
          <div className="cli-kpi-topo"><span className="cli-kpi-rotulo">Em atraso</span><span className={'cli-kpi-ico' + (vm.vencidas ? '' : ' cinza')}><Icone nome="alert" width={18} height={18} /></span></div>
          <div className="cli-kpi-linha">
            <span className={'cli-kpi-valor' + (vm.vencidas ? ' ruim' : '')}>{vm.vencidas}</span>
            {vm.vencidas
              ? <span className="cli-kpi-status bad"><Icone nome="alert" width={13} height={13} />Pague logo</span>
              : <span className="cli-kpi-status ok"><Icone nome="check" width={13} height={13} />Nada vencido</span>}
          </div>
          <p className="cli-kpi-nota">Guias com o vencimento já passado</p>
        </div>
        <div className="cli-kpi">
          <div className="cli-kpi-topo"><span className="cli-kpi-rotulo">O escritório está fazendo</span><span className="cli-kpi-ico roxo"><Icone nome="checklist" width={18} height={18} /></span></div>
          <div className="cli-kpi-linha">
            <span className="cli-kpi-valor">{vm.pendencias.length}</span>
            <span className="cli-kpi-status info"><Icone nome="clock" width={13} height={13} />Neste mês</span>
          </div>
          <p className="cli-kpi-nota" title={vm.pendenciasEmPoucas}>{vm.pendenciasEmPoucas || 'Tudo em dia por aqui'}</p>
        </div>
      </div>

      <div className="cli-duas">
        <section className="cli-cartao">
          <div className="cli-cartao-topo">
            <div><h2><Icone nome="recibo" width={18} height={18} />Próximas guias</h2><p>As guias de pagamento que a Nilma Contabilidade gerou para você</p></div>
            <button type="button" className="cli-link" onClick={() => vm.irPara('guias')}>Ver todas<Icone nome="seta" width={12} height={12} /></button>
          </div>
          {vm.guias.length ? (
            <ul className="cli-lista">
              {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} ocupado={vm.baixando === g.id} onBaixar={vm.baixar} />)}
            </ul>
          ) : <p className="cli-recado">Nenhuma guia por enquanto. Quando o escritório gerar, ela aparece aqui.</p>}
        </section>

        <section className="cli-cartao cli-lado">
          <div>
            <div className="cli-cartao-topo">
              <div><h2><Icone nome="usuario" width={18} height={18} />Fale com o escritório</h2><p>Dúvidas ou pedidos: é só chamar.</p></div>
            </div>
            <div className="cli-contato-caixa">
              <div className="cli-contato-quem">
                <span className="cli-avatar grande" aria-hidden="true">NC</span>
                <div><b>Equipe Nilma Contabilidade</b><span>Seu escritório de contabilidade</span></div>
              </div>
              <ul className="cli-contato">
                {c.telefone && <li><Icone nome="telefone" width={16} height={16} /><span>Telefone: <b>{c.telefone}</b></span></li>}
                {c.whatsapp && <li><Icone nome="mensagem" width={16} height={16} /><span>WhatsApp: <b>{c.whatsapp}</b></span></li>}
                {c.email && <li><Icone nome="envelope" width={16} height={16} /><span>E-mail: <b>{c.email}</b></span></li>}
              </ul>
            </div>
            {vm.atualizadoEm && <p className="hint" style={{ marginTop: 12 }}>Informações atualizadas em {formatos.dataHora(vm.atualizadoEm)}.</p>}
          </div>
          <div className="cli-cartao-pe">
            <button type="button" className="cli-btn cli-btn-marca cli-btn-largo" onClick={() => vm.irPara('chamados')}><Icone nome="aviao" width={16} height={16} />Pedir um documento ou serviço</button>
          </div>
        </section>
      </div>

      <div className="cli-duas metade">
        <section className="cli-cartao">
          <div className="cli-cartao-topo">
            <div><h2><Icone nome="calendar" width={18} height={18} />O escritório ainda está fazendo</h2><p>O que falta neste mês</p></div>
            <button type="button" className="cli-link" onClick={() => vm.irPara('agenda')}>Ver a agenda<Icone nome="seta" width={12} height={12} /></button>
          </div>
          {vm.pendencias.length ? (
            <ul className="cli-lista">{vm.pendencias.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
          ) : <p className="cli-recado">Tudo em dia por aqui.</p>}
        </section>

        <section className="cli-cartao cli-sem-recheio">
          <div className="cli-cartao-topo">
            <div><h2><Icone nome="mensagem" width={18} height={18} />Suas últimas conversas</h2><p>Os chamados com o escritório</p></div>
            <button type="button" className="cli-link" onClick={() => vm.irPara('chamados')}>Ver todas<Icone nome="seta" width={12} height={12} /></button>
          </div>
          {vm.ultimosChamados.length ? (
            <ul className="cli-chamado-lista">
              {vm.ultimosChamados.map(ch => {
                const ultima = vm.ultimaMensagem(ch);
                return (
                  <li key={ch.id}>
                    <button type="button" className="cli-chamado" onClick={() => vm.irPara('chamados')}>
                      <span className="cli-chamado-l1">
                        <b>{ch.titulo}</b>
                        <span className={'cli-selo ' + (ch.situacao === 'respondido' ? 'cli-selo-ok' : ch.situacao === 'concluido' ? '' : 'cli-selo-info')}>{vm.rotuloDaSituacao[ch.situacao]}</span>
                      </span>
                      {ultima && <span className="cli-chamado-previa">{ultima.de === 'escritorio' ? 'Escritório: ' : 'Você: '}{ultima.texto}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="cli-recado" style={{ padding: '16px 24px' }}>Você ainda não abriu nenhum chamado.</p>}
        </section>
      </div>
    </>
  );
}
