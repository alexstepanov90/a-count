import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, calcPaidByDoc, DOC_TYPE_LABELS, DOC_TYPE_SHORT, STATUS_LABELS, type DocType, type Direction, type Doc , CUR } from '../db'
import { money, fmtDate, downloadFile, toCSV } from '../utils'

export default function Documents() {
  const [dir, setDir] = useState<Direction | 'all'>('all')
  const [type, setType] = useState<DocType | 'all'>('all')
  const [q, setQ] = useState('')

  const docs = useLiveQuery(() => db.docs.orderBy('date').reverse().toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []
  const paidByDoc = calcPaidByDoc(payments)

  function statusChip(d: Doc) {
    if (d.direction === 'in') return <span className="chip in">Входящий</span>
    if (d.docType === 'invoice' && d.status !== 'draft') {
      const paid = paidByDoc.get(d.id!) ?? 0
      if (paid >= d.total - 0.005) return <span className="chip paid">Оплачен</span>
      if (paid > 0) return <span className="chip issued">Част. {money(paid)}</span>
    }
    return <span className={`chip ${d.status}`}>{STATUS_LABELS[d.status]}</span>
  }

  const filtered = docs.filter(d =>
    (dir === 'all' || d.direction === dir) &&
    (type === 'all' || d.docType === type) &&
    (!q || d.counterpartyName.toLowerCase().includes(q.toLowerCase()) || d.number.includes(q))
  )

  function exportCSV() {
    const rows: (string | number)[][] = [['Дата', 'Направление', 'Тип', 'Номер', 'Контрагент', 'Сумма', 'в т.ч. НДС', 'Статус']]
    for (const d of filtered) {
      rows.push([fmtDate(d.date), d.direction === 'out' ? 'Исходящий' : 'Входящий',
        DOC_TYPE_LABELS[d.docType], d.number, d.counterpartyName, d.total, d.vatTotal,
        d.direction === 'in' ? '' : STATUS_LABELS[d.status]])
    }
    downloadFile('реестр-документов.csv', toCSV(rows), 'text/csv')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Документы</h1>
          <div className="sub">Реестр исходящих и входящих первичных документов.</div>
        </div>
        <Link className="btn primary" to="/docs/new">+ Новый документ</Link>
      </div>

      <div className="toolbar">
        <select value={dir} onChange={e => setDir(e.target.value as Direction | 'all')} style={{ width: 150 }}>
          <option value="all">Все направления</option>
          <option value="out">Исходящие</option>
          <option value="in">Входящие</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value as DocType | 'all')} style={{ width: 210 }}>
          <option value="all">Все типы</option>
          {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
        </select>
        <input placeholder="Контрагент или номер…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <div className="spacer" />
        <button className="btn" onClick={exportCSV} disabled={filtered.length === 0}>Экспорт CSV</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Документов по выбранным условиям нет.</div>
      ) : (
        <table className="list">
          <thead><tr><th>Дата</th><th>Документ</th><th>Контрагент</th><th className="num">Сумма, {CUR}</th><th className="num">НДС, {CUR}</th><th>Статус</th></tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="clickable" onClick={() => location.hash = `#/docs/${d.id}`}>
                <td>{fmtDate(d.date)}</td>
                <td>{d.direction === 'in' ? '← ' : ''}<b>{DOC_TYPE_SHORT[d.docType]}</b> № {d.number}</td>
                <td>{d.counterpartyName}</td>
                <td className="num">{money(d.total)}</td>
                <td className="num">{d.vatTotal ? money(d.vatTotal) : '—'}</td>
                <td>{statusChip(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
