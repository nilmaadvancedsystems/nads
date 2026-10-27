// ViewModel da Nova nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): o tomador (um cliente da
// lista do escritório, que traz o CPF/CNPJ, o e-mail e o telefone que o nads já tem, ou digitado à mão), o valor, a data do
// serviço e a descrição. Confere com o mesmo conferidor do robô antes de pedir. Também serve para "Corrigir e reenviar" uma
// recusada: abre preenchida e volta para a fila com o mesmo número de DPS.
import { empresas, formatos, nfse } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { contatosDoEntregas, dadosDaEmpresaNoEntregas, empresasNovas, repoDoCadastro } from '../../dados/fonte';
import { consultarCnpj } from '../../dados/receita';
import { useNfse } from '../../dados/repo';
import { dataBr, documentoFormatado, foneSoDigitos, hoje, isoDaData, previaDoIss, valorDigitado, valorNoCampo } from './formatosDaNota';

type Cliente = empresas.EmpresaDoEscritorio;

/**
 * Quando a nota nasce de outra tela (21/10/2026: o "Emitir NFS-e" dos Honorários): o cliente (pelo código do ERP, que
 * preenche o tomador como se tivesse sido escolhido na busca), o valor e a competência (AAAA-MM) do serviço.
 */
export interface NotaInicial { codigo: string; nome: string; cnpj: string; valor: number; competencia: string }

export function useNovaNota(fechar: () => void, nota?: nfse.NotaFiscal, inicial?: NotaInicial) {
  const repo = useNfse();
  const { toast } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const cfg = repo.config();
  const config = cfg.config ?? nfse.CONFIG_PADRAO;
  const faltas = cfg.carregada ? nfse.faltasNaConfig(cfg.config, !!cfg.tokenGravadoEm) : ['a configuração do emissor'];

  const lista: readonly Cliente[] = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()];
  const [busca, setBusca] = useState('');
  // a lista de sugestões da busca do cliente: a linha destacada (setas) e se está aberta (Esc fecha)
  const [ativo, setAtivo] = useState(0);
  const [listaAberta, setListaAberta] = useState(true);
  // o CNPJ de cada cliente do Entregas, por código (lido uma vez); o do cadastro do nads vale primeiro
  const [docsDoEntregas, setDocsDoEntregas] = useState<ReadonlyMap<number, string>>(new Map());
  useEffect(() => {
    let vale = true;
    void dadosDaEmpresaNoEntregas().then(m => { if (vale) setDocsDoEntregas(new Map([...m].map(([c, d]) => [c, d.documento]))); });
    return () => { vale = false; };
  }, []);
  const [escolhido, setEscolhido] = useState<Cliente | null>(() => (nota?.empresaCodigo != null ? lista.find(e => e.codigo === nota.empresaCodigo) || null : null));
  // o tomador que veio pronto: se o cliente não está na lista, ao menos o nome e o CNPJ do contrato
  const [lendoCliente, setLendoCliente] = useState(false);
  const [nome, setNome] = useState(nota?.tomador.nome || inicial?.nome || '');
  const [documento, setDocumento] = useState(nota ? documentoFormatado(nota.tomador.documento) : inicial ? documentoFormatado(inicial.cnpj) : '');
  const [email, setEmail] = useState(nota?.tomador.email || '');
  const [fone, setFone] = useState(nota?.tomador.fone || '');
  const [valor, setValor] = useState(nota ? valorNoCampo(nota.servico.valor) : inicial ? valorNoCampo(inicial.valor) : '');
  // a data do serviço dos Honorários é o último dia da competência; a descrição sai do modelo das Configurações (23/10/2026),
  // com a competência dos Honorários ou a do mês anterior ao de hoje (sem modelo: "Serviços Contábeis Ref. 09/2026")
  const [data, setData] = useState(dataBr(nota?.servico.competencia || (inicial ? nfse.competenciaDaNota(inicial.competencia) : '') || hoje()));
  const descricaoMontada = nfse.descricaoDaNota(config.descricao, inicial?.competencia || nfse.competenciaAnterior(hoje()));
  const [descricao, setDescricaoBruta] = useState(nota?.servico.descricao || descricaoMontada);
  // a configuração pode chegar depois de a janela abrir: enquanto ninguém mexeu na descrição, ela segue o modelo
  const descricaoMexida = useRef(!!nota?.servico.descricao);
  const setDescricao = (v: string) => { descricaoMexida.current = true; setDescricaoBruta(v); };
  useEffect(() => { if (!descricaoMexida.current) setDescricaoBruta(descricaoMontada); }, [descricaoMontada]);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // a escolha mais nova vale: se trocar de cliente antes de a leitura do anterior chegar, a antiga é descartada
  const leitura = useRef(0);

  // o endereço do tomador (16/10/2026: a prefeitura recusou a primeira nota real, E1358: "o endereço nacional do tomador do
  // serviço deve ser informado na DPS quando o tomador for identificado pelo CNPJ"): com CNPJ, a Receita preenche; com CPF é opcional
  const e0 = nota?.tomador.endereco;
  const [cep, setCep] = useState(e0?.cep || '');
  const [rua, setRua] = useState(e0?.logradouro || '');
  const [numero, setNumero] = useState(e0?.numero || '');
  const [bairro, setBairro] = useState(e0?.bairro || '');
  const [cMun, setCMun] = useState(e0?.cMun || '');
  /** o nome e a UF do município, quando a Receita deu */
  const [municipio, setMunicipio] = useState('');
  const [comEndereco, setComEndereco] = useState(false);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [erroDoEndereco, setErroDoEndereco] = useState('');
  // o CNPJ cujo endereço já foi buscado (uma vez por CNPJ); a nota que já tem endereço não precisa buscar
  const buscado = useRef(e0 && nota ? nfse.soDigitos(nota.tomador.documento) : '');
  const buscaDoEndereco = useRef(0);

  async function buscarEndereco(cnpj: string) {
    if (buscado.current === cnpj) return;
    buscado.current = cnpj;
    const minha = ++buscaDoEndereco.current;
    setBuscandoEndereco(true);
    setErroDoEndereco('');
    try {
      const d = await consultarCnpj(cnpj);
      if (minha !== buscaDoEndereco.current) return;
      if (!d.endereco) { setErroDoEndereco('A Receita não trouxe o endereço completo: preencha abaixo.'); return; }
      setCep(d.endereco.cep); setRua(d.endereco.logradouro); setNumero(d.endereco.numero); setBairro(d.endereco.bairro); setCMun(d.endereco.cMun);
      setMunicipio([d.municipio, d.uf].filter(Boolean).join('/'));
    } catch (err) {
      if (minha !== buscaDoEndereco.current) return;
      buscado.current = '';   // sair do campo de novo busca outra vez
      setErroDoEndereco((err instanceof Error ? err.message : String(err)) + ' Preencha o endereço abaixo.');
    } finally {
      if (minha === buscaDoEndereco.current) setBuscandoEndereco(false);
    }
  }
  /** o CPF/CNPJ mudou: CNPJ de 14 dígitos que confere busca o endereço */
  function aoMudarDocumento(v: string) {
    const d = nfse.soDigitos(v);
    if (d.length === 14 && nfse.documentoValido(d)) void buscarEndereco(d);
  }
  // corrigir uma recusada de CNPJ que não tem endereço: busca na Receita, como ao criar
  useEffect(() => {
    if (nota && !nota.tomador.endereco) aoMudarDocumento(nota.tomador.documento);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = formatos.nomeNorm(busca);
  const digitado = busca.trim();
  // o código exato digitado vem primeiro, depois os que começam com ele, depois os que só contêm (nome ou código)
  const peso = (e: Cliente) => (e.codigo != null && String(e.codigo) === digitado ? 0 : e.codigo != null && digitado && String(e.codigo).startsWith(digitado) ? 1 : 2);
  const cadastrosDoNads = repoDoCadastro().todos().porId;
  const achados = (q
    ? lista.filter(e => formatos.nomeNorm(e.nome + ' ' + (e.codigo ?? '')).includes(q)).map((e, i) => ({ e, i })).sort((a, b) => peso(a.e) - peso(b.e) || a.i - b.i).slice(0, 8)
        .map(({ e }) => ({ empresa: e, documento: documentoFormatado(cadastrosDoNads.get(formatos.slug(e.nome))?.cnpj || (e.codigo != null ? docsDoEntregas.get(e.codigo) : '') || '') }))
    : []);
  const mudarBusca = (v: string) => { setBusca(v); setAtivo(0); setListaAberta(true); };

  async function escolher(e: Cliente) {
    const minha = ++leitura.current;
    setEscolhido(e);
    setBusca('');
    setAtivo(0);
    setNome(e.nome);
    setLendoCliente(true);
    try {
      const [doEntregas, contatos, cad] = await Promise.all([dadosDaEmpresaNoEntregas(), contatosDoEntregas(), repoDoCadastro().obter(e.nome, e.codigo)]);
      if (minha !== leitura.current) return;
      const d = e.codigo != null ? doEntregas.get(e.codigo) : undefined;
      const c = e.codigo != null ? contatos.get(e.codigo) : undefined;
      setNome(d?.receita?.razaoSocial || e.nome);
      const doc = cad.cnpj || d?.documento || (inicial && String(e.codigo) === inicial.codigo ? inicial.cnpj : '');
      setDocumento(documentoFormatado(doc));
      aoMudarDocumento(doc);
      setEmail(cad.contato?.email || c?.email || '');
      setFone(foneSoDigitos(cad.contato?.whatsapp || c?.whatsapp || ''));
    } finally {
      if (minha === leitura.current) setLendoCliente(false);
    }
  }

  // o cliente que veio pronto é escolhido como na busca: preenche o CNPJ, o e-mail, o telefone e busca o endereço
  useEffect(() => {
    const cliente = inicial ? lista.find(e => String(e.codigo) === inicial.codigo) : undefined;
    if (cliente) void escolher(cliente);
    else if (inicial) aoMudarDocumento(inicial.cnpj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tirarCliente() {
    leitura.current++;
    setEscolhido(null);
    setLendoCliente(false);
  }

  const valorNumero = valorDigitado(valor);
  const previa = previaDoIss(valorNumero, config);

  function pedido(): { tomador: nfse.TomadorNfse; servico: nfse.ServicoNfse; empresaCodigo: number | null } {
    const tomador: nfse.TomadorNfse = { documento: nfse.soDigitos(documento), nome: nome.trim() };
    if (email.trim()) tomador.email = email.trim();
    if (nfse.soDigitos(fone)) tomador.fone = nfse.soDigitos(fone);
    // sem nada preenchido, o endereço não vai (o conferidor pede quando o tomador é CNPJ)
    if ([cep, rua, numero, bairro, cMun].some(x => x.trim())) tomador.endereco = { cMun: cMun.trim(), cep: nfse.soDigitos(cep), logradouro: rua.trim(), numero: numero.trim(), bairro: bairro.trim() };
    return { tomador, servico: { descricao: descricao.trim(), valor: valorNumero, competencia: isoDaData(data) }, empresaCodigo: escolhido?.codigo ?? null };
  }

  async function emitir() {
    if (salvando || faltas.length) return;
    const p = pedido();
    const problemas = nfse.conferirPedido(p);
    setErros(problemas);
    if (problemas.length) return;
    setSalvando(true);
    try {
      if (nota) await repo.reenviar(nota.id, p);
      else await repo.pedir(p, por);
      toast(nota ? 'Nota corrigida: voltou para a fila.' : 'Nota pedida: o robô emite em instantes.');
      fechar();
    } catch (err) {
      setErros([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSalvando(false);
    }
  }

  const ehCnpj = nfse.soDigitos(documento).length === 14;
  const temEndereco = [cep, rua, numero, bairro, cMun].some(x => x.trim());

  return {
    corrigindo: !!nota, ambiente: config.ambiente,
    faltas, busca, setBusca: mudarBusca, achados, ativo, setAtivo,
    /** a lista só aparece com busca, e some com o Esc */
    listaVisivel: listaAberta && achados.length > 0,
    fecharLista: () => setListaAberta(false),
    mover: (passo: 1 | -1) => setAtivo(a => (achados.length ? (a + passo + achados.length) % achados.length : 0)),
    escolherDestacado: () => { const c = achados[ativo]; if (c) void escolher(c.empresa); }, escolhido, escolher, tirarCliente, lendoCliente,
    nome, setNome, documento, setDocumento, email, setEmail, fone, setFone,
    valor, setValor, data, setData, descricao, setDescricao,
    // CNPJ: o endereço é obrigatório e sempre aparece; CPF: opcional, atrás do "Adicionar endereço"
    endereco: { cep, setCep, rua, setRua, numero, setNumero, bairro, setBairro, cMun, setCMun, municipio, buscando: buscandoEndereco, erro: erroDoEndereco,
      visivel: ehCnpj || comEndereco || temEndereco, obrigatorio: ehCnpj, adicionar: () => setComEndereco(true) },
    /** o CNPJ digitado confere: busca o endereço ao sair do campo */
    aoSairDoDocumento: () => aoMudarDocumento(documento),
    previa, erros, salvando, emitir,
    /** ao sair do campo: o CPF/CNPJ com os pontos, o valor com os centavos */
    formatarDocumento: () => setDocumento(d => documentoFormatado(d)),
    formatarValor: () => setValor(v => (valorDigitado(v) > 0 ? valorNoCampo(valorDigitado(v)) : v)),
  };
}
