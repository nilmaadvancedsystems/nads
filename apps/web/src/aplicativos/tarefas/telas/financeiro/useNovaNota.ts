// ViewModel da Nova nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): o tomador (um cliente da
// lista do escritório, que traz o CPF/CNPJ, o e-mail e o telefone que o nads já tem, ou digitado à mão), o valor, a data do
// serviço e a descrição. Confere com o mesmo conferidor do robô antes de pedir. Também serve para "Corrigir e reenviar" uma
// recusada: abre preenchida e volta para a fila com o mesmo número de DPS.
import { empresas, formatos, nfse } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useRef, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { contatosDoEntregas, dadosDaEmpresaNoEntregas, empresasNovas, repoDoCadastro } from '../../dados/fonte';
import { useNfse } from '../../dados/repo';
import { dataBr, descricaoPadrao, documentoFormatado, foneSoDigitos, hoje, isoDaData, previaDoIss, valorDigitado, valorNoCampo } from './formatosDaNota';

type Cliente = empresas.EmpresaDoEscritorio;

export function useNovaNota(fechar: () => void, nota?: nfse.NotaFiscal) {
  const repo = useNfse();
  const { toast } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const cfg = repo.config();
  const config = cfg.config ?? nfse.CONFIG_PADRAO;
  const faltas = cfg.carregada ? nfse.faltasNaConfig(cfg.config, !!cfg.tokenGravadoEm) : ['a configuração do emissor'];

  const lista: readonly Cliente[] = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()];
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<Cliente | null>(() => (nota?.empresaCodigo != null ? lista.find(e => e.codigo === nota.empresaCodigo) || null : null));
  const [lendoCliente, setLendoCliente] = useState(false);
  const [nome, setNome] = useState(nota?.tomador.nome || '');
  const [documento, setDocumento] = useState(nota ? documentoFormatado(nota.tomador.documento) : '');
  const [email, setEmail] = useState(nota?.tomador.email || '');
  const [fone, setFone] = useState(nota?.tomador.fone || '');
  const [valor, setValor] = useState(nota ? valorNoCampo(nota.servico.valor) : '');
  const [data, setData] = useState(dataBr(nota?.servico.competencia || hoje()));
  const [descricao, setDescricao] = useState(nota?.servico.descricao || descricaoPadrao());
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // a escolha mais nova vale: se trocar de cliente antes de a leitura do anterior chegar, a antiga é descartada
  const leitura = useRef(0);

  const q = formatos.nomeNorm(busca);
  const achados = q ? lista.filter(e => formatos.nomeNorm(e.nome + ' ' + (e.codigo ?? '')).includes(q)).slice(0, 6) : [];

  async function escolher(e: Cliente) {
    const minha = ++leitura.current;
    setEscolhido(e);
    setBusca('');
    setNome(e.nome);
    setLendoCliente(true);
    try {
      const [doEntregas, contatos, cad] = await Promise.all([dadosDaEmpresaNoEntregas(), contatosDoEntregas(), repoDoCadastro().obter(e.nome, e.codigo)]);
      if (minha !== leitura.current) return;
      const d = e.codigo != null ? doEntregas.get(e.codigo) : undefined;
      const c = e.codigo != null ? contatos.get(e.codigo) : undefined;
      setNome(d?.receita?.razaoSocial || e.nome);
      setDocumento(documentoFormatado(cad.cnpj || d?.documento || ''));
      setEmail(cad.contato?.email || c?.email || '');
      setFone(foneSoDigitos(cad.contato?.whatsapp || c?.whatsapp || ''));
    } finally {
      if (minha === leitura.current) setLendoCliente(false);
    }
  }

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
    // o endereço da nota recusada segue como estava (esta janela não edita o endereço)
    if (nota?.tomador.endereco) tomador.endereco = nota.tomador.endereco;
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

  return {
    corrigindo: !!nota, ambiente: config.ambiente,
    faltas, busca, setBusca, achados, escolhido, escolher, tirarCliente, lendoCliente,
    nome, setNome, documento, setDocumento, email, setEmail, fone, setFone,
    valor, setValor, data, setData, descricao, setDescricao,
    previa, erros, salvando, emitir,
    /** ao sair do campo: o CPF/CNPJ com os pontos, o valor com os centavos */
    formatarDocumento: () => setDocumento(d => documentoFormatado(d)),
    formatarValor: () => setValor(v => (valorDigitado(v) > 0 ? valorNoCampo(valorDigitado(v)) : v)),
  };
}
