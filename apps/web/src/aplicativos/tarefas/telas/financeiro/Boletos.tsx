// Financeiro › Boletos (10/11/2026): o lote de boletos de honorários do mês. Os PDFs prontos sobem aqui; cada linha mostra o
// cliente, o valor e o vencimento do PDF, para quem vai e a situação (com o motivo, quando trava ou deu erro). Só um Diretor dispara.
import { financeiro, formatos } from '@nads/core';
import { BotaoAcao, CampoArquivos, Icone, MenuSuspenso, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { useState } from 'react';
import { dataBr } from './formatosDaNota';
import { JanelaDosContratos } from './JanelaDosContratos';
import { JanelaDoBoleto } from './JanelaDoBoleto';
import { CLASSE_DA_SITUACAO, FILTROS_DO_LOTE, useLoteDeBoletos, type LinhaDoLote } from './useLoteDeBoletos';

/** o motivo embaixo do nome: o erro do envio, o que trava, o aviso e, sem nada disso, o nome do arquivo */
function Motivo({ l }: { l: LinhaDoLote }) {
  const erro = l.boleto.envio?.status === 'erro' ? l.boleto.envio.erro : '';
  const trava = erro || l.conferencia.pendencias[0];
  const mais = l.conferencia.pendencias.length + l.conferencia.avisos.length - 1;
  if (trava) return <span className="fgts-pedido-erro fin-corta" title={[erro, ...l.conferencia.pendencias].filter(Boolean).join('\n')}>{trava}</span>;
  if (l.conferencia.avisos[0]) return <span className="fraco fin-corta" title={l.conferencia.avisos.join('\n')}>{l.conferencia.avisos[0]}{mais > 0 ? ` (+${mais})` : ''}</span>;
  return <span className="fraco fin-corta" title={l.boleto.arquivo}>{l.boleto.arquivo}</span>;
}

export function Boletos() {
  const vm = useLoteDeBoletos();
  // a janela Clientes dos honorários (o valor e o dia do vencimento): Honorários saiu do menu em 30/10/2026
  const [gerenciando, setGerenciando] = useState(false);
  useCarregando(vm.carregando);
  const r = vm.resumo;
  const numeros = [
    { rotulo: 'No lote', valor: String(r.total), tom: 'neutro', icone: 'briefcase' },
    { rotulo: 'Prontos', valor: String(r.prontos), tom: 'ok', icone: 'check' },
    { rotulo: 'Pendentes', valor: String(r.pendentes), tom: 'aviso', icone: 'alert' },
    { rotulo: 'A disparar', valor: formatos.reais(r.aDisparar), tom: 'info', icone: 'dinheiro' },
  ] as const;
  const quantos = vm.quantasMarcadas || vm.quantasProntas;
  const dicaDoDisparo = !vm.podeDisparar ? 'Só um Diretor pode disparar' : vm.quantasMarcadas ? 'Dispara os boletos marcados' : 'Dispara todos os boletos prontos';
  return (
    <section>
      {vm.aberta && <JanelaDoBoleto vm={vm} linha={vm.aberta} />}
      {gerenciando && <JanelaDosContratos fechar={() => setGerenciando(false)} />}

      <div className="tarefas-barra-topo fin-barra">
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <Segmentado valor={vm.filtro} opcoes={FILTROS_DO_LOTE} onMudar={vm.setFiltro} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente, arquivo ou e-mail" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {vm.lendo && <span className="fraco">{vm.lendo.gravando ? 'Gravando' : 'Lendo'} {vm.lendo.feitos} de {vm.lendo.total}…</span>}
        <MenuSuspenso rotulo="Mais" titulo="O valor e o dia do vencimento de cada cliente" direita largura={240}
          itens={[{ rotulo: 'Gerenciar clientes', icone: 'briefcase', onClick: () => setGerenciando(true) }]} />
        {vm.temLinhas && <CampoArquivos id="boletos-subir" compacto aceitar=".pdf" rotulo="Subir mais boletos (PDF)" desabilitado={!!vm.lendo} onEscolher={fs => void vm.subir(fs)} />}
        <span title={dicaDoDisparo}>
          <BotaoAcao carregando={vm.disparando} textoCarregando="Pedindo…" disabled={!vm.podeDisparar || !quantos} onClick={() => void vm.disparar()}>
            <Icone nome="aviao" />Disparar{quantos ? ' · ' + quantos : ''}
          </BotaoAcao>
        </span>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      <div className="stat-grid dp-numeros fin-numeros">
        {numeros.map(n => (
          <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
            <p className="stat-label">{n.rotulo}</p>
            <p className="stat-value num">{n.valor}</p>
          </div>
        ))}
      </div>

      {!vm.carregando && !vm.temLinhas ? (
        <div className="card">
          <Vazio icone="recibo" titulo={'Nenhum boleto de ' + financeiro.competenciaBr(vm.competencia)}>
            <CampoArquivos id="boletos-subir" aceitar=".pdf" rotulo={vm.lendo ? `${vm.lendo.gravando ? 'Gravando' : 'Lendo'} ${vm.lendo.feitos} de ${vm.lendo.total}…` : 'Escolher os boletos (PDF)'} desabilitado={!!vm.lendo} onEscolher={fs => void vm.subir(fs)} />
          </Vazio>
        </div>
      ) : !vm.carregando && !vm.linhas.length ? (
        <Vazio icone="recibo" titulo="Nenhum boleto com isso">
          <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar a busca e o filtro</button>
        </Vazio>
      ) : (
        <div className="table-wrap">
          <table className="dp-tabela fgts-tabela">
            <thead>
              <tr>
                <th className="fgts-marca"><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarTodas(e.target.checked)} aria-label="Marcar todos os prontos" title="Marcar todos os prontos da tela" /></th>
                <th>Cód.</th><th>Cliente</th><th className="fin-direita">Valor</th><th>Vencimento</th><th>Para</th><th>Situação</th><th />
              </tr>
            </thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(l => {
                const b = l.boleto, c = l.conferencia;
                return (
                  <tr key={b.id} className={'dp-linha' + (c.situacao === 'enviado' ? ' feita' : '')}>
                    <td className="fgts-marca"><input type="checkbox" checked={vm.marcada(b.id)} disabled={!c.podeDisparar} onChange={() => vm.alternar(b.id)} aria-label={'Marcar ' + (l.contrato?.nome || b.arquivo)} /></td>
                    <td><span className="emp-cod">{l.contrato?.codigo || '—'}</span></td>
                    <td className="dp-cliente">
                      <span className="dp-cliente-nome" title={l.contrato?.nome}>{l.contrato?.nome || 'Sem cliente'}</span>
                      <Motivo l={l} />
                    </td>
                    <td className="fin-direita num">{b.valor == null ? '—' : formatos.reais(b.valor)}</td>
                    <td className="num">{b.vencimento ? dataBr(b.vencimento) : '—'}</td>
                    <td><span className="fin-corta" title={b.destinatarios.join(', ')}>{b.destinatarios[0] || '—'}{b.destinatarios.length > 1 ? ` +${b.destinatarios.length - 1}` : ''}</span></td>
                    <td><span className={CLASSE_DA_SITUACAO[c.situacao]}>{financeiro.ROTULO_DA_SITUACAO_DO_BOLETO[c.situacao]}</span></td>
                    <td className="fin-direita"><button type="button" className="btn btn-outline" onClick={() => vm.abrir(b.id)}>Revisar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
