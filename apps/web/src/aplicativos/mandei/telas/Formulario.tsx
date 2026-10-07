// O formulário do cliente (Mandei), com o desenho próprio da página pública (Vitor, 07/10/2026: "muito básico, algo
// mais bonito"; as classes .mandei-* no nads.css): a marca no alto; a entrada com o passo a passo e o prazo; um
// cliente por vez (os lançamentos, a nossa pergunta como mensagem do escritório, as respostas em cartões com ícone,
// o texto e o anexar); a revisão antes de enviar; a barra de baixo com o progresso. Link vencido ou inválido: o aviso.
import { CampoArquivos, Icone, MarcaN, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';
import { useFormulario } from './useFormulario';

type VM = ReturnType<typeof useFormulario>;
type Linhas = VM['itens'][number]['linhas'];

const TIPO = { nota: 'Nota em aberto', pagamento: 'Pagamento sem nota', devolucao: 'Devolução', saldo: 'Saldo do mês' } as const;

/** "2 notas em aberto · 1 pagamento sem nota" (o resumo no alto do cliente). */
function resumoDasLinhas(linhas: Linhas): string {
  const n = (t: string) => (linhas || []).filter(l => l.tipo === t).length;
  const notas = n('nota'), pagamentos = n('pagamento'), devolucoes = n('devolucao');
  return [
    notas ? notas + (notas === 1 ? ' nota em aberto' : ' notas em aberto') : '',
    pagamentos ? pagamentos + (pagamentos === 1 ? ' pagamento sem nota' : ' pagamentos sem nota') : '',
    devolucoes ? devolucoes + (devolucoes === 1 ? ' devolução' : ' devoluções') : '',
  ].filter(Boolean).join(' · ');
}

/** O ícone de cada resposta pronta (pelo começo do texto); as outras, o check. */
function iconeDaOpcao(o: string): NomeIcone {
  const t = o.toLowerCase();
  if (t.startsWith('já foi pago')) return 'recibo';
  if (t.includes('dinheiro')) return 'cartao';
  if (t.includes('outra conta')) return 'landmark';
  if (t.includes('não reconheço')) return 'alert';
  if (t.startsWith('outro')) return 'lapis';
  return 'check';
}

export function Formulario() {
  const vm = useFormulario();
  return (
    <div className="mandei">
      <header className="mandei-topo">
        <span className="brand-mark" aria-hidden="true"><MarcaN /></span><b>Nilma Contabilidade</b>
        {vm.numero && <span className="mandei-ticket">Ticket {vm.numero}</span>}
      </header>
      <main className="mandei-corpo">
        {!vm.existe ? (
          <Fim icone="link" titulo="Link não encontrado" texto="Confira o endereço que você recebeu por e-mail." />
        ) : !vm.valido ? (
          <Fim icone="clock" titulo="Este link venceu" texto="Se ainda precisar responder, fale com o escritório: enviamos um novo link." />
        ) : vm.enviado ? (
          <Fim icone="checkCircle" titulo="Recebemos a sua resposta" texto={'Obrigado! Até ' + vm.validoAte + ' dá para voltar por este mesmo link e mandar mais arquivos.'}
            acao={<button type="button" className="btn" onClick={vm.voltar}>Voltar às respostas</button>} />
        ) : !vm.comecou ? <Entrada vm={vm} /> : vm.revisao ? <Revisao vm={vm} /> : <Passo vm={vm} />}
      </main>
      {vm.existe && vm.valido && !vm.enviado && vm.comecou && <Barra vm={vm} />}
    </div>
  );
}

function Fim({ icone, titulo, texto, acao }: { icone: NomeIcone; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="mandei-fim">
      <div className="mandei-fim-ico"><Icone nome={icone} /></div>
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {acao}
    </div>
  );
}

function Entrada({ vm }: { vm: VM }) {
  return (
    <>
      <section className="mandei-hero">
        <span className="mandei-sobre">Mandei · Nilma Contabilidade</span>
        <h1>{vm.empresa}</h1>
        <p>
          Este é o canal seguro do escritório para você responder às nossas perguntas e enviar os comprovantes.
          {' '}{vm.quantos === 1 ? 'É 1 item' : 'São ' + vm.quantos + ' itens'} e leva poucos minutos.
        </p>
        <span className="mandei-prazo"><Icone nome="clock" />Responda até {vm.validoAte}{vm.dias > 0 ? ' · ' + (vm.dias === 1 ? 'falta 1 dia' : 'faltam ' + vm.dias + ' dias') : ''}</span>
      </section>
      <div className="mandei-passos">
        <div className="mandei-passo"><span className="mandei-num">1</span><b>Veja os lançamentos</b><span>Data, nota fiscal e valor de cada um.</span></div>
        <div className="mandei-passo"><span className="mandei-num">2</span><b>Responda</b><span>Escolha uma opção e, se quiser, explique.</span></div>
        <div className="mandei-passo"><span className="mandei-num">3</span><b>Anexe</b><span>O comprovante, o extrato ou a nota.</span></div>
      </div>
      <button type="button" className="mandei-grande" onClick={vm.comecar}>Começar<Icone nome="chevronRight" /></button>
      <p className="mandei-seguro"><Icone nome="lock" />Só quem tem este link vê estas informações.</p>
    </>
  );
}

function Pontos({ vm }: { vm: VM }) {
  return (
    <div className="mandei-pontos" role="tablist" aria-label="Itens">
      {vm.itens.map((it, i) => (
        <button key={it.id} type="button" role="tab" aria-selected={i === vm.passo} aria-label={(i + 1) + '. ' + it.titulo}
          className={i === vm.passo ? 'atual' : it.respondido ? 'feito' : ''} onClick={() => vm.irPara(i)} />
      ))}
    </div>
  );
}

function Passo({ vm }: { vm: VM }) {
  const it = vm.itens[vm.passo];
  if (!it) return null;
  return (
    <>
      <p className="hint" style={{ margin: '8px 0 4px' }}>Item {vm.passo + 1} de {vm.quantos}</p>
      <Pontos vm={vm} />
      <article className="mandei-item">
        <div className="mandei-item-topo">
          <span className="mandei-avatar" aria-hidden="true">{it.iniciais}</span>
          <div style={{ minWidth: 0 }}>
            <h2>{it.titulo}</h2>
            <span className="mandei-de">{resumoDasLinhas(it.linhas) || (it.respondido ? 'Respondido' : 'Aguardando a sua resposta')}</span>
          </div>
          {it.valor && <div className="mandei-saldo"><span>Em aberto</span><b>{it.valor}</b></div>}
        </div>
        <div className="mandei-item-corpo">
          {it.linhas && it.linhas.length > 0 && (
            <div>
              <div className="mandei-rotulo">Lançamentos</div>
              <div className="mandei-lancs">
                {it.linhas.map((l, k) => (
                  // o que é cada lançamento (Vitor, 07/10/2026): a nota em aberto com a data e o número; o pagamento solto
                  // com a data e o banco (a conta por onde passou)
                  <div key={k} className="mandei-lanc">
                    <span className="mandei-data">{l.data}</span>
                    <span className="mandei-desc">
                      <span className={'mandei-tipo ' + (l.tipo || 'saldo')}>{TIPO[l.tipo || 'saldo']}</span>
                      <b>{l.nf && l.nf !== '—' ? 'Nota fiscal ' + l.nf : l.conta ? l.conta : l.descricao}</b>
                      <small>{l.nf && l.nf !== '—' ? l.descricao : l.conta ? l.descricao : ''}</small>
                    </span>
                    <span className="mandei-valor">{l.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {it.detalhe && (
            <div className="mandei-msg">
              <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
              <div className="mandei-msg-balao"><small>Nilma Contabilidade</small>{it.detalhe}</div>
            </div>
          )}
          <div>
            <div className="mandei-rotulo">Sua resposta</div>
            <div className="mandei-opcoes" role="radiogroup" aria-label={'Resposta para ' + it.titulo}>
              {it.opcoes.map(o => (
                <button key={o} type="button" role="radio" aria-checked={it.opcao === o} className={'mandei-opcao' + (it.opcao === o ? ' on' : '')}
                  onClick={() => vm.escolher(it.id, it.opcao === o ? '' : o)}>
                  <span className="mandei-opcao-ico"><Icone nome={iconeDaOpcao(o)} /></span>{o}
                </button>
              ))}
            </div>
          </div>
          <textarea className="mandei-texto" aria-label={'Explicação para ' + it.titulo} placeholder="Quer explicar? Escreva aqui (opcional)"
            value={it.texto} onChange={e => vm.escrever(it.id, e.target.value)} />
          <div>
            <label className="mandei-anexo" htmlFor={'arq-' + it.id}>
              <span className="mandei-opcao-ico"><Icone nome="upload" /></span>
              <span><b>Anexar comprovante</b><span>PDF, foto ou planilha — pode ser mais de um</span></span>
            </label>
            <span style={{ display: 'none' }}>
              <CampoArquivos id={'arq-' + it.id} aceitar=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.ofx,.txt" onEscolher={fs => vm.anexar(it.id, fs)} />
            </span>
            {it.arquivos.length > 0 && (
              <div className="mandei-arquivos">{it.arquivos.map(n => <span key={n} className="mandei-arquivo"><Icone nome="check" />{n}</span>)}</div>
            )}
            {vm.erro && <p className="hint ext-neg" style={{ margin: '8px 0 0' }}>{vm.erro}</p>}
          </div>
        </div>
      </article>
    </>
  );
}

function Revisao({ vm }: { vm: VM }) {
  return (
    <>
      <section className="mandei-hero" style={{ marginTop: 16 }}>
        <span className="mandei-sobre">Revisão</span>
        <h1>Tudo certo para enviar?</h1>
        <p>{vm.respondidos === vm.quantos ? 'Você respondeu todos os itens.' : 'Faltam ' + (vm.quantos - vm.respondidos) + ' de ' + vm.quantos + ' itens: dá para enviar assim mesmo e completar depois pelo mesmo link.'}</p>
      </section>
      <div className="mandei-revisao">
        {vm.itens.map((it, i) => (
          <button key={it.id} type="button" onClick={() => vm.irPara(i)}>
            <span className="mandei-avatar" aria-hidden="true">{it.iniciais}</span>
            <span style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{it.titulo}</b><span className="hint">{it.opcao || it.texto || 'Sem resposta'}{it.arquivos.length ? ' · ' + it.arquivos.length + (it.arquivos.length === 1 ? ' anexo' : ' anexos') : ''}</span></span>
            {it.respondido ? <span className="mandei-ok">Respondido</span> : <span className="mandei-falta">Responder</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function Barra({ vm }: { vm: VM }) {
  const ultimo = vm.passo === vm.quantos - 1;
  return (
    <div className="mandei-barra">
      <div>
        <div className="mandei-progresso">
          <span>{vm.respondidos} de {vm.quantos} respondidos</span>
          <i><b style={{ width: (vm.quantos ? (vm.respondidos / vm.quantos) * 100 : 0) + '%' }} /></i>
        </div>
        {(vm.passo > 0 || vm.revisao) && <button type="button" className="btn" onClick={() => vm.irPara(vm.passo - 1)}>Anterior</button>}
        {vm.revisao
          ? <button type="button" className="btn btn-primary" onClick={vm.enviar}>Enviar resposta</button>
          : <button type="button" className="btn btn-primary" onClick={() => vm.irPara(vm.passo + 1)}>{ultimo ? 'Revisar' : 'Próximo'}</button>}
      </div>
    </div>
  );
}
