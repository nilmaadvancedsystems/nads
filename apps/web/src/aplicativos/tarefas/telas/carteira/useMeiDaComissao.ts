// O MEI na comissão (Vitor, 19/11/2026: "O servico sendo abertura de mei, disponibilize um botao para eu upar o cartao cnpj, para
// registro no sistema, porte MEI e senha gov desse MEI atualmente, que voce tambem vai colocar la, usando o nome avulso que eu
// coloquei (senha gov, um botao de adicionar senha gov, se ja tiver registrada, coloca atualizar senha gov, se quiser)";
// "Alteracao mei tambem"). O cartão CNPJ é lido aqui no navegador (não é guardado) e já registra a empresa no Cadastro com o
// regime MEI. A senha gov vai para o cofre (Senhas › Contas gov.br), com o nome do cliente; já tendo, o botão vira Atualizar.
import { empresas, extrator, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { empresasNovas } from '../../dados/fonte';
import { useGravarCadastro } from '../../dados/repo';
import { useCofre } from '../senhas/useCofre';

extrator.definirWorkerDoPdf(workerDoPdf);

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Abertura de MEI, Alteração de MEI: a comissão ganha o cartão CNPJ e a senha gov */
export const ehServicoDeMei = (servico: string): boolean => /\bmei\b/i.test(servico) && /abertura|alteracao/i.test(semAcento(servico));

export function useMeiDaComissao(nome: string) {
  const cofre = useCofre();
  const gravar = useGravarCadastro();
  const por = useOperador().operador?.nome || '';
  const { toast } = useRetorno();
  const [cartao, setCartao] = useState<empresas.cadastro.DadosDaReceita | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  // o registro no Cadastro, logo ao upar o cartão (Vitor, 19/11/2026: "Upou? ja registra no sistema direto, so aparece o botao do x")
  const [registro, setRegistro] = useState<'' | 'registrando' | 'registrada' | 'ja'>('');
  const [senha, setSenha] = useState<{ cpf: string; senha: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nomeDoCliente = nome.trim().toUpperCase();
  // o MEI tem o CPF do dono no fim do nome empresarial ("FULANO DE TAL 12345678900")
  const cpfDoCartao = cartao ? (cartao.razaoSocial.match(/(\d{11})\s*$/) || [])[1] || '' : '';
  const nomeDaEmpresa = cartao ? cartao.razaoSocial.trim().toUpperCase() : '';
  const cnpj = cartao ? empresas.cadastro.cnpjFormatado(cartao.cnpj) : '';
  const noSistema = (n: string) => [...empresas.EMPRESAS_COM_DP, ...empresasNovas()]
    .some(e => formatos.slug(e.nome) === formatos.slug(n) || formatos.slug(empresas.nomeParaMostrar(e)) === formatos.slug(n));
  // a senha gov já guardada com o nome do cliente (ou com o CPF do cartão)
  const existente = nomeDoCliente ? cofre.contasGov.find(x => formatos.slug(x.nome) === formatos.slug(nomeDoCliente)) || null : null;

  return {
    cartao, cnpj, nomeDaEmpresa, lendo, erro, registro,
    /** lê o cartão CNPJ em PDF (nada sobe) */
    async lerCartao(f: File | null) {
      if (!f || lendo) return;
      setLendo(true); setErro(''); setRegistro('');
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (!extrator.ehPdf(bytes)) throw new Error('Esse arquivo não é um PDF. Use o cartão CNPJ (comprovante de inscrição) em PDF.');
        const paginas = t.linhasDasPaginas(await extrator.itensDoPdf(bytes));
        const d = empresas.cadastro.lerCartaoCnpj(paginas.map(l => l.join('\n')).join('\n'));
        if (!d) throw new Error('Não reconheci o cartão CNPJ nesse PDF. Use o "Comprovante de Inscrição e de Situação Cadastral" da Receita.');
        setCartao(d);
        // já registra no Cadastro, com o regime MEI e o CNPJ do cartão (o que já está no sistema fica como está)
        const n = d.razaoSocial.trim().toUpperCase();
        if (noSistema(n)) { setRegistro('ja'); return; }
        setRegistro('registrando');
        try {
          await gravar(n, null, () => empresas.cadastro.cadastrarEmpresa(n, null, 'MEI', por, new Date(), d.cnpj));
          setRegistro('registrada');
          toast(n + ' registrada no Cadastro como MEI.');
        } catch (e) { setRegistro(''); setErro('Não consegui registrar no sistema: ' + (e instanceof Error ? e.message : String(e))); }
      } catch (e) {
        setCartao(null);
        setErro(e instanceof Error ? e.message : String(e));
      } finally { setLendo(false); }
    },
    tirarCartao: () => { setCartao(null); setErro(''); setRegistro(''); },
    /** já tem a senha gov no cofre: o botão é Atualizar */
    temSenha: !!existente,
    senha, setSenha,
    abrirSenha: () => {
      if (cofre.bloqueio) { toast(cofre.bloqueio); return; }
      setSenha({ cpf: cpfDoCartao, senha: '' });
    },
    fecharSenha: () => setSenha(null),
    guardando,
    /** o que falta para guardar ('' = pode) */
    faltaNaSenha: !senha ? '' : !nomeDoCliente ? 'Falta o nome do cliente' : !existente && senha.cpf.length !== 11 ? 'O CPF tem 11 dígitos' : !senha.senha ? 'Falta a senha' : '',
    async guardarSenha() {
      if (!senha || guardando) return;
      setGuardando(true);
      try {
        if (existente) {
          const atual = await cofre.lerPorId(existente.id);
          await cofre.salvarConta(existente.id, { ...(atual?.gov || { login: senha.cpf }), senha: senha.senha });
        } else {
          const n = await cofre.importarContasGov([{ nome: nomeDoCliente, cpf: senha.cpf, senha: senha.senha, obs: 'MEI' + (cnpj ? ' · CNPJ ' + cnpj : ''), nivel: '' }]);
          if (n) toast('Senha gov guardada no cofre.');
        }
        setSenha(null);
      } catch (e) { toast('Não consegui guardar: ' + (e instanceof Error ? e.message : String(e))); } finally { setGuardando(false); }
    },
  };
}
