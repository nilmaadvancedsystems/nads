// O formulário do cliente (Mandei), no layout do nads e só com as peças do catálogo (Vitor, 07/10/2026: "deixa no
// layout do nosso programa, usando os mesmos componentes"): no alto, o N, a Nilma e o prazo em destaque (o número do
// ticket é só nosso, o cliente não vê); sem a tela de entrada (o link
// já abre no primeiro item, Vitor 07/10/2026);
// só Anterior e Próximo à direita, sem os números dos itens (Vitor, 07/10/2026), e a barra de progresso; cada
// cliente num cartão com o selo do valor, os lançamentos na tabela padrão, a nossa pergunta no balão, as respostas em
// chips, o campo de texto e o Escolher arquivos; a revisão na tabela; o fim e o link vencido no vazio (gh-blank).
// Com os lançamentos, a resposta é por linha (Vitor, 08/10/2026: "ela responde por linha"), na Seleção da coluna Resposta
// (a nativa: no celular abre a lista do aparelho e não corta dentro da tabela),
// e a coluna Operação (Compra, Venda…) no lugar da Descrição e do Tipo; tudo da linha numa linha só (Vitor, 08/10/2026):
// a resposta, o Explique (campo curto) e o comprovante (o ícone com o menu Galeria, Câmera, Arquivo).
import { Icone, MarcaN, MenuSuspenso, type NomeIcone } from '@nads/ui';
import { useRef, useState, type ReactNode } from 'react';
import { useFormulario } from './useFormulario';

type VM = ReturnType<typeof useFormulario>;
type Item = VM['itens'][number];
type Linhas = Item['linhas'];
type Resposta = Item['doItem'];

/** "2 notas em aberto · 1 pagamento sem nota" (embaixo do nome do cliente). */
function resumoDasLinhas(linhas: Linhas): string {
  const n = (t: string) => (linhas || []).filter(l => l.tipo === t).length;
  const notas = n('nota'), pagamentos = n('pagamento'), devolucoes = n('devolucao');
  return [
    notas ? notas + (notas === 1 ? ' nota em aberto' : ' notas em aberto') : '',
    pagamentos ? pagamentos + (pagamentos === 1 ? ' pagamento sem nota' : ' pagamentos sem nota') : '',
    devolucoes ? devolucoes + (devolucoes === 1 ? ' devolução' : ' devoluções') : '',
  ].filter(Boolean).join(' · ');
}

export function Formulario() {
  const vm = useFormulario();
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 64px' }}>
      <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '8px 0 16px', borderBottom: '1px solid var(--border)' }}>
        <span className="brand-mark" aria-hidden="true"><MarcaN /></span><b>Nilma Contabilidade</b>
        <span style={{ flex: 1 }} />
        {vm.existe && vm.valido && !vm.enviado && (
          <span className="badge badge-warn" style={{ fontSize: 13, padding: '4px 10px' }}>
            Responda até {vm.validoAte}{vm.dias > 0 ? ' · ' + (vm.dias === 1 ? 'falta 1 dia' : 'faltam ' + vm.dias + ' dias') : ''}
          </span>
        )}
      </header>
      {!vm.existe ? (
        <Vazio icone="link" titulo="Link não encontrado" texto="Confira o endereço que você recebeu por e-mail." />
      ) : !vm.valido ? (
        <Vazio icone="clock" titulo="Este link venceu" texto="Se ainda precisar responder, fale com o escritório: enviamos um novo link." />
      ) : vm.enviado ? (
        <Vazio icone="checkCircle" titulo="Recebemos a sua resposta" texto={'Obrigado! Até ' + vm.validoAte + ' dá para voltar por este mesmo link e mandar mais arquivos.'}
          acao={<button type="button" className="btn" onClick={vm.voltar}>Voltar às respostas</button>} />
      ) : <Respostas vm={vm} />}
    </div>
  );
}

function Vazio({ icone, titulo, texto, acao }: { icone: NomeIcone; titulo: string; texto: string; acao?: ReactNode }) {
  return <div className="gh-blank" style={{ marginTop: 48 }}><Icone nome={icone} /><h4>{titulo}</h4><p>{texto}</p>{acao}</div>;
}

function Respostas({ vm }: { vm: VM }) {
  const ultimo = vm.passo === vm.quantos - 1;
  return (
    <>
      <header className="topbar"><div>
        <h2 className="page-title">{vm.empresa}</h2>
        <p className="page-desc">
          <span className="tarefas-barra" style={{ marginRight: 8 }}><span style={{ width: (vm.quantos ? (vm.respondidos / vm.quantos) * 100 : 0) + '%' }} /></span>
          {vm.respondidos} de {vm.quantos} respondidos
        </p>
      </div></header>
      {/* só Anterior e Próximo à direita (Vitor, 07/10/2026: sem os números dos itens) */}
      <div className="tarefas-barra-topo">
        <span className="hint">{vm.revisao ? 'Revisão' : 'Item ' + (vm.passo + 1) + ' de ' + vm.quantos}</span>
        <span className="tarefas-barra-espaco" />
        {!vm.revisao && vm.itens[vm.passo]?.falta && <span className="hint">{vm.itens[vm.passo]?.falta}</span>}
        {(vm.passo > 0 || vm.revisao) && <button type="button" className="btn" onClick={() => vm.irPara(vm.passo - 1)}>Anterior</button>}
        {vm.revisao
          ? <button type="button" className="btn btn-primary" onClick={vm.enviar}>Enviar resposta</button>
          : <button type="button" className="btn btn-primary" disabled={!vm.podeAvancar} title={vm.itens[vm.passo]?.falta || undefined}
              onClick={() => vm.irPara(vm.passo + 1)}>{ultimo ? 'Revisar' : 'Próximo'}</button>}
      </div>
      {vm.revisao ? <Revisao vm={vm} /> : <Item vm={vm} />}
    </>
  );
}

function Item({ vm }: { vm: VM }) {
  const it = vm.itens[vm.passo];
  if (!it) return null;
  const resumo = resumoDasLinhas(it.linhas);
  return (
    // o lançamento é o protagonista (Vitor, 07/10/2026: "tá parecendo um cabeçalho"): o cartão de resumo do catálogo,
    // com o nome grande e o valor em aberto em destaque
    <section className="card fgts-resumo">
      <div className="fgts-resumo-topo">
        <div className="fgts-resumo-titulo">
          <h3 style={{ fontSize: 20 }}>{it.titulo}</h3>
          {resumo && <span className="hint">{resumo}</span>}
        </div>
        {it.valor && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="hint">Em aberto</span>
            <b className="num" style={{ fontSize: 20, lineHeight: '28px' }}>{it.valor}</b>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {it.linhas && it.linhas.length > 0 && (
          // sem a rolagem própria no computador (o menu do comprovante abre por cima); no celular, a tabela rola de lado
          <div className="table-wrap mandei-linhas">
            <table className="table-compact">
              <thead><tr><th>Data</th><th>Operação</th><th>Nota fiscal / banco</th><th className="num">Valor</th><th colSpan={3}>Resposta</th></tr></thead>
              <tbody>
                {it.linhas.map(l => (
                  // o que é cada lançamento (Vitor, 07/10/2026): a nota em aberto com a data e o número; o pagamento solto
                  // com a data e o banco (a conta por onde passou); e a resposta da linha (Vitor, 08/10/2026)
                  <tr key={l.chave}>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                    <td>{l.operacao}</td>
                    <td>{l.nf && l.nf !== '—' ? 'NF ' + l.nf : l.conta || '—'}</td>
                    <td className="num">{l.valor}</td>
                    <td>
                      <select className="select-compact" style={{ maxWidth: 200 }} value={l.opcao} onChange={e => vm.escolher(l.chave, e.target.value)}
                        aria-label={'Resposta para ' + (l.nf && l.nf !== '—' ? 'a NF ' + l.nf : 'o lançamento de ' + l.data)}>
                        <option value="" disabled>Responder</option>
                        {it.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    {/* o que a resposta pede, na mesma linha: o Explique (Outro, outra conta) e o comprovante (já foi pago, outra conta) */}
                    <td>
                      {l.explicar && (
                        <Explique texto={l.texto} rotulo={l.nf && l.nf !== '—' ? 'NF ' + l.nf : l.data} onGuardar={t => vm.escrever(l.chave, t)} />
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {(l.comprovar || l.arquivos.length > 0) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {l.comprovar && <AnexarComprovante id={l.chave.replace(/\W/g, '-')} compacto onEscolher={fs => vm.anexar(l.chave, fs)} />}
                          {l.arquivos.length > 0 && <span className="badge badge-ok" title={l.arquivos.join('\n')}>{l.arquivos.length === 1 ? '1 anexo' : l.arquivos.length + ' anexos'}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {it.valor && <tr><td colSpan={3}><b>Saldo em aberto</b></td><td className="num"><b>{it.valor}</b></td><td colSpan={3} /></tr>}
              </tbody>
            </table>
          </div>
        )}
        {it.linhas.length > 0 && vm.erro && <p className="hint ext-neg" style={{ margin: 0 }}>{vm.erro}</p>}
        {it.detalhe && <span className="msg-balao"><Icone nome="mensagem" />{it.detalhe}</span>}
        {!it.linhas.length && <>
        <div className="field" style={{ margin: 0 }}>
          <label>Sua resposta</label>
          <div className="chip-row" style={{ margin: '4px 0 0' }} role="radiogroup" aria-label={'Resposta para ' + it.titulo}>
            {it.opcoes.map(o => (
              <button key={o} type="button" role="radio" aria-checked={it.doItem.opcao === o} className={'chip-f' + (it.doItem.opcao === o ? ' on' : '')}
                onClick={() => vm.escolher(it.id, it.doItem.opcao === o ? '' : o)}>{o}</button>
            ))}
          </div>
        </div>
        <OQueAResposta pede={it.doItem} vm={vm} />
        </>}
      </div>
    </section>
  );
}

/**
 * O que a resposta do item sem linhas pede, embaixo dela: a explicação só no "Outro"; o anexar só em "Já foi
 * pago" e "Foi pago de outra conta" (Vitor, 07/10/2026); e os arquivos já mandados.
 */
function OQueAResposta({ pede, vm }: { pede: Resposta; vm: VM }) {
  if (!pede.explicar && !pede.comprovar && !pede.arquivos.length) return null;
  const id = pede.chave.replace(/\W/g, '-');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pede.explicar && (
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={'tx-' + id}>Explique</label>
          <textarea id={'tx-' + id} rows={3} value={pede.texto} placeholder="Conte o que aconteceu com este valor" onChange={e => vm.escrever(pede.chave, e.target.value)} />
        </div>
      )}
      {(pede.comprovar || pede.arquivos.length > 0) && <div>
        {pede.comprovar && (
          // três jeitos de mandar o comprovante (Vitor, 07/10/2026): galeria, câmera (no celular abre direto) e arquivo, num
          // botão só que abre as opções (Vitor, 08/10/2026)
          <div className="field" style={{ margin: 0 }}>
            <label>Comprovante</label>
            <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
              <AnexarComprovante id={id} onEscolher={fs => vm.anexar(pede.chave, fs)} />
            </div>
          </div>
        )}
        {pede.arquivos.length > 0 && (
          <div className="btn-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>{pede.arquivos.map(n => <span key={n} className="badge badge-ok">{n}</span>)}</div>
        )}
        {vm.erro && <p className="hint ext-neg" style={{ margin: '8px 0 0' }}>{vm.erro}</p>}
      </div>}
    </div>
  );
}

/**
 * O Explique da linha (Vitor, 08/10/2026: "com o ícone do lápis e um botão de confirmar, para o cliente saber que
 * inputou corretamente"): o campo com o lápis e o ✓ que confirma (ou o Enter); só confirmado vale como resposta.
 * Confirmado, o texto no balão com o check da importação (passou o mouse, vira o × e volta a editar).
 */
function Explique({ texto, rotulo, onGuardar }: { texto: string; rotulo: string; onGuardar: (texto: string) => void }) {
  const [rascunho, setRascunho] = useState(texto);
  const [editando, setEditando] = useState(!texto);
  const confirmar = () => { if (!rascunho.trim()) return; onGuardar(rascunho.trim()); setEditando(false); };
  if (!editando && texto) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="msg-balao" title={texto}><Icone nome="mensagem" />{texto}</span>
        <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={() => { setRascunho(texto); onGuardar(''); setEditando(true); }}
          title="Explicação confirmada. Clique para corrigir." aria-label={'Corrigir a explicação de ' + rotulo}>
          <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
        </button>
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label className="busca-curta" style={{ flex: 1, minWidth: 120, width: 'auto' }}>
        <Icone nome="lapis" />
        <input type="text" value={rascunho} placeholder="Explique" aria-label={'Explique: ' + rotulo}
          onChange={e => setRascunho(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmar(); }} />
      </label>
      <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!rascunho.trim()} onClick={confirmar}
        title="Confirmar a explicação" aria-label={'Confirmar a explicação de ' + rotulo}><Icone nome="check" /></button>
    </span>
  );
}

/**
 * O "Anexar comprovante ▾" (Vitor, 08/10/2026: "coloque em um único botão, clicou aparece as opções"): o menu com
 * Galeria, Câmera (no celular abre a câmera direto) e Arquivo; cada opção abre o seletor de arquivo dela. Na linha da
 * tabela, compacto: só o ícone.
 */
function AnexarComprovante({ id, compacto, onEscolher }: { id: string; compacto?: boolean; onEscolher: (fs: File[]) => void }) {
  const galeria = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null), arquivo = useRef<HTMLInputElement>(null);
  const escolheu = (ev: React.ChangeEvent<HTMLInputElement>) => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; if (fs.length) onEscolher(fs); };
  const opcao = (rotulo: string, icone: NomeIcone, input: React.RefObject<HTMLInputElement | null>) => ({ rotulo, icone, onClick: () => input.current?.click() });
  return (
    <>
      {/* na linha da tabela, só o ícone (compacto), sem a setinha (Vitor, 08/10/2026) */}
      <MenuSuspenso rotulo={compacto ? '' : 'Anexar comprovante'} icone="upload" className={compacto ? 'icon-btn icon-btn-sm imp-btn' : 'btn'} semSeta={compacto} largura={200} direita={compacto} dica="Anexar comprovante"
        itens={[opcao('Galeria', 'imagem', galeria), opcao('Câmera', 'camera', camera), opcao('Arquivo', 'arquivo', arquivo)]} />
      <input ref={galeria} type="file" id={'gal-' + id} accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolheu} />
      <input ref={camera} type="file" id={'cam-' + id} accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolheu} />
      <input ref={arquivo} type="file" id={'arq-' + id} accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.ofx,.txt" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolheu} />
    </>
  );
}

function Revisao({ vm }: { vm: VM }) {
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Você respondeu todos os itens. Confira e envie; até {vm.validoAte} dá para voltar pelo mesmo link e mandar mais arquivos.
      </p>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Item</th><th>Resposta</th><th className="num">Anexos</th><th>Situação</th></tr></thead>
          <tbody>
            {vm.itens.map((it, i) => (
              <tr key={it.id} className="linha-abre" tabIndex={0} onClick={() => vm.irPara(i)} onKeyDown={e => { if (e.key === 'Enter') vm.irPara(i); }}>
                <td className="wrap"><b>{i + 1}. {it.titulo}</b></td>
                <td className="wrap">
                  {it.resumo.map(x => (
                    <span key={x.chave} style={{ display: 'block' }}>{x.linha && <span className="hint">{x.linha}: </span>}{x.resposta || <span className="hint">Sem resposta</span>}</span>
                  ))}
                </td>
                <td className="num">{it.anexos || '—'}</td>
                <td><span className={'badge ' + (it.respondido ? 'badge-ok' : 'badge-warn')}>{it.respondido ? 'Respondido' : 'Pendente'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
