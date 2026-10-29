// DP › Envios › Lote (28/10/2026: "uma opção onde eu subo um lote de arquivos, esses arquivos são lidos e organizados para
// dispará-los em lote, após a disparada eles salvam no drive e alimentam o sistema com valores de folha, fgts etc"): a janela
// do lote, aberta pelo botão "Subir lote" do Envios. "Subir lote": a caixa de escolher os arquivos. "Lote": a leitura do robô
// (o andamento), a revisão (um cartão por cliente e competência, com os arquivos, o tipo e o valor que o robô leu; os não
// identificados com o cliente, o tipo e a competência para escolher, ou Tirar do lote) e o Disparar (um e-mail por cliente;
// depois, o resultado de cada um: enviado para quem, gravado em que pasta do Drive, ou o erro).
import { BotaoAcao, CampoArquivos, Esqueleto, Icone, MenuSuspenso, SeletorMes } from '@nads/ui';
import { useState } from 'react';
import type { ArquivoDoLote } from '../../dados/loteDp';
import { JanelaLateral } from '../janela/JanelaLateral';
import { efetivo, ROTULO_DO_VALOR, TIPOS_DO_LOTE, useLoteDoDp, type VmLoteDoDp } from './useLoteDoDp';

const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const mesAno = (c: string) => (c ? c.slice(5) + '/' + c.slice(0, 4) : '—');
const reais = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ROTULO_DO_TIPO: Record<string, string> = { FGTS: 'FGTS', DARF: 'DARF', FOLHA: 'Folha', 'PRO-LABORE': 'Pró-labore', OUTRO: 'Outro' };
const STATUS_DO_LOTE: Record<string, { classe: string; rotulo: string }> = {
  enviando: { classe: 'badge badge-warn', rotulo: 'Subindo' }, pendente: { classe: 'badge badge-neutral', rotulo: 'Na fila do robô' },
  lendo: { classe: 'badge badge-warn', rotulo: 'Lendo' }, lido: { classe: 'badge badge-neutral', rotulo: 'Pronto para revisar' },
  disparar: { classe: 'badge badge-warn', rotulo: 'Na fila para disparar' }, disparando: { classe: 'badge badge-warn', rotulo: 'Disparando' },
  disparado: { classe: 'badge badge-ok', rotulo: 'Disparado' }, erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
};

/** escolher o cliente na lista do DP, com a busca (o mesmo menu do Creditor) */
function MenuDeCliente({ vm, arquivo }: { vm: VmLoteDoDp; arquivo: ArquivoDoLote }) {
  const [busca, setBusca] = useState('');
  const x = efetivo(arquivo);
  const atual = x.codigo != null ? vm.clientes.find(c => c.codigo === x.codigo) : null;
  const q = busca.trim().toLowerCase();
  const achados = (q ? vm.clientes.filter(c => (c.codigo + ' ' + c.nome).toLowerCase().includes(q)) : vm.clientes).slice(0, 60);
  return (
    <MenuSuspenso rotulo={atual ? atual.codigo + ' · ' + atual.nome : 'Escolher o cliente'} className={'btn btn-outline dp-lote-cliente' + (atual ? '' : ' ativo')} largura={340} dica="O cliente do arquivo"
      conteudo={fechar => (
        <>
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente" value={busca} autoFocus onChange={e => setBusca(e.target.value)} />
          </label>
          {achados.map(c => (
            <button key={c.codigo} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); setBusca(''); void vm.escolher(arquivo, { cliente: c.codigo }); }}>
              <span className="popover-texto"><b>{c.codigo}</b><br /><span className="hint">{c.nome}</span></span>
            </button>
          ))}
          {!achados.length && <p className="hint">Nenhum cliente com essa busca.</p>}
        </>
      )} />
  );
}

/** a linha de um arquivo na revisão: o tipo, o nome, o valor da guia e, se ainda pode mudar, o "Tirar" */
function LinhaDoArquivo({ vm, a, mexe }: { vm: VmLoteDoDp; a: ArquivoDoLote; mexe: boolean }) {
  const x = efetivo(a);
  const l = a.leitura;
  return (
    <li className="dp-lote-arquivo">
      <span className="badge badge-neutral">{ROTULO_DO_TIPO[x.tipo] || x.tipo || '?'}</span>
      <span className="dp-lote-nome" title={a.nome}>{l?.nomeFinal || a.nome}</span>
      {l?.valor && !x.escolhido && <span className="num fraco">{l.valor.replace('R$', 'R$ ')}{l.vencimento ? ' · vence ' + l.vencimento.replace(/-/g, '/') : ''}</span>}
      {x.escolhido && <span className="fraco">escolhido à mão</span>}
      {mexe && <button type="button" className="link-btn" onClick={() => void vm.tirar(a, true)}>Tirar</button>}
    </li>
  );
}

export function JanelaDoLote({ fechar }: { fechar: () => void }) {
  const vm = useLoteDoDp();
  const [topico, setTopico] = useState<'lote' | 'novo'>(vm.lotes.length ? 'lote' : 'novo');
  const lote = vm.atual;
  const s = lote ? STATUS_DO_LOTE[lote.status] || { classe: 'badge badge-neutral', rotulo: lote.status } : null;
  // depois de disparado, ainda dá para corrigir quem deu erro e disparar de novo (o robô pula quem já recebeu)
  const mexe = !!lote && (lote.status === 'lido' || lote.status === 'disparado');
  const andando = !!lote && ['enviando', 'pendente', 'lendo', 'disparar', 'disparando'].includes(lote.status);
  return (
    <JanelaLateral rotulo="Lote do DP" topico={topico} mudar={setTopico} fechar={fechar} classe="fgts-janela"
      topicos={[
        { id: 'lote', rotulo: 'Lote', icone: 'clipe', contador: lote ? lote.total : 0 },
        { id: 'novo', rotulo: 'Subir lote', icone: 'upload' },
      ]}
      resumo={<div className="usuario-quem"><b>DP › Envios</b>{lote && <span className="fraco">lote de {hora(lote.criadoEm)}</span>}</div>}>
      {topico === 'novo' ? (
        <div className="card">
          <h3>Subir um lote</h3>
          <p className="hint dp-lote-texto">Escolha as guias (FGTS, DARF) e os relatórios da folha de vários clientes de uma vez. O robô lê cada arquivo e
            separa por cliente e competência; você revisa e dispara. Depois do disparo, cada arquivo vai para a pasta do cliente no Drive.</p>
          <div className="dp-lote-subir">
            {vm.subindo
              ? <p className="hint">Subindo {vm.subindo.feitos} de {vm.subindo.total}…</p>
              : <CampoArquivos id="dp-lote-arquivos" aceitar=".pdf" rotulo="Escolher os arquivos (PDF)" onEscolher={fs => { void vm.subir(fs).then(() => setTopico('lote')); }} />}
          </div>
        </div>
      ) : vm.carregando ? <Esqueleto linhas={4} /> : !lote ? (
        <div className="card"><p className="hint dp-lote-texto">Nenhum lote ainda. Em "Subir lote", escolha os arquivos.</p></div>
      ) : (
        <>
          <div className="card">
            <div className="dp-lote-topo">
              <h3>Lote de {hora(lote.criadoEm)}</h3>
              {s && <span className={s.classe}>{s.rotulo}</span>}
              <span className="tarefas-barra-espaco" />
              {vm.lotes.length > 1 && (
                <MenuSuspenso rotulo="Outros lotes" className="btn btn-ghost" titulo="Lotes" direita
                  itens={vm.lotes.slice(0, 10).map(l => ({ rotulo: hora(l.criadoEm) + ' · ' + l.total + ' arquivos · ' + (STATUS_DO_LOTE[l.status]?.rotulo || l.status), marcado: l.id === lote.id, onClick: () => vm.escolherLote(l.id) }))} />
              )}
              {mexe && (
                <BotaoAcao carregando={vm.disparando} textoCarregando="Pedindo…" disabled={!vm.paraDisparar} onClick={() => void vm.disparar()}>
                  <Icone nome="aviao" />Disparar{vm.paraDisparar ? ' · ' + vm.paraDisparar + (vm.paraDisparar === 1 ? ' cliente' : ' clientes') : ''}
                </BotaoAcao>
              )}
            </div>
            {andando && (
              <span className="tarefas-barra fgts-barra dp-lote-barra" role="progressbar" aria-valuemin={0} aria-valuemax={lote.total} aria-valuenow={lote.lidos} aria-label="Arquivos lidos">
                <span style={{ width: (lote.status === 'lendo' ? Math.max(5, (lote.lidos / Math.max(1, lote.total)) * 100) : lote.status === 'pendente' ? 3 : 100) + '%' }} />
              </span>
            )}
            {lote.erro && <p className="fgts-pedido-erro dp-lote-texto">{lote.erro}</p>}
            {!andando && <p className="hint dp-lote-texto">{vm.grupos.length} {vm.grupos.length === 1 ? 'cliente' : 'clientes'} · {vm.faltam.length} sem cliente · {vm.tirados.length} {vm.tirados.length === 1 ? 'tirado' : 'tirados'}{vm.comErro.length ? ' · ' + vm.comErro.length + ' não lidos' : ''}</p>}
          </div>

          {vm.faltam.length > 0 && (
            <div className="card">
              <h3>Sem cliente · {vm.faltam.length}</h3>
              <ul className="dp-lote-lista">
                {vm.faltam.map(a => {
                  const x = efetivo(a);
                  return (
                    <li key={a.id} className="dp-lote-falta">
                      <div className="dp-lote-falta-nome"><b title={a.nome}>{a.nome}</b><span className="fraco">{a.leitura?.semTexto ? 'PDF sem texto (escaneado)' : 'o leitor não reconheceu'}</span></div>
                      {mexe && (
                        <div className="dp-lote-falta-campos">
                          <MenuDeCliente vm={vm} arquivo={a} />
                          <MenuSuspenso rotulo={'Tipo: ' + (ROTULO_DO_TIPO[x.tipo] || 'escolher')} className="btn btn-outline" titulo="Tipo"
                            itens={TIPOS_DO_LOTE.map(o => ({ rotulo: o.rotulo, marcado: x.tipo === o.valor, onClick: () => void vm.escolher(a, { tipo: o.valor }) }))} />
                          <SeletorMes valor={x.competencia || vm.competenciaDoLote} onMudar={c => void vm.escolher(a, { competencia: c })} rotulo="Competência" />
                          <button type="button" className="link-btn" onClick={() => void vm.tirar(a, true)}>Tirar</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {vm.grupos.map(g => {
            const r = g.resultado;
            return (
              <div key={g.chave} className="card">
                <div className="dp-lote-topo">
                  <h3><span className="num fraco">{g.codigo}</span> {g.nome || 'Cliente ' + g.codigo} · {mesAno(g.competencia)}</h3>
                  {r ? <span className={r.status === 'enviado' ? 'badge badge-ok' : 'badge badge-parada'}>{r.status === 'enviado' ? 'Enviado' : 'Não deu'}</span>
                    : !g.email ? <span className="badge badge-parada">Sem e-mail</span> : null}
                </div>
                <p className="fraco dp-lote-texto">Para: {r?.para.length ? r.para.join(', ') : g.email || 'sem e-mail no cadastro'}</p>
                <ul className="dp-lote-lista">
                  {g.arquivos.map(a => <LinhaDoArquivo key={a.id} vm={vm} a={a} mexe={mexe && r?.status !== 'enviado'} />)}
                </ul>
                {r?.status === 'erro' && <p className="fgts-pedido-erro dp-lote-texto">{r.erro}</p>}
                {r?.status === 'enviado' && (
                  <div className="dp-lote-texto">
                    {Object.keys(r.valores).length > 0 && <p className="fraco">No sistema: {Object.entries(r.valores).map(([k, v]) => (ROTULO_DO_VALOR[k] || k) + ' ' + reais(v)).join(' · ')}</p>}
                    <ul className="dp-envio-historico-arquivos">
                      {r.salvos.map(sv => <li key={sv.nome + sv.pasta}><Icone nome={sv.erro ? 'alert' : 'pasta'} />{sv.erro ? sv.nome + ': ' + sv.erro : (sv.jaEstava ? 'já estava em ' : 'gravado em ') + sv.pasta}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

          {(vm.tirados.length > 0 || vm.comErro.length > 0) && (
            <div className="card">
              <h3>Fora do lote</h3>
              <ul className="dp-lote-lista">
                {vm.tirados.map(a => (
                  <li key={a.id} className="dp-lote-arquivo">
                    <span className="dp-lote-nome" title={a.nome}>{a.nome}</span>
                    {mexe && <button type="button" className="link-btn" onClick={() => void vm.tirar(a, false)}>Pôr de volta</button>}
                  </li>
                ))}
                {vm.comErro.map(a => (
                  <li key={a.id} className="dp-lote-arquivo">
                    <span className="dp-lote-nome" title={a.nome}>{a.nome}</span>
                    <span className="fgts-pedido-erro">{a.erro || 'não deu para ler'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </JanelaLateral>
  );
}
