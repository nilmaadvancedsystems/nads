// O formulário do cliente (Mandei): o logo, o número do ticket e a mensagem; cada item num cartão com a nossa pergunta
// (o balão), a escolha, o texto e o anexar; embaixo, o Enviar. Link vencido ou inválido: o aviso, sem formulário.
import { CampoArquivos, Icone, MarcaN } from '@nads/ui';
import { useFormulario } from './useFormulario';

export function Formulario() {
  const vm = useFormulario();
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className="brand-mark" aria-hidden="true"><MarcaN /></span><b>Nilma Contabilidade</b>
        {vm.numero && <span className="badge badge-neutral">Ticket {vm.numero}</span>}
      </header>
      {!vm.existe ? (
        <div className="gh-blank"><Icone nome="link" /><h4>Link não encontrado</h4><p>Confira o endereço que recebeu por e-mail.</p></div>
      ) : !vm.valido ? (
        <div className="gh-blank"><Icone nome="clock" /><h4>Este link venceu</h4><p>Se ainda precisar responder, fale com o escritório: enviaremos um novo link.</p></div>
      ) : !vm.comecou ? (
        // a entrada: onde o cliente está e para que serve, com um botão só
        <div className="gh-blank" style={{ maxWidth: 520, margin: '48px auto' }}>
          <Icone nome="caixaEntrada" />
          <h4>Olá! Aqui é a Nilma Contabilidade</h4>
          <p>
            Este é o <b>Mandei</b>, o canal seguro do escritório para você responder às nossas perguntas sobre a
            <b> {vm.empresa}</b> e enviar os comprovantes. {vm.quantos === 1 ? 'É 1 item' : 'São ' + vm.quantos + ' itens'} e
            leva poucos minutos; o link vale até {vm.validoAte}.
          </p>
          <button type="button" className="btn btn-primary" onClick={vm.comecar}>Começar</button>
        </div>
      ) : vm.enviado ? (
        <div className="gh-blank">
          <Icone nome="checkCircle" /><h4>Recebemos a sua resposta</h4>
          <p>Obrigado! Até {vm.validoAte}, dá para voltar por este mesmo link e mandar mais arquivos.</p>
          <button type="button" className="btn" onClick={vm.voltar}>Voltar ao formulário</button>
        </div>
      ) : (
        <>
          <h2 className="page-title" style={{ marginBottom: 4 }}>{vm.empresa}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{vm.mensagem} Responda até {vm.validoAte}.</p>
          {vm.itens.map(it => (
            <div key={it.id} className="card" style={{ marginTop: 12 }}>
              <div className="card-head"><h3>{it.titulo}</h3></div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* os lançamentos (Vitor, 07/10/2026): Data, nota fiscal, descrição, valor */}
                {it.linhas && it.linhas.length > 0 ? (
                  <div className="table-wrap">
                    <table className="table-compact">
                      <thead><tr><th>Data</th><th>Nota fiscal</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
                      <tbody>{it.linhas.map((l, k) => <tr key={k}><td style={{ whiteSpace: 'nowrap' }}>{l.data}</td><td>{l.nf}</td><td className="wrap">{l.descricao}</td><td className="num">{l.valor}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : it.valor && <p className="hint" style={{ margin: 0 }}>Saldo em aberto: {it.valor}</p>}
                {it.detalhe && <span className="msg-balao"><Icone nome="mensagem" />{it.detalhe}</span>}
                <div className="field">
                  <label htmlFor={'op-' + it.id}>Resposta</label>
                  <select id={'op-' + it.id} value={it.opcao} onChange={e => vm.escolher(it.id, e.target.value)}>
                    <option value="">Escolha…</option>
                    {it.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={'tx-' + it.id}>Explique, se quiser</label>
                  <textarea id={'tx-' + it.id} rows={2} value={it.texto} onChange={e => vm.escrever(it.id, e.target.value)} style={{ width: '100%' }} />
                </div>
                <CampoArquivos id={'arq-' + it.id} aceitar=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.ofx,.txt" rotulo="Anexar comprovantes" onEscolher={fs => vm.anexar(it.id, fs)} />
                {it.arquivos.length > 0 && <p className="hint" style={{ margin: 0 }}><Icone nome="check" /> {it.arquivos.join(' · ')}</p>}
              </div>
            </div>
          ))}
          {vm.erro && <p className="hint ext-neg">{vm.erro}</p>}
          <div className="btn-row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={vm.enviar}>Enviar resposta</button>
          </div>
        </>
      )}
    </div>
  );
}
