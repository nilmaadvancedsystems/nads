// O formulário do cliente (Mandei), no layout do nads e só com as peças do catálogo (Vitor, 07/10/2026: "deixa no
// layout do nosso programa, usando os mesmos componentes"): no alto, o N, a Nilma e o ticket; a entrada num cartão;
// os itens no Segmentado com Anterior e Próximo à direita (como as etapas do Clientes) e a barra de progresso; cada
// cliente num cartão com o selo do valor, os lançamentos na tabela padrão, a nossa pergunta no balão, as respostas em
// chips, o campo de texto e o Escolher arquivos; a revisão na tabela; o fim e o link vencido no vazio (gh-blank).
import { CampoArquivos, Icone, MarcaN, Segmentado, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';
import { useFormulario } from './useFormulario';

type VM = ReturnType<typeof useFormulario>;
type Linhas = VM['itens'][number]['linhas'];

const TIPO = { nota: 'Nota em aberto', pagamento: 'Pagamento sem nota', devolucao: 'Devolução', saldo: 'Saldo do mês' } as const;

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
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 16px', borderBottom: '1px solid var(--border)' }}>
        <span className="brand-mark" aria-hidden="true"><MarcaN /></span><b>Nilma Contabilidade</b>
        <span style={{ flex: 1 }} />
        {vm.numero && <span className="badge badge-neutral">Ticket {vm.numero}</span>}
      </header>
      {!vm.existe ? (
        <Vazio icone="link" titulo="Link não encontrado" texto="Confira o endereço que você recebeu por e-mail." />
      ) : !vm.valido ? (
        <Vazio icone="clock" titulo="Este link venceu" texto="Se ainda precisar responder, fale com o escritório: enviamos um novo link." />
      ) : vm.enviado ? (
        <Vazio icone="checkCircle" titulo="Recebemos a sua resposta" texto={'Obrigado! Até ' + vm.validoAte + ' dá para voltar por este mesmo link e mandar mais arquivos.'}
          acao={<button type="button" className="btn" onClick={vm.voltar}>Voltar às respostas</button>} />
      ) : !vm.comecou ? <Entrada vm={vm} /> : <Respostas vm={vm} />}
    </div>
  );
}

function Vazio({ icone, titulo, texto, acao }: { icone: NomeIcone; titulo: string; texto: string; acao?: ReactNode }) {
  return <div className="gh-blank" style={{ marginTop: 48 }}><Icone nome={icone} /><h4>{titulo}</h4><p>{texto}</p>{acao}</div>;
}

function Entrada({ vm }: { vm: VM }) {
  return (
    <>
      <header className="topbar"><div>
        <h2 className="page-title">{vm.empresa}</h2>
        <p className="page-desc">Pedido da Nilma Contabilidade · responda até {vm.validoAte}{vm.dias > 0 ? ' (' + (vm.dias === 1 ? 'falta 1 dia' : 'faltam ' + vm.dias + ' dias') + ')' : ''}</p>
      </div></header>
      <div className="card">
        <h3>Como responder</h3>
        <div style={{ padding: '0 16px 16px' }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Este é o canal seguro do escritório para você responder às nossas perguntas e enviar os comprovantes.
            {' '}{vm.quantos === 1 ? 'É 1 item' : 'São ' + vm.quantos + ' itens'} e leva poucos minutos.
          </p>
          <ol style={{ margin: '0 0 16px', paddingLeft: 20, lineHeight: 1.7 }}>
            <li><b>Veja os lançamentos:</b> a data, a nota fiscal (ou o banco) e o valor de cada um.</li>
            <li><b>Responda:</b> escolha a opção que explica e, se quiser, escreva.</li>
            <li><b>Anexe:</b> o comprovante, o extrato ou a nota.</li>
          </ol>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={vm.comecar}>Começar</button>
            <span className="hint">Só quem tem este link vê estas informações.</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Respostas({ vm }: { vm: VM }) {
  const ultimo = vm.passo === vm.quantos - 1;
  return (
    <>
      <header className="topbar"><div>
        <h2 className="page-title">{vm.empresa}</h2>
        <p className="page-desc">
          <span className="tarefas-barra" style={{ marginRight: 8 }}><span style={{ width: (vm.quantos ? (vm.respondidos / vm.quantos) * 100 : 0) + '%' }} /></span>
          {vm.respondidos} de {vm.quantos} respondidos · responda até {vm.validoAte}
        </p>
      </div></header>
      {/* os itens no Segmentado, com Anterior e Próximo à direita (como as etapas do Clientes) */}
      <div className="tarefas-barra-topo">
        <Segmentado<string> valor={String(vm.revisao ? vm.quantos : vm.passo)} onMudar={v => vm.irPara(Number(v))}
          opcoes={[...vm.itens.map((it, i) => ({ valor: String(i), rotulo: (i + 1) + (it.respondido ? ' ✓' : '') })), { valor: String(vm.quantos), rotulo: 'Revisão' }]} />
        <span className="tarefas-barra-espaco" />
        {(vm.passo > 0 || vm.revisao) && <button type="button" className="btn" onClick={() => vm.irPara(vm.passo - 1)}>Anterior</button>}
        {vm.revisao
          ? <button type="button" className="btn btn-primary" onClick={vm.enviar}>Enviar resposta</button>
          : <button type="button" className="btn btn-primary" onClick={() => vm.irPara(vm.passo + 1)}>{ultimo ? 'Revisar' : 'Próximo'}</button>}
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
    <div className="card">
      <div className="card-head">
        <h3>{it.titulo}{resumo && <span className="hint" style={{ marginLeft: 8, fontWeight: 400 }}>{resumo}</span>}</h3>
        {it.valor && <span className="card-head-ctl">Em aberto <span className="badge badge-bad">{it.valor}</span></span>}
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {it.linhas && it.linhas.length > 0 && (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Data</th><th>Tipo</th><th>Nota fiscal / banco</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {it.linhas.map((l, k) => (
                  // o que é cada lançamento (Vitor, 07/10/2026): a nota em aberto com a data e o número; o pagamento solto
                  // com a data e o banco (a conta por onde passou)
                  <tr key={k}>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                    <td><span className={'badge ' + (l.tipo === 'nota' ? 'badge-warn' : 'badge-neutral')}>{TIPO[l.tipo || 'saldo']}</span></td>
                    <td>{l.nf && l.nf !== '—' ? 'NF ' + l.nf : l.conta || '—'}</td>
                    <td className="wrap">{l.descricao}</td>
                    <td className="num">{l.valor}</td>
                  </tr>
                ))}
                {it.valor && <tr><td colSpan={4}><b>Saldo em aberto</b></td><td className="num"><b>{it.valor}</b></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {it.detalhe && <span className="msg-balao"><Icone nome="mensagem" />{it.detalhe}</span>}
        <div className="field" style={{ margin: 0 }}>
          <label>Sua resposta</label>
          <div className="chip-row" style={{ margin: '4px 0 0' }} role="radiogroup" aria-label={'Resposta para ' + it.titulo}>
            {it.opcoes.map(o => (
              <button key={o} type="button" role="radio" aria-checked={it.opcao === o} className={'chip-f' + (it.opcao === o ? ' on' : '')}
                onClick={() => vm.escolher(it.id, it.opcao === o ? '' : o)}>{o}</button>
            ))}
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={'tx-' + it.id}>Explique, se quiser</label>
          <textarea id={'tx-' + it.id} rows={3} value={it.texto} onChange={e => vm.escrever(it.id, e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <CampoArquivos id={'arq-' + it.id} aceitar=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.ofx,.txt" rotulo="Anexar comprovantes (PDF, foto ou planilha)" onEscolher={fs => vm.anexar(it.id, fs)} />
          {it.arquivos.length > 0 && (
            <div className="btn-row" style={{ marginTop: 8 }}>{it.arquivos.map(n => <span key={n} className="badge badge-ok">{n}</span>)}</div>
          )}
          {vm.erro && <p className="hint ext-neg" style={{ margin: '8px 0 0' }}>{vm.erro}</p>}
        </div>
      </div>
    </div>
  );
}

function Revisao({ vm }: { vm: VM }) {
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        {vm.respondidos === vm.quantos ? 'Você respondeu todos os itens.' : 'Faltam ' + (vm.quantos - vm.respondidos) + ' de ' + vm.quantos + ' itens: dá para enviar assim mesmo e completar depois pelo mesmo link.'}
      </p>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Item</th><th>Resposta</th><th className="num">Anexos</th><th>Situação</th></tr></thead>
          <tbody>
            {vm.itens.map((it, i) => (
              <tr key={it.id} className="linha-abre" tabIndex={0} onClick={() => vm.irPara(i)} onKeyDown={e => { if (e.key === 'Enter') vm.irPara(i); }}>
                <td className="wrap"><b>{i + 1}. {it.titulo}</b></td>
                <td className="wrap">{it.opcao || it.texto || <span className="hint">Sem resposta</span>}</td>
                <td className="num">{it.arquivos.length || '—'}</td>
                <td><span className={'badge ' + (it.respondido ? 'badge-ok' : 'badge-warn')}>{it.respondido ? 'Respondido' : 'Pendente'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
