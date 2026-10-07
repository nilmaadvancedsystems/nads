// O formulário do cliente (Mandei) em formato de jornal (Vitor, 07/10/2026: "preto e branco, fácil de interpretar";
// as classes .mandei-* no nads.css): o cabeçalho do jornal (Mandei, a Nilma, o ticket e o prazo); a entrada com a
// manchete, o lide e o passo a passo em três colunas; um cliente por vez (a seção, a manchete com o nome, os
// lançamentos numa tabela com fio e a linha do saldo, a pergunta do escritório num quadro, as respostas em
// quadradinhos, o texto e o anexar); o índice para revisar; a barra de baixo. Link vencido ou inválido: o aviso.
import { CampoArquivos, Icone, MarcaN, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';
import { useFormulario } from './useFormulario';

type VM = ReturnType<typeof useFormulario>;
type Linhas = VM['itens'][number]['linhas'];

const TIPO = { nota: 'Nota em aberto', pagamento: 'Pagamento sem nota', devolucao: 'Devolução', saldo: 'Saldo do mês' } as const;

/** "2 notas em aberto · 1 pagamento sem nota" (o subtítulo do cliente). */
function resumoDasLinhas(linhas: Linhas): string {
  const n = (t: string) => (linhas || []).filter(l => l.tipo === t).length;
  const notas = n('nota'), pagamentos = n('pagamento'), devolucoes = n('devolucao');
  return [
    notas ? notas + (notas === 1 ? ' nota em aberto' : ' notas em aberto') : '',
    pagamentos ? pagamentos + (pagamentos === 1 ? ' pagamento sem nota' : ' pagamentos sem nota') : '',
    devolucoes ? devolucoes + (devolucoes === 1 ? ' devolução' : ' devoluções') : '',
  ].filter(Boolean).join(' · ');
}

const hoje = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

export function Formulario() {
  const vm = useFormulario();
  return (
    <div className="mandei">
      <header className="mandei-topo">
        <p className="mandei-nome">Mandei</p>
        <div className="mandei-linha">
          <span><span className="brand-mark" aria-hidden="true"><MarcaN /></span>Nilma Contabilidade</span>
          <span>{vm.numero ? 'Ticket ' + vm.numero : 'Edição de ' + hoje()}</span>
          {vm.validoAte && <span>Responda até {vm.validoAte}</span>}
        </div>
      </header>
      <main className="mandei-corpo">
        {!vm.existe ? (
          <Fim icone="link" titulo="Link não encontrado" texto="Confira o endereço que você recebeu por e-mail." />
        ) : !vm.valido ? (
          <Fim icone="clock" titulo="Este link venceu" texto="Se ainda precisar responder, fale com o escritório: enviamos um novo link." />
        ) : vm.enviado ? (
          <Fim icone="checkCircle" titulo="Recebemos a sua resposta" texto={'Obrigado! Até ' + vm.validoAte + ' dá para voltar por este mesmo link e mandar mais arquivos.'}
            acao={<button type="button" className="mandei-grande" onClick={vm.voltar}>Voltar às respostas</button>} />
        ) : !vm.comecou ? <Entrada vm={vm} /> : vm.revisao ? <Revisao vm={vm} /> : <Passo vm={vm} />}
      </main>
      {vm.existe && vm.valido && !vm.enviado && vm.comecou && <Barra vm={vm} />}
    </div>
  );
}

function Fim({ icone, titulo, texto, acao }: { icone: NomeIcone; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="mandei-fim">
      <Icone nome={icone} />
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {acao}
    </div>
  );
}

function Entrada({ vm }: { vm: VM }) {
  return (
    <>
      <span className="mandei-chapeu">Pedido do escritório</span>
      <h1 className="mandei-manchete">{vm.empresa}</h1>
      <p className="mandei-lide">
        A Nilma Contabilidade precisa da sua ajuda para fechar a conferência. Este é o canal seguro do escritório para você
        responder às nossas perguntas e enviar os comprovantes. {vm.quantos === 1 ? 'É 1 item' : 'São ' + vm.quantos + ' itens'} e leva poucos minutos.
      </p>
      <span className="mandei-prazo">Prazo: {vm.validoAte}{vm.dias > 0 ? ' — ' + (vm.dias === 1 ? 'falta 1 dia' : 'faltam ' + vm.dias + ' dias') : ''}</span>
      <div className="mandei-colunas" style={{ marginTop: 20 }}>
        <div className="mandei-coluna"><span className="mandei-num">1</span><b>Veja os lançamentos</b><span>A data, a nota fiscal (ou o banco) e o valor de cada um.</span></div>
        <div className="mandei-coluna"><span className="mandei-num">2</span><b>Responda</b><span>Marque a opção que explica e, se quiser, escreva.</span></div>
        <div className="mandei-coluna"><span className="mandei-num">3</span><b>Anexe</b><span>O comprovante, o extrato ou a nota.</span></div>
      </div>
      <button type="button" className="mandei-grande" onClick={vm.comecar}>Começar<Icone nome="chevronRight" /></button>
      <p className="mandei-seguro"><Icone nome="lock" />Só quem tem este link vê estas informações.</p>
    </>
  );
}

function Passo({ vm }: { vm: VM }) {
  const it = vm.itens[vm.passo];
  if (!it) return null;
  const resumo = resumoDasLinhas(it.linhas);
  return (
    <>
      <div className="mandei-secao">
        <span>Item {vm.passo + 1} de {vm.quantos}</span>
        <span className="mandei-pontos" role="tablist" aria-label="Itens">
          {vm.itens.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={i === vm.passo} aria-label={(i + 1) + '. ' + x.titulo + (x.respondido ? ' (respondido)' : '')}
              className={i === vm.passo ? 'atual' : x.respondido ? 'feito' : ''} onClick={() => vm.irPara(i)}>{i + 1}</button>
          ))}
        </span>
      </div>
      <h1 className="mandei-manchete">{it.titulo}</h1>
      {resumo && <p className="mandei-subtitulo">{resumo}</p>}

      {it.linhas && it.linhas.length > 0 && (
        <>
          <div className="mandei-rotulo">O que consta no nosso sistema</div>
          <table className="mandei-tabela">
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>Nota fiscal / banco</th><th className="mandei-sem-celular">Descrição</th><th className="num">Valor</th></tr>
            </thead>
            <tbody>
              {it.linhas.map((l, k) => (
                // o que é cada lançamento (Vitor, 07/10/2026): a nota em aberto com a data e o número; o pagamento solto
                // com a data e o banco (a conta por onde passou)
                <tr key={k}>
                  <td className="mandei-quando">{l.data}</td>
                  <td><span className="mandei-tipo">{TIPO[l.tipo || 'saldo']}</span></td>
                  <td>{l.nf && l.nf !== '—' ? 'NF ' + l.nf : l.conta || '—'}<small className="mandei-celular-desc">{l.descricao}</small></td>
                  <td className="mandei-sem-celular">{l.descricao}</td>
                  <td className="num">{l.valor}</td>
                </tr>
              ))}
            </tbody>
            {it.valor && (
              <tfoot><tr><td colSpan={3}>Saldo em aberto</td><td className="mandei-sem-celular" /><td className="num">{it.valor}</td></tr></tfoot>
            )}
          </table>
        </>
      )}

      {it.detalhe && (
        <div className="mandei-pergunta">
          <span>Pergunta do escritório</span>
          <p>“{it.detalhe}”</p>
        </div>
      )}

      <div className="mandei-rotulo">Sua resposta</div>
      <div className="mandei-opcoes" role="radiogroup" aria-label={'Resposta para ' + it.titulo}>
        {it.opcoes.map(o => (
          <button key={o} type="button" role="radio" aria-checked={it.opcao === o} className={'mandei-opcao' + (it.opcao === o ? ' on' : '')}
            onClick={() => vm.escolher(it.id, it.opcao === o ? '' : o)}>{o}</button>
        ))}
      </div>
      <textarea className="mandei-texto" aria-label={'Explicação para ' + it.titulo} placeholder="Quer explicar? Escreva aqui (opcional)"
        value={it.texto} onChange={e => vm.escrever(it.id, e.target.value)} />
      <label className="mandei-anexo" htmlFor={'arq-' + it.id}>
        <Icone nome="upload" />
        <span><b>Anexar comprovante</b><span>PDF, foto ou planilha — pode ser mais de um</span></span>
      </label>
      <span style={{ display: 'none' }}>
        <CampoArquivos id={'arq-' + it.id} aceitar=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.ofx,.txt" onEscolher={fs => vm.anexar(it.id, fs)} />
      </span>
      {it.arquivos.length > 0 && (
        <div className="mandei-arquivos">{it.arquivos.map(n => <span key={n} className="mandei-arquivo"><Icone nome="check" />{n}</span>)}</div>
      )}
      {vm.erro && <p style={{ margin: '8px 0 0', fontStyle: 'italic' }}>{vm.erro}</p>}
    </>
  );
}

function Revisao({ vm }: { vm: VM }) {
  return (
    <>
      <span className="mandei-chapeu">Revisão</span>
      <h1 className="mandei-manchete">Tudo certo para enviar?</h1>
      <p className="mandei-lide">
        {vm.respondidos === vm.quantos ? 'Você respondeu todos os itens.' : 'Faltam ' + (vm.quantos - vm.respondidos) + ' de ' + vm.quantos + ' itens: dá para enviar assim mesmo e completar depois pelo mesmo link.'}
      </p>
      <div className="mandei-indice">
        {vm.itens.map((it, i) => (
          <button key={it.id} type="button" onClick={() => vm.irPara(i)}>
            <span style={{ minWidth: 0 }}>
              {i + 1}. {it.titulo}
              <small>{it.opcao || it.texto || 'Sem resposta'}{it.arquivos.length ? ' · ' + it.arquivos.length + (it.arquivos.length === 1 ? ' anexo' : ' anexos') : ''}</small>
            </span>
            <span className="mandei-pontilhado" aria-hidden="true" />
            <span className="mandei-status">{it.respondido ? 'Respondido' : 'Responder'}</span>
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
          {vm.respondidos} de {vm.quantos} respondidos
          <i><b style={{ width: (vm.quantos ? (vm.respondidos / vm.quantos) * 100 : 0) + '%' }} /></i>
        </div>
        {(vm.passo > 0 || vm.revisao) && <button type="button" className="mandei-botao" onClick={() => vm.irPara(vm.passo - 1)}>Anterior</button>}
        {vm.revisao
          ? <button type="button" className="mandei-botao principal" onClick={vm.enviar}>Enviar resposta</button>
          : <button type="button" className="mandei-botao principal" onClick={() => vm.irPara(vm.passo + 1)}>{ultimo ? 'Revisar' : 'Próximo'}</button>}
      </div>
    </div>
  );
}
