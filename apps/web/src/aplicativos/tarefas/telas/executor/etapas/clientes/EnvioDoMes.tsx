// O Envio do mês (11/11/2026), o mesmo em Clientes e em Fornecedores: as contas dos dois lados que vão ser questionadas,
// o que já foi mandado e o Mandar pelo Mandei (um ticket só). Só desenha: o estado e o Mandar vêm do useEnvioDoMes.
import { Icone } from '@nads/ui';
import type { EnvioDoMesVM } from './useEnvioDoMes';

/** O botão da barra de cima: Mandar pelo Mandei (ou Mandado, quando não falta nada). */
export function BotaoDoEnvio({ envio }: { envio: EnvioDoMesVM }) {
  if (!envio.questoes.length) return null;
  const para = [envio.contato.email, envio.contato.whatsapp && 'o WhatsApp ' + envio.contato.whatsapp].filter(Boolean).join(' e ');
  return (
    <button type="button" className="btn btn-primary" disabled={envio.faltaNoCadastro.length > 0 || envio.jaMandado || envio.mandando} onClick={() => void envio.mandar()}
      title={envio.faltaNoCadastro.length ? 'Falta no Cadastro da empresa: ' + envio.faltaNoCadastro.join(' e ') : 'Mandar para ' + para}>
      <Icone nome={envio.jaMandado ? 'check' : 'caixaEntrada'} />{envio.jaMandado ? 'Mandado pelo Mandei' : 'Mandar pelo Mandei'}
    </button>
  );
}

export function EnvioDoMes({ envio }: { envio: EnvioDoMesVM }) {
  if (!envio.questoes.length) return <p className="hint">Nada para questionar: em Clientes e em Fornecedores, marque no + as linhas que vão para o cliente.</p>;
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Clientes e Fornecedores vão juntos, num ticket só. {envio.faltaMandar > 0 && envio.questoes.some(q => q.jaFoi) ? 'O que já foi mandado não vai de novo.' : ''}
      </p>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Lado</th><th>Conta</th><th>Nome</th><th className="num">Saldo</th><th>Notas em aberto</th><th>No Mandei</th><th>Situação</th></tr></thead>
          <tbody>
            {envio.questoes.map(q => (
              <tr key={q.id}>
                <td>{q.lado}</td><td>{q.codigo}</td><td className="wrap">{q.nome}</td><td className="num">{q.valor}</td>
                <td className="wrap">{q.notas || '—'}</td><td className="wrap">{q.perguntar || '—'}</td>
                <td><span className={'badge ' + (q.jaFoi ? 'badge-ok' : 'badge-warn')}>{q.jaFoi ? 'Mandado' : 'Falta mandar'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* sem o e-mail ou o WhatsApp no Cadastro, o Mandar fica travado */}
      {envio.faltaNoCadastro.length > 0
        ? <p className="hint" style={{ marginTop: 12 }}>Para mandar pelo Mandei, cadastre {envio.faltaNoCadastro.join(' e ')} da empresa em Cadastro › Empresa.</p>
        : <p className="hint" style={{ marginTop: 12 }}>O Mandei manda para {[envio.contato.email, envio.contato.whatsapp && 'o WhatsApp ' + envio.contato.whatsapp].filter(Boolean).join(' e ')}. A resposta chega em Área do Cliente › Meus tickets.</p>}
    </>
  );
}
