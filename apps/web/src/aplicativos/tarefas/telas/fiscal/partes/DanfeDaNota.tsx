// A nota original (23/10/2026: "eu queria realmente ver a nota, com produtos e tal, a nota original"), pelo XML inteiro:
// de cima para baixo, a identificação (entrada ou saída, número, série, emissão, natureza, protocolo), o emitente e o
// destinatário, os totais, os produtos com a descrição, o transporte, as faturas e o pagamento, e as informações
// complementares. Imprimir sai no desenho da DANFE (core tarefas.sieg.htmlDaDanfe); dá para baixar o XML. Só as peças do
// catálogo (a janela de registro, Propriedade, Stat, Tabela padrão, selo).
import { tarefas as t } from '@nads/core';
import { baixarBytes, BotaoFechar, Icone, Stat, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { Propriedade } from '../../financeiro/partes/Propriedade';
import { imprimirHtml } from '../../dp/imprimirHtml';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const s = t.sieg;

export function DanfeDaNota({ d, xml, fechar }: { d: t.sieg.Danfe; xml: string; fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const pessoa = (p: t.sieg.PessoaDaDanfe) => (
    <span className="danfe-pessoa">
      <b>{p.nome || '—'}</b>{p.doc && <span className="fraco num"> · {s.docFormatado(p.doc)}</span>}{p.ie && <span className="fraco"> · IE {p.ie}</span>}
      {(p.endereco || p.municipio) && <span className="fraco danfe-endereco">{[p.endereco, [p.municipio, p.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}</span>}
    </span>
  );
  const tt = d.totais;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo danfe-janela" role="dialog" aria-modal="true" aria-label={'A nota original ' + d.numero}>
        <header className="registro-topo">
          <span className="registro-caminho">
            <Icone nome="recibo" />Nota original<Icone nome="chevronRight" />
            <b>{(d.modelo === '65' ? 'NFC-e ' : 'NF-e ') + d.numero + ' · série ' + d.serie}</b>
            <span className={'badge ' + (d.tipo === 'entrada' ? 'badge-neutral' : 'badge-ok')}>{d.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
          </span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo danfe-corpo">
          <div className="registro-props">
            <Propriedade icone="fileText" rotulo="Natureza">{d.natureza || '—'}</Propriedade>
            <Propriedade icone="calendar" rotulo="Emissão">{d.emissao}{d.saidaEntrada && d.saidaEntrada !== d.emissao && <span className="fraco"> · saída/entrada {d.saidaEntrada}</span>}</Propriedade>
            <Propriedade icone="predio" rotulo="Emitente">{pessoa(d.emitente)}</Propriedade>
            <Propriedade icone="usuario" rotulo="Destinatário">{pessoa(d.destinatario)}</Propriedade>
            <Propriedade icone="hash" rotulo="Chave">{<span className="num">{s.chaveEmGrupos(d.chave)}</span>}{d.protocolo && <span className="fraco"> · protocolo {d.protocolo.numero} ({d.protocolo.data})</span>}</Propriedade>
          </div>

          <div className="stat-grid fin-numeros espelho-totais">
            <Stat grande={false} rotulo="Produtos" valor={'R$ ' + brl(tt.produtos)} />
            <Stat grande={false} rotulo="Frete" valor={'R$ ' + brl(tt.frete)} />
            <Stat grande={false} rotulo="Desconto" valor={'R$ ' + brl(tt.desconto)} />
            <Stat grande={false} rotulo="ICMS" valor={'R$ ' + brl(tt.icms)} />
            <Stat grande={false} rotulo="ICMS-ST" valor={'R$ ' + brl(tt.st)} />
            <Stat grande={false} rotulo="IPI" valor={'R$ ' + brl(tt.ipi)} />
            <Stat grande={false} rotulo="Total da nota" valor={'R$ ' + brl(tt.nota)} />
          </div>

          <div className="table-wrap danfe-itens">
            <table className="table-compact">
              <thead><tr><th>#</th><th>Código</th><th>Descrição</th><th>NCM</th><th>CST</th><th>CFOP</th><th>Un.</th><th className="num">Quant.</th><th className="num">V. unit.</th><th className="num">V. total</th><th className="num">Desc.</th><th className="num">ICMS</th><th className="num">ST</th><th className="num">IPI</th></tr></thead>
              <tbody>
                {d.itens.map(i => (
                  <tr key={i.n}>
                    <td className="num fraco">{i.n}</td>
                    <td className="fraco">{i.codigo}</td>
                    <td className="danfe-descricao">{i.descricao}{i.infAdic && <span className="fraco"> · {i.infAdic}</span>}</td>
                    <td className="num">{i.ncm}</td><td className="num">{i.cst}</td><td className="num">{i.cfop}</td><td>{i.unidade}</td>
                    <td className="num">{qtd(i.quantidade)}</td>
                    <td className="num">{brl(i.valorUnitario)}</td>
                    <td className="num"><b>{brl(i.valor)}</b></td>
                    <td className="num">{i.desconto ? brl(i.desconto) : <span className="fraco">—</span>}</td>
                    <td className="num">{i.icms ? brl(i.icms) + (i.aliqIcms ? ' (' + qtd(i.aliqIcms) + '%)' : '') : <span className="fraco">—</span>}</td>
                    <td className="num">{i.st ? brl(i.st) : <span className="fraco">—</span>}</td>
                    <td className="num">{i.ipi ? brl(i.ipi) : <span className="fraco">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="registro-props">
            <Propriedade icone="caminhao" rotulo="Transporte">
              {d.transporte.modalidade || '—'}{d.transporte.nome && <span className="fraco"> · {d.transporte.nome}</span>}{d.transporte.volumes && <span className="fraco"> · {d.transporte.volumes}</span>}{d.transporte.pesoBruto ? <span className="fraco"> · {qtd(d.transporte.pesoBruto)} kg</span> : null}
            </Propriedade>
            {d.faturas.length > 0 && <Propriedade icone="calendar" rotulo="Faturas">{d.faturas.map(f => f.numero + ' vence ' + f.vencimento + ' · R$ ' + brl(f.valor)).join('  ·  ')}</Propriedade>}
            {d.pagamentos.length > 0 && <Propriedade icone="dinheiro" rotulo="Pagamento">{d.pagamentos.map(p => p.forma + ' · R$ ' + brl(p.valor)).join('  ·  ')}</Propriedade>}
            {(d.informacoes || d.fisco) && <Propriedade icone="mensagem" rotulo="Informações"><span className="danfe-info">{[d.informacoes, d.fisco].filter(Boolean).join(' · ')}</span></Propriedade>}
          </div>
        </div>
        <footer className="registro-pe">
          <span className="fraco">{d.itens.length} {d.itens.length === 1 ? 'produto' : 'produtos'}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={() => baixarBytes(new TextEncoder().encode(xml), d.chave + '.xml', 'application/xml')}><Icone nome="download" width={16} height={16} />Baixar o XML</button>
          <button type="button" className="btn btn-outline" onClick={() => imprimirHtml(s.htmlDaDanfe(d))}><Icone nome="printer" width={16} height={16} />Imprimir a DANFE</button>
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
