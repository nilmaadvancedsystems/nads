// O botão "Importar no Alterdata" (06/11/2026), ao lado de cada Baixar do .xls de 10 colunas: pergunta antes (a empresa,
// quantos lançamentos e o nome do lote), manda a planilha ao robô do servidor e mostra, no lugar, o andamento (a mesma
// barra da página Alterdata da empresa) e o que o Alterdata respondeu. O último pedido de cada lugar fica lembrado neste
// navegador (a pessoa volta e vê se importou).
import { Icone, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { acompanharImportacao, pedirImportacao, type ImportacaoNoAlterdata } from './importarNoAlterdata';

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

  useEffect(() => { setId(lembrado(k)); setEstado(null); }, [k]);
  useEffect(() => {
    if (!id) return;
    return acompanharImportacao(id, setEstado, () => setEstado(null));
  }, [id]);

  const andando = !!estado && (estado.status === 'pendente' || estado.status === 'trabalhando');
  const semCodigo = !p.codigo;
  const desligado = p.disabled || semCodigo || andando || mandando;
  const titulo = semCodigo ? 'A empresa não tem o código do Alterdata' : p.disabled ? p.motivo : andando ? 'O robô está importando' : 'O robô do servidor importa estes lançamentos no Alterdata Contábil, num lote novo';

  async function importar() {
    const pl = p.planilha();
    if (!pl || !pl.linhas || !p.codigo) return;
    const ok = await modal<boolean>({
      icone: 'upload', titulo: 'Importar no Alterdata?',
      html: 'O robô vai importar <b>' + pl.linhas.toLocaleString('pt-BR') + (pl.linhas === 1 ? ' lançamento' : ' lançamentos') + '</b> na empresa <b>'
        + String(p.codigo) + '</b>, num lote novo: <b>' + escapar(p.lote) + '</b>.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Importar', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    setMandando(true);
    try {
      const novo = await pedirImportacao({ codigo: p.codigo, empresa: p.empresa, lote: p.lote, origem: p.origem, planilha: pl.bytes, linhas: pl.linhas }, p.quem || '');
      lembrar(k, novo);
      setEstado(null);
      setId(novo);
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não mandei ao robô', texto: (e as Error).message });
    } finally { setMandando(false); }
  }

  return (
    <span className="importar-alterdata">
      <button type="button" className="btn btn-secondary" disabled={desligado} title={titulo} onClick={() => void importar()} aria-busy={mandando || andando || undefined}>
        {mandando || andando ? <span className="btn-spinner" /> : <Icone nome="upload" width={16} height={16} />}
        {estado?.status === 'pronto' || estado?.status === 'erro' ? 'Importar de novo no Alterdata' : 'Importar no Alterdata'}
      </button>
      {estado && <SituacaoDaImportacao e={estado} />}
    </span>
  );
}

function SituacaoDaImportacao({ e }: { e: ImportacaoNoAlterdata }) {
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

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
