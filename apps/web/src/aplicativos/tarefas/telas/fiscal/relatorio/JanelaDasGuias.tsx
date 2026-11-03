// Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp, ele sobe o
// arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"): a janela
// do lote de guias, aberta pelo botão "Enviar guias" do Relatório, nas peças da janela do lote do DP (dp/JanelaDoLote.tsx).
// Refeita em 04/11/2026 ("Precisa ter uma aba de enviados e uma aba de 'para enviar' para nao misturar, a ui ta bem
// confusa também"): três abas só. "Para enviar": subir as guias em cima e, embaixo, o lote aberto em passos (o que precisa
// de você, os clientes prontos e o Disparar), sem os já enviados. "Enviados": os e-mails que saíram na competência da
// apuração (o registro do robô; fica mesmo depois que o lote some). "Modelo do e-mail": o assunto e o texto
// (config/envioFiscal), como o do DP › Envios.
import { BotaoAcao, CampoArquivos, ConfigLinha, ConfigSecao, Esqueleto, Icone, MenuSuspenso, SeletorMes } from '@nads/ui';
import { useState } from 'react';
import type { GuiaDoLote } from '../../../dados/loteFiscal';
import { JanelaLateral } from '../../janela/JanelaLateral';
import { efetivoDaGuia, useEnvioDeGuias, type VmEnvioDeGuias } from './useEnvioDeGuias';
import type { RegimeDoRelatorio } from './useRelatorioGeral';

const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const mesAno = (c: string) => (c ? c.slice(5) + '/' + c.slice(0, 4) : '—');
const STATUS_DO_LOTE: Record<string, { classe: string; rotulo: string }> = {
  enviando: { classe: 'badge badge-warn', rotulo: 'Subindo' }, pendente: { classe: 'badge badge-neutral', rotulo: 'Na fila do robô' },
  lendo: { classe: 'badge badge-warn', rotulo: 'Lendo' }, lido: { classe: 'badge badge-neutral', rotulo: 'Pronto para conferir' },
  disparar: { classe: 'badge badge-warn', rotulo: 'Na fila para disparar' }, disparando: { classe: 'badge badge-warn', rotulo: 'Disparando' },
  disparado: { classe: 'badge badge-parada', rotulo: 'Faltou alguém' }, erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
};
/** o tipo da guia como no nome do arquivador: "DAS", "DARF PIS", "DAE ICMS" */
const tipoDaGuia = (a: GuiaDoLote) => [a.leitura?.tipo, a.leitura?.tributo].filter(Boolean).join(' ') || '?';

/** escolher o cliente na lista do escritório, com a busca (o mesmo menu do lote do DP) */
function MenuDeCliente({ vm, arquivo }: { vm: VmEnvioDeGuias; arquivo: GuiaDoLote }) {
  const [busca, setBusca] = useState('');
  const x = efetivoDaGuia(arquivo, vm.grupo.id);
  const atual = x.codigo != null ? vm.clientes.find(c => c.codigo === x.codigo) : null;
  const q = busca.trim().toLowerCase();
  const achados = (q ? vm.clientes.filter(c => (c.codigo + ' ' + c.nome).toLowerCase().includes(q)) : vm.clientes).slice(0, 60);
  return (
    <MenuSuspenso rotulo={atual ? atual.codigo + ' · ' + atual.nome : 'Escolher o cliente'} className={'btn btn-outline dp-lote-cliente' + (atual ? '' : ' ativo')} largura={340} dica="O cliente da guia"
      conteudo={fechar => (
        <>
          <label className="busca-curta">
            <Icone nome="search" width={16} height={16} />
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

/** a coluna do Relatório que a guia preenche (ou "sem coluna"), para trocar */
function MenuDeColuna({ vm, arquivo, compacto }: { vm: VmEnvioDeGuias; arquivo: GuiaDoLote; compacto?: boolean }) {
  const atual = efetivoDaGuia(arquivo, vm.grupo.id).coluna;
  return (
    <MenuSuspenso rotulo={atual ? 'Coluna: ' + vm.rotuloDaColuna(atual) : 'Sem coluna'} className={compacto ? 'btn btn-ghost btn-sm' : 'btn btn-outline'} titulo="Coluna do Relatório" compacto={compacto} flutuante direita
      dica="A coluna do Relatório que recebe o valor desta guia"
      itens={vm.colunas.map(c => ({ rotulo: c.rotulo, marcado: c.valor === atual, onClick: () => void vm.escolher(arquivo, { coluna: c.valor }) }))} />
  );
}

/** a linha de uma guia na conferência: o tipo, o nome, o valor e, se ainda pode mudar, a coluna e o "Tirar" */
function LinhaDaGuia({ vm, a, mexe }: { vm: VmEnvioDeGuias; a: GuiaDoLote; mexe: boolean }) {
  const l = a.leitura;
  const r = vm.noRelatorio(a);
  return (
    <li className="dp-lote-arquivo">
      <span className="badge badge-neutral">{tipoDaGuia(a)}</span>
      <span className="dp-lote-nome" title={a.nome}>{l?.nomeFinal || a.nome}</span>
      <span className="num fraco">{r.valor ? 'R$ ' + r.valor : 'sem valor lido'}{l?.vencimento ? ' · vence ' + l.vencimento.replace(/-/g, '/') : ''}</span>
      {mexe ? <MenuDeColuna vm={vm} arquivo={a} compacto /> : <span className="fraco">{r.coluna ? '→ ' + r.coluna : 'sem coluna'}</span>}
      {mexe && <button type="button" className="link-btn" onClick={() => void vm.tirar(a, true)}>Tirar</button>}
    </li>
  );
}

/** "Enviados": os e-mails de guias que saíram na apuração escolhida */
function Enviados({ vm }: { vm: VmEnvioDeGuias }) {
  return (
    <div className="card">
      <div className="dp-lote-topo">
        <h3>Enviados{vm.enviados.length ? ' · ' + vm.enviados.length : ''}</h3>
        <span className="tarefas-barra-espaco" />
        <SeletorMes valor={vm.competenciaEnviados} onMudar={vm.setCompetenciaEnviados} rotulo="Apuração" />
      </div>
      {!vm.enviadosCarregados ? <Esqueleto linhas={3} /> : vm.enviados.length ? (
        <ul className="dp-lote-lista">
          {vm.enviados.map(x => (
            <li key={x.id} className="dp-lote-falta">
              <div className="dp-lote-falta-nome">
                <b><span className="num fraco">{x.codigo}</span> {x.empresa || 'Cliente ' + x.codigo}</b>
                <span className="fraco">{hora(x.enviadoEm)} · para {x.para.join(', ') || '—'}{x.por ? ' · por ' + x.por : ''}</span>
                {x.guias.length > 0 && <span className="fraco" title={x.guias.join('\n')}>{x.guias.length} {x.guias.length === 1 ? 'guia' : 'guias'}: {x.guias.join(' · ')}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="hint dp-lote-texto">Nenhum e-mail de guias do {vm.grupo.rotulo} com a apuração de {mesAno(vm.competenciaEnviados)}.</p>}
    </div>
  );
}

/** "Modelo do e-mail": o assunto, o texto e a prévia */
function Modelo({ vm }: { vm: VmEnvioDeGuias }) {
  return (
    <>
      <ConfigSecao titulo="E-mail ao cliente">
        <ConfigLinha titulo="Assunto" descricao="Pode usar {cliente}, {competencia} e {mes} (o mês da apuração). Vazio volta ao padrão.">
          <input key={'assunto|' + vm.modelo.assunto} type="text" className="nf-entrada largo" aria-label="Assunto do e-mail" maxLength={200}
            defaultValue={vm.modelo.assunto} placeholder={vm.modelo.padrao.assunto}
            onBlur={e => { if (e.target.value.trim() !== vm.modelo.assunto) void vm.gravarModelo({ assunto: e.target.value, texto: vm.modelo.texto }); }} />
        </ConfigLinha>
        <ConfigLinha titulo="Texto" descricao="O mesmo vale aqui: {cliente}, {competencia} e {mes}. A lista das guias vai depois, no cartão dos anexos. Vazio volta ao padrão.">
          <textarea key={'texto|' + vm.modelo.texto} className="nf-entrada nf-texto largo" rows={8} aria-label="Texto do e-mail" maxLength={5000}
            defaultValue={vm.modelo.texto} placeholder={vm.modelo.padrao.texto}
            onBlur={e => { if (e.target.value.trim() !== vm.modelo.texto) void vm.gravarModelo({ assunto: vm.modelo.assunto, texto: e.target.value }); }} />
        </ConfigLinha>
      </ConfigSecao>
      <div className="card">
        <h3>Prévia</h3>
        <div className="dp-envio-previa">
          <b>{vm.previa.assunto}</b>
          <p>{vm.previa.texto}</p>
        </div>
      </div>
    </>
  );
}

export function JanelaDasGuias({ regime, competencia, fechar }: { regime: RegimeDoRelatorio; competencia: string; fechar: () => void }) {
  const vm = useEnvioDeGuias(regime, competencia);
  const [topico, setTopico] = useState<'enviar' | 'enviados' | 'modelo'>('enviar');
  const lote = vm.atual;
  const s = lote ? STATUS_DO_LOTE[lote.status] || { classe: 'badge badge-neutral', rotulo: lote.status } : null;
  // depois de disparado, ainda dá para corrigir quem deu erro e disparar de novo (o robô pula quem já recebeu)
  const mexe = !!lote && (lote.status === 'lido' || lote.status === 'disparado');
  const andando = !!lote && ['enviando', 'pendente', 'lendo', 'disparar', 'disparando'].includes(lote.status);
  // os já enviados saem daqui: ficam só em "Enviados"
  const prontos = vm.grupos.filter(g => g.resultado?.status !== 'enviado');
  const fora = vm.tirados.length + vm.comErro.length;
  const soltar = (fs: File[]) => { void vm.subir(fs.filter(f => /\.pdf$/i.test(f.name))); };
  const andamento = !lote ? '' : andando
    ? (lote.status === 'disparar' || lote.status === 'disparando' ? 'O robô está mandando os e-mails…' : 'O robô está lendo as guias (' + (lote.lidos || 0) + ' de ' + lote.total + ')…')
    : prontos.length + (prontos.length === 1 ? ' cliente pronto' : ' clientes prontos') + (vm.faltam.length ? ' · ' + vm.faltam.length + ' para você escolher' : '') + (fora ? ' · ' + fora + ' fora' : '') + '. O lote fica guardado aqui por 3 dias.';
  return (
    <JanelaLateral rotulo="Enviar guias" topico={topico} mudar={setTopico} fechar={fechar} classe="fgts-janela"
      topicos={[
        { id: 'enviar', rotulo: 'Para enviar', icone: 'aviao', contador: vm.paraDisparar },
        { id: 'enviados', rotulo: 'Enviados', icone: 'check', contador: vm.enviados.length },
        { id: 'modelo', rotulo: 'Modelo do e-mail', icone: 'envelope' },
      ]}
      resumo={<div className="usuario-quem"><b>Fiscal › {vm.grupo.rotulo}</b><span className="fraco">um e-mail por cliente</span></div>}>
      {topico === 'modelo' ? <Modelo vm={vm} /> : topico === 'enviados' ? <Enviados vm={vm} /> : (
        <>
          {/* 1. subir: sempre em cima; cada vez que sobe vira um lote novo, aberto aqui embaixo */}
          <div className="card">
            <h3>1. Subir as guias</h3>
            <div className="dp-lote-subir" onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); if (!vm.subindo) soltar(Array.from(ev.dataTransfer.files)); }}>
              {vm.subindo
                ? <p className="hint">Subindo {vm.subindo.feitos} de {vm.subindo.total}…</p>
                : <CampoArquivos id="fiscal-guias-arquivos" aceitar=".pdf" rotulo="Arraste as guias (PDF) para cá ou escolha" onEscolher={soltar} />}
            </div>
            <p className="hint dp-lote-texto">O robô lê cada guia (DAS, DARF, DAE, DAM): o cliente pelo CNPJ, o valor e o mês da apuração. Nada sai antes de você disparar.</p>
          </div>

          {vm.carregando ? <Esqueleto linhas={4} /> : lote && (
            <>
              {/* 2. o lote aberto: o andamento do robô e o Disparar */}
              <div className="card">
                <div className="dp-lote-topo">
                  <h3>2. Conferir e disparar</h3>
                  {s && <span className={s.classe}>{s.rotulo}</span>}
                  <span className="tarefas-barra-espaco" />
                  {vm.paraEnviar.length > 1 && (
                    <MenuSuspenso rotulo={'Lote de ' + hora(lote.criadoEm)} className="btn btn-ghost" titulo="Lotes para enviar" direita
                      itens={vm.paraEnviar.slice(0, 10).map(l => ({ rotulo: hora(l.criadoEm) + ' · ' + l.total + (l.total === 1 ? ' guia' : ' guias') + ' · ' + (STATUS_DO_LOTE[l.status]?.rotulo || l.status), marcado: l.id === lote.id, onClick: () => vm.escolherLote(l.id) }))} />
                  )}
                  {mexe && (
                    <BotaoAcao carregando={vm.disparando} textoCarregando="Pedindo…" disabled={!vm.paraDisparar} onClick={() => void vm.disparar()}>
                      <Icone nome="aviao" width={16} height={16} />Disparar{vm.paraDisparar ? ' · ' + vm.paraDisparar + (vm.paraDisparar === 1 ? ' cliente' : ' clientes') : ''}
                    </BotaoAcao>
                  )}
                </div>
                {andando && (
                  <span className="tarefas-barra fgts-barra dp-lote-barra" role="progressbar" aria-valuemin={0} aria-valuemax={lote.total} aria-valuenow={lote.lidos} aria-label="Guias lidas">
                    <span style={{ width: (lote.status === 'lendo' ? Math.max(5, (lote.lidos / Math.max(1, lote.total)) * 100) : lote.status === 'pendente' ? 3 : 100) + '%' }} />
                  </span>
                )}
                {lote.erro && <p className="fgts-pedido-erro dp-lote-texto">{lote.erro}</p>}
                <p className="hint dp-lote-texto">{andamento}</p>
              </div>

              {vm.faltam.length > 0 && (
                <div className="card">
                  <h3>Precisam de você · {vm.faltam.length}</h3>
                  <ul className="dp-lote-lista">
                    {vm.faltam.map(a => {
                      const x = efetivoDaGuia(a, vm.grupo.id);
                      return (
                        <li key={a.id} className="dp-lote-falta">
                          <div className="dp-lote-falta-nome">
                            <b title={a.nome}>{a.nome}</b>
                            <span className="fraco">{a.leitura?.semTexto ? 'PDF sem texto (escaneado)' : a.leitura?.cliente != null ? tipoDaGuia(a) + ': o mês da apuração não está escrito na guia' : 'o leitor não reconheceu o cliente'}</span>
                          </div>
                          {mexe && (
                            <div className="dp-lote-falta-campos">
                              <MenuDeCliente vm={vm} arquivo={a} />
                              <MenuDeColuna vm={vm} arquivo={a} />
                              <SeletorMes valor={x.competencia || vm.competenciaDoLote} onMudar={c => void vm.escolher(a, { competencia: c })} rotulo="Apuração" />
                              <button type="button" className="link-btn" onClick={() => void vm.tirar(a, true)}>Tirar</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {prontos.map(g => {
                const r = g.resultado;
                return (
                  <div key={g.chave} className="card">
                    <div className="dp-lote-topo">
                      <h3><span className="num fraco">{g.codigo}</span> {g.nome || 'Cliente ' + g.codigo} · {mesAno(g.competencia)}</h3>
                      <span className="tarefas-barra-espaco" />
                      {r?.status === 'erro' ? <span className="badge badge-parada">Não foi</span> : !g.email ? <span className="badge badge-parada">Sem e-mail</span> : null}
                    </div>
                    <p className="fraco dp-lote-texto">Para: {r?.para.length ? r.para.join(', ') : g.email || 'sem e-mail no cadastro'}</p>
                    <ul className="dp-lote-lista">
                      {g.arquivos.map(a => <LinhaDaGuia key={a.id} vm={vm} a={a} mexe={mexe} />)}
                    </ul>
                    {r?.status === 'erro' && <p className="fgts-pedido-erro dp-lote-texto">{r.erro}</p>}
                  </div>
                );
              })}

              {fora > 0 && (
                <div className="card">
                  <h3>Fora do lote · {fora}</h3>
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
        </>
      )}
    </JanelaLateral>
  );
}
