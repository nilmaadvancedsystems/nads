// A tela das Ferramentas (30/10/2026, o botão ao lado da engrenagem na gaveta): separar, juntar, girar e tirar páginas,
// PDF para imagem ou texto e a conversão de planilha. Tudo no navegador: o arquivo não sai do computador.
// 12/11/2026 ("melhorar o visual e as funcionalidades"): o arquivo entra arrastando; as páginas em miniatura à
// esquerda e as opções com o botão à direita; o Juntar arrasta para mudar a ordem; e as novas (Comprimir, Numerar,
// Imagem → PDF, o OCR).
import { BlocosDeEscolha, BotaoAcao, BotaoIcone, CampoArquivo, Icone, IconeDeArquivo, Segmentado, SoltarArquivos, Vazio, formatoPeloNome } from '@nads/ui';
import { ferramentas } from '@nads/core';
import type { ReactNode } from 'react';
import { COM_UM_PDF, FERRAMENTAS, GRUPOS_DAS_FERRAMENTAS, useFerramentas, type Ferramenta, type ItemDaLista } from './useFerramentas';

type Vm = ReturnType<typeof useFerramentas>;
type Lista = Vm['juntar'];

const AVISO_LOCAL = 'O arquivo é aberto aqui no navegador: nada sai do seu computador.';
const plural = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);

export function Ferramentas() {
  const vm = useFerramentas();
  const icone = FERRAMENTAS.find(f => f.valor === vm.ferramenta)?.icone ?? 'upload';
  return (
    <div className="ferramentas">
      <BlocosDeEscolha<Ferramenta> valor={vm.ferramenta} onMudar={vm.setFerramenta} grupos={GRUPOS_DAS_FERRAMENTAS} rotulo="A ferramenta" />
      <p className="ferramentas-descricao"><Icone nome={icone} />{vm.descricao}</p>
      {COM_UM_PDF.includes(vm.ferramenta) && <ComPdf vm={vm} />}
      {vm.ferramenta === 'juntar' && <Juntar vm={vm} />}
      {vm.ferramenta === 'imagem-pdf' && <ImagemEmPdf vm={vm} />}
      {vm.ferramenta === 'planilha' && <Planilha vm={vm} />}
    </div>
  );
}

/** A página com a área principal (as miniaturas) e o lado das opções, com o botão de fazer. */
function Corpo({ principal, lado, cabeca }: { principal: ReactNode; lado: ReactNode; cabeca: ReactNode }) {
  return (
    <div className="ferramentas-corpo">
      <section className="card ferramentas-principal">
        <div className="card-head">{cabeca}</div>
        {principal}
      </section>
      <aside className="card ferramentas-lado">{lado}</aside>
    </div>
  );
}

/** O andamento do trabalho longo, no lado (o OCR, o Comprimir, as imagens). */
function Andamento({ vm }: { vm: Vm }) {
  if (!vm.andamento) return null;
  return <p className="ferramentas-andamento" role="status"><span className="btn-spinner" />{vm.andamento}</p>;
}

/** O arquivo escolhido, no alto da área principal: o ícone, o nome, as páginas e o tamanho, e o Trocar. */
function ArquivoEscolhido({ nome, detalhe, id, aceitar, onTrocar }: { nome: string; detalhe: string; id: string; aceitar: string; onTrocar: (fs: File[]) => void }) {
  return (
    <>
      <div className="ferramentas-arquivo">
        <IconeDeArquivo formato={formatoPeloNome(nome)} tamanho={28} />
        <div><b title={nome}>{nome}</b><span className="hint">{detalhe}</span></div>
      </div>
      <label className="btn btn-outline" htmlFor={id}><Icone nome="upload" />Trocar arquivo</label>
      <CampoArquivo id={id} aceitar={aceitar} semCaixa onEscolher={f => f && onTrocar([f])} />
    </>
  );
}

// ─── as ferramentas de um PDF só ────────────────────────────────────────────────────────────────────────────────

/** As ferramentas de um PDF só: escolhe o arquivo uma vez (soltando ou clicando) e usa em qualquer uma delas. */
function ComPdf({ vm }: { vm: Vm }) {
  const p = vm.pdf;
  const icone = FERRAMENTAS.find(f => f.valor === vm.ferramenta)?.icone;
  if (!p) {
    return (
      <SoltarArquivos aceitar=".pdf" titulo="Arraste o PDF para cá" icone={icone} dica={AVISO_LOCAL + ' O mesmo PDF fica escolhido nas outras abas.'}
        desabilitada={vm.ocupado} onArquivos={fs => void vm.escolherPdf(fs)} />
    );
  }
  const cabeca = <ArquivoEscolhido nome={p.arquivo.name} detalhe={plural(p.total, 'página', 'páginas') + ' · ' + vm.tamanhoDoPdf} id="ferramentas-pdf" aceitar=".pdf" onTrocar={fs => void vm.escolherPdf(fs)} />;
  const corpo = {
    separar: { principal: <PaginasDoSeparar vm={vm} />, lado: <LadoDoSeparar vm={vm} /> },
    paginas: { principal: <PaginasDoGirar vm={vm} />, lado: <LadoDoGirar vm={vm} /> },
    comprimir: { principal: <Paginas vm={vm} />, lado: <LadoDoComprimir vm={vm} /> },
    numerar: { principal: <PaginasDoNumerar vm={vm} />, lado: <LadoDoNumerar vm={vm} /> },
    imagens: { principal: <PaginasDaImagem vm={vm} />, lado: <LadoDaImagem vm={vm} /> },
    texto: { principal: <TextoDoPdf vm={vm} />, lado: <LadoDoTexto vm={vm} /> },
  }[vm.ferramenta as 'separar' | 'paginas' | 'comprimir' | 'numerar' | 'imagens' | 'texto'];
  return (
    <SoltarArquivos aceitar=".pdf" desabilitada={vm.ocupado} onArquivos={fs => void vm.escolherPdf(fs)}>
      <Corpo cabeca={cabeca} principal={corpo.principal} lado={corpo.lado} />
    </SoltarArquivos>
  );
}

/**
 * Uma página em miniatura: a imagem (girada como vai ficar), o número embaixo e o que cada ferramenta põe por cima.
 * Enquanto a imagem não chega, a folha em branco pulsando. naPagina: o que fica em cima da própria página (a prévia do
 * número no rodapé dela), que acompanha o tamanho e o giro da página.
 */
function Miniatura({ vm, i, giro = 0, classe = '', titulo, onClick, naPagina, children }: {
  vm: Vm; i: number; giro?: number; classe?: string; titulo?: string; onClick?: () => void; naPagina?: ReactNode; children?: ReactNode;
}) {
  const m = vm.miniaturas[i];
  const folha = (
    <span className="pagina-mini-folha">
      {m ? (
        <span className={'pagina-mini-pagina' + (m.proporcao >= 1 ? ' deitada' : '')} style={{ aspectRatio: String(m.proporcao), transform: giro ? 'rotate(' + giro + 'deg)' : undefined }}>
          <img src={m.url} alt={'Página ' + (i + 1)} />
          {naPagina}
        </span>
      ) : <span className="pagina-mini-esperando" />}
      {children}
    </span>
  );
  return (
    <li className={'pagina-mini ' + classe}>
      {onClick ? <button type="button" className="pagina-mini-botao" title={titulo} aria-label={titulo} onClick={onClick}>{folha}</button> : folha}
      <span className="pagina-mini-num">{i + 1}</span>
    </li>
  );
}

/** As miniaturas, só para ver (o Comprimir). */
function Paginas({ vm }: { vm: Vm }) {
  return <ol className="paginas-grade">{vm.miniaturas.map((_, i) => <Miniatura key={i} vm={vm} i={i} />)}</ol>;
}

function PaginasDoSeparar({ vm }: { vm: Vm }) {
  const cortes = vm.cortes;
  return (
    <>
      <p className="hint ferramentas-dica-grade">
        {cortes ? 'Clique na página que começa um arquivo novo; clique de novo para desfazer.' : 'Os grupos foram escritos fora de sequência: cada página mostra em que arquivo entra.'}
      </p>
      <ol className="paginas-grade">
        {vm.miniaturas.map((_, i) => {
          const comeca = i === 0 || !!cortes?.includes(i);
          const doArquivo = vm.arquivosDaPagina[i] ?? [];
          const fora = !doArquivo.length;
          const titulo = i === 0 ? undefined : cortes?.includes(i) ? 'Juntar com a página anterior' : 'Começar um arquivo novo nesta página';
          return (
            <Miniatura key={i} vm={vm} i={i} classe={(cortes && comeca && i > 0 ? 'corte' : '') + (fora ? ' fora' : '')}
              titulo={titulo} onClick={cortes && i > 0 ? () => vm.alternarCorte(i) : undefined}>
              {cortes ? comeca && <span className="pagina-mini-selo">Arquivo {doArquivo[0]}</span>
                : doArquivo.length > 0 && <span className="pagina-mini-selo">{doArquivo.map(n => 'Arq. ' + n).join(' · ')}</span>}
            </Miniatura>
          );
        })}
      </ol>
    </>
  );
}

function LadoDoSeparar({ vm }: { vm: Vm }) {
  const n = vm.lidos.grupos.length;
  return (
    <>
      <h3>Separar em {plural(n, 'arquivo', 'arquivos')}</h3>
      {!vm.lidos.erro && (
        <ol className="ferramentas-resumo">
          {vm.lidos.grupos.slice(0, 8).map((g, i) => <li key={i}><span>Arquivo {i + 1}</span><span>pág. {ferramentas.pdf.textoDasPaginas(g)}</span></li>)}
          {n > 8 && <li className="hint">e mais {n - 8}…</li>}
        </ol>
      )}
      <label className="hint" htmlFor="ferramentas-grupos">Ou escreva os grupos (separe com ponto e vírgula)</label>
      <input id="ferramentas-grupos" type="text" value={vm.grupos} placeholder="1-3; 4-6" onChange={e => vm.setGrupos(e.target.value)} aria-invalid={!!vm.lidos.erro || undefined} />
      {vm.lidos.erro && vm.grupos.trim() && <p className="hint ferramentas-erro">{vm.lidos.erro}</p>}
      <div className="ferramentas-atalhos">
        <button type="button" className="btn btn-outline" onClick={vm.umaPorArquivo}>Uma página por arquivo</button>
        {vm.grupos && <button type="button" className="btn btn-ghost" onClick={() => vm.setGrupos('')}>Limpar</button>}
      </div>
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!!vm.lidos.erro} onClick={() => vm.separar(true)}>
          <Icone nome="download" />{n > 1 ? 'Separar e baixar (.zip)' : 'Baixar o PDF'}
        </BotaoAcao>
        {n > 1 && <button type="button" className="btn btn-outline" disabled={vm.ocupado || !!vm.lidos.erro} onClick={() => vm.separar(false)}>Baixar um por um</button>}
      </div>
    </>
  );
}

function PaginasDoGirar({ vm }: { vm: Vm }) {
  return (
    <>
      <p className="hint ferramentas-dica-grade">Em cada página: <Icone nome="girar" /> gira no sentido do relógio e <Icone nome="lixeira" /> tira (clique de novo para devolver).</p>
      <ol className="paginas-grade">
        {vm.miniaturas.map((_, i) => {
          const tirada = vm.tiradas.includes(i);
          return (
            <Miniatura key={i} vm={vm} i={i} giro={vm.giros[i]} classe={tirada ? 'tirada' : vm.giros[i] ? 'girada' : ''}>
              {tirada && <span className="pagina-mini-selo perigo">Sai</span>}
              {!tirada && vm.giros[i] > 0 && <span className="pagina-mini-selo">{vm.giros[i]}°</span>}
              <span className="pagina-mini-acoes">
                <BotaoIcone icone="girar" titulo={'Girar a página ' + (i + 1)} pequeno disabled={tirada} onClick={() => vm.girar(i)} />
                <BotaoIcone icone={tirada ? 'repeat' : 'lixeira'} titulo={(tirada ? 'Devolver' : 'Tirar') + ' a página ' + (i + 1)} pequeno onClick={() => vm.alternarTirada(i)} />
              </span>
            </Miniatura>
          );
        })}
      </ol>
    </>
  );
}

function LadoDoGirar({ vm }: { vm: Vm }) {
  const ficam = (vm.pdf?.total ?? 0) - vm.tiradas.length;
  return (
    <>
      <h3>Girar e tirar páginas</h3>
      <ul className="ferramentas-resumo">
        <li><span>Giradas</span><span>{vm.giradas}</span></li>
        <li><span>Saem</span><span>{vm.tiradas.length}</span></li>
        <li><span>O PDF novo fica com</span><span>{plural(ficam, 'página', 'páginas')}</span></li>
      </ul>
      <label className="hint" htmlFor="ferramentas-paginas">Ou escreva as páginas (vazio = todas, no girar)</label>
      <input id="ferramentas-paginas" type="text" value={vm.paginas} placeholder="2, 4-6" onChange={e => vm.setPaginas(e.target.value)} />
      <div className="ferramentas-atalhos">
        <button type="button" className="btn btn-outline" onClick={() => vm.aplicarNasDigitadas('girar')}><Icone nome="girar" />Girar</button>
        <button type="button" className="btn btn-outline" disabled={!vm.paginas.trim()} onClick={() => vm.aplicarNasDigitadas('tirar')}><Icone nome="lixeira" />Tirar</button>
        {(vm.giradas > 0 || vm.tiradas.length > 0) && <button type="button" className="btn btn-ghost" onClick={vm.desfazerPaginas}>Desfazer tudo</button>}
      </div>
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!vm.giradas && !vm.tiradas.length} onClick={vm.salvarPaginas}>
          <Icone nome="download" />Salvar e baixar
        </BotaoAcao>
      </div>
    </>
  );
}

function LadoDoComprimir({ vm }: { vm: Vm }) {
  const niveis = ferramentas.arquivos.NIVEIS_DE_COMPRESSAO;
  const c = vm.comprimido;
  const economia = c ? ferramentas.arquivos.economia(c.antes, c.depois) : 0;
  return (
    <>
      <h3>Comprimir</h3>
      <Segmentado<ferramentas.arquivos.NivelDeCompressao> valor={vm.nivel} onMudar={vm.mudarNivel}
        opcoes={(Object.keys(niveis) as ferramentas.arquivos.NivelDeCompressao[]).map(n => ({ valor: n, rotulo: niveis[n].rotulo }))} />
      <p className="hint">{niveis[vm.nivel].dica}</p>
      <p className="ferramentas-alerta"><Icone nome="alert" />Cada página vira imagem: o texto deixa de ser selecionável. Guarde o original.</p>
      <Andamento vm={vm} />
      {c && (economia > 0 ? (
        <div className="ferramentas-resultado">
          <span className="hint">De {ferramentas.arquivos.tamanhoLegivel(c.antes)} para</span>
          <b>{ferramentas.arquivos.tamanhoLegivel(c.depois)}</b>
          <span className="badge badge-ok">−{economia}%</span>
        </div>
      ) : (
        <p className="ferramentas-alerta"><Icone nome="checkCircle" />Não diminuiu ({ferramentas.arquivos.tamanhoLegivel(c.depois)}): esse PDF já está compacto. Fique com o original.</p>
      ))}
      <div className="ferramentas-acoes">
        {c && economia > 0
          ? <button type="button" className="btn btn-primary" onClick={vm.baixarComprimido}><Icone nome="download" />Baixar o comprimido</button>
          : <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!!c} onClick={vm.comprimir}><Icone nome="minimizar" />Comprimir</BotaoAcao>}
      </div>
    </>
  );
}

function PaginasDoNumerar({ vm }: { vm: Vm }) {
  return (
    <>
      <p className="hint ferramentas-dica-grade">A prévia mostra onde o número vai ficar.</p>
      <ol className={'paginas-grade numerar-' + vm.lugar}>
        {vm.miniaturas.map((_, i) => (
          <Miniatura key={i} vm={vm} i={i} naPagina={<span className="pagina-mini-numero">{vm.numeroDaPagina(i)}</span>} />
        ))}
      </ol>
    </>
  );
}

function LadoDoNumerar({ vm }: { vm: Vm }) {
  return (
    <>
      <h3>Numerar as páginas</h3>
      <span className="hint">Como escrever</span>
      <Segmentado<ferramentas.pdf.ModeloDoNumero> valor={vm.modelo} onMudar={vm.setModelo} opcoes={[
        { valor: 'pagina-de', rotulo: 'Página 1 de 9' }, { valor: 'de', rotulo: '1 de 9' }, { valor: 'numero', rotulo: '1' },
      ]} />
      <span className="hint">Onde, no rodapé</span>
      <Segmentado<ferramentas.pdf.LugarDoNumero> valor={vm.lugar} onMudar={vm.setLugar} opcoes={[
        { valor: 'esquerda', rotulo: 'Esquerda' }, { valor: 'centro', rotulo: 'Centro' }, { valor: 'direita', rotulo: 'Direita' },
      ]} />
      <label className="hint" htmlFor="ferramentas-primeiro">Começar a contar do</label>
      <input id="ferramentas-primeiro" type="number" min={1} value={vm.primeiro} onChange={e => vm.setPrimeiro(e.target.value)} className="ferramentas-numero" />
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={vm.numerar}><Icone nome="download" />Numerar e baixar</BotaoAcao>
      </div>
    </>
  );
}

function PaginasDaImagem({ vm }: { vm: Vm }) {
  return (
    <ol className="paginas-grade">
      {vm.miniaturas.map((_, i) => (
        <Miniatura key={i} vm={vm} i={i}>
          <span className="pagina-mini-acoes">
            <BotaoIcone icone="download" titulo={'Baixar a página ' + (i + 1)} pequeno disabled={vm.ocupado} onClick={() => vm.baixarImagem(i)} />
          </span>
        </Miniatura>
      ))}
    </ol>
  );
}

function LadoDaImagem({ vm }: { vm: Vm }) {
  const total = vm.pdf?.total ?? 0;
  return (
    <>
      <h3>PDF em imagem</h3>
      <span className="hint">Formato</span>
      <Segmentado<'png' | 'jpg'> valor={vm.formato} onMudar={vm.setFormato} opcoes={[{ valor: 'png', rotulo: 'PNG' }, { valor: 'jpg', rotulo: 'JPG (menor)' }]} />
      <span className="hint">Resolução</span>
      <Segmentado<'normal' | 'alta'> valor={vm.resolucao} onMudar={vm.setResolucao} opcoes={[{ valor: 'normal', rotulo: 'Normal (144 dpi)' }, { valor: 'alta', rotulo: 'Alta (216 dpi)' }]} />
      <p className="hint">Passe o mouse na página para baixar só ela.</p>
      <Andamento vm={vm} />
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={vm.baixarTodasAsImagens}>
          <Icone nome="download" />{total > 1 ? 'Baixar todas (.zip)' : 'Baixar a imagem'}
        </BotaoAcao>
      </div>
    </>
  );
}

function TextoDoPdf({ vm }: { vm: Vm }) {
  if (vm.texto === null) return <Vazio icone="fileText" titulo="O texto aparece aqui" texto="Clique em Extrair o texto. Se o PDF for uma foto digitalizada, use Ler com OCR." />;
  if (vm.texto.trim() === '') {
    return (
      <Vazio icone="imagem" titulo={vm.textoDoOcr ? 'O OCR não achou texto' : 'Esse PDF não tem texto'} texto={vm.textoDoOcr ? 'A imagem pode estar muito clara ou borrada.' : 'Ele é uma foto digitalizada: o OCR consegue ler a imagem.'}>
        {!vm.textoDoOcr && <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} onClick={vm.lerComOcr}><Icone nome="search" />Ler com OCR</BotaoAcao>}
      </Vazio>
    );
  }
  return <textarea className="ferramentas-texto" readOnly value={vm.texto} aria-label="O texto do PDF" />;
}

function LadoDoTexto({ vm }: { vm: Vm }) {
  const tem = !!vm.texto && vm.texto.trim() !== '';
  return (
    <>
      <h3>PDF em texto</h3>
      <p className="hint">O OCR lê a imagem da página (para PDF digitalizado). Roda aqui no navegador e demora mais: confira o texto depois.</p>
      {vm.textoDoOcr && tem && <p className="ferramentas-alerta"><Icone nome="alert" />Texto lido pelo OCR: pode ter letra trocada.</p>}
      <Andamento vm={vm} />
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado && !vm.andamento} disabled={vm.ocupado} onClick={vm.gerarTexto}><Icone nome="fileText" />Extrair o texto</BotaoAcao>
        <BotaoAcao className="btn btn-outline" carregando={vm.ocupado && !!vm.andamento} disabled={vm.ocupado} onClick={vm.lerComOcr}><Icone nome="search" />Ler com OCR</BotaoAcao>
        {tem && <button type="button" className="btn btn-outline" onClick={vm.copiarTexto}><Icone nome="copiar" />Copiar</button>}
        {tem && <button type="button" className="btn btn-outline" onClick={vm.baixarTexto}><Icone nome="download" />Baixar .txt</button>}
      </div>
    </>
  );
}

// ─── as listas: Juntar e Imagem → PDF ───────────────────────────────────────────────────────────────────────────

/** A lista com a ordem arrastável: a alça, a miniatura, o nome, as páginas e o tamanho, as setas e o tirar. */
function ListaArrastavel({ lista }: { lista: Lista }) {
  return (
    <ol className="lista-arrastavel">
      {lista.itens.map((item: ItemDaLista, i) => (
        <li key={item.id} draggable className={lista.arrastando === i ? 'arrastando' : ''}
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); lista.setArrastando(i); }}
          onDragOver={e => { if (lista.arrastando !== null) e.preventDefault(); }}
          onDrop={e => { if (lista.arrastando !== null) { e.preventDefault(); lista.soltarEm(i); } }}
          onDragEnd={() => lista.setArrastando(null)}>
          <span className="lista-arrastavel-alca" aria-hidden="true"><Icone nome="arrastar" /></span>
          <span className="lista-arrastavel-ordem">{i + 1}</span>
          <span className="lista-arrastavel-mini">{item.miniatura ? <img src={item.miniatura} alt="" /> : <IconeDeArquivo formato="PDF" tamanho={24} />}</span>
          <span className="lista-arrastavel-nome">
            <b title={item.arquivo.name}>{item.arquivo.name}</b>
            <span className="hint">{item.tipo === 'imagem' ? 'imagem' : item.paginas === null ? 'contando as páginas…' : plural(item.paginas, 'página', 'páginas')} · {ferramentas.arquivos.tamanhoLegivel(item.arquivo.size)}</span>
          </span>
          <span className="lista-arrastavel-botoes">
            <BotaoIcone icone="arrowUp" titulo="Subir" pequeno disabled={i === 0} onClick={() => lista.mover(i, i - 1)} />
            <BotaoIcone icone="arrowDown" titulo="Descer" pequeno disabled={i === lista.itens.length - 1} onClick={() => lista.mover(i, i + 1)} />
            <BotaoIcone icone="x" titulo="Tirar da lista" pequeno onClick={() => lista.tirar(item.id)} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A área da lista: vazia, a área grande de soltar; com arquivos, a lista e a faixa de soltar mais. */
function areaDaLista({ lista, aceitar, titulo, dica, id }: { lista: Lista; aceitar: string; titulo: string; dica: string; id: string }) {
  const cabeca = (
    <>
      <h3>{lista.itens.length ? plural(lista.itens.length, 'arquivo', 'arquivos') + ' · arraste para mudar a ordem' : 'Nenhum arquivo ainda'}</h3>
      {lista.itens.length > 0 && (
        <span className="ferramentas-cabeca-botoes">
          <button type="button" className="btn btn-ghost" onClick={lista.limpar}>Limpar</button>
          <label className="btn btn-outline" htmlFor={id}><Icone nome="plus" />Adicionar</label>
          <input id={id} type="file" multiple accept={aceitar} className="sr-only" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; lista.adicionar(fs); }} />
        </span>
      )}
    </>
  );
  return {
    cabeca,
    principal: lista.itens.length === 0
      ? <SoltarArquivos aceitar={aceitar} multiplo titulo={titulo} dica={dica} onArquivos={lista.adicionar} />
      : (
        <SoltarArquivos aceitar={aceitar} multiplo onArquivos={lista.adicionar}>
          <ListaArrastavel lista={lista} />
          <p className="hint ferramentas-dica-grade">Solte mais arquivos em cima da lista para entrarem no fim.</p>
        </SoltarArquivos>
      ),
  };
}

function OpcaoDaPaginaDaImagem({ vm }: { vm: Vm }) {
  return (
    <>
      <span className="hint">Cada imagem vira uma página</span>
      <Segmentado<ferramentas.pdf.PaginaDaImagem> valor={vm.paginaDaImagem} onMudar={vm.setPaginaDaImagem} opcoes={[
        { valor: 'a4', rotulo: 'Folha A4' }, { valor: 'imagem', rotulo: 'Do tamanho da imagem' },
      ]} />
    </>
  );
}

function Juntar({ vm }: { vm: Vm }) {
  const l = vm.juntar;
  const area = areaDaLista({ lista: l, aceitar: '.pdf,' + ferramentas.imagens.ACEITA_IMAGENS, id: 'ferramentas-juntar', titulo: 'Arraste os PDFs e as imagens para cá', dica: 'PDF, JPG, PNG, WEBP, GIF ou BMP. ' + AVISO_LOCAL });
  const temImagem = l.itens.some(i => i.tipo === 'imagem');
  return (
    <Corpo cabeca={area.cabeca} principal={area.principal} lado={(
      <>
        <h3>Juntar num PDF só</h3>
        <ul className="ferramentas-resumo">
          <li><span>Arquivos</span><span>{l.itens.length}</span></li>
          <li><span>Páginas no total</span><span>{l.paginas}</span></li>
          <li><span>Tamanho somado</span><span>{l.itens.length ? ferramentas.arquivos.tamanhoLegivel(l.tamanho) : '—'}</span></li>
        </ul>
        {temImagem && <OpcaoDaPaginaDaImagem vm={vm} />}
        <div className="ferramentas-acoes">
          <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={l.itens.length < 2} onClick={vm.juntarEBaixar}><Icone nome="download" />Juntar e baixar</BotaoAcao>
          {l.itens.length === 1 && <p className="hint">Escolha mais um arquivo para juntar.</p>}
        </div>
      </>
    )} />
  );
}

function ImagemEmPdf({ vm }: { vm: Vm }) {
  const l = vm.fotos;
  const area = areaDaLista({ lista: l, aceitar: ferramentas.imagens.ACEITA_IMAGENS, id: 'ferramentas-fotos', titulo: 'Arraste as fotos e os prints para cá', dica: 'JPG, PNG, WEBP, GIF ou BMP. ' + AVISO_LOCAL });
  return (
    <Corpo cabeca={area.cabeca} principal={area.principal} lado={(
      <>
        <h3>Imagem em PDF</h3>
        <ul className="ferramentas-resumo">
          <li><span>Imagens (uma por página)</span><span>{l.itens.length}</span></li>
        </ul>
        <OpcaoDaPaginaDaImagem vm={vm} />
        <p className="hint">{vm.paginaDaImagem === 'a4' ? 'A imagem cabe inteira na folha, com margem; deitada se a imagem for deitada.' : 'A página fica do tamanho exato da imagem, sem margem.'}</p>
        <div className="ferramentas-acoes">
          <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!l.itens.length} onClick={vm.imagensEmPdf}><Icone nome="download" />Gerar o PDF</BotaoAcao>
        </div>
      </>
    )} />
  );
}

// ─── a planilha ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Planilha: xls, xlsx, ods ou csv viram csv ou xlsx. */
function Planilha({ vm }: { vm: Vm }) {
  const aceitar = '.xls,.xlsx,.ods,.csv';
  const lado = (
    <>
      <h3>Converter para</h3>
      <Segmentado<ferramentas.planilha.FormatoDeSaida> valor={vm.destino} onMudar={vm.setDestino} opcoes={[
        { valor: 'xlsx', rotulo: 'Excel (.xlsx)' },
        { valor: 'csv', rotulo: 'CSV (.csv)' },
      ]} />
      <p className="hint">{vm.destino === 'xlsx' ? 'Vão todas as abas da planilha.' : 'Só a primeira aba (o CSV não tem abas), com ponto e vírgula e acentos, como o Excel em português abre.'}</p>
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!vm.planilha} onClick={vm.converterPlanilhaEscolhida}><Icone nome="download" />Converter e baixar</BotaoAcao>
      </div>
    </>
  );
  if (!vm.planilha) {
    return (
      <Corpo cabeca={<h3>Escolha a planilha</h3>} lado={lado} principal={(
        <SoltarArquivos aceitar={aceitar} titulo="Arraste a planilha para cá" icone="grade" dica={'.xls, .xlsx, .ods ou .csv. ' + AVISO_LOCAL} onArquivos={vm.escolherPlanilha} />
      )} />
    );
  }
  return (
    <SoltarArquivos aceitar={aceitar} onArquivos={vm.escolherPlanilha}>
      <Corpo lado={lado}
        cabeca={<ArquivoEscolhido nome={vm.planilha.name} detalhe={ferramentas.arquivos.tamanhoLegivel(vm.planilha.size)} id="ferramentas-planilha" aceitar={aceitar} onTrocar={vm.escolherPlanilha} />}
        principal={<Vazio icone="grade" titulo="Pronta para converter" texto="Escolha o formato ao lado e clique em Converter e baixar. Para trocar, solte outra planilha aqui." />} />
    </SoltarArquivos>
  );
}
