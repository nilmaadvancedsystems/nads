// Cadastro › a empresa › Fiscal › Documentos e planilhas (Heverton, 20/10/2026: "Cadastro = Fiscal (inserir)"): a pasta
// da empresa no Drive, as três planilhas do Fiscal (DEFIS, Projeção do Fator R e Rateio: o link e quando foi posto) e os
// outros documentos da empresa (o nome e o link). Peças do catálogo: ConfigSecao, ConfigLinha, BotaoIcone, Vazio.
import { BotaoIcone, ConfigLinha, ConfigSecao, Icone, useCarregando } from '@nads/ui';
import { Link } from 'react-router';
import { useDocumentosDoFiscal } from './useDocumentosDoFiscal';

export function DocumentosDoFiscal({ rota }: { rota: string }) {
  const vm = useDocumentosDoFiscal(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  return (
    <>
      <ConfigSecao titulo="Documentos da empresa">
        <ConfigLinha titulo="A pasta no Drive" descricao={vm.pasta ? vm.pasta.nome + (vm.pasta.mod ? ' · mexida em ' + vm.pasta.mod : '') : vm.semMapa ? 'O mapa do Drive só abre para o admin e o contábil.' : vm.mapaCarregado ? 'O robô não achou a pasta desta empresa no Drive do ano.' : 'Procurando a pasta…'}>
          {vm.pasta && (
            <span className="fis-docs-acoes">
              <Link className="btn btn-outline" to={vm.pasta.noNads}><Icone nome="pasta" width={16} height={16} />Abrir no nads</Link>
              <a className="btn btn-ghost" href={vm.pasta.noGoogle} target="_blank" rel="noreferrer"><Icone nome="link" width={16} height={16} />Google Drive</a>
            </span>
          )}
        </ConfigLinha>
        {vm.outros.map(d => (
          <ConfigLinha key={d.indice} titulo={d.nome} descricao={'Posto em ' + d.atualizado}>
            <span className="fis-docs-acoes">
              <a className="btn btn-outline" href={d.link} target="_blank" rel="noreferrer"><Icone nome="link" width={16} height={16} />Abrir</a>
              <BotaoIcone icone="lixeira" titulo={'Tirar ' + d.nome} onClick={() => void vm.tirar(d.indice)} />
            </span>
          </ConfigLinha>
        ))}
        <ConfigLinha titulo="Acrescentar um documento" aviso={vm.erroNovo || undefined}>
          <form className="fis-docs-novo" onSubmit={ev => { ev.preventDefault(); vm.acrescentar(); }}>
            <input type="text" className="pessoal-select" placeholder="Nome" aria-label="Nome do documento" value={vm.novo.nome} onChange={e => vm.mudarNovo({ nome: e.target.value })} maxLength={120} />
            <input type="url" className="pessoal-select" placeholder="https://drive.google.com/…" aria-label="Link do documento" value={vm.novo.link} onChange={e => vm.mudarNovo({ link: e.target.value })} />
            <button type="submit" className="btn btn-outline" disabled={!vm.novo.nome.trim() || !vm.novo.link.trim()}><Icone nome="plus" width={16} height={16} />Acrescentar</button>
          </form>
        </ConfigLinha>
      </ConfigSecao>
      <ConfigSecao titulo="Planilhas do Fiscal">
        {vm.planilhas.map(p => (
          <ConfigLinha key={p.id} titulo={p.rotulo} descricao={p.gravado ? 'Atualizada em ' + p.atualizado : 'Cole o link da planilha da empresa no Drive.'} aviso={p.erro || undefined}>
            <form className="fis-docs-novo" onSubmit={ev => { ev.preventDefault(); vm.gravarPlanilha(p.id); }}>
              <input type="url" className="pessoal-select" placeholder="https://docs.google.com/…" aria-label={'Link da ' + p.rotulo} value={p.link} onChange={e => vm.mudarPlanilha(p.id, e.target.value)} />
              {p.mudou && <button type="submit" className="btn btn-primary">Guardar</button>}
              {!p.mudou && p.gravado && <a className="btn btn-outline" href={p.gravado} target="_blank" rel="noreferrer"><Icone nome="link" width={16} height={16} />Abrir</a>}
              {!p.mudou && p.gravado && <BotaoIcone icone="lixeira" titulo={'Tirar o link da ' + p.rotulo} onClick={() => void vm.tirarPlanilha(p.id)} />}
            </form>
          </ConfigLinha>
        ))}
      </ConfigSecao>
    </>
  );
}
