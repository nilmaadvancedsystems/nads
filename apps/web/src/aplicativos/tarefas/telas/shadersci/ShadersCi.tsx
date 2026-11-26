// O ShadersCI (23/11/2026: "Vamos buildar um aplicativo chamado ShadersCI … uma abinha de lançamentos onde o usuario lance,
// adicione, remova, edite … copie e cole com o botao direito"): a aba de lançamentos do SCI, limpa. Em cima, a empresa, o plano
// padrão (90113 ou 90011) e o CNPJ; o formulário do lançamento (a data, o débito e o crédito pelo código do plano com a lupa, o
// valor, o histórico do plano de históricos, o complemento, o documento e o participante na frente da conta que pede); embaixo, a tabela, com o botão
// direito (editar, duplicar, inverter, copiar, colar, excluir) e os atalhos do Excel. Sai na planilha do gerador do SCI.
import { empresas, sci } from '@nads/core';
import { BotaoIcone, CampoDataComCalendario, Icone, Interruptor, LogoExcel, MenuSuspenso, Segmentado } from '@nads/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { AcoesDoTopo, TituloDoTopo } from '../../../../comum/topo';
import { MenuDeContexto, type LinhaDoMenu, type MenuAberto } from '../drive/MenuDeContexto';
import { Janela, NomeDoAppDasJanelas } from '../lancatudo/Janelas';
import { Lancatudo } from '../lancatudo/Lancatudo';
import { BalaoDeGuia } from './BalaoDeGuia';
import { ContaNaTabela, HistoricoNaTabela } from './CelulasDaTabela';
import { LogoDoMinimum } from './LogoDoMinimum';
import { Paleta, type ItemDaPaleta } from './Paleta';
import { BaixaNoCaixa } from './BaixaNoCaixa';
import { ExtratoParaSci } from './ExtratoParaSci';
import { RazaoDoSci, temConsultaDoSci } from './RazaoDoSci';
import { useShadersCi, type ColunaDosLancamentos, type Formulario, type VmShadersCi } from './useShadersCi';

export function ShadersCi() {
  const vm = useShadersCi();
  if (!vm.carregada) return null;
  // os Lançamentos do SCI e o Extratudo, dentro da empresa (25/11/2026); sem app aberto, a tela inicial com os dois
  const lancamentos = vm.app === 'lancamentos';
  return (
    <section className="sci">
      {/* o título da página é a empresa aberta, no lugar de "minimum" (24/11/2026: "troque o titulo minimum pelo nome da empresa numero e nome") */}
      <TituloDoTopo titulo={vm.empresa?.nome || ''} selo={vm.empresa?.codigo != null ? String(vm.empresa.codigo) : undefined}
        aoTrocar={vm.empresa ? () => { void vm.trocarEmpresa(); } : undefined} dicaDoTrocar="Os apps e a troca de empresa"
        // o clique no nome abre os outros apps e o Trocar de empresa, que volta para a escolha (25/11/2026: "Clicando nessa tela ele
        // pode sair, que vai voltar para tela inicial de selecao de empresa. Ou aparece o nome dos outros aplicativos")
        menu={vm.empresa ? [
          ...vm.apps.filter(a => a !== vm.app).map(a => ({
            rotulo: a === 'lancamentos' ? 'Lançamentos' : a === 'extratudo' ? 'Extratudo' : a === 'extrato' ? 'Extrato → SCI' : a === 'baixa' ? 'Baixa no caixa' : 'Visualizar lançamentos',
            icone: a === 'lancamentos' ? 'list' as const : a === 'extratudo' ? 'landmark' as const : a === 'extrato' || a === 'baixa' ? 'upload' as const : 'olho' as const, onClick: () => vm.abrirApp(a),
          })),
          { rotulo: 'Trocar de empresa', icone: 'trocar' as const, separado: true, onClick: () => { void vm.trocarEmpresa(); } },
        ] : undefined} />
      {/* a janela do lançamento e, por cima dela, a do plano (F2) */}
      {/* a mesma janela: o lançamento simples ou, com a caixinha marcada, o múltiplo */}
      {lancamentos && vm.janela && (vm.multiplo ? <JanelaDoMultiplo vm={vm} /> : <JanelaDoLancamento vm={vm} />)}
      {lancamentos && (vm.pesquisa === 'historico' ? <JanelaDosHistoricos vm={vm} /> : vm.pesquisa && <JanelaDoPlano vm={vm} lado={vm.pesquisa} />)}
      {/* os botões na linha do título, sem a barra da empresa (24/11/2026: "remove isso e deixa alinhado com os botoes novo
          lancamento e planilha do sci"); trocar de empresa fica nas setas ao lado do nome, no título */}
      <AcoesDoTopo>
        {/* sem o selo do plano e sem o campo do CNPJ (24/11/2026: "remove isso"): o plano e o CNPJ vêm do Cadastro da empresa;
            só a empresa sem plano no Cadastro ainda escolhe aqui */}
        {lancamentos && !vm.planoDoCadastro && <Segmentado<sci.IdDoPlanoSci> valor={vm.plano} onMudar={vm.setPlano} opcoes={vm.planos.map(p => ({ valor: p.id, rotulo: p.rotulo }))} />}
        {vm.dev && vm.app !== 'extratudo' && vm.app !== 'razao' && vm.app !== 'extrato' && vm.app !== 'baixa' && (
          <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={300} titulo="Modo desenvolvedor · fica só neste navegador"
            itens={vm.empresa ? [
              { rotulo: 'Lançamentos de exemplo (' + vm.plano + ')', icone: 'zap', onClick: vm.teste.preencher },
              'separador',
              { rotulo: 'Apagar os lançamentos', icone: 'x', desabilitado: !vm.total, onClick: vm.teste.apagar },
            ] : [
              { rotulo: 'Marcar 4 empresas no SCI', icone: 'zap', onClick: vm.teste.marcarSci },
              'separador',
              { rotulo: 'Desmarcar as de teste', icone: 'x', desabilitado: !vm.teste.temSciDeTeste, onClick: vm.teste.desmarcarSci },
            ]} />
        )}
        {/* o Novo lançamento ao lado da Planilha do SCI (24/11/2026: "vai abrir uma popup, ai vai aparecer os dados para fazer o lançamento");
            só os ícones, com o nome no hover (25/11/2026: "novo lancamento e planilha, deixa so os icones") */}
        {/* o + em destaque e o Excel sem cor (25/11/2026: "excel deixa sem cor. e coloque em destaque o +") */}
        {/* sem lançamento, o + pulsa para guiar (25/11/2026: "ao inves de nao aparecer nada, deixa o botao piscando para o usuario ficar guiado") */}
        {lancamentos && vm.total > 0 && <button type="button" className="btn btn-primary sci-btn-icone" onClick={vm.novoLancamento} title="Novo lançamento" aria-label="Novo lançamento"><Icone nome="plus" /></button>}
        {/* e o balão de guia embaixo dele (25/11/2026: "Coloca um balao tbm aqui, de guia") */}
        {lancamentos && !vm.total && (
          <BalaoDeGuia texto={<><b>Comece por aqui:</b> crie o primeiro lançamento</>}>
            <button type="button" className="btn btn-primary sci-btn-icone sci-btn-pulsa" onClick={vm.novoLancamento} title="Novo lançamento" aria-label="Novo lançamento"><Icone nome="plus" /></button>
          </BalaoDeGuia>
        )}
        {/* o olho, ao lado do +, abre o razão do SCI noutra tela; voltou junto do botão central (25/11/2026: "Deixa o icone do olho,
            vai ser bom"): o central só aparece com a tela zerada, o olho sempre */}
        {lancamentos && <button type="button" className="btn btn-outline sci-btn-icone" onClick={() => vm.abrirApp('razao')} title="Visualizar lançamentos do SCI" aria-label="Visualizar lançamentos do SCI"><Icone nome="olho" /></button>}
        {lancamentos && <button type="button" className="btn btn-outline sci-btn-icone" disabled={!vm.podeExportar} onClick={vm.exportar} title="Planilha do SCI: a planilha para o gerador do SCI (linha inicial 2, descarta 0 no fim), pronta para importar" aria-label="Baixar a Planilha do SCI"><LogoExcel /></button>}
        {/* a busca na linha dos botões, para economizar espaço (25/11/2026: "Deixa na mesma linha da barra de pesquisa"), a última da
            fila, na extrema direita (25/11/2026: "Busca na extrema direita, perdao, o ultimo da fila") */}
        {lancamentos && <FiltroEBusca vm={vm} />}
      </AcoesDoTopo>
      {/* o Extratudo é o Lançatudo, com a empresa daqui: o mesmo leitor de extrato do fluxo de tarefas do Contábil */}
      {/* o Extrato → SCI (25/11/2026): o PDF do extrato direto na planilha do SCI, só no navegador */}
      {/* a Baixa no caixa (26/11/2026): as vendas da consulta do SCI viram a baixa D Caixa × C Clientes, na planilha do SCI */}
      {lancamentos ? <Tabela vm={vm} /> : vm.app === 'razao' ? <RazaoDoSci vm={vm} /> : vm.app === 'extrato' ? <ExtratoParaSci min={vm} /> : vm.app === 'baixa' ? <BaixaNoCaixa min={vm} /> : vm.app === 'extratudo' ? <NomeDoAppDasJanelas value="Extratudo"><Lancatudo pagina="lancamentos" minimum={vm.extratudo} /></NomeDoAppDasJanelas> : <TelaInicial vm={vm} />}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------- a tela inicial
/**
 * A tela inicial (24/11/2026: "Faz uma tela inicial bem bonita, com animações"): a logo no centro e, embaixo dela, sem empresa, a
 * escolha (o botão que abre a paleta das empresas do SCI; 25/11/2026: "coloque outra maneira de selecionar as empresas, uma coisa
 * mais premium"); com empresa, os apps (25/11/2026: "Apos entrar, voce vai manter a logo nesse lugar fixo e vai trocar, escolha
 * sua empresa e apenas empresas que estao no sci"). A logo e o lugar embaixo dela têm a mesma altura nos dois: a logo não se mexe.
 * Só as empresas ligadas em Configurações › Dados da empresa › Está no SCI.
 */
function TelaInicial({ vm }: { vm: VmShadersCi }) {
  return (
    <div className="sci-inicio">
      {/* sem a logo do SCI em cima (25/11/2026: "Tira a logo do sci e deixe os elementos centralizados na tela") */}
      <span className="sci-inicio-marca">
        <LogoDoMinimum className="sci-inicio-logo" />
        {/* o slogan, embaixo do nome (25/11/2026: "Na verdade o slogan do minimum e esse, deixa abaixo do nome nessa tela de inicio") */}
        <span className="sci-slogan">O mínimo que nem todos fazem</span>
      </span>
      <div className="sci-inicio-corpo">
        {vm.empresa ? <AppsDaEmpresa key="apps" vm={vm} /> : <EscolhaDaEmpresa key="escolha" vm={vm} />}
      </div>
    </div>
  );
}

function EscolhaDaEmpresa({ vm }: { vm: VmShadersCi }) {
  const lista = vm.empresasDoSci;
  const [aberta, setAberta] = useState(false);
  // o ⌘K (Ctrl+K) abre de qualquer lugar da tela
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberta(true); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div className="sci-escolha">
      {/* o "Escolha sua empresa" sai da tela (25/11/2026) e fica só para o leitor de tela */}
      <h1 className="sr-only">Escolha sua empresa</h1>
      {/* sem o "Apenas empresas que estão no SCI" (25/11/2026: "Remove isso, nao achei que ficou bom") */}
      {lista.length > 0 ? (
        // sem a lupa (25/11/2026: "Tira esse icone")
        <button type="button" className="sci-escolher" onClick={() => setAberta(true)} aria-haspopup="dialog">
          <span className="sci-escolher-rotulo">Selecionar empresa</span>
        </button>
      ) : (
        <p className="sci-inicio-nenhuma">Nenhuma empresa ligada no SCI ainda. Ligue em Configurações › Empresas › Dados da empresa › <b>Está no SCI</b>.</p>
      )}
      {aberta && <PaletaDeEmpresas lista={lista} escolher={e => { setAberta(false); vm.entrada.escolher(e); }} fechar={() => setAberta(false)} />}
    </div>
  );
}

type EmpresaDoSci = VmShadersCi['empresasDoSci'][number];

/** A paleta das empresas (o ⌘K): a paleta comum, com o código, o nome e o regime; a busca é a das empresas do escritório. */
function PaletaDeEmpresas({ lista, escolher, fechar }: { lista: readonly EmpresaDoSci[]; escolher: (e: EmpresaDoSci) => void; fechar: () => void }) {
  const itens = useMemo(() => lista.map(e => ({ chave: String(e.codigo), codigo: String(e.codigo), nome: e.nome, dica: e.regime })), [lista]);
  const filtrar = useCallback((_: readonly ItemDaPaleta[], q: string) => {
    const achadas = new Set(empresas.buscarEmpresas(lista, q).map(e => String(e.codigo)));
    return itens.filter(i => achadas.has(i.chave));
  }, [lista, itens]);
  return (
    <Paleta itens={itens} filtrar={filtrar} rotulo="Escolher a empresa" placeholder="Buscar pelo código ou pelo nome" unidade={['empresa', 'empresas']} fechar={fechar}
      escolher={chave => { const e = lista.find(x => String(x.codigo) === chave); if (e) escolher(e); }} />
  );
}

/** Os apps da empresa: os Lançamentos do SCI e o Extratudo; entram já com a empresa aberta. */
function AppsDaEmpresa({ vm }: { vm: VmShadersCi }) {
  // sem ícones nem caixas (25/11/2026: "Nao gostei, apresenta de outra forma sem essas logos"): o número, o nome e a frase, como
  // um índice; ao passar o mouse, o nome sublinha e a seta anda
  return (
    <nav className="sci-apps" aria-label="Apps da empresa">
      <button type="button" className="sci-app" onClick={() => vm.abrirApp('lancamentos')}>
        <span className="sci-app-num">01</span>
        <span className="sci-app-nome">Lançamentos<span className="sci-app-seta" aria-hidden="true">→</span></span>
        <span className="sci-app-desc">Digite e baixe a planilha do SCI</span>
      </button>
      {vm.apps.includes('extratudo') && (
        <>
          <span className="sci-apps-divisor" aria-hidden="true" />
          <button type="button" className="sci-app" onClick={() => vm.abrirApp('extratudo')}>
            <span className="sci-app-num">02</span>
            <span className="sci-app-nome">Extratudo<span className="sci-app-seta" aria-hidden="true">→</span></span>
            <span className="sci-app-desc">Conciliação bancária</span>
          </button>
        </>
      )}
      {vm.apps.includes('extrato') && (
        <>
          <span className="sci-apps-divisor" aria-hidden="true" />
          <button type="button" className="sci-app" onClick={() => vm.abrirApp('extrato')}>
            <span className="sci-app-num">03</span>
            <span className="sci-app-nome">Extrato → SCI<span className="sci-app-seta" aria-hidden="true">→</span></span>
            <span className="sci-app-desc">Do PDF do banco à planilha do SCI</span>
          </button>
        </>
      )}
      {vm.apps.includes('baixa') && (
        <>
          <span className="sci-apps-divisor" aria-hidden="true" />
          <button type="button" className="sci-app" onClick={() => vm.abrirApp('baixa')}>
            <span className="sci-app-num">04</span>
            <span className="sci-app-nome">Baixa no caixa<span className="sci-app-seta" aria-hidden="true">→</span></span>
            <span className="sci-app-desc">Das vendas do SCI à baixa no caixa</span>
          </button>
        </>
      )}
    </nav>
  );
}

// ------------------------------------------------------------------------------------------------- o formulário
function Campo({ id, rotulo, valor, mudar, placeholder, numerico, classe, autoFocus }: {
  id: string; rotulo: string; valor: string; mudar: (v: string) => void; placeholder?: string; numerico?: boolean; classe?: string; autoFocus?: boolean;
}) {
  return (
    <div className={'field' + (classe ? ' ' + classe : '')}>
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} type="text" inputMode={numerico ? 'decimal' : undefined} autoComplete="off" placeholder={placeholder} value={valor} autoFocus={autoFocus} onChange={e => mudar(e.target.value)} />
    </div>
  );
}

/** O código, a lupa (F2) e o nome ao lado: o campo de conta do Alterdata (o mesmo do LCDPR e do Lançatudo), e o do histórico. */
function CodigoComLupa({ id, rotulo, valor, mudar, lupa, dicaDaLupa, nome, achou, classeDoNome, placeholder, classe }: {
  id: string; rotulo: string; valor: string; mudar: (v: string) => void; lupa: () => void; dicaDaLupa: string; nome: string; achou: boolean;
  classeDoNome?: string; placeholder: string; classe?: string;
}) {
  return (
    <div className={'field sci-conta' + (classe ? ' ' + classe : '')}>
      <label htmlFor={id}>{rotulo}</label>
      <span className="lcdpr-codigo">
        <input id={id} type="text" className="lcdpr-cod" value={valor} autoComplete="off" placeholder={placeholder}
          onChange={e => mudar(e.target.value)} onKeyDown={e => { if (e.key === 'F2') { e.preventDefault(); lupa(); } }} />
        <button type="button" className="lcdpr-lupa" title={dicaDaLupa + ' (F2)'} aria-label={dicaDaLupa} onClick={lupa}><Icone nome="search" /></button>
        <span className={'lcdpr-cod-nome' + (classeDoNome ? ' ' + classeDoNome : '') + (achou ? '' : ' vazio')} title={nome}>{nome}</span>
      </span>
    </div>
  );
}

/**
 * A conta de um lado e, na frente dela, o participante, só quando a conta pede (24/11/2026: "O participante, gostaria de colocar
 * ele na frente, nao deixar no canto inferior"): o cliente no crédito da Clientes nacionais (CD) e o fornecedor no débito da
 * Fornecedores (FD).
 */
function ContaComParticipante({ vm, lado }: { vm: VmShadersCi; lado: 'debito' | 'credito' }) {
  const conta = lado === 'debito' ? vm.contaD : vm.contaC;
  const valor = vm.form[lado];
  const rotulo = lado === 'debito' ? 'Débito' : 'Crédito';
  const nome = !conta ? (valor ? 'Não está no plano' : 'Pesquise pela lupa (F2)')
    : conta.foraDoLado ? conta.nome + ' (só a ' + (lado === 'debito' ? 'crédito' : 'débito') + ')'
    : conta.nome + (conta.analitica ? '' : ' (sintética)');
  const campoDoPart = lado === 'debito' ? 'participanteD' : 'participanteC';
  return <>
    <CodigoComLupa id={'sci-' + lado} rotulo={rotulo} valor={valor} mudar={v => vm.mudar(lado, v)} lupa={() => vm.abrirPesquisa(lado)}
      dicaDaLupa={'Pesquisar a conta de ' + rotulo.toLowerCase()} nome={nome} achou={!!conta && !conta.foraDoLado} classeDoNome={'lt-cod-nome-' + (lado === 'debito' ? 'd' : 'c')}
      placeholder="Código ou apelido" classe={conta?.participante ? 'sci-dois-tercos' : undefined} />
    {conta?.participante && (
      <Campo id={'sci-part-' + lado} rotulo={conta.participante === 'cliente' ? 'Cliente (participante)' : 'Fornecedor (participante)'} valor={vm.form[campoDoPart]}
        mudar={v => vm.mudar(campoDoPart, v)} placeholder="Código no SCI" classe="sci-terco" />
    )}
  </>;
}

/**
 * A janela do lançamento (24/11/2026: "um botão do lado de planilha do sci, chamado novo lançamento, vai abrir uma popup, ai
 * vai aparecer os dados para fazer o lançamento, data, debito, credito, valor..."): a data (com a máscara e o calendário, sem
 * sábado nem feriado nacional), o valor e o documento; o débito e o crédito com a lupa (F2), cada um com o participante na
 * frente quando a conta pede; o histórico do plano de históricos (com a lupa) e o complemento. Tudo obrigatório (o complemento
 * não, no histórico que pula). Enter lança e a janela fica aberta para o próximo, na mesma data; a edição (Editar ou dois
 * cliques na linha) grava e fecha; Esc fecha.
 */
function JanelaDoLancamento({ vm }: { vm: VmShadersCi }) {
  const campo = (c: keyof Formulario) => (v: string) => vm.mudar(c, v);
  const titulo = vm.editando ? 'Editar lançamento' : 'Novo lançamento';
  // a janela abre na data
  useEffect(() => { document.getElementById('sci-data')?.focus(); }, []);
  const h = vm.historico;
  return (
    <Janela app="minimum" titulo={titulo} topo={<ChaveDoMultiplo vm={vm} />} fechar={vm.fecharJanela} className="sci-janela-lancamento"
      pe={<>
        {/* sem a lista do que falta (24/11/2026: "Nao gostei desses avisos, as vezes e so bloquear"): o Lançar só fica bloqueado;
            e sem a dica das teclas ("remove isso") */}
        <span className="tarefas-barra-espaco" />
        <BotoesDoPe vm={vm} editando={!!vm.editando} form="sci-form" lancar="Lançar" podeLancar={vm.podeLancar} />
      </>}>
      <form id="sci-form" className="registro-corpo sci-form" onSubmit={e => { e.preventDefault(); vm.gravar(); }}>
        {/* a data menor, já no formato ao digitar, e o calendário (24/11/2026: "diminui o input de data, tá grande, ao preencher, ele já coloca no formato") */}
        <div className="field sci-meia sci-data">
          {/* o dia da semana ao lado do rótulo (24/11/2026: "Deixa aparecendo o dia da semana, ao usuario lançar") */}
          <label htmlFor="sci-data">Data{vm.diaDaSemana && <span className="sci-dia-semana"> · {vm.diaDaSemana}</span>}</label>
          <CampoDataComCalendario id="sci-data" rotulo="Data" valor={vm.form.data} onMudar={campo('data')} bloqueado={vm.diaSemLancamento} />
        </div>
        <Campo id="sci-valor" rotulo="Valor" valor={vm.form.valor} mudar={campo('valor')} placeholder="0,00" numerico classe="sci-meia" />
        <ContaComParticipante vm={vm} lado="debito" />
        <ContaComParticipante vm={vm} lado="credito" />
        <CodigoComLupa id="sci-historico" rotulo="Histórico" valor={vm.form.historico} mudar={campo('historico')} lupa={() => vm.abrirPesquisa('historico')}
          dicaDaLupa="Pesquisar no plano de históricos" nome={h ? h.nome : vm.form.historico ? 'Não está no plano de históricos' : 'Pesquise pela lupa (F2)'} achou={!!h} placeholder="Número ou apelido" />
        {/* o complemento é opcional (24/11/2026: "o complemento nao e obrigatorio") */}
        <Campo id="sci-complemento" rotulo="Complemento (opcional)" valor={vm.form.complemento} mudar={campo('complemento')}
          placeholder={h?.pulaComplemento ? 'O histórico já diz tudo' : 'O que completa o histórico'} />
        {/* o documento por último (24/11/2026: "Documento deixa por ultimo") */}
        <Campo id="sci-documento" rotulo="Documento" valor={vm.form.documento} mudar={campo('documento')} classe="sci-terco" />
      </form>
    </Janela>
  );
}

/**
 * Os botões do pé das duas janelas (24/11/2026: "deixa a opcao fechar, lancar e salvar"): no novo, Salvar (guarda o preenchido
 * sem lançar; o próximo Novo lançamento abre nele) e Lançar, sem o Fechar (24/11/2026: "Remove esse botao fechar"; fecha pelo X
 * e pelo Esc); na edição, Cancelar e Salvar alteração.
 */
function BotoesDoPe({ vm, editando, form, lancar, podeLancar }: { vm: VmShadersCi; editando: boolean; form: string; lancar: string; podeLancar: boolean }) {
  return (
    <>
      {editando && <button type="button" className="btn btn-ghost" onClick={vm.fecharJanela}>Cancelar</button>}
      {!editando && <button type="button" className="btn btn-outline" onClick={vm.salvarRascunho} disabled={!vm.podeSalvar}>Salvar</button>}
      <button type="submit" form={form} className="btn btn-primary" disabled={!podeLancar}><Icone nome={editando ? 'check' : 'plus'} />{editando ? 'Salvar alteração' : lancar}</button>
    </>
  );
}

// ------------------------------------------------------------------------------------------------- o lançamento múltiplo
/**
 * A chave do múltiplo, no topo da janela, na linha do X (24/11/2026: "coloca uma opção de marcar"; "Deixa o botao fechar na mesma
 * linha do lancamento multiplo, use o elemento on/off toggle para ficar bonito"): ligada, abre vários débitos e créditos que têm
 * de bater. Na edição só mostra o tipo (apagada, sem clique).
 */
function ChaveDoMultiplo({ vm }: { vm: VmShadersCi }) {
  const editando = !!vm.editando || !!vm.multiplo?.editando;
  const mudar = () => { if (!editando) vm.marcarMultiplo(!vm.multiplo); };
  return (
    <span className={'sci-chave-multiplo' + (editando ? ' travada' : '')} title={editando ? 'Na edição o tipo do lançamento não muda' : undefined}>
      <Interruptor ligado={!!vm.multiplo} rotulo="Lançamento múltiplo" onMudar={mudar} semTexto />
      <span className="sci-chave-multiplo-rotulo" onClick={mudar}>Lançamento múltiplo</span>
    </span>
  );
}

/**
 * A janela do lançamento múltiplo (24/11/2026: "aqui tem uma exportação de lançamentos multiplos do sci, tenta entender como
 * funciona e aplica no nads, uma funcao chamada lançamento multiplo, onde debito e credito tem que bater com partidas simples"):
 * como a transação do SCI, a data e o documento valem para todas as partidas; cada partida tem um lado só (débito ou crédito),
 * a conta com a lupa, o participante quando a conta pede (CD só a crédito, FD só a débito), o valor, o histórico e o
 * complemento. Embaixo, os totais: só lança com os débitos iguais aos créditos. A partida nova já vem no lado e no valor que
 * faltam para bater.
 */
function JanelaDoMultiplo({ vm }: { vm: VmShadersCi }) {
  const m = vm.multiplo!;
  const t = vm.totaisDoMultiplo;
  // abre na primeira conta (o que já foi digitado no simples vem junto)
  useEffect(() => { document.querySelector<HTMLInputElement>('.sci-mp-conta input')?.focus(); }, []);
  const pronto = !vm.problemasDoMultiplo.length;
  // arrastar as linhas pela alça (24/11/2026: "De a opcao do usuario organizar as linhas arrastando")
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const soltar = () => { setArrastando(null); setSobre(null); };
  return (
    <Janela app="minimum" titulo={m.editando ? 'Editar lançamento múltiplo' : 'Novo lançamento'} topo={<ChaveDoMultiplo vm={vm} />} fechar={vm.fecharJanela} className="sci-janela-multiplo"
      pe={<>
        <span className="tarefas-barra-espaco" />
        <BotoesDoPe vm={vm} editando={m.editando} form="sci-form-multiplo" lancar="Lançar múltiplo" podeLancar={pronto} />
      </>}>
      <form id="sci-form-multiplo" className="registro-corpo" onSubmit={e => { e.preventDefault(); vm.gravarMultiplo(); }}>
        <div className="sci-form sci-multiplo-topo">
          <div className="field sci-terco sci-data">
            <label htmlFor="sci-mp-data">Data{vm.diaDaSemanaDoMultiplo && <span className="sci-dia-semana"> · {vm.diaDaSemanaDoMultiplo}</span>}</label>
            <CampoDataComCalendario id="sci-mp-data" rotulo="Data" valor={m.data} onMudar={v => vm.mudarDoMultiplo('data', v)} bloqueado={vm.diaSemLancamento} />
          </div>
          <Campo id="sci-mp-documento" rotulo="Documento" valor={m.documento} mudar={v => vm.mudarDoMultiplo('documento', v)} classe="sci-terco" />
          {/* a diferença grande, no canto de cima, na linha do documento (24/11/2026: "Diferenca pode deixar maior, no canto superior direito na linha do documento") */}
          <div className={'sci-mp-diferenca ' + (t.diferenca ? 'sci-nao-bate' : 'sci-bate')}>
            {t.diferenca ? <><span>Diferença</span><b className="num">{t.diferencaTexto}</b></> : <><Icone nome="check" /><b>Bate</b></>}
          </div>
        </div>
        <div className="table-wrap sci-multiplo">
          <table className="table-compact ini-delegadas">
            <thead>
              <tr>
                {/* o lado D/C de volta, com uma coluna de valor (24/11/2026: "volta para o anterior, colorindo debito de azul e credito de vermelho") */}
                <th className="sci-mp-alca" aria-label="Arrastar" /><th className="sci-mp-lado">Lado</th><th className="sci-mp-conta">Conta</th><th className="sci-mp-part">Participante</th><th className="num sci-mp-valor">Valor</th>
                <th className="sci-mp-hist">Histórico</th><th>Complemento</th><th className="sci-mp-tirar" aria-label="Remover" />
              </tr>
            </thead>
            <tbody>
              {m.partidas.map(pt => {
                const lida = vm.partidaLida(pt.chave);
                const conta = lida?.conta;
                const nomeDaConta = !conta ? (pt.conta ? 'Não está no plano' : '') : conta.foraDoLado ? conta.nome + ' (só a ' + (pt.lado === 'debito' ? 'crédito' : 'débito') + ')' : conta.nome + (conta.analitica ? '' : ' (sintética)');
                const lupa = (alvo: 'conta' | 'historico') => vm.abrirPesquisa(alvo === 'conta' ? pt.lado : 'historico', pt.chave);
                const f2 = (alvo: 'conta' | 'historico') => (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'F2') { e.preventDefault(); lupa(alvo); } };
                return (
                  <tr key={pt.chave} className={(lida?.problemas.length ? 'sci-partida-falta' : '') + (arrastando === pt.chave ? ' sci-arrastando' : '') + (sobre === pt.chave && arrastando !== pt.chave ? ' sci-sobre' : '')}
                    title={lida?.problemas.join('\n') || undefined}
                    onDragOver={e => { if (!arrastando) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== pt.chave) setSobre(pt.chave); }}
                    onDrop={e => { e.preventDefault(); if (arrastando) vm.moverPartida(arrastando, pt.chave); soltar(); }}>
                    <td className="sci-mp-alca">
                      <span className="sci-alca" draggable title="Arraste para mudar a ordem" aria-label="Arrastar a partida"
                        onDragStart={e => {
                          setArrastando(pt.chave);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', pt.chave);
                          const tr = e.currentTarget.closest('tr');
                          if (tr) e.dataTransfer.setDragImage(tr, 16, 20);
                        }}
                        onDragEnd={soltar}><Icone nome="arrastar" /></span>
                    </td>
                    <td className={'sci-mp-lado lado-' + pt.lado}>
                      <Segmentado<sci.LadoDoLancamento> valor={pt.lado} onMudar={v => vm.mudarPartida(pt.chave, 'lado', v)}
                        opcoes={[{ valor: 'debito', rotulo: 'D' }, { valor: 'credito', rotulo: 'C' }]} />
                    </td>
                    <td className="sci-mp-conta">
                      <span className="lcdpr-codigo">
                        <input id={'sci-mp-conta-' + pt.chave} type="text" className="lcdpr-cod" value={pt.conta} autoComplete="off" placeholder="Conta" aria-label="Conta"
                          onChange={e => vm.mudarPartida(pt.chave, 'conta', e.target.value)} onKeyDown={f2('conta')} />
                        <button type="button" className="lcdpr-lupa" title="Pesquisar a conta (F2)" aria-label="Pesquisar a conta" onClick={() => lupa('conta')}><Icone nome="search" /></button>
                      </span>
                      {nomeDaConta && <span className={'hint sci-mp-nome' + (pt.lado === 'debito' ? ' lt-cod-nome-d' : ' lt-cod-nome-c')} title={nomeDaConta}>{nomeDaConta}</span>}
                    </td>
                    <td className="sci-mp-part">
                      {lida?.participante
                        ? <input type="text" value={pt.participante} autoComplete="off" aria-label={lida.participante === 'cliente' ? 'Cliente (participante)' : 'Fornecedor (participante)'}
                            placeholder={lida.participante === 'cliente' ? 'Cliente' : 'Fornecedor'} onChange={e => vm.mudarPartida(pt.chave, 'participante', e.target.value)} />
                        : <span className="hint">—</span>}
                    </td>
                    <td className="sci-mp-valor"><input type="text" inputMode="decimal" className="num" value={pt.valor} autoComplete="off" placeholder="0,00" aria-label="Valor" onChange={e => vm.mudarPartida(pt.chave, 'valor', e.target.value)} /></td>
                    <td className="sci-mp-hist">
                      <span className="lcdpr-codigo">
                        <input id={'sci-mp-hist-' + pt.chave} type="text" className="lcdpr-cod" value={pt.historico} autoComplete="off" placeholder="Nº" aria-label="Histórico"
                          onChange={e => vm.mudarPartida(pt.chave, 'historico', e.target.value)} onKeyDown={f2('historico')} />
                        <button type="button" className="lcdpr-lupa" title="Pesquisar no plano de históricos (F2)" aria-label="Pesquisar o histórico" onClick={() => lupa('historico')}><Icone nome="search" /></button>
                      </span>
                      {pt.historico && <span className="hint sci-mp-nome" title={lida?.historico?.nome}>{lida?.historico?.nome || 'Não está no plano de históricos'}</span>}
                    </td>
                    <td className="sci-mp-compl"><input type="text" value={pt.complemento} autoComplete="off" aria-label="Complemento" placeholder="Opcional" onChange={e => vm.mudarPartida(pt.chave, 'complemento', e.target.value)} /></td>
                    <td className="sci-mp-tirar"><BotaoIcone pequeno icone="x" titulo="Tirar a partida" onClick={() => vm.removerPartida(pt.chave)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sci-multiplo-pe">
          <button type="button" className="btn btn-outline" onClick={() => { const chave = vm.adicionarPartida(); setTimeout(() => { if (chave) document.getElementById('sci-mp-conta-' + chave)?.focus(); }, 0); }}>
            <Icone nome="plus" />Adicionar partida
          </button>
          <span className="tarefas-barra-espaco" />
          <span className="sci-multiplo-totais">
            <span>Débitos <b className="num">{t.debitoTexto}</b></span>
            <span>Créditos <b className="num">{t.creditoTexto}</b></span>
          </span>
        </div>
      </form>
    </Janela>
  );
}

// ------------------------------------------------------------------------------------------------- a tabela
/**
 * O resumo do que está selecionado, no canto de baixo à esquerda, com mais de um lançamento marcado (24/11/2026: "Ao selecionar,
 * apareca uma mini popup no canto inferior esquerdo mostrando o total que estou selecionando e dados uteis"; "quando seleciona
 * mais de um lancamento apenas"): quantos, o total, o período, a média, o maior, os múltiplos e os com problema.
 */
function ResumoDaSelecao({ vm, selecao, limpar, excluir }: { vm: VmShadersCi; selecao: { multiplo: boolean; ms: VmShadersCi['linhas']; valor: number }[]; limpar: () => void; excluir: () => void }) {
  const [lote, setLote] = useState(false);
  const n = selecao.length;
  const total = selecao.reduce((t, s) => t + s.valor, 0);
  const maior = Math.max(...selecao.map(s => s.valor));
  const datas = selecao.flatMap(s => s.ms.map(l => l.data)).filter(Boolean).sort();
  const de = datas[0] ? sci.dataParaTexto(datas[0]) : '';
  const ate = datas.length ? sci.dataParaTexto(datas[datas.length - 1]) : '';
  const multiplos = selecao.filter(s => s.multiplo);
  const partidas = multiplos.reduce((t, s) => t + s.ms.length, 0);
  return (
    <div className="sci-selecao" role="status" aria-live="polite">
      <div className="sci-selecao-topo">
        <span>{n} lançamentos selecionados</span>
        <BotaoIcone pequeno icone="x" titulo="Limpar a seleção" onClick={limpar} />
      </div>
      <b className="sci-selecao-total num">R$ {sci.valorParaTexto(total)}</b>
      <dl className="sci-selecao-dados">
        {de && <div><dt>Período</dt><dd>{de === ate ? de : de + ' a ' + ate}</dd></div>}
        <div><dt>Média</dt><dd className="num">R$ {sci.valorParaTexto(total / n)}</dd></div>
        <div><dt>Maior</dt><dd className="num">R$ {sci.valorParaTexto(maior)}</dd></div>
        {multiplos.length > 0 && <div><dt>Múltiplos</dt><dd>{multiplos.length} · {partidas} partidas</dd></div>}
      </dl>
      {lote
        ? <AlterarEmLote vm={vm} simples={n - multiplos.length} multiplos={multiplos.length} fechar={() => setLote(false)} />
        : <button type="button" className="btn btn-sm btn-outline sci-selecao-lote" onClick={() => setLote(true)} disabled={n === multiplos.length}
            title={n === multiplos.length ? 'Os múltiplos não mudam em lote' : 'Mudar a data, as contas, o valor ou o histórico dos selecionados'}>Alterar em lote</button>}
      {/* excluir em lote (25/11/2026: "Deixa uma opcao de excluir em lote aqui nessa box"): o mesmo excluir do botão direito e do
          Del, que o Ctrl+Z desfaz */}
      {/* vermelho, o padrão de excluir, e sem ícone (25/11/2026: "Deixa os botoes de excluir vermelho ... remove o icone desse botao") */}
      <button type="button" className="btn btn-sm btn-danger sci-selecao-excluir" onClick={excluir} title="Excluir os selecionados (Del). Ctrl+Z desfaz.">
        Excluir os {n} lançamentos
      </button>
    </div>
  );
}

/**
 * Alterar em lote (25/11/2026: "Coloca alguma funcao de alterar em lote: data, conta debito, conta credito, valor, numero do
 * historico"): o que ficar vazio não muda. Os múltiplos não mudam em lote ("Lancamentos em lote nao muda multiplos, deixe isso
 * como regra"): o aviso diz quantos ficam de fora. Embaixo da conta e do histórico, o nome, para conferir antes de aplicar.
 */
function AlterarEmLote({ vm, simples, multiplos, fechar }: { vm: VmShadersCi; simples: number; multiplos: number; fechar: () => void }) {
  const [t, setT] = useState({ data: '', debito: '', credito: '', valor: '', historico: '' });
  const [erro, setErro] = useState('');
  const muda = (k: keyof typeof t) => (e: { target: { value: string } }) => { setT(x => ({ ...x, [k]: e.target.value })); setErro(''); };
  const nomeDa = (texto: string) => { const c = vm.contaNoPlano(texto); return !texto.trim() ? '' : c ? c.nome : 'Não está no plano'; };
  const hist = vm.historicoNoSci(t.historico);
  const campo = (k: keyof typeof t, rotulo: string, dica: string, nome?: string, num?: boolean) => (
    <label className="sci-lote-campo">
      <span>{rotulo}</span>
      <input type="text" value={t[k]} onChange={muda(k)} placeholder={dica} aria-label={rotulo} className={num ? 'num' : undefined} autoFocus={k === 'data'} />
      {nome && <small className="hint" title={nome}>{nome}</small>}
    </label>
  );
  return (
    <form className="sci-lote" onSubmit={e => { e.preventDefault(); const r = vm.alterarEmLote(t); if (r) setErro(r); else fechar(); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } }}>
      <div className="sci-lote-grade">
        {campo('data', 'Data', 'dd/mm/aaaa')}
        {campo('valor', 'Valor', '0,00', undefined, true)}
        {campo('debito', 'Débito', 'Conta', nomeDa(t.debito))}
        {campo('credito', 'Crédito', 'Conta', nomeDa(t.credito))}
        {campo('historico', 'Nº do histórico', 'Número', t.historico.trim() ? (hist ? hist.nome : 'Não está no plano de históricos') : '')}
      </div>
      <p className="hint sci-lote-nota">
        {multiplos ? (multiplos === 1 ? '1 múltiplo fica' : multiplos + ' múltiplos ficam') + ' como está: o lote não muda múltiplos. ' : ''}O vazio não muda.
      </p>
      {erro && <p className="sci-lote-erro" role="alert">{erro}</p>}
      <div className="sci-lote-botoes">
        <button type="button" className="btn btn-sm btn-ghost" onClick={fechar}>Voltar</button>
        <button type="submit" className="btn btn-sm btn-primary">Alterar {simples === 1 ? '1 lançamento' : simples + ' lançamentos'}</button>
      </div>
    </form>
  );
}

/**
 * A busca dos lançamentos, na linha dos botões do topo (25/11/2026: "Deixa a box so pra tabela, deixa pesquisa fora dessa box";
 * "Deixa na mesma linha da barra de pesquisa. Para economizar espaco"). O filtro geral saiu ("Remove esse filtro"): os filtros
 * ficam no clique da coluna.
 */
function FiltroEBusca({ vm }: { vm: VmShadersCi }) {
  return (
    <span className="sci-barra">
      <label className="busca-curta">
        <Icone nome="search" />
        <input type="text" placeholder="Buscar" aria-label="Buscar nos lançamentos" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
      </label>
    </span>
  );
}

/**
 * O cabeçalho da coluna que ordena e filtra (25/11/2026: "Coloca funcoes de ordenar e filtros quando voce clica na coluna"): o
 * clique abre o crescente, o decrescente, o filtro da coluna (contém o texto) e o limpar. Na Data, os meses que têm lançamento
 * (25/11/2026: "No filtro da data, coloca a opcao de filtrar por meses"); no Valor, o acima de e o abaixo de (25/11/2026: "No valor,
 * filtros de valores, acima e abaixo de"), no lugar do texto. A setinha mostra a ordem; o funil, o filtro ligado.
 */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** 'aaaa-mm' → "novembro de 2026" */
const rotuloDoMes = (m: string) => { const [a, mm] = m.split('-'); return (MESES[Number(mm) - 1] || mm) + ' de ' + a; };

function CabecaDaColuna({ vm, coluna, rotulo, numero, dica }: { vm: VmShadersCi; coluna: ColunaDosLancamentos; rotulo: string; numero?: boolean; dica?: string }) {
  const ordem = vm.ordem?.coluna === coluna ? (vm.ordem.desc ? 'desc' : 'asc') : null;
  const filtro = vm.filtrosDasColunas[coluna] || ''
    || (coluna === 'data' && vm.mesDaData ? vm.mesDaData : '')
    || (coluna === 'valor' && (vm.faixaDoValor.acima.trim() || vm.faixaDoValor.abaixo.trim()) ? 'faixa' : '');
  const [crescente, decrescente] = numero ? ['Menor para o maior', 'Maior para o menor'] : coluna === 'data' ? ['Mais antiga primeiro', 'Mais nova primeiro'] : ['A → Z', 'Z → A'];
  return (
    <th className={numero ? 'num' : undefined} title={dica} aria-sort={ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : undefined}>
      <MenuSuspenso flutuante semSeta largura={230} direita={numero} titulo={'Ordenar e filtrar: ' + rotulo}
        className={'sci-th' + (ordem || filtro ? ' sci-th-ativa' : '') + (numero ? ' sci-th-num' : '')}
        rotulo={<>{rotulo}{filtro && <Icone nome="funil" className="sci-th-funil" />}{ordem && <Icone nome={ordem === 'asc' ? 'arrowUp' : 'arrowDown'} className="sci-th-seta" />}</>}
        conteudo={fechar => (
          <div className="sci-th-menu">
            <button type="button" className={'popover-item' + (ordem === 'asc' ? ' marcado' : '')} onClick={() => { vm.ordenar(coluna, false); fechar(); }}><Icone nome="arrowUp" /><span className="popover-texto">{crescente}</span></button>
            <button type="button" className={'popover-item' + (ordem === 'desc' ? ' marcado' : '')} onClick={() => { vm.ordenar(coluna, true); fechar(); }}><Icone nome="arrowDown" /><span className="popover-texto">{decrescente}</span></button>
            <hr className="popover-sep" />
            {coluna === 'valor' ? (
              <div className="sci-th-faixa">
                <label className="sci-th-faixa-campo"><span>Acima de</span>
                  <input type="text" inputMode="decimal" autoFocus placeholder="0,00" aria-label="Valor acima de" value={vm.faixaDoValor.acima}
                    onChange={e => vm.mudarFaixaDoValor('acima', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fechar(); }} />
                </label>
                <label className="sci-th-faixa-campo"><span>Abaixo de</span>
                  <input type="text" inputMode="decimal" placeholder="0,00" aria-label="Valor abaixo de" value={vm.faixaDoValor.abaixo}
                    onChange={e => vm.mudarFaixaDoValor('abaixo', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fechar(); }} />
                </label>
              </div>
            ) : (
              <label className="busca-curta sci-th-filtro">
                <Icone nome="funil" />
                <input type="text" autoFocus placeholder={'Filtrar ' + rotulo.toLowerCase()} aria-label={'Filtrar a coluna ' + rotulo} value={vm.filtrosDasColunas[coluna] || ''}
                  onChange={e => vm.filtrarColuna(coluna, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fechar(); }} />
              </label>
            )}
            {coluna === 'data' && vm.mesesDasDatas.length > 0 && (
              <>
                <hr className="popover-sep" />
                <span className="sci-th-titulo">Mês</span>
                {vm.mesesDasDatas.map(m => (
                  <button key={m} type="button" className={'popover-item' + (vm.mesDaData === m ? ' marcado' : '')} onClick={() => { vm.setMesDaData(vm.mesDaData === m ? null : m); fechar(); }}>
                    <span className="popover-marca">{vm.mesDaData === m && <Icone nome="check" />}</span><span className="popover-texto">{rotuloDoMes(m)}</span>
                  </button>
                ))}
              </>
            )}
            {(ordem || filtro) && (
              <><hr className="popover-sep" /><button type="button" className="popover-item" onClick={() => { vm.limparColuna(coluna); fechar(); }}><Icone nome="x" /><span className="popover-texto">Limpar esta coluna</span></button></>
            )}
          </div>
        )} />
    </th>
  );
}

function Tabela({ vm }: { vm: VmShadersCi }) {
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // o múltiplo numa linha só, que a setinha abre nas partidas (24/11/2026: "Eu colocaria como se fosse um lancamento so, e quando
  // clicava na setinha de drop ele destrinchasse"): os blocos da tabela, um por lançamento (o zebrado muda a cada um)
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const abrirOuFechar = (id: string) => setAbertos(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  type Linha = VmShadersCi['linhas'][number];
  const blocos = vm.linhas.reduce<{ id: string; multiplo: boolean; linhas: Linha[] }[]>((bs, l) => {
    const ultimo = bs[bs.length - 1];
    if (l.multiplo && ultimo?.multiplo && ultimo.id === l.multiplo) ultimo.linhas.push(l);
    else bs.push({ id: l.multiplo || l.id, multiplo: !!l.multiplo, linhas: [l] });
    return bs;
  }, []);
  /** grupo: as partidas do múltiplo (o menu vale para ele inteiro, nunca para uma partida só) */
  const opcoes = (id: string | null, grupo?: readonly string[]): LinhaDoMenu[] => {
    const ids = grupo ?? (id ? [id] : []);
    const ja = !!id && ids.every(x => vm.marcado(x));
    const n = id ? (ja ? vm.marcados.size : ids.length) : vm.marcados.size;
    const alvo = id && !ja ? ids : undefined;
    const varias = n > 1 ? ' (' + n + ')' : '';
    const umSo = grupo ? !ja || vm.marcados.size === grupo.length : n === 1;
    return [
      ...(id ? [
        { rotulo: 'Editar', icone: 'lapis' as const, atalho: 'Enter', desabilitado: !umSo, onClick: () => vm.editar(id) },
        { rotulo: 'Duplicar' + varias, icone: 'plus' as const, atalho: 'Ctrl+D', onClick: () => vm.duplicar(alvo) },
        { rotulo: 'Inverter débito e crédito' + varias, icone: 'repeat' as const, onClick: () => vm.inverter(alvo) },
        'separador' as const,
        { rotulo: 'Copiar' + varias, icone: 'copiar' as const, atalho: 'Ctrl+C', onClick: () => { void vm.copiar(alvo); } },
      ] : []),
      { rotulo: id ? 'Colar abaixo' : 'Colar', icone: 'clipe', atalho: 'Ctrl+V', onClick: () => { void vm.colar(id || undefined); } },
      'separador',
      { rotulo: 'Selecionar tudo', icone: 'checklist', atalho: 'Ctrl+A', desabilitado: !vm.linhas.length, onClick: () => vm.marcarTodas(true) },
      { rotulo: 'Desfazer', icone: 'girar', atalho: 'Ctrl+Z', desabilitado: !vm.podeDesfazer, onClick: vm.desfazer },
      ...(id ? ['separador' as const, { rotulo: 'Excluir' + varias, icone: 'lixeira' as const, atalho: 'Del', onClick: () => vm.excluir(alvo) }] : []),
    ];
  };
  const aoMenu = (ev: MouseEvent, id: string | null, grupo?: readonly string[]) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (grupo) vm.garantirGrupo(grupo);
    else if (id) vm.garantirMarcado(id);
    setMenu({ x: ev.clientX, y: ev.clientY, linhas: opcoes(id, grupo) });
    caixa.current?.focus({ preventScroll: true });
  };
  // os atalhos do Excel com a tabela em foco (o Ctrl+V vem pelo evento de colar, que traz o texto sem pedir licença)
  const teclas = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 'c') { e.preventDefault(); void vm.copiar(); }
    else if (ctrl && k === 'a') { e.preventDefault(); vm.marcarTodas(true); }
    else if (ctrl && k === 'd') { e.preventDefault(); vm.duplicar(); }
    else if (ctrl && k === 'z') { e.preventDefault(); vm.desfazer(); }
    else if (e.key === 'Delete') { e.preventDefault(); vm.excluir(); }
    else if (e.key === 'Enter' && vm.marcados.size > 0) {
      // um lançamento só: uma linha, ou as partidas de um mesmo múltiplo
      const ms = vm.linhas.filter(l => vm.marcado(l.id));
      if (ms.length === 1 || (ms[0]?.multiplo && ms.every(l => l.multiplo === ms[0].multiplo))) { e.preventDefault(); vm.editar(ms[0].id); }
    }
    else if (e.key === 'Escape') vm.marcarTodas(false);
  };
  const colar = (e: ClipboardEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    e.preventDefault();
    const ultimo = vm.linhas.filter(l => vm.marcado(l.id)).pop();
    vm.colarTexto(e.clipboardData.getData('text/plain'), ultimo?.id);
  };
  // sem lançamento a tabela não aparece: o Ctrl+V das linhas do Excel vale na tela toda (fora dos campos de texto)
  const semLancamento = !vm.total;
  const colarTexto = vm.colarTexto;
  useEffect(() => {
    if (!semLancamento) return;
    const aoColar = (e: globalThis.ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]') || !e.clipboardData) return;
      e.preventDefault();
      colarTexto(e.clipboardData.getData('text/plain'));
    };
    document.addEventListener('paste', aoColar);
    return () => document.removeEventListener('paste', aoColar);
  }, [semLancamento, colarTexto]);
  // o Ctrl+Z também fora da tabela (com nenhum campo em foco)
  const desfazer = vm.desfazer;
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input, textarea, .sci-tabela-caixa')) { e.preventDefault(); desfazer(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [desfazer]);
  // a seleção por lançamento: o múltiplo inteiro conta com o total dos débitos; só algumas partidas dele, a soma delas
  const selecao = blocos.flatMap(b => {
    const ms = b.linhas.filter(l => vm.marcado(l.id));
    if (!ms.length) return [];
    const soma = (ls: Linha[]) => ls.reduce((t, l) => t + l.valor, 0);
    const valor = b.multiplo ? (ms.length === b.linhas.length ? soma(ms.filter(l => l.debito)) : soma(ms)) : ms[0].valor;
    return [{ multiplo: b.multiplo, ms, valor }];
  });
  return (
    <>
      {/* sem lançamento, nada (25/11/2026: "remove isso", o aviso de nenhum lançamento); o Ctrl+V vale na tela toda (o efeito acima) */}
      {vm.total > 0 && (
      <section className="card ini-grupo sci-tabela-card">
        <div ref={caixa} className="table-wrap sci-tabela-caixa" tabIndex={0} onKeyDown={teclas} onPaste={colar} onContextMenu={ev => aoMenu(ev, null)} aria-label="Lançamentos: botão direito para as opções">
          <table className="table-compact ini-delegadas sci-tabela">
            <thead>
              <tr>
                <th className="sci-marca"><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarTodas(e.target.checked)} aria-label="Selecionar todos" /></th>
                <CabecaDaColuna vm={vm} coluna="data" rotulo="Data" />
                <CabecaDaColuna vm={vm} coluna="debito" rotulo="Débito" />
                <CabecaDaColuna vm={vm} coluna="credito" rotulo="Crédito" />
                <CabecaDaColuna vm={vm} coluna="valor" rotulo="Valor" numero />
                <CabecaDaColuna vm={vm} coluna="historico" rotulo="Histórico" />
                <CabecaDaColuna vm={vm} coluna="documento" rotulo="Doc." />
                <CabecaDaColuna vm={vm} coluna="participanteD" rotulo="Part. D" dica="O participante a débito (código no SCI)" />
                <CabecaDaColuna vm={vm} coluna="participanteC" rotulo="Part. C" dica="O participante a crédito (código no SCI)" />
              </tr>
            </thead>
            <tbody>
              {/* o zebrado leve por lançamento (24/11/2026: "um leve zebrado, para saber quais lancamentos sao quais"); o múltiplo
                  numa linha só, com a setinha que abre as partidas embaixo */}
              {blocos.flatMap((b, faixa) => {
                const zebra = faixa % 2 ? ' sci-zebra' : '';
                const linha = (l: Linha, partida: boolean) => (
                  <tr key={l.id} className={'ini-tr' + zebra + (vm.marcado(l.id) ? ' sci-marcada' : '') + (vm.editando === l.id ? ' linha-atual' : '') + (partida ? ' sci-do-multiplo sci-partida' : '')}
                    onClick={e => vm.marcar(l.id, e.ctrlKey || e.metaKey || e.shiftKey)} onDoubleClick={() => vm.editar(l.id)} onContextMenu={ev => aoMenu(ev, l.id)}>
                    <td className="sci-marca" onClick={e => { e.stopPropagation(); vm.marcar(l.id, true); }}><input type="checkbox" checked={vm.marcado(l.id)} readOnly tabIndex={-1} aria-label={'Selecionar o lançamento de ' + l.dataTexto} /></td>
                    <td className="ini-delegadas-curta">{partida ? '' : l.dataTexto || '—'}</td>
                    <td><ContaNaTabela codigo={l.debito} nome={l.nomeD} lado="debito" /></td>
                    <td><ContaNaTabela codigo={l.credito} nome={l.nomeC} lado="credito" /></td>
                    <td className="num sci-valor">{l.valorTexto || '—'}</td>
                    <td className="sci-hist"><HistoricoNaTabela codigo={l.historico} nome={l.nomeH} complemento={l.complemento} /></td>
                    <td className="ini-delegadas-curta">{partida ? '' : l.documento}</td>
                    <td className="ini-delegadas-curta">{l.participanteD}</td>
                    <td className="ini-delegadas-curta">{l.participanteC}</td>
                  </tr>
                );
                if (!b.multiplo) return [linha(b.linhas[0], false)];
                const ps = b.linhas;
                const ids = ps.map(l => l.id);
                const aberto = abertos.has(b.id);
                const todas = ids.every(id => vm.marcado(id));
                const debitos = ps.filter(l => l.debito);
                const creditos = ps.filter(l => l.credito);
                const total = debitos.reduce((t, l) => t + l.valor, 0);
                const igual = (v: (l: Linha) => string) => (ps.every(l => v(l) === v(ps[0])) ? v(ps[0]) : '');
                const historico = igual(l => l.historico + '|' + l.complemento) ? ps[0] : null;
                return [
                  <tr key={b.id} className={'ini-tr sci-multiplo-linha' + zebra + (todas ? ' sci-marcada' : '')}
                    onClick={e => vm.marcarGrupo(ids, e.ctrlKey || e.metaKey || e.shiftKey)} onDoubleClick={() => vm.editar(ids[0])} onContextMenu={ev => aoMenu(ev, ids[0], ids)}>
                    <td className="sci-marca" onClick={e => { e.stopPropagation(); vm.marcarGrupo(ids, true); }}><input type="checkbox" checked={todas} readOnly tabIndex={-1} aria-label={'Selecionar o lançamento múltiplo de ' + ps[0].dataTexto} /></td>
                    <td className="ini-delegadas-curta">{ps[0].dataTexto || '—'}</td>
                    <td colSpan={2}>
                      <button type="button" className="sci-abrir-multiplo" aria-expanded={aberto} title={aberto ? 'Fechar as partidas' : 'Ver as partidas'}
                        onClick={e => { e.stopPropagation(); abrirOuFechar(b.id); }} onDoubleClick={e => e.stopPropagation()}>
                        <Icone nome="chevronRight" className={'sci-abrir-seta' + (aberto ? ' aberta' : '')} />
                        <span className="ini-empresa">Múltiplo</span>
                        <span className="hint">{ps.length} partidas · {debitos.length === 1 ? '1 débito' : debitos.length + ' débitos'} · {creditos.length === 1 ? '1 crédito' : creditos.length + ' créditos'}</span>
                      </button>
                    </td>
                    <td className="num sci-valor">{sci.valorParaTexto(total)}</td>
                    <td className="sci-hist">{historico ? <HistoricoNaTabela codigo={historico.historico} nome={historico.nomeH} complemento={historico.complemento} /> : <span className="hint">vários</span>}</td>
                    <td className="ini-delegadas-curta">{ps[0].documento}</td>
                    <td className="ini-delegadas-curta" />
                    <td className="ini-delegadas-curta" />
                  </tr>,
                  ...(aberto ? ps.map(l => linha(l, true)) : []),
                ];
              })}
            </tbody>
          </table>
        </div>
      {selecao.length > 1 && <ResumoDaSelecao vm={vm} selecao={selecao} limpar={() => vm.marcarTodas(false)} excluir={() => vm.excluir()} />}
      </section>
      )}
      {/* o razão do SCI por um botão no centro da tela, no lugar do olho do topo (25/11/2026: "Tira o olho e coloca um botao central
          'Quero visualizar lancamentos', a vai para a outra tela"; "Deixa bonito o botao e centralizado na tela"), só com a tela
          zerada: lançando ou com a consulta importada, some ("ele importando os lancamentos ou comecando a lancar, some esse"); o
          razão fica no menu do nome da empresa */}
      {!vm.total && !temConsultaDoSci(vm.empresa?.codigo ?? null) && (
      <div className="sci-ver-razao vazio">
        <button type="button" className="sci-ver-razao-botao" onClick={() => vm.abrirApp('razao')}>
          <span className="sci-ver-razao-icone" aria-hidden="true"><Icone nome="olho" /></span>
          <span className="sci-ver-razao-texto">
            <b>Quero visualizar lançamentos</b>
            <span>O que já está no SCI, pela consulta exportada</span>
          </span>
          <Icone nome="chevronRight" className="sci-ver-razao-seta" />
        </button>
      </div>
      )}
      {menu && <MenuDeContexto menu={menu} onFechar={() => setMenu(null)} />}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- o plano de contas
function JanelaDoPlano({ vm, lado }: { vm: VmShadersCi; lado: 'debito' | 'credito' }) {
  const [q, setQ] = useState(vm.textoDaPesquisa);
  const [ativo, setAtivo] = useState(0);
  const achadas = vm.buscarNoPlano(q, lado);
  const campo = vm.campoDaPesquisa;
  const escolher = (codigo: string) => { vm.escolherNoPlano(codigo); setTimeout(() => document.getElementById(campo)?.focus(), 0); };
  return (
    // sem o caminho no topo, o selo do lado e a dica (24/11/2026: "remova isso e esse cabecalho de diretorio de todas as telas do
    // minimum"): a busca fica no topo, na linha do X
    <Janela app="minimum" titulo={'Plano de contas ' + vm.plano} fechar={vm.fecharPesquisa} className="lt-janela-plano" classeDoFundo="lt-plano-fundo"
      topo={
        <label className="busca-curta sci-busca-plano">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Código, classificação, nome ou apelido" aria-label="Buscar no plano de contas" value={q}
            onChange={e => { setQ(e.target.value); setAtivo(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => Math.min(achadas.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(i => Math.max(0, i - 1)); }
              else if (e.key === 'Enter' && achadas[ativo]) { e.preventDefault(); escolher(achadas[ativo].codigo); }
            }} />
        </label>}>
      <div className="registro-corpo">
        <div className="table-wrap sci-plano">
          <table className="table-compact ini-delegadas">
            <thead><tr><th className="num">Código</th><th>Classificação</th><th>Nome</th><th>Apelido</th><th aria-label="Participante" /></tr></thead>
            <tbody>
              {achadas.map((c, i) => (
                <tr key={c.codigo} className={'ini-tr' + (i === ativo ? ' linha-atual' : '')} onMouseEnter={() => setAtivo(i)} onClick={() => escolher(c.codigo)}>
                  <td className="num"><span className="ini-empresa">{c.codigo}</span></td>
                  <td className="ini-delegadas-curta fraco">{c.classificacao}</td>
                  <td>{c.nome}</td>
                  <td className="ini-delegadas-curta fraco">{c.apelido}</td>
                  <td className="ini-delegadas-curta hint">{sci.participanteDoLado(c, lado) === 'cliente' ? 'pede o cliente' : sci.participanteDoLado(c, lado) === 'fornecedor' ? 'pede o fornecedor' : ''}</td>
                </tr>
              ))}
              {!achadas.length && <tr><td colSpan={5} className="hint">Nenhuma conta analítica com isso.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Janela>
  );
}

// ------------------------------------------------------------------------------------------------- o plano de históricos
/** A lupa do histórico (24/11/2026: "Te mandei o plano de historicos que eu queria que voce colocasse tambem"): o número, o apelido e o nome. */
function JanelaDosHistoricos({ vm }: { vm: VmShadersCi }) {
  const [q, setQ] = useState(vm.textoDaPesquisa);
  const [ativo, setAtivo] = useState(0);
  const achados = vm.buscarHistoricos(q);
  // do lançamento simples, o foco vai para o complemento; da partida, volta para o histórico dela
  const campo = vm.campoDaPesquisa === 'sci-historico' ? 'sci-complemento' : vm.campoDaPesquisa;
  const escolher = (codigo: string) => { vm.escolherNoPlano(codigo); setTimeout(() => document.getElementById(campo)?.focus(), 0); };
  return (
    <Janela app="minimum" titulo="Plano de históricos" fechar={vm.fecharPesquisa} className="lt-janela-plano" classeDoFundo="lt-plano-fundo"
      topo={
        <label className="busca-curta sci-busca-plano">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Número, nome ou apelido" aria-label="Buscar no plano de históricos" value={q}
            onChange={e => { setQ(e.target.value); setAtivo(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => Math.min(achados.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(i => Math.max(0, i - 1)); }
              else if (e.key === 'Enter' && achados[ativo]) { e.preventDefault(); escolher(achados[ativo].codigo); }
            }} />
        </label>}>
      <div className="registro-corpo">
        <div className="table-wrap sci-plano">
          <table className="table-compact ini-delegadas">
            <thead><tr><th className="num">Número</th><th>Nome</th><th>Apelido</th><th aria-label="Complemento" /></tr></thead>
            <tbody>
              {achados.map((h, i) => (
                <tr key={h.codigo} className={'ini-tr' + (i === ativo ? ' linha-atual' : '')} onMouseEnter={() => setAtivo(i)} onClick={() => escolher(h.codigo)}>
                  <td className="num"><span className="ini-empresa">{h.codigo}</span></td>
                  <td>{h.nome}</td>
                  <td className="ini-delegadas-curta fraco">{h.apelido}</td>
                  <td className="ini-delegadas-curta hint">{h.pulaComplemento ? 'sem complemento' : ''}</td>
                </tr>
              ))}
              {!achados.length && <tr><td colSpan={4} className="hint">Nenhum histórico com isso.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Janela>
  );
}
