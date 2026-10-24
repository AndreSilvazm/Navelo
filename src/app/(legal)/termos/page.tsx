import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso da plataforma Navelo para empresas e colaboradores PJ.",
  alternates: { canonical: "/termos" },
}

export default function TermsPage() {
  const operator = LEGAL.legalName ? `${LEGAL.legalName}${LEGAL.cnpj ? `, CNPJ ${LEGAL.cnpj}` : ""} (“${LEGAL.brand}”)` : `o ${LEGAL.brand}`

  return (
    <>
      <p className="kicker">Documento legal</p>
      <h1>Termos de Uso</h1>
      <p className="legal-meta">Versão de {LEGAL.updatedAt}</p>

      <p>
        Estes Termos regulam o uso da plataforma Navelo, mantida por {operator}, para gestão de colaboradores pessoa jurídica (PJ):
        contratos, documentos, notas fiscais e pendências. Ao aceitar um convite ou usar a plataforma, você declara que leu e concorda
        com estes Termos e com a <Link href="/privacidade">Política de Privacidade</Link>. Se não concordar, não use a plataforma.
      </p>

      <h2>1. Definições</h2>
      <ul>
        <li>
          <strong>Plataforma:</strong> o site e os portais do Navelo.
        </li>
        <li>
          <strong>Empresa contratante:</strong> a empresa que contrata os serviços do Navelo e convida pessoas para usá-lo.
        </li>
        <li>
          <strong>Equipe da empresa:</strong> proprietário, administradores e agentes, que gerenciam a conta da empresa.
        </li>
        <li>
          <strong>Colaborador PJ:</strong> o profissional, por meio da sua pessoa jurídica, que presta serviços à empresa contratante.
        </li>
        <li>
          <strong>Usuário:</strong> qualquer pessoa com acesso à plataforma.
        </li>
      </ul>

      <h2>2. O que o Navelo é, e o que não é</h2>
      <p>
        O Navelo é uma ferramenta de organização e acompanhamento. Ele <strong>não é parte</strong> do contrato entre a empresa
        contratante e o colaborador PJ, não presta os serviços contratados, não paga nem recebe valores em nome de ninguém e não
        presta consultoria jurídica, contábil ou fiscal. A relação entre empresa e colaborador é regida pelo contrato firmado entre
        eles. O uso da plataforma não cria vínculo empregatício, societário ou de representação entre o Navelo e os usuários, nem
        entre empresa e colaborador.
      </p>

      <h2>3. Acesso à plataforma</h2>
      <ul>
        <li>O acesso é feito somente por convite de uma empresa contratante. Não há cadastro aberto.</li>
        <li>Você precisa ter capacidade civil e ser maior de 18 anos. O colaborador PJ deve agir pela sua pessoa jurídica, em situação regular.</li>
        <li>
          A mesma pessoa pode ter mais de um acesso (por exemplo, com mais de uma empresa, ou como colaborador e como agente da mesma
          empresa) e escolhe qual usar. Cada acesso segue as regras do seu papel.
        </li>
        <li>O convite expira no prazo informado e pode ser cancelado pela empresa. Ele vale apenas para o e-mail convidado.</li>
        <li>A empresa pode aprovar, recusar, suspender ou reativar o acesso do colaborador, informando o motivo na plataforma.</li>
      </ul>

      <h2>4. Sua conta e a segurança</h2>
      <ul>
        <li>Informe dados verdadeiros, completos e atualizados. Você é responsável por eles.</li>
        <li>
          Guarde sua senha com sigilo. Tudo o que for feito com o seu acesso será considerado feito por você. Avise a empresa e o
          Navelo se suspeitar de uso indevido.
        </li>
        <li>O acesso é pessoal e intransferível. Não compartilhe a conta.</li>
      </ul>

      <h2>5. Regras de uso</h2>
      <p>Ao usar a plataforma, você se compromete a não:</p>
      <ul>
        <li>enviar documentos falsos, adulterados ou de terceiros sem autorização, nem notas fiscais que não correspondam a serviços prestados;</li>
        <li>enviar arquivos com vírus ou código malicioso, nem tentar burlar limites, permissões ou a segurança da plataforma;</li>
        <li>acessar dados de outras empresas ou usuários, ou usar a plataforma para fins ilícitos;</li>
        <li>copiar, fazer engenharia reversa ou explorar a plataforma comercialmente fora do que estes Termos permitem;</li>
        <li>usar dados pessoais acessados na plataforma para finalidade diferente da gestão da relação contratual.</li>
      </ul>

      <h2>6. Conteúdo enviado e responsabilidades</h2>
      <ul>
        <li>
          Os documentos, notas fiscais e demais informações enviados são de responsabilidade de quem os envia. O colaborador responde
          pela veracidade das informações e pela regularidade fiscal da sua pessoa jurídica e das notas que emite.
        </li>
        <li>
          Conferir, aprovar, recusar e pagar notas e documentos é decisão da empresa contratante. O Navelo apenas registra o que foi
          decidido, com data e responsável. A leitura automática de dados de uma nota (número, valor e competência) é um auxílio:
          <strong> confira os valores antes de enviar ou aprovar</strong>.
        </li>
        <li>
          Você mantém a titularidade do conteúdo que envia e autoriza o Navelo a armazená-lo, processá-lo e exibi-lo às pessoas
          autorizadas da empresa, apenas para operar a plataforma.
        </li>
        <li>A empresa contratante é responsável por definir quem da sua equipe tem acesso e por tratar os dados dos colaboradores conforme a LGPD.</li>
      </ul>

      <h2>7. Privacidade e proteção de dados</h2>
      <p>
        O tratamento de dados pessoais segue a <Link href="/privacidade">Política de Privacidade</Link>. Quanto aos dados dos
        colaboradores, a empresa contratante é a controladora e o Navelo é operador; quanto aos dados de conta e segurança, o Navelo
        é controlador.
      </p>

      <h2>8. Disponibilidade e mudanças na plataforma</h2>
      <p>
        Trabalhamos para manter a plataforma disponível, mas ela é oferecida no estado em que se encontra e pode ter interrupções
        para manutenção, atualização ou por fatores fora do nosso controle. Podemos criar, alterar ou retirar funcionalidades,
        avisando com antecedência razoável quando a mudança for relevante.
      </p>

      <h2>9. Propriedade intelectual</h2>
      <p>
        A plataforma, a marca Navelo, o layout, o código e os textos pertencem ao Navelo ou a seus licenciantes e são protegidos pela
        legislação de propriedade intelectual. Estes Termos concedem apenas um direito limitado, pessoal, revogável e não exclusivo de
        uso da plataforma durante o seu acesso.
      </p>

      <h2>10. Suspensão e encerramento</h2>
      <p>
        O acesso pode ser suspenso ou encerrado, com aviso quando possível, em caso de violação destes Termos, uso indevido, risco à
        segurança, determinação legal ou fim da relação entre o usuário e a empresa contratante. Você pode pedir o encerramento da sua
        conta, respeitada a guarda de dados exigida por lei (veja a Política de Privacidade).
      </p>

      <h2>11. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela lei, o Navelo não responde por: decisões da empresa contratante e do colaborador (inclusive
        sobre aprovação, recusa e pagamento); conteúdo enviado pelos usuários; atrasos ou falhas decorrentes de indisponibilidade de
        internet ou de serviços de terceiros; ou perdas indiretas, lucros cessantes e danos que não decorram diretamente de falha da
        plataforma. Nada aqui afasta responsabilidades que a lei não permita limitar, nem direitos assegurados ao consumidor quando
        aplicável.
      </p>

      <h2>12. Alterações destes Termos</h2>
      <p>
        Podemos atualizar estes Termos. A versão vigente fica nesta página, com a data no topo. Mudanças relevantes serão comunicadas
        pela plataforma ou por e-mail, e o uso continuado depois do aviso indica concordância. Se você não concordar, pode encerrar o
        uso da conta.
      </p>

      <h2>13. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do domicílio do usuário
        para dirimir dúvidas, quando ele for consumidor, ou, nos demais casos, o foro da comarca da sede do Navelo, sem prejuízo da
        tentativa prévia de solução amigável.
      </p>

      <h2>14. Contato</h2>
      <p>
        Dúvidas sobre estes Termos: escreva para <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> ou fale com o
        administrador da sua empresa.
      </p>
    </>
  )
}
