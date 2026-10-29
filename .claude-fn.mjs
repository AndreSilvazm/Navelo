import fs from "node:fs"
const p = "src/lib/email/send.ts"
let s = fs.readFileSync(p, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n")
const ini = s.indexOf("export function safeDisplayName")
const fim = s.indexOf("\n}\n", ini) + 3
if (ini < 0 || fim < ini) throw new Error("função não encontrada")
s = s.slice(0, ini) + fs.readFileSync("/tmp/fn.txt", "utf8") + s.slice(fim)
fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s)
