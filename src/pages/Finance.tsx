import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, type Salary, type Settings, type TaxRate , CUR } from '../db'
import { money, fmtDate, todayISO } from '../utils'

export default function Finance() {
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(todayISO())
  const [settings, setSettings] = useState<Settings | null>(null)
  const [sal, setSal] = useState<Salary | null>(null)

  useEffect(() => { getSettings().then(setSettings) }, [])

  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []
  const salaries = useLiveQuery(() => db.salaries.orderBy('date').reverse().toArray(), []) ?? []

  const inPeriod = <T extends { date: string }>(x: T) => x.date >= from && x.date <= to

  const income = useMemo(() => payments.filter(p => p.direction === 'in' && inPeriod(p)).reduce((s, p) => s + p.amount, 0), [payments, from, to])
  const expensePay = useMemo(() => payments.filter(p => p.direction === 'out' && inPeriod(p)).reduce((s, p) => s + p.amount, 0), [payments, from, to])
  const salaryExp = useMemo(() => salaries.filter(inPeriod).reduce((s, x) => s + x.amount + x.taxes, 0), [salaries, from, to])
  const expense = expensePay + salaryExp
  const profit = income - expense

  const taxes: TaxRate[] = settings?.taxRates ?? []
  const taxValue = (t: TaxRate) =>
    t.base === 'manual' ? (t.amount ?? 0)
      : (t.base === 'income' ? income : Math.max(0, profit)) * t.rate / 100
  const taxTotal = taxes.reduce((s, t) => s + taxValue(t), 0)

  async function saveTaxes(next: TaxRate[]) {
    if (!settings) return
    const updated = { ...settings, taxRates: next }
    setSettings(updated)
    const existing = await db.settings.toCollection().first()
    if (existing?.id) await db.settings.update(existing.id, { taxRates: next })
    else await db.settings.add(updated)
  }

  async function saveSal() {
    if (!sal) return
    if (!sal.employee.trim() || !sal.amount) { alert('Укажите работника и сумму'); return }
    if (sal.id) await db.salaries.put(sal)
    else await db.salaries.add({ ...sal, createdAt: Date.now() })
    setSal(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Финансы</h1>
          <div className="sub">Доход и расход считаются по оплатам (кассовый метод) плюс зарплата. Налоги — по ставкам, заданным вручную.</div>
        </div>
        <div className="row">
          <span className="muted">Период:</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
          <span className="muted">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="v" style={{ color: 'var(--green)' }}>{money(income)} {CUR}</div><div className="l">Доход (поступления)</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--red)' }}>{money(expense)} {CUR}</div><div className="l">Расход (оплаты {money(expensePay)} + ФОТ {money(salaryExp)})</div></div>
        <div className="stat"><div className="v">{money(profit)} {CUR}</div><div className="l">Прибыль (доход − расход)</div></div>
        <div className="stat"><div className="v">{money(taxTotal)} {CUR}</div><div className="l">Налоги к уплате (расчётно)</div></div>
      </div>

      <h2>Налоги</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Всё вариативно: процент от дохода, процент от прибыли или фиксированная сумма вручную
          (например, ОПВ/СО ИП за себя). Расчёт справочный — базы, льготы и пороги вашей юрисдикции
          он не знает, сверяйтесь с налоговым законодательством своей страны.
        </p>
        {taxes.length === 0 && <div className="muted" style={{ marginBottom: 10 }}>Ставки не заданы.</div>}
        {taxes.map((t, i) => (
          <div className="row" key={i} style={{ marginBottom: 8 }}>
            <input value={t.name} placeholder="Название (например, ИПН 3% или ОПВ за себя)" style={{ maxWidth: 240 }}
                   onChange={e => saveTaxes(taxes.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <select value={t.base} style={{ width: 190 }}
                    onChange={e => saveTaxes(taxes.map((x, j) => j === i ? { ...x, base: e.target.value as TaxRate['base'] } : x))}>
              <option value="income">% от дохода</option>
              <option value="profit">% от прибыли</option>
              <option value="manual">сумма вручную</option>
            </select>
            {t.base === 'manual' ? (
              <input className="num" type="number" value={t.amount ?? ''} style={{ width: 140 }} placeholder="сумма"
                     onChange={e => saveTaxes(taxes.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
            ) : (
              <span className="row" style={{ gap: 4 }}>
                <input className="num" type="number" step={0.1} value={t.rate} style={{ width: 90 }}
                       onChange={e => saveTaxes(taxes.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x))} />
                <span className="muted">%</span>
              </span>
            )}
            <span className="num" style={{ minWidth: 140, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              = {money(taxValue(t))} {CUR}
            </span>
            <button className="btn small danger" onClick={() => saveTaxes(taxes.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <div className="row">
          <button className="btn small" onClick={() => saveTaxes([...taxes, { name: '', rate: 3, base: 'income' }])}>+ Налог в %</button>
          <button className="btn small" onClick={() => saveTaxes([...taxes, { name: '', rate: 0, base: 'manual', amount: 0 }])}>+ Налог суммой</button>
        </div>
      </div>

      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Заработная плата
        <button className="btn primary small" onClick={() => setSal({ date: todayISO(), employee: '', amount: 0, taxes: 0, createdAt: 0 })}>+ Выплата</button>
      </h2>
      {salaries.length === 0 ? (
        <div className="empty">Выплат нет. Занесённая зарплата и налоги с ФОТ автоматически попадают в расходную часть.</div>
      ) : (
        <table className="list">
          <thead><tr><th>Дата</th><th>Работник</th><th className="num">На руки, {CUR}</th><th className="num">Налоги с ФОТ, {CUR}</th><th className="num">Итого расход, {CUR}</th><th></th></tr></thead>
          <tbody>
            {salaries.map(x => (
              <tr key={x.id}>
                <td>{fmtDate(x.date)}</td>
                <td><b>{x.employee}</b>{x.notes && <div className="muted">{x.notes}</div>}</td>
                <td className="num">{money(x.amount)}</td>
                <td className="num">{money(x.taxes)}</td>
                <td className="num"><b>{money(x.amount + x.taxes)}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small" onClick={() => setSal({ ...x })}>Изменить</button>{' '}
                  <button className="btn small danger" onClick={() => confirm('Удалить запись?') && db.salaries.delete(x.id!)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sal && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setSal(null) }}>
          <div className="modal">
            <h2>{sal.id ? 'Выплата' : 'Новая выплата'}</h2>
            <div className="grid c2">
              <div className="field"><label>Дата выплаты</label>
                <input type="date" value={sal.date} onChange={e => setSal({ ...sal, date: e.target.value })} /></div>
              <div className="field"><label>Работник</label>
                <input autoFocus value={sal.employee} onChange={e => setSal({ ...sal, employee: e.target.value })} /></div>
              <div className="field"><label>Сумма на руки, {CUR}</label>
                <input className="num" type="number" value={sal.amount || ''} onChange={e => setSal({ ...sal, amount: Number(e.target.value) })} /></div>
              <div className="field"><label>Налоги и отчисления с ФОТ, {CUR}</label>
                <input className="num" type="number" value={sal.taxes || ''} onChange={e => setSal({ ...sal, taxes: Number(e.target.value) })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Комментарий</label>
                <input value={sal.notes ?? ''} onChange={e => setSal({ ...sal, notes: e.target.value })} placeholder="за июнь 2026" /></div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setSal(null)}>Отмена</button>
              <button className="btn primary" onClick={saveSal}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
