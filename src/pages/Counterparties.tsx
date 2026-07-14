import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Counterparty, type CounterpartyType } from '../db'

const EMPTY: Counterparty = {
  name: '', type: 'ТОО', binIin: '', address: '', phone: '', email: '',
  contact: '', bankName: '', iik: '', bik: '', kbe: '17', vatCertificate: '',
  notes: '', createdAt: 0, updatedAt: 0,
}

export default function Counterparties() {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Counterparty | null>(null)
  const list = useLiveQuery(() => db.counterparties.orderBy('name').toArray(), []) ?? []

  const filtered = q
    ? list.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.binIin.includes(q))
    : list

  async function save() {
    if (!editing) return
    if (!editing.name.trim()) { alert('Укажите наименование'); return }
    const now = Date.now()
    if (editing.id) {
      await db.counterparties.update(editing.id, { ...editing, updatedAt: now })
      // обновляем денормализованное имя в документах
      await db.docs.where('counterpartyId').equals(editing.id).modify({ counterpartyName: editing.name })
    } else {
      await db.counterparties.add({ ...editing, createdAt: now, updatedAt: now })
    }
    setEditing(null)
  }

  async function remove(c: Counterparty) {
    const docCount = await db.docs.where('counterpartyId').equals(c.id!).count()
    if (docCount > 0) { alert(`Нельзя удалить: по контрагенту есть документы (${docCount} шт.)`); return }
    if (confirm(`Удалить контрагента «${c.name}»?`)) await db.counterparties.delete(c.id!)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Контрагенты</h1>
          <div className="sub">Покупатели и поставщики. Реквизиты подставляются в документы автоматически.</div>
        </div>
        <button className="btn primary" onClick={() => setEditing({ ...EMPTY })}>+ Новый контрагент</button>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск по названию или БИН/ИИН…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 340 }} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{q ? 'Ничего не найдено.' : 'Добавьте первого контрагента — и счета будут заполняться в два клика.'}</div>
      ) : (
        <table className="list">
          <thead><tr><th>Наименование</th><th>БИН / ИИН</th><th>Банк / ИИК</th><th>Контакты</th><th></th></tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td><b>{c.type} «{c.name}»</b>{c.contact && <div className="muted">{c.contact}</div>}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.binIin}</td>
                <td className="muted">{c.bankName}<br />{c.iik}</td>
                <td className="muted">{c.phone}<br />{c.email}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small" onClick={() => setEditing({ ...c })}>Изменить</button>{' '}
                  <button className="btn small danger" onClick={() => remove(c)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="modal">
            <h2>{editing.id ? 'Контрагент' : 'Новый контрагент'}</h2>
            <div className="grid c2">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Наименование (без организационной формы)</label>
                <input autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Golden Leaves" />
              </div>
              <div className="field">
                <label>Форма</label>
                <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as CounterpartyType })}>
                  {['ТОО', 'ИП', 'АО', 'Физлицо', 'Прочее'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>БИН / ИИН</label>
                <input value={editing.binIin} onChange={e => setEditing({ ...editing, binIin: e.target.value })} maxLength={12} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Юридический адрес</label>
                <input value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div className="field">
                <label>Банк</label>
                <input value={editing.bankName} onChange={e => setEditing({ ...editing, bankName: e.target.value })} placeholder="АО «Kaspi Bank»" />
              </div>
              <div className="field">
                <label>ИИК (IBAN)</label>
                <input value={editing.iik} onChange={e => setEditing({ ...editing, iik: e.target.value })} placeholder="KZ…" />
              </div>
              <div className="field">
                <label>БИК</label>
                <input value={editing.bik} onChange={e => setEditing({ ...editing, bik: e.target.value })} />
              </div>
              <div className="field">
                <label>Кбе</label>
                <input value={editing.kbe} onChange={e => setEditing({ ...editing, kbe: e.target.value })} />
              </div>
              <div className="field">
                <label>Контактное лицо</label>
                <input value={editing.contact} onChange={e => setEditing({ ...editing, contact: e.target.value })} />
              </div>
              <div className="field">
                <label>Телефон</label>
                <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>E-mail</label>
                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Свидетельство по НДС (если плательщик)</label>
                <input value={editing.vatCertificate} onChange={e => setEditing({ ...editing, vatCertificate: e.target.value })} placeholder="Серия, №, дата" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Заметки</label>
                <textarea rows={2} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
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
