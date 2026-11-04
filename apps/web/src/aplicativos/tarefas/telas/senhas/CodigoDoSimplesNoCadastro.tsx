// O código de acesso do Simples à mostra na primeira aba da empresa no Cadastro (03/11/2026: "e para aparecer no cadastro
// como informação facil"; "Aberto, no resumo"): o código e o CPF do responsável abertos, cada um com o copiar, e o link do
// portal. Continua guardado no cofre: só aparece com o cofre aberto (quem não tem acesso não vê nada aqui), e só quando a
// empresa tem o código. Editar segue na aba "Código do Simples".
import { formatos } from '@nads/core';
import { BotaoIcone, ConfigLinha, ConfigSecao, Icone, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { empresaDaRota } from '../../../../comum/empresaDaRota';
import { useCofre } from './useCofre';

const cpfBr = (d: string) => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

export function CodigoDoSimplesNoCadastro({ rota, simples: doSimples }: { rota: string; simples: boolean }) {
  const cofre = useCofre();
  const { toast } = useRetorno();
  const e = empresaDaRota(rota);
  const nome = e?.nome || '';
  // fora do Simples, nada (04/11/2026): nem lê o cofre
  const aberto = cofre.estado === 'aberto' && doSimples;
  // a versão do documento da empresa no cofre: lê de novo quando alguém muda o código
  const doc = cofre.itens.get(nome ? formatos.slug(nome) : '');
  const versao = doc ? doc.versao + '|' + doc.atualizadoEm : '';
  const [simples, setSimples] = useState<{ nome: string; codigo: string; cpf: string } | null>(null);
  useEffect(() => {
    if (!aberto || !nome) return;
    let vale = true;
    void cofre.ler(nome).then(s => { if (vale) setSimples({ nome, codigo: s?.simples?.codigo || '', cpf: (s?.simples?.cpf || '').replace(/\D/g, '') }); }).catch(() => {});
    return () => { vale = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, nome, versao]);
  if (!aberto || !simples || simples.nome !== nome || !simples.codigo) return null;
  const copiar = (v: string) => { void navigator.clipboard.writeText(v).then(() => toast('Copiado.')); };
  return (
    <ConfigSecao titulo="Simples Nacional" acao={(
      <a className="btn btn-outline btn-sm" href="https://www8.receita.fazenda.gov.br/SimplesNacional/controleAcesso/Autentica.aspx?id=6" target="_blank" rel="noreferrer">
        <Icone nome="link" width={14} height={14} />Abrir o portal
      </a>
    )}>
      <ConfigLinha titulo="Código de acesso">
        <span className="cofre-senha"><b className="num">{simples.codigo}</b><BotaoIcone icone="copiar" titulo="Copiar o código de acesso" onClick={() => copiar(simples.codigo)} /></span>
      </ConfigLinha>
      {simples.cpf && (
        <ConfigLinha titulo="CPF do responsável">
          <span className="cofre-senha"><span className="num">{cpfBr(simples.cpf)}</span><BotaoIcone icone="copiar" titulo="Copiar o CPF" onClick={() => copiar(simples.cpf)} /></span>
        </ConfigLinha>
      )}
    </ConfigSecao>
  );
}
