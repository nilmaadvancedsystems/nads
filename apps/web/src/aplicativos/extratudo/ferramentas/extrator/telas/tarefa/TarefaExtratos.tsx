// Importar e conferir na mesma tela — a página que a etapa "Importar e conferir os extratos" da Tarefas abre.
// Em cima, à direita (como o "New issue" do GitHub): Pedir extrato e Adicionar banco ▾ (escolhe o banco e
// pede agência e conta). Depois, uma linha por conta da empresa:
//   ▸ setinha: abre o movimento do extrato (data, descrição, valor, entrou/saiu e o saldo acumulado);
//   logo, nome, agência e conta (o logo fica colorido quando o extrato está importado);
//   Extrato: importar à mão (vira o check verde) ou buscar no Drive (fica só o logo do Drive, colorido);
//     com o mouse em cima, vira × vermelho para excluir;
//   Razão: importar à mão (check verde / × para excluir);
//   à direita: "Não teve movimento" (trava a linha e vira "Desfazer"); com o extrato vindo do Drive, um
//     botãozinho de PDF (abre pelo link temporário). O movimento se vê pela setinha.
// Ao importar, só uma barrinha por cima da tela, que some em 2,7 s. Embaixo, a conferência (com mais de um
// banco, a do banco cujo nome foi clicado).
import { extrator as x, type empresas } from '@nads/core';
import { Icone, LogoBanco, LogoDrive, LogoGmail, LogoWhatsApp, MensagemFlutuante, MenuSuspenso, useCarregando } from '@nads/ui';
import { useCallback, useId, useState } from 'react';
import { usePonteDaTarefa } from '../../../../../../comum/ponte';
import { useSessao } from '../../casca/sessao';
import { Conferencia } from '../conferencia/Conferencia';
import { useImportacao, type Mensagem } from '../importacao/useImportacao';
import { useDriveDaLinha } from './useDriveDaLinha';

type Vm = ReturnType<typeof useImportacao>;
type Lado = { qtdArquivos: number; qtdLancamentos: number; lendo: boolean };

/** Botão só de ícone de um lado (extrato ou razão): importar → check verde → (mouse em cima) × para excluir. */
function BotaoLado({ lado, titulo, aceitar, travado, onArquivos, onExcluir }: {
  lado: Lado; titulo: string; aceitar: string; travado: boolean;
  onArquivos: (fs: File[]) => void; onExcluir: () => void;
}) {
  const id = useId();
  if (lado.lendo) return <span className="icon-btn icon-btn-sm imp-btn" title="Importando…"><span className="btn-spinner" /></span>;
  if (lado.qtdArquivos) {
    return (
      <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onExcluir} disabled={travado}
        title={titulo + ': importado (' + lado.qtdLancamentos + ' lançamentos). Clique para excluir.'} aria-label={'Excluir ' + titulo.toLowerCase()}>
        <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
      </button>
    );
  }
  return (
    <>
      <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (travado ? ' is-locked' : '')} title={'Importar ' + titulo.toLowerCase()} aria-label={'Importar ' + titulo.toLowerCase()}>
        <Icone nome="upload" />
      </label>
      <input id={id} type="file" multiple accept={aceitar} className="sr-only" disabled={travado}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

/** "Adicionar banco ▾": a lista dos bancos (com logo) e, escolhido um, agência e conta. */
function AdicionarBanco({ bancos, onAdicionar, fechar }: {
  bancos: readonly empresas.BancoDaEmpresa[];
  onAdicionar: (b: empresas.BancoDaEmpresa, agencia: string, conta: string) => void;
  fechar: () => void;
}) {
  const [escolhido, setEscolhido] = useState<empresas.BancoDaEmpresa | null>(null);
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const pronto = !!agencia.trim() && !!conta.trim();
  const adicionar = () => { if (!escolhido || !pronto) return; onAdicionar(escolhido, agencia, conta); fechar(); };

  if (!escolhido) {
    return (
      <div className="add-banco-lista" role="menu">
        {bancos.map(b => (
          <button key={b.id} type="button" className="popover-item add-banco-item" role="menuitem" onClick={() => setEscolhido(b)}>
            {b.nome}
          </button>
        ))}
      </div>
    );
  }
  return (
    <form className="add-banco-form" onSubmit={e => { e.preventDefault(); adicionar(); }}>
      <div className="add-banco-titulo">
        <span className="add-banco-logo"><LogoBanco banco={escolhido.id} cor /></span><b>{escolhido.nome}</b>
      </div>
      <label className="field"><span className="hint">Agência</span>
        <input type="text" autoFocus inputMode="numeric" value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="Ex.: 3001" />
      </label>
      <label className="field"><span className="hint">Conta</span>
        <input type="text" inputMode="numeric" value={conta} onChange={e => setConta(e.target.value)} placeholder="Ex.: 12345-6" />
      </label>
      <div className="add-banco-acoes">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEscolhido(null)}>Voltar</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!pronto}>Adicionar</button>
      </div>
    </form>
  );
}

type ColunaMov = 'data' | 'historico' | 'valor' | 'tipo' | 'saldo';
const COMPARAR_MOV: Record<ColunaMov, (a: x.LinhaDoMovimento, b: x.LinhaDoMovimento) => number> = {
  data: (a, b) => a.data.localeCompare(b.data),
  historico: (a, b) => a.historico.localeCompare(b.historico, 'pt-BR'),
  valor: (a, b) => Math.abs(a.valor) - Math.abs(b.valor),
  tipo: (a, b) => Number(b.valor > 0) - Number(a.valor > 0),
  saldo: (a, b) => a.saldo - b.saldo,
};
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * O movimento do extrato da conta na competência (abre pela setinha): o saldo acumula os meses importados.
 * Busca (data, descrição ou valor) e ordem por coluna (clicar no título; clicar de novo inverte; a setinha só
 * aparece depois do clique). A linha do saldo anterior fica sempre em cima, como está.
 */
function Movimento({ m }: { m: x.MovimentoDoExtrato }) {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<{ coluna: ColunaMov; dir: 'asc' | 'desc' } | null>(null);
  if (!m.linhas.length) return <p className="hint imp-mov-vazio">Nenhum lançamento do extrato nesta competência.</p>;
  const q = semAcento(busca.trim());
  const achadas = q ? m.linhas.filter(l => semAcento([x.dataBR(l.data), l.historico, x.valorBR(Math.abs(l.valor)), x.valorBR(l.saldo)].join(' ')).includes(q)) : m.linhas;
  const linhas = ordem ? achadas.slice().sort((a, b) => (ordem.dir === 'asc' ? 1 : -1) * COMPARAR_MOV[ordem.coluna](a, b)) : achadas;
  // o total do que a busca achou: quantos, quanto entrou, quanto saiu e o saldo (negativo em vermelho, sem sinal)
  const entrou = achadas.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0);
  const saiu = achadas.filter(l => l.valor < 0).reduce((t, l) => t - l.valor, 0);
  const saldoBusca = entrou - saiu;
  const ordenar = (c: ColunaMov) => setOrdem(o => (o?.coluna === c && o.dir === 'asc' ? { coluna: c, dir: 'desc' } : { coluna: c, dir: 'asc' }));
  const Titulo = ({ c, rotulo, num }: { c: ColunaMov; rotulo: string; num?: boolean }) => (
    <th className={'th-sort' + (num ? ' num' : '')} onClick={() => ordenar(c)} title="Ordenar por esta coluna"
      aria-sort={ordem?.coluna === c ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      {rotulo}{ordem?.coluna === c && <Icone nome="caretDown" className={'th-seta' + (ordem.dir === 'asc' ? ' cima' : '')} />}
    </th>
  );
  return (
    <div className="imp-mov-caixa">
      <div className="imp-mov-topo">
        <label className="busca-curta imp-mov-busca">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar no extrato" aria-label="Buscar no extrato (data, descrição ou valor)" value={busca}
            onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }} />
        </label>
        {q && (
          <div className="imp-mov-total" aria-live="polite">
            <span><b>{achadas.length}</b> {achadas.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            <span>Entrou <b className="ext-pos">{x.valorBR(entrou)}</b></span>
            <span>Saiu <b className="ext-neg">{x.valorBR(saiu)}</b></span>
            <span>Saldo <b className={saldoBusca < 0 ? 'ext-neg' : 'imp-mov-saldo'}>{x.valorBR(Math.abs(saldoBusca))}</b></span>
          </div>
        )}
      </div>
    <div className="imp-mov">
      <table className="table-compact">
        <thead><tr>
          <Titulo c="data" rotulo="Data" /><Titulo c="historico" rotulo="Descrição" /><Titulo c="valor" rotulo="Valor" num />
          <Titulo c="tipo" rotulo="Entrou/Saiu" /><Titulo c="saldo" rotulo="Saldo atual" num />
        </tr></thead>
        <tbody>
          <tr className="imp-mov-anterior"><td colSpan={4}>Saldo anterior <span className="hint">(dos meses já importados)</span></td><td className="num">{x.valorBR(m.saldoAnterior)}</td></tr>
          {!linhas.length && <tr><td colSpan={5} className="hint">Nada com essa busca.</td></tr>}
          {linhas.map((l, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{x.dataBR(l.data)}</td>
              <td className="wrap">{l.historico}</td>
              <td className="num">{x.valorBR(Math.abs(l.valor))}</td>
              <td><span className={l.valor > 0 ? 'ext-pos' : 'ext-neg'}>{l.valor > 0 ? 'Entrou' : 'Saiu'}</span></td>
              <td className={'num' + (l.saldo < 0 ? ' ext-neg' : '')}>{x.valorBR(l.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function resumo(b: Vm['bancos'][number], semMovimento: boolean): string {
  if (semMovimento) return 'Sem movimento nesta competência';
  const parte = (nome: string, l: Lado) => (l.qtdArquivos ? nome + ' ' + l.qtdLancamentos + ' lanç.' : '');
  return [parte('Extrato', b.extrato), parte('Razão', b.razao)].filter(Boolean).join(' · ') || 'Nada importado';
}

export function TarefaExtratos() {
  const vm = useImportacao();
  const s = useSessao();
  const ponte = usePonteDaTarefa();
  const d = useDriveDaLinha(vm, s.codigo);
  useCarregando(vm.ocupado || !!d.buscando || vm.bancos.some(b => b.extrato.lendo || b.razao.lendo));
  const [cxExtrato, cxRazao] = vm.caixas;
  const [abertas, setAbertas] = useState<string[]>([]);
  const alternar = (id: string) => setAbertas(v => (v.includes(id) ? v.filter(a => a !== id) : [...v, id]));
  // a conferência é de um banco por vez (com mais de um, escolhe nos chips)
  const [bancoConf, setBancoConf] = useState<string | null>(null);
  const prontos = vm.bancos.filter(b => b.extrato.qtdArquivos && b.razao.qtdArquivos);
  const conf = vm.bancos.find(b => b.id === bancoConf) || prontos[0] || vm.bancos[0];
  const doArquivo = useCallback((a: x.ArquivoImportado) => x.bancoDoArquivo(a, vm.primeiro) === conf?.id, [vm.primeiro, conf?.id]);
  const umSo = vm.bancos.length <= 1;
  const faltaNoBanco = !conf || !conf.extrato.qtdArquivos ? 'banco' : !conf.razao.qtdArquivos ? 'sistema' : null;
  const falta = umSo ? s.falta : faltaNoBanco;

  /** Visualizar o que veio do Drive: abre a janela já (senão o navegador bloqueia) e põe o link temporário quando o robô responder. */
  function visualizarDoDrive(arquivo: { id: string; nome: string }) {
    const janela = window.open('', '_blank');
    janela?.document.write('<p style="font:14px sans-serif;padding:24px;color:#555">Buscando ' + arquivo.nome.replace(/</g, '') + ' no Drive…</p>');
    d.link(arquivo).then(url => { if (janela) janela.location.href = url; else window.open(url, '_blank'); },
      e => { janela?.close(); vm.avisarErro('Não consegui abrir do Drive', e instanceof Error ? e.message : String(e)); });
  }

  return (
    <section className="tarefa-extratos">
      <div className="imp-topo">
        <MenuSuspenso rotulo="Pedir extrato" setaAntes className="btn btn-outline btn-sm" direita
          conteudo={fechar => (
            <div className="apps-contato">
              <button type="button" title="Pedir por Gmail" aria-label="Pedir por Gmail" onClick={() => { fechar(); vm.avisar('Pedir extrato por Gmail: em desenvolvimento'); }}><LogoGmail /></button>
              <button type="button" title="Pedir por WhatsApp" aria-label="Pedir por WhatsApp" onClick={() => { fechar(); vm.avisar('Pedir extrato por WhatsApp: em desenvolvimento'); }}><LogoWhatsApp /></button>
            </div>
          )} />
        <MenuSuspenso rotulo="Adicionar banco" icone="plus" className="btn btn-primary btn-sm" direita largura={260}
          conteudo={fechar => <AdicionarBanco bancos={vm.bancosParaAdicionar} onAdicionar={vm.adicionarBanco} fechar={fechar} />} />
      </div>

      <div className="imp-lista">
        {vm.bancos.map(b => {
          const semMov = ponte.semMovimento.includes(b.id);
          const buscando = d.buscando === b.id;
          // sem movimento: a linha toda trava (só o Desfazer fica)
          const travado = semMov || vm.ocupado || buscando || b.extrato.lendo || b.razao.lendo;
          const temExtrato = b.extrato.qtdArquivos > 0;
          const doDrive = b.extrato.doDrive;
          const aberta = abertas.includes(b.id);
          return (
            <div key={b.id} className={'imp-bloco' + (semMov ? ' sem-movimento' : '')}>
              <div className="imp-linha">
                <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={semMov}
                  title={aberta ? 'Fechar o movimento' : 'Ver o movimento do extrato'} aria-label="Movimento do extrato" onClick={() => alternar(b.id)}>
                  <Icone nome="caretDown" />
                </button>
                <span className="imp-ico imp-logo"><LogoBanco banco={b.marca} cor={temExtrato && !semMov} /></span>
                <div className={'imp-txt' + (!umSo ? ' escolhe' : '') + (!umSo && conf?.id === b.id ? ' na-conferencia' : '')}
                  onClick={umSo ? undefined : () => setBancoConf(b.id)} title={umSo ? undefined : 'Ver a conferência deste banco'}>
                  <span><b>{b.nome}</b>{b.conta && <span className="imp-conta">{b.conta}</span>}</span>
                  <span className="hint">{resumo(b, semMov)}</span>
                </div>
                <div className="imp-grupos">
                  <div className="imp-grupo" aria-label="Extrato do banco">
                    <span className="imp-rotulo">Extrato</span>
                    {buscando || b.extrato.lendo ? (
                      <span className="icon-btn icon-btn-sm imp-btn" title="Trazendo o extrato…"><span className="btn-spinner" /></span>
                    ) : doDrive.length ? (
                      // veio do Drive: fica só o Drive, colorido (com o mouse em cima, × para excluir)
                      <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito imp-feito-drive" disabled={travado} onClick={() => { void vm.excluirDoBanco(b.id, 'banco'); }}
                        title={'Do Drive: ' + doDrive.map(a => a.nome).join(', ') + '. Clique para excluir.'} aria-label="Excluir o extrato do Drive">
                        <span className="imp-feito-ok"><LogoDrive cor /></span><Icone nome="x" className="imp-feito-x" />
                      </button>
                    ) : temExtrato ? (
                      // importado à mão: fica só o check
                      <BotaoLado lado={b.extrato} titulo="Extrato" aceitar={cxExtrato.aceitar} travado={travado}
                        onArquivos={() => undefined} onExcluir={() => { void vm.excluirDoBanco(b.id, 'banco'); }} />
                    ) : (
                      <>
                        <BotaoLado lado={b.extrato} titulo="Extrato" aceitar={cxExtrato.aceitar} travado={travado}
                          onArquivos={fs => { void vm.importarArquivos(b.id, 'banco', fs); }} onExcluir={() => undefined} />
                        <button type="button" className="icon-btn icon-btn-sm imp-btn imp-drive" disabled={travado} title="Buscar no Drive" aria-label="Buscar no Drive"
                          onClick={() => d.buscar(b)}><LogoDrive /></button>
                        <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={travado} title="Protótipo: importar um extrato de teste" aria-label="Extrato de teste"
                          onClick={() => { void vm.importarTeste('banco', b.id); }}><Icone nome="zap" /></button>
                      </>
                    )}
                  </div>
                  <div className="imp-grupo" aria-label="Razão da conta">
                    <span className="imp-rotulo">Razão</span>
                    <BotaoLado lado={b.razao} titulo="Razão" aceitar={cxRazao.aceitar} travado={travado}
                      onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'sistema'); }} />
                    {!b.razao.qtdArquivos && (
                      <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={travado} title="Protótipo: importar um razão de teste" aria-label="Razão de teste"
                        onClick={() => { void vm.importarTeste('sistema', b.id); }}><Icone nome="zap" /></button>
                    )}
                  </div>
                  {/* importado: o movimento se vê pela setinha; do Drive, um botãozinho de PDF (link temporário, não guardado) */}
                  {temExtrato ? doDrive.length > 0 && (
                    <button type="button" className="btn btn-sm btn-outline imp-pdf" title={'Abrir o PDF do Drive: ' + doDrive[doDrive.length - 1].nome}
                      aria-label="Abrir o PDF do Drive" onClick={() => visualizarDoDrive(doDrive[doDrive.length - 1])}>
                      <Icone nome="fileText" />PDF
                    </button>
                  ) : ponte.naTarefa && (
                    <button type="button" className={'btn btn-sm btn-outline imp-sem-mov' + (semMov ? ' marcado' : '')} aria-pressed={semMov}
                      disabled={!semMov && (vm.ocupado || buscando || b.extrato.lendo || b.razao.lendo)}
                      onClick={() => ponte.marcarSemMovimento(b.id, !semMov)}>{semMov ? 'Desfazer' : 'Não teve movimento'}</button>
                  )}
                </div>
              </div>
              {aberta && !semMov && <Movimento m={vm.movimentoDe(b.id)} />}
            </div>
          );
        })}
      </div>

      {/* o resultado: uma barrinha por cima da tela; o que deu certo some em 2,7 s, erro fica até o × */}
      <MensagemFlutuante id="impAviso" className="imp-aviso" chave={vm.seqMensagem} onFechar={vm.fecharMensagem}
        duracao={vm.mensagem?.tom === 'erro' ? null : 2700}>
        {vm.mensagem && <Aviso m={vm.mensagem} onFechar={vm.fecharMensagem} />}
      </MensagemFlutuante>

      {d.login.aberto && (
        <div className="modal-overlay" role="presentation" onClick={d.login.fechar}>
          <form className="modal drive-login" role="dialog" aria-modal="true" aria-labelledby="tituloDrive" onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); d.login.entrar(); }}>
            <h3 id="tituloDrive">Entrar no Drive do escritório</h3>
            <p className="hint">O mesmo usuário do app Pendências (Entregas). Precisa ser do contábil.</p>
            <label className="field"><span className="hint">Usuário</span>
              <input type="text" autoFocus autoComplete="username" value={d.login.usuario} onChange={e => d.login.set({ usuario: e.target.value })} />
            </label>
            <label className="field"><span className="hint">Senha</span>
              <input type="password" autoComplete="current-password" value={d.login.senha} onChange={e => d.login.set({ senha: e.target.value })} />
            </label>
            {d.login.erro && <p className="hint" style={{ color: 'var(--danger)' }}>{d.login.erro}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={d.login.fechar}>Voltar</button>
              <button type="submit" className="btn btn-primary" disabled={d.login.entrando || !d.login.usuario || !d.login.senha}>{d.login.entrando ? 'Entrando…' : 'Entrar'}</button>
            </div>
          </form>
        </div>
      )}

      {d.escolha && (
        <div className="modal-overlay" role="presentation" onClick={d.fecharEscolha}>
          <div className="modal drive-escolha" role="dialog" aria-modal="true" aria-labelledby="tituloEscolha" onClick={e => e.stopPropagation()}>
            <h3 id="tituloEscolha">Extrato do {d.escolha.linha.nome} no Drive</h3>
            <p className="hint">{d.escolha.texto}</p>
            {d.escolha.candidatos.length > 0 && (
              <div className="drive-candidatos">
                {d.escolha.candidatos.slice(0, 12).map(a => (
                  <button key={a.id} type="button" className="popover-item" onClick={() => d.usar(a)}>
                    <span className="add-banco-logo"><LogoDrive /></span>
                    <span className="popover-texto">{a.caminho}</span>
                    {a.daCompetencia && <span className="popover-dica">{vm.competencia.slice(5) + '/' + vm.competencia.slice(0, 4)}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={d.fecharEscolha}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {falta ? (
        <div className="gh-blank">
          <Icone nome="scale" />
          <h4>{falta === 'banco' ? 'Importe o extrato' + (umSo ? ' do banco' : ' do ' + conf?.nome) : 'Importe o razão' + (umSo ? ' da conta' : ' do ' + conf?.nome)}</h4>
          <p>A conferência aparece aqui quando os dois lados estiverem importados.</p>
        </div>
      ) : <Conferencia naTarefa doArquivo={umSo ? undefined : doArquivo} competencia={vm.competencia} />}
    </section>
  );
}

function Aviso({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  return (
    <div className={'imp-aviso-barra ' + m.tom} role="status">
      <Icone nome={m.tom === 'erro' ? 'alert' : m.tom === 'info' ? 'clock' : 'checkCircle'} />
      <span><b>{m.titulo}</b>{m.textos.length > 0 && <span className="hint"> · {m.textos.map(t => t.texto).join(' · ')}</span>}</span>
      <button type="button" aria-label="Fechar" title="Fechar" onClick={onFechar}>×</button>
    </div>
  );
}
