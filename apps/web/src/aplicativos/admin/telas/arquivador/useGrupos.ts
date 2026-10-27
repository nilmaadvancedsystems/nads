// ViewModel de Admin › Arquivador › Para resolver › Em grupos (Vitor, 23/10/2026: "temos que resolver também os que forem
// vindo para resolver"; a migração de ~320 mil arquivos pode deixar milhares em NÃO IDENTIFICADOS). Os não identificados
// da mesma causa e da mesma pasta de origem viram um grupo ("312 de 0010 - DORNAS…\DEPARTAMENTO FISCAL\DES - BH: tipo
// desconhecido"); com uma ação só o admin escolhe o cliente e o tipo do GRUPO inteiro — a competência sai do nome ou das
// pastas de cada arquivo, ou uma só para todos —, vê a prévia de 3 exemplos e arquiva. "Lembrar" faz a decisão virar regra
// do mapa da migração no PC do robô: os próximos da mesma pasta saem sozinhos. Tudo é pedido ao robô (pedidosArquivador).
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useArquivadorNovo } from '../../dados/repo';

type Grupo = entregas.GrupoParaResolver;
const ESPERA_DA_PREVIA_MS = 600;
const FINAIS = ['pronto', 'feito', 'erro'];

export function useGrupos(grupos: readonly Grupo[]) {
  const d = useArquivadorNovo();
  const { toast } = useRetorno();
  const [aberto, setAberto] = useState('');
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState<entregas.ClienteDoFormulario | null>(null);
  const [tipoDoc, setTipoDoc] = useState('');
  const [deCada, setDeCada] = useState(true);
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [previaId, setPreviaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  // os grupos já mandados (somem da lista quando o robô diz "feito")
  const [feitos, setFeitos] = useState<Record<string, string>>({});

  const g = grupos.find(x => x.id === aberto) || null;
  const cadastro = g ? d.cadastroDoFormulario() : null;
  const tipo = cadastro?.tipos.find(t => t.id === tipoDoc) || null;
  const competencia = deCada ? '' : tipo?.precisa === 'mes' ? mes : ano;
  const competenciaPronta = deCada || (tipo?.precisa === 'mes' ? /^\d{4}-\d{2}$/.test(mes) : /^\d{4}$/.test(ano));
  const pronto = !!g && !!cliente && !!tipo && tipo.id !== 'AUTO' && competenciaPronta;

  // a prévia dos exemplos: pede ao robô quando o formulário fica pronto
  const chave = pronto ? [g!.id, cliente!.codigo, tipoDoc, competencia].join('|') : '';
  useEffect(() => {
    if (!chave || !g) { setPreviaId(''); return; }
    const t = setTimeout(() => {
      d.pedir({ tipo: 'grupoPrevia', rel: g.pasta, hash: g.id, codigo: cliente!.codigo, tipoDoc, ...(competencia ? { competencia } : {}) })
        .then(setPreviaId, err => toast('Não consegui pedir a prévia do grupo: ' + (err instanceof Error ? err.message : String(err))));
    }, ESPERA_DA_PREVIA_MS);
    return () => clearTimeout(t);
    // a chave junta o que muda a prévia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const previa = previaId ? d.pedido(previaId) : null;

  // o que o robô respondeu aos grupos mandados
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    for (const pid of Object.values(feitos)) {
      const p = d.pedido(pid);
      if (!p || !FINAIS.includes(p.status) || avisados.current.has(pid)) continue;
      avisados.current.add(pid);
      const r = p.resposta;
      if (p.status === 'feito') toast('Grupo arquivado: ' + (r?.feitos ?? 0) + ' de ' + (r?.total ?? 0) + (r?.erros ? ' (' + r.erros + ' com erro: ' + (r.primeiroErro || '') + ')' : '') + (r?.lembrou ? '. A decisão foi lembrada para os próximos desta pasta.' : '.'));
      else toast('O grupo não foi arquivado: ' + (p.erro || 'erro sem detalhe'));
    }
  });
  const andamento = (gid: string) => {
    const p = feitos[gid] ? d.pedido(feitos[gid]) : null;
    if (!p) return '';
    return p.status === 'feito' ? 'feito' : p.status === 'erro' ? '' : 'Arquivando o grupo…';
  };

  function abrir(id: string) {
    const x = grupos.find(y => y.id === id);
    setAberto(id); setPreviaId(''); setCliente(null); setDeCada(true); setLembrar(true);
    const d0 = new Date();
    setMes(d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0')); setAno(String(d0.getFullYear()));
    setBusca(x?.sugestao?.codigo != null ? String(x.sugestao.codigo) : '');
    setTipoDoc(x?.sugestao?.tipoDoc || '');
  }
  const fechar = () => { setAberto(''); setPreviaId(''); };

  const sugeridos = cadastro && !cliente ? entregas.buscarClientesDoFormulario(cadastro.clientes, busca) : [];
  const exato = cadastro && !cliente ? cadastro.clientes.find(c => String(c.codigo) === busca.trim()) : undefined;
  useEffect(() => { if (exato) { setCliente(exato); setBusca(exato.codigo + ' · ' + exato.nome); } }, [exato]);
  const anos = Array.from({ length: new Date().getFullYear() - 2015 + 1 }, (_, i) => String(new Date().getFullYear() - i));

  const visiveis = grupos.filter(x => andamento(x.id) !== 'feito');
  return {
    grupos: visiveis,
    total: visiveis.reduce((s, x) => s + x.n, 0),
    andamento,
    aberto: g,
    abrir, fechar,
    formulario: g ? {
      lote: g.n, nomes: g.exemplos.map(x => x.nome),
      carregando: !cadastro?.carregado, semCadastro: !!cadastro?.carregado && !cadastro.clientes.length,
      busca, setBusca: (t: string) => { setBusca(t); setCliente(null); }, sugeridos, cliente,
      escolher: (c: entregas.ClienteDoFormulario) => { setCliente(c); setBusca(c.codigo + ' · ' + c.nome); },
      tipos: (cadastro?.tipos ?? []).filter(t => t.id !== 'AUTO'), tipoDoc, setTipoDoc,
      precisa: deCada ? null : tipo?.precisa ?? null, mes, setMes, ano, setAno, anos,
      grupo: { deCada, setDeCada: () => setDeCada(v => !v), lembrar, setLembrar: () => setLembrar(v => !v), podeEscolherCompetencia: !!tipo?.precisa },
      previa: previa ? {
        carregando: !FINAIS.includes(previa.status),
        erro: previa.status === 'erro' ? previa.erro || 'o robô não chegou a um destino' : '',
        destino: '', nomeFinal: '', pastaNova: '', jaArquivado: false, copias: [],
        exemplos: previa.resposta?.exemplos ?? [],
      } : pronto ? { carregando: true, erro: '', destino: '', nomeFinal: '', pastaNova: '', jaArquivado: false, copias: [], exemplos: [] } : null,
      enviando,
      podeConfirmar: pronto && !enviando && !!previa && previa.status === 'pronto',
      async confirmar() {
        if (!pronto || enviando || !g) return;
        setEnviando(true);
        try {
          const pid = await d.pedir({ tipo: 'grupo', rel: g.pasta, hash: g.id, codigo: cliente!.codigo, tipoDoc, ...(competencia ? { competencia } : {}), lembrar });
          setFeitos(f => ({ ...f, [g.id]: pid }));
          fechar();
        } catch (err) { toast('Não consegui mandar o grupo: ' + (err instanceof Error ? err.message : String(err))); }
        finally { setEnviando(false); }
      },
      fechar,
    } : null,
  };
}
