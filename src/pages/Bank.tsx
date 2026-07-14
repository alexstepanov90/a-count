import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, accountBalance, DOC_TYPE_SHORT, type BankAccount, type Payment , CUR } from '../db'
import { money, fmtDate, todayISO } from '../utils'

const EMPTY_ACC: BankAccount = { name: '', bank: '', iik: '', opening: 0 }

export default function Bank() {
  const accounts = useLiveQuery(() => db.bankAccounts.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.orderBy('date').reverse().toArray(), []) ?? []
  const counterparties = useLiveQuery(() => db.counterparties.orderBy('name').toArray(), []) ?? []
  const invoices = useLiveQuery(() => db.docs.where('docType').equals('invoice').toArray(), []) ?? []

  const [editingAcc, setEditingAcc] = useState<BankAccount | null>(null)
  const [pay, setPay] = useState<Payment | null>(null)

  const totalBalance = accounts.reduce((s, a) => s + accountBalance(a, payments), 0)

  function newPayment(direction: 'in' | 'out') {
    setPay({
      date: todayISO(), direction, amount: 0,
      accountId: accounts[0]?.id, createdAt: 0,
    })
  }

  async function saveAcc() {
    if (!editingAcc) return
    if (!editingAcc.name.trim()) { alert('Укажите название счёта'); return }
    if (editingAcc.id) await db.bankAccounts.put(editingAcc)
    else await db.bankAccounts.add(editingAcc)
    setEditingAcc(null)
  }

  async function savePay() {
    if (!pay) return
    if (!pay.amount || pay.amount <= 0) { alert('Укажите сумму'); return }
    const cp = counterparties.find(c => c.id === pay.counterpartyId)
    const clean: Payment = { ...pay, counterpartyName: cp?.name, createdAt: pay.createdAt || Date.now() }
    if (pay.id) await db.payments.put(clean)
    else await db.payments.add(clean)
    // автостатус счёта: если по счёту оплачено >= суммы — помечаем оплаченным
    if (clean.docId) {
      const doc = await db.docs.get(clean.docId)
      if (doc && doc.docType === 'invoice' && doc.direction === 'out') {
        const paid = (await db.payments.where('docId').equals(clean.docId).toArray())
          .reduce((s, p) => s + p.amount, 0)
        if (paid >= doc.total && doc.status !== 'paid') await db.docs.update(clean.docId, { status: 'paid' })
      }
    }
    setPay(null)
  }

  // счета на оплату выбранного контрагента (для привязки платежа)
  const linkableInvoices = pay
    ? invoices.filter(d =>
        (!pay.counterpartyId || d.counterpartyId === pay.counterpartyId) &&
        (pay.direction === 'in' ? d.direction === 'out' : d.direction === 'in'))
        .sort((a, b) => b.date.localeCompare(a.date))
    : []

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Банк и оплаты</h1>
          <div className="sub">Остатки по счетам и журнал платежей. Данные вводятся вручную, без подключения к банку.</div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => newPayment('in')}>+ Поступление</button>
          <button className="btn" onClick={() => newPayment('out')}>− Списание</button>
          <button className="btn" onClick={() => setEditingAcc({ ...EMPTY_ACC })}>+ Счёт</button>
        </div>
      </div>

      <h2>Счета</h2>
      {accounts.length === 0 ? (
        <div className="empty">Добавьте банковский счёт и укажите начальный остаток — движение оплат посчитается автоматически.</div>
      ) : (
        <table className="list">
          <thead><tr><th>Счёт</th><th>ИИК</th><th className="num">Остаток, {CUR}</th><th></th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td><b>{a.name}</b>{a.bank && <div className="muted">{a.bank}</div>}</td>
                <td className="muted">{a.iik}</td>
                <td className="num"><b>{money(accountBalance(a, payments))}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small" onClick={() => setEditingAcc({ ...a })}>Изменить</button>{' '}
                  <button className="btn small danger" onClick={async () => {
                    const used = payments.some(p => p.accountId === a.id)
                    if (used) { alert('По счёту есть платежи — сначала удалите их или перенесите.'); return }
                    if (confirm(`Удалить счёт «${a.name}»?`)) db.bankAccounts.delete(a.id!)
                  }}>Удалить</button>
                </td>
              </tr>
            ))}
            {accounts.length > 1 && (
              <tr><td colSpan={2}><b>Итого денежных средств</b></td><td className="num"><b>{money(totalBalance)}</b></td><td></td></tr>
            )}
          </tbody>
        </table>
      )}

      <h2>Журнал платежей</h2>
      {payments.length === 0 ? (
        <div className="empty">Платежей пока нет. Заносите поступления и списания — они попадут в сверку, финансы и статусы счетов.</div>
      ) : (
        <table className="list">
          <thead><tr><th>Дата</th><th>Тип</th><th>Контрагент</th><th>Назначение / документ</th><th className="num">Сумма, {CUR}</th><th></th></tr></thead>
          <tbody>
            {payments.map(p => {
              const doc = p.docId ? invoices.find(d => d.id === p.docId) : undefined
              return (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.direction === 'in' ? <span className="chip paid">Приход</span> : <span className="chip draft">Расход</span>}</td>
                  <td>{p.counterpartyName ?? '—'}</td>
                  <td className="muted">{p.purpose}{doc && <> · {DOC_TYPE_SHORT[doc.docType]} № {doc.number}</>}</td>
                  <td className="num" style={{ color: p.direction === 'in' ? 'var(--green)' : 'var(--red)' }}>
                    {p.direction === 'in' ? '+' : '−'}{money(p.amount)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn small" onClick={() => setPay({ ...p })}>Изменить</button>{' '}
                    <button className="btn small danger" onClick={() => confirm('Удалить платёж?') && db.payments.delete(p.id!)}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {editingAcc && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setEditingAcc(null) }}>
          <div className="modal">
            <h2>{editingAcc.id ? 'Банковский счёт' : 'Новый счёт'}</h2>
            <div className="grid c2">
              <div className="field"><label>Название</label>
                <input autoFocus value={editingAcc.name} onChange={e => setEditingAcc({ ...editingAcc, name: e.target.value })} placeholder="Основной счёт" /></div>
              <div className="field"><label>Банк</label>
                <input value={editingAcc.bank} onChange={e => setEditingAcc({ ...editingAcc, bank: e.target.value })} /></div>
              <div className="field"><label>ИИК (IBAN)</label>
                <input value={editingAcc.iik} onChange={e => setEditingAcc({ ...editingAcc, iik: e.target.value })} /></div>
              <div className="field"><label>Начальный остаток, {CUR}</label>
                <input className="num" type="number" value={editingAcc.opening} onChange={e => setEditingAcc({ ...editingAcc, opening: Number(e.target.value) })} /></div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setEditingAcc(null)}>Отмена</button>
              <button className="btn primary" onClick={saveAcc}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {pay && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setPay(null) }}>
          <div className="modal">
            <h2>{pay.id ? 'Платёж' : pay.direction === 'in' ? 'Поступление денег' : 'Списание денег'}</h2>
            <div className="grid c2">
              <div className="field"><label>Дата</label>
                <input type="date" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} /></div>
              <div className="field"><label>Сумма, {CUR}</label>
                <input autoFocus className="num" type="number" value={pay.amount || ''} onChange={e => setPay({ ...pay, amount: Number(e.target.value) })} /></div>
              <div className="field"><label>Тип</label>
                <select value={pay.direction} onChange={e => setPay({ ...pay, direction: e.target.value as 'in' | 'out', docId: undefined })}>
                  <option value="in">Приход (нам заплатили)</option>
                  <option value="out">Расход (мы заплатили)</option>
                </select></div>
              <div className="field"><label>Банковский счёт</label>
                <select value={pay.accountId ?? 0} onChange={e => setPay({ ...pay, accountId: Number(e.target.value) || undefined })}>
                  <option value={0}>— не указан —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></div>
              <div className="field"><label>Контрагент</label>
                <select value={pay.counterpartyId ?? 0} onChange={e => setPay({ ...pay, counterpartyId: Number(e.target.value) || undefined, docId: undefined })}>
                  <option value={0}>— не указан —</option>
                  {counterparties.map(c => <option key={c.id} value={c.id}>{c.type} «{c.name}»</option>)}
                </select></div>
              <div className="field"><label>По счёту на оплату</label>
                <select value={pay.docId ?? 0} onChange={e => setPay({ ...pay, docId: Number(e.target.value) || undefined })}>
                  <option value={0}>— без привязки —</option>
                  {linkableInvoices.map(d => <option key={d.id} value={d.id}>№ {d.number} от {fmtDate(d.date)} — {money(d.total)} {CUR} ({d.counterpartyName})</option>)}
                </select></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Назначение платежа</label>
                <input value={pay.purpose ?? ''} onChange={e => setPay({ ...pay, purpose: e.target.value })} placeholder="Оплата по счёту №… / за услуги…" /></div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPay(null)}>Отмена</button>
              <button className="btn primary" onClick={savePay}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
