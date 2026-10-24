import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL, PRIVACY_CHANNEL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Navelo coleta, usa, compartilha e protege dados pessoais, conforme a LGPD.",
  alternates: { canonical: "/privacidade" },
}

export default function PrivacyPage() {
  const operator = LEGAL.legalName ? `${LEGAL.legalName}${LEGAL.cnpj ? `, CNPJ ${LEGAL.cnpj}` : ""} (“${LEGAL.brand}”)` : `o ${LEGAL.brand}`
  const channel = <a href={`mailto:${PRIVACY_CHANNEL}`}>{PRIVACY_CHANNEL}</a>

  return (
    <>
      <p className="kicker">Documento legal</p>
      <h1>Política de Privacidade</h1>
      <p className="legal-meta">Versão de {LEGAL.updatedAt}</p>

      <p>
        Esta política explica como {operator} trata dados pessoais na plataforma Navelo, de gestão de colaboradores pessoa jurídica
        (PJ), e quais são os seus direitos. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, “LGPD”), o Marco Civil da
        Internet (Lei nº 12.965/2014) e as demais normas aplicáveis. Leia também os <Link href="/termos">Termos de Uso</Link>.
      </p>

      <h2>1. Quem é quem no tratamento dos dados</h2>
      <ul>
        <li>
          <strong>Titular:</strong> você, pessoa a quem os dados se referem (colaborador PJ, ou pessoa da equipe da empresa
          contratante, como proprietário, administrador ou agente).
        </li>
        <li>
          <strong>Empresa contratante:</strong> a empresa que convida você para a plataforma. Quanto aos dados dos colaboradores
          (cadastro, documentos, contratos e notas fiscais), ela decide por que e como usá-los e é a <strong>controladora</strong>.
          Nesse caso o Navelo atua como <strong>operador</strong>, tratando os dados em nome e segundo as instruções dela.
        </li>
        <li>
          <strong>Navelo:</strong> é <strong>controlador</strong> dos dados necessários para criar e proteger a sua conta (e-mail,
          senha, registros de acesso e segurança) e para cumprir obrigações legais da própria plataforma.
        </li>
      </ul>

      <h2>2. Quais dados tratamos</h2>
      <ul>
        <li>
          <strong>Conta e acesso:</strong> nome, e-mail, senha (guardada apenas na forma de hash irreversível, nunca em texto),
          papel na empresa e cargo informado no convite.
        </li>
        <li>
          <strong>Cadastro do colaborador PJ:</strong> razão social, nome fantasia, CNPJ, telefone, endereço e dados bancários
          (banco, agência, conta, tipo de conta e chave Pix) para pagamento.
        </li>
        <li>
          <strong>Documentos e notas fiscais:</strong> arquivos enviados (PDF, PNG ou JPG), número, valor e competência da nota,
          descrição e situação da análise.
        </li>
        <li>
          <strong>Contratos e valores:</strong> contratos aos quais o colaborador está vinculado, prazos para envio de nota e o valor
          mensal definido pela empresa.
        </li>
        <li>
          <strong>Registros de atividade:</strong> quem aprovou, recusou, pagou ou suspendeu algo, quando e o motivo informado.
        </li>
        <li>
          <strong>Dados técnicos:</strong> endereço IP, tipo de navegador e data e hora de acesso associados à sessão, usados para
          segurança.
        </li>
      </ul>
      <p>
        Não pedimos dados pessoais sensíveis (como saúde, biometria ou convicções). Se um documento exigido pela empresa contiver
        algum, ele é tratado apenas para a finalidade para a qual foi pedido. Evite enviar informações além das solicitadas.
      </p>

      <h2>3. Para que usamos e em que base legal</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th>Finalidade</th>
              <th>Base legal (LGPD, art. 7º)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Criar e manter a sua conta, autenticar o acesso e entregar as funcionalidades da plataforma</td>
              <td>Execução de contrato ou de procedimentos preliminares (inciso V)</td>
            </tr>
            <tr>
              <td>Gerir cadastro, documentos, contratos, notas fiscais e pagamentos da relação entre você e a empresa contratante</td>
              <td>Execução de contrato (inciso V), em nome da controladora</td>
            </tr>
            <tr>
              <td>Guardar documentos e registros fiscais e atender exigências de autoridades</td>
              <td>Cumprimento de obrigação legal ou regulatória (inciso II)</td>
            </tr>
            <tr>
              <td>Proteger contas, prevenir fraudes e abusos, manter registros de segurança e de acesso</td>
              <td>Legítimo interesse (inciso IX) e obrigação legal (Marco Civil, art. 15, quando aplicável)</td>
            </tr>
            <tr>
              <td>Defender direitos em processos judiciais, administrativos ou arbitrais</td>
              <td>Exercício regular de direitos (inciso VI)</td>
            </tr>
            <tr>
              <td>Qualquer uso que dependa da sua escolha</td>
              <td>Consentimento (inciso I), que você pode retirar a qualquer momento</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Não vendemos dados pessoais e não os usamos para publicidade nem para criar perfis de consumo.</p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li>
          <strong>Empresa contratante:</strong> os dados que você envia ficam visíveis para as pessoas autorizadas da empresa com a
          qual você se relaciona na plataforma, e somente dela. Se você trabalha com mais de uma empresa, cada uma vê apenas o que
          diz respeito a ela; a sua conta bancária, por ser única, é visível para todas.
        </li>
        <li>
          <strong>Prestadores de serviço (suboperadores):</strong> hospedagem e banco de dados (Supabase, com os dados armazenados
          em São Paulo, Brasil) e envio de e-mails da plataforma (Resend). Eles tratam dados apenas para prestar o serviço, sob
          contrato.
        </li>
        <li>
          <strong>Consultas públicas:</strong> para facilitar o cadastro, consultamos dados públicos de CNPJ, CEP e bancos na
          BrasilAPI. Enviamos somente o número consultado, nunca seus dados pessoais.
        </li>
        <li>
          <strong>Autoridades:</strong> quando houver ordem judicial, requisição legal ou para cumprir obrigação legal.
        </li>
      </ul>
      <p>
        Alguns prestadores podem tratar dados fora do Brasil. Nesses casos adotamos as garantias previstas nos arts. 33 a 36 da LGPD,
        como cláusulas contratuais adequadas, e compartilhamos só o necessário.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Mantemos os dados enquanto a conta e a relação com a empresa contratante estiverem ativas. Depois, guardamos pelo tempo
        exigido em lei (em regra, cinco anos para documentos e registros fiscais e contratuais) ou necessário para defesa em
        processos. Encerrado o prazo, os dados são eliminados ou anonimizados. Os registros de acesso à aplicação são guardados por,
        no mínimo, seis meses, como determina o Marco Civil da Internet.
      </p>

      <h2>6. Seus direitos</h2>
      <p>Nos termos do art. 18 da LGPD, você pode solicitar, a qualquer momento:</p>
      <ul>
        <li>confirmação de que tratamos seus dados e acesso a eles;</li>
        <li>correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
        <li>portabilidade dos dados, conforme regulamentação da ANPD;</li>
        <li>eliminação dos dados tratados com base no consentimento;</li>
        <li>informação sobre com quem compartilhamos os dados;</li>
        <li>informação sobre a possibilidade de não consentir e as consequências da recusa;</li>
        <li>revogação do consentimento;</li>
        <li>oposição a tratamento feito com base em hipótese diferente do consentimento, se houver descumprimento da lei;</li>
        <li>revisão de decisões tomadas unicamente por tratamento automatizado. Hoje a plataforma não toma decisões desse tipo.</li>
      </ul>
      <p>
        Para exercer os direitos, fale com {channel}. Como os dados dos colaboradores são controlados pela empresa contratante, o
        pedido relativo a eles pode ser encaminhado a ela, e nós a ajudamos a respondê-lo. Respondemos nos prazos da LGPD. Você
        também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.
      </p>
      <p>
        Alguns dados, como o CNPJ e o que vem da Receita Federal, não podem ser editados por você na plataforma. Se estiverem
        desatualizados, regularize na fonte ou fale com a empresa contratante. Certos dados também não podem ser apagados enquanto
        houver obrigação legal de guarda.
      </p>

      <h2>7. Como protegemos os dados</h2>
      <p>
        Adotamos medidas técnicas e administrativas para proteger os dados contra acesso não autorizado, perda e alteração: senhas
        armazenadas com algoritmo de hash forte (argon2id), conexão criptografada, sessões com cookie protegido, controle de acesso
        por papel (cada pessoa vê só o que lhe cabe), registro de ações sensíveis e acesso restrito de nossa equipe. Nenhum sistema é
        totalmente imune, mas, em caso de incidente que possa causar risco ou dano relevante, comunicamos a ANPD e os titulares
        afetados, conforme o art. 48 da LGPD.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Usamos somente cookies estritamente necessários: o cookie de sessão (<code>navelo_session</code>) que mantém você conectado.
        Ele é protegido contra leitura por scripts, dura até 7 dias, ou até 30 dias se você marcar “Lembrar de mim”, e é apagado ao
        sair. Não usamos cookies de publicidade nem de rastreamento de terceiros. Se isso mudar, atualizaremos esta política e,
        quando exigido, pediremos o seu consentimento.
      </p>

      <h2>9. Crianças e adolescentes</h2>
      <p>A plataforma é voltada a profissionais e empresas e não se destina a menores de 18 anos.</p>

      <h2>10. Alterações desta política</h2>
      <p>
        Podemos atualizar esta política para refletir mudanças na plataforma ou na lei. A versão vigente fica sempre nesta página, com
        a data no topo. Mudanças relevantes serão avisadas pela plataforma ou por e-mail.
      </p>

      <h2>11. Contato</h2>
      <p>
        Dúvidas ou pedidos sobre privacidade: fale com {channel}.
        {LEGAL.privacyEmail ? "" : " Quando houver um canal exclusivo do encarregado (DPO), ele será indicado aqui."}
      </p>
    </>
  )
}
