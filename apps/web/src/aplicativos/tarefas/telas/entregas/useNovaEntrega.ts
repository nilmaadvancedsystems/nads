// ViewModel da janela Nova entrega (16/10/2026, a entrega de documentos trazida do Entregas): para quem (o cliente do
// cadastro, buscado por código, nome ou CNPJ; ou um nome avulso; ou o banco onde pagar ou buscar), a competência, os
// documentos com o valor de cada um, o vencimento (preenchido sozinho pela regra do Entregas enquanto a pessoa não digita),
// a região da rota (a do cliente, se ele tem) e a foto ou o PDF da guia. "Adicionar à rota" grava a parada (status
// 'pendente'). Com "Adicionar outra", a janela fica aberta com os mesmos documentos e só o cliente muda (como o "Preparar
// rota" do Entregas, onde as mesmas guias se repetem de cliente em cliente).
import { entregas, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { imagemDoArquivo } from './imagemDaEntrega';

export type TipoDoDestino = entregas.ParaQuem['tipo'];
export const DESTINOS: { valor: TipoDoDestino; rotulo: string }[] = [
  { valor: 'cliente', rotulo: 'Cliente' },
  { valor: 'avulso', rotulo: 'Avulso' },
  { valor: 'banco', rotulo: 'Banco' },
];

/** Um documento na lista da janela (o valor como a pessoa digitou). */
export interface DocumentoNaJanela { id: number; tipo: string; semValor: boolean; valor: string; funcionario: string | null; livre: boolean }

const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
/** 'AAAA-MM-DD' ↔ 'dd/mm/aaaa' (o CampoData) */
const dataBr = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };

let seq = 0;

export function useNovaEntrega(fechar: () => void, clienteInicial?: entregas.ClienteDaRota | null) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const clientes = repo.clientes();
  const [destino, setDestino] = useState<TipoDoDestino>('cliente');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<entregas.ClienteDaRota | null>(clienteInicial || null);
  const [ativo, setAtivo] = useState(0);
  const [listaFechada, setListaFechada] = useState(false);
  const [nomeLivre, setNomeLivre] = useState('');
  const [competencia, setCompetencia] = useState(mesAtual());
  const [vencimento, setVencimentoBr] = useState('');
  /** a pessoa digitou o vencimento: a sugestão automática para de mexer nele */
  const [vencimentoDigitado, setVencimentoDigitado] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoNaJanela[]>([]);
  const [zona, setZona] = useState<string>(clienteInicial?.zona || '');
  const [imagem, setImagem] = useState<{ url: string; ehGuia: boolean; nome: string } | null>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [outra, setOutra] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [erros, setErros] = useState<string[]>([]);

  const achados = useMemo(() => {
    const q = busca.trim();
    if (!q) return [];
    return clientes.lista.filter(c => c.ativo && entregas.clienteCombina(c, q)).slice(0, 8);
  }, [busca, clientes.lista]);
  const listaVisivel = destino === 'cliente' && !escolhido && !listaFechada && achados.length > 0;

  const itens: entregas.ItemDaEntrega[] = documentos.filter(d => d.tipo.trim()).map(d => ({
    tipo: d.tipo.trim(),
    valor: d.semValor ? null : entregas.valorDigitado(d.valor),
    ...(d.funcionario !== null ? { funcionario: d.funcionario } : {}),
  }));
  const sugestao = entregas.vencimentoAutomatico(competencia, itens);
  const vencimentoNaTela = vencimentoDigitado ? vencimento : dataBr(sugestao || '');
  const total = entregas.totalDosItens(itens);
  const para = (): entregas.ParaQuem | null =>
    destino === 'cliente' ? (escolhido ? { tipo: 'cliente', cliente: escolhido } : null) : { tipo: destino, nome: nomeLivre };

  function escolher(c: entregas.ClienteDaRota) {
    setEscolhido(c);
    setBusca('');
    if (c.zona) setZona(c.zona);
    setErros([]);
  }

  return {
    exemplos: repo.exemplos,
    carregando: !clientes.carregada,
    destino,
    setDestino(d: TipoDoDestino) { setDestino(d); setErros([]); },
    busca, setBusca(v: string) { setBusca(v); setAtivo(0); setListaFechada(false); },
    escolhido, tirarCliente: () => setEscolhido(null),
    achados, listaVisivel, ativo, setAtivo,
    mover: (p: number) => setAtivo(a => Math.max(0, Math.min(achados.length - 1, a + p))),
    escolher,
    escolherDestacado() { const c = achados[ativo]; if (c) escolher(c); },
    fecharLista: () => setListaFechada(true),
    nomeLivre, setNomeLivre,
    competencia, setCompetencia,
    vencimento: vencimentoNaTela,
    vencimentoAutomatico: !vencimentoDigitado && !!sugestao,
    setVencimento(v: string) { setVencimentoBr(v); setVencimentoDigitado(true); },
    tipos: entregas.TIPOS_DE_DOCUMENTO,
    documentos,
    adicionar(t: entregas.TipoDeDocumento | null) {
      const id = ++seq;
      setDocumentos(l => [...l, { id, tipo: t ? t.rotulo : '', semValor: !!t?.semValor, valor: '', funcionario: t?.pedeFuncionario ? '' : null, livre: !t }]);
      setErros([]);
    },
    mudarDocumento(id: number, campo: 'tipo' | 'valor' | 'funcionario', v: string) {
      setDocumentos(l => l.map(d => (d.id === id ? { ...d, [campo]: v } : d)));
    },
    formatarValor(id: number) {
      setDocumentos(l => l.map(d => { if (d.id !== id) return d; const n = entregas.valorDigitado(d.valor); return { ...d, valor: n == null ? d.valor : formatos.brl(n) }; }));
    },
    tirarDocumento: (id: number) => setDocumentos(l => l.filter(d => d.id !== id)),
    total,
    zonas: entregas.ZONAS,
    zona, setZona, rotuloDaZona: entregas.rotuloDaZona(zona),
    imagem, lendoArquivo,
    async anexar(arquivos: File[]) {
      const a = arquivos[0];
      if (!a) return;
      setLendoArquivo(true);
      try {
        const r = await imagemDoArquivo(a);
        setImagem({ url: r.imagem, ehGuia: r.ehGuia, nome: a.name });
      } catch (e) {
        retorno.aviso({ tom: 'erro', titulo: 'Não consegui ler o arquivo', texto: (e as Error).message });
      } finally {
        setLendoArquivo(false);
      }
    },
    tirarImagem: () => setImagem(null),
    salvando, outra, setOutra, feitas,
    erros,
    async adicionarNaRota() {
      if (salvando) return;
      const p = para();
      const venc = vencimentoDigitado ? dataIso(vencimento) : sugestao || '';
      const nova = { para: p || { tipo: 'avulso' as const, nome: '' }, competencia, vencimento: venc, itens, zona };
      const faltas = entregas.faltasNaEntrega(nova);
      if (!p && !faltas.includes('o cliente')) faltas.unshift('o cliente');
      if (vencimentoDigitado && vencimento && !venc) faltas.push('o vencimento (dd/mm/aaaa)');
      if (faltas.length) { setErros(['Falta ' + faltas.join(', ') + '.']); return; }
      setSalvando(true);
      try {
        await repo.registrar({ ...nova, foto: imagem?.url || null, fotoEhGuia: !!imagem?.ehGuia });
        const nome = nova.para.tipo === 'cliente' ? entregas.rotuloDoCliente(nova.para.cliente) : nova.para.nome;
        if (outra) {
          // a próxima: os mesmos documentos e valores (como o "Preparar rota" do Entregas); o cliente e a guia saem
          setFeitas(n => n + 1);
          setEscolhido(null);
          setNomeLivre('');
          setImagem(null);
        } else {
          fechar();
        }
        retorno.aviso({ tom: 'ok', titulo: 'Na rota', texto: nome + ' — aguardando a assinatura.' });
      } catch (e) {
        setErros(['Não consegui pôr na rota: ' + (e as Error).message]);
      } finally {
        setSalvando(false);
      }
    },
  };
}
