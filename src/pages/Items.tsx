import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, calcStock, type Item, type ItemKind , CUR } from '../db'
import { money } from '../utils'

const EMPTY: Item = { name: '', kind: 'услуга', unit: 'усл.', price: 0, vatRate: 16, notes: '', createdAt: 0, updatedAt: 0 }

export default function Items() {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)
  const list = useLiveQuery(() => db.items.orderBy('name').toArray(), []) ?? []
  const docs = useLiveQuery(() => db.docs.where('docType').equals('waybill').toArray(), []) ?? []
  const stock = calcStock(docs)
  const filtered = q ? list.filter(i => i.name.toLowerCase().includes(q.toLowerCase())) : list

  async function save() {
    if (!editing) return
    if (!editing.name.trim()) { alert('Укажите наименование'); return }
    const now = Date.now()
    if (editing.id) await db.items.update(editing.id, { ...editing, updatedAt: now })
    else await db.items.add({ ...editing, createdAt: now, updatedAt: now })
    setEditing(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Товары и услуги</h1>
          <div className="sub">Номенклатура и остатки. Приход — по входящим накладным, расход — по исходящим.</div>
        </div>
        <button className="btn primary" onClick={() => setEditing({ ...EMPTY })}>+ Добавить позицию</button>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 300 }} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Справочник пуст. Добавьте услуги и товары, которые выставляете чаще всего.</div>
      ) : (
        <table className="list">
          <thead><tr><th>Наименование</th><th>Тип</th><th>Ед.</th><th className="num">Цена, {CUR}</th><th>НДС</th><th className="num">Остаток</th><th></th></tr></thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id}>
                <td><b>{i.name}</b></td>
                <td>{i.kind}</td>
                <td>{i.unit}</td>
                <td className="num">{money(i.price)}</td>
                <td>{i.vatRate === null ? 'без НДС' : `${i.vatRate}%`}</td>
                <td className="num">{i.kind === 'товар'
                  ? <b style={{ color: (stock.get(i.id!) ?? 0) < 0 ? 'var(--red)' : 'inherit' }}>{stock.get(i.id!) ?? 0} {i.unit}</b>
                  : <span className="muted">—</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small" onClick={() => setEditing({ ...i })}>Изменить</button>{' '}
                  <button className="btn small danger" onClick={() => confirm(`Удалить «${i.name}»?`) && db.items.delete(i.id!)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="modal">
            <h2>{editing.id ? 'Позиция' : 'Новая позиция'}</h2>
            <div className="grid c2">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Наименование</label>
                <input autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Юридические услуги по договору" />
              </div>
              <div className="field">
                <label>Тип</label>
                <select value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value as ItemKind })}>
                  <option value="услуга">Услуга</option>
                  <option value="работа">Работа</option>
                  <option value="товар">Товар</option>
                </select>
              </div>
              <div className="field">
                <label>Единица измерения</label>
                <input value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })} placeholder="шт / усл. / час" />
              </div>
              <div className="field">
                <label>Цена по умолчанию, {CUR}</label>
                <input className="num" type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Ставка НДС, % (пусто — без НДС)</label>
                <input className="num" type="number" min={0} max={100} step={0.1}
                       value={editing.vatRate ?? ''} placeholder="без НДС"
                       onChange={e => setEditing({ ...editing, vatRate: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setEditing(null)}>Отмена</button>
              <button className="btn primary" onClick={save}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
