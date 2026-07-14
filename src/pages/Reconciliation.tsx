import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DOC_TYPE_LABELS, getSettings, type Settings, type Doc, type Payment } from '../db'
import { money, fmtDate, fmtDateLong, todayISO } from '../utils'
import { PrintPortal } from '../PrintForms'

export default function Reconciliation() {
  const [params] = useSearchParams()
  const [cpId, setCpId] = useState(() => Number(params.get('cp') || 0))
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(todayISO())
  const [includeDrafts, setIncludeDrafts] = useState(false)
  const [includeInvoices, setIncludeInvoices] = useState(false)     // счета на оплату обычно не участвуют в сверке
  const [includeVatInvoices, setIncludeVatInvoices] = useState(false) // СФ дублируют оборот АВР/накладных
  const [signed, setSigned] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => { getSettings().then(setSettings) }, [])

  const counterparties = useLiveQuery(() => db.counterparties.orderBy('name').toArray(), []) ?? []
  const docs = useLiveQuery(() => cpId ? db.docs.where('counterpartyId').equals(cpId).toArray() : Promise.resolve([] as Doc[]), [cpId]) ?? []
  const cpPayments = useLiveQuery(() => cpId ? db.payments.where('counterpartyId').equals(cpId).toArray() : Promise.resolve([] as Payment[]), [cpId]) ?? []
  const cp = counterparties.find(c => c.id === cpId)

  interface Row { key: string; date: string; label: string; debit: number; credit: number }

  const allRows: Row[] = useMemo(() => {
    const res: Row[] = []
    for (const d of docs) {
      if (!(includeDrafts || d.status !== 'draft' || d.direction === 'in')) continue
      if (!(includeInvoices || d.docType !== 'invoice')) continue
      if (!includeVatInvoices && d.docType === 'vat_invoice') continue
      res.push({
        key: `d${d.id}`, date: d.date,
        label: `${DOC_TYPE_LABELS[d.docType]} № ${d.number} от ${fmtDate(d.date)}${d.contractRef ? ` (${d.contractRef})` : ''}`,
        debit: d.direction === 'out' ? d.total : 0,
        credit: d.direction === 'in' ? d.total : 0,
      })
    }
    for (const p of cpPayments) {
      res.push({
        key: `p${p.id}`, date: p.date,
        label: `${p.direction === 'in' ? 'Оплата (входящая)' : 'Оплата (исходящая)'}${p.purpose ? ` — ${p.purpose}` : ''} от ${fmtDate(p.date)}`,
        debit: p.direction === 'out' ? p.amount : 0,
        credit: p.direction === 'in' ? p.amount : 0,
      })
    }
    return res.sort((a, b) => a.date.localeCompare(b.date))
  }, [docs, cpPayments, includeDrafts, includeInvoices, includeVatInvoices])

  const rows = useMemo(() => allRows.filter(r => r.date >= from && r.date <= to), [allRows, from, to])

  // сальдо на начало периода
  const opening = useMemo(() =>
    allRows.filter(r => r.date < from).reduce((s, r) => s + r.debit - r.credit, 0),
    [allRows, from])

  const debit = rows.reduce((s, r) => s + r.debit, 0)
  const credit = rows.reduce((s, r) => s + r.credit, 0)
  const closing = opening + debit - credit

  const my = settings ? `${settings.companyType} «${settings.companyName}»` : ''
  const their = cp ? `${cp.type} «${cp.name}»` : ''

  // ячейки дебет/кредит для сальдо: положительное — в дебет нашей стороны
  const balCells = (v: number) => ({ d: v > 0 ? money(v) : '', k: v < 0 ? money(-v) : '' })
  const ob = balCells(opening), cb = balCells(closing)

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1>Акт сверки взаимных расчётов</h1>
          <div className="sub">Дебет — наша реализация контрагенту, кредит — его реализация нам. Формат соответствует общепринятой форме (1С).</div>
        </div>
        <button className="btn primary" disabled={!cpId || (rows.length === 0 && opening === 0)} onClick={() => window.print()}>Печать / PDF</button>
      </div>

      <div className="card no-print" style={{ marginBottom: 18 }}>
        <div className="grid c3">
          <div className="field">
            <label>Контрагент</label>
            <select value={cpId} onChange={e => setCpId(Number(e.target.value))}>
              <option value={0}>— выберите —</option>
              {counterparties.map(c => <option key={c.id} value={c.id}>{c.type} «{c.name}»</option>)}
            </select>
          </div>
          <div className="field"><label>Период с</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="field"><label>по</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="muted"><input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={includeInvoices} onChange={e => setIncludeInvoices(e.target.checked)} />учитывать счета на оплату</label>
          <label className="muted"><input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={includeVatInvoices} onChange={e => setIncludeVatInvoices(e.target.checked)} />учитывать счета-фактуры</label>
          <label className="muted"><input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={includeDrafts} onChange={e => setIncludeDrafts(e.target.checked)} />учитывать черновики</label>
          <label className="muted"><input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={signed} onChange={e => setSigned(e.target.checked)} />подпись и печать с нашей стороны</label>
        </div>
      </div>

      {!cpId ? (
        <div className="empty no-print">Выберите контрагента для формирования сверки.</div>
      ) : rows.length === 0 && opening === 0 ? (
        <div className="empty no-print">За выбранный период документов с этим контрагентом нет.</div>
      ) : (
        <div className="no-print">
          <table className="list">
            <thead><tr><th>Дата</th><th>Документ</th><th className="num">Дебет, ₸</th><th className="num">Кредит, ₸</th></tr></thead>
            <tbody>
              <tr><td colSpan={2}><b>Сальдо на начало {fmtDate(from)}</b></td><td className="num"><b>{ob.d}</b></td><td className="num"><b>{ob.k}</b></td></tr>
              {rows.map(r => (
                <tr key={r.key}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.label}</td>
                  <td className="num">{r.debit ? money(r.debit) : ''}</td>
                  <td className="num">{r.credit ? money(r.credit) : ''}</td>
                </tr>
              ))}
              <tr><td colSpan={2}><b>Обороты за период</b></td><td className="num"><b>{money(debit)}</b></td><td className="num"><b>{money(credit)}</b></td></tr>
              <tr><td colSpan={2}><b>Сальдо на конец {fmtDate(to)}</b></td><td className="num"><b>{cb.d}</b></td><td className="num"><b>{cb.k}</b></td></tr>
            </tbody>
          </table>
          <div className="total-line">
            {closing === 0
              ? <>Задолженность отсутствует — расчёты закрыты.</>
              : <>Задолженность в пользу <b>{closing > 0 ? my : their}</b>: <b>{money(Math.abs(closing))} ₸</b></>}
          </div>
        </div>
      )}

      {/* ---------- Печатная форма (двусторонняя, по образцу 1С) ---------- */}
      {cp && settings && (rows.length > 0 || opening !== 0) && (
        <PrintPortal>
          <h3 style={{ marginBottom: '2pt' }}>Акт сверки</h3>
          <div style={{ textAlign: 'center', fontSize: '10.5pt' }}>
            взаимных расчетов за период с {fmtDate(from)} по {fmtDate(to)}<br />
            между <b>{my}</b> и <b>{their}</b>
          </div>
          <p className="small" style={{ marginTop: '8pt' }}>
            Мы, нижеподписавшиеся, <b>{my}</b>, с одной стороны, и <b>{their}</b>, с другой стороны,
            составили настоящий акт сверки в том, что состояние взаимных расчетов по данным учета следующее:
          </p>
          <table className="p">
            <thead>
              <tr>
                <th colSpan={2} rowSpan={2} style={{ width: '34%' }}>Текст записи</th>
                <th colSpan={2}>По данным {my}, KZT</th>
                <th colSpan={2}>По данным {their}, KZT</th>
              </tr>
              <tr>
                <th style={{ width: '13%' }}>Дебет</th>
                <th style={{ width: '13%' }}>Кредит</th>
                <th style={{ width: '13%' }}>Дебет</th>
                <th style={{ width: '13%' }}>Кредит</th>
              </tr>
              <tr>
                <th style={{ width: '10%' }}>Дата</th>
                <th>Документ</th>
                <th></th><th></th><th></th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2}>Сальдо на начало {fmtDateLong(from)}</td>
                <td className="pnum">{ob.d}</td><td className="pnum">{ob.k}</td>
                <td className="pnum">{ob.k}</td><td className="pnum">{ob.d}</td>
              </tr>
              {rows.map(r => (
                <tr key={r.key}>
                  <td style={{ textAlign: 'center' }}>{fmtDate(r.date)}</td>
                  <td>{r.label}</td>
                  <td className="pnum">{r.debit ? money(r.debit) : ''}</td>
                  <td className="pnum">{r.credit ? money(r.credit) : ''}</td>
                  <td className="pnum">{r.credit ? money(r.credit) : ''}</td>
                  <td className="pnum">{r.debit ? money(r.debit) : ''}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ fontWeight: 'bold' }}>Обороты за период</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{money(debit)}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{money(credit)}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{money(credit)}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{money(debit)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ fontWeight: 'bold' }}>Сальдо на конец {fmtDateLong(to)}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{cb.d}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{cb.k}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{cb.k}</td>
                <td className="pnum" style={{ fontWeight: 'bold' }}>{cb.d}</td>
              </tr>
            </tbody>
          </table>
          <p className="small" style={{ marginTop: '8pt' }}>
            По данным {my}<br />
            на {fmtDate(to)} задолженность {closing === 0
              ? <>отсутствует, взаимные расчеты закрыты.</>
              : <>в пользу <b>{closing > 0 ? my : their}</b> <b>{money(Math.abs(closing))} KZT</b></>}
          </p>
          <table className="p bare-outer" style={{ marginTop: '12pt' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }} className="sig-wrap">
                  От {my}<br />
                  БИН/ИИН: {settings.binIin}
                  <div style={{ marginTop: '16pt' }}>Руководитель ______________ ({settings.director || '____________________'})</div>
                  {signed && settings.signImage && <img className="sig-img" src={settings.signImage} alt="" style={{ left: '22%' }} />}
                  {signed && settings.stampImage && <img className="stamp-img" src={settings.stampImage} alt="" style={{ left: '50%' }} />}
                  <div style={{ marginTop: '10pt' }}>М.П.&nbsp;&nbsp;&nbsp;<span className="cap">подпись</span></div>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  От {their}<br />
                  БИН/ИИН: {cp.binIin}
                  <div style={{ marginTop: '16pt' }}>Руководитель ______________ (____________________)</div>
                  <div style={{ marginTop: '10pt' }}>М.П.&nbsp;&nbsp;&nbsp;<span className="cap">подпись</span></div>
                </td>
              </tr>
            </tbody>
          </table>
        </PrintPortal>
      )}
    </div>
  )
}
