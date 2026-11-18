// Os comprovantes do mês numa janela (18/11/2026: "quero a opção de adicionar comprovantes, não só extratos"; "com os
// comprovantes tem como saber o cliente e afins… ele também precisa puxar os comprovantes do drive"). Em cima, do computador
// (ou soltando os arquivos) e do Drive; o andamento da leitura e o que deu certo ou não. Embaixo, cada comprovante lido: o
// arquivo (abre), a data, o valor, quem (o nome e o CPF/CNPJ) e a linha do extrato em que ele caiu (dá para trocar).
import { Icone, LogoDrive, SoltarArquivos, Vazio } from '@nads/ui';
import { useRef } from 'react';
import { Janela } from './Janelas';
import type { useComprovantesDoLancatudo } from './useComprovantesDoLancatudo';
import type { useRegistroDoLancatudo } from './useRegistroDoLancatudo';

type Vm = ReturnType<typeof useRegistroDoLancatudo>;
type Comp = ReturnType<typeof useComprovantesDoLancatudo>;

const ROTULO_DO_TIPO: Record<string, string> = { pix: 'Pix', transferencia: 'TED', boleto: 'Boleto', guia: 'Guia', outro: 'Outro' };

export function JanelaDosComprovantes({ vm, c, fechar }: { vm: Vm; c: Comp; fechar: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const lista = [...vm.comprovantes].sort((a, b) => (a.data || '9').localeCompare(b.data || '9') || a.nome.localeCompare(b.nome));
  const semLinha = lista.filter(x => !vm.linhaDoComprovante(x.id)).length;
  return (
    <Janela titulo={'Comprovantes de ' + vm.rotuloDoMes.toLowerCase()} fechar={fechar} className="lt-janela-comprovantes"
      selo={<span className="badge badge-neutral">{vm.banco.nome}{vm.banco.conta ? ' ' + vm.banco.conta : ''}</span>}>
      <div className="registro-corpo lt-comp-corpo">
        <SoltarArquivos aceitar={c.aceitar} multiplo onArquivos={c.doComputador} desabilitada={!!c.lendo} className="lt-comp-soltar"
          titulo="Solte os comprovantes aqui" dica="PDF ou imagem. O nads lê a data, o valor e quem recebeu ou pagou, e acha a linha do extrato.">
          <div className="lt-comp-botoes">
            <button type="button" className="btn btn-outline" disabled={!!c.lendo} onClick={() => input.current?.click()}><Icone nome="upload" />Do computador</button>
            {c.precisaEntrar
              ? <button type="button" className="btn btn-outline" onClick={c.entrarNoDrive}><LogoDrive cor />Entrar no Drive</button>
              : <button type="button" className="btn btn-outline" disabled={!!c.lendo} onClick={c.doDrive} title={'A pasta EXTRATOS/' + vm.competencia.slice(0, 4) + '/' + vm.competencia.slice(5) + '/COMPROVANTES da empresa'}><LogoDrive cor />Puxar do Drive</button>}
            <input ref={input} type="file" hidden multiple accept={c.aceitar} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) c.doComputador(fs); }} />
          </div>
        </SoltarArquivos>

        {c.lendo && <p className="lt-comp-lendo"><span className="btn-spinner" />{c.lendo}</p>}
        {c.resumo && (
          <div className={'lt-comp-resumo' + (c.resumo.erros.length ? ' com-erro' : '')}>
            <span><Icone nome={c.resumo.erros.length ? 'alert' : 'checkCircle'} />
              {c.resumo.lidos ? c.resumo.lidos + (c.resumo.lidos === 1 ? ' comprovante lido' : ' comprovantes lidos') : 'Nenhum comprovante novo'}
              {c.resumo.jaEstavam ? ' · ' + c.resumo.jaEstavam + ' já estava' + (c.resumo.jaEstavam === 1 ? '' : 'm') + ' aqui' : ''}
            </span>
            {c.resumo.erros.length > 0 && <ul>{c.resumo.erros.map((e, i) => <li key={i}><b>{e.nome}</b>: {e.erro}</li>)}</ul>}
            <button type="button" className="lt-comp-resumo-x" onClick={c.fecharResumo} aria-label="Fechar o aviso"><Icone nome="x" /></button>
          </div>
        )}

        {lista.length ? (
          <>
            <p className="lt-comp-conta">{lista.length} {lista.length === 1 ? 'comprovante' : 'comprovantes'}{semLinha ? ' · ' + semLinha + ' sem linha no extrato' : ' · todos com a linha do extrato'}</p>
            <table className="lt-tabela-regras lt-tabela-comp">
              <colgroup><col className="c-arq" /><col className="c-data" /><col className="c-valor" /><col /><col className="c-linha" /><col className="c-acoes" /></colgroup>
              <thead><tr><th>Comprovante</th><th>Data</th><th className="num">Valor</th><th>Cliente / Fornecedor</th><th>Linha do extrato</th><th aria-label="Tirar" /></tr></thead>
              <tbody>
                {lista.map(x => {
                  const l = vm.linhaDoComprovante(x.id);
                  const candidatas = vm.linhas.filter(y => Math.abs(y.valor) === x.valor);
                  return (
                    <tr key={x.id}>
                      <td>
                        <button type="button" className="lt-comp-arq" onClick={() => c.ver(x)} disabled={!c.podeVer(x)} title={c.podeVer(x) ? 'Ver o comprovante' : 'O arquivo ficou no computador de quem enviou'}>
                          {x.driveId ? <LogoDrive cor /> : <Icone nome="clipe" />}<span>{x.nome}</span>
                        </button>
                        <span className="lt-regra-procura">{ROTULO_DO_TIPO[x.tipo]}{x.recebido ? ' recebido' : ''}</span>
                      </td>
                      <td className="num">{x.data ? vm.dataBR(x.data) : '—'}</td>
                      <td className={'num ' + (x.recebido ? 'lt-entrada' : 'lt-saida')}>{x.valor ? vm.valor(x.valor) : '—'}</td>
                      <td>
                        <span className="lt-regra-nome">{x.favorecido || <i className="fraco">sem nome</i>}</span>
                        {x.documento && <span className="lt-regra-procura num">{vm.mascaraDocumento(x.documento)}</span>}
                      </td>
                      <td>
                        <select className="lt-comp-linha" value={x.linha || ''} onChange={e => vm.ligarComprovante(x.id, e.target.value)} aria-label="A linha do extrato deste comprovante">
                          <option value="">{l ? 'Automático: ' + vm.dataBR(l.data).slice(0, 5) + ' ' + l.historicoDoBanco.slice(0, 28) : candidatas.length ? 'Automático: nenhuma perto da data' : 'Nenhuma linha com este valor'}</option>
                          {candidatas.map(y => <option key={y.chave} value={y.chave}>{vm.dataBR(y.data).slice(0, 5)} · {y.historicoDoBanco.slice(0, 34)} · {vm.valor(y.valor)}</option>)}
                        </select>
                        {!l && <span className="lt-regra-procura lt-comp-sem">sem linha</span>}
                      </td>
                      <td className="lt-regra-acoes">
                        <button type="button" className="icon-btn icon-btn-sm" title="Tirar o comprovante daqui (o arquivo continua no Drive)" aria-label="Tirar o comprovante" onClick={() => vm.tirarComprovante(x.id)}><Icone nome="lixeira" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : !c.lendo && <Vazio compacto icone="clipe" titulo="Nenhum comprovante neste mês" texto="Envie do computador ou puxe do Drive: cada comprovante vira o cliente ou o fornecedor da linha do extrato, e o CPF/CNPJ ajuda a achar a conta." />}
      </div>
    </Janela>
  );
}
