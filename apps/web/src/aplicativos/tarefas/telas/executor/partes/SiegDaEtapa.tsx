// O painel do SIEG dentro do checklist da etapa do Fiscal: na Inicial, as notas do mês (emitidas e recebidas, por tipo);
// na Conferência de Saídas, a sequência (série por série: da primeira à última, os números que faltam e as canceladas),
// com o Baixar do SIEG (o robô do PC baixa as saídas do mês) e o Atualizar.
import { BotaoAcao, Icone } from '@nads/ui';
import { createPortal } from 'react-dom';
import { useSiegDaEtapa } from '../useSiegDaEtapa';

export function SiegDaEtapa({ tipo, codigo, competencia }: { tipo: 'contagem' | 'saidas'; codigo: string; competencia: string }) {
  const vm = useSiegDaEtapa(tipo, codigo, competencia);
  return (
    <section className="sieg-painel">
      <header className="sieg-topo">
        <b>SIEG</b>
        {vm.exemplos && <span className="fraco">dados de exemplo</span>}
        {vm.desligado && <span className="sieg-aviso"><Icone nome="alert" />{vm.desligado}</span>}
      </header>
      {/* o andamento do "Contar agora", flutuando no canto (fica no body: a faixa animada prenderia o fixo) */}
      {vm.andamento && createPortal(
        <div className="card gmail-andamento sieg-flutuante" role="status" aria-live="polite">
          <div className="gmail-andamento-topo">
            <b>{vm.andamento.erro ? vm.andamento.tituloDoErro : vm.andamento.titulo}</b>
            <span className="fraco">{vm.andamento.erro ? '' : vm.andamento.pct + '%'}</span>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-ghost" onClick={vm.fecharAndamento} aria-label="Fechar" title="Fechar"><Icone nome="x" /></button>
          </div>
          {!vm.andamento.erro && <span className={'tarefas-barra larga' + (vm.andamento.pronto ? '' : ' andando')}><span style={{ width: vm.andamento.pct + '%' }} /></span>}
          {vm.andamento.erro ? <p className="sieg-aviso" style={{ marginTop: 8 }}><Icone nome="alert" />{vm.andamento.erro}</p> : (
            <ul className="gmail-andamento-passos">
              {vm.andamento.passos.map(p => <li key={p.texto} className={p.atual || p.feito ? 'destaque' : undefined}>{p.feito ? '✓ ' : p.atual ? '… ' : ''}{p.texto}</li>)}
            </ul>
          )}
          {vm.andamento.detalhe && <p className="hint" style={{ margin: '8px 0 0' }}>{vm.andamento.detalhe}</p>}
          {vm.andamento.resultado && <p className="hint" style={{ margin: '8px 0 0' }}>{vm.andamento.resultado}</p>}
          {vm.andamento.xmls && vm.zip && (
            <div className="sieg-acoes" style={{ marginTop: 8 }}>
              <BotaoAcao className="btn btn-outline" carregando={vm.baixandoZip} textoCarregando="Baixando…" onClick={() => { void vm.baixarZip(); }}><Icone nome="download" />Baixar o .zip ({vm.zip.tamanho})</BotaoAcao>
            </div>
          )}
        </div>,
        document.body,
      )}
      {vm.tipo === 'contagem' ? (
        <>{!vm.contagemCarregada ? <p className="fraco">Carregando…</p> : vm.contagem ? (
          <div className="sieg-contagem">
            <div className={'sieg-numero' + (vm.contagem.emitidas === 0 ? ' zero' : '')}><b>{vm.contagem.emitidas}</b><span>emitidas</span>
              <small>{vm.contagem.linhasEmitidas.map(l => l.rotulo + ' ' + l.n).join(' · ') || 'nenhuma'}</small></div>
            <div className={'sieg-numero' + (vm.contagem.recebidas === 0 ? ' zero' : '')}><b>{vm.contagem.recebidas}</b><span>recebidas</span>
              <small>{vm.contagem.linhasRecebidas.map(l => l.rotulo + ' ' + l.n).join(' · ') || 'nenhuma'}</small></div>
            <p className="fraco sieg-quando">Contadas no SIEG em {vm.contagem.quando}.{vm.contagem.emitidas === 0 ? ' Nenhuma nota emitida: confira o certificado e a captura no SIEG.' : ''}</p>
            {/* contar de novo, na hora (07/10/2026: "tem como ter um botão para puxar na hora?") */}
            <div className="sieg-acoes">
              <BotaoAcao className="btn btn-outline" carregando={vm.contando} textoCarregando="Contando…" onClick={() => { void vm.contar(); }}><Icone nome="girar" />Contar de novo</BotaoAcao>
              <BotaoAcao className="btn btn-primary" carregando={vm.baixandoXmls} textoCarregando="Baixando…" onClick={() => { void vm.baixarXmls(); }}><Icone nome="download" />Baixar XMLs do SIEG</BotaoAcao>
            </div>
          </div>
        ) : (
          <div className="sieg-acoes">
            <p className="fraco" style={{ margin: 0, flex: 1 }}>O SIEG ainda não contou as notas deste mês (a contagem roda de madrugada).</p>
            <BotaoAcao className="btn btn-outline" carregando={vm.contando} textoCarregando="Contando…" onClick={() => { void vm.contar(); }}><Icone nome="girar" />Contar agora</BotaoAcao>
            <BotaoAcao className="btn btn-primary" carregando={vm.baixandoXmls} textoCarregando="Baixando…" onClick={() => { void vm.baixarXmls(); }}><Icone nome="download" />Baixar XMLs do SIEG</BotaoAcao>
          </div>
        )}
        {vm.erroDaContagem && <p className="fraco sieg-aviso"><Icone nome="alert" />A contagem não deu certo: {vm.erroDaContagem}</p>}
        {/* o último "Baixar XMLs do SIEG" (07/10/2026): quantos e onde estão */}
        {vm.xmls && <p className="hint" style={{ margin: '8px 0 0' }}><Icone nome="checkCircle" /> {vm.xmls.arquivos} XMLs baixados em {vm.xmls.quando} ({vm.xmls.emitidas} notas emitidas, {vm.xmls.recebidas} recebidas) · {vm.xmls.pasta}</p>}</>
      ) : (
        <>
          {vm.saidas ? (
            <div className="sieg-saidas">
              <div className={'sieg-resumo' + (vm.saidas.ok ? ' ok' : ' falta')}>
                <Icone nome={vm.saidas.ok ? 'checkCircle' : 'alert'} />
                <b>{vm.saidas.ok ? 'Sequência completa' : vm.saidas.faltando + (vm.saidas.faltando === 1 ? ' número faltando' : ' números faltando')}</b>
                <span className="fraco">{vm.saidas.autorizadas} {vm.saidas.autorizadas === 1 ? 'autorizada' : 'autorizadas'} · {vm.saidas.canceladas} {vm.saidas.canceladas === 1 ? 'cancelada' : 'canceladas'} · {vm.saidas.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <ul className="sieg-series">
                {vm.saidas.series.map(s => (
                  <li key={s.rotulo}>
                    <span className="sieg-serie-nome">{s.rotulo}</span>
                    <span className="fraco">{s.primeira} a {s.ultima}</span>
                    {s.faltando.length > 0 && <span className="sieg-falta">Faltam: {s.faltandoTexto}</span>}
                    {s.canceladas.length > 0 && <span className="fraco">Canceladas: {s.canceladasTexto}</span>}
                  </li>
                ))}
              </ul>
              <p className="fraco sieg-quando">Baixadas do SIEG em {vm.saidas.quando}. O número que falta pode ser nota não enviada ao SIEG, inutilizada ou emitida fora.</p>
            </div>
          ) : vm.saidasCarregadas ? <p className="fraco">As saídas deste mês ainda não foram baixadas do SIEG.</p> : <p className="fraco">Carregando…</p>}
          {vm.pedido?.status === 'erro' && <p className="sieg-aviso"><Icone nome="alert" />O robô não conseguiu: {vm.pedido.erro}</p>}
          <div className="sieg-acoes">
            <button type="button" className="btn btn-outline" disabled={vm.pedindo || !!vm.desligado} onClick={() => void vm.baixar()}>
              {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="download" />}
              {vm.pedindo ? (vm.pedido?.andamento || 'Baixando do SIEG…') : vm.saidas ? 'Atualizar do SIEG' : 'Baixar as saídas do SIEG'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
