import { useState } from 'react'
import { db, getSettings } from './db'
import Logo from './Logo'

const CURRENCIES = [
  { s: '₸', c: 'KZT', label: '₸ — тенге (KZT)' },
  { s: '$', c: 'USD', label: '$ — доллар США (USD)' },
  { s: '€', c: 'EUR', label: '€ — евро (EUR)' },
  { s: '₽', c: 'RUB', label: '₽ — рубль (RUB)' },
  { s: 'сум', c: 'UZS', label: 'сум — узбекский сум (UZS)' },
  { s: 'с', c: 'KGS', label: 'с — киргизский сом (KGS)' },
  { s: '', c: '', label: 'Другая (укажу в настройках)' },
]

export const AGREEMENT_VERSION = '1.0-beta'

const AGREEMENT = `ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ A-COUNT (версия ${AGREEMENT_VERSION})

1. НАЗНАЧЕНИЕ ПЛАТФОРМЫ
A-Count — программа для ведения УПРАВЛЕНЧЕСКОГО учёта малого бизнеса: справочники контрагентов и номенклатуры, выписка счетов, актов, накладных и счетов-фактур, учёт оплат, остатков, доходов и расходов, формирование актов сверки. Платформа является вспомогательным инструментом предпринимателя и не более того.

2. СТАТУС БЕТА-ВЕРСИИ
Вы используете тестовую (бета) версию. Возможны ошибки, неточности расчётов и изменения функциональности без предупреждения. Программа предоставляется «как есть» (as is), без каких-либо гарантий.

3. ХРАНЕНИЕ ДАННЫХ
Все данные хранятся ЛОКАЛЬНО на вашем устройстве (в хранилище браузера/приложения) и никуда не передаются. Разработчик не имеет доступа к вашим данным и не несёт ответственности за их утрату. Вы самостоятельно отвечаете за регулярное создание резервных копий (раздел «Мои реквизиты → Резервная копия») и за сохранность устройства.

4. НЕ ЗАМЕНЯЕТ ПЕРВИЧНУЮ ДОКУМЕНТАЦИЮ И БУХГАЛТЕРСКИЙ УЧЁТ
Платформа НЕ заменяет собой первичную учётную документацию, бухгалтерский и налоговый учёт, предусмотренные законодательством страны пользователя. Формируемые печатные формы носят вспомогательный характер; их применимость и юридическую силу вы обязаны проверить по законодательству своей юрисдикции (для Республики Казахстан — включая требования об электронных счетах-фактурах через ИС ЭСФ).

5. НАЛОГИ И ОБЯЗАТЕЛЬНЫЕ ПЛАТЕЖИ
Использование A-Count НЕ освобождает от уплаты налогов, сборов и обязательных платежей. Все расчёты налогов в платформе выполняются по ставкам, введённым вами вручную, являются справочными и НЕ учитывают особенности налоговых режимов, льгот, порогов и вычетов. Вы обязаны самостоятельно проверять расчёты и сверяться с налоговым законодательством своей страны и/или с профессиональным бухгалтером.

6. ОТВЕТСТВЕННОСТЬ
Разработчик не несёт ответственности за прямые или косвенные убытки, штрафы, пени и иные последствия, возникшие в связи с использованием или невозможностью использования платформы, в том числе за решения, принятые на основе её данных.

7. ПЕРСОНАЛЬНЫЕ ДАННЫЕ
Указанные при регистрации имя и e-mail сохраняются только на вашем устройстве и используются для персонализации и (в будущих версиях) синхронизации. В текущей локальной версии подтверждение по e-mail не выполняется, так как платформа не отправляет данные в сеть.

8. ПРИНЯТИЕ
Нажимая «Принимаю и начинаю работу», вы подтверждаете, что ознакомились с настоящим соглашением, понимаете назначение платформы как инструмента управленческого учёта и принимаете все его условия.`

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('Казахстан')
  const [curIdx, setCurIdx] = useState(0)
  const [agree, setAgree] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  async function accept() {
    if (!name.trim()) { alert('Укажите имя'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert('Укажите корректный e-mail'); return }
    if (!agree) { alert('Необходимо принять пользовательское соглашение'); return }
    const s = await getSettings()
    const cur = CURRENCIES[curIdx]
    const next = {
      ...s,
      ownerName: name.trim(), ownerEmail: email.trim(), country,
      currencySymbol: cur.s || s.currencySymbol || '₸',
      currencyCode: cur.c || s.currencyCode || 'KZT',
      agreementAcceptedAt: new Date().toISOString(),
    }
    const existing = await db.settings.toCollection().first()
    if (existing?.id) await db.settings.update(existing.id, next)
    else await db.settings.add(next)
    onDone()
  }

  return (
    <div className="welcome-back">
      <div className="welcome">
        <div style={{ marginBottom: 6 }}>
          <Logo variant="dark" height={72} />
          <div className="sub" style={{ marginTop: 6 }}>управленческий учёт для малого бизнеса · бета-версия</div>
        </div>

        <div className="grid c2" style={{ marginTop: 14 }}>
          <div className="field"><label>Ваше имя *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Алексей" /></div>
          <div className="field"><label>E-mail *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div className="field"><label>Страна</label>
            <input value={country} onChange={e => setCountry(e.target.value)} /></div>
          <div className="field"><label>Валюта учёта</label>
            <select value={curIdx} onChange={e => setCurIdx(Number(e.target.value))}>
              {CURRENCIES.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
            </select></div>
        </div>

        <h2 style={{ marginTop: 16 }}>Пользовательское соглашение</h2>
        <div className="agreement" onScroll={e => {
          const el = e.currentTarget
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) setScrolled(true)
        }}>
          {AGREEMENT.split('\n\n').map((p, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{p}</p>)}
        </div>
        {!scrolled && <div className="muted" style={{ marginTop: 4 }}>Прокрутите соглашение до конца, чтобы продолжить.</div>}

        <label className="row" style={{ marginTop: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
          <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={agree}
                 disabled={!scrolled} onChange={e => setAgree(e.target.checked)} />
          <span style={{ fontSize: 13 }}>
            Я ознакомился(лась) с соглашением и понимаю: это бета-версия для управленческого учёта;
            данные хранятся только на моём устройстве; платформа не заменяет первичную документацию
            и не освобождает от налогов и проверки расчётов по законодательству моей страны.
          </span>
        </label>

        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn primary" disabled={!agree} onClick={accept}>Принимаю и начинаю работу</button>
        </div>
        <div className="muted" style={{ marginTop: 10, fontSize: 11.5 }}>
          Подтверждение e-mail кодом появится в облачной версии с синхронизацией: локальная версия
          не отправляет данные в сеть, поэтому письмо выслать технически неоткуда — это и есть гарантия приватности.
        </div>
      </div>
    </div>
  )
}
