import { useEffect, useRef, useState } from 'react'
import { db, getSettings, exportBackup, importBackup, type Settings } from '../db'
import { downloadFile, todayISO, imageFileToDataURL } from '../utils'

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getSettings().then(setS) }, [])
  if (!s) return <div className="muted">Загрузка…</div>

  async function save() {
    if (!s) return
    const existing = await db.settings.toCollection().first()
    const curChanged = existing && (existing.currencySymbol !== s.currencySymbol || existing.currencyCode !== s.currencyCode)
    if (existing?.id) await db.settings.update(existing.id, { ...s })
    else await db.settings.add({ ...s })
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
    if (curChanged) setTimeout(() => location.reload(), 600) // применяем валюту во всём интерфейсе
  }

  async function doExport() {
    downloadFile(`prostoychet-backup-${todayISO()}.json`, await exportBackup())
  }

  async function doImport(f: File) {
    if (!confirm('Импорт полностью заменит текущие данные. Продолжить?')) return
    try {
      await importBackup(await f.text())
      alert('Данные восстановлены.')
    } catch (e: any) {
      alert('Ошибка импорта: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Мои реквизиты</h1>
          <div className="sub">Эти данные автоматически подставляются во все исходящие документы.</div>
        </div>
        <button className="btn primary" onClick={save}>{saved ? '✓ Сохранено' : 'Сохранить'}</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Профиль пользователя</h2>
        <div className="grid c3">
          <div className="field">
            <label>Имя</label>
            <input value={s.ownerName ?? ''} onChange={e => setS({ ...s, ownerName: e.target.value })} />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input value={s.ownerEmail ?? ''} onChange={e => setS({ ...s, ownerEmail: e.target.value })} />
          </div>
          <div className="field">
            <label>Соглашение принято</label>
            <input value={s.agreementAcceptedAt ? new Date(s.agreementAcceptedAt).toLocaleString('ru-RU') : '—'} disabled />
          </div>
        </div>

        <h2>Реквизиты организации</h2>
        <div className="grid c3">
          <div className="field">
            <label>Форма</label>
            <select value={s.companyType} onChange={e => setS({ ...s, companyType: e.target.value })}>
              {['ТОО', 'ИП', 'АО', 'Прочее'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '2 / -1' }}>
            <label>Наименование</label>
            <input value={s.companyName} onChange={e => setS({ ...s, companyName: e.target.value })} placeholder="A-LEX Legal Services" />
          </div>
          <div className="field">
            <label>БИН / ИИН</label>
            <input value={s.binIin} onChange={e => setS({ ...s, binIin: e.target.value })} maxLength={12} />
          </div>
          <div className="field" style={{ gridColumn: '2 / -1' }}>
            <label>Юридический адрес</label>
            <input value={s.address ?? ''} onChange={e => setS({ ...s, address: e.target.value })} />
          </div>
          <div className="field">
            <label>Телефон</label>
            <input value={s.phone ?? ''} onChange={e => setS({ ...s, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input value={s.email ?? ''} onChange={e => setS({ ...s, email: e.target.value })} />
          </div>
        </div>

        <h2>Банковские реквизиты</h2>
        <div className="grid c3">
          <div className="field">
            <label>Банк</label>
            <input value={s.bankName ?? ''} onChange={e => setS({ ...s, bankName: e.target.value })} placeholder="АО «Народный Банк Казахстана»" />
          </div>
          <div className="field">
            <label>ИИК (IBAN)</label>
            <input value={s.iik ?? ''} onChange={e => setS({ ...s, iik: e.target.value })} placeholder="KZ…" />
          </div>
          <div className="field">
            <label>БИК</label>
            <input value={s.bik ?? ''} onChange={e => setS({ ...s, bik: e.target.value })} />
          </div>
          <div className="field">
            <label>Кбе</label>
            <input value={s.kbe ?? ''} onChange={e => setS({ ...s, kbe: e.target.value })} placeholder="17" />
          </div>
          <div className="field">
            <label>КНП по умолчанию (для счетов)</label>
            <input value={s.knp ?? ''} onChange={e => setS({ ...s, knp: e.target.value })} placeholder="859" />
          </div>
        </div>

        <h2>Страна и валюта</h2>
        <div className="grid c3">
          <div className="field">
            <label>Страна</label>
            <input value={s.country ?? 'Казахстан'} onChange={e => setS({ ...s, country: e.target.value })} />
          </div>
          <div className="field">
            <label>Символ валюты</label>
            <input value={s.currencySymbol ?? '₸'} onChange={e => setS({ ...s, currencySymbol: e.target.value })} placeholder="₸ / $ / € / сум" />
          </div>
          <div className="field">
            <label>Код валюты</label>
            <input value={s.currencyCode ?? 'KZT'} onChange={e => setS({ ...s, currencyCode: e.target.value.toUpperCase() })} placeholder="KZT / USD / EUR" maxLength={5} />
          </div>
        </div>
        <p className="muted">
          Все ставки и суммы в платформе вариативны: НДС — любое число, налоги — свои ставки или фиксированные суммы.
          Печатные формы Р-1 и З-2 остаются по казахстанскому приказу № 562; для других стран используйте счёт и АВР как универсальные.
        </p>

        <h2>НДС и подписи</h2>
        <div className="grid c3">
          <div className="field">
            <label>Плательщик НДС</label>
            <select value={s.vatPayer ? '1' : '0'} onChange={e => setS({ ...s, vatPayer: e.target.value === '1' })}>
              <option value="1">Да</option><option value="0">Нет</option>
            </select>
          </div>
          <div className="field">
            <label>Ставка НДС по умолчанию, %</label>
            <input className="num" type="number" min={0} max={100} step={0.1}
                   value={s.defaultVatRate} onChange={e => setS({ ...s, defaultVatRate: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Цены в строках</label>
            <select value={s.pricesIncludeVat ? '1' : '0'} onChange={e => setS({ ...s, pricesIncludeVat: e.target.value === '1' })}>
              <option value="1">включают НДС</option>
              <option value="0">без НДС (начислять сверху)</option>
            </select>
          </div>
          <div className="field">
            <label>Свидетельство по НДС</label>
            <input value={s.vatCertificate ?? ''} onChange={e => setS({ ...s, vatCertificate: e.target.value })} placeholder="Серия, №, дата" />
          </div>
          <div className="field">
            <label>Руководитель (для подписи)</label>
            <input value={s.director ?? ''} onChange={e => setS({ ...s, director: e.target.value })} />
          </div>
          <div className="field">
            <label>Бухгалтер (для подписи)</label>
            <input value={s.accountant ?? ''} onChange={e => setS({ ...s, accountant: e.target.value })} />
          </div>
          <div className="field">
            <label>Префикс номеров документов</label>
            <input value={s.numberPrefix ?? ''} onChange={e => setS({ ...s, numberPrefix: e.target.value })} placeholder="напр. AL-" />
          </div>
        </div>
      </div>

      <h2>Подпись и печать (сканы)</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Загрузите PNG или JPG (лучше PNG с прозрачным фоном — вырезать фон можно в «Просмотре» на Mac:
          Инструменты → Мгновенный альфа-канал). Если в документе поставить галочку
          «Проставить подпись и печать», сканы автоматически лягут на подпись руководителя —
          документ можно сразу сохранить в PDF и отправить контрагенту без распечатывания.
          Сканы хранятся только на этом устройстве, как и все данные.
        </p>
        <div className="grid c2">
          <ImageSlot label="Подпись руководителя" value={s.signImage} onChange={v => setS({ ...s, signImage: v })} h={60} />
          <ImageSlot label="Оттиск печати" value={s.stampImage} onChange={v => setS({ ...s, stampImage: v })} h={110} />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Не забудьте нажать «Сохранить» вверху страницы после загрузки.
        </p>
      </div>

      <h2>Резервная копия</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Все данные хранятся только в этом браузере/приложении. Регулярно сохраняйте резервную копию —
          один JSON-файл содержит всё: контрагентов, номенклатуру, документы и настройки.
          Этим же файлом можно перенести данные на другое устройство.
        </p>
        <div className="row">
          <button className="btn primary" onClick={doExport}>Скачать резервную копию</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Восстановить из файла…</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
                 onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
        </div>
      </div>
    </div>
  )
}


function ImageSlot({ label, value, onChange, h }: { label: string; value?: string; onChange: (v?: string) => void; h: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 180, height: h + 20, border: '1px dashed var(--line)', borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', overflow: 'hidden' }}>
          {value ? <img src={value} alt="" style={{ maxHeight: h, maxWidth: 170 }} /> : <span className="muted">нет</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="btn small" style={{ cursor: 'pointer' }}>
            Загрузить…
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                   onChange={async e => {
                     const f = e.target.files?.[0]
                     if (!f) return
                     try { onChange(await imageFileToDataURL(f)) } catch (err: any) { alert(err.message) }
                     e.target.value = ''
                   }} />
          </label>
          {value && <button className="btn small danger" onClick={() => onChange(undefined)}>Убрать</button>}
        </div>
      </div>
    </div>
  )
}
