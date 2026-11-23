// O botão "Importar no Alterdata" (06/11/2026), ao lado de cada Baixar do .xls de 10 colunas: pergunta antes (a empresa,
// quantos lançamentos e o nome do lote), manda a planilha ao robô do servidor e mostra, no lugar, o andamento (a mesma
// barra da página Alterdata da empresa) e o que o Alterdata respondeu. O último pedido de cada lugar fica lembrado neste
// navegador (a pessoa volta e vê se importou).
import { Icone, MenuSuspenso, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { roboDePcDoUsuario } from '../aplicativos/tarefas/dados/notasDoFiscal.firestore';
import { marcarPedidoFeito, useConexaoDoRobo } from '../aplicativos/tarefas/dados/useConexaoDoRobo';
import { acompanharImportacao, importarDesligado, MOTIVO_DESLIGADO, pedirImportacao, type ImportacaoNoAlterdata } from './importarNoAlterdata';
import { useBaixarParaOSci } from './useBaixarParaOSci';

export interface PropsImportarNoAlterdata {
  /** o código da empresa no Alterdata (sem ele, o botão fica desligado) */
  codigo: number | null;
  empresa: string;
  /** o nome do lote no Contábil (ex.: "nads Creditor 11/2025") */
  lote: string;
  /** de onde veio: creditor, honorarios, fgts, inss… */
  origem: string;
  /** a planilha (os mesmos bytes do Baixar) e quantos lançamentos ela tem; null = nada a importar */
  planilha: () => { bytes: Uint8Array; linhas: number } | null;
  disabled?: boolean;
  /** por que está desligado (vai no title) */
  motivo?: string;
  /** o nome de quem pede (vai no pedido) */
  quem?: string;
  /**
   * com o baixar, o botão vira um menu (Vitor, 18/11/2026: "clicando em baixar, vai aparecer a opcao, importar direto do alterdata
   * daqui ou baixar planilha (voce importa)"): as duas saídas da mesma planilha num botão só
   */
  baixar?: () => void;
}

const chave = (p: PropsImportarNoAlterdata) => 'importarAlterdata|' + p.origem + '|' + p.codigo + '|' + p.lote;
function lembrado(k: string): string { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function lembrar(k: string, id: string) { try { localStorage.setItem(k, id); } catch { /* sem armazenamento */ } }
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function BotaoImportarNoAlterdata(p: PropsImportarNoAlterdata) {
  const { modal, aviso } = useRetorno();
  const k = chave(p);
  const [id, setId] = useState(() => lembrado(k));
  const [estado, setEstado] = useState<ImportacaoNoAlterdata | null>(null);
  const [mandando, setMandando] = useState(false);
  // desligado para todos, menos para o dono do robô de PC (o botão Vitor)
  const IMPORTAR_DESLIGADO = importarDesligado();
  // o "Baixar para o SCI" (23/11/2026, docs/sci): só no modo desenvolvedor (novidade 'sci')
  const paraOSci = useBaixarParaOSci(p.empresa, p.origem, p.planilha);

  useEffect(() => { setId(lembrado(k)); setEstado(null); }, [k]);
  useEffect(() => {
    if (!id || IMPORTAR_DESLIGADO) return;
    return acompanharImportacao(id, setEstado, () => setEstado(null));
  }, [id, IMPORTAR_DESLIGADO]);

  const andando = !!estado && (estado.status === 'pendente' || estado.status === 'trabalhando');
  // 3 s sem o robô do PC conectar: cancela e o botão volta, com o erro (19/11/2026, "em todos os botoes vitor")
  const conexao = useConexaoDoRobo(estado && estado.id === id ? estado : null);
  const semCodigo = !p.codigo;
  const desligado = IMPORTAR_DESLIGADO || p.disabled || semCodigo || andando || mandando;
  const titulo = IMPORTAR_DESLIGADO ? MOTIVO_DESLIGADO : semCodigo ? 'A empresa não tem o código do Alterdata' : p.disabled ? p.motivo : andando ? 'O robô está importando' : (roboDePcDoUsuario() ? 'O robô do seu PC (' + roboDePcDoUsuario()!.rotulo + ') importa' : 'O robô do servidor importa') + ' estes lançamentos no Alterdata Contábil, no lote "IMPORTAÇÃO NADS"';

  async function importar() {
    const pl = p.planilha();
    if (!pl || !pl.linhas || !p.codigo) return;
    const ok = await modal<boolean>({
      icone: 'upload', titulo: 'Importar no Alterdata?',
      html: 'O robô vai importar <b>' + pl.linhas.toLocaleString('pt-BR') + (pl.linhas === 1 ? ' lançamento' : ' lançamentos') + '</b> na empresa <b>'
        + String(p.codigo) + '</b>, no lote <b>IMPORTAÇÃO NADS</b> (se não existir, o robô cria).',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Importar', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    setMandando(true);
    conexao.limpar();
    try {
      const novo = await pedirImportacao({ codigo: p.codigo, empresa: p.empresa, lote: p.lote, origem: p.origem, planilha: pl.bytes, linhas: pl.linhas }, p.quem || '');
      lembrar(k, novo);
      if (!novo.startsWith('exemplo-')) marcarPedidoFeito(novo);
      setEstado(null);
      setId(novo);
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não mandei ao robô', texto: (e as Error).message });
    } finally { setMandando(false); }
  }

  // desligado (18/11/2026: "remove importar direto do alterdata e deixa so baixar a planilha por enquanto"): some das telas; onde o
  // botão juntava as duas saídas, fica só o Baixar a planilha (as outras telas já têm o Baixar ao lado)
  if (IMPORTAR_DESLIGADO) {
    if (!p.baixar) {
      if (!paraOSci.ligado) return null;
      return (
        <button type="button" className="btn btn-secondary" disabled={p.disabled || paraOSci.ocupado} title={p.disabled ? p.motivo : 'A planilha que o SCI importa (modo desenvolvedor)'} onClick={paraOSci.baixar}>
          <Icone nome="download" width={16} height={16} />Baixar para o SCI
        </button>
      );
    }
    if (paraOSci.ligado) {
      const baixar = p.baixar;
      return (
        <MenuSuspenso rotulo={<><Icone nome="download" width={16} height={16} />Baixar a planilha</>} className="btn btn-secondary" flutuante direita largura={290}
          dica={p.disabled ? p.motivo : 'Para o Alterdata ou para o SCI'}
          conteudo={fechar => (
            <>
              <button type="button" className="popover-item" role="menuitem" disabled={p.disabled} title={p.disabled ? p.motivo : undefined} onClick={() => { fechar(); baixar(); }}>
                <Icone nome="download" /><span className="popover-texto"><b>Baixar a planilha</b><br /><span className="hint">Você importa no Alterdata</span></span>
              </button>
                {paraOSci.ligado && (
                  <button type="button" className="popover-item" role="menuitem" disabled={p.disabled || paraOSci.ocupado} title={p.disabled ? p.motivo : undefined} onClick={() => { fechar(); paraOSci.baixar(); }}>
                    <Icone nome="download" /><span className="popover-texto"><b>Baixar para o SCI</b><br /><span className="hint">A planilha que o SCI importa (modo desenvolvedor)</span></span>
                  </button>
                )}
            </>
          )} />
      );
    }
    return (
      <button type="button" className="btn btn-secondary" disabled={p.disabled} title={p.disabled ? p.motivo : 'Baixar a planilha para importar no Alterdata'} onClick={p.baixar}>
        <Icone nome="download" width={16} height={16} />Baixar a planilha
      </button>
    );
  }

  if (p.baixar) {
    const baixar = p.baixar;
    return (
      <span className="importar-alterdata">
        {mandando || andando ? (
          <button type="button" className="btn btn-secondary" disabled aria-busy="true"><span className="btn-spinner" />Importando no Alterdata</button>
        ) : (
          <MenuSuspenso rotulo={<><Icone nome="download" width={16} height={16} />Lançamentos</>} className="btn btn-secondary" flutuante direita largura={290}
            dica={p.disabled ? p.motivo : 'Importar no Alterdata daqui ou baixar a planilha'}
            conteudo={fechar => (
              <>
                <button type="button" className="popover-item" role="menuitem" disabled={desligado} title={titulo} onClick={() => { fechar(); void importar(); }}>
                  <Icone nome="upload" /><span className="popover-texto"><b>Importar direto no Alterdata</b><br /><span className="hint">{roboDePcDoUsuario() ? 'O robô do seu PC importa, no lote "IMPORTAÇÃO NADS"' : 'O robô importa daqui, no lote "IMPORTAÇÃO NADS"'}</span></span>
                </button>
                <button type="button" className="popover-item" role="menuitem" disabled={p.disabled} title={p.disabled ? p.motivo : undefined} onClick={() => { fechar(); baixar(); }}>
                  <Icone nome="download" /><span className="popover-texto"><b>Baixar a planilha</b><br /><span className="hint">Você importa no Alterdata</span></span>
                </button>
                {paraOSci.ligado && (
                  <button type="button" className="popover-item" role="menuitem" disabled={p.disabled || paraOSci.ocupado} title={p.disabled ? p.motivo : undefined} onClick={() => { fechar(); paraOSci.baixar(); }}>
                    <Icone nome="download" /><span className="popover-texto"><b>Baixar para o SCI</b><br /><span className="hint">A planilha que o SCI importa (modo desenvolvedor)</span></span>
                  </button>
                )}
              </>
            )} />
        )}
        {conexao.erro ? <span className="badge badge-warn" role="status">{conexao.erro}</span> : estado && <SituacaoDaImportacao e={estado} />}
      </span>
    );
  }

  return (
    <span className="importar-alterdata">
      <button type="button" className="btn btn-secondary" disabled={desligado} title={titulo} onClick={() => void importar()} aria-busy={mandando || andando || undefined}>
        {mandando || andando ? <span className="btn-spinner" /> : <Icone nome="upload" width={16} height={16} />}
        {estado?.status === 'pronto' || estado?.status === 'erro' ? 'Importar de novo no Alterdata' : 'Importar no Alterdata'}
      </button>
      {paraOSci.ligado && (
        <button type="button" className="btn btn-secondary" disabled={p.disabled || paraOSci.ocupado} title={p.disabled ? p.motivo : 'A planilha que o SCI importa (modo desenvolvedor)'} onClick={paraOSci.baixar}>
          <Icone nome="download" width={16} height={16} />Baixar para o SCI
        </button>
      )}
      {conexao.erro ? <span className="badge badge-warn" role="status">{conexao.erro}</span> : estado && <SituacaoDaImportacao e={estado} />}
    </span>
  );
}

function SituacaoDaImportacao({ e }: { e: ImportacaoNoAlterdata }) {
  // o robô do PC ainda não viu o pedido: a barra carregando (19/11/2026); visto, na fila
  if (e.status === 'pendente' && !e.recebido && roboDePcDoUsuario()) {
    return (
      <span className="importar-alterdata-andamento" role="status" aria-live="polite">
        <span className="imp-robo-barra conectando" style={{ width: 120 }}><span /></span>
        <span className="hint">Conectando ao robô de {roboDePcDoUsuario()!.rotulo}…</span>
      </span>
    );
  }
  if (e.status === 'pendente') return <span className="hint" role="status">Na fila do robô do Alterdata…</span>;
  if (e.status === 'trabalhando') {
    return (
      <span className="importar-alterdata-andamento" role="status" aria-live="polite">
        <span className="tarefas-barra fgts-barra andando"><span style={{ width: e.pct + '%' }} /></span>
        <span className="hint">{e.pct}% · {e.etapa && e.etapa !== 'começando' ? maiuscula(e.etapa) : 'Começando…'}{e.clique ? ' · clicando em: ' + e.clique : ''}</span>
      </span>
    );
  }
  if (e.status === 'pronto') {
    return <span className="badge badge-ok" role="status" title={e.resultado}><Icone nome="check" width={13} height={13} />{e.mesmoQue ? 'Já estava importada' : 'Importado no Alterdata'}</span>;
  }
  if (e.status === 'cancelado') return <span className="hint">Cancelado</span>;
  return <span className="badge badge-warn" role="status" title={e.erro}>Não importou: {e.erro.replace(/^o Alterdata não importou:\s*/i, '').slice(0, 160)}</span>;
}
