// Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp, ele sobe o
// arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"): a janela
// do lote de guias, aberta pelo botão "Enviar guias" do Relatório, nas peças da janela do lote do DP (dp/JanelaDoLote.tsx).
// Refeita em 04/11/2026 ("Precisa ter uma aba de enviados e uma aba de 'para enviar' para nao misturar, a ui ta bem
// confusa também"): três abas só. "Para enviar": subir as guias em cima e, embaixo, o lote aberto em passos (o que precisa
// de você, os clientes prontos e o Disparar), sem os já enviados. "Enviados": os e-mails que saíram na competência da
// apuração (o registro do robô; fica mesmo depois que o lote some). "Modelo do e-mail": o assunto e o texto
// (config/envioFiscal), como o do DP › Envios.
import { BotaoAcao, BotaoIcone, CampoArquivos, ConfigLinha, ConfigSecao, Esqueleto, Icone, MenuSuspenso, Segmentado, SeletorMes } from '@nads/ui';
import { useState } from 'react';
import type { GuiaDoLote, ViaDaGuia } from '../../../dados/loteFiscal';
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
// o DARF de mais de um tributo: "DARF PIS + COFINS" (05/11/2026)
// o que não é guia (escolhido como OUTRO: o relatório da Antecipação ICMS-ES que vai junto, 12/11/2026) aparece pelo nome do arquivo
const naoEGuia = (a: GuiaDoLote) => a.escolha?.tipo === 'OUTRO';
const tipoDaGuia = (a: GuiaDoLote) => naoEGuia(a) ? a.nome.replace(/\.[^.]+$/, '') : [a.leitura?.tipo, (a.leitura?.partes?.length ?? 0) > 1 ? a.leitura!.partes!.map(p => p.tributo).join(' + ') : a.leitura?.tributo].filter(Boolean).join(' ') || '?';
const VIAS: { valor: ViaDaGuia; rotulo: string }[] = [{ valor: 'email', rotulo: 'Gmail' }, { valor: 'impresso', rotulo: 'Impresso' }, { valor: 'econtador', rotulo: 'eContador' }, { valor: 'scireport', rotulo: 'SCI Report' }];
const ROTULO_DA_VIA: Record<ViaDaGuia, string> = { email: 'Gmail', impresso: 'Impresso', econtador: 'eContador', scireport: 'SCI Report' };

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
  // o DARF de mais de um tributo vai dividido (cada um na coluna dele) até a pessoa escolher uma coluna só
  const r = vm.noRelatorio(arquivo);
  return (
    <MenuSuspenso rotulo={r.dividida ? 'Colunas: ' + r.coluna : atual ? 'Coluna: ' + vm.rotuloDaColuna(atual) : 'Sem coluna'} className={compacto ? 'btn btn-ghost btn-sm' : 'btn btn-outline'} titulo="Coluna do Relatório" compacto={compacto} flutuante direita
      dica="A coluna do Relatório que recebe o valor desta guia"
      itens={vm.colunas.map(c => ({ rotulo: c.rotulo, marcado: !r.dividida && c.valor === atual, onClick: () => void vm.escolher(arquivo, { coluna: c.valor }) }))} />
  );
}

/**
 * Os clientes prontos numa tabela só (04/11/2026: "melhora essa ui"; antes era um cartão por cliente): uma linha por guia,
 * com o cliente, o e-mail e a apuração na primeira de cada um. Clicar na guia abre o PDF; a coluna do Relatório troca no menu.
 */
function TabelaDosProntos({ vm, grupos, mexe }: { vm: VmEnvioDeGuias; grupos: VmEnvioDeGuias['grupos']; mexe: boolean }) {
  return (
    <div className="table-wrap">
      <table className="dp-tabela dp-tabela-guias">
        <thead>
          <tr><th title="Código e mês da apuração">Cód.</th><th>Cliente</th><th>Envio</th><th>Guia</th><th className="num">Valor e coluna</th><th className="dp-tabela-acao" aria-label="Tirar" /></tr>
        </thead>
        <tbody>
          {grupos.flatMap(g => g.arquivos.map((a, k) => {
            const r = vm.noRelatorio(a);
            const erro = g.resultado?.status === 'erro' ? g.resultado.erro : g.via === 'email' && !g.email ? 'sem e-mail no cadastro' : '';
            const jaNaRota = g.resultado?.jaNaRota || [];
            const destino = g.via === 'impresso' ? (jaNaRota.length ? 'já estava na rota do Entregas: ' + jaNaRota.join(', ') : 'vai para a rota do Entregas') : g.via === 'econtador' ? 'vai pelo eContador do Alterdata' : g.via === 'scireport' ? 'vai pelo SCI Report' : g.resultado?.para.length ? g.resultado.para.join(', ') : g.email;
            return (
              <tr key={g.chave + '|' + a.id}>
                {k === 0 && (
                  <>
                    <td className="num fraco dp-guia-cod" rowSpan={g.arquivos.length}>{g.codigo}<span className="dp-guia-vence">{mesAno(g.competencia)}</span></td>
                    <td className="dp-cliente" rowSpan={g.arquivos.length}>
                      <span className="dp-cliente-nome" title={g.nome}>{g.nome || 'Cliente ' + g.codigo}</span>
                      {erro ? <span className="fgts-pedido-erro">{erro}</span> : <span className="fraco">{destino}</span>}
                    </td>
                    <td rowSpan={g.arquivos.length}>
                      {mexe ? <Segmentado valor={g.via} opcoes={VIAS} onMudar={v => void vm.mudarVia(g.codigo, v)} /> : <span className="fraco">{ROTULO_DA_VIA[g.via]}</span>}
                    </td>
                  </>
                )}
                <td className="dp-guia">
                  <button type="button" className="link-btn" title={'Ver a guia: ' + (a.leitura?.nomeFinal || a.nome)} onClick={() => vm.abrirDoLote(a)}>{tipoDaGuia(a)}</button>
                  {a.leitura?.vencimento && !naoEGuia(a) && <span className="fraco dp-guia-vence">vence {a.leitura.vencimento.replace(/-/g, '/')}</span>}
                </td>
                {/* o valor e, embaixo, a coluna do Relatório (06/11/2026: com o SCI Report no Envio, a coluna à parte ficava cortada) */}
                <td className="num dp-guia-valor">
                  <span className="dp-guia-valor-num">{(!naoEGuia(a) && r.valor) || <span className="fraco">—</span>}</span>
                  {mexe ? <MenuDeColuna vm={vm} arquivo={a} compacto /> : <span className="fraco">{r.coluna || 'sem coluna'}</span>}
                </td>
                {/* sempre à vista, preso à direita (06/11/2026: "excluir somente uma delas"; com a tabela larga ele ficava escondido no fim) */}
                <td className="dp-tabela-acao">{mexe && <BotaoIcone icone="lixeira" titulo="Tirar esta guia do lote" onClick={() => void vm.tirar(a, true)} />}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
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
                <span className="fraco">{hora(x.enviadoEm)} · {x.via === 'impresso' ? 'impresso, na rota do Entregas' : x.via === 'econtador' ? 'pelo eContador' : x.via === 'scireport' ? 'pelo SCI Report' : 'para ' + (x.para.join(', ') || '—')}{x.por ? ' · por ' + x.por : ''}</span>
                {/* cada guia abre pelo id no Drive; os envios de antes do id, pelo nome na pasta do cliente */}
                {(() => {
                  const gs = x.guiasDrive.length ? x.guiasDrive : x.guias.map(nome => ({ nome, id: '' }));
                  return gs.length > 0 && (
                    <span className="fraco">{gs.length} {gs.length === 1 ? 'guia' : 'guias'}:{' '}
                      {gs.map((g, k) => (
                        <span key={g.id || g.nome + k}>{k > 0 && ' · '}<button type="button" className="link-btn" title={'Ver a guia: ' + g.nome} onClick={() => vm.abrirEnviada(g, x.codigo)}>{g.nome}</button></span>
                      ))}
                    </span>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="hint dp-lote-texto">Nenhuma guia do {vm.grupo.rotulo} enviada com a apuração de {mesAno(vm.competenciaEnviados)}.</p>}
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
  // as guias de baixo vão para o lote aberto (lido, antes do disparo; 05/11/2026) ou, se a pessoa escolher, para um lote novo
  const [loteNovo, setLoteNovo] = useState(false);
  const noLote = vm.podeAdicionar && !loteNovo;
  const lote = vm.atual;
  const s = lote ? STATUS_DO_LOTE[lote.status] || { classe: 'badge badge-neutral', rotulo: lote.status } : null;
  // depois de disparado, ainda dá para corrigir quem deu erro e disparar de novo (o robô pula quem já recebeu)
  const mexe = !!lote && (lote.status === 'lido' || lote.status === 'disparado');
  const andando = !!lote && ['enviando', 'pendente', 'lendo', 'disparar', 'disparando'].includes(lote.status);
  // os já enviados saem daqui: ficam só em "Enviados"
  const prontos = vm.grupos.filter(g => g.resultado?.status !== 'enviado');
  const fora = vm.tirados.length + vm.comErro.length;
  const soltar = (fs: File[]) => { void vm.subir(fs.filter(f => /\.pdf$/i.test(f.name)), noLote); };
  const subir = (
    <div className="dp-lote-subir" onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); if (!vm.subindo) soltar(Array.from(ev.dataTransfer.files)); }}>
      {vm.subindo
        ? <p className="hint">Subindo {vm.subindo.feitos} de {vm.subindo.total}…</p>
        : <CampoArquivos id="fiscal-guias-arquivos" aceitar=".pdf" rotulo="Arraste as guias (PDF) para cá ou escolha" onEscolher={soltar} />}
    </div>
  );
  const andamento = !lote ? '' : andando
    ? (lote.status === 'disparar' || lote.status === 'disparando' ? 'O robô está mandando os e-mails e pondo os impressos na rota…' : 'O robô está lendo as guias (' + (lote.lidos || 0) + ' de ' + lote.total + ')…')
    : prontos.length + (prontos.length === 1 ? ' cliente pronto' : ' clientes prontos') + (vm.faltam.length ? ' · ' + vm.faltam.length + ' para você escolher' : '') + (fora ? ' · ' + fora + ' fora' : '') + '. Fica aqui por 3 dias até você disparar ou excluir.';
  return (
    <JanelaLateral rotulo="Enviar guias" topico={topico} mudar={setTopico} fechar={fechar} classe="fgts-janela guias-janela"
      topicos={[
        { id: 'enviar', rotulo: 'Para enviar', icone: 'aviao', contador: vm.paraDisparar },
        { id: 'enviados', rotulo: 'Enviados', icone: 'check', contador: vm.enviados.length },
        { id: 'modelo', rotulo: 'Modelo do e-mail', icone: 'envelope' },
      ]}
      resumo={<div className="usuario-quem"><b>Fiscal › {vm.grupo.rotulo}</b><span className="fraco">por Gmail, impresso, eContador ou SCI Report</span></div>}>
      {topico === 'modelo' ? <Modelo vm={vm} /> : topico === 'enviados' ? <Enviados vm={vm} /> : (
        <>
          {vm.carregando ? <Esqueleto linhas={4} /> : !lote ? (
            // sem lote: só o subir, grande, com a explicação
            <div className="card">
              <h3>Subir as guias</h3>
              {subir}
              <p className="hint dp-lote-texto">O robô lê cada guia (DAS, DARF, DAE, DAM): o cliente pelo CNPJ, o valor e o mês da apuração. Nada sai antes de você disparar.</p>
            </div>
          ) : (
            <>
              {/* o lote aberto: o andamento, o Excluir e o Disparar em cima, e os clientes prontos numa tabela */}
              <div className="card">
                <div className="dp-lote-topo">
                  <h3>Lote de {hora(lote.criadoEm)}</h3>
                  {s && <span className={s.classe}>{s.rotulo}</span>}
                  <span className="tarefas-barra-espaco" />
                  {vm.paraEnviar.length > 1 && (
                    <MenuSuspenso rotulo={'Outros lotes · ' + (vm.paraEnviar.length - 1)} className="btn btn-ghost" titulo="Lotes para enviar" direita
                      itens={vm.paraEnviar.slice(0, 10).map(l => ({ rotulo: hora(l.criadoEm) + ' · ' + l.total + (l.total === 1 ? ' guia' : ' guias') + ' · ' + (STATUS_DO_LOTE[l.status]?.rotulo || l.status), marcado: l.id === lote.id, onClick: () => vm.escolherLote(l.id) }))} />
                  )}
                  {vm.podeExcluir && (
                    <button type="button" className="btn btn-outline btn-danger" onClick={() => void vm.excluirLote()}><Icone nome="lixeira" width={16} height={16} />Excluir lote</button>
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
                {!andando && prontos.length > 0 && <TabelaDosProntos vm={vm} grupos={prontos} mexe={mexe} />}
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
                            <button type="button" className="link-btn" title={'Ver a guia: ' + a.nome} onClick={() => vm.abrirDoLote(a)}><b>{a.nome}</b></button>
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

              {/* mais guias: no mesmo lote, enquanto não disparou (05/11/2026); senão, ou se a pessoa escolher, outro lote */}
              <div className="card">
                <h3>{noLote ? 'Pôr mais guias neste lote' : 'Subir outro lote'}</h3>
                {subir}
                {vm.podeAdicionar && (
                  <p className="hint dp-lote-texto">
                    {noLote ? 'O robô lê só as novas, e elas entram na tabela de cima. ' : 'As guias vão para um lote separado. '}
                    <button type="button" className="link-btn" onClick={() => setLoteNovo(!loteNovo)}>{noLote ? 'Subir num lote novo' : 'Pôr neste lote'}</button>
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </JanelaLateral>
  );
}
