// A tela das Ferramentas (30/10/2026, o botão ao lado da engrenagem na gaveta): separar, juntar, girar e tirar páginas,
// PDF para imagem ou texto e a conversão de planilha. Tudo no navegador: o arquivo não sai do computador.
import { BotaoAcao, BotaoIcone, CampoArquivo, CampoArquivos, Segmentado } from '@nads/ui';
import type { ferramentas } from '@nads/core';
import { FERRAMENTAS, useFerramentas, type Ferramenta } from './useFerramentas';

type Vm = ReturnType<typeof useFerramentas>;

export function Ferramentas() {
  const vm = useFerramentas();
  return (
    <div className="ferramentas">
      <Segmentado<Ferramenta> valor={vm.ferramenta} onMudar={vm.setFerramenta} opcoes={FERRAMENTAS} />
      {vm.ferramenta === 'juntar' && <Juntar vm={vm} />}
      {vm.ferramenta === 'planilha' && <Planilha vm={vm} />}
      {vm.ferramenta !== 'juntar' && vm.ferramenta !== 'planilha' && <ComPdf vm={vm} />}
    </div>
  );
}

/** As ferramentas de um PDF só: escolhe o arquivo uma vez e usa em qualquer uma delas. */
function ComPdf({ vm }: { vm: Vm }) {
  const p = vm.pdf;
  return (
    <>
      <div className="card">
        <h3>Escolha o PDF</h3>
        <CampoArquivo id="ferramentas-pdf" arquivo={p?.arquivo ?? null} aceitar=".pdf" onEscolher={f => void vm.escolherPdf(f)} />
        {p ? <p className="hint">{p.arquivo.name} · {p.total} página{p.total === 1 ? '' : 's'}</p> : <p className="hint">Escolha um PDF para começar.</p>}
      </div>
      {p && vm.ferramenta === 'separar' && (
        <div className="card">
          <h3>Separar em arquivos</h3>
          <p className="sub">Separe os grupos com ponto e vírgula; dentro de um grupo, use vírgula e traço.</p>
          <label className="hint" htmlFor="ferramentas-grupos">Grupos de páginas</label>
          <input id="ferramentas-grupos" type="text" value={vm.grupos} placeholder="1-3; 4-6" onChange={e => vm.setGrupos(e.target.value)} />
          <div className="btn-row">
            <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={vm.separar}>Separar e baixar</BotaoAcao>
            <button type="button" className="btn btn-outline" onClick={() => vm.setGrupos(Array.from({ length: p.total }, (_, i) => String(i + 1)).join('; '))}>Uma página por arquivo</button>
          </div>
          <p className="hint">Vários arquivos saem um depois do outro; se o navegador pedir, permita baixar vários.</p>
        </div>
      )}
      {p && vm.ferramenta === 'paginas' && (
        <div className="card">
          <h3>Girar ou tirar páginas</h3>
          <label className="hint" htmlFor="ferramentas-paginas">Páginas</label>
          <input id="ferramentas-paginas" type="text" value={vm.paginas} placeholder="2, 4-6" onChange={e => vm.setPaginas(e.target.value)} />
          <label className="hint" htmlFor="ferramentas-graus">Giro (no sentido do relógio)</label>
          <select id="ferramentas-graus" value={vm.graus} onChange={e => vm.setGraus(Number(e.target.value) as 90 | 180 | 270)}>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
          <div className="btn-row">
            <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={() => vm.editarPaginas('girar')}>Girar e baixar</BotaoAcao>
            <BotaoAcao className="btn btn-outline" carregando={vm.ocupado} onClick={() => vm.editarPaginas('remover')}>Tirar as páginas e baixar</BotaoAcao>
          </div>
        </div>
      )}
      {p && vm.ferramenta === 'imagens' && (
        <div className="card">
          <h3>PDF em imagem</h3>
          <div className="btn-row">
            <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={vm.gerarImagens}>Converter as páginas</BotaoAcao>
            {vm.imagens.length > 1 && <button type="button" className="btn btn-outline" onClick={vm.baixarTodasAsImagens}>Baixar todas</button>}
          </div>
          {vm.imagens.length > 0 && (
            <ul className="ferramentas-lista">
              {vm.imagens.map((_, i) => (
                <li key={i}>
                  <span>Página {i + 1}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void vm.baixarImagem(i)}>Baixar PNG</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {p && vm.ferramenta === 'texto' && (
        <div className="card">
          <h3>PDF em texto</h3>
          <div className="btn-row">
            <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={vm.gerarTexto}>Extrair o texto</BotaoAcao>
            {vm.texto && vm.texto.trim() !== '' && <button type="button" className="btn btn-outline" onClick={vm.baixarTexto}>Baixar .txt</button>}
          </div>
          {vm.texto !== null && vm.texto.trim() === '' && <p className="hint">Esse PDF não tem texto: é uma foto digitalizada.</p>}
          {vm.texto && vm.texto.trim() !== '' && <textarea readOnly rows={14} value={vm.texto} />}
        </div>
      )}
    </>
  );
}

/** Juntar: os PDFs na ordem que saem, com as setas para trocar de lugar. */
function Juntar({ vm }: { vm: Vm }) {
  return (
    <div className="card">
      <h3>Juntar PDFs</h3>
      <CampoArquivos id="ferramentas-juntar" aceitar=".pdf" rotulo="Escolher PDFs" onEscolher={vm.adicionarParaJuntar} />
      {vm.juntar.length > 0 && (
        <ol className="ferramentas-lista">
          {vm.juntar.map((f, i) => (
            <li key={i + f.name}>
              <span>{i + 1}. {f.name}</span>
              <span className="btn-row">
                <BotaoIcone icone="arrowUp" titulo="Subir" pequeno disabled={i === 0} onClick={() => vm.trocarDeLugar(i, i - 1)} />
                <BotaoIcone icone="arrowDown" titulo="Descer" pequeno disabled={i === vm.juntar.length - 1} onClick={() => vm.trocarDeLugar(i, i + 1)} />
                <BotaoIcone icone="x" titulo="Tirar da lista" pequeno onClick={() => vm.tirarDoJuntar(i)} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={vm.juntar.length < 2} onClick={vm.juntarEBaixar}>Juntar e baixar</BotaoAcao>
    </div>
  );
}

/** Planilha: xls, xlsx, ods ou csv viram csv ou xlsx. */
function Planilha({ vm }: { vm: Vm }) {
  return (
    <div className="card">
      <h3>Converter planilha</h3>
      <CampoArquivo id="ferramentas-planilha" arquivo={vm.planilha} aceitar=".xls,.xlsx,.ods,.csv" onEscolher={vm.setPlanilha} />
      <Segmentado<ferramentas.planilha.FormatoDeSaida> valor={vm.destino} onMudar={vm.setDestino} opcoes={[
        { valor: 'xlsx', rotulo: 'Excel (.xlsx)' },
        { valor: 'csv', rotulo: 'CSV (.csv)' },
      ]} />
      <p className="hint">Do Excel vão todas as abas; para CSV, só a primeira (o CSV não tem abas).</p>
      <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!vm.planilha} onClick={vm.converterPlanilhaEscolhida}>Converter e baixar</BotaoAcao>
    </div>
  );
}
