// Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp, ele sobe o
// arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"): a janela
// do lote de guias, aberta pelo botão "Enviar guias" do Relatório, nas peças da janela do lote do DP (dp/JanelaDoLote.tsx).
// "Subir guias": arrastar os PDFs ou escolher. "Lote": a leitura do robô (o andamento), a revisão (um cartão por cliente e
// competência da apuração, com cada guia, a coluna do Relatório e o valor lido; as não identificadas com o cliente, a coluna
// e a competência para escolher, ou Tirar) e o Disparar (um e-mail por cliente; depois, o resultado de cada um: para quem,
// o que foi para o Relatório e em que pasta do Drive). "Salvos": os lotes ainda não disparados. "Modelo do e-mail": o
// assunto e o texto do e-mail das guias (config/envioFiscal), como o do DP › Envios.
import { BotaoAcao, CampoArquivos, ConfigLinha, ConfigSecao, Esqueleto, Icone, MenuSuspenso, SeletorMes } from '@nads/ui';
import { useState } from 'react';
import type { GuiaDoLote } from '../../../dados/loteFiscal';
import { JanelaLateral } from '../../janela/JanelaLateral';
import { efetivoDaGuia, useEnvioDeGuias, type VmEnvioDeGuias } from './useEnvioDeGuias';
import type { RegimeDoRelatorio } from './useRelatorioGeral';

const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const mesAno = (c: string) => (c ? c.slice(5) + '/' + c.slice(0, 4) : '—');
const reais = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_DO_LOTE: Record<string, { classe: string; rotulo: string }> = {
  enviando: { classe: 'badge badge-warn', rotulo: 'Subindo' }, pendente: { classe: 'badge badge-neutral', rotulo: 'Na fila do robô' },
  lendo: { classe: 'badge badge-warn', rotulo: 'Lendo' }, lido: { classe: 'badge badge-neutral', rotulo: 'Pronto para revisar' },
  disparar: { classe: 'badge badge-warn', rotulo: 'Na fila para disparar' }, disparando: { classe: 'badge badge-warn', rotulo: 'Disparando' },
  disparado: { classe: 'badge badge-ok', rotulo: 'Disparado' }, erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
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

/** a linha de uma guia na revisão: o tipo, o nome, o que vai para o Relatório e, se ainda pode mudar, a coluna e o "Tirar" */
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

export function JanelaDasGuias({ regime, competencia, fechar }: { regime: RegimeDoRelatorio; competencia: string; fechar: () => void }) {
  const vm = useEnvioDeGuias(regime, competencia);
  const [topico, setTopico] = useState<'lote' | 'salvos' | 'novo' | 'modelo'>(vm.lotes.length ? 'lote' : 'novo');
  const lote = vm.atual;
  const s = lote ? STATUS_DO_LOTE[lote.status] || { classe: 'badge badge-neutral', rotulo: lote.status } : null;
  // depois de disparado, ainda dá para corrigir quem deu erro e disparar de novo (o robô pula quem já recebeu)
  const mexe = !!lote && (lote.status === 'lido' || lote.status === 'disparado');
  const andando = !!lote && ['enviando', 'pendente', 'lendo', 'disparar', 'disparando'].includes(lote.status);
  const soltar = (fs: File[]) => { void vm.subir(fs.filter(f => /\.pdf$/i.test(f.name))).then(() => setTopico('lote')); };
  return (
    <JanelaLateral rotulo="Enviar guias" topico={topico} mudar={setTopico} fechar={fechar} classe="fgts-janela"
      topicos={[
        { id: 'lote', rotulo: 'Lote', icone: 'clipe', contador: lote ? lote.total : 0 },
        { id: 'salvos', rotulo: 'Salvos', icone: 'clock', contador: vm.salvos.length },
        { id: 'novo', rotulo: 'Subir guias', icone: 'upload' },
        { id: 'modelo', rotulo: 'Modelo do e-mail', icone: 'envelope' },
      ]}
      resumo={<div className="usuario-quem"><b>Fiscal › {vm.grupo.rotulo}</b>{lote && <span className="fraco">lote de {hora(lote.criadoEm)}</span>}</div>}>
      {topico === 'novo' ? (
        <div className="card">
          <h3>Subir as guias</h3>
          <p className="hint dp-lote-texto">O robô lê cada guia (DAS, DARF, DAE, DAM): o cliente pelo CNPJ, o valor, o vencimento e o mês da apuração. Depois você confere e dispara: um e-mail por cliente, e o valor vai para a coluna do {vm.grupo.rotulo} no Relatório.</p>
          <div className="dp-lote-subir" onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); if (!vm.subindo) soltar(Array.from(ev.dataTransfer.files)); }}>
            {vm.subindo
              ? <p className="hint">Subindo {vm.subindo.feitos} de {vm.subindo.total}…</p>
              : <CampoArquivos id="fiscal-guias-arquivos" aceitar=".pdf" rotulo="Arraste as guias (PDF) para cá ou escolha" onEscolher={soltar} />}
          </div>
        </div>
      ) : topico === 'modelo' ? (
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
      ) : topico === 'salvos' ? (vm.carregando ? <Esqueleto linhas={3} /> : (
        <div className="card">
          <h3>Salvos para enviar depois{vm.salvos.length ? ' · ' + vm.salvos.length : ''}</h3>
          {vm.salvos.length ? (
            <ul className="dp-lote-lista">
              {vm.salvos.map(l => (
                <li key={l.id} className="dp-lote-arquivo">
                  <span className="dp-lote-nome">Lote de {hora(l.criadoEm)} · {l.total} {l.total === 1 ? 'guia' : 'guias'}</span>
                  <span className={(STATUS_DO_LOTE[l.status] || STATUS_DO_LOTE.lido).classe}>{STATUS_DO_LOTE[l.status]?.rotulo || l.status}</span>
                  <button type="button" className="link-btn" onClick={() => { vm.escolherLote(l.id); setTopico('lote'); }}>Abrir</button>
                </li>
              ))}
            </ul>
          ) : <p className="hint dp-lote-texto">Nenhum lote salvo.</p>}
        </div>
      )) : vm.carregando ? <Esqueleto linhas={4} /> : !lote ? (
        <div className="card"><p className="hint dp-lote-texto">Nenhum lote ainda. Em "Subir guias", escolha os PDFs.</p></div>
      ) : (
        <>
          <div className="card">
            <div className="dp-lote-topo">
              <h3>Lote de {hora(lote.criadoEm)}</h3>
              {s && <span className={s.classe}>{s.rotulo}</span>}
              <span className="tarefas-barra-espaco" />
              {vm.lotes.length > 1 && (
                <MenuSuspenso rotulo="Outros lotes" className="btn btn-ghost" titulo="Lotes" direita
                  itens={vm.lotes.slice(0, 10).map(l => ({ rotulo: hora(l.criadoEm) + ' · ' + l.total + ' guias · ' + (STATUS_DO_LOTE[l.status]?.rotulo || l.status), marcado: l.id === lote.id, onClick: () => vm.escolherLote(l.id) }))} />
              )}
              {vm.podeSalvar && (
                <button type="button" className="btn btn-outline" onClick={() => { vm.salvar(); setTopico('salvos'); }}><Icone nome="clock" width={16} height={16} />Salvar para enviar depois</button>
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
            {!andando && <p className="hint dp-lote-texto">{vm.grupos.length} {vm.grupos.length === 1 ? 'cliente' : 'clientes'} · {vm.faltam.length} sem cliente · {vm.tirados.length} {vm.tirados.length === 1 ? 'tirada' : 'tiradas'}{vm.comErro.length ? ' · ' + vm.comErro.length + ' não lidas' : ''}</p>}
          </div>

          {vm.faltam.length > 0 && (
            <div className="card">
              <h3>Sem cliente ou sem mês · {vm.faltam.length}</h3>
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

          {vm.grupos.map(g => {
            const r = g.resultado;
            const preenchidos = new Set(r?.preenchidos || []);
            const valores = Object.entries(r?.valores || {});
            return (
              <div key={g.chave} className="card">
                <div className="dp-lote-topo">
                  <h3><span className="num fraco">{g.codigo}</span> {g.nome || 'Cliente ' + g.codigo} · {mesAno(g.competencia)}</h3>
                  {r ? <span className={r.status === 'enviado' ? 'badge badge-ok' : 'badge badge-parada'}>{r.status === 'enviado' ? 'Enviado' : 'Não deu'}</span>
                    : !g.email ? <span className="badge badge-parada">Sem e-mail</span> : null}
                </div>
                <p className="fraco dp-lote-texto">Para: {r?.para.length ? r.para.join(', ') : g.email || 'sem e-mail no cadastro'}</p>
                <ul className="dp-lote-lista">
                  {g.arquivos.map(a => <LinhaDaGuia key={a.id} vm={vm} a={a} mexe={mexe && r?.status !== 'enviado'} />)}
                </ul>
                {r?.status === 'erro' && <p className="fgts-pedido-erro dp-lote-texto">{r.erro}</p>}
                {r?.status === 'enviado' && (
                  <div className="dp-lote-texto">
                    {r.erroNoRelatorio ? <p className="fgts-pedido-erro">O Relatório não foi preenchido: {r.erroNoRelatorio}</p> : (
                      <p className="fraco">No Relatório de {mesAno(g.competencia)}: {valores.map(([c, v]) => vm.rotuloDaColuna(c) + ' ' + reais(v) + (preenchidos.has(c) ? '' : ' (já estava escrito; ficou o de antes)')).join(' · ')}{valores.length ? ' · ' : ''}a data e o Entregue por e-mail, onde estavam em branco</p>
                    )}
                    <ul className="dp-envio-historico-arquivos">
                      {r.salvos.map(sv => <li key={sv.nome + sv.pasta}><Icone nome={sv.erro ? 'alert' : 'pasta'} width={14} height={14} />{sv.erro ? sv.nome + ': ' + sv.erro : (sv.jaEstava ? 'já estava em ' : 'gravado em ') + sv.pasta}</li>)}
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
