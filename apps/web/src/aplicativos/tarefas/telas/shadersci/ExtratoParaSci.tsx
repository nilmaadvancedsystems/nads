// O Extrato → SCI no minimum (25/11/2026: "Adapte a ferramenta nads → SCI para extratos bancários e coloque o resultado como uma
// função dentro do minimum"): sobe o PDF do extrato; em cima, a conta bancária, a conta dela no SCI, o histórico padrão, o lote e
// se o extrato fecha com o saldo do banco; embaixo, a grade (o débito e o crédito de cada linha, a contrapartida trocada na própria
// linha, a regra criada a partir dela) e a planilha do gerador do SCI. No jeito do Razão do SCI. Só desenha: tudo vem do ViewModel.
import { sci } from '@nads/core';
import { Icone, LogoExcel, MenuSuspenso } from '@nads/ui';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { AcoesDoTopo } from '../../../../comum/topo';
import { BalaoDeGuia } from './BalaoDeGuia';
import { ContaNaTabela, HistoricoNaTabela } from './CelulasDaTabela';
import { Paleta } from './Paleta';
import { useExtratoParaSci, type FiltroDoExtratoSci, type VmExtratoParaSci } from './useExtratoParaSci';
import type { VmShadersCi } from './useShadersCi';

const valor = (c: number) => sci.valorParaTexto(Math.abs(c));
const comSinal = (c: number) => (c < 0 ? '−' : '') + valor(c);

export function ExtratoParaSci({ min }: { min: VmShadersCi }) {
  const vm = useExtratoParaSci(min);
  const campo = useRef<HTMLInputElement>(null);
  const escolher = () => campo.current?.click();
  // sem extrato, a janela de trazer o arquivo já abre, como no Visualizar lançamentos
  const [janela, setJanela] = useState(() => !vm.extrato);
  useEffect(() => { if (vm.extrato) setJanela(false); }, [vm.extrato]);
  if (!vm.carregado) return null;
  return (
    <>
      <AcoesDoTopo>
        <button type="button" className="btn btn-outline sci-btn-icone" onClick={vm.voltar} title="Voltar aos apps" aria-label="Voltar aos apps"><Icone nome="chevronLeft" /></button>
        {vm.dev && (
          <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={300} titulo="Modo desenvolvedor · fica só neste navegador"
            itens={[
              { rotulo: 'Extrato de exemplo (fictício)', icone: 'zap', onClick: vm.carregarExemplo },
              'separador',
              { rotulo: 'Tirar o extrato da tela', icone: 'x', desabilitado: !vm.extrato, onClick: vm.limpar },
            ]} />
        )}
        {vm.extrato
          ? <button type="button" className="btn btn-outline" onClick={escolher} disabled={vm.lendo}><Icone nome="upload" />{vm.lendo ? 'Lendo…' : 'Outro extrato'}</button>
          : (
            <BalaoDeGuia lado="direita" texto={<>Suba o extrato do banco em <b>PDF</b> (ou OFX, planilha, foto)</>}>
              <button type="button" className="btn btn-primary sci-btn-pulsa" onClick={escolher} disabled={vm.lendo}><Icone nome="upload" />{vm.lendo ? 'Lendo…' : 'Subir o extrato'}</button>
            </BalaoDeGuia>
          )}
        {vm.extrato && (
          <button type="button" className="btn btn-primary" disabled={!vm.podeBaixar} onClick={vm.baixar}
            title="A planilha do gerador do SCI (modelo nads: linha inicial 2, descarta 0 no fim), pronta para importar. As linhas com problema vão na aba Conferir.">
            <LogoExcel />Baixar planilha do SCI{vm.prontos > 0 && <span className="menu-contador">{vm.prontos}</span>}
          </button>
        )}
      </AcoesDoTopo>
      <input ref={campo} type="file" accept=".pdf,.ofx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png" hidden onChange={e => { void vm.importar(e.target.files?.[0]); e.target.value = ''; }} />
      {janela && !vm.extrato && <JanelaDoArquivo vm={vm} escolher={escolher} fechar={() => setJanela(false)} />}
      {vm.paleta && <PaletaAberta vm={vm} />}
      {vm.extrato && <ExtratoAberto vm={vm} />}
    </>
  );
}

function JanelaDoArquivo({ vm, escolher, fechar }: { vm: VmExtratoParaSci; escolher: () => void; fechar: () => void }) {
  const [arrastando, setArrastando] = useState(false);
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const soltar = (e: DragEvent) => { e.preventDefault(); setArrastando(false); void vm.importar(e.dataTransfer.files[0]); };
  return createPortal(
    <div className="sci-paleta-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className={'sci-upload' + (arrastando ? ' arrastando' : '')} role="dialog" aria-modal="true" aria-label="Extrato para o SCI"
        onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setArrastando(false); }} onDrop={soltar}>
        <button type="button" className="icon-btn sci-upload-fechar" onClick={fechar} title="Fechar (Esc)" aria-label="Fechar"><Icone nome="x" /></button>
        <span className="sci-upload-icone" aria-hidden="true"><Icone nome="landmark" /></span>
        <h3>Extrato para o SCI</h3>
        <p>Traga o <b>extrato do banco em PDF</b> (ou OFX, planilha, foto). Cada linha vira um lançamento, com a contrapartida pelas regras da empresa.</p>
        <div className="sci-upload-area">
          <Icone nome="upload" />
          <span>{vm.lendo ? 'Lendo o extrato…' : 'Arraste o arquivo para cá'}</span>
          <span className="hint">ou</span>
          <button type="button" className="btn btn-primary" onClick={escolher} disabled={vm.lendo}>Escolher o arquivo</button>
        </div>
        <p className="hint sci-upload-pe">Fica só neste navegador, nesta empresa. Nada vai para o banco.</p>
      </div>
    </div>,
    document.body,
  );
}

function PaletaAberta({ vm }: { vm: VmExtratoParaSci }) {
  const p = vm.paleta;
  if (!p) return null;
  if (p.tipo === 'historico') {
    return <Paleta itens={vm.itensDosHistoricos} filtrar={vm.filtrarHistoricos} rotulo={p.lado === 'entrada' ? 'Escolher o histórico do que entrou' : 'Escolher o histórico do que saiu'}
      placeholder="Buscar o histórico pelo número ou pelo nome" unidade={['histórico', 'históricos']} fechar={vm.fecharPaleta} escolher={h => { vm.definirHistoricoPadrao(p.lado, h); vm.fecharPaleta(); }} />;
  }
  return <Paleta itens={vm.itensDasContas} filtrar={vm.filtrarContas} rotulo={p.tipo === 'banco' ? 'Escolher a conta do banco no SCI' : 'Escolher a contrapartida'}
    placeholder="Buscar a conta pelo código, apelido ou nome" unidade={['conta', 'contas']} fechar={vm.fecharPaleta}
    escolher={c => { if (p.tipo === 'banco') vm.definirContaDoBanco(c); else vm.escolherConta(p.chave, c); vm.fecharPaleta(); }} />;
}

/** O botão que mostra a conta (código e nome) e abre a paleta, como a Conta do Visualizar lançamentos. */
function BotaoDaConta({ id, codigo, nome, vazio, abrir, titulo }: { id: string; codigo: string; nome: string; vazio: string; abrir: () => void; titulo: string }) {
  return (
    <button id={id} type="button" className={'sci-razao-conta-botao' + (codigo ? ' escolhida' : '')} onClick={abrir} aria-haspopup="dialog" title={titulo}>
      <span className="sci-razao-conta-cod">{codigo || '—'}</span>
      <span className="sci-razao-conta-nome">{codigo ? nome || 'fora do plano' : vazio}</span>
      <Icone nome="chevronDown" width={16} height={16} />
    </button>
  );
}

function ExtratoAberto({ vm }: { vm: VmExtratoParaSci }) {
  const s = vm.saldo;
  const filtros: { valor: FiltroDoExtratoSci; rotulo: string; n: number }[] = [
    { valor: 'todas', rotulo: 'Todas', n: vm.resumo.linhas },
    { valor: 'branco', rotulo: 'Em branco', n: vm.resumo.emBranco },
    { valor: 'problema', rotulo: 'Com problema', n: vm.comProblema },
    { valor: 'prontas', rotulo: 'Prontas', n: vm.prontos },
    { valor: 'fora', rotulo: 'Fora', n: vm.resumo.ignoradas },
  ];
  return (
    <>
      {/* em cima, como os filtros do Visualizar lançamentos: a conta bancária, a conta dela no SCI, o histórico padrão e o lote */}
      <div className="sci-razao-filtros">
        <div className="sci-razao-filtro">
          <label className="sci-razao-rotulo" htmlFor="sci-ext-banco">Conta bancária</label>
          <select id="sci-ext-banco" className="sci-ext-select" value={vm.banco?.id || ''} onChange={e => vm.escolherBanco(e.target.value)}>
            <option value="">{vm.bancos.length ? 'Escolha a conta…' : 'Sem conta no Cadastro'}</option>
            {vm.bancos.map(b => <option key={b.id} value={b.id}>{b.rotulo}</option>)}
          </select>
        </div>
        <div className="sci-razao-filtro">
          <label className="sci-razao-rotulo" htmlFor="sci-ext-conta">Conta do banco no SCI</label>
          <span className="sci-razao-conta">
            <BotaoDaConta id="sci-ext-conta" codigo={vm.contaDoBanco} nome={vm.nomeDaContaDoBanco} vazio="escolha a conta" abrir={() => vm.abrirPaleta({ tipo: 'banco' })}
              titulo={vm.origemDaContaDoBanco === 'cadastro' ? 'A conta ' + vm.contaDoNads + ' do Cadastro, pelo de/para' : vm.origemDaContaDoBanco === 'aqui' ? 'Escolhida aqui' : 'Escolher a conta'} />
          </span>
        </div>
        {/* o histórico padrão do que entrou e do que saiu (o recebimento não sai como "Pagamento"); o texto do banco vai no complemento */}
        {(['entrada', 'saida'] as const).map(lado => (
          <div key={lado} className="sci-razao-filtro">
            <label className="sci-razao-rotulo" htmlFor={'sci-ext-hist-' + lado}>{lado === 'entrada' ? 'Histórico do que entrou' : 'Histórico do que saiu'}</label>
            <span className="sci-razao-conta">
              <BotaoDaConta id={'sci-ext-hist-' + lado} codigo={vm.historicoPadrao[lado]} nome={vm.nomeDoHistorico(vm.historicoPadrao[lado])} vazio="escolha o histórico"
                abrir={() => vm.abrirPaleta({ tipo: 'historico', lado })} titulo="O número do histórico padrão do SCI; o texto do banco vai no complemento" />
            </span>
          </div>
        ))}
        {/* sem o Lote: a coluna vai vazia na planilha (26/11/2026: "os dados da coluna lote, deixa vazia!") */}
        {s && <SaldoDoExtrato s={s} />}
      </div>
      {/* o que falta para baixar: a conta bancária, a conta do banco no SCI, o CNPJ */}
      <Avisos vm={vm} />

      <div className="sci-razao-filtros sci-ext-barra">
        <span className="sci-razao-tipos" role="group" aria-label="Filtrar as linhas">
          {filtros.map(f => (
            <button key={f.valor} type="button" className={'sci-razao-tipo' + (vm.filtro === f.valor ? ' ativo' : '')} onClick={() => vm.setFiltro(f.valor)}>{f.rotulo} <span>{f.n}</span></button>
          ))}
        </span>
        <label className="busca-curta sci-ext-busca">
          <Icone nome="search" />
          <input type="text" placeholder="Pesquisar no extrato..." aria-label="Pesquisar no extrato" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
      </div>

      <section className="card ini-grupo sci-tabela-card">
        <div className="table-wrap sci-tabela-caixa">
          <table className="table-compact ini-delegadas sci-tabela sci-ext-tabela">
            <thead>
              <tr>
                <th>Data</th><th>Histórico do banco</th><th className="num">Valor</th><th>Débito</th><th>Crédito</th><th>Histórico</th><th aria-label="Situação e ações" />
              </tr>
            </thead>
            <tbody>
              {vm.visiveis.map((l, i) => <LinhaDaGrade key={l.chave} vm={vm} l={l} zebra={i % 2 === 1} />)}
              {!vm.visiveis.length && <tr><td colSpan={7} className="hint sci-razao-nada">Nada com esse filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="sci-razao-registros">
        Prontos para o SCI: <b>{vm.prontos}</b> de <b>{vm.resumo.linhas - vm.resumo.ignoradas}</b> · <b className="num">R$ {sci.valorParaTexto(vm.valorPronto)}</b>
      </p>
      <Regras vm={vm} />
      <p className="hint sci-razao-pe">
        Extrato: {vm.extrato!.arquivo} · lido em {new Date(vm.extrato!.importadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        {vm.extrato!.ocr && ' · lido pelo OCR: confira os valores'}
      </p>
    </>
  );
}

/** Se o extrato fecha com o saldo do banco: o saldo anterior, o movimento, o saldo final e os saldos impressos conferidos. */
function SaldoDoExtrato({ s }: { s: sci.SaldoDoExtrato }) {
  const selo = s.fecha === true ? { classe: 'fecha', icone: 'checkCircle' as const, texto: 'Fecha com o saldo do banco' }
    : s.fecha === false ? { classe: 'nao-fecha', icone: 'alert' as const, texto: s.naoFecham === 1 ? '1 saldo do banco não fecha' : s.naoFecham + ' saldos do banco não fecham' }
    : { classe: 'sem', icone: 'ajuda' as const, texto: 'O extrato não traz saldo por dia para conferir' };
  const dica = s.fecha === false
    ? s.exemplos.map(x => sci.dataParaTexto(x.data) + ': banco ' + comSinal(x.impresso) + ' × lido ' + comSinal(x.calculado)).join('\n')
    : s.fecha ? s.conferidos + ' saldos impressos conferidos com a soma das linhas' : undefined;
  return (
    <div className="sci-razao-filtro sci-ext-saldo">
      <span className={'sci-ext-selo ' + selo.classe} title={dica}><Icone nome={selo.icone} />{selo.texto}</span>
      <span className="sci-ext-saldo-numeros">
        {s.saldoAnterior != null && <span>Saldo anterior <b className="num">{comSinal(s.saldoAnterior)}</b></span>}
        <span>Entradas <b className="num sci-ext-entrou">{valor(s.entradas)}</b></span>
        <span>Saídas <b className="num sci-ext-saiu">{valor(s.saidas)}</b></span>
        {s.saldoFinal != null && <span>Saldo final <b className="num">{comSinal(s.saldoFinal)}</b></span>}
      </span>
    </div>
  );
}

function Avisos({ vm }: { vm: VmExtratoParaSci }) {
  const avisos: string[] = [];
  if (!vm.banco && vm.bancos.length) avisos.push('Escolha a conta bancária do extrato.');
  if (!vm.contaDoBanco) avisos.push(!vm.bancos.length ? 'A empresa não tem conta bancária no Cadastro: escolha a conta do banco no SCI aqui em cima.' : vm.origemDaContaDoBanco === 'semPar' ? 'A conta ' + vm.contaDoNads + ' do Cadastro não tem par no plano do SCI: escolha a conta do banco no SCI.' : 'Falta a conta do banco no SCI: escolha aqui em cima.');
  if (vm.contaDoBancoForaDoPlano) avisos.push('A conta ' + vm.contaDoBanco + ' não está no plano ' + vm.plano + ' do SCI.');
  if (!vm.historicoPadrao.entrada || !vm.historicoPadrao.saida) avisos.push('Escolha o histórico padrão do SCI (o número) do que entrou e do que saiu: sem ele as linhas sem regra não vão.');
  if (!vm.cnpjOk) avisos.push('A empresa está sem CNPJ no Cadastro: a planilha precisa dele.');
  if (!avisos.length) return null;
  return <ul className="sci-ext-avisos">{avisos.map(a => <li key={a}><Icone nome="alert" />{a}</li>)}</ul>;
}

type LinhaVm = VmExtratoParaSci['linhas'][number];

function LinhaDaGrade({ vm, l, zebra }: { vm: VmExtratoParaSci; l: LinhaVm; zebra: boolean }) {
  const entrou = l.valor > 0;
  const nomeDoBanco = vm.nomeDaContaDoBanco;
  // a contrapartida é o lado que não é o banco: o crédito no que entrou, o débito no que saiu
  const contra = (
    <button type="button" className={'sci-ext-contra' + (l.contrapartida ? '' : ' vazia')} disabled={l.ignorada} onClick={() => vm.abrirPaleta({ tipo: 'linha', chave: l.chave })}
      title={l.rotuloDaOrigem + ' · clique para trocar'}>
      {l.contrapartida ? <ContaNaTabela codigo={l.contrapartida} nome={l.nomeDaContrapartida} lado={entrou ? 'credito' : 'debito'} /> : <span>{l.semPar ? 'Sem par no SCI (' + l.semPar + ')' : 'Escolher a conta'}</span>}
    </button>
  );
  const doBanco = <ContaNaTabela codigo={vm.contaDoBanco} nome={nomeDoBanco} lado={entrou ? 'debito' : 'credito'} />;
  const situacao = l.ignorada ? 'fora' : l.problemas.length ? 'problema' : 'pronta';
  return (
    <tr className={'ini-tr sci-ext-linha sci-ext-linha-' + situacao + (zebra ? ' sci-zebra' : '')}>
      <td className="ini-delegadas-curta">{sci.dataParaTexto(l.data)}</td>
      <td className="sci-ext-hist-banco" title={l.historicoDoBanco}>{l.historicoDoBanco}</td>
      <td className={'num sci-valor ' + (entrou ? 'sci-ext-entrou' : 'sci-ext-saiu')}>{comSinal(l.valor)}</td>
      <td>{entrou ? doBanco : contra}</td>
      <td>{entrou ? contra : doBanco}</td>
      <td className="sci-hist"><HistoricoNaTabela codigo={l.historico} nome={l.nomeDoHistorico} complemento={l.complemento} /></td>
      <td className="sci-ext-acoes">
        {situacao === 'pronta' && <span className="sci-ext-ok" title={l.rotuloDaOrigem}><Icone nome="check" /></span>}
        {situacao === 'problema' && <span className="sci-ext-problema" title={l.problemas.join('\n')}><Icone nome="alert" /></span>}
        {!l.ignorada && l.contrapartida && l.origem === 'pessoa' && (
          <button type="button" className="icon-btn" onClick={() => vm.criarRegra(l.chave)} title="Criar regra com esta conta (só no minimum): vale para as próximas linhas iguais" aria-label="Criar regra"><Icone nome="zap" /></button>
        )}
        {l.contaEscolhida && !l.ignorada && <button type="button" className="icon-btn" onClick={() => vm.voltarAoAutomatico(l.chave)} title="Voltar à conta das regras" aria-label="Voltar ao automático"><Icone nome="repeat" /></button>}
        <button type="button" className="icon-btn" onClick={() => vm.ignorar(l.chave, !l.ignorada)} title={l.ignorada ? 'Voltar para a planilha' : 'Tirar da planilha (já lançada de outro jeito)'} aria-label={l.ignorada ? 'Voltar para a planilha' : 'Tirar da planilha'}>
          <Icone nome={l.ignorada ? 'plus' : 'x'} />
        </button>
      </td>
    </tr>
  );
}

/** As regras criadas aqui (só no minimum, nas contas do SCI); as do Lançatudo valem depois delas. */
function Regras({ vm }: { vm: VmExtratoParaSci }) {
  const [aberta, setAberta] = useState(false);
  return (
    <section className="sci-ext-regras">
      <button type="button" className="btn btn-ghost" onClick={() => setAberta(a => !a)} aria-expanded={aberta}>
        <Icone nome={aberta ? 'chevronDown' : 'chevronRight'} />Regras do minimum <span className="menu-contador">{vm.regras.length}</span>
        <span className="hint">· e {vm.regrasDoLancatudo === 1 ? '1 regra' : vm.regrasDoLancatudo + ' regras'} do Lançatudo, pelo de/para</span>
      </button>
      {aberta && (vm.regras.length ? (
        <ul className="sci-ext-regras-lista">
          {vm.regras.map(r => (
            <li key={r.id}>
              <span className="sci-ext-regra-exp">{r.tipo === 'favorecido' ? 'Favorecido ' : ''}“{r.expressao}”</span>
              <span className="hint">{r.sentido === 'entrada' ? 'entrou' : r.sentido === 'saida' ? 'saiu' : 'entrou ou saiu'}</span>
              <span>→ <b>{r.conta}</b> {r.nomeDaConta}{r.codHistorico && <span className="hint"> · histórico {r.codHistorico}</span>}</span>
              <button type="button" className="icon-btn" onClick={() => vm.excluirRegra(r.id)} title="Excluir a regra" aria-label="Excluir a regra"><Icone nome="lixeira" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="hint sci-ext-regras-vazio">Escolha a conta numa linha e clique no raio para criar a regra.</p>)}
    </section>
  );
}
