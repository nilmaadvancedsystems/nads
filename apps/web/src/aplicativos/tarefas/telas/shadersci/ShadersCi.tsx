// O ShadersCI (23/11/2026: "Vamos buildar um aplicativo chamado ShadersCI … uma abinha de lançamentos onde o usuario lance,
// adicione, remova, edite … copie e cole com o botao direito"): a aba de lançamentos do SCI, limpa. Em cima, a empresa, o plano
// padrão (90113 ou 90011) e o CNPJ; o formulário do lançamento (a data, o débito e o crédito pelo código do plano com a lupa, o
// valor, o histórico do plano de históricos, o complemento, o documento e o participante na frente da conta que pede); embaixo, a tabela, com o botão
// direito (editar, duplicar, inverter, copiar, colar, excluir) e os atalhos do Excel. Sai na planilha do gerador do SCI.
import { sci } from '@nads/core';
import { BotaoIcone, CampoDataComCalendario, Icone, Interruptor, LogoExcel, MenuSuspenso, Segmentado, Vazio } from '@nads/ui';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { AcoesDoTopo, TituloDoTopo } from '../../../../comum/topo';
import { MenuDeContexto, type LinhaDoMenu, type MenuAberto } from '../drive/MenuDeContexto';
import { EmpresaDaBarra } from '../fiscal/partes/EmpresaDaBarra';
import { Janela } from '../lancatudo/Janelas';
import { useShadersCi, type Formulario, type VmShadersCi } from './useShadersCi';

export function ShadersCi() {
  const vm = useShadersCi();
  if (!vm.carregada) return null;
  return (
    <section className="sci">
      {/* o título da página é a empresa aberta, no lugar de "minimum" (24/11/2026: "troque o titulo minimum pelo nome da empresa numero e nome") */}
      <TituloDoTopo titulo={vm.empresa?.nome || ''} selo={vm.empresa?.codigo != null ? String(vm.empresa.codigo) : undefined}
        aoTrocar={vm.empresa ? () => { void vm.trocarEmpresa(); } : undefined} dicaDoTrocar="Trocar a empresa" />
      {/* a janela do lançamento e, por cima dela, a do plano (F2) */}
      {/* a mesma janela: o lançamento simples ou, com a caixinha marcada, o múltiplo */}
      {vm.janela && (vm.multiplo ? <JanelaDoMultiplo vm={vm} /> : <JanelaDoLancamento vm={vm} />)}
      {vm.pesquisa === 'historico' ? <JanelaDosHistoricos vm={vm} /> : vm.pesquisa && <JanelaDoPlano vm={vm} lado={vm.pesquisa} />}
      {/* os botões na linha do título, sem a barra da empresa (24/11/2026: "remove isso e deixa alinhado com os botoes novo
          lancamento e planilha do sci"); trocar de empresa fica nas setas ao lado do nome, no título */}
      <AcoesDoTopo>
        {/* sem o selo do plano e sem o campo do CNPJ (24/11/2026: "remove isso"): o plano e o CNPJ vêm do Cadastro da empresa;
            só a empresa sem plano no Cadastro ainda escolhe aqui */}
        {vm.empresa && !vm.planoDoCadastro && <Segmentado<sci.IdDoPlanoSci> valor={vm.plano} onMudar={vm.setPlano} opcoes={vm.planos.map(p => ({ valor: p.id, rotulo: p.rotulo }))} />}
        {vm.dev && (
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
        {/* o Novo lançamento ao lado da Planilha do SCI (24/11/2026: "vai abrir uma popup, ai vai aparecer os dados para fazer o lançamento") */}
        {vm.empresa && <button type="button" className="btn btn-outline" onClick={vm.novoLancamento}><Icone nome="plus" />Novo lançamento</button>}
        {vm.empresa && <button type="button" className="btn btn-primary" disabled={!vm.podeExportar} onClick={vm.exportar} title="A planilha para o gerador do SCI (linha inicial 2, descarta 1 no fim)"><LogoExcel />Planilha do SCI</button>}
      </AcoesDoTopo>
      {!vm.empresa
        ? <TelaInicial vm={vm} />
        : <Tabela vm={vm} />}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------- a tela inicial
/**
 * Sem empresa (24/11/2026: "Faz uma tela inicial bem bonita, com animações. Coloca no centro da tela: Escolha sua empresa
 * subtitle [Apenas empresas que estão na sci]"): no centro, o título, a busca e as empresas do SCI, que chegam uma atrás
 * da outra. Só as ligadas em Configurações › Dados da empresa › Está no SCI.
 */
function TelaInicial({ vm }: { vm: VmShadersCi }) {
  const MAX = 12;
  const lista = vm.empresasDoSci;
  return (
    <div className="sci-inicio">
      {/* a logo do minimum no lugar da maletinha (24/11/2026: "Coloca a logo da sci no lugar dessa maletinha"): a palavra numa
          serifada bem pesada, com o i sem ponto, na cor do texto (preta no claro, branca no escuro) */}
      <span className="sci-inicio-logo" role="img" aria-label="minimum">min{'ı'}mum</span>
      <h1 className="sci-inicio-titulo">Escolha sua empresa</h1>
      <p className="sci-inicio-sub">Apenas empresas que estão no SCI</p>
      {lista.length > 0 ? <>
        <div className="sci-inicio-busca"><EmpresaDaBarra vm={vm.entrada} id="sci-empresas" /></div>
        <ul className="sci-inicio-lista" aria-label="Empresas no SCI">
          {lista.slice(0, MAX).map((e, i) => (
            <li key={e.codigo} style={{ animationDelay: (0.32 + i * 0.04).toFixed(2) + 's' }}>
              <button type="button" className="btn btn-outline sci-inicio-empresa" title={e.nome} onClick={() => vm.entrada.escolher(e)}>
                <b>{e.codigo}</b><span>{e.nome}</span>
              </button>
            </li>
          ))}
        </ul>
        {lista.length > MAX && <p className="sci-inicio-mais">e mais {lista.length - MAX}: busque pelo código ou pelo nome</p>}
      </> : (
        <p className="sci-inicio-nenhuma">Nenhuma empresa ligada no SCI ainda. Ligue em Configurações › Empresas › Dados da empresa › <b>Está no SCI</b>.</p>
      )}
    </div>
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
        <Campo id="sci-complemento" rotulo={'Complemento' + (h?.pulaComplemento ? ' (opcional neste histórico)' : '')} valor={vm.form.complemento} mudar={campo('complemento')}
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
      <Interruptor ligado={!!vm.multiplo} rotulo="Lançamento múltiplo" onMudar={mudar} />
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
        </div>
        <div className="table-wrap sci-multiplo">
          <table className="table-compact ini-delegadas">
            <thead>
              <tr>
                {/* o débito e o crédito em duas colunas de valor, no lugar do D/C (24/11/2026: "D e C nao gostei o multiplo, apresenta ele de outra forma") */}
                <th className="sci-mp-conta">Conta</th><th className="sci-mp-part">Participante</th><th className="num sci-mp-valor">Débito</th><th className="num sci-mp-valor">Crédito</th>
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
                  <tr key={pt.chave} className={lida?.problemas.length ? 'sci-partida-falta' : undefined} title={lida?.problemas.join('\n') || undefined}>
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
                    {/* o valor digitado numa coluna leva a partida para aquele lado (o da outra coluna sai) */}
                    {(['debito', 'credito'] as const).map(lado => (
                      <td key={lado} className="sci-mp-valor">
                        <input type="text" inputMode="decimal" className="num" value={pt.lado === lado ? pt.valor : ''} autoComplete="off" placeholder="0,00"
                          aria-label={lado === 'debito' ? 'Valor a débito' : 'Valor a crédito'}
                          onChange={e => { if (pt.lado !== lado) vm.mudarPartida(pt.chave, 'lado', lado); vm.mudarPartida(pt.chave, 'valor', e.target.value); }} />
                      </td>
                    ))}
                    <td className="sci-mp-hist">
                      <span className="lcdpr-codigo">
                        <input id={'sci-mp-hist-' + pt.chave} type="text" className="lcdpr-cod" value={pt.historico} autoComplete="off" placeholder="Nº" aria-label="Histórico"
                          onChange={e => vm.mudarPartida(pt.chave, 'historico', e.target.value)} onKeyDown={f2('historico')} />
                        <button type="button" className="lcdpr-lupa" title="Pesquisar no plano de históricos (F2)" aria-label="Pesquisar o histórico" onClick={() => lupa('historico')}><Icone nome="search" /></button>
                      </span>
                      {pt.historico && <span className="hint sci-mp-nome" title={lida?.historico?.nome}>{lida?.historico?.nome || 'Não está no plano de históricos'}</span>}
                    </td>
                    <td className="sci-mp-compl"><input type="text" value={pt.complemento} autoComplete="off" aria-label="Complemento" placeholder={lida?.historico?.pulaComplemento ? 'Opcional' : 'Complemento'} onChange={e => vm.mudarPartida(pt.chave, 'complemento', e.target.value)} /></td>
                    <td className="sci-mp-tirar"><BotaoIcone pequeno icone="x" titulo="Tirar a partida" onClick={() => vm.removerPartida(pt.chave)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sci-multiplo-pe">
          <button type="button" className="btn btn-outline" onClick={() => { vm.adicionarPartida(); setTimeout(() => { const c = document.querySelectorAll<HTMLInputElement>('.sci-mp-conta input'); c[c.length - 1]?.focus(); }, 0); }}>
            <Icone nome="plus" />Adicionar partida
          </button>
          <span className="tarefas-barra-espaco" />
          <span className="sci-multiplo-totais">
            <span>Débitos <b className="num">{t.debitoTexto}</b></span>
            <span>Créditos <b className="num">{t.creditoTexto}</b></span>
            <span className={t.diferenca ? 'sci-nao-bate' : 'sci-bate'}>{t.diferenca ? <>Diferença <b className="num">{t.diferencaTexto}</b></> : <><Icone nome="check" />Bate</>}</span>
          </span>
        </div>
      </form>
    </Janela>
  );
}

// ------------------------------------------------------------------------------------------------- a tabela
/** o selo dos problemas da linha (ou do múltiplo inteiro); sem nenhum, o ✓ */
function Situacao({ problemas }: { problemas: readonly string[] }) {
  return problemas.length
    ? <span className="badge badge-warn" title={problemas.join('\n')}><Icone nome="alert" />{problemas.length === 1 ? '1 problema' : problemas.length + ' problemas'}</span>
    : <span className="hint" title="Pronto para o SCI"><Icone nome="check" /></span>;
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
  // o Ctrl+Z também fora da tabela (com nenhum campo em foco)
  const desfazer = vm.desfazer;
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input, textarea, .sci-tabela-caixa')) { e.preventDefault(); desfazer(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [desfazer]);
  const r = vm.resumo;
  // por lançamento, não por partida: o múltiplo conta 1 e entra com o total dos débitos (as partidas somadas davam o dobro)
  const quantos = blocos.length;
  const totalTexto = sci.valorParaTexto(blocos.reduce((t, b) => t + (b.multiplo ? b.linhas.filter(l => l.debito).reduce((s, l) => s + l.valor, 0) : b.linhas[0].valor), 0));
  return (
    <section className="card ini-grupo">
      <div className="card-head">
        {/* quantos, no contador ao lado do título (24/11/2026: "essa apresentacao 3 lancamentos tambem nao gostei, apresenta de outra maneira") */}
        <h3>Lançamentos {quantos > 0 && <span className="gh-counter" title={quantos === 1 ? '1 lançamento' : quantos + ' lançamentos'}>{quantos}</span>}
          {r.comProblema > 0 && <span className="badge badge-warn sci-com-problema" title="Vão para a aba Conferir da planilha">{r.comProblema} com problema</span>}</h3>
        <span className="card-head-ctl">
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar" aria-label="Buscar nos lançamentos" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
          </label>
        </span>
      </div>
      {!vm.total ? (
        <div className="sci-tabela-caixa" tabIndex={0} onPaste={colar} onContextMenu={ev => aoMenu(ev, null)} ref={caixa}>
          <Vazio compacto icone="list" titulo="Nenhum lançamento ainda" texto="Clique em Novo lançamento, ou copie linhas do Excel e cole aqui (Ctrl+V ou o botão direito)." />
        </div>
      ) : (
        <div ref={caixa} className="table-wrap sci-tabela-caixa" tabIndex={0} onKeyDown={teclas} onPaste={colar} onContextMenu={ev => aoMenu(ev, null)} aria-label="Lançamentos: botão direito para as opções">
          <table className="table-compact ini-delegadas sci-tabela">
            <thead>
              <tr>
                <th className="sci-marca"><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarTodas(e.target.checked)} aria-label="Selecionar todos" /></th>
                <th>Data</th><th>Débito</th><th>Crédito</th><th className="num">Valor</th><th className="num">Hist.</th><th>Complemento</th><th>Doc.</th>
                <th title="O participante a débito (código no SCI)">Part. D</th><th title="O participante a crédito (código no SCI)">Part. C</th><th aria-label="Situação" />
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
                    <td><span className="ini-empresa">{l.debito || '—'}</span>{l.nomeD && <><br /><span className="hint">{l.nomeD}</span></>}</td>
                    <td><span className="ini-empresa">{l.credito || '—'}</span>{l.nomeC && <><br /><span className="hint">{l.nomeC}</span></>}</td>
                    <td className="num">{l.valorTexto || '—'}</td>
                    <td className="num">{l.historico || '—'}</td>
                    <td>{l.complemento}</td>
                    <td className="ini-delegadas-curta">{partida ? '' : l.documento}</td>
                    <td className="ini-delegadas-curta">{l.participanteD}</td>
                    <td className="ini-delegadas-curta">{l.participanteC}</td>
                    <td className="ini-delegadas-curta"><Situacao problemas={l.problemas} /></td>
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
                const historico = igual(l => l.historico);
                const complemento = igual(l => l.complemento);
                const problemas = [...new Set(ps.flatMap(l => l.problemas))];
                return [
                  <tr key={b.id} className={'ini-tr sci-multiplo-linha' + zebra + (todas ? ' sci-marcada' : '')}
                    onClick={e => vm.marcarGrupo(ids, e.ctrlKey || e.metaKey || e.shiftKey)} onDoubleClick={() => vm.editar(ids[0])} onContextMenu={ev => aoMenu(ev, ids[0], ids)}>
                    <td className="sci-marca" onClick={e => { e.stopPropagation(); vm.marcarGrupo(ids, true); }}><input type="checkbox" checked={todas} readOnly tabIndex={-1} aria-label={'Selecionar o lançamento múltiplo de ' + ps[0].dataTexto} /></td>
                    <td className="ini-delegadas-curta">{ps[0].dataTexto || '—'}</td>
                    <td colSpan={2}>
                      <button type="button" className="sci-abrir-multiplo" aria-expanded={aberto} title={aberto ? 'Fechar as partidas' : 'Ver as partidas'}
                        onClick={e => { e.stopPropagation(); abrirOuFechar(b.id); }} onDoubleClick={e => e.stopPropagation()}>
                        <Icone nome="chevronRight" className={'sci-abrir-seta' + (aberto ? ' aberta' : '')} />
                        <span className="ini-empresa">Lançamento múltiplo</span>
                        <span className="hint">{ps.length} partidas · {debitos.length === 1 ? '1 débito' : debitos.length + ' débitos'} · {creditos.length === 1 ? '1 crédito' : creditos.length + ' créditos'}</span>
                      </button>
                    </td>
                    <td className="num">{sci.valorParaTexto(total)}</td>
                    <td className="num">{historico || <span className="hint">vários</span>}</td>
                    <td>{complemento || <span className="hint">vários</span>}</td>
                    <td className="ini-delegadas-curta">{ps[0].documento}</td>
                    <td className="ini-delegadas-curta" />
                    <td className="ini-delegadas-curta" />
                    <td className="ini-delegadas-curta"><Situacao problemas={problemas} /></td>
                  </tr>,
                  ...(aberto ? ps.map(l => linha(l, true)) : []),
                ];
              })}
            </tbody>
            {/* o total numa linha própria, alinhado com o Valor (24/11/2026: "melhora isso, apresenta melhor"); os selecionados só
                quando há; sem a dica do botão direito */}
            <tfoot>
              <tr className="sci-total">
                <td colSpan={4} className="sci-total-rotulo">Total</td>
                <td className="num sci-total-valor">{totalTexto}</td>
                <td colSpan={6} className="sci-total-marcados">{vm.marcados.size > 0 && <span className="badge badge-neutral">{vm.marcados.size + (vm.marcados.size > 1 ? ' selecionados' : ' selecionado')}</span>}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {menu && <MenuDeContexto menu={menu} onFechar={() => setMenu(null)} />}
    </section>
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
