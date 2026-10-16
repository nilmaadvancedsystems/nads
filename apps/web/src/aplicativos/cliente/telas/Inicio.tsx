// O Início da Área do Cliente (Vitor, 16/10/2026): o resumo do mês, em português simples — o que pagar, o que o escritório
// ainda está fazendo, as últimas conversas e como falar com a gente.
import { formatos } from '@nads/core';
import { Icone, Stat } from '@nads/ui';
import { CartaoDeGuia } from '../partes/CartaoDeGuia';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { useInicio } from './useInicio';
import type { DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca) {
  const vm = useInicio(props);
  const c = vm.contato;
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Guias para pagar" valor={vm.totalDeGuias} />
        <Stat rotulo="Valor total" valor={formatos.reais(vm.valorEmAberto)} />
        <Stat rotulo="Em atraso" valor={vm.vencidas} cor={vm.vencidas ? 'entrada' : undefined} />
        <Stat rotulo="O escritório ainda faz" valor={vm.pendencias.length} />
      </div>

      <section className="card">
        <h3>Próximas guias</h3>
        {vm.guias.length ? (
          <div className="cli-grade">
            {vm.guias.map(g => <CartaoDeGuia key={g.id} guia={g} ocupado={vm.baixando === g.id} onBaixar={vm.baixar} />)}
          </div>
        ) : <p className="hint">Nenhuma guia por enquanto. Quando o escritório gerar, ela aparece aqui.</p>}
        {vm.totalDeGuias > vm.guias.length && (
          <div className="btn-row"><button type="button" className="btn" onClick={() => vm.irPara('guias')}>Ver todas as guias</button></div>
        )}
      </section>

      <section className="card">
        <h3>O que o escritório ainda está fazendo neste mês</h3>
        {vm.pendencias.length ? (
          <ul className="cli-lista">{vm.pendencias.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
        ) : <p className="hint">Tudo em dia por aqui.</p>}
        <div className="btn-row"><button type="button" className="btn" onClick={() => vm.irPara('agenda')}>Ver a agenda do mês</button></div>
      </section>

      <section className="card">
        <h3>Suas últimas conversas</h3>
        {vm.ultimosChamados.length ? (
          <ul className="cli-lista">
            {vm.ultimosChamados.map(ch => (
              <li key={ch.id} className="cli-item-chamado">
                <Icone nome="mensagem" width={16} height={16} />
                <span><b>{ch.titulo}</b></span>
                <span className="badge badge-neutral">{vm.rotuloDaSituacao[ch.situacao]}</span>
              </li>
            ))}
          </ul>
        ) : <p className="hint">Você ainda não abriu nenhum chamado.</p>}
        <div className="btn-row"><button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Abrir um chamado</button></div>
      </section>

      <section className="card">
        <h3>Fale com o escritório</h3>
        <ul className="cli-contato">
          {c.telefone && <li><Icone nome="clock" width={16} height={16} /><span>Telefone: <b>{c.telefone}</b></span></li>}
          {c.whatsapp && <li><Icone nome="mensagem" width={16} height={16} /><span>WhatsApp: <b>{c.whatsapp}</b></span></li>}
          {c.email && <li><Icone nome="envelope" width={16} height={16} /><span>E-mail: <b>{c.email}</b></span></li>}
        </ul>
        {vm.atualizadoEm && <p className="hint">Informações atualizadas em {formatos.dataHora(vm.atualizadoEm)}.</p>}
      </section>
    </>
  );
}
