import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, calcDebts, calcPaidByDoc, accountBalance, DOC_TYPE_SHORT, STATUS_LABELS, type Doc , CUR } from '../db'
import { money, fmtDate } from '../utils'

export default function Dashboard() {
  const docs = useLiveQuery(() => db.docs.orderBy('date').reverse().limit(8).toArray(), []) ?? []
  const all = useLiveQuery(() => db.docs.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []
  const accounts = useLiveQuery(() => db.bankAccounts.toArray(), []) ?? []
  const counterparties = useLiveQuery(() => db.counterparties.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.toArray(), [])?.[0]

  const year = new Date().getFullYear().toString()
  const outYear = all.filter(d => d.direction === 'out' && d.date.startsWith(year) && d.status !== 'draft')
  const paidByDoc = calcPaidByDoc(payments)
  const unpaid = all.filter(d =>
    d.direction === 'out' && d.docType === 'invoice' && d.status === 'issued' &&
    (paidByDoc.get(d.id!) ?? 0) < d.total)
  const cash = accounts.reduce((s, a) => s + accountBalance(a, payments), 0)

  const debts = calcDebts(all, payments)
  const cpName = (id: number) => {
    const c = counterparties.find(x => x.id === id)
    return c ? `${c.type} «${c.name}»` : '—'
  }
  const debtors = [...debts.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1])
  const creditors = [...debts.entries()].filter(([, v]) => v < -0.005).sort((a, b) => a[1] - b[1])

  const sum = (arr: Doc[]) => arr.reduce((s, d) => s + d.total, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{settings?.companyName || 'Добро пожаловать'}</h1>
          <div className="sub">Сводка за {year} год</div>
        </div>
        <div className="row">
          <Link className="btn primary" to="/docs/new?type=invoice">+ Счёт на оплату</Link>
          <Link className="btn" to="/docs/new?type=act">+ АВР</Link>
          <Link className="btn" to="/docs/new">+ Другой документ</Link>
        </div>
      </div>

      {!settings?.companyName && (
        <div className="card" style={{ marginBottom: 18 }}>
          Начните с заполнения <Link to="/settings">своих реквизитов</Link> — они подставляются
          в каждый счёт и акт автоматически. Затем добавьте <Link to="/counterparties">контрагента</Link> и
          выставьте первый документ.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><div className="v">{money(cash)} {CUR}</div><div className="l"><Link to="/bank">Деньги на счетах</Link></div></div>
        <div className="stat"><div className="v">{money(sum(unpaid))} {CUR}</div><div className="l">Не оплачено счетов: {unpaid.length}</div></div>
        <div className="stat"><div className="v">{money(outYear.reduce((s, d) => s + d.total, 0))} {CUR}</div><div className="l">Выставлено за год</div></div>
        <div className="stat"><div className="v">{money(debtors.reduce((s, [, v]) => s + v, 0))} {CUR}</div><div className="l">Дебиторская задолженность</div></div>
      </div>

      <div className="grid c2" style={{ alignItems: 'start' }}>
        <div>
          <h2>Дебиторы (должны нам)</h2>
          {debtors.length === 0 ? <div className="empty">Дебиторов нет.</div> : (
            <table className="list">
              <thead><tr><th>Контрагент</th><th className="num">Долг, {CUR}</th><th></th></tr></thead>
              <tbody>
                {debtors.map(([id, v]) => (
                  <tr key={id}>
                    <td>{cpName(id)}</td>
                    <td className="num" style={{ color: 'var(--green)' }}>{money(v)}</td>
                    <td><Link className="btn small" to={`/recon?cp=${id}`}>Сверка</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h2>Кредиторы (мы должны)</h2>
          {creditors.length === 0 ? <div className="empty">Кредиторов нет.</div> : (
            <table className="list">
              <thead><tr><th>Контрагент</th><th className="num">Долг, {CUR}</th><th></th></tr></thead>
              <tbody>
                {creditors.map(([id, v]) => (
                  <tr key={id}>
                    <td>{cpName(id)}</td>
                    <td className="num" style={{ color: 'var(--red)' }}>{money(-v)}</td>
                    <td><Link className="btn small" to={`/recon?cp=${id}`}>Сверка</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        Задолженность считается по АВР и накладным за вычетом оплат (счета на оплату и СФ не учитываются, чтобы не задваивать оборот).
      </div>

      <h2>Последние документы</h2>
      {docs.length === 0 ? (
        <div className="empty">Документов пока нет. Создайте первый счёт — это займёт меньше минуты.</div>
      ) : (
        <table className="list">
          <thead>
            <tr><th>Дата</th><th>Документ</th><th>Контрагент</th><th className="num">Сумма, {CUR}</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id} className="clickable" onClick={() => location.hash = `#/docs/${d.id}`}>
                <td>{fmtDate(d.date)}</td>
                <td>{d.direction === 'in' ? '← ' : ''}{DOC_TYPE_SHORT[d.docType]} № {d.number}</td>
                <td>{d.counterpartyName}</td>
                <td className="num">{money(d.total)}</td>
                <td>{d.direction === 'in'
                  ? <span className="chip in">Входящий</span>
                  : <span className={`chip ${d.status}`}>{STATUS_LABELS[d.status]}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
