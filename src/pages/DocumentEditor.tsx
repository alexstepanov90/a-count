import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import {
  db, calcLine, calcDoc, calcStock, calcPaidByDoc, nextDocNumber, getSettings,
  DOC_TYPE_LABELS, DOC_TYPE_SHORT, STATUS_LABELS,
  type Doc, type DocLine, type DocType, type Direction, type DocStatus, type Settings, type Counterparty,
  CUR,
} from '../db'
import { money, fmtDate, amountInWordsKZT, todayISO } from '../utils'
import { DocPrint } from '../PrintForms'

const EMPTY_LINE: DocLine = { name: '', unit: 'усл.', qty: 1, price: 0, vatRate: 16 }

export default function DocumentEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()

  const [doc, setDoc] = useState<Doc | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const counterparties = useLiveQuery(() => db.counterparties.orderBy('name').toArray(), []) ?? []
  const items = useLiveQuery(() => db.items.orderBy('name').toArray(), []) ?? []

  // загрузка настроек + документа (или заготовки нового)
  useEffect(() => {
    (async () => {
      const s = await getSettings()
      setSettings(s)
      if (id) {
        const existing = await db.docs.get(Number(id))
        if (existing) setDoc(existing)
      } else {
        const docType = (params.get('type') as DocType) || 'invoice'
        const date = todayISO()
        const baseId = Number(params.get('base') || 0)
        const base = baseId ? await db.docs.get(baseId) : undefined
        setDoc({
          docType, direction: base?.direction ?? 'out',
          number: await nextDocNumber(docType, date, s.numberPrefix || ''),
          date,
          counterpartyId: base?.counterpartyId ?? 0,
          counterpartyName: base?.counterpartyName ?? '',
          contractRef: base
            ? (base.contractRef || `${DOC_TYPE_LABELS[base.docType]} № ${base.number} от ${base.date.split('-').reverse().join('.')}`)
            : '',
          status: 'draft',
          baseDocId: base?.id,
          lines: base
            ? base.lines.map(l => ({ ...l }))
            : [{ ...EMPTY_LINE, vatRate: s.vatPayer ? s.defaultVatRate : null }],
          total: 0, vatTotal: 0, createdAt: 0, updatedAt: 0,
        })
      }
    })()
  }, [id])

  const payments = useLiveQuery(
    () => doc?.id ? db.payments.where('docId').equals(doc.id).toArray() : Promise.resolve([] as import('../db').Payment[]),
    [doc?.id]) ?? []
  const related = useLiveQuery(
    () => doc?.id ? db.docs.where('baseDocId').equals(doc.id).toArray() : Promise.resolve([] as Doc[]),
    [doc?.id]) ?? []
  const baseDoc = useLiveQuery(
    () => doc?.baseDocId ? db.docs.get(doc.baseDocId) : Promise.resolve(undefined as Doc | undefined),
    [doc?.baseDocId])
  const waybills = useLiveQuery(() => db.docs.where('docType').equals('waybill').toArray(), []) ?? []
  const stock = useMemo(() => calcStock(waybills.filter(w => w.id !== doc?.id)), [waybills, doc?.id])
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0)

  const cp: Counterparty | undefined = useMemo(
    () => counterparties.find(c => c.id === doc?.counterpartyId),
    [counterparties, doc?.counterpartyId])

  if (!doc || !settings) return <div className="muted">Загрузка…</div>

  const totals = calcDoc(doc.lines, settings.pricesIncludeVat)

  function setLine(i: number, patch: Partial<DocLine>) {
    setDoc(d => d && ({ ...d, lines: d.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }))
  }

  function pickItem(i: number, itemId: number) {
    const it = items.find(x => x.id === itemId)
    if (it) setLine(i, { itemId, name: it.name, unit: it.unit, price: it.price, vatRate: it.vatRate })
  }

  async function changeType(t: DocType) {
    if (!doc) return
    const number = doc.id ? doc.number : await nextDocNumber(t, doc.date, settings!.numberPrefix || '')
    setDoc({ ...doc, docType: t, number })
  }

  async function save(andPrint = false) {
    if (!doc) return
    if (!doc.counterpartyId) { alert('Выберите контрагента'); return }
    if (doc.lines.length === 0 || doc.lines.every(l => !l.name.trim())) { alert('Добавьте хотя бы одну строку'); return }
    const now = Date.now()
    const clean: Doc = {
      ...doc,
      counterpartyName: cp?.name ?? doc.counterpartyName,
      lines: doc.lines.filter(l => l.name.trim()),
      total: totals.total, vatTotal: totals.vatTotal,
      updatedAt: now,
    }
    let docId = doc.id
    if (docId) await db.docs.put({ ...clean, id: docId })
    else {
      docId = await db.docs.add({ ...clean, createdAt: now })
      nav(`/docs/${docId}`, { replace: true })
    }
    if (andPrint) setTimeout(() => window.print(), 150)
  }

  async function remove() {
    if (doc && doc.id && confirm('Удалить документ безвозвратно?')) {
      await db.docs.delete(doc.id)
      nav('/docs')
    }
  }

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1>{doc.id ? `${DOC_TYPE_LABELS[doc.docType]} № ${doc.number}` : 'Новый документ'}</h1>
          <div className="sub">{doc.direction === 'out' ? 'Исходящий' : 'Входящий'} · {fmtDate(doc.date)}</div>
        </div>
        <div className="row">
          {doc.id && <button className="btn danger" onClick={remove}>Удалить</button>}
          <button className="btn" onClick={() => save(false)}>Сохранить</button>
          <button className="btn primary" onClick={() => save(true)}>Сохранить и печать / PDF</button>
        </div>
      </div>

      <div className="card no-print">
        <div className="grid c3">
          <div className="field">
            <label>Тип документа</label>
            <select value={doc.docType} onChange={e => changeType(e.target.value as DocType)}>
              {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Направление</label>
            <select value={doc.direction} onChange={e => setDoc({ ...doc, direction: e.target.value as Direction })}>
              <option value="out">Исходящий (мы выставляем)</option>
              <option value="in">Входящий (нам выставили)</option>
            </select>
          </div>
          <div className="field">
            <label>Статус</label>
            <select value={doc.status} onChange={e => setDoc({ ...doc, status: e.target.value as DocStatus })} disabled={doc.direction === 'in'}>
              {(Object.keys(STATUS_LABELS) as DocStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Номер</label>
            <input value={doc.number} onChange={e => setDoc({ ...doc, number: e.target.value })} />
          </div>
          <div className="field">
            <label>Дата</label>
            <input type="date" value={doc.date} onChange={e => setDoc({ ...doc, date: e.target.value })} />
          </div>
          <div className="field">
            <label>{doc.direction === 'out' ? 'Контрагент (покупатель)' : 'Контрагент (поставщик)'}</label>
            <select value={doc.counterpartyId} onChange={e => setDoc({ ...doc, counterpartyId: Number(e.target.value) })}>
              <option value={0}>— выберите —</option>
              {counterparties.map(c => <option key={c.id} value={c.id}>{c.type} «{c.name}»</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Основание (договор, счёт и т.п.)</label>
            <input value={doc.contractRef ?? ''} onChange={e => setDoc({ ...doc, contractRef: e.target.value })}
                   placeholder="Договор № 12 от 01.02.2026" />
          </div>

          {doc.docType === 'waybill' && (<>
            <div className="field">
              <label>Ответственный за поставку (Ф.И.О.)</label>
              <input value={doc.extra?.responsible ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, responsible: e.target.value } })} />
            </div>
            <div className="field">
              <label>Транспортная организация</label>
              <input value={doc.extra?.transport ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, transport: e.target.value } })} />
            </div>
            <div className="field">
              <label>ТТН (номер, дата)</label>
              <input value={doc.extra?.ttn ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, ttn: e.target.value } })} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Доверенность (№, дата, кем выдана)</label>
              <input value={doc.extra?.proxy ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, proxy: e.target.value } })} />
            </div>
          </>)}
          {doc.docType === 'vat_invoice' && (<>
            <div className="field">
              <label>Условия оплаты по договору</label>
              <input value={doc.extra?.paymentTerms ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, paymentTerms: e.target.value } })} placeholder="100% предоплата" />
            </div>
            <div className="field">
              <label>Пункт назначения</label>
              <input value={doc.extra?.destination ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, destination: e.target.value } })} placeholder="Казахстан, г. Алматы" />
            </div>
            <div className="field">
              <label>Способ отправления</label>
              <input value={doc.extra?.transport ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, transport: e.target.value } })} />
            </div>
          </>)}
          {doc.docType === 'act' && (
            <div className="field">
              <label>Приложение: документация, страниц</label>
              <input value={doc.extra?.attachmentPages ?? ''} onChange={e => setDoc({ ...doc, extra: { ...doc.extra, attachmentPages: e.target.value } })} />
            </div>
          )}
        </div>

        {doc.direction === 'out' && (
          <div className="row" style={{ marginTop: 12, padding: '10px 12px', background: 'var(--brass-soft)', borderRadius: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!doc.signed}
                     onChange={e => setDoc({ ...doc, signed: e.target.checked })} />
              Проставить подпись и печать в документе (для отправки в электронном виде)
            </label>
            {doc.signed && !settings.signImage && !settings.stampImage && (
              <span className="muted">— сканы не загружены: добавьте их в «Мои реквизиты»</span>
            )}
          </div>
        )}

        <h2>Строки</h2>
        <table className="list">
          <thead>
            <tr>
              <th style={{ width: 30 }}>№</th><th>Наименование</th><th style={{ width: 170 }}>Из справочника</th>
              <th style={{ width: 70 }}>Ед.</th><th style={{ width: 80 }} className="num">Кол-во</th>
              <th style={{ width: 110 }} className="num">Цена, {CUR}</th><th style={{ width: 90 }}>НДС</th>
              <th style={{ width: 110 }} className="num">Сумма, {CUR}</th><th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const c = calcLine(l, settings.pricesIncludeVat)
              return (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  <td><input value={l.name} onChange={e => setLine(i, { name: e.target.value })} placeholder="Наименование работ/услуг/товара" /></td>
                  <td>
                    <select value={l.itemId ?? 0} onChange={e => pickItem(i, Number(e.target.value))}>
                      <option value={0}>—</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                  </td>
                  <td><input value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} /></td>
                  <td><input className="num" type="number" value={l.qty} onChange={e => setLine(i, { qty: Number(e.target.value) })} /></td>
                  <td><input className="num" type="number" value={l.price} onChange={e => setLine(i, { price: Number(e.target.value) })} /></td>
                  <td>
                    <input className="num" type="number" min={0} max={100} step={0.1}
                           value={l.vatRate ?? ''} placeholder="без"
                           title="Ставка НДС, %. Пусто — без НДС"
                           onChange={e => setLine(i, { vatRate: e.target.value === '' ? null : Number(e.target.value) })} />
                  </td>
                  <td className="num">
                    {money(c.total)}
                    {doc.docType === 'waybill' && doc.direction === 'out' && l.itemId && (() => {
                      const have = stock.get(l.itemId) ?? 0
                      return have < l.qty
                        ? <div style={{ color: 'var(--red)', fontSize: 12 }}>на складе {have}!</div>
                        : <div className="muted" style={{ fontSize: 12 }}>на складе {have}</div>
                    })()}
                  </td>
                  <td><button className="btn small danger" title="Удалить строку"
                        onClick={() => setDoc({ ...doc, lines: doc.lines.filter((_, j) => j !== i) })}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn small" onClick={() => setDoc({ ...doc, lines: [...doc.lines, { ...EMPTY_LINE, vatRate: settings.vatPayer ? settings.defaultVatRate : null }] })}>+ Добавить строку</button>
          <div className="spacer" />
        </div>
        <div className="total-line">
          в т.ч. НДС: {money(totals.vatTotal)} {CUR} &nbsp;·&nbsp; Итого: <b>{money(totals.total)} {CUR}</b>
          <div className="muted">{amountInWordsKZT(totals.total)}</div>
        </div>
      </div>

      {doc.id && (
        <div className="card no-print" style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Связанные документы и оплаты</h2>
          {baseDoc && (
            <div style={{ marginBottom: 8 }}>
              Создан на основании: <Link to={`/docs/${baseDoc.id}`}>{DOC_TYPE_SHORT[baseDoc.docType]} № {baseDoc.number} от {fmtDate(baseDoc.date)}</Link>
            </div>
          )}
          {related.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              На основании этого документа: {related.map((r, i) => (
                <span key={r.id}>{i > 0 && ' · '}<Link to={`/docs/${r.id}`}>{DOC_TYPE_SHORT[r.docType]} № {r.number}</Link></span>
              ))}
            </div>
          )}
          {doc.direction === 'out' && (
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="muted">Выставить на основании:</span>
              {doc.docType !== 'vat_invoice' && <Link className="btn small" to={`/docs/new?type=vat_invoice&base=${doc.id}`}>Счёт-фактуру</Link>}
              {doc.docType !== 'act' && <Link className="btn small" to={`/docs/new?type=act&base=${doc.id}`}>АВР</Link>}
              {doc.docType !== 'waybill' && <Link className="btn small" to={`/docs/new?type=waybill&base=${doc.id}`}>Накладную</Link>}
              <Link className="btn small" to={`/recon?cp=${doc.counterpartyId}`}>Акт сверки с контрагентом</Link>
            </div>
          )}
          {doc.docType === 'invoice' && doc.direction === 'out' && (
            <div>
              <b>Оплата: </b>
              {paidTotal >= totals.total - 0.005
                ? <span className="chip paid">Оплачен полностью</span>
                : paidTotal > 0
                  ? <span className="chip issued">Оплачено {money(paidTotal)} из {money(totals.total)} {CUR} · остаток {money(totals.total - paidTotal)} {CUR}</span>
                  : <span className="chip draft">Не оплачен</span>}
              {payments.length > 0 && (
                <span className="muted"> — {payments.map(p => `${fmtDate(p.date)}: ${money(p.amount)} {CUR}`).join('; ')}</span>
              )}
              <div className="row" style={{ marginTop: 8 }}>
                <Link className="btn small" to="/bank">+ Внести оплату (Банк и оплаты)</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Печатная форма (портал, вне интерфейса) ---------- */}
      <DocPrint doc={{ ...doc, total: totals.total, vatTotal: totals.vatTotal }} cp={cp} s={settings} />
    </div>
  )
}
