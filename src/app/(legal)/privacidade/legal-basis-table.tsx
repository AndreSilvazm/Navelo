"use client"

import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"

type Row = { finalidade: string; base: string }

const rows: Row[] = [
  { finalidade: "Criar e manter a sua conta, autenticar o acesso e entregar as funcionalidades da plataforma", base: "Execução de contrato ou de procedimentos preliminares (inciso V)" },
  { finalidade: "Gerir cadastro, documentos, contratos, notas fiscais e pagamentos da relação entre você e a empresa contratante", base: "Execução de contrato (inciso V), em nome da controladora" },
  { finalidade: "Guardar documentos e registros fiscais e atender exigências de autoridades", base: "Cumprimento de obrigação legal ou regulatória (inciso II)" },
  { finalidade: "Proteger contas, prevenir fraudes e abusos, manter registros de segurança e de acesso", base: "Legítimo interesse (inciso IX) e obrigação legal (Marco Civil, art. 15, quando aplicável)" },
  { finalidade: "Defender direitos em processos judiciais, administrativos ou arbitrais", base: "Exercício regular de direitos (inciso VI)" },
  { finalidade: "Qualquer uso que dependa da sua escolha", base: "Consentimento (inciso I), que você pode retirar a qualquer momento" },
]

const columns: TableColumnsType<Row> = [
  { title: "Finalidade", dataIndex: "finalidade" },
  { title: "Base legal (LGPD, art. 7º)", dataIndex: "base" },
]

export function LegalBasisTable() {
  return <DataTable<Row> columns={columns} dataSource={rows} pagination={false} rowKey="finalidade" />
}
