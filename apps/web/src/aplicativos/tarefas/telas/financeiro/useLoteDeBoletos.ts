// ViewModel de Financeiro › Boletos (10/11/2026): a competência, os PDFs que sobem (lidos no navegador, como no Contas a pagar), a
// conferência de cada linha, a revisão cliente a cliente e o disparo, que só um Diretor pede e que sempre pergunta antes.
import { empresas, financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { temNivelDiretor } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useBoletos, useHonorarios } from '../../dados/repo';
import type { BoletoNovo } from '../../dados/boletos';
import { dadosDaEmpresaNoEntregas, empresasNovas, repoDoCadastro } from '../../dados/fonte';
import { hoje } from './formatosDaNota';
import { textoDoPdf } from './useJanelaDaContaAPagar';

export type FiltroDoLote = 'todos' | 'pendentes' | 'prontos' | 'enviados';
export const FILTROS_DO_LOTE: { valor: FiltroDoLote; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' }, { valor: 'pendentes', rotulo: 'Pendentes' }, { valor: 'prontos', rotulo: 'Prontos' }, { valor: 'enviados', rotulo: 'Enviados' },
];
const NO_FILTRO: Record<Exclude<FiltroDoLote, 'todos'>, financeiro.SituacaoDoBoleto[]> = {
  pendentes: ['pendente', 'erro'], prontos: ['pronto', 'conferir'], enviados: ['fila', 'enviando', 'enviado'],
};
export const CLASSE_DA_SITUACAO: Record<financeiro.SituacaoDoBoleto, string> = {
  pronto: 'badge badge-ok', conferir: 'badge badge-warn', pendente: 'badge badge-bad', fora: 'badge badge-neutral', fila: 'badge badge-neutral', enviando: 'badge badge-warn', enviado: 'badge badge-ok', erro: 'badge badge-bad',
};
const MAX_ARQUIVOS = 150;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface LinhaDoLote {
  boleto: financeiro.BoletoDoLote;
  contrato: financeiro.ContratoDeHonorario | null;
  conferencia: financeiro.ConferenciaDoBoleto;
}

export function useLoteDeBoletos() {
  const repo = useBoletos();
  const honorarios = useHonorarios();
  const operador = useOperador().operador;
  const { toast, modal } = useRetorno();
  const dia = hoje();
  const [competencia, setCompetenciaBruta] = useState(() => financeiro.competenciaAnterior(dia));
  const [filtro, setFiltro] = useState<FiltroDoLote>('todos');
  const [busca, setBusca] = useState('');
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const [aberto, setAberto] = useState<string | null>(null);
  const [lendo, setLendo] = useState<{ feitos: number; total: number; gravando?: boolean } | null>(null);
  const [disparando, setDisparando] = useState(false);

  const boletos = repo.boletos(competencia);
  const contratos = honorarios.contratos();
  const recebimentos = honorarios.recebimentos();
  const todas = useMemo<LinhaDoLote[]>(() => {
    const ctx = { contratos: contratos.lista, recebimentos: recebimentos.lista, boletos: boletos.lista, hoje: dia };
    const codigo = (l: LinhaDoLote) => l.contrato?.codigo || '';
    return boletos.lista
      .map(b => ({ boleto: b, contrato: contratos.lista.find(c => c.id === b.contratoId) ?? null, conferencia: financeiro.conferirBoleto(b, ctx) }))
      .sort((a, b) => Number(!a.contrato) - Number(!b.contrato) || codigo(a).localeCompare(codigo(b), 'pt-BR', { numeric: true }) || a.boleto.arquivo.localeCompare(b.boleto.arquivo, 'pt-BR'));
  }, [boletos.lista, contratos.lista, recebimentos.lista, dia]);

  const q = norm(busca.trim());
  const linhas = todas.filter(l => (filtro === 'todos' || NO_FILTRO[filtro].includes(l.conferencia.situacao))
    && (!q || norm(`${l.contrato?.nome ?? ''} ${l.contrato?.codigo ?? ''} ${l.boleto.arquivo} ${l.boleto.destinatarios.join(' ')}`).includes(q)));
  const resumo = financeiro.resumoDoLote(todas);
  const disparaveis = todas.filter(l => l.conferencia.podeDisparar);
  const marcadasValidas = disparaveis.filter(l => marcadas.has(l.boleto.id));
  const marcaveis = linhas.filter(l => l.conferencia.podeDisparar);
  const podeDisparar = temNivelDiretor(operador);

  /** o cliente do escritório com um destes CNPJs/CPFs (o do Cadastro do nads, senão o do Entregas); só se der um */
  async function clienteDoDocumento(docs: string[]): Promise<{ empresa: empresas.EmpresaDoEscritorio; documento: string } | null> {
    const deFora = docs.filter(d => !d.startsWith(financeiro.CNPJ_RAIZ_DO_ESCRITORIO));
    if (!deFora.length) return null;
    const doEntregas = await dadosDaEmpresaNoEntregas();
    const cad = repoDoCadastro().todos().porId;
    const achados = new Map<number, { empresa: empresas.EmpresaDoEscritorio; documento: string }>();
    for (const e of [...empresas.EMPRESAS_COM_DP, ...empresasNovas()]) {
      if (e.codigo == null) continue;
      const doc = (cad.get(formatos.slug(e.nome))?.cnpj || doEntregas.get(e.codigo)?.documento || '').replace(/\D/g, '');
      if (doc && deFora.includes(doc)) achados.set(e.codigo, { empresa: e, documento: doc });
    }
    return achados.size === 1 ? [...achados.values()][0] : null;
  }
  const falhou = (e: unknown, o: string) => toast(o + ' ' + (e instanceof Error ? e.message : ''));

  return {
    carregando: !boletos.carregada || !contratos.carregada || !recebimentos.carregada,
    erro: boletos.erro || contratos.erro || recebimentos.erro,
    exemplos: repo.exemplos,
    competencia, filtro, setFiltro, busca, setBusca, linhas, resumo, lendo, disparando, podeDisparar,
    temLinhas: todas.length > 0,
    /** trocar de mês limpa as marcas: "Disparar marcadas" nunca pega o mês errado */
    setCompetencia(c: string) { setCompetenciaBruta(c); setMarcadas(new Set()); },
    limparFiltros() { setBusca(''); setFiltro('todos'); },
    clientes: contratos.lista.filter(c => c.ativo).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR', { numeric: true })),

    aberta: todas.find(l => l.boleto.id === aberto) ?? null,
    abrir: setAberto,
    fechar: () => setAberto(null),

    marcada: (id: string) => marcadas.has(id),
    alternar(id: string) { setMarcadas(m => { const n = new Set(m); if (!n.delete(id)) n.add(id); return n; }); },
    todasMarcadas: marcaveis.length > 0 && marcaveis.every(l => marcadas.has(l.boleto.id)),
    marcarTodas(sim: boolean) { setMarcadas(sim ? new Set(marcaveis.map(l => l.boleto.id)) : new Set()); },
    quantasMarcadas: marcadasValidas.length,
    quantasProntas: disparaveis.length,

    /** lê os PDFs escolhidos e põe no lote da competência; o que não der para ler entra como pendente */
    async subir(arquivos: File[]) {
      if (!arquivos.length || lendo) return;
      if (arquivos.length > MAX_ARQUIVOS) { toast(`No máximo ${MAX_ARQUIVOS} boletos de uma vez.`); return; }
      const novos: BoletoNovo[] = [];
      setLendo({ feitos: 0, total: arquivos.length });
      // os contratos desta subida: os de agora e os criados pelo CNPJ (dois boletos do mesmo cliente não criam dois)
      const lista = [...contratos.lista];
      let criados = 0;
      try {
        for (const [i, f] of arquivos.entries()) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const texto = await textoDoPdf(bytes);
          const leitura = texto ? financeiro.lerBoleto(texto, dia) : null;
          let achado = financeiro.acharContratoDoBoleto(texto, f.name, lista);
          if (!achado) {
            // sem contrato com o CNPJ do boleto (10/11/2026: "puxa pelo cnpj"): o cliente do escritório com ele; sem
            // contrato de honorários ainda, cria um, com o valor do boleto
            const e = await clienteDoDocumento(financeiro.documentosDoBoleto(texto));
            if (e) {
              const doc = e.documento;
              let c = lista.find(x => x.codigo === String(e.empresa.codigo));
              if (!c) {
                const novo = { clienteId: '', codigo: String(e.empresa.codigo), nome: e.empresa.nome, cnpj: doc, valor: leitura?.valor ?? 0, ativo: true };
                const id = await honorarios.salvarContrato(novo, operador?.nome || '');
                c = { ...novo, id, criadoEm: new Date().toISOString(), criadoPor: operador?.nome || '' };
                lista.push(c);
                criados++;
              }
              achado = { contratoId: c.id, achadoPor: 'documento' };
            }
          }
          const contrato = achado ? lista.find(c => c.id === achado.contratoId) : undefined;
          novos.push({
            bytes,
            competencia, arquivo: f.name, contratoId: achado?.contratoId ?? '', achadoPor: achado?.achadoPor ?? '',
            linha: leitura?.linha ?? '', valor: leitura?.valor ?? null, vencimento: leitura?.vencimento ?? null,
            destinatarios: contrato ? await repo.emailsDoContrato(contrato) : [],
          });
          setLendo({ feitos: i + 1, total: arquivos.length });
        }
        setLendo({ feitos: 0, total: novos.length, gravando: true });
        await repo.adicionar(novos, (feitos, total) => setLendo({ feitos, total, gravando: true }));
        const semCliente = novos.filter(n => !n.contratoId).length;
        toast(`${novos.length} ${novos.length === 1 ? 'boleto lido' : 'boletos lidos'}${semCliente ? `, ${semCliente} sem cliente` : ''}${criados ? `; ${criados} ${criados === 1 ? 'cliente entrou' : 'clientes entraram'} nos honorários pelo CNPJ` : ''}.`);
      } catch (e) { falhou(e, 'Não consegui ler os boletos.'); } finally { setLendo(null); }
    },

    async escolherCliente(id: string, contratoId: string) {
      const contrato = contratos.lista.find(c => c.id === contratoId);
      if (!contrato) return;
      try { await repo.alterar(id, { contratoId, achadoPor: 'mao', destinatarios: await repo.emailsDoContrato(contrato) }); } catch (e) { falhou(e, 'Não consegui trocar o cliente.'); }
    },
    async definirDestinatarios(id: string, texto: string) {
      try { await repo.alterar(id, { destinatarios: financeiro.separarEmails(texto) }); } catch (e) { falhou(e, 'Não consegui gravar o e-mail.'); }
    },
    async tirar(id: string, fora: boolean) {
      setMarcadas(m => { const n = new Set(m); n.delete(id); return n; });
      try { await repo.alterar(id, { fora }); } catch (e) { falhou(e, 'Não consegui mudar o lote.'); }
    },

    /** apaga o boleto e o PDF, depois de perguntar (só o que não saiu: as regras também conferem) */
    async excluir(l: LinhaDoLote) {
      const ok = await modal<boolean>({
        icone: 'lixeira', titulo: 'Excluir este boleto?',
        texto: `${l.boleto.arquivo}${l.contrato ? ' · ' + l.contrato.nome : ''}. O boleto e o PDF saem do lote; para mandar, suba o PDF de novo.`,
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return false;
      setMarcadas(m => { const n = new Set(m); n.delete(l.boleto.id); return n; });
      try { await repo.excluir(l.boleto.id); toast('Boleto excluído.'); return true; } catch (e) { falhou(e, 'Não consegui excluir o boleto.'); return false; }
    },

    /** abre o PDF do boleto numa aba nova */
    async verPdf(id: string) {
      const aba = window.open('', '_blank');
      try {
        const bytes = await repo.pdf(id);
        if (!bytes) { aba?.close(); toast('Este boleto não tem o PDF guardado.'); return; }
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
        if (aba) aba.location.href = url; else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) { aba?.close(); falhou(e, 'Não consegui abrir o PDF.'); }
    },

    /** dispara as marcadas ou, sem marca, todas as prontas: confere quem pode e sempre pergunta */
    async disparar() {
      if (!podeDisparar || disparando) return;
      const vao = marcadasValidas.length ? marcadasValidas : disparaveis;
      if (!vao.length) return;
      const soma = vao.reduce((t, l) => t + Math.round((l.boleto.valor ?? 0) * 100), 0) / 100;
      const n = vao.length;
      const ok = await modal<boolean>({
        icone: 'envelope', titulo: `Disparar ${n} ${n === 1 ? 'boleto' : 'boletos'}?`,
        texto: `${formatos.reais(soma)} em boletos de ${financeiro.competenciaBr(competencia)}. Cada cliente recebe o boleto dele no e-mail que está na linha.` + (repo.exemplos ? ' Estes são dados de exemplo: nenhum e-mail sai.' : ''),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Disparar', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return;
      setDisparando(true);
      try { await repo.disparar(vao.map(l => l.boleto)); setMarcadas(new Set()); }
      catch (e) { falhou(e, 'Não consegui disparar.'); } finally { setDisparando(false); }
    },
  };
}

export type VmLoteDeBoletos = ReturnType<typeof useLoteDeBoletos>;
