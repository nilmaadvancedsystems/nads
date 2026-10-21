# robo/ — o robô do escritório

Movido do repositório do Entregas (pasta `scripts/`) em 07/10/2026. Não é o app: é o serviço que roda fora do navegador.

- **Na máquina do Google** (`robo-nilma`): `vigia-robo.js` — Gmail, avisos no celular, cobranças, Drive, backups e o FGTS Digital (`fgts-digital.js`). A máquina se prepara com `nuvem/iniciar-maquina.sh` (o metadado `startup-script`) e puxa este repositório, ramo `desenvolvimento`. Atualizar: push + trocar o metadado `robo-versao`.
- **No PC do escritório**: `arquivador.js` (o "Arquivar agora" e o SIEG), ligado pela pasta Inicializar do Windows (`iniciar-arquivador.cmd`).
- Credenciais, memória do robô e registros ficam só no disco de quem roda (ver `.gitignore`).
- Teste: `node teste-robo.js`.
- NFS-e dos honorários (Taiobeiras, E&L, padrão DPS nacional): `nfse.js`, ligada pelo `vigia-robo.js` só na máquina do Google. Contrato com o nads: `config/nfse`, `segredos/nfse` (o token) e `nfseEmissoes/{id}`; estado em `robo/nfse`. Os XSD oficiais ficam em `nfse-xsd/`. Teste sem rede: `node teste-nfse.js` (a validação no XSD usa o `xmllint-wasm`, só de desenvolvimento).
- Saúde do banco (o site do admin, 21/10/2026): `saude-banco.js`, ligada pelo `vigia-robo.js`. Uma vez por dia grava `robo/saudeBanco` (só o admin lê): o tamanho de cada coleção (count) e o de 7 dias atrás, os documentos órfãos (subcoleção sem o documento de cima), o uso dos últimos 30 dias, o armazenamento do Firestore e a hospedagem, pelo Cloud Monitoring (só leitura de métrica). A hospedagem de outro projeto (`conferencia-nilma`) só aparece se a conta do robô tiver lá o papel "Leitor do Monitoring" (`roles/monitoring.viewer`); sem ele, fica o erro. Teste sem rede: `node teste-saude-banco.js`.
