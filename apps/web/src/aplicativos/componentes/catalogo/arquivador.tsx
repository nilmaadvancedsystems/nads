// As peças do Arquivador do site do admin (Vitor, 22/10/2026: "se possível algo bem visual" e "quero uma só para ele e bem
// organizada"): o topo com o modo e a passada, as abas com o contador, o resumo do dia em palavras, o ranking com a marca e
// a lista com o detalhe ao lado. Desenhadas com as mesmas peças da página (admin/telas/arquivador/partes) e os dados de
// exemplo do repositório; entram no fim de cada tipo (os códigos das outras não mudam).
import { entregas } from '@nads/core';
import { Icone, formatoPeloNome } from '@nads/ui';
import { useState } from 'react';
import { painelDeExemplo } from '../../admin/dados/arquivadorNovo';
import { DetalheDoArquivo } from '../../admin/telas/arquivador/partes/DetalheDoArquivo';
import { ListaComDetalhe, type LinhaDaLista } from '../../admin/telas/arquivador/partes/ListaComDetalhe';
import { RankingComMarca } from '../../admin/telas/arquivador/partes/RankingComMarca';
import { TopoDoArquivador } from '../../admin/telas/arquivador/partes/TopoDoArquivador';
import type { Peca } from './tipos';

const TELA = ['a-arquivador'];

function linha(x: entregas.ItemDoArquivador): LinhaDaLista {
  const ni = x.acao === 'naoIdentificado' || x.acao === 'fica';
  return {
    id: x.id, nome: x.nome, formato: formatoPeloNome(x.nome), apoio: ni ? x.motivoTexto : (x.cliente + ' · ' + x.clienteNome + ' · ' + x.tipo),
    selo: ni ? { rotulo: entregas.ROTULO_DA_ACAO[x.acao], tom: 'aviso' } : { rotulo: entregas.grupoDoTipo(x.tipo).rotulo, tom: 'ok' },
    confianca: x.confianca != null ? x.confianca + '%' : '', tomConfianca: (x.confianca ?? 0) >= 95 ? 'ok' : (x.confianca ?? 0) >= 85 ? 'neutro' : 'aviso', hora: 'hoje, 14:3' + (x.id.length % 10),
  };
}

function DemoDaLista() {
  const p = painelDeExemplo();
  const itens = [...p.ultimos.slice(0, 4), ...p.pendentes.slice(1, 3)];
  const [aberto, setAberto] = useState(itens[2].id);
  const x = itens.find(i => i.id === aberto);
  return (
    <div className="card" style={{ width: '100%', margin: 0 }}>
      <ListaComDetalhe rotulo="Exemplo" linhas={itens.map(linha)} aberto={aberto} onAbrir={setAberto} onFechar={() => setAberto('')}
        detalhe={x ? <DetalheDoArquivo d={{
          nome: x.nome, formato: formatoPeloNome(x.nome), selo: { rotulo: entregas.ROTULO_DA_ACAO[x.acao], tom: x.acao === 'arquivou' ? 'ok' : 'aviso' }, quando: 'hoje, 14:32',
          dados: [{ rotulo: 'Cliente', valor: x.cliente + ' · ' + x.clienteNome }, { rotulo: 'Tipo', valor: x.tipo }, { rotulo: 'Confiança', valor: (x.confianca ?? 0) + '%' }, { rotulo: 'Destino', valor: x.destino || x.destinoSugerido }].filter(d => d.valor && d.valor !== ' · '),
          acao: x.sugestao ? { titulo: x.motivoTexto, texto: x.sugestao, tom: 'aviso' } : null, evidencias: x.evidencias, copias: x.copias, pastaNova: x.pastaNova,
        }} /> : null}
        vazio={null} />
    </div>
  );
}

export const PECAS_DO_ARQUIVADOR: Peca[] = [
  { id: 'arq-topo', tipo: 'cartoes', nome: 'Topo do Arquivador (modo, passada e ritmo)', descricao: 'Em Admin › Arquivador (22/10/2026): o modo num selo grande (Produção verde, Simulação âmbar, Desligado cinza), a situação de agora com o ponto colorido e o último sinal, os botões Arquivar agora e Parar à direita (no celular, embaixo, na largura toda); embaixo, a barra da passada ("1.240 de 17.158 arquivos decididos", a porcentagem grande em verde), a previsão de término e o ritmo. A barra só muda quando o dado muda (sem animação)', componente: 'TopoDoArquivador', classes: ['card arq-topo', 'arq-modo', 'arq-ponto', 'arq-progresso', 'tarefas-barra larga arq-progresso-barra'], telas: TELA, largo: true,
    uso: "<TopoDoArquivador t={{ modo, situacao, ultimoSinal, progresso, ritmo }} acoes={<>…botões…</>} />",
    demo: () => (
      <div style={{ width: '100%' }}>
        <TopoDoArquivador t={{ modo: { rotulo: 'Produção', tom: 'ok', texto: '' }, situacao: { tom: 'ok', titulo: 'Trabalhando', texto: '15.918 na fila agora.' }, ultimoSinal: 'Último sinal há 1 min',
          progresso: { texto: '1.240 de 17.158 arquivos decididos', pct: 7, previsao: 'Termina por volta das 21:40', inicio: 'Passada começou hoje, 13:05', terminou: false }, ritmo: '38,4 por minuto' }}
          acoes={<><button type="button" className="btn btn-danger"><Icone nome="x" width={16} height={16} />Parar</button><button type="button" className="btn btn-primary"><Icone nome="arquivo" width={16} height={16} />Arquivar agora</button></>} />
        <TopoDoArquivador t={{ modo: { rotulo: 'Simulação', tom: 'aviso', texto: '' }, situacao: { tom: 'aviso', titulo: 'Esperando', texto: 'A rotina antiga está rodando (_execucao.lock)' } }} />
      </div>
    ) },
  { id: 'arq-abas', tipo: 'abas', nome: 'Abas com contador (Arquivador)', descricao: 'As abas sublinhadas pelo ciclo do arquivo (como o Dext): Visão geral, Chegando, Para resolver, Arquivados e Erros, cada uma com o contador; o contador de quem pede atenção em âmbar; as abas secundárias (Comparação, Configuração) empurradas para a direita. No celular, a barra rola de lado', classes: ['menu arq-abas', 'menu-item', 'menu-contador', 'arq-contador-aviso', 'arq-abas-espaco'], telas: TELA, largo: true,
    demo: () => (
      <nav className="menu arq-abas" style={{ width: '100%' }}>
        {([['Visão geral', 'painel', '', false, true], ['Chegando', 'caixaEntrada', '15.920', false], ['Para resolver', 'alert', '9', true], ['Arquivados', 'checkCircle', '1.240', false], ['Erros', 'x', '3', true]] as const).map(([r, i, n, aviso, ativa]) => (
          <button key={r} type="button" className={'menu-item' + (ativa ? ' active' : '')}><Icone nome={i} width={16} height={16} /><span>{r}</span>{n && <span className={'menu-contador' + (aviso ? ' arq-contador-aviso' : '')}>{n}</span>}</button>
        ))}
        <span className="arq-abas-espaco" aria-hidden="true" />
        <button type="button" className="menu-item"><Icone nome="scale" width={16} height={16} /><span>Comparação</span></button>
        <button type="button" className="menu-item"><Icone nome="settings" width={16} height={16} /><span>Configuração</span></button>
      </nav>
    ) },
  { id: 'arq-resumo', tipo: 'cartoes', nome: 'Resumo do dia em palavras (Arquivador)', descricao: 'O que o robô fez hoje, em linguagem simples ("Hoje arquivei 312 arquivos de 41 clientes. 9 ficaram para você resolver (…). Criei 2 pastas novas: …"), com o balão carmim suave à esquerda; em simulação, no condicional. O texto vem de entregas.resumoDoDia', classes: ['card arq-resumo', 'arq-resumo-icone'], telas: TELA, largo: true,
    demo: () => (
      <div className="card arq-resumo" style={{ width: '100%', margin: 0 }}>
        <span className="arq-resumo-icone" aria-hidden="true"><Icone nome="mensagem" width={18} height={18} /></span>
        <p>{entregas.resumoDoDia(painelDeExemplo())}</p>
      </div>
    ) },
  { id: 'arq-ranking-marca', tipo: 'graficos', nome: 'Ranking com a marca', descricao: 'O Ranking com a logo do órgão (Simples, Receita, FGTS, Minas: as das guias), o ícone do arquivo (XML, TXT, XLS) ou um ícone do nads na frente de cada barra (20 px, a logo num quadradinho branco para não sumir no escuro); a barra proporcional à maior, verde (por tipo) ou carmim (por cliente). Sem a marca, é o Ranking de sempre', componente: 'RankingComMarca', classes: ['rank rank-com-marca', 'rank-marca', 'rank-marca logo', 'rank-marca icone', 'sem-marca'], telas: TELA, largo: true,
    uso: '<RankingComMarca barras={[{ chave, rotulo, n, pct, marca, formato, icone }]} tom="ok" />',
    demo: () => {
      const b = entregas.barrasPorTipo(painelDeExemplo().hoje.porTipo);
      const maior = Math.max(1, ...b.map(x => x.n));
      return <div style={{ width: '100%' }}><RankingComMarca barras={b.map(x => ({ chave: x.id, rotulo: x.rotulo, n: x.n, pct: Math.round((x.n / maior) * 100), marca: x.marca, formato: x.marca ? null : x.formato, icone: x.marca || x.formato ? null : x.icone as never }))} /></div>;
    } },
  { id: 'arq-lista-detalhe', tipo: 'listas', nome: 'Lista com o detalhe ao lado (Arquivador)', descricao: 'O dual-pane do Docupath (22/10/2026): à esquerda, uma linha por arquivo — o ícone do formato (32 px), o nome, o apoio (o cliente e o tipo, ou o motivo), o selo suave, a confiança (verde 95%+, âmbar abaixo de 85%) e a hora; clicar marca a linha em carmim suave e abre à direita o porquê: o que fazer (âmbar no não identificado, vermelho no erro), os dados em linhas, as evidências com o ✓, as cópias e a pasta nova. Abaixo de 1.100 px o detalhe abre por cima da tela inteira, com o Fechar', componente: 'ListaComDetalhe', classes: ['arq-duplo', 'arq-duplo-detalhe', 'arq-linhas', 'arq-linha', 'arq-linha ativa', 'arq-confianca', 'arq-detalhe', 'arq-fazer', 'arq-evidencias'], telas: TELA, largo: true,
    uso: '<ListaComDetalhe linhas={linhas} aberto={id} onAbrir={abrir} onFechar={fechar} detalhe={<DetalheDoArquivo d={…} />} vazio={<Vazio … />} rotulo="Arquivados" />',
    demo: () => <DemoDaLista /> },
];
