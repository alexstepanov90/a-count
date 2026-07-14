// ============================================================
// ПростойУчёт — ядро данных (Dexie / IndexedDB)
// Все данные хранятся локально на устройстве пользователя.
// Никакой сервер и передача данных наружу не используются.
// ============================================================
import Dexie, { type Table } from 'dexie'

// ---------- Типы ----------

export type CounterpartyType = 'ТОО' | 'ИП' | 'АО' | 'Физлицо' | 'Прочее'

export interface Counterparty {
  id?: number
  name: string            // Наименование
  type: CounterpartyType
  binIin: string          // БИН / ИИН
  address?: string
  phone?: string
  email?: string
  contact?: string        // Контактное лицо
  bankName?: string       // Банк
  iik?: string            // ИИК (IBAN, KZ...)
  bik?: string            // БИК банка
  kbe?: string            // Кбе
  vatCertificate?: string // Свидетельство по НДС (серия/номер), если плательщик
  notes?: string
  createdAt: number
  updatedAt: number
}

export type ItemKind = 'товар' | 'услуга' | 'работа'

export interface Item {
  id?: number
  name: string
  kind: ItemKind
  unit: string            // ед. изм.: шт, усл, час, кг...
  price: number           // цена по умолчанию
  vatRate: number | null  // 16 | 12 | 0 | null (без НДС)
  notes?: string
  createdAt: number
  updatedAt: number
}

export type DocType = 'invoice' | 'vat_invoice' | 'act' | 'waybill'
export type Direction = 'out' | 'in'
export type DocStatus = 'draft' | 'issued' | 'paid'

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  invoice: 'Счёт на оплату',
  vat_invoice: 'Счёт-фактура',
  act: 'Акт выполненных работ',
  waybill: 'Накладная',
}

export const DOC_TYPE_SHORT: Record<DocType, string> = {
  invoice: 'Счёт',
  vat_invoice: 'СФ',
  act: 'АВР',
  waybill: 'Накладная',
}

export const STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Черновик',
  issued: 'Выставлен',
  paid: 'Оплачен',
}

export interface DocLine {
  itemId?: number
  name: string
  unit: string
  qty: number
  price: number
  vatRate: number | null // null = без НДС
}

export interface DocExtra {
  responsible?: string   // З-2: ответственный за поставку
  transport?: string     // З-2: транспортная организация
  ttn?: string           // З-2: товарно-транспортная накладная (номер, дата)
  proxy?: string         // З-2: доверенность №, дата, кем выдана
  attachmentPages?: string // Р-1: приложение, количество страниц
  paymentTerms?: string    // СФ: условия оплаты по договору
  destination?: string     // СФ: пункт назначения
}

export interface Doc {
  id?: number
  docType: DocType
  direction: Direction   // out = мы выставили, in = входящий от поставщика
  number: string
  date: string           // ISO yyyy-mm-dd
  counterpartyId: number
  counterpartyName: string // денормализовано для списков/сверки
  contractRef?: string   // основание: договор №/дата
  status: DocStatus
  signed?: boolean       // проставить подпись и печать в печатной форме
  baseDocId?: number     // «создан на основании» (например СФ/АВР на основании счёта)
  extra?: DocExtra
  lines: DocLine[]
  total: number          // итого с НДС
  vatTotal: number       // в т.ч. НДС
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  id?: number
  companyName: string
  companyType: string      // ТОО / ИП ...
  binIin: string
  address?: string
  phone?: string
  email?: string
  bankName?: string
  iik?: string
  bik?: string
  kbe?: string
  knp?: string             // КНП по умолчанию для счетов
  vatPayer: boolean
  vatCertificate?: string
  defaultVatRate: number   // 16 / 12 / 0
  pricesIncludeVat: boolean
  director?: string        // Руководитель (для подписи)
  accountant?: string      // Бухгалтер (для подписи)
  numberPrefix?: string    // префикс номеров, напр. "AL-"
  signImage?: string       // скан подписи руководителя (dataURL png/jpg)
  stampImage?: string      // скан печати (dataURL png/jpg)
  taxRates?: TaxRate[]     // ставки налогов (вручную)
  // Профиль и локализация
  ownerName?: string
  ownerEmail?: string
  country?: string
  currencySymbol?: string  // ₸, $, €, сум …
  currencyCode?: string    // KZT, USD, EUR …
  agreementAcceptedAt?: string // ISO — дата принятия пользовательского соглашения
}

// Банковский счёт (остатки вводятся начальным сальдо и движением оплат)
export interface BankAccount {
  id?: number
  name: string        // например «Основной счёт Kaspi»
  bank?: string
  iik?: string
  opening: number     // начальный остаток, ₸
}

// Оплата (входящая/исходящая) — вручную, без интеграции с банком
export interface Payment {
  id?: number
  date: string            // ISO
  direction: 'in' | 'out' // in = нам заплатили, out = мы заплатили
  amount: number
  accountId?: number      // банковский счёт
  counterpartyId?: number
  counterpartyName?: string
  docId?: number          // привязка к счёту на оплату (или иному документу)
  purpose?: string        // назначение платежа
  createdAt: number
}

// Запись о заработной плате (садится в расходы)
export interface Salary {
  id?: number
  date: string        // ISO (дата выплаты)
  employee: string
  amount: number      // на руки
  taxes: number       // налоги и отчисления с ФОТ (вручную)
  notes?: string
  createdAt: number
}

// Налог: процент от дохода/прибыли ЛИБО фиксированная сумма вручную
export interface TaxRate {
  name: string
  base: 'income' | 'profit' | 'manual'
  rate: number                 // % (для income/profit)
  amount?: number              // фиксированная сумма (для manual)
}

// ---------- База ----------

export class AppDB extends Dexie {
  counterparties!: Table<Counterparty, number>
  items!: Table<Item, number>
  docs!: Table<Doc, number>
  settings!: Table<Settings, number>
  bankAccounts!: Table<BankAccount, number>
  payments!: Table<Payment, number>
  salaries!: Table<Salary, number>

  constructor() {
    super('prostoychet')
    this.version(1).stores({
      counterparties: '++id, name, binIin',
      items: '++id, name, kind',
      docs: '++id, docType, direction, date, counterpartyId, status, number',
      settings: '++id',
    })
    this.version(2).stores({
      counterparties: '++id, name, binIin',
      items: '++id, name, kind',
      docs: '++id, docType, direction, date, counterpartyId, status, number, baseDocId',
      settings: '++id',
      bankAccounts: '++id',
      payments: '++id, date, direction, counterpartyId, docId, accountId',
      salaries: '++id, date',
    })
  }
}

export const db = new AppDB()

// ---------- Валюта (задаётся в настройках, по умолчанию тенге) ----------
export let CUR = '₸'
export let CUR_CODE = 'KZT'
export function setCurrency(symbol?: string, code?: string) {
  if (symbol) CUR = symbol
  if (code) CUR_CODE = code
}

// ---------- Хелперы ----------

export function calcLine(line: DocLine, pricesIncludeVat: boolean) {
  const amount = round2(line.qty * line.price)
  let vat = 0
  if (line.vatRate !== null && line.vatRate > 0) {
    vat = pricesIncludeVat
      ? round2(amount * line.vatRate / (100 + line.vatRate))
      : round2(amount * line.vatRate / 100)
  }
  const total = pricesIncludeVat ? amount : round2(amount + vat)
  return { amount, vat, total }
}

export function calcDoc(lines: DocLine[], pricesIncludeVat: boolean) {
  let total = 0, vatTotal = 0
  for (const l of lines) {
    const c = calcLine(l, pricesIncludeVat)
    total += c.total
    vatTotal += c.vat
  }
  return { total: round2(total), vatTotal: round2(vatTotal) }
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Следующий номер документа: <префикс><NNN> в пределах года и типа
export async function nextDocNumber(docType: DocType, dateISO: string, prefix = ''): Promise<string> {
  const year = dateISO.slice(0, 4)
  const docs = await db.docs.where('docType').equals(docType).toArray()
  let max = 0
  for (const d of docs) {
    if (d.direction !== 'out') continue
    if (!d.date.startsWith(year)) continue
    const m = d.number.match(/(\d+)\s*$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${max + 1}`
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.toCollection().first()
  return s ?? {
    companyName: '', companyType: 'ТОО', binIin: '',
    vatPayer: true, defaultVatRate: 16, pricesIncludeVat: true,
    numberPrefix: '',
  }
}

// ---------- Резервное копирование ----------

export async function exportBackup(): Promise<string> {
  const data = {
    app: 'prostoychet', version: 1, exportedAt: new Date().toISOString(),
    counterparties: await db.counterparties.toArray(),
    items: await db.items.toArray(),
    docs: await db.docs.toArray(),
    settings: await db.settings.toArray(),
    bankAccounts: await db.bankAccounts.toArray(),
    payments: await db.payments.toArray(),
    salaries: await db.salaries.toArray(),
  }
  return JSON.stringify(data, null, 2)
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json)
  if (data.app !== 'prostoychet') throw new Error('Файл не является резервной копией ПростойУчёт')
  await db.transaction('rw', [db.counterparties, db.items, db.docs, db.settings, db.bankAccounts, db.payments, db.salaries], async () => {
    await Promise.all([db.counterparties.clear(), db.items.clear(), db.docs.clear(), db.settings.clear(),
      db.bankAccounts.clear(), db.payments.clear(), db.salaries.clear()])
    await db.counterparties.bulkAdd(data.counterparties ?? [])
    await db.items.bulkAdd(data.items ?? [])
    await db.docs.bulkAdd(data.docs ?? [])
    await db.settings.bulkAdd(data.settings ?? [])
    await db.bankAccounts.bulkAdd(data.bankAccounts ?? [])
    await db.payments.bulkAdd(data.payments ?? [])
    await db.salaries.bulkAdd(data.salaries ?? [])
  })
}


// ---------- Расчёты: долги, склад, оплаты ----------

// Документы, участвующие в расчётах задолженности (АВР и накладные; СФ и счета
// на оплату не учитываются, чтобы не задваивать один и тот же оборот)
export function isSettlementDoc(d: Doc): boolean {
  return (d.docType === 'act' || d.docType === 'waybill') && (d.direction === 'in' || d.status !== 'draft')
}

// Сальдо по каждому контрагенту: > 0 — дебитор (должен нам), < 0 — кредитор (мы должны)
export function calcDebts(docs: Doc[], payments: Payment[]): Map<number, number> {
  const m = new Map<number, number>()
  const add = (cpId: number | undefined, v: number) => {
    if (!cpId) return
    m.set(cpId, round2((m.get(cpId) ?? 0) + v))
  }
  for (const d of docs) {
    if (!isSettlementDoc(d)) continue
    add(d.counterpartyId, d.direction === 'out' ? d.total : -d.total)
  }
  for (const p of payments) {
    add(p.counterpartyId, p.direction === 'in' ? -p.amount : p.amount)
  }
  return m
}

// Остатки ТМЦ по накладным: входящие +, исходящие (не черновики) −
export function calcStock(docs: Doc[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const d of docs) {
    if (d.docType !== 'waybill') continue
    if (d.direction === 'out' && d.status === 'draft') continue
    const sign = d.direction === 'in' ? 1 : -1
    for (const l of d.lines) {
      if (!l.itemId) continue
      m.set(l.itemId, round2((m.get(l.itemId) ?? 0) + sign * l.qty))
    }
  }
  return m
}

// Оплачено по каждому документу (для статуса счетов)
export function calcPaidByDoc(payments: Payment[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const p of payments) {
    if (!p.docId) continue
    m.set(p.docId, round2((m.get(p.docId) ?? 0) + p.amount))
  }
  return m
}

// Остаток по банковскому счёту
export function accountBalance(acc: BankAccount, payments: Payment[]): number {
  let b = acc.opening
  for (const p of payments) {
    if (p.accountId !== acc.id) continue
    b += p.direction === 'in' ? p.amount : -p.amount
  }
  return round2(b)
}
