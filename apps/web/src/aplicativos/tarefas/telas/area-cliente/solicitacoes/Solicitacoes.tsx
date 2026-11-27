// Área do Cliente › Solicitações, refeita (26/11/2026: "quero que esse modulo seja completamente refeito para suportar e
// gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais bonito e de facil
// entendimento possivel"). Com as peças do nads ("essas telas… ta toda fora dos elementos predefinidos do nads"): a barra
// com o Segmentado, o filtro em menu e a busca; a tabela padrão; a linha abre a solicitação no meio da tela, na janela da
// empresa do Cadastro ("faz o chat no meio da tela"), com a situação, os passos do DP, o pedido e as respostas
// (PedidoDoChamado, sem chat: o cliente conversa pelo WhatsApp), a avaliação e a resposta — com o "Anexar arquivo" ("tem que
// ter a opcao de subir um arquivo por aqui"). Só desenha; a lógica é do useSolicitacoes.
import { areaCliente as ac } from '@nads/core';
import { Esqueleto, Icone, MenuSuspenso, Vazio, useCarregando } from '@nads/ui';
import { useRef } from 'react';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { AvisosDaArea, EmpresaDaLinha, JanelaGrande, Selo, type TomDoSelo } from '../base/Base';
import { ConversaDaSolicitacao } from '../partes/ConversaDaSolicitacao';
import { dataEHora, haQuanto, plural } from '../base/comum';
import { useSolicitacoes } from './useSolicitacoes';

/** o selo de cada situação (o mesmo da tela de antes) */
const SELO: Record<ac.SituacaoDoChamado, TomDoSelo> = { aberto: 'aviso', 'em andamento': 'neutro', respondido: 'conferido', concluido: 'ok' };

const tamanho = (b: number) => (b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB');

export function Solicitacoes() {
  const vm = useSolicitacoes();
  useCarregando(vm.carregando);
  return (
    <section>
      <AvisosDaArea exemplos={vm.exemplos} erro={vm.erro} oQue="as solicitações" />
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        {/* os filtros da barra em menu, como no DP (26/11/2026: "nao gostei desses filtros") */}
        <MenuDeFiltro rotulo="Situação" todos={'Todas (' + (vm.filtros.find(f => f.valor === 'todas')?.conta ?? 0) + ')'}
          valor={vm.filtro === 'todas' ? '' : vm.filtro} mudar={v => vm.setFiltro((v || 'todas') as typeof vm.filtro)}
          opcoes={vm.filtros.filter(f => f.valor !== 'todas').map(f => ({ valor: f.valor, rotulo: f.rotulo + ' (' + f.conta + ')' }))} />
        <MenuDeFiltro rotulo="Tipo" todos="Todos os tipos" valor={vm.tipo === 'todos' ? '' : vm.tipo} mudar={v => vm.setTipo((v || 'todos') as typeof vm.tipo)}
          opcoes={vm.tipos.filter(t => t.valor !== 'todos').map(t => ({ valor: t.valor, rotulo: t.rotulo }))} />
        <span className="tarefas-barra-espaco" />
        {vm.notaDoMes.total > 0 && (
          <span className="hint" title="A média das notas que os clientes deram nas solicitações concluídas, neste mês">
            Nota do mês: <b>{vm.notaDoMes.media.toLocaleString('pt-BR')}</b> de 5 ({plural(vm.notaDoMes.total, 'avaliação', 'avaliações')})
          </span>
        )}
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar empresa ou assunto" aria-label="Buscar solicitação" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>

      {vm.carregando ? <Esqueleto linhas={6} /> : !vm.linhas.length ? (
        vm.total && vm.temFiltro
          ? <Vazio icone="filtro" titulo="Nenhuma solicitação neste filtro" texto="Troque a situação, o tipo ou a busca."><button type="button" className="btn" onClick={vm.limparFiltros}>Ver todas</button></Vazio>
          : <Vazio icone="caixaEntrada" titulo="Nenhuma solicitação ainda" texto="Quando um cliente pedir algo pela Área do Cliente, o pedido aparece aqui." />
      ) : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Empresa</th><th>Assunto</th><th>Situação</th><th>Atualizado</th></tr></thead>
            <tbody>
              {vm.linhas.map(c => (
                <tr key={c.id} className="linha-abre" tabIndex={0} onClick={() => vm.abrir(c.id)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(c.id); }}>
                  <td className="wrap"><EmpresaDaLinha codigo={c.codigos[0]} nome={c.empresa} /></td>
                  <td className="wrap"><b>{c.titulo}</b><span className="hint" style={{ display: 'block' }}>{vm.rotuloDoTipo(c.tipo)}</span></td>
                  <td>
                    <Selo tom={SELO[c.situacao]}>{vm.rotuloDaSituacao(c.situacao)}</Selo>
                    {c.avaliacao && <span className="hint" style={{ display: 'block' }} title={'Nota do cliente: ' + c.avaliacao.nota + ' de 5'}>{vm.estrelas(c.avaliacao.nota)}</span>}
                  </td>
                  <td className="fraco" title={dataEHora(c.atualizadoEm)}>{haQuanto(c.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vm.aberto && <JanelaDaSolicitacao vm={vm} />}
    </section>
  );
}

function JanelaDaSolicitacao({ vm }: { vm: ReturnType<typeof useSolicitacoes> }) {
  const c = vm.aberto!;
  const arquivoRef = useRef<HTMLInputElement>(null);
  const passos = vm.passosDe(c);
  const folha = vm.folhaDe(c);
  const and = vm.andamento;
  return (
    <JanelaGrande codigo={c.codigos[0]} titulo={c.empresa} rotulo={'Solicitação ' + c.titulo} onFechar={vm.fechar}
      selo={<Selo tom={SELO[c.situacao]}>{vm.rotuloDaSituacao(c.situacao)}</Selo>}>
      <div className="card-head" style={{ margin: '0 0 16px', padding: 0, background: 'none', border: 0, minHeight: 0 }}>
        <h2 className="cfg-titulo" style={{ margin: 0, flex: 1 }}>{c.titulo}</h2>
        <MenuSuspenso rotulo={'Situação: ' + vm.rotuloDaSituacao(c.situacao)} className="btn btn-outline" direita dica="Mudar a situação da solicitação"
          itens={vm.situacoes.map(s => ({ rotulo: vm.rotuloDaSituacao(s), marcado: c.situacao === s, onClick: () => void vm.mudarSituacao(c.id, s) }))} />
      </div>
      <p className="hint" style={{ marginTop: -8, marginBottom: 16 }}>{vm.rotuloDoTipo(c.tipo)} · aberto em {dataEHora(c.criadoEm)}</p>

      <div className="area-pilha">
        {/* os passos do pedido do DP (23/11/2026, ficha processos-visiveis): o cliente vê só o último marcado */}
        {passos.length > 0 && (
          <div className="chip-row" style={{ margin: 0 }}>
            <span className="chip-lbl">Passos (o cliente vê o último marcado)</span>
            {passos.map((p, i) => (
              <button key={p.nome} type="button" className={'chip-f' + (p.feito ? ' on' : '')} aria-pressed={p.feito}
                title={p.feito ? 'Desmarcar este passo e os seguintes' : 'Marcar este passo (e os anteriores)'}
                onClick={() => void vm.marcarPasso(c.id, p.nome, !p.feito)}>{i + 1}. {p.nome}</button>
            ))}
          </div>
        )}

        {/* (26/11/2026: "eu tenho que ter como aprovar pelo nads") a admissão no sistema de folha (RH NET) */}
        {folha && (
          <div className="registro-busca" style={{ alignItems: 'center', gap: 12 }}>
            <Icone nome="usuario" width={16} height={16} />
            <span style={{ flex: 1, minWidth: 0 }}><b>Sistema de folha (RH NET)</b> <span className={'badge badge-' + folha.tom}>{folha.rotulo}</span><br /><span className="hint">{folha.texto}</span>
              {folha.pendencias && <><br /><span className="hint" style={{ color: "var(--bad, #c62828)" }}><b>O RH NET não liberou.</b> Falta: {folha.pendencias.replace(/[.\s]+$/, "")}. Complete no RH NET e libere de novo.</span></>}</span>
            {folha.podeApagar && <button type="button" className="btn btn-outline" disabled={folha.apagando} onClick={() => void vm.apagarNoRhNet(c)}>{folha.apagando ? 'Apagando…' : 'Apagar no RH NET'}</button>}
            {folha.podeLiberar && <button type="button" className="btn btn-primary" disabled={folha.liberando} onClick={() => void vm.liberarNaFolha(c)}>{folha.liberando ? 'Liberando…' : 'Liberar para a folha'}</button>}
          </div>
        )}

        <ConversaDaSolicitacao mensagens={c.mensagens} empresa={c.empresa} />

        {c.avaliacao && (
          <p className="hint">Avaliação do cliente: <b>{vm.estrelas(c.avaliacao.nota)}</b> {c.avaliacao.nota} de 5 ({vm.rotuloDaNota(c.avaliacao.nota)}) em {dataEHora(c.avaliacao.em)}{c.avaliacao.comentario && <> · “{c.avaliacao.comentario}”</>}</p>
        )}

        <div className="area-resposta">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="area-resposta">Resposta ao cliente</label>
            <textarea id="area-resposta" rows={3} value={vm.resposta} onChange={e => vm.setResposta(e.target.value)} disabled={vm.enviando} />
          </div>

          {vm.anexo && (
            <div className="registro-busca nf-escolhido">
              <Icone nome="clipe" width={16} height={16} />
              <span style={{ flex: 1, minWidth: 0 }}>{vm.anexo.name} <span className="hint">· {tamanho(vm.anexo.size)} · vai para Documentos › Do escritório</span></span>
              <MenuSuspenso rotulo={'Área: ' + (vm.areas.find(a => a.valor === vm.area)?.rotulo ?? '')} className="btn btn-outline" direita
                itens={vm.areas.map(a => ({ rotulo: a.rotulo, marcado: a.valor === vm.area, onClick: () => vm.setArea(a.valor as ac.AreaDoEscritorio) }))} />
              <button type="button" className="janela-x" onClick={vm.tirarAnexo} disabled={vm.enviando} aria-label={'Tirar o arquivo ' + vm.anexo.name} title="Tirar o arquivo"><Icone nome="x" width={16} height={16} /></button>
            </div>
          )}
          {and.fase === 'enviando' && <p className="hint" role="status"><span className="btn-spinner" aria-hidden="true" /> {and.texto}</p>}
          {and.fase === 'erro' && <p className="hint registro-dica-erro" role="alert">{and.texto}</p>}

          <div className="area-resposta-botoes">
            <input ref={arquivoRef} type="file" hidden onChange={e => { vm.escolherAnexo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            <button type="button" className="btn btn-outline area-esquerda" disabled={vm.enviando} onClick={() => arquivoRef.current?.click()}>
              <Icone nome="clipe" width={16} height={16} />{vm.anexo ? 'Trocar arquivo' : 'Anexar arquivo'}
            </button>
            <button type="button" className="btn" disabled={!vm.podeResponder} onClick={() => void vm.responder()}><Icone nome="aviao" width={16} height={16} />Responder</button>
            <button type="button" className="btn btn-primary" disabled={!vm.podeResponder} onClick={() => void vm.responder(true)}>
              {vm.enviando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" width={16} height={16} />}Responder e concluir
            </button>
          </div>
        </div>
      </div>
    </JanelaGrande>
  );
}
