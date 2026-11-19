// As janelas do Lançatudo, no desenho das janelas de registro do nads (Novo lançamento do LCDPR, empresa do Cadastro).
// A da linha é o "Lançamentos (Cadastramento)" do Alterdata no desenho da do LCDPR (17/11/2026: "essa tela de lançamento pode
// ser a mesma do lcdpr, só que no estilo do alterdata normal"): data e valor, a conta devedora e a credora com a lupa, o
// histórico padrão e o histórico; à direita, como vai para o Alterdata. A lupa (F2) troca o corpo pelo plano de contas em
// árvore, como o eContador (17/11/2026: "quero que abra o plano de contas assim como no econtador"), a mesma árvore da
// janela do plano (as linhas marcadas e a regra). Só desenham: tudo vem dos ViewModels.
import { BotaoFechar, Icone, LogoBanco, MenuSuspenso, useJanela } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useJanelaDaLinha } from './useJanelaDaLinha';
import { useJanelaDoPlano } from './useJanelaDoPlano';
import { ROTULO_ORIGEM, ROTULO_SITUACAO, type useRegistroDoLancatudo } from './useRegistroDoLancatudo';

type Vm = ReturnType<typeof useRegistroDoLancatudo>;
type Linha = NonNullable<Vm['linhaAberta']>;

export const SELO_DA_SITUACAO: Record<Linha['situacao'], string> = {
  conciliada: 'badge badge-suave badge-ok', sugerida: 'badge badge-suave badge-warn', pendente: 'badge badge-suave badge-bad',
  ignorada: 'badge badge-suave badge-neutral', 'no-razao': 'badge badge-suave badge-neutral',
};

/** Um campo com o rótulo em cima (o mesmo da janela do LCDPR). */
function Campo({ rotulo, para, className, children }: { rotulo: string; para?: string; className?: string; children: ReactNode }) {
  return (
    <div className={'lcdpr-campo' + (className ? ' ' + className : '')}>
      <label className="lcdpr-rotulo" htmlFor={para}>{rotulo}</label>
      {children}
    </div>
  );
}

export function Janela({ titulo, caminho, selo, fechar, children, pe, className = '', classeDoFundo = '' }: {
  titulo: string; caminho?: ReactNode; selo?: ReactNode; fechar: () => void; children: ReactNode; pe?: ReactNode; className?: string; classeDoFundo?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useJanela(ref, fechar);
  return (
    <div className={'modal-overlay lt-fundo ' + classeDoFundo} onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={ref} className={'modal registro-novo lt-janela ' + className} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="landmark" />Lançatudo<Icone nome="chevronRight" />{caminho || <b>{titulo}</b>}</span>
          {selo}
          <BotaoFechar onClick={fechar} />
        </header>
        {children}
        {pe && <footer className="registro-pe">{pe}</footer>}
      </div>
    </div>
  );
}

/** O botão da conta escolhida (código em negrito e o nome; vazio, "Escolher no plano"): abre o plano de contas. */
export function BotaoDaConta({ conta, nome, abrir }: { conta: string | null; nome?: string; abrir: () => void }) {
  return (
    <button type="button" className={'lt-conta-botao' + (conta ? '' : ' vazio')} onClick={e => { e.stopPropagation(); abrir(); }}
      title={conta ? 'Trocar a conta (o plano de contas)' : 'Escolher a conta no plano de contas'}>
      {conta ? <><b className="num">{conta}</b><span>{nome || 'Fora do plano'}</span></> : <><Icone nome="search" />Escolher no plano</>}
    </button>
  );
}

// ------------------------------------------------------------------------------------------------- a árvore do plano
/** O plano de contas em árvore (a busca, os grupos que abrem e fecham, as setas e o Enter), dentro de uma janela. */
function ArvoreDoPlano({ vm, conta, escolher }: { vm: Vm; conta: string | null; escolher: (codigo: string) => void }) {
  const p = useJanelaDoPlano(vm.linhasDoPlano, conta, escolher);
  const lista = useRef<HTMLDivElement>(null);
  // a conta destacada sempre à vista (as setas andam pela lista)
  useEffect(() => { lista.current?.querySelector('.lt-plano-linha.destacada')?.scrollIntoView({ block: 'nearest' }); }, [p.destacada]);
  return (
    <div className="registro-corpo lt-plano-corpo">
      <div className="lt-plano-topo">
        <label className="busca-curta larga">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Código reduzido, classificação ou parte do nome" aria-label="Buscar no plano de contas" value={p.busca}
            onChange={e => p.setBusca(e.target.value)} onKeyDown={e => { if (p.tecla(e.key)) e.preventDefault(); }} />
        </label>
        {!p.semPlano && !p.busca && (
          <span className="lt-plano-acoes">
            <button type="button" className="btn btn-ghost" onClick={p.abrirTudo}>Abrir tudo</button>
            <button type="button" className="btn btn-ghost" onClick={p.fecharTudo}>Fechar tudo</button>
          </span>
        )}
      </div>
      {p.digitado && (
        <button type="button" className="lt-plano-usar" onClick={() => escolher(p.digitado)}>
          <Icone nome="plus" /><span>Usar o código <b className="num">{p.digitado}</b></span>
          <span className="hint">{p.semPlano ? 'a empresa ainda não tem plano de contas no Cadastro' : 'não está no plano de contas da empresa'}</span>
        </button>
      )}
      {p.semPlano ? (
        <p className="lt-plano-vazio">A empresa ainda não tem plano de contas no Cadastro (Configurações › Empresas › Plano de contas). Digite o código reduzido da conta.</p>
      ) : (
        <div className="lt-plano" ref={lista} role="tree" aria-label="Plano de contas">
          <div className="lt-plano-cabeca" aria-hidden="true"><span>Classificação</span><span>Descrição</span><span className="num">Reduzido</span></div>
          {p.visiveis.map(l => {
            const fechado = p.fechados.has(l.codigo) && !p.busca;
            const atual = l.codigo === conta;
            return (
              <div key={l.codigo} role="treeitem" aria-level={l.nivel} aria-expanded={l.temFilhos ? !fechado : undefined} aria-selected={atual}
                className={'lt-plano-linha' + (l.sintetica ? ' sintetica' : '') + (l.codigo === p.destacada ? ' destacada' : '') + (atual ? ' atual' : '')}
                onMouseEnter={() => { if (!l.sintetica) p.setDestaque(l.codigo); }}
                onClick={() => (l.sintetica ? (l.temFilhos && !p.busca ? p.alternar(l.codigo) : undefined) : escolher(l.codigo))}>
                <span className="lt-plano-class num">{l.classificacao}</span>
                <span className="lt-plano-nome" style={{ paddingLeft: (l.nivel - 1) * 18 }}>
                  {l.temFilhos ? <Icone nome={fechado ? 'chevronRight' : 'caretDown'} /> : <span className="lt-plano-folha" />}
                  <span className="lt-corta">{l.nome}</span>
                  {atual && <Icone nome="check" />}
                </span>
                <span className="lt-plano-cod num">{l.sintetica ? '' : l.codigo}</span>
              </div>
            );
          })}
          {!p.visiveis.length && <p className="lt-plano-vazio">Nenhuma conta com essa busca.</p>}
        </div>
      )}
      <p className="registro-dica"><Icone nome="ajuda" />{p.total ? p.total + ' contas analíticas · ' : ''}↑ ↓ andam, Enter escolhe. As de negrito são de título (sintéticas): só agrupam.</p>
    </div>
  );
}

/** A janela do plano de contas (para as linhas marcadas, a da lista e a regra). */
export function JanelaDoPlano({ vm }: { vm: Vm }) {
  const alvo = vm.escolhendo!;
  return (
    <Janela titulo="Plano de contas" fechar={vm.fecharPlano} className="lt-janela-plano" classeDoFundo="lt-plano-fundo"
      selo={alvo.quantas > 1 ? <span className="badge badge-neutral">{alvo.quantas} linhas</span> : undefined}>
      <ArvoreDoPlano vm={vm} conta={alvo.conta} escolher={vm.escolherNoPlano} />
    </Janela>
  );
}

// ------------------------------------------------------------------------------------------------- a linha
/** O código, a lupa e o nome (o campo de conta do Alterdata); a conta do banco fica fixa, sem lupa. */
function ContaComLupa({ id, rotulo, conta, lado, abrir, mudar }: {
  id: string; rotulo: string; conta: { codigo: string; nome: string; editavel: boolean }; lado: 'd' | 'c'; abrir: () => void; mudar: (v: string) => void;
}) {
  return (
    <span className="lcdpr-codigo">
      <input id={id} type="text" className={'lcdpr-cod' + (conta.editavel ? '' : ' lt-fixo')} value={conta.codigo} readOnly={!conta.editavel} tabIndex={conta.editavel ? undefined : -1} aria-label={rotulo} autoComplete="off" inputMode="numeric"
        autoFocus={conta.editavel && !conta.codigo}
        onChange={e => mudar(e.target.value)} onKeyDown={e => { if (conta.editavel && (e.key === 'F2' || (e.key === 'Enter' && !conta.codigo))) { e.preventDefault(); abrir(); } }} />
      {conta.editavel
        ? <button type="button" className="lcdpr-lupa" title={'Pesquisar no plano de contas (F2)'} aria-label={'Pesquisar a ' + rotulo.toLowerCase()} onClick={abrir}><Icone nome="search" /></button>
        : <span className="lcdpr-lupa lt-lupa-fixa" title="A conta do banco (Cadastro › Contas bancárias)"><Icone nome="lock" /></span>}
      <span className={'lcdpr-cod-nome lt-cod-nome-' + lado + (conta.nome ? '' : ' vazio')} title={conta.nome}>
        {conta.nome || (conta.codigo ? 'Não está no plano' : 'Pesquise pela lupa (F2)')}
      </span>
    </span>
  );
}

export function JanelaDaLinha({ vm, l }: { vm: Vm; l: Linha }) {
  const j = useJanelaDaLinha(vm, l);
  const [mais, setMais] = useState(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (j.pesquisando) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); j.gravar(); }
      if (e.key === 'F2') { e.preventDefault(); j.abrirPesquisa(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  const caminho = j.pesquisando
    ? <><button type="button" className="btn btn-ghost lcdpr-volta" onClick={j.fecharPesquisa}>Lançamentos (Cadastramento)</button><Icone nome="chevronRight" /><b>Plano de contas</b></>
    : <b>Lançamentos (Cadastramento)</b>;
  const rotuloDoGravar = j.vaiCriarRegra ? 'Gravar e criar a regra' : j.confirmaSugerida && !j.mudou ? 'Confirmar' : 'Gravar';
  return (
    <Janela titulo="Lançamentos (Cadastramento)" caminho={caminho} fechar={j.pesquisando ? j.fecharPesquisa : vm.fecharLinha} className={'lt-janela-linha' + (j.pesquisando ? ' lt-janela-plano' : '')}
      selo={<span className={SELO_DA_SITUACAO[l.situacao]}>{ROTULO_SITUACAO[l.situacao]}</span>}
      pe={j.pesquisando ? <><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline" onClick={j.fecharPesquisa}>Voltar ao lançamento</button></> : (
        <>
          <MenuSuspenso rotulo="Mais" className="btn btn-ghost" acima largura={260} itens={[
            { rotulo: 'Criar uma regra completa', icone: 'plus', onClick: () => { vm.fecharLinha(); vm.novaRegra(l); } },
            ...(l.contaEscolhida ? [{ rotulo: 'Voltar ao automático', icone: 'repeat' as const, onClick: () => vm.voltarAoAutomatico(l.chave) }] : []),
            ...(l.situacao === 'no-razao' ? [] : [l.situacao === 'ignorada'
              ? { rotulo: 'Voltar para a exportação', icone: 'upload' as const, onClick: () => vm.ignorar([l.chave], false) }
              : { rotulo: 'Tirar da exportação', icone: 'x' as const, onClick: () => { vm.ignorar([l.chave], true); vm.fecharLinha(); } }]),
          ]} />
          <span className="lt-cad-teclas">F2 abre o plano de contas · Ctrl+Enter grava</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={vm.fecharLinha}><Icone nome="x" />Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!!j.problema || j.fora} onClick={j.gravar} title="Gravar (Ctrl+Enter)"><Icone nome="check" />{rotuloDoGravar}</button>
        </>
      )}>
      {j.pesquisando ? <ArvoreDoPlano vm={vm} conta={j.r.conta || null} escolher={j.escolherNaPesquisa} /> : (
        <div className="registro-corpo lt-cad-corpo">
          <div className="lcdpr-form lt-cad">
            <div className="lt-cad-linha lt-cad-topo">
              <Campo rotulo="Data" para="lt-data" className="lt-cad-data">
                <span className="lcdpr-adorno"><Icone nome="calendar" /><input id="lt-data" type="text" className="lt-fixo" value={j.data} readOnly tabIndex={-1} /></span>
              </Campo>
              <span className="lt-cad-banco" title={vm.banco.nome + (vm.banco.conta ? ' ' + vm.banco.conta : '')}>
                <span className="lt-logo"><LogoBanco banco={vm.banco.marca || 'outro'} cor /></span>{j.entrada ? 'Entrou no' : 'Saiu do'} {vm.banco.nome}
              </span>
              <Campo rotulo="Valor" para="lt-valor" className="lt-cad-valor">
                <input id="lt-valor" type="text" className={'lt-fixo num ' + (j.entrada ? 'lt-entrada' : 'lt-saida')} value={j.valor} readOnly tabIndex={-1} />
              </Campo>
            </div>

            <Campo rotulo="Lançamento automático" para="lt-automatico">
              <select id="lt-automatico" value={j.regra} onChange={e => j.aplicarRegra(e.target.value)} disabled={!j.regras.length}>
                <option value="">{j.regras.length ? '— nenhum (escolher uma regra do banco) —' : '— ' + j.semRegras + ' —'}</option>
                {j.regras.map(x => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Conta devedora" para="lt-devedora">
              <ContaComLupa id="lt-devedora" rotulo="Conta devedora" conta={j.devedora} lado="d" abrir={j.abrirPesquisa} mudar={v => j.mudar('conta', v)} />
            </Campo>
            <Campo rotulo="Conta credora" para="lt-credora">
              <ContaComLupa id="lt-credora" rotulo="Conta credora" conta={j.credora} lado="c" abrir={j.abrirPesquisa} mudar={v => j.mudar('conta', v)} />
            </Campo>

            <div className="lt-cad-linha lt-cad-historico">
              <div className="lt-cad-coluna">
                <Campo rotulo="Histórico padrão" para="lt-codhist">
                  <input id="lt-codhist" type="text" value={j.r.codHistorico} inputMode="numeric" autoComplete="off" placeholder="Código" onChange={e => j.mudar('codHistorico', e.target.value)} />
                </Campo>
                <Campo rotulo="Documento" para="lt-documento">
                  <input id="lt-documento" type="text" value={j.r.documento} maxLength={20} autoComplete="off" placeholder="Nº" onChange={e => j.mudar('documento', e.target.value)} />
                </Campo>
                <button type="button" className="btn btn-outline lt-cad-plano" onClick={j.abrirPesquisa}><Icone nome="list" />Plano de contas</button>
              </div>
              <Campo rotulo="Histórico" para="lt-historico" className="lt-cad-texto">
                <textarea id="lt-historico" value={j.r.historico} maxLength={250} onChange={e => j.mudar('historico', e.target.value)} placeholder="O histórico do lançamento" />
              </Campo>
            </div>

            <button type="button" className="lt-cad-mais" aria-expanded={mais} onClick={() => setMais(!mais)}>
              <Icone nome={mais ? 'caretDown' : 'chevronRight'} />Informações complementares
            </button>
            {mais && (
              <div className="lt-cad-complemento">
                <div className="lcdpr-resumo-linha"><span>No extrato</span><b title={l.historicoDoBanco}>{l.historicoDoBanco}</b></div>
                <div className="lcdpr-resumo-linha"><span>A conta veio</span><b>{l.origem ? ROTULO_ORIGEM[l.origem] : 'Sem conta ainda'}</b></div>
                <div className="lcdpr-resumo-linha"><span>Conta bancária</span><b>{vm.banco.nome}{vm.banco.conta ? ' ' + vm.banco.conta : ''} · {l.contaDoBanco || 'sem código contábil'}</b></div>
              </div>
            )}
          </div>

          <aside className="lt-cad-lado">
            <section className="lt-cad-cartao">
              <span className="lcdpr-rotulo">Vai para o Alterdata assim</span>
              <b className={'lt-cad-valor-grande num ' + (j.entrada ? 'lt-entrada' : 'lt-saida')}>R$ {j.valor}</b>
              <span className="hint">{j.data}</span>
              <div className="lt-cad-partidas">
                <div><span className="lt-dc lt-dc-d">D</span><b className="num">{j.devedora.codigo || '—'}</b><span>{j.devedora.nome || (j.devedora.codigo ? 'fora do plano' : 'falta a conta')}</span></div>
                <div><span className="lt-dc lt-dc-c">C</span><b className="num">{j.credora.codigo || '—'}</b><span>{j.credora.nome || (j.credora.codigo ? 'fora do plano' : 'falta a conta')}</span></div>
              </div>
              <p className="lt-cad-hist">{j.r.codHistorico && <span className="lt-codhist num">{j.r.codHistorico}</span>}{j.r.historico.trim() || <i>sem histórico</i>}</p>
              {j.fora ? <p className="lt-cad-aviso"><Icone nome="alert" />{l.situacao === 'no-razao' ? 'Já está no razão do mês: não vai de novo.' : 'Fora da exportação.'}</p>
                : j.problema ? <p className="lt-cad-aviso erro"><Icone nome="alert" />{j.problema}.</p>
                : j.faltam.length ? <p className="lt-cad-aviso"><Icone nome="alert" />Falta {j.faltam.join(', ')}.</p>
                : j.confirmaSugerida ? <p className="lt-cad-aviso lt-cad-info"><Icone nome="ajuda" />Sugerida pelo razão: gravar confirma esta conta.</p>
                : <p className="lt-cad-ok"><Icone nome="checkCircle" />Pronto.</p>}
            </section>

            {/* o lançamento do razão que levou à conciliação (19/11/2026: "quando estiver no razão, quero ver o lançamento do razão
                em que levou a conciliação"): o mesmo dia e o mesmo valor, com a contrapartida e o histórico do Alterdata */}
            {l.doRazao && (
              <section className="lt-cad-cartao lt-cad-razao">
                <span className="lcdpr-rotulo"><Icone nome="checkCircle" />No razão do Alterdata</span>
                <div className="lt-cad-razao-linha">
                  <span className="num">{vm.dataBR(l.doRazao.data)}</span>
                  <b className="num">R$ {vm.valor(l.doRazao.valor)}</b>
                </div>
                {l.doRazao.conta && (
                  <div className="lt-cad-razao-conta">
                    <span className="lt-cad-razao-rotulo">Contrapartida</span>
                    <b className="num">{l.doRazao.conta}</b>
                    <span>{vm.nomeDaConta(l.doRazao.conta) || 'fora do plano'}</span>
                  </div>
                )}
                {l.doRazao.historico && <p className="lt-cad-razao-hist">{l.doRazao.historico}</p>}
                <small className="hint">Casou com esta linha pelo mesmo dia e o mesmo valor.</small>
              </section>
            )}

            {j.podeCriarRegra && (
              <section className={'lt-cad-cartao lt-cad-regra' + (j.criarRegra ? ' ligada' : '')}>
                <label className="lt-cad-regra-topo">
                  <input type="checkbox" checked={j.criarRegra} onChange={e => j.setCriarRegra(e.target.checked)} />
                  <span><b>Gravar como regra</b><small>para não precisar de novo nos próximos meses</small></span>
                </label>
                {j.criarRegra && (
                  <>
                    <label className="lt-cad-regra-campo">
                      <span>Quando o {j.tipoDaRegra === 'favorecido' ? 'favorecido for' : 'histórico tiver'}</span>
                      <input type="text" value={j.expressao} onChange={e => j.setExpressao(e.target.value)} aria-label="O que procurar no histórico do banco" />
                    </label>
                    <p className="lt-cad-regra-efeito">
                      {j.entrada ? 'e entrar no' : 'e sair do'} {vm.banco.nome}, vai para <b className="num">{j.r.conta || '—'}</b>
                      {j.r.codHistorico ? <> com o histórico <b className="num">{j.r.codHistorico}</b></> : null}.
                      <br /><span className="hint">{j.casam} {j.casam === 1 ? 'linha deste mês casa' : 'linhas deste mês casam'} com ela.</span>
                    </p>
                  </>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
    </Janela>
  );
}

// ------------------------------------------------------------------------------------------------- a regra
const SENTIDO_NA_FRASE: Record<'saida' | 'entrada' | 'ambos', string> = { saida: 'sair do', entrada: 'entrar no', ambos: 'entrar ou sair do' };

/**
 * A regra escrita como uma frase (18/11/2026: "achei isso um pouco difícil de entender"): "Quando [sair do] [Sicoob] e o
 * [histórico tiver] [TARIFA], lançar na conta [81012], com o histórico [Tarifa bancária]". Embaixo, as linhas deste mês que ela
 * pega, para ver o efeito antes de gravar.
 */
export function JanelaDaRegra({ vm }: { vm: Vm }) {
  const r = vm.regra!;
  const mudar = (x: Partial<typeof r>) => vm.setRegra({ ...r, ...x });
  const fechar = () => vm.setRegra(null);
  const banco = vm.bancos.find(b => b.id === r.banco);
  const rotuloDoBanco = (b?: Vm['bancos'][number]) => (b ? <><span className="lt-logo"><LogoBanco banco={b.marca || 'outro'} cor /></span>{b.nome}{b.conta ? ' ' + b.conta : ''}</> : 'qualquer banco');
  return (
    <Janela titulo={r.id ? 'Regra' : 'Nova regra'} fechar={fechar} className="lt-janela-regra"
      pe={(
        <>
          {r.id && <button type="button" className="btn btn-ghost lt-perigo" onClick={() => vm.excluirRegra(r.id as string)}><Icone nome="lixeira" />Excluir</button>}
          <span className={'registro-dica' + (vm.problemaDaRegra ? ' registro-dica-erro' : '')}>{vm.problemaDaRegra && <><Icone nome="alert" />{vm.problemaDaRegra}</>}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!!vm.problemaDaRegra} onClick={vm.salvarRegra}><Icone nome="check" />{r.id ? 'Gravar' : 'Criar regra'}</button>
        </>
      )}>
      <div className="registro-corpo lt-frase">
        {/* 18/11/2026 ("gostei, só melhora o visual"): a mesma frase em dois blocos, o Quando (o que procurar no extrato) e o Lançar
            (o que vai para o Alterdata), cada parte da frase numa linha, as palavras à esquerda e os campos alinhados */}
        <section className="lt-frase-bloco">
          <header className="lt-frase-cabeca"><span className="lt-frase-icone"><Icone nome="filtro" /></span>Quando</header>
          <div className="lt-frase-linha">
            <span className="lt-frase-palavra">o dinheiro</span>
            <div className="lt-frase-campos">
              <MenuSuspenso rotulo={SENTIDO_NA_FRASE[r.sentido]} className="btn btn-outline lt-frase-escolha" flutuante largura={220} titulo="Quando o dinheiro"
                itens={(['saida', 'entrada', 'ambos'] as const).map(s => ({ rotulo: SENTIDO_NA_FRASE[s], marcado: r.sentido === s, onClick: () => mudar({ sentido: s }) }))} />
              <MenuSuspenso rotulo={rotuloDoBanco(banco)} className="btn btn-outline lt-frase-escolha" flutuante largura={280} titulo="Em qual conta bancária"
                itens={[...vm.bancos.map(b => ({ rotulo: <span className="lt-banco-item">{rotuloDoBanco(b)}</span>, marcado: r.banco === b.id, onClick: () => mudar({ banco: b.id }) })),
                  'separador', { rotulo: 'qualquer banco da empresa', marcado: !r.banco, onClick: () => mudar({ banco: '' }) }]} />
            </div>
          </div>
          <div className="lt-frase-linha">
            <span className="lt-frase-palavra">e o</span>
            <div className="lt-frase-campos">
              <MenuSuspenso rotulo={r.tipo === 'favorecido' ? 'favorecido for' : 'histórico tiver'} className="btn btn-outline lt-frase-escolha" flutuante largura={300} titulo="O que procurar"
                itens={[
                  { rotulo: 'histórico tiver (um texto do extrato)', marcado: r.tipo === 'historico', onClick: () => mudar({ tipo: 'historico' }) },
                  { rotulo: 'favorecido for (o nome ou o CPF/CNPJ)', marcado: r.tipo === 'favorecido', onClick: () => mudar({ tipo: 'favorecido' }) },
                ]} />
              <input type="text" className="lt-frase-texto lt-frase-expressao" autoFocus value={r.expressao} onChange={e => mudar({ expressao: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter' && !vm.problemaDaRegra) vm.salvarRegra(); }}
                placeholder={r.tipo === 'favorecido' ? 'ACME ou 12.345.678/0001-90' : 'TARIFA'} aria-label="O que procurar no histórico do banco" />
            </div>
          </div>
          <p className="lt-frase-dica">
            {r.tipo === 'favorecido' ? 'Todas as palavras do nome, em qualquer ordem, ou o CPF/CNPJ (com ou sem pontos).'
              : <>Maiúsculas e acentos não importam. O <b>*</b> vale qualquer coisa no meio: <b>PIX*RECEB</b> acha PIX RECEBIDO.</>}
          </p>
        </section>

        <section className="lt-frase-bloco">
          <header className="lt-frase-cabeca"><span className="lt-frase-icone lt-frase-icone-lancar"><Icone nome="arrowDown" /></span>Lançar</header>
          <div className="lt-frase-linha">
            <span className="lt-frase-palavra">na conta</span>
            <div className="lt-frase-campos"><BotaoDaConta conta={r.conta || null} nome={vm.nomeDaConta(r.conta)} abrir={vm.abrirPlanoDaRegra} /></div>
          </div>
          <div className="lt-frase-linha">
            <span className="lt-frase-palavra">com o histórico</span>
            <div className="lt-frase-campos">
              <input type="text" className="lt-frase-texto" value={r.historico || ''} maxLength={250} onChange={e => mudar({ historico: e.target.value })} placeholder="o mesmo do extrato" aria-label="O histórico do lançamento" />
              {(r.historico || '').trim() && <label className="lt-check lt-frase-check"><input type="checkbox" checked={r.comHistoricoDoExtrato} onChange={e => mudar({ comHistoricoDoExtrato: e.target.checked })} />e o do extrato depois</label>}
            </div>
          </div>
          <div className="lt-frase-linha">
            <span className="lt-frase-palavra">histórico padrão</span>
            <div className="lt-frase-campos">
              <input type="text" className="lt-frase-texto lt-frase-curto" inputMode="numeric" value={r.codHistorico || ''} onChange={e => mudar({ codHistorico: e.target.value })} placeholder="código" aria-label="O código do histórico padrão no Alterdata" />
              <span className="lt-frase-opcional">opcional</span>
            </div>
          </div>
        </section>

        <div className="lt-frase-linha lt-frase-nome">
          <span className="lt-frase-palavra">nome da regra</span>
          <div className="lt-frase-campos">
            <input type="text" className="lt-frase-texto" value={r.descricao || ''} onChange={e => mudar({ descricao: e.target.value })} placeholder={r.expressao || 'opcional: como ela aparece na lista'} aria-label="O nome da regra na lista" />
          </div>
        </div>

        <section className={'lt-frase-previa' + (vm.exemplosDaRegra.length ? '' : ' vazia')}>
          <span className="lt-frase-previa-titulo">
            <Icone nome={vm.casamDaRegra ? 'checkCircle' : 'search'} />
            {r.expressao.trim() ? (vm.casamDaRegra ? 'Neste mês ela pega ' + vm.casamDaRegra + (vm.casamDaRegra === 1 ? ' linha' : ' linhas') : 'Neste mês ela não pega nenhuma linha') : 'As linhas deste mês que ela pegar aparecem aqui'}
          </span>
          {vm.exemplosDaRegra.length > 0 && (
            <ul>
              {vm.exemplosDaRegra.map(x => (
                <li key={x.chave}><span className="num">{x.data}</span><span className="lt-corta">{x.historico}</span><b className={'num ' + (x.entrada ? 'lt-entrada' : 'lt-saida')}>{x.entrada ? '' : '−'}{x.valor}</b></li>
              ))}
              {vm.casamDaRegra > vm.exemplosDaRegra.length && <li className="lt-frase-mais">e mais {vm.casamDaRegra - vm.exemplosDaRegra.length}</li>}
            </ul>
          )}
        </section>
      </div>
    </Janela>
  );
}
