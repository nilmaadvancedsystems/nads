// A janela da tarefa do Início novo (13/11/2026, só no modo desenvolvedor; o mesmo ViewModel da TarefaAberta). A tarefa nova
// em dois passos (Vitor, 13/11/2026: "To achando poluido"): primeiro "Qual cliente vai ser essa tarefa?" (o menu com a busca
// ou o Avulso, com o campo e o ✓); depois, no desenho das janelas de registro, o cliente no alto (com Trocar), o nome, as
// propriedades (o prazo com as pílulas Hoje e Amanhã, a prioridade, para quem), os Detalhes e o clipe e o link. A tarefa que existe
// numa coluna só: o título, a descrição, os anexos e as informações (Vitor, 13/11/2026: "APENAS QUEM CRIOU A TAREFA pode setar:
// Prazo, prioridade, cliuentes, fica com e remova situação"; "Remove comentários e remove históricos!"). Clicar fora não fecha;
// o Esc e o ✕ perguntam antes de largar o que mudou.
import { tarefas } from '@nads/core';
import { Alerta, BotaoAcao, BotaoFechar, BotaoIcone, CampoData, Esqueleto, Icone, MenuSuspenso, Segmentado, useJanela, Vazio, type NomeIcone } from '@nads/ui';
import { useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type RefObject } from 'react';
import { Link } from 'react-router';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { SeloDoStatus } from './partes/SelosDaTarefa';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useNovidade } from '../../../../comum/novidades';
import { lembrarAgora } from './useLembreteDoRecebimento';
import { ClientesDaTarefa, EscolherPessoa, FicaComVoce, FotoDaPessoa } from './TarefaAberta';
import { printDeExemplo, useTarefaAberta } from './useTarefaAberta';

type Vm = ReturnType<typeof useTarefaAberta>;
const d = tarefas.delegadas;
const ESCOLHA = 'btn btn-ghost registro-escolha';
const ICONE = { iniciar: 'play', retomar: 'play', pausar: 'clock', concluir: 'check' } as const;
/** as ações que ficam só com o ícone no pé da janela (13/11/2026: "Iniciar e excluir, deixa apenas o icone") */
const SO_ICONE = new Set<string>(['iniciar', 'retomar']);

/**
 * As datas da tarefa numa caixa (Vitor, 13/11/2026: "Melhora o visual da box"): cada uma com o ícone e o nome em cima e o
 * valor embaixo, lado a lado; o "por quem" numa linha própria, mais apagado; a que ainda não aconteceu ("—") some.
 */
const ICONE_DA_DATA: Record<string, NomeIcone> = { 'Criada em': 'calendar', 'Concluída em': 'checkCircle', Visualizado: 'olho', 'Tempo trabalhado': 'clock' };
function DatasDaTarefa({ datas, envio = false }: { datas: readonly { rotulo: string; valor: string }[]; envio?: boolean }) {
  // o envio de arquivos não tem tempo trabalhado (13/11/2026: "Envio de arquivos nao tem prioridade, apenas pedir, tambem nao tem tempo trabalhando")
  const visiveis = datas.filter(x => x.valor && x.valor !== '—' && !(envio && x.rotulo === 'Tempo trabalhado'));
  if (!visiveis.length) return null;
  return (
    <dl className="tdl-datas">
      {visiveis.map(x => {
        const [valor, por] = x.valor.split(' por ');
        return (
          <div key={x.rotulo} className="tdl-data">
            <dt><Icone nome={ICONE_DA_DATA[x.rotulo] || 'calendar'} />{x.rotulo.replace(/ em$/, '')}</dt>
            <dd>{valor}{por && <span className="fraco">por {por}</span>}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * O prazo da tarefa (Vitor, 13/11/2026: "De a opcao 'Colocar prazo', marcando na criacao o sistema faz uma animacao, que aparece
 * data e hora"; no mesmo dia: "Tira esse hj e amanha, reduza um pouco a quantidade de botoes... a data e a hora pode ser input
 * normal"): a chave Colocar prazo (desligada, a tarefa fica sem prazo e nada mais aparece); ligada, entram com animação a data e
 * a hora, nos campos do navegador (o calendário e o relógio dele). Desligar apaga a data e a hora.
 */
function PrazoDaTarefa({ vm }: { vm: Vm }) {
  const [marcado, setLigado] = useState(() => !!vm.prazoTexto || !!vm.prazoHora);
  // o Repetir põe a data de hoje quando não tem prazo: a caixinha acompanha
  const ligado = marcado || !!vm.prazoTexto;
  const iso = d.prazoDaTela(vm.prazoTexto) || '';
  const alternar = () => {
    if (ligado) { vm.setPrazo(''); vm.setPrazoHora(''); }
    setLigado(!ligado);
  };
  return (
    <span className="tdl-prazo">
      {/* a caixinha, como o Delegar (13/11/2026: "tire esse botao dual de onoff") */}
      <label className="tdl-ja-fazendo"><input type="checkbox" checked={ligado} onChange={alternar} />Colocar prazo</label>
      {ligado && (
        <span className="tdl-prazo-escolhas">
          <input type="date" value={iso} aria-label="A data do prazo" onChange={e => vm.setPrazo(d.prazoParaTela(e.target.value))} />
          <input type="time" value={vm.prazoHora} aria-label="A hora do prazo" onChange={e => vm.setPrazoHora(e.target.value)} />
        </span>
      )}
      {ligado && vm.prazoNoDiaUtil && <span className="hint tdl-prazo-util">Não é dia útil: vai para {vm.prazoNoDiaUtil}</span>}
    </span>
  );
}

/**
 * Repetir, numa linha própria (Vitor, 18/11/2026: "coloca numa linha própria Repetir... Todo dia, toda semana, todo mes, todo
 * ano... e escolher qual periodo que eu quero, que as vezes a pessoa so quer colocar 12 meses ou 3 meses"): a frequência e, ao
 * repetir, Sem fim ou Por um período (quantos dias, semanas, meses ou anos). A data do prazo é a primeira vez; sem prazo, o
 * Repetir põe hoje. Concluída, nasce a próxima; dia não útil vai para o próximo dia útil. Para todos.
 */
function RepetirDaTarefa({ vm }: { vm: Vm }) {
  const [porPeriodo, setPorPeriodo] = useState(() => !!vm.vezes);
  const rotulo = vm.opcoesDeRepeticao.find(o => o.valor === vm.repete)?.rotulo || 'Não repete';
  const escolher = (v: typeof vm.repete) => {
    vm.setRepete(v);
    if (!v) { setPorPeriodo(false); vm.setVezes(''); return; }
    if (!vm.prazoTexto) vm.setPrazo(d.prazoParaTela(d.hojeIso()));
  };
  const periodo = (sim: boolean) => {
    setPorPeriodo(sim);
    vm.setVezes(sim ? String(vm.repete === 'mensal' ? 12 : vm.repete === 'semanal' ? 4 : vm.repete === 'diaria' ? 5 : 2) : '');
  };
  return (
    <span className="tdl-repetir">
      <MenuSuspenso rotulo={rotulo} className={ESCOLHA} titulo="Repetir" flutuante largura={200}
        itens={[{ valor: '' as const, rotulo: 'Não repete' }, ...vm.opcoesDeRepeticao].map(o => ({ rotulo: o.rotulo, marcado: o.valor === vm.repete, onClick: () => escolher(o.valor) }))} />
      {vm.repete && (
        <span className="tdl-repetir-periodo">
          <MenuSuspenso rotulo={porPeriodo ? 'Por' : 'Sem fim'} className={ESCOLHA} titulo="Até quando" flutuante largura={200}
            itens={[
              { rotulo: 'Sem fim', marcado: !porPeriodo, onClick: () => periodo(false) },
              { rotulo: 'Por um período', marcado: porPeriodo, onClick: () => periodo(true) },
            ]} />
          {porPeriodo && (
            <>
              <input type="number" inputMode="numeric" min={1} max={vm.maisVezes} value={vm.vezes} aria-label={'Quantos ' + vm.unidadeDasVezes}
                onChange={e => vm.setVezes(e.target.value)} />
              <span>{vm.unidadeDasVezes}</span>
            </>
          )}
        </span>
      )}
      {vm.repete && vm.prazoDaUltima && <span className="hint">A última fica para {vm.prazoDaUltima}</span>}
      {vm.repeteSemPrazo && <span className="hint tdl-atrasada">Coloque o prazo: é a data da primeira vez</span>}
    </span>
  );
}

/**
 * A cobrança da tarefa (Vitor, 13/11/2026: "Adiciona um icone de sino, nas tarefas delegadas, para meio que 'Cobrar' a tarefa e
 * cobrar atualizacoes, o usuario cobrado vai ter o botao, 'Responder cobranca'"): quem faz vê a cobrança e responde; quem
 * cobrou vê que está esperando, e depois a resposta.
 */
function CobrancaDaTarefa({ vm }: { vm: Vm }) {
  const c = vm.cobranca;
  const discreta = useNovidade('cobranca-notificada');
  if (!c || (!c.aberta && !c.resposta)) return null;
  if (discreta) return <CobrancaDiscreta vm={vm} />;
  if (c.aberta && c.responder) {
    return (
      <div className="tdl-cobranca cobrada" role="status">
        <p className="tdl-cobranca-topo"><Icone nome="sino" /><b>{c.aberta.por} cobrou uma atualização</b><span className="fraco">{c.aberta.quando}</span></p>
        <p className="tdl-cobranca-texto">{c.aberta.texto}</p>
        <textarea rows={2} value={vm.resposta} maxLength={vm.maiorParecer} placeholder="Como está a tarefa? O que já foi feito, o que falta" aria-label="A resposta à cobrança"
          onChange={e => vm.setResposta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.responderCobranca(); } }} />
        <span className="tdl-cobranca-acoes">
          <BotaoAcao className="btn btn-primary" carregando={c.ocupado} textoCarregando="Enviando" disabled={!vm.resposta.trim()} onClick={() => { void vm.responderCobranca(); }}>
            <Icone nome="envelope" />Responder cobrança
          </BotaoAcao>
        </span>
      </div>
    );
  }
  if (c.aberta) {
    return <p className="tdl-cobranca"><Icone nome="sino" /><span>Você cobrou uma atualização em {c.aberta.quando}. Esperando a resposta.</span></p>;
  }
  return (
    <div className="tdl-cobranca respondida">
      <p className="tdl-cobranca-topo"><Icone nome="sino" /><b>{c.resposta?.por} respondeu à cobrança</b><span className="fraco">{c.resposta?.quando}</span></p>
      <p className="tdl-cobranca-texto">{c.resposta?.texto}</p>
    </div>
  );
}

/**
 * A cobrança discreta (a novidade 'cobranca-notificada'; Vitor, 16/11/2026: "isso tá horrivel… faça uma bela popup"): o
 * destaque é a janela grande (JanelaDaCobranca). Aqui ficam só as linhas do andamento (quem cobrou vê o mais tempo pedido,
 * com a justificativa, e a resposta) e, para quem faz, o responder sem a caixa amarela.
 */
function CobrancaDiscreta({ vm }: { vm: Vm }) {
  const c = vm.cobranca!;
  return (
    <>
      <div className="tdl-cobranca-linhas" role="status">
        {c.andamento.map(p => (
          <p key={p.quando + p.texto}><Icone nome={p.tipo === 'adiamento' ? 'clock' : p.tipo === 'resposta' ? 'checkCircle' : 'sino'} /><span>{p.texto} <span className="fraco">· {p.quando}</span></span></p>
        ))}
        {c.aberta && !c.responder && <p><Icone nome="clock" /><span>Esperando a resposta.</span></p>}
      </div>
      {c.aberta && c.responder && (
        <div className="tdl-cobranca">
          <textarea rows={2} value={vm.resposta} maxLength={vm.maiorParecer} placeholder="Responder à cobrança: como está a tarefa?" aria-label="A resposta à cobrança"
            onChange={e => vm.setResposta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.responderCobranca(); } }} />
          <span className="tdl-cobranca-acoes">
            <BotaoAcao className="btn btn-outline" carregando={c.ocupado} textoCarregando="Enviando" disabled={!vm.resposta.trim()} onClick={() => { void vm.responderCobranca(); }}>
              <Icone nome="envelope" />Responder cobrança
            </BotaoAcao>
          </span>
        </div>
      )}
    </>
  );
}

/** as propriedades da tarefa (a nova e a coluna da esquerda da que existe) */
function Propriedades({ vm }: { vm: Vm }) {
  const id = useId();
  const r = vm.rascunho;
  const so = !vm.podeMudar;
  // o prazo, a prioridade, os clientes e para quem: só quem criou a tarefa muda
  const travado = so || !vm.criouEu;
  const hoje = d.prazoParaTela(d.hojeIso());
  const amanha = d.prazoParaTela(tarefas.agenda.somarDias(d.hojeIso(), 1));
  const prioridade = vm.prioridades.find(p => p.valor === r.prioridade)?.rotulo || '';
  // os documentos (13/11/2026): o prazo sem hora, o envio sem prazo nem prioridade, e sem a chave do delegar
  const docs = vm.pedeDocumentos, envio = vm.documentos.ehEnvio;
  return (
    <div className="registro-props">
      {/* o prazo em branco, só para ler: some (Vitor, 13/11/2026: "Se o prazo nao foi preenchido, so oculta ele... nao deixa exposto") */}
      {!envio && !(travado && !vm.prazoTexto) && <Propriedade icone="clock" rotulo="Prazo">
        {travado ? <span>{vm.prazoTexto ? vm.prazoTexto + (vm.prazoHora ? ' ' + vm.prazoHora : '') : '—'}</span> : !docs ? <PrazoDaTarefa vm={vm} /> : (
          <span className="ini-prazo">
            <span className="chip-row">
              <button type="button" className={'chip-f' + (vm.prazoTexto === hoje ? ' on' : '')} aria-pressed={vm.prazoTexto === hoje} onClick={() => vm.setPrazo(vm.prazoTexto === hoje ? '' : hoje)}>Hoje</button>
              <button type="button" className={'chip-f' + (vm.prazoTexto === amanha ? ' on' : '')} aria-pressed={vm.prazoTexto === amanha} onClick={() => vm.setPrazo(vm.prazoTexto === amanha ? '' : amanha)}>Amanhã</button>
            </span>
            <span className="tdl-prazo-campos">
              <CampoData id={id + '-prazo'} rotulo="Prazo" valor={vm.prazoTexto} onMudar={vm.setPrazo} />
              {!docs && <input type="time" value={vm.prazoHora} aria-label="Hora do prazo" onChange={e => vm.setPrazoHora(e.target.value)} />}
            </span>
          </span>
        )}
      </Propriedade>}
      {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
      {vm.podeRepetir && !travado && !docs && <Propriedade icone="repeat" rotulo="Repetir"><RepetirDaTarefa vm={vm} /></Propriedade>}
      {!envio && <Propriedade icone="alert" rotulo="Prioridade">
        {travado ? <span>{prioridade}</span> : (
          <MenuSuspenso rotulo={prioridade} className={ESCOLHA} titulo="A prioridade" flutuante largura={200}
            itens={vm.prioridades.map(p => ({ rotulo: p.rotulo, marcado: p.valor === r.prioridade, onClick: () => vm.setPrioridade(p.valor) }))} />
        )}
      </Propriedade>}
      {!vm.ehNova && <Propriedade icone="briefcase" rotulo="Clientes"><ClientesDaTarefa vm={vm} so={travado} /></Propriedade>}
      <Propriedade icone="usuario" rotulo={vm.delegar || travado ? 'Para quem' : 'Fica com'}>
        <span className="ini-delegar">
          {travado || vm.delegar ? <EscolherPessoa vm={vm} so={travado} rotuloId={id + '-quem'} /> : <FicaComVoce vm={vm} />}
          {/* a caixinha Delegar no lugar da chave Sim/Não (Vitor, 13/11/2026: "coloca um check delegar, e tire esse botao dual de onoff") */}
          {!travado && !docs && <label className="tdl-ja-fazendo" title="Delegar para outra pessoa"><input type="checkbox" checked={vm.delegar} onChange={vm.alternarDelegar} />Delegar</label>}
        </span>
      </Propriedade>
      {vm.ehNova && !vm.delegar && (
        <label className="tdl-ja-fazendo"><input type="checkbox" checked={vm.jaFazendo} onChange={e => vm.setJaFazendo(e.target.checked)} />Já estava fazendo</label>
      )}
      {!travado && <EntregaDoOfficeBoy vm={vm} />}
    </div>
  );
}

/**
 * a Entrega (a novidade 'entrega-do-office-boy', 16/11/2026): escolhido o office boy em "Para quem", a caixinha Entrega; marcada,
 * o tipo (Entregar, Buscar, Outro) e o Criar manda o pedido para a fila dele no Entregas, sem criar a tarefa
 */
function EntregaDoOfficeBoy({ vm }: { vm: Vm }) {
  const e = vm.entrega;
  if (!e.pode) return null;
  return (
    <>
      <Propriedade icone="caminhao" rotulo="Entrega">
        <span className="ini-delegar">
          <label className="tdl-ja-fazendo" title="Mandar para a fila do office boy no Entregas, em vez de criar a tarefa">
            <input type="checkbox" checked={e.marcada} onChange={e.alternar} />Entrega
          </label>
          {e.marcada && e.tipo && <Segmentado valor={e.tipo} opcoes={[...e.tipos]} onMudar={e.setTipo} />}
        </span>
      </Propriedade>
      {e.marcada && <p className="registro-dica"><Icone nome="caminhao" />Vai para as Solicitações do Entregas, a fila do office boy. Não vira tarefa: acompanhe por lá.</p>}
    </>
  );
}

function Descricao({ vm }: { vm: Vm }) {
  const id = useId();
  // em branco e só para ler (a concluída, ou de quem não muda): some, como o prazo (13/11/2026: "so oculta ele... nao deixa exposto")
  if (!vm.podeMudarDetalhes && !vm.rascunho.descricao.trim()) return null;
  // só para ler, o texto sem a caixa (16/11/2026: "Detalhes depois das tarefas e documentos concluidas não pode ser editadas")
  if (!vm.podeMudarDetalhes) return (
    <div className="field">
      <span className="field-rotulo">Detalhes</span>
      <p className="ini-detalhe-texto">{vm.rascunho.descricao}</p>
    </div>
  );
  // o print colado (a novidade 'colar-print'): a imagem da área de transferência vira anexo; o que vem com texto (o Excel
  // manda texto e imagem) cola como texto, como no suporte
  const colar = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!vm.podeColarPrint || e.clipboardData.getData('text/plain').trim()) return;
    const imagens = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
    if (!imagens.length) return;
    e.preventDefault();
    void vm.anexar(vm.nomearPrints(imagens));
  };
  return (
    <div className="field">
      <label htmlFor={id}>Detalhes</label>
      <textarea id={id} rows={4} value={vm.rascunho.descricao} maxLength={vm.maiorDescricao} onPaste={colar}
        placeholder={'Os detalhes, o que já foi visto, onde estão os documentos' + (vm.podeColarPrint ? '. Cole um print com Ctrl+V' : '')}
        onChange={e => vm.setDescricao(e.target.value)} />
      <PrintsColados vm={vm} />
    </div>
  );
}

/** as miniaturas dos prints colados nos Detalhes, cada uma com o × para tirar (a nova; na que existe, eles vão aos anexos) */
function PrintsColados({ vm }: { vm: Vm }) {
  const imagens = useMemo(() => vm.prints.map(p => ({ ...p, url: URL.createObjectURL(new Blob([p.bytes as BlobPart], { type: p.tipo })) })), [vm.prints]);
  useEffect(() => () => { for (const p of imagens) URL.revokeObjectURL(p.url); }, [imagens]);
  if (!imagens.length) return null;
  return (
    <ul className="ini-prints" aria-label="Prints colados">
      {imagens.map(p => (
        <li key={p.id}>
          <img src={p.url} alt={p.nome} title={p.nome} />
          {vm.podeMudar && <BotaoIcone pequeno icone="x" titulo={'Tirar ' + p.nome} onClick={() => void vm.tirarAnexo(p.id)} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * os anexos e os links (Vitor, 13/11/2026: "Anexos a box tá muito grande, deixa só o icone do clip, tambem coloque o icone de
 * link"; no mesmo dia: "Substitua esses dois botoes por um botao 'Anexo', e dentro da popup vai ter, link e arquivo"): o botão
 * Anexo abre o menu com Arquivo (escolhe os arquivos) e Link (abre o campo do link, numa linha só dele, com o ícone, o × e o Fixar;
 * o colado sem o https:// ganha o https://; 15/11/2026: "melhora a questao dos links"); a lista só com algum (o link pelo site)
 */
function Anexos({ vm }: { vm: Vm }) {
  const id = useId();
  const arquivo = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<string | null>(null);
  const fixar = async () => { if (link != null && await vm.fixarLink(link)) setLink(null); };
  const tem = vm.anexos.length > 0 || vm.links.length > 0;
  return (
    <section className="ini-anexos" aria-label="Anexos e links">
      {vm.podeMudar && (
        <div className="ini-anexos-botoes">
          <MenuSuspenso rotulo="Anexo" icone="clipe" flutuante largura={200} titulo="Anexar" dica="Anexar um arquivo ou fixar um link"
            itens={[
              { rotulo: 'Arquivo', icone: 'arquivo', desabilitado: vm.anexando, onClick: () => arquivo.current?.click() },
              { rotulo: 'Link', icone: 'link', onClick: () => setLink('') },
            ]} />
          <input ref={arquivo} id={id} type="file" multiple className="sr-only" disabled={vm.anexando} aria-label="Escolher os arquivos"
            onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) void vm.anexar(fs); }} />
          {vm.anexando && <span className="hint">Anexando…</span>}
        </div>
      )}
      {vm.podeMudar && link != null && (
        <div className="ini-link-campo">
          <Icone nome="link" />
          <input type="text" inputMode="url" value={link} autoFocus placeholder="Cole o link aqui" aria-label="O link" spellCheck={false}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void fixar(); } if (e.key === 'Escape') { e.stopPropagation(); setLink(null); } }} />
          <BotaoIcone pequeno icone="x" titulo="Cancelar" onClick={() => setLink(null)} />
          <button type="button" className="btn btn-primary ini-link-fixar" disabled={!link.trim()} onClick={() => void fixar()}>Fixar</button>
        </div>
      )}
      {vm.podeBaixarTudo && (
        <div className="ini-anexos-tudo">
          <span className="hint">{vm.anexos.length} arquivos</span>
          <button type="button" className="btn btn-outline" disabled={vm.baixandoTudo} onClick={() => void vm.baixarTudo()}>
            {vm.baixandoTudo ? <span className="btn-spinner" /> : <Icone nome="download" />}{vm.baixandoTudo ? 'Juntando…' : 'Baixar tudo (.zip)'}
          </button>
        </div>
      )}
      {tem && (
        <ul className="ini-anexos-lista">
          {vm.anexos.map(a => (
            <li key={a.id}>
              <Icone nome="clipe" />
              <button type="button" className="ini-abrir" title="Baixar" onClick={() => void vm.baixarAnexo(a.id)}>{a.nome}</button>
              <span className="hint">{a.detalhe}</span>
              {vm.podeMudar && <BotaoIcone pequeno icone="x" titulo={'Tirar ' + a.nome} onClick={() => void vm.tirarAnexo(a.id)} />}
            </li>
          ))}
          {vm.links.map(l => (
            <li key={l.url}>
              <Icone nome="link" />
              <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>{l.rotulo}</a>
              <span className="hint">{l.detalhe}</span>
              {vm.podeMudar && <BotaoIcone pequeno icone="x" titulo="Tirar o link" onClick={() => void vm.tirarLink(l.url)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** o passo 1 da tarefa nova: o cliente do menu (com a busca) ou o Avulso (o nome e o ✓); ou sem cliente */
function QualCliente({ vm, seguir }: { vm: Vm; seguir: () => void }) {
  return (
    <div className="registro-corpo ini-qual-cliente">
      <h2 className="ini-passo-titulo">Qual cliente vai ser essa tarefa?</h2>
      <EscolherCliente vm={vm} depois={seguir} />
      <button type="button" className="btn btn-ghost ini-sem-cliente" onClick={seguir}>Tarefa sem cliente<Icone nome="chevronRight" /></button>
    </div>
  );
}

/** o cliente do menu (com a busca) ou o Avulso (o nome e o ✓) */
function EscolherCliente({ vm, depois }: { vm: Vm; depois: () => void }) {
  const [q, setQ] = useState('');
  const [avulso, setAvulso] = useState(false);
  const [nome, setNome] = useState('');
  const achadas = vm.achadasPara(q);
  const escolher = (fechar: () => void, e: { codigo: number | null; nome: string }) => { fechar(); vm.adicionarCliente(e); setQ(''); depois(); };
  const doAvulso = () => { const n = nome.trim(); if (!n) return; vm.adicionarCliente({ codigo: null, nome: n }); depois(); };
  return (
    <>
      <MenuSuspenso rotulo="Escolher o cliente" className="btn btn-outline ini-qual-menu" titulo="O cliente da tarefa" flutuante largura={420}
        conteudo={fechar => (
          <>
            <label className="busca-curta larga">
              <Icone nome="search" />
              <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={q} onChange={e => setQ(e.target.value)}
                ref={el => { if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0); }}
                onKeyDown={e => { if (e.key === 'Enter' && achadas[0]) escolher(fechar, achadas[0]); }} />
            </label>
            <div className="menu-busca-lista">
              {achadas.map(e => (
                <button key={String(e.codigo) + e.nome} type="button" className="popover-item" onClick={() => escolher(fechar, e)}>
                  <span className="popover-texto"><b className="num">{e.codigo ?? '—'}</b> {e.nome}</span>
                </button>
              ))}
              {!achadas.length && <p className="hint">Nenhuma empresa com isso.</p>}
            </div>
          </>
        )} />
      <label className="tdl-ja-fazendo"><input type="checkbox" checked={avulso} onChange={e => setAvulso(e.target.checked)} />Avulso (não está no cadastro)</label>
      {avulso && (
        <span className="ini-avulso">
          <input type="text" value={nome} autoFocus maxLength={150} placeholder="O nome do cliente" aria-label="O nome do cliente avulso" onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doAvulso(); } }} />
          <BotaoIcone icone="check" titulo="Usar este nome" disabled={!nome.trim()} onClick={doAvulso} />
        </span>
      )}
    </>
  );
}

// ---- delegar documentos (Vitor, 13/11/2026: "Primeira tela, pedir ou enviar?", "selecionar o cliente (Pode selecionar
// avulso)", "as pessoas"; "na próxima tela… não tem prazo… nem prioridade… descrição e anexos em link e arquivo")

const nomeDoCliente = (c: { codigo: number | null; nome: string }) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;

/** o cliente dos documentos (obrigatório, um só): escolhido, o nome com Trocar */
function ClienteDosDocumentos({ vm }: { vm: Vm }) {
  const c = vm.clientes[0];
  if (!c) return <span className="ini-qual-cliente"><EscolherCliente vm={vm} depois={() => undefined} /></span>;
  return (
    <span className="ini-cliente-escolhido">
      <span><span className="ini-empresa">{nomeDoCliente(c)}</span>{c.codigo == null && <span className="fraco"> · avulso</span>}</span>
      {/* só o ícone (Vitor, 13/11/2026: "Trocar tbm ta bugado. deixa so o icone") */}
      <BotaoIcone pequeno icone="repeat" titulo="Trocar o cliente" onClick={() => vm.tirarCliente(0)} />
    </span>
  );
}

/** para quem: no envio, uma ou mais pessoas (cada uma recebe a sua tarefa); no requerer, uma só */
function PessoasDosDocumentos({ vm }: { vm: Vm }) {
  const varias = vm.documentos.modo === 'enviar';
  const escolhidas = vm.equipe.filter(p => vm.documentos.pessoas.includes(p.uid));
  const rotulo = escolhidas.length
    // o ícone da pessoa (13/11/2026: "Para quem coloca o icone"): a foto quando tem; sem foto, o ícone no lugar da inicial
    ? <span className="pessoa-escolhida">{escolhidas.length === 1 && escolhidas[0].foto ? <FotoDaPessoa p={escolhidas[0]} /> : <Icone nome="usuario" />}<span>{escolhidas.map(p => p.nome).join(', ')}</span></span>
    : <span className="pessoa-escolhida fraco">{varias ? 'Escolha as pessoas' : 'Escolha a pessoa'}</span>;
  return (
    <MenuSuspenso rotulo={rotulo} flutuante className="btn btn-outline pessoa-botao" titulo="Para quem" dica={varias ? 'Uma ou mais pessoas' : 'Uma pessoa'}
      conteudo={fechar => (
        <div className="pessoa-lista" role="listbox" aria-multiselectable={varias} aria-label="Para quem">
          {vm.equipe.filter(p => !p.voce).map(p => {
            const sim = vm.documentos.pessoas.includes(p.uid);
            return (
              <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={sim} onClick={() => { vm.documentos.alternarPessoa(p.uid); if (!varias) fechar(); }}>
                <FotoDaPessoa p={p} />
                <span className="popover-texto">{p.nome}</span>
                {sim && <Icone nome="check" width={16} height={16} />}
              </button>
            );
          })}
        </div>
      )} />
  );
}

/** o passo 1 dos documentos: enviar ou requerer, e o cliente (ou avulso) */
function DocumentosPasso1({ vm }: { vm: Vm }) {
  const m = vm.documentos.modo;
  return (
    <div className="registro-corpo ini-qual-cliente">
      <h2 className="ini-passo-titulo">Enviar ou requerer documentos?</h2>
      {/* os dois do mesmo tamanho, na largura toda (13/11/2026: "resolve esses dois botoes, ta feio") */}
      <Segmentado<'' | tarefas.delegadas.ModoDosDocumentos> valor={m ?? ''} onMudar={v => { if (v) vm.documentos.escolherModo(v); }}
        opcoes={[{ valor: 'enviar', rotulo: 'Enviar documentos' }, { valor: 'requerer', rotulo: 'Requerer documentos' }]} />
      {m && <p className="registro-dica"><Icone nome="clipe" />{m === 'requerer' ? 'Quem recebe anexa os arquivos e envia; você confere e conclui, ou contesta o que faltou.' : 'Quem recebe baixa os arquivos e confirma o recebimento.'}</p>}
      <div className="registro-props">
        <Propriedade icone="briefcase" rotulo="Cliente"><ClienteDosDocumentos vm={vm} /></Propriedade>
      </div>
    </div>
  );
}

/** o passo 2 dos documentos: para quem e, no requerer, o prazo (sem hora) e a prioridade */
function PropriedadesDosDocumentos({ vm }: { vm: Vm }) {
  const prioridade = vm.prioridades.find(p => p.valor === vm.rascunho.prioridade)?.rotulo || '';
  return (
    <div className="registro-props">
      <Propriedade icone="usuario" rotulo="Para quem"><PessoasDosDocumentos vm={vm} /></Propriedade>
      {vm.documentos.modo === 'requerer' && (
        <>
          <Propriedade icone="clock" rotulo="Prazo">
            {/* a data no campo do navegador, sem o Hoje e o Amanhã (13/11/2026: "Tira esse hj e amanha... a data e a hora pode ser input normal") */}
            <span className="tdl-prazo-escolhas sem-animacao">
              <input type="date" value={d.prazoDaTela(vm.prazoTexto) || ''} aria-label="A data do prazo" onChange={e => vm.setPrazo(d.prazoParaTela(e.target.value))} />
            </span>
          </Propriedade>
          {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
          <Propriedade icone="alert" rotulo="Prioridade">
            <MenuSuspenso rotulo={prioridade} className={ESCOLHA} titulo="A prioridade" flutuante largura={200}
              itens={vm.prioridades.map(p => ({ rotulo: p.rotulo, marcado: p.valor === vm.rascunho.prioridade, onClick: () => vm.setPrioridade(p.valor) }))} />
          </Propriedade>
        </>
      )}
    </div>
  );
}

/** os botões da tarefa de documentos que já existe: confirmar o recebimento, enviar, repassar, contestar, confirmar que veio tudo */
function AcoesDosDocumentos({ vm }: { vm: Vm }) {
  return (
    <>
      {vm.documentos.acoes.map(a => (a.id === 'repassar' ? (
        <MenuSuspenso key={a.id} rotulo="Repassar" icone="repeat" className="btn btn-outline" flutuante titulo="Repassar para" dica="Quem pode ter o documento"
          conteudo={fechar => (
            <div className="pessoa-lista" role="listbox" aria-label="Repassar para">
              {vm.documentos.paraRepassar.map(p => (
                <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={false} onClick={() => { fechar(); void vm.documentos.repassarPara(p.uid); }}>
                  <FotoDaPessoa p={p} /><span className="popover-texto">{p.nome}</span>
                </button>
              ))}
            </div>
          )} />
      ) : (
        <button key={a.id} type="button" className={'btn ' + (a.id === 'contestar' ? 'btn-outline' : 'btn-primary')} onClick={() => { void vm.documentos.fazer(a.id); }}>
          <Icone nome={a.id === 'contestar' ? 'alert' : 'check'} />{a.rotulo}
        </button>
      )))}
    </>
  );
}

/**
 * o ⚡ Dados de teste da janela (só no modo desenvolvedor): preenche o envio ou o requerer de exemplo (e o Criar não grava
 * nada) e mostra o lembrete de confirmar o recebimento sem esperar os 10 minutos. Os casos já andando (enviado esperando a
 * confirmação, requerido contestado e repassado) vêm no "Tarefas de exemplo" do ⚡ do Início.
 */
function TesteDosDocumentos({ vm }: { vm: Vm }) {
  const [dev] = useModoDesenvolvedor();
  if (!dev) return null;
  return (
    <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={300} titulo="Modo desenvolvedor · nada vai para o banco"
      itens={[
        { rotulo: 'Exemplo de envio', icone: 'zap', marcado: vm.documentos.deTeste && vm.documentos.modo === 'enviar', onClick: () => vm.documentos.preencherExemplo('enviar') },
        { rotulo: 'Exemplo de requerer', icone: 'zap', marcado: vm.documentos.deTeste && vm.documentos.modo === 'requerer', onClick: () => vm.documentos.preencherExemplo('requerer') },
        // o print colado (a novidade 'colar-print'): um comprovante de exemplo, como se tivesse colado com Ctrl+V nos Detalhes
        ...(vm.podeColarPrint ? [{ rotulo: 'Colar um print de exemplo', icone: 'zap' as const, onClick: () => { void printDeExemplo().then(f => vm.anexar(vm.nomearPrints([f]))); } }] : []),
        'separador',
        { rotulo: 'Mostrar o lembrete de confirmar', icone: 'clock', onClick: lembrarAgora },
      ]} />
  );
}

export function TarefaAbertaNova({ alvo, voltar, criada, saida }: {
  alvo: string; voltar: () => void; criada: (paraMim: boolean) => void; saida: RefObject<((depois: () => void) => void) | null>;
}) {
  const aberta = useTarefaAberta(alvo, voltar, criada, true);
  // a tarefa concluída não se edita mais (Vitor, 13/11/2026: "Tarefa concluida nao pode ser editada"): tudo só para leitura,
  // sem Salvar nem Excluir; o título, os detalhes, os anexos e as informações continuam à vista
  const concluida = !aberta.ehNova && aberta.rascunho.status === 'concluida';
  const vm: typeof aberta = concluida ? { ...aberta, podeMudar: false, podeMudarDetalhes: false, podeColarPrint: false, podeExcluir: false, acoes: [] } : aberta;
  // o sino de cobrar e o Responder cobrança (a novidade 'cobrar-tarefa', aprovada para todos em 13/11/2026)
  const cobrarLigado = useNovidade('cobrar-tarefa');
  useEffect(() => {
    saida.current = depois => { void vm.largar(depois); };
    return () => { saida.current = null; };
  });
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.cancelar);
  const so = !vm.podeMudar;
  // a tarefa nova começa pelo cliente (o passo 1); com o cliente escolhido (ou sem cliente), vai para o resto
  const [passo, setPasso] = useState<'cliente' | 'tarefa'>('cliente');
  // os documentos no Início novo: a janela própria em dois passos (sem o título, o prazo e a prioridade)
  const docs = vm.ehNova && vm.pedeDocumentos;
  // a tarefa de documentos que já existe: o fluxo dela no lugar do Iniciar, Pausar e Concluir
  const deDocumentos = !vm.ehNova && vm.pedeDocumentos;
  const trocarCliente = () => { vm.clientes.forEach(() => vm.tirarCliente(0)); setPasso('cliente'); };
  // sem o número (Vitor, 13/11/2026: "Nao quero que o numero da tarefa apareca para o usuario"); ele segue só no banco
  const nome = vm.ehNova ? (vm.pedeDocumentos ? 'Delegar documentos' : 'Nova tarefa') : 'Tarefa';

  const titulo = so ? <h2 className="tdl-tarefa-titulo">{vm.rascunho.titulo}</h2> : (
    <input className="tdl-janela-titulo" type="text" value={vm.rascunho.titulo} maxLength={vm.maiorTitulo} autoFocus={vm.ehNova}
      placeholder={vm.ehNova ? 'O nome da tarefa' : 'Título'} aria-label="Título da tarefa" onChange={e => vm.setTitulo(e.target.value)} />
  );
  const pe = vm.podeMudar && (
    <footer className="registro-pe">
      {!vm.ehNova && vm.podeExcluir && (
        // a lixeira só com o ícone, toda vermelha (Vitor, 13/11/2026: "Iniciar e excluir, deixa apenas o icone, botao da lixeira todo vermelho")
        <BotaoAcao className="btn btn-so-icone btn-lixeira" carregando={vm.excluindo} title="Excluir a tarefa" aria-label="Excluir a tarefa" onClick={() => { void vm.excluir(); }}>
          <Icone nome="lixeira" />
        </BotaoAcao>
      )}
      {deDocumentos ? <AcoesDosDocumentos vm={vm} /> : vm.acoes.map(a => SO_ICONE.has(a.id) ? (
        // o Iniciar (e o Retomar, o mesmo play) só com o ícone; o nome fica na dica
        <button key={a.id} type="button" className="btn btn-outline btn-so-icone" title={a.rotulo} aria-label={a.rotulo} onClick={() => { void vm.fazerAcao(a.status); }}><Icone nome={ICONE[a.id]} /></button>
      ) : (
        <button key={a.id} type="button" className="btn btn-outline" onClick={() => { void vm.fazerAcao(a.status); }}><Icone nome={ICONE[a.id]} />{a.rotulo}</button>
      ))}
      {cobrarLigado && vm.cobranca?.podeCobrar && (
        // o botão com o nome, no lugar do sininho (Vitor, 13/11/2026: "O sininho troque pelo botao 'cobrar atualizacao'")
        <BotaoAcao className="btn btn-outline" carregando={vm.cobranca.ocupado} textoCarregando="Cobrando" title={'Cobrar uma atualização de ' + (vm.rascunho.responsavel?.nome || 'quem faz')} onClick={() => { void vm.cobrar(); }}>
          <Icone nome="sino" />Cobrar atualização
        </BotaoAcao>
      )}
      <span className="tarefas-barra-espaco" />
      <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
      <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando" onClick={() => { void vm.salvar(); }}>
        <Icone nome={vm.entrega.marcada ? 'caminhao' : 'check'} />{vm.ehNova ? (vm.entrega.marcada ? 'Enviar para Entregas' : vm.delegar ? 'Criar e delegar' : 'Criar tarefa') : 'Salvar'}
      </BotaoAcao>
    </footer>
  );

  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal registro-novo tdl-janela-nova" role="dialog" aria-modal="true" aria-label={nome}>
        <header className="registro-topo">
          {/* o Voltar sempre no canto superior esquerdo (Vitor, 13/11/2026: "Voltar sempre lado esquerdo superior, sempre! na aplicacao toda") */}
          {docs && passo === 'tarefa' && <button type="button" className="btn btn-ghost registro-voltar" onClick={() => setPasso('cliente')}><Icone nome="chevronLeft" />Voltar</button>}
          <span className="registro-caminho"><b>{nome}</b></span>
          {vm.status && <SeloDoStatus rotulo={vm.status.rotulo} tom={vm.status.tom} />}
          {docs && <TesteDosDocumentos vm={vm} />}
          <BotaoFechar onClick={vm.cancelar} />
        </header>
        {vm.carregando ? <div className="registro-corpo"><Esqueleto linhas={6} /></div> : vm.sumiu ? (
          <div className="registro-corpo"><Vazio icone="checklist" titulo="Esta tarefa não está mais na sua lista" texto="Ela foi excluída ou delegada para outra pessoa." /></div>
        ) : docs && passo === 'cliente' ? (
          <>
            <DocumentosPasso1 vm={vm} />
            <footer className="registro-pe">
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={!!vm.documentos.faltaNoPasso1} title={vm.documentos.faltaNoPasso1 || undefined} onClick={() => setPasso('tarefa')}>
                Continuar<Icone nome="chevronRight" />
              </button>
            </footer>
          </>
        ) : docs ? (
          <>
            <div className="registro-corpo">
              <p className="registro-dica"><Icone nome="clipe" />{vm.documentos.modo === 'enviar' ? 'Anexe os arquivos ou cole o link do que vai enviar.' : 'Diga quais documentos precisa; quem receber anexa e envia.'}</p>
              <div className="ini-cliente-escolhido">
                <Icone nome="briefcase" />
                <span className="ini-empresa">{vm.clientes.map(nomeDoCliente).join(', ')}</span>
              </div>
              <PropriedadesDosDocumentos vm={vm} />
              <Descricao vm={vm} />
              <Anexos vm={vm} />
              {vm.erro && <Alerta naLinha titulo={vm.erro} />}
            </div>
            <footer className="registro-pe">
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
              <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Delegando" onClick={() => { void vm.salvar(); }}>
                <Icone nome="check" />{vm.documentos.modo === 'enviar' ? 'Enviar documentos' : 'Requerer documentos'}
              </BotaoAcao>
            </footer>
          </>
        ) : vm.ehNova && passo === 'cliente' ? (
          <>
            <QualCliente vm={vm} seguir={() => setPasso('tarefa')} />
            <footer className="registro-pe"><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button></footer>
          </>
        ) : vm.ehNova ? (
          <>
            <div className="registro-corpo">
              {vm.pedeDocumentos && <p className="registro-dica"><Icone nome="clipe" />Quem receber anexa os arquivos e confirma; a tarefa fica concluída.</p>}
              <div className="ini-cliente-escolhido">
                <Icone nome="briefcase" />
                <span>{vm.clientes.length ? <span className="ini-empresa">{vm.clientes.map(nomeDoCliente).join(', ')}</span> : 'Sem cliente'}{vm.clientes.some(c => c.codigo == null) && <span className="fraco"> · avulso</span>}</span>
                <BotaoIcone pequeno icone="repeat" titulo="Trocar o cliente" onClick={trocarCliente} />
              </div>
              {titulo}
              <Propriedades vm={vm} />
              <Descricao vm={vm} />
              <Anexos vm={vm} />
              {vm.erro && <Alerta naLinha titulo={vm.erro} />}
            </div>
            {pe}
          </>
        ) : (
          <>
            <div className="registro-corpo">
              {cobrarLigado && <CobrancaDaTarefa vm={vm} />}
              {deDocumentos && <p className="registro-dica"><Icone nome="clipe" />{vm.documentos.situacao}</p>}
              {/* o que faltou, para contestar o requerer (sem a conversa na janela, o motivo é escrito aqui; 13/11/2026) */}
              {vm.documentos.acoes.some(a => a.id === 'contestar') && (
                <div className="field">
                  <label htmlFor="docs-faltou">O que faltou? (para contestar)</label>
                  <textarea id="docs-faltou" rows={2} value={vm.parecer} maxLength={vm.maiorParecer} placeholder="Escreva o que faltou e clique em Contestar" onChange={e => vm.setParecer(e.target.value)} />
                </div>
              )}
              {vm.caminhoDaEtapa && <Link className="btn btn-primary" to={vm.caminhoDaEtapa}><Icone nome="play" />Abrir a etapa</Link>}
              {titulo}
              <Descricao vm={vm} />
              <Anexos vm={vm} />
              <Propriedades vm={vm} />
              <DatasDaTarefa datas={vm.datas} envio={vm.documentos.ehEnvio} />
              {/* sem a frase da concluída (Vitor, 13/11/2026: "Tarefa concluída: fica só para consulta. remove essa frase") */}
              {concluida ? null
                : so ? <p className="hint">Só quem criou a tarefa e o responsável mudam esta tarefa.</p>
                : !vm.criouEu && <p className="hint">O prazo, a prioridade, os clientes e para quem só quem criou a tarefa muda.</p>}
              {vm.erro && <Alerta naLinha titulo={vm.erro} />}
            </div>
            {pe}
          </>
        )}
      </div>
    </div>
  );
}
