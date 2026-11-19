// O Lançatudo (17/11/2026: "desenvolver um Mister dentro do nads"): o extrato do banco que o Extrator já leu vira
// lançamentos prontos para importar no Alterdata. Os Lançamentos são a tela do LCDPR no jeito do Alterdata normal (17/11/2026:
// "essa tela de lançamento pode ser a mesma do lcdpr, só que no estilo do alterdata normal"): o resumo com a barra e a planilha,
// a barra (Todos, Só REVISAR, Fora; a seleção; a busca) e a lista com os selos, a conta devedora e a credora (a contrapartida
// trocada na própria linha; o banco fixo), a data, o histórico e o valor; clicar na linha abre o "Lançamentos (Cadastramento)".
// A conta também sai do plano de contas em árvore, como o eContador. Nas Regras, as regras e as contas aprendidas.
// Só desenha: tudo vem dos ViewModels.
import { BotaoIcone, Icone, LogoBanco, MenuSuspenso, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { BotaoImportarNoAlterdata } from '../../../../comum/BotaoImportarNoAlterdata';
import { EmpresaDaBarra } from '../fiscal/partes/EmpresaDaBarra';
import { JanelaDoMes, type AbaDoMes } from './JanelaDoMes';
import { useComprovantesDoLancatudo } from './useComprovantesDoLancatudo';
import { Janela, JanelaDaLinha, JanelaDaRegra, JanelaDoPlano } from './Janelas';
import { useLancatudo, type EmpresaDoLancatudo } from './useLancatudo';
import { useRegistroDoLancatudo } from './useRegistroDoLancatudo';
import { TutorialDoLancatudo } from './TutorialDoLancatudo';
import { useRazaoDoServidor } from './useRazaoDoServidor';
import { useTutorialDoLancatudo } from './useTutorialDoLancatudo';

type Vm = ReturnType<typeof useRegistroDoLancatudo>;
type Entrada = ReturnType<typeof useLancatudo>;
type Linha = Vm['linhas'][number];


export function Lancatudo({ pagina }: { pagina: string }) {
  const entrada = useLancatudo();
  if (!entrada.empresa) {
    return (
      <section className="lt">
        <div className="tarefas-barra-topo"><EmpresaDaBarra vm={entrada} id="lt-empresas" /></div>
        <div className="card lt-cartao">
          <Vazio icone="landmark" titulo="Escolha a empresa"
            texto="Depois o mês e a conta bancária: cada linha do extrato que o Extrator já leu vira um lançamento para o Alterdata, com a contrapartida pelas regras da empresa." />
        </div>
      </section>
    );
  }
  return <EmpresaAberta key={entrada.empresa.codigo + '|' + entrada.competencia} empresa={entrada.empresa} entrada={entrada} pagina={pagina} />;
}

function EmpresaAberta({ empresa, entrada, pagina }: { empresa: EmpresaDoLancatudo; entrada: Entrada; pagina: string }) {
  // o Atualizar (19/11/2026: "atualizar o balancete, ele vai chamar o alterdata do servidor"): o razão do mês pelo robô
  const servidor = useRazaoDoServidor(empresa.codigo, empresa.nome, entrada.competencia);
  const vm = useRegistroDoLancatudo(empresa, entrada.competencia, entrada.banco, servidor.lancamentos);
  useCarregando(!vm.pronto);
  // as Regras numa janela (18/11/2026: a barra lateral saiu); o link antigo das Regras já abre com ela
  const [regrasAbertas, setRegrasAbertas] = useState(pagina === 'regras');
  const rotuloDoBanco = (b: Vm['banco']) => b.nome + (b.conta ? ' ' + b.conta : '');
  // o tutorial (18/11/2026): sozinho na primeira vez que a tela tem lançamentos; de novo pelo botão Tutorial
  const tutorial = useTutorialDoLancatudo(vm.pronto && vm.linhas.length > 0 && !regrasAbertas);
  // o extrato, o razão e os comprovantes do mês aqui mesmo, numa janela só (18/11/2026: "tem que ter como adicionar o extrato
  // aqui ou puxar do drive"; "quero a opção de adicionar comprovantes"; "comprovantes e extratos na mesma tela")
  const comp = useComprovantesDoLancatudo(vm);
  const [abaDoMes, setAbaDoMes] = useState<AbaDoMes | null>(null);
  return (
    <section className="lt">
      {abaDoMes && <JanelaDoMes vm={vm} c={comp} empresa={empresa} aba={abaDoMes} setAba={setAbaDoMes} fechar={() => setAbaDoMes(null)} />}
      {tutorial.aberto && <TutorialDoLancatudo fechar={tutorial.fechar} />}
      {regrasAbertas && (
        <Janela titulo="Regras" fechar={() => setRegrasAbertas(false)} className="lt-janela-regras">
          <div className="registro-corpo"><Regras vm={vm} trocarBanco={entrada.setBanco} /></div>
        </Janela>
      )}
      {vm.linhaAberta && <JanelaDaLinha key={vm.linhaAberta.chave} vm={vm} l={vm.linhaAberta} />}
      {vm.regra && <JanelaDaRegra vm={vm} />}
      {vm.escolhendo && <JanelaDoPlano vm={vm} />}
      <div className="tarefas-barra-topo">
        <span className="lt-topo-escolhas" data-tut="lt-topo">
        <EmpresaDaBarra vm={entrada} id="lt-empresas" />
        <SeletorMes valor={entrada.competencia} onMudar={entrada.setCompetencia} rotulo="Competência" />
        <MenuSuspenso className="btn btn-outline lt-banco" titulo="A conta bancária" largura={280}
          rotulo={<><span className="lt-logo"><LogoBanco banco={vm.banco.marca || 'outro'} cor /></span>{rotuloDoBanco(vm.banco)}</>}
          itens={vm.bancos.map(b => ({ rotulo: <span className="lt-banco-item"><span className="lt-logo"><LogoBanco banco={b.marca || 'outro'} cor /></span>{rotuloDoBanco(b)}</span>, marcado: b.id === vm.banco.id, onClick: () => entrada.setBanco(b.id) }))} />
        </span>
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" data-tut="lt-extrato" onClick={() => setAbaDoMes('extrato')} title="O extrato, o razão e os comprovantes do mês: do computador, do Drive ou do e-mail">
          <Icone nome="upload" />Extrato e comprovantes{vm.comprovantes.length > 0 && <span className="menu-contador" title="Comprovantes do mês">{vm.comprovantes.length}</span>}
        </button>
        <button type="button" className="btn btn-outline" data-tut="lt-regras" onClick={() => setRegrasAbertas(true)} title="As regras da empresa e as contas que o nads aprendeu">
          <Icone nome="settings" />Regras<span className="menu-contador">{vm.regras.length}</span>
        </button>
        {/* o Tutorial por último (18/11/2026: "tutorial fica por último") */}
        {vm.linhas.length > 0 && <button type="button" className="btn btn-ghost" onClick={tutorial.abrir} title="Ver o tutorial desta tela de novo"><Icone nome="ajuda" />Tutorial</button>}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro lt-dica"><Icone nome="alert" />O banco recusou: {vm.erro}</p>}
      {vm.pronto && !vm.contaDoBanco && <ContaDoBanco vm={vm} rotulo={rotuloDoBanco(vm.banco)} />}
      {vm.semPlano && <p className="registro-dica lt-dica"><Icone nome="ajuda" />A empresa ainda não tem plano de contas no Cadastro: o código da conta vale como for digitado, sem conferir.</p>}
      <Lancamentos vm={vm} irParaOMes={entrada.setCompetencia} abrirExtrato={() => setAbaDoMes('extrato')} verComprovante={comp.ver} servidor={servidor} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------------- os lançamentos
/**
 * Sem o código contábil da conta bancária no Cadastro (18/11/2026: "tem que ter como configurar por aqui as contas"): o código
 * aqui mesmo, digitado ou escolhido no plano de contas; fica guardado no Lançatudo da empresa, para esta conta bancária.
 */
function ContaDoBanco({ vm, rotulo }: { vm: Vm; rotulo: string }) {
  const [codigo, setCodigo] = useState('');
  const gravar = () => { if (codigo.trim()) vm.gravarContaDoBanco(codigo); };
  return (
    <div className="lt-conta-banco">
      <span className="lt-conta-banco-texto"><Icone nome="alert" /><span>Falta o código contábil da conta <b>{rotulo}</b>: sem ele não dá para exportar. Digite o código ou escolha no plano.</span></span>
      <input type="text" inputMode="numeric" className="lt-conta-banco-campo" value={codigo} placeholder="Código" aria-label={'O código contábil da conta ' + rotulo}
        onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter') gravar(); }} />
      <button type="button" className="btn btn-sm btn-outline" onClick={vm.abrirPlanoDoBanco}><Icone nome="search" />No plano</button>
      <button type="button" className="btn btn-sm btn-primary" disabled={!codigo.trim()} onClick={gravar}><Icone nome="check" />Gravar</button>
    </div>
  );
}

function Lancamentos({ vm, irParaOMes, abrirExtrato, verComprovante, servidor }: { vm: Vm; irParaOMes: (competencia: string) => void; abrirExtrato: () => void; verComprovante: (c: NonNullable<Linha['comprovante']>) => void; servidor: ReturnType<typeof useRazaoDoServidor> }) {
  const t = vm.totais;
  if (vm.semExtrato) {
    const temOutros = vm.mesesComExtrato.length > 0;
    return (
      <div className="gh-blank">
        <Icone nome="landmark" />
        <h4>{'Sem extrato de ' + vm.banco.nome + ' em ' + vm.rotuloDoMes}</h4>
        <p>Envie o extrato do computador ou puxe do Drive; o razão do mês ajuda a achar as contas.</p>
        <p className="cad-botoes"><button type="button" className="btn btn-primary" onClick={abrirExtrato}><Icone nome="upload" />Adicionar o extrato</button></p>
        {temOutros && (
          <>
            <p className="hint">Ou abra um mês que já tem extrato desta conta:</p>
            <p className="cad-botoes">
              {vm.mesesComExtrato.slice(0, 6).map(m => (
                <button key={m.valor} type="button" className="btn btn-outline" onClick={() => irParaOMes(m.valor)}><Icone nome="calendar" />{m.rotulo}</button>
              ))}
            </p>
          </>
        )}
      </div>
    );
  }
  const revisar = t.pendentes + t.sugeridas;
  const marcadas = vm.selecionadas.size;
  const entradas = vm.linhas.filter(l => l.valor > 0).length;
  return (
    <>
      <section className="card lt-painel">
        <div className="lt-painel-progresso" data-tut="lt-progresso">
          <span className="lt-painel-rotulo">Conciliação de {vm.rotuloDoMes.toLowerCase()} · {vm.banco.nome}{vm.banco.conta ? ' ' + vm.banco.conta : ''}</span>
          <div className="lt-painel-numero">
            <b className="num">{vm.prontas}</b><span>de {t.linhas} {t.linhas === 1 ? 'lançamento pronto' : 'lançamentos prontos'}</span>
          </div>
          <span className="lt-painel-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vm.percentual} aria-label="Lançamentos prontos">
            <span style={{ width: vm.percentual + '%' }} />
          </span>
          <span className="lt-painel-status"><span className={'bolinha-sit ' + vm.situacao.classe} aria-hidden="true" />{vm.situacao.texto}</span>
        </div>
        <div className="lt-painel-total">
          <span className="lt-painel-rotulo"><Icone nome="arrowDown" />Entrou</span>
          <b className="num lt-entrada">R$ {vm.valor(t.entradas)}</b>
          <small>{entradas} {entradas === 1 ? 'lançamento' : 'lançamentos'}</small>
        </div>
        <div className="lt-painel-total">
          <span className="lt-painel-rotulo"><Icone nome="arrowUp" />Saiu</span>
          <b className="num lt-saida">R$ {vm.valor(t.saidas)}</b>
          <small>{t.linhas - entradas} {t.linhas - entradas === 1 ? 'lançamento' : 'lançamentos'}</small>
        </div>
        <div className="lt-painel-acoes">
          <div className="lt-painel-botoes" data-tut="lt-exportar">
            {servidor.disponivel && (
              <button type="button" className="btn btn-outline lt-atualizar" disabled={servidor.andando} onClick={servidor.atualizar}
                title="Pede ao robô do Alterdata do servidor o razão e o balancete do mês: o que já está lançado no Alterdata fica em Fora">
                {servidor.andando ? <span className="btn-spinner" /> : <Icone nome="repeat" />}Atualizar do Alterdata
              </button>
            )}
            <BotaoImportarNoAlterdata codigo={vm.empresa.codigo} empresa={vm.empresa.nome} lote={vm.lote} origem="lancatudo" planilha={vm.planilhaParaOAlterdata}
              disabled={!!vm.motivoSemExportar} motivo={vm.motivoSemExportar} quem={vm.quem} baixar={vm.baixarArquivo} />
            <MenuSuspenso rotulo="Ações" className="btn btn-primary" titulo="Ações" direita flutuante largura={340} itens={[
              { rotulo: 'Exportar lançamentos contábeis (.xls) · ' + vm.paraExportar, icone: 'download', desabilitado: !!vm.motivoSemExportar, onClick: vm.baixarArquivo },
              { rotulo: 'Exportar Simples Conferência (Excel)', icone: 'fileText', desabilitado: !!vm.motivoSemExportar, onClick: vm.baixarConferencia },
              ...(vm.contaDoBanco && !vm.contaDoBancoNoCadastro ? [{ rotulo: 'Código contábil do banco: ' + vm.contaDoBanco + ' (trocar)', icone: 'landmark' as const, onClick: vm.abrirPlanoDoBanco }] : []),
              'separador',
              { rotulo: 'Confirmar as ' + t.sugeridas + ' sugeridas pelo razão', icone: 'check', desabilitado: !t.sugeridas, onClick: vm.confirmarSugeridas },
              { rotulo: 'Levar as sugeridas sem confirmar', icone: 'checklist', marcado: vm.comSugeridas, onClick: () => vm.setComSugeridas(!vm.comSugeridas) },
              'separador',
              { rotulo: 'Selecionar os não conciliados', icone: 'alert', onClick: vm.marcarRevisar },
            ]} />
          </div>
          {servidor.texto && <small className={'lt-painel-nota' + (servidor.comErro ? ' lt-nota-erro' : '')}>{servidor.texto}</small>}
          <small className="lt-painel-nota">{vm.ultimaExportacao || (vm.razaoDoMes ? 'O razão do mês já foi importado: o que já está nele fica em Fora.' : 'Ainda não exportado neste mês.')}</small>
        </div>
      </section>

      <div className="tarefas-barra-topo lt-barra-registro">
        {marcadas > 0 ? (
          <>
            <span className="tarefas-contador"><Icone nome="check" /><b>{marcadas}</b> selecionado(s)</span>
            <button type="button" className="btn btn-primary" onClick={() => vm.abrirPlano([...vm.selecionadas])}><Icone nome="list" />Associar conta contábil</button>
            <button type="button" className="btn btn-outline" onClick={() => vm.ignorar([...vm.selecionadas], true)}>Tirar da exportação</button>
            <button type="button" className="btn btn-ghost" onClick={vm.limparSelecao}>Limpar seleção</button>
          </>
        ) : (
          <span data-tut="lt-filtros"><Segmentado valor={vm.filtro} onMudar={vm.setFiltro} opcoes={[
            { valor: 'todas', rotulo: 'Todos · ' + t.linhas },
            { valor: 'revisar', rotulo: 'Não conciliados · ' + revisar },
            { valor: 'conciliadas', rotulo: 'Conciliados · ' + t.conciliadas },
            { valor: 'fora', rotulo: 'Fora · ' + (t.ignoradas + t.noRazao) },
          ]} /></span>
        )}
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta lt-busca">
          <Icone nome="search" />
          <input type="text" placeholder="Histórico, conta, valor ou CNPJ" aria-label="Buscar por histórico, conta, valor ou CNPJ" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
      </div>

      <div className="table-wrap lt-registro-wrap">
        <table className="lt-registro">
          <colgroup>
            <col className="c-marca" /><col className="c-data" /><col className="c-conta" /><col className="c-valor" /><col /><col className="c-quem" /><col className="c-extra" />
          </colgroup>
          <thead>
            <tr>
              <th><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarVisiveis(e.target.checked)} aria-label="Selecionar os visíveis" /></th>
              <th>Data</th><th>Débito / Crédito</th><th className="num">Valor</th><th>Histórico</th><th className="lt-quem-th">Cliente / Fornecedor</th><th>Informação extra</th>
            </tr>
          </thead>
          {vm.visiveis.map(l => <Partidas key={l.chave} vm={vm} l={l} verComprovante={verComprovante} />)}
          {!vm.visiveis.length && <tbody><tr><td colSpan={7}><Vazio compacto texto="Nenhum lançamento com isso." /></td></tr></tbody>}
          {vm.visiveis.length > 0 && (
            <tfoot>
              <tr>
                <td />
                <td colSpan={2}>{vm.visiveis.length} {vm.visiveis.length === 1 ? 'lançamento' : 'lançamentos'}</td>
                <td className="num">{vm.valor(vm.visiveis.reduce((s, l) => s + Math.abs(l.valor), 0))}</td>
                <td colSpan={3} className="fraco">entrou R$ {vm.valor(t.entradas)} · saiu R$ {vm.valor(t.saidas)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

/** A palavra de onde veio a contrapartida (18/11/2026: "o que significa esses ícones?": a palavra no lugar do ícone). */
const ROTULO_DA_ORIGEM: Record<NonNullable<Linha['origem']>, string> = { regra: 'regra', lembrada: 'aprendida', pessoa: 'manual', razao: 'razão', lancada: 'no razão' };

/** A explicação de onde veio a contrapartida (a dica no mouse). */
const ICONE_DA_ORIGEM: Record<NonNullable<Linha['origem']>, { icone: 'settings' | 'lampada' | 'usuario' | 'repeat'; dica: string }> = {
  regra: { icone: 'settings', dica: 'Associado por regra' },
  lembrada: { icone: 'lampada', dica: 'Aprendido do favorecido' },
  pessoa: { icone: 'usuario', dica: 'Escolhido na linha' },
  razao: { icone: 'repeat', dica: 'Sugerido pelo razão' },
  lancada: { icone: 'checkCircle' as 'repeat', dica: 'Já está no razão do mês: o mesmo valor no mesmo dia, com esta contrapartida' },
};

/** A conta como etiqueta: o código em destaque e o nome ao lado (clicar troca a conta pelo plano de contas, quando dá). */
function EtiquetaDaConta({ codigo, nome, logo, dica, trocar, selo }: { codigo: string; nome?: string; logo?: string; dica?: string; trocar?: () => void; selo?: ReactNode }) {
  // o selo de onde a conta veio (regra, aprendida...) logo depois do nome (18/11/2026: "o regra tá muito longe")
  const conteudo = <>
    <b className="lt-etiqueta-cod">{codigo}</b>
    {logo && <span className="lt-logo lt-etiqueta-logo"><LogoBanco banco={logo} cor /></span>}
    {nome && <span className="lt-etiqueta-nome">{nome}</span>}
    {selo}
  </>;
  if (!trocar) return <span className="lt-etiqueta" title={dica}>{conteudo}</span>;
  return (
    <button type="button" className="lt-etiqueta lt-etiqueta-troca" title={(dica ? dica + ' · ' : '') + 'clique para trocar a conta'} onClick={e => { e.stopPropagation(); trocar(); }}>
      {conteudo}<Icone nome="lapis" />
    </button>
  );
}

/**
 * A contrapartida que falta, digitada na própria linha: o código (Enter ou sair do campo grava; F2 ou a lupa abrem o plano de
 * contas) e o nome ao lado.
 */
function CodigoNaLinha({ vm, l }: { vm: Vm; l: Linha }) {
  const [texto, setTexto] = useState<string | null>(null);
  const atual = l.conta || '';
  const valor = texto ?? atual;
  const gravar = () => {
    if (texto === null) return;
    const novo = texto.trim();
    setTexto(null);
    if (novo && novo !== atual) vm.escolherConta([l.chave], novo);
  };
  const nome = texto !== null ? vm.nomeDaConta(texto.trim()) : l.nomeDaConta;
  return (
    <span className={'lt-codigo' + (l.problema ? ' fora' : '')} onClick={e => e.stopPropagation()} title={l.problema || nome || undefined}>
      <input type="text" inputMode="numeric" value={valor} placeholder="Conta" aria-label={'Contrapartida de ' + l.historicoDoBanco}
        onChange={e => setTexto(e.target.value.replace(/\D/g, ''))} onBlur={gravar}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); gravar(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') setTexto(null);
          if (e.key === 'F2') { e.preventDefault(); setTexto(null); vm.abrirPlano([l.chave]); }
        }} />
      <button type="button" className="lt-codigo-lupa" title="Pesquisar no plano de contas (F2)" aria-label="Pesquisar no plano de contas" onClick={() => vm.abrirPlano([l.chave])}><Icone nome="search" /></button>
      {(nome || valor) && <span className={'lt-codigo-nome' + (nome ? '' : ' vazio')}>{nome || 'fora do plano'}</span>}
    </span>
  );
}

/**
 * O lançamento em duas partidas, como o Lançamentos do Alterdata: a conta devedora (D) em cima e a credora (C) embaixo — o banco
 * é a devedora quando entrou e a credora quando saiu —, o valor uma vez só, no meio do par (18/11/2026: "tá estranho esses
 * números": o valor repetido no débito de uma linha e no crédito da outra). O ícone ao lado da contrapartida diz de onde ela
 * veio; o histórico e a informação extra valem para as duas. A faixa à esquerda diz a situação.
 */
function Partidas({ vm, l, verComprovante }: { vm: Vm; l: Linha; verComprovante: (c: NonNullable<Linha['comprovante']>) => void }) {
  const entrada = l.valor > 0;
  const fora = l.situacao === 'ignorada' || l.situacao === 'no-razao';
  const origem = l.origem ? ICONE_DA_ORIGEM[l.origem] : null;
  const quem = vm.quemDaLinha(l);
  const marcada = vm.selecionadas.has(l.chave);
  const abrir = () => vm.abrirLinha(l.chave);
  const precisaDeConta = !fora && (l.situacao === 'pendente' || !l.conta);
  const banco = <EtiquetaDaConta codigo={l.contaDoBanco || '—'} logo={vm.banco.marca || 'outro'} nome={vm.nomeDoBanco} dica={[vm.banco.nome + (vm.banco.conta ? ' ' + vm.banco.conta : ''), vm.classificacao(l.contaDoBanco)].filter(Boolean).join(' · ')} />;
  const selo = l.origem && (!fora || l.origem === 'lancada') ? <span className={'lt-origem lt-origem-' + l.origem} title={ICONE_DA_ORIGEM[l.origem].dica}>{ROTULO_DA_ORIGEM[l.origem]}</span> : null;
  const contra = (
    <span className="lt-contra">
      {precisaDeConta ? <><CodigoNaLinha vm={vm} l={l} />{selo}</>
        : l.conta ? <EtiquetaDaConta codigo={l.conta} nome={l.nomeDaConta} dica={vm.classificacao(l.conta)} trocar={fora ? undefined : () => vm.abrirPlano([l.chave])} selo={selo} />
          : <span className="lt-sem-conta">—</span>}
    </span>
  );
  const partida = (dc: 'D' | 'C', conteudo: ReactNode) => <td><span className="lt-partida"><span className={'lt-dc lt-dc-' + dc.toLowerCase()}>{dc}</span>{conteudo}</span></td>;
  return (
    <tbody className={'lt-par lt-' + l.situacao + (marcada ? ' marcada' : '')} onClick={abrir} title="Abrir o lançamento">
      <tr className="lt-partida-1">
        <td rowSpan={2} className="lt-marca" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={marcada} onChange={() => vm.marcar(l.chave)} aria-label={'Selecionar ' + l.historicoDoBanco} />
        </td>
        <td rowSpan={2} className="lt-tab lt-data">{vm.dataBR(l.data)}</td>
        {partida('D', entrada ? banco : contra)}
        <td rowSpan={2} className={'num lt-valor ' + (entrada ? 'lt-entrada' : 'lt-saida')}>{vm.valor(l.valor)}</td>
        <td rowSpan={2} className="lt-hist" title={l.historico !== l.historicoDoBanco.trim() ? 'No extrato: ' + l.historicoDoBanco : undefined}>
          <span className="lt-hist-texto">{l.codHistorico && <span className="lt-codhist num">{l.codHistorico}</span>}{l.historico}</span>
          {/* na tela estreita, o cliente ou fornecedor vem aqui (a coluna dele encolhe) */}
          {(quem.nome || quem.documento) && <span className="lt-hist-quem">{l.comprovante && <Icone nome="clipe" />}{[quem.nome, quem.documento].filter(Boolean).join(' · ')}</span>}
        </td>
        <td rowSpan={2} className="lt-quem">
          {/* o cliente ou fornecedor (18/11/2026: "com os comprovantes tem como saber o cliente"): o do comprovante, com o clipe que abre ele */}
          {(l.comprovante || quem.documento) && (
            <span className="lt-quem-caixa">
              {l.comprovante && (
                <button type="button" className="lt-quem-clipe" title={'Ver o comprovante: ' + l.comprovante.nome} aria-label="Ver o comprovante" onClick={e => { e.stopPropagation(); verComprovante(l.comprovante!); }}>
                  <Icone nome="clipe" />
                </button>
              )}
              <span className="lt-quem-textos">
                {quem.nome && <span className="lt-quem-nome" title={quem.nome}>{quem.nome}</span>}
                {quem.documento && <span className="lt-quem-doc num">{quem.documento}</span>}
                {l.comprovante && !quem.nome && !quem.documento && <span className="lt-quem-doc">comprovante sem nome</span>}
              </span>
            </span>
          )}
        </td>
        <td rowSpan={2} className="lt-extra">
          {/* a sugerida pelo razão se resolve no próprio selo (18/11/2026: "não tem como eu resolver esse 'sugerido'?"; "ainda gera
              estranheza" com o selo e um botão embaixo): um selo só, do tamanho dos outros, que confirma a conta (e o nads aprende) */}
          {l.situacao === 'sugerida'
            ? <button type="button" className="badge badge-warn lt-selo-confirmar" title="Sugerido pelo razão: clique para confirmar a conta" onClick={e => { e.stopPropagation(); vm.confirmar(l); }}><Icone nome="check" />Confirmar</button>
            : <span className={SELO[l.situacao].classe} title={origem && !fora ? origem.dica : undefined}>{SELO[l.situacao].rotulo}</span>}

          {l.problema && <span className="lt-extra-texto lt-problema">{l.problema}</span>}
          {l.documento && <span className="lt-extra-texto">Doc. {l.documento}</span>}
        </td>
      </tr>
      <tr className="lt-partida-2">
        {partida('C', entrada ? contra : banco)}
      </tr>
    </tbody>
  );
}

const SELO: Record<Linha['situacao'], { classe: string; rotulo: string }> = {
  pendente: { classe: 'badge badge-warn', rotulo: 'Não conciliado' },
  sugerida: { classe: 'badge badge-warn', rotulo: 'Sugerido' },
  conciliada: { classe: 'badge badge-ok', rotulo: 'Conciliado' },
  ignorada: { classe: 'badge badge-neutral', rotulo: 'Fora' },
  'no-razao': { classe: 'badge badge-neutral', rotulo: 'No razão' },
};

// ------------------------------------------------------------------------------------------------- as regras
/**
 * As Regras numa janela, no jeito da tela de Regras do Mister (18/11/2026: "refaça completamente essa tela"): uma tabela de cada
 * vez (Regras · Contas aprendidas), a busca, e em cada regra o D/C da contrapartida, o que ela procura, a conta na cor do lado,
 * o histórico, a conta bancária (o logo, ou Todas), quantas linhas ela pegou no mês e os botões de alterar e excluir.
 */
function Regras({ vm, trocarBanco }: { vm: Vm; trocarBanco: (banco: string) => void }) {
  const [aba, setAba] = useState<'regras' | 'aprendidas'>('regras');
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const regras = vm.regras.filter(r => !q || (r.descricao || '').toLowerCase().includes(q) || r.expressao.toLowerCase().includes(q) || r.conta.includes(q) || vm.nomeDaConta(r.conta).toLowerCase().includes(q));
  const lembradas = vm.lembradas.filter(l => !q || l.exemplo.toLowerCase().includes(q) || l.conta.includes(q) || l.nome.toLowerCase().includes(q));
  const banco = (id?: string) => vm.bancos.find(b => b.id === id);
  return (
    <div className="lt-regras">
      <div className="lt-regras-banco">
        <span>As regras de</span>
        {/* trocar a conta bancária aqui mesmo (18/11/2026: "tem que ter a opção de trocar lá em cima"): a tela troca junto */}
        <MenuSuspenso className="btn btn-outline lt-banco" titulo="Trocar a conta bancária" largura={280} flutuante
          rotulo={<><span className="lt-logo"><LogoBanco banco={vm.banco.marca || 'outro'} cor /></span>{vm.banco.nome}{vm.banco.conta ? ' ' + vm.banco.conta : ''}</>}
          itens={vm.bancos.map(b => ({ rotulo: <span className="lt-banco-item"><span className="lt-logo"><LogoBanco banco={b.marca || 'outro'} cor /></span>{b.nome}{b.conta ? ' ' + b.conta : ''}</span>, marcado: b.id === vm.banco.id, onClick: () => trocarBanco(b.id) }))} />
        <span>· cada conta bancária tem as suas.</span>
      </div>
      <div className="lt-regras-topo">
        <Segmentado valor={aba} onMudar={setAba} opcoes={[
          { valor: 'regras', rotulo: 'Regras · ' + vm.regras.length },
          { valor: 'aprendidas', rotulo: 'Contas aprendidas · ' + vm.lembradas.length },
        ]} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder={aba === 'regras' ? 'Texto, conta ou descrição' : 'Favorecido ou conta'} aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} />
        </label>
        {aba === 'regras' && <button type="button" className="btn btn-primary" onClick={() => vm.novaRegra()}><Icone nome="plus" />Nova regra</button>}
      </div>

      {aba === 'regras' ? (
        regras.length ? (
          <table className="lt-tabela-regras">
            <colgroup><col className="c-dc" /><col /><col className="c-conta" /><col className="c-hist" /><col className="c-banco" /><col className="c-por" /><col className="c-mes" /><col className="c-acoes" /></colgroup>
            <thead><tr><th>Quando</th><th>Regra</th><th>Contrapartida</th><th>Histórico</th><th>Conta bancária</th><th>Criada por</th><th className="num">No mês</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {regras.map(r => {
                const dc = r.sentido === 'saida' ? 'd' : r.sentido === 'entrada' ? 'c' : 'dc';
                const b = banco(r.banco);
                const n = vm.linhasDaRegra[r.id] || 0;
                return (
                  <tr key={r.id} onClick={() => vm.editarRegra(r.id)} title="Alterar a regra">
                    <td><span className={'lt-quando lt-quando-' + dc}>{dc === 'd' ? 'Saiu' : dc === 'c' ? 'Entrou' : 'Os dois'}</span></td>
                    <td>
                      <span className="lt-regra-nome">{r.descricao || r.expressao}</span>
                      <span className="lt-regra-procura">{r.tipo === 'favorecido' ? 'favorecido é' : 'histórico tem'} <b>{r.expressao}</b></span>
                    </td>
                    <td>
                      <span className={'lt-etiqueta lt-etiqueta-' + (dc === 'c' ? 'c' : 'd')}><b className="lt-etiqueta-cod">{r.conta}</b><span className="lt-etiqueta-nome">{vm.nomeDaConta(r.conta) || 'fora do plano'}</span></span>
                    </td>
                    <td>
                      <span className="lt-regra-hist">{r.codHistorico && <span className="lt-codhist num">{r.codHistorico}</span>}{r.historico || <i>o do extrato</i>}</span>
                      {r.historico && r.comHistoricoDoExtrato && <span className="lt-regra-procura">+ o histórico do extrato</span>}
                    </td>
                    <td>{b ? <span className="lt-regra-banco"><span className="lt-logo"><LogoBanco banco={b.marca || 'outro'} cor /></span>{b.conta || b.nome}</span> : <span className="lt-regra-todas">Todas</span>}</td>
                    <td title={r.alteradaPor ? 'Alterada por ' + r.alteradaPor + (r.alteradaEm ? ' em ' + vm.dataBR(r.alteradaEm) : '') : undefined}>
                      <span className="lt-regra-por">{r.por || '—'}</span>
                      {r.criadaEm && <span className="lt-regra-procura">{vm.dataBR(r.criadaEm)}</span>}
                    </td>
                    <td className="num"><span className={'lt-regra-qtd' + (n ? '' : ' zero')}>{n}</span></td>
                    <td className="lt-regra-acoes" onClick={e => e.stopPropagation()}>
                      <BotaoIcone pequeno icone="lapis" titulo="Alterar a regra" onClick={() => vm.editarRegra(r.id)} />
                      <BotaoIcone pequeno icone="lixeira" titulo="Excluir a regra (as linhas dela voltam a ficar sem conta)" onClick={() => vm.excluirRegra(r.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Vazio compacto icone="settings" titulo={q ? 'Nenhuma regra com essa busca' : 'Nenhuma regra ainda'} texto={q ? undefined : 'Crie pela Nova regra, ou abra um lançamento e use o "Criar regra com este lançamento" (ela já vem preenchida).'} />
      ) : (
        lembradas.length ? (
          <table className="lt-tabela-regras">
            <colgroup><col className="c-dc" /><col /><col className="c-conta" /><col className="c-banco" /><col className="c-acoes" /></colgroup>
            <thead><tr><th>Quando</th><th>Favorecido</th><th>Conta</th><th>Quem ensinou</th><th aria-label="Esquecer" /></tr></thead>
            <tbody>
              {lembradas.map(l => {
                const dc = l.sentido === 'Entrou' ? 'c' : 'd';
                return (
                  <tr key={l.chave}>
                    <td><span className={'lt-quando lt-quando-' + dc}>{l.sentido}</span></td>
                    <td>
                      <span className="lt-regra-nome">{l.exemplo}</span>
                      <span className="lt-regra-procura">{l.chave.includes(':doc:') ? 'reconhecido pelo CPF/CNPJ' : 'reconhecido pelo nome'} <b>{l.chave.slice(2).replace(/^doc:/, '').replace(/^nome:/, '')}</b></span>
                    </td>
                    <td><span className={'lt-etiqueta lt-etiqueta-' + dc}><b className="lt-etiqueta-cod">{l.conta}</b><span className="lt-etiqueta-nome">{l.nome || 'fora do plano'}</span></span></td>
                    <td className="lt-regra-todas">{l.por || '—'}</td>
                    <td className="lt-regra-acoes"><BotaoIcone pequeno icone="x" titulo="Esquecer: nos outros meses, o favorecido volta a ficar sem conta" onClick={() => vm.esquecer(l.chave)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Vazio compacto icone="lampada" titulo={q ? 'Nada com essa busca' : 'Nenhuma conta aprendida ainda'} texto={q ? undefined : 'Quando alguém escolhe a conta de um lançamento, o nads lembra o favorecido (o CPF/CNPJ ou o nome) e usa a mesma conta nos outros meses.'} />
      )}
    </div>
  );
}
