// A aba Comprovantes da Importação (Vitor, 26/10/2026), no desenho da aba Bancos: um bloco com a grade dos meses do período —
// a linha E-mail (o Buscar no e-mail de cada mês) e a linha Drive (quantos comprovantes já estão na pasta COMPROVANTES do mês;
// clicou, abre a lista embaixo) — e a lista do mês aberto, cada comprovante com o olhinho para ver o PDF do Drive.
import { Icone, LogoDrive, LogoGmail } from '@nads/ui';
import { JanelaBuscarNoEmail } from './JanelaBuscarNoEmail';
import { useComprovantes } from './useComprovantes';

const dataBR = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const tamanho = (b?: number) => (b == null ? '—' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

export function ComprovantesNaImportacao({ meses, pedirLogin, avisarErro }: { meses: readonly string[]; pedirLogin: (depois: () => void) => void; avisarErro: (titulo: string, texto: string) => void }) {
  const vm = useComprovantes(meses, pedirLogin);
  /** abre a janela já (senão o navegador bloqueia) e põe o link temporário quando o robô responder */
  function ver(a: { id: string; nome: string }) {
    const janela = window.open('', '_blank');
    janela?.document.write('<p style="font:14px sans-serif;padding:24px;color:#555">Buscando ' + a.nome.replace(/</g, '') + ' no Drive…</p>');
    vm.link(a).then(url => { if (janela) janela.location.href = url; else window.open(url, '_blank'); },
      e => { janela?.close(); avisarErro('Não consegui abrir do Drive', e instanceof Error ? e.message : String(e)); });
  }
  return (
    <div className="imp-lista" data-destaque="comprovantes">
      <div className="imp-bloco">
        <div className="imp-linha">
          <span className="imp-ico imp-logo"><Icone nome="recibo" /></span>
          <div className="imp-txt"><span><b>Comprovantes</b><span className="imp-conta">CONTÁBIL › EXTRATOS › ano › mês › COMPROVANTES</span></span></div>
          <div className="imp-resumo"><div><span>{vm.lendo ? 'Lendo o Drive…' : vm.total + (vm.total === 1 ? ' comprovante' : ' comprovantes') + ' no período'}</span></div></div>
          <div className="imp-grupos">
            <div className="imp-grupo">
              <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={vm.lendo} onClick={vm.atualizar} title="Ler a pasta do Drive de novo" aria-label="Atualizar do Drive">
                <Icone nome="girar" />
              </button>
            </div>
          </div>
        </div>
        {vm.erro && <p className="hint ext-neg" style={{ padding: '0 16px' }}>{vm.erro}</p>}
        <div className="imp-periodo-linha">
          <table className="imp-meses">
            <thead><tr><th scope="col"><span className="sr-only">Origem</span></th>{vm.meses.map(m => <th key={m.mes} scope="col" className={m.mes === vm.mesAberto ? 'ativo' : undefined}>{m.rotulo}</th>)}</tr></thead>
            <tbody>
              <tr>
                <th scope="row" style={{ textAlign: 'left' }}>E-mail</th>
                {vm.meses.map(m => (
                  <td key={m.mes}>
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.buscaExiste} onClick={() => vm.buscarNoEmail(m.mes)}
                      title={vm.buscaExiste ? 'Buscar os comprovantes de ' + m.rotulo + ' no e-mail' : 'A busca no e-mail só funciona com o login do Entregas'} aria-label={'Buscar os comprovantes de ' + m.rotulo + ' no e-mail'}>
                      <LogoGmail />
                    </button>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" style={{ textAlign: 'left' }}>Drive</th>
                {vm.meses.map(m => (
                  <td key={m.mes}>
                    {m.qtd > 0 ? (
                      <button type="button" className={'btn btn-outline' + (m.mes === vm.mesAberto ? ' on' : '')} style={{ height: 28, padding: '0 8px' }} onClick={() => vm.abrirMes(m.mes)}
                        title={'Ver os comprovantes de ' + m.rotulo} aria-pressed={m.mes === vm.mesAberto}>
                        <LogoDrive />{m.qtd}
                      </button>
                    ) : m.mandando ? null : <span className="hint">—</span>}
                    {m.mandando > 0 && <span className="hint" style={{ display: 'block' }} title="O robô do arquivamento está pondo na pasta COMPROVANTES (até uns 2 minutos)"><span className="btn-spinner" /> mandando {m.mandando}</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {vm.mesAberto && (
          <div style={{ padding: '0 16px 16px' }}>
            <h4 style={{ margin: '0 0 8px' }}>Comprovantes de {vm.mesAberto.slice(5) + '/' + vm.mesAberto.slice(0, 4)}</h4>
            {vm.doMes.length ? (
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>Arquivo</th><th>No Drive desde</th><th className="num">Tamanho</th><th><span className="sr-only">Ver</span></th></tr></thead>
                  <tbody>
                    {vm.doMes.map(a => (
                      <tr key={a.id}>
                        <td className="wrap">{a.nome}</td><td>{dataBR(a.em)}</td><td className="num">{tamanho(a.tamanho)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={() => ver(a)} title={'Ver ' + a.nome} aria-label={'Ver ' + a.nome}><Icone nome="olho" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="hint" style={{ margin: 0 }}>Nenhum comprovante na pasta deste mês ainda.</p>}
          </div>
        )}
        {!vm.entrou && <p className="hint" style={{ padding: '0 16px 16px', margin: 0 }}>Para ler a pasta do Drive e buscar no e-mail, entre com o login do Entregas (o botão de atualizar pede).</p>}
      </div>
      <JanelaBuscarNoEmail vm={vm.em} />
    </div>
  );
}
