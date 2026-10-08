// O tópico "XMLs do cliente" da janela de importar (08/10/2026): a área de soltar (a dos certificados), o que foi lido e,
// depois de mandar, o andamento do robô com as peças da janela do SIEG (a barra, os números e os passos).
import { BotaoAcao, Icone } from '@nads/ui';
import { useRef, useState } from 'react';
import { useXmlsDoCliente } from '../useXmlsDoCliente';

export function XmlsDoCliente({ codigo, competencia }: { codigo: string; competencia: string }) {
  const vm = useXmlsDoCliente(codigo, competencia);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const soltar = (fs: FileList | null | undefined) => { if (fs?.length) void vm.soltar([...fs]); };
  const a = vm.andamento;
  return (
    <div className="xmls-cliente">
      <p className="hint" style={{ margin: 0 }}>Os XMLs que o cliente mandou (soltos ou num .zip): o robô fica com os desta empresa, lança as notas no nads (as tabelas de verificação e a sequência das saídas) e salva no Drive só os que ainda não estão lá.</p>
      <input ref={input} type="file" accept=".xml,.zip" multiple hidden onChange={e => { soltar(e.target.files); e.target.value = ''; }} />
      <button type="button" className={'cert-soltar' + (sobre ? ' sobre' : '') + (vm.lidos ? ' compacto' : '')} onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); soltar(e.dataTransfer.files); }}>
        <span className="cert-soltar-icone"><Icone nome="upload" /></span>
        <b>{vm.lendo ? 'Lendo os arquivos…' : vm.lidos ? 'Soltar mais arquivos' : 'Solte aqui os XMLs do cliente'}</b>
        <span className="fraco">.xml ou .zip, um ou vários</span>
      </button>
      {vm.lidos && !a && (
        <div className="xmls-cliente-lidos">
          <span><b className="num">{vm.lidos.xmls.length}</b> XMLs de nota em {vm.lidos.arquivos} {vm.lidos.arquivos === 1 ? 'arquivo' : 'arquivos'}{vm.lidos.ignorados ? ' · ' + (vm.lidos.ignorados === 1 ? '1 outro arquivo ficou de fora' : vm.lidos.ignorados + ' outros arquivos ficaram de fora') : ''}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-ghost" onClick={vm.limpar}>Limpar</button>
          <BotaoAcao className="btn btn-primary" carregando={vm.enviando} textoCarregando="Mandando…" disabled={!vm.lidos.xmls.length} onClick={() => { void vm.enviar(); }}><Icone nome="upload" />Mandar ao nads e ao Drive</BotaoAcao>
        </div>
      )}
      {a && (
        <div className="card sieg-andamento" role="status" aria-live="polite">
          <div className="fgts-resumo-topo">
            <div className="fgts-resumo-titulo">
              <h3>{a.erro ? 'Os XMLs não entraram' : a.pronto ? 'XMLs do cliente lançados' : 'Lançando os XMLs do cliente'}</h3>
              {!a.erro && <span className="hint">{a.pronto ? 'Concluído' : a.detalhe || 'O robô está trabalhando'}</span>}
            </div>
            {!a.erro && <b className="sieg-andamento-pct num">{a.pct}%</b>}
          </div>
          {a.erro ? <p className="sieg-aviso"><Icone nome="alert" />{a.erro}</p> : <span className={'tarefas-barra fgts-barra' + (a.pronto ? '' : ' andando')}><span style={{ width: a.pct + '%' }} /></span>}
          {a.numeros && (
            <div className="stat-grid sieg-andamento-numeros">
              <div className="stat painel-numero painel-info"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="arquivo" /></span><p className="stat-label">Do cliente</p><p className="stat-value num">{a.numeros.doCliente}</p></div>
              <div className="stat painel-numero painel-aviso"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="alert" /></span><p className="stat-label">De outra empresa</p><p className="stat-value num">{a.numeros.deOutros}</p></div>
              <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="check" /></span><p className="stat-label">Novos no Drive</p><p className="stat-value num">{a.numeros.novos}</p></div>
            </div>
          )}
          {!a.erro && (
            <ol className="fgts-passos sieg-andamento-passos">
              {a.passos.map((p, i) => (
                <li key={p.texto} className={p.feito ? 'feito' : p.atual ? 'atual' : undefined}>
                  <span className="fgts-passo-marca" aria-hidden="true">{p.feito ? <Icone nome="check" /> : i + 1}</span>
                  <div>{p.atual ? <b>{p.texto}</b> : p.texto}</div>
                </li>
              ))}
            </ol>
          )}
          {a.resultado && <p className="hint" style={{ margin: 0 }}>{a.resultado}</p>}
          {(a.pronto || a.erro) && <div className="sieg-acoes"><button type="button" className="btn btn-outline" onClick={vm.limpar}><Icone nome="upload" />Mandar outros</button></div>}
        </div>
      )}
    </div>
  );
}
