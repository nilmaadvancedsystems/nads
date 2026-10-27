// O espelho da nota (23/10/2026: "quero que tenha como conferir as danfe direto pelo app, tanto no rateio quanto nas
// outras telas"; a 1ª etapa, com o que o app guarda do XML do SIEG): no desenho das janelas do sistema, de cima para
// baixo, a chave de acesso (clicar copia; a consulta da SEFAZ ao lado), o emitente e o destinatário, os totais da nota e
// os itens (NCM, CFOP, CST, valor, ICMS, ST, IPI). A nota original, pelo XML inteiro, abre no "Ver a nota original"
// (23/10/2026, a 2ª etapa: DanfeDaNota e useNotaOriginal; o robô traz o XML pela chave). Só as peças do
// catálogo (a janela, Propriedade, texto copiável, Tabela padrão, Stat, selo).
import { tarefas as t } from '@nads/core';
import { BotaoFechar, Icone, Stat, useJanela, useRetorno } from '@nads/ui';
import { useRef } from 'react';
import { documentoFormatado } from '../../financeiro/formatosDaNota';
import { DanfeDaNota } from './DanfeDaNota';
import { useNotaOriginal } from './useNotaOriginal';
import { Propriedade } from '../../financeiro/partes/Propriedade';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** a consulta pública da NF-e no portal nacional (a SEFAZ pede o captcha; a chave vai copiada) */
const CONSULTA_NFE = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=';

/** codigo e competencia: a empresa e o mês dos XMLs (para o robô trazer a nota original) */
export function EspelhoDaNota({ nota, codigo, competencia, fechar }: { nota: t.sieg.NotaDoSieg; codigo?: string | number | null; competencia?: string; fechar: () => void }) {
  const e = t.sieg.espelhoDaNota(nota);
  const original = useNotaOriginal(nota, codigo, competencia);
  const { toast } = useRetorno();
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const copiar = () => { void navigator.clipboard?.writeText(nota.chave).then(() => toast('Chave copiada.'), () => toast('Não consegui copiar.')); };
  const parte = (p: { doc: string; nome: string }) => <span className="espelho-parte"><b>{p.nome || '—'}</b>{p.doc && <span className="fraco num"> · {documentoFormatado(p.doc)}</span>}</span>;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo espelho-nota" role="dialog" aria-modal="true" aria-label={'A nota ' + e.titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Nota fiscal<Icone nome="chevronRight" /><b>{e.titulo}</b>{nota.cancelada && <span className="badge badge-bad">Cancelada</span>}</span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo espelho-corpo">
          <div className="registro-props">
            <Propriedade icone="hash" rotulo="Chave de acesso">
              <span className="espelho-chave">
                <button type="button" className="texto-copiavel num" title="Clique para copiar" onClick={copiar}>{e.chave || '—'}</button>
                {e.daChave?.modelo === '55' && <a className="btn btn-outline btn-sm" href={CONSULTA_NFE} target="_blank" rel="noopener noreferrer" onClick={copiar} title="Abre a consulta pública da NF-e com a chave copiada"><Icone nome="search" width={14} height={14} />Consultar na SEFAZ</a>}
              </span>
            </Propriedade>
            <Propriedade icone="predio" rotulo="Emitente">{parte(nota.emitente)}</Propriedade>
            <Propriedade icone="usuario" rotulo="Destinatário">{parte(nota.destinatario)}</Propriedade>
          </div>

          <div className="stat-grid fin-numeros espelho-totais">
            <Stat grande={false} rotulo="Produtos" valor={'R$ ' + brl(e.totais.produtos)} />
            <Stat grande={false} rotulo="Frete" valor={'R$ ' + brl(e.totais.frete)} />
            <Stat grande={false} rotulo="Desconto" valor={'R$ ' + brl(e.totais.desconto)} />
            <Stat grande={false} rotulo="IPI" valor={'R$ ' + brl(e.totais.ipi)} />
            <Stat grande={false} rotulo="ICMS-ST" valor={'R$ ' + brl(e.totais.st)} />
            <Stat grande={false} rotulo="Total da nota" valor={'R$ ' + brl(e.totais.total)} />
          </div>

          {e.semItens ? <p className="fraco">Os itens desta nota não vieram no resumo do SIEG (baixe os XMLs do mês de novo no Painel do Fiscal).</p> : (
            <div className="table-wrap espelho-itens">
              <table className="table-compact">
                <thead><tr><th>#</th><th>NCM</th><th>CFOP</th><th>CST</th><th className="num">Valor</th><th className="num">ICMS</th><th className="num">ICMS-ST</th><th className="num">IPI</th></tr></thead>
                <tbody>
                  {e.itens.map((i, k) => (
                    <tr key={k}>
                      <td className="num fraco">{k + 1}</td><td className="num">{i.ncm}</td><td className="num">{i.cfop}</td><td className="num">{i.cst}</td>
                      <td className="num"><b>{brl(i.valor)}</b></td>
                      <td className="num">{i.icms ? brl(i.icms) : <span className="fraco">—</span>}</td>
                      <td className="num">{i.st ? brl(i.st) : <span className="fraco">—</span>}</td>
                      <td className="num">{i.ipi ? brl(i.ipi) : <span className="fraco">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <footer className="registro-pe">
          <span className="fraco">{original.fase === 'pedindo' ? original.andamento : original.fase === 'erro' ? 'Não veio a nota original: ' + original.erro : e.itens.length + (e.itens.length === 1 ? ' item' : ' itens')}</span>
          <span className="tarefas-barra-espaco" />
          {original.pode && (
            <button type="button" className="btn btn-primary" disabled={original.fase === 'pedindo'} onClick={() => void original.abrir()}>
              <Icone nome="fileText" width={16} height={16} />{original.fase === 'pedindo' ? 'Buscando a nota…' : original.fase === 'erro' ? 'Tentar de novo' : 'Ver a nota original'}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </footer>
      </div>
      {original.aberta && original.danfe && <DanfeDaNota d={original.danfe} xml={original.xml} fechar={original.fechar} />}
    </div>
  );
}
