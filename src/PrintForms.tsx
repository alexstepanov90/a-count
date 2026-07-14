// ============================================================
// Печатные формы первичных учётных документов РК
// Сверстаны по официальным бланкам:
//  - АВР       — форма Р-1 (прил. 50 к приказу МФ РК от 20.12.2012 № 562, ред. 27.10.2014)
//  - Накладная — форма З-2 (прил. 26 к приказу МФ РК от 20.12.2012 № 562, ред. 19.08.2013)
//  - Счёт-фактура — типовая форма (образец 1С); юридически значимая СФ — через ИС ЭСФ
//  - Счёт на оплату — утверждённой формы нет, типовая банковская форма
// Рендер через портал в #print-root, вне интерфейса приложения.
// ============================================================
import { createPortal } from 'react-dom'
import { calcLine, CUR, CUR_CODE, type Doc, type Counterparty, type Settings } from './db'
import { money, fmtDate, fmtDateLong, amountInWordsKZT } from './utils'

export function PrintPortal({ children }: { children: React.ReactNode }) {
  const root = document.getElementById('print-root')
  if (!root) return null
  return createPortal(<div className="print-area">{children}</div>, root)
}

function qtyInWords(n: number): string {
  return amountInWordsKZT(Math.floor(n)).replace(/ тенге.*$/, '')
}

interface Party { name: string; bin: string; address?: string; phone?: string; bank?: string; iik?: string; bik?: string; kbe?: string; vat?: string }

function parties(doc: Doc, cp: Counterparty, s: Settings): { seller: Party; buyer: Party } {
  const me: Party = {
    name: `${s.companyType} «${s.companyName}»`, bin: s.binIin,
    address: s.address, phone: s.phone, bank: s.bankName, iik: s.iik, bik: s.bik, kbe: s.kbe, vat: s.vatCertificate,
  }
  const them: Party = {
    name: `${cp.type} «${cp.name}»`, bin: cp.binIin,
    address: cp.address, phone: cp.phone, bank: cp.bankName, iik: cp.iik, bik: cp.bik, kbe: cp.kbe, vat: cp.vatCertificate,
  }
  return doc.direction === 'out' ? { seller: me, buyer: them } : { seller: them, buyer: me }
}

const partyLine = (p: Party) => [p.name, p.bin ? `БИН/ИИН ${p.bin}` : '', p.address, p.phone].filter(Boolean).join(', ')

// Подпись + печать (только исходящие, по флажку doc.signed)
function SignStamp({ on, s }: { on?: boolean; s: Settings }) {
  if (!on) return null
  return (
    <>
      {s.signImage && <img className="sig-img" src={s.signImage} alt="" />}
      {s.stampImage && <img className="stamp-img" src={s.stampImage} alt="" />}
    </>
  )
}

// Реквизит приложения к приказу 562 + поле ИИН/БИН (шапка форм)
function FormHeader({ appendix, form, bin, orgLine }: { appendix: string; form: string; bin: string; orgLine?: string }) {
  return (
    <>
      <table className="hdr-table" style={{ width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ width: '58%', verticalAlign: 'top' }}>
              {orgLine !== undefined && (
                <table className="hdr-table" style={{ width: '100%' }}><tbody>
                  <tr><td className="fill">{orgLine || '\u00A0'}</td></tr>
                  <tr><td className="cap">Организация (индивидуальный предприниматель)</td></tr>
                </tbody></table>
              )}
            </td>
            <td className="form-ref">
              Приложение {appendix}<br />к приказу Министра финансов<br />Республики Казахстан<br />от 20 декабря 2012 года № 562<br /><b>Форма {form}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <table className="hdr-table" style={{ width: '38%' }}><tbody>
        <tr>
          <td style={{ whiteSpace: 'nowrap', paddingRight: '4pt' }}>ИИН/БИН</td>
          <td className="fill" style={{ textAlign: 'center', letterSpacing: '2pt' }}>{bin}</td>
        </tr>
      </tbody></table>
    </>
  )
}

function FilledLine({ label, value, cap }: { label?: string; value: string; cap?: string }) {
  return (
    <table className="hdr-table" style={{ width: '100%', marginTop: '2pt' }}>
      <tbody>
        <tr>
          {label && <td style={{ whiteSpace: 'nowrap', paddingRight: '4pt' }}>{label}</td>}
          <td className="fill">{value || '\u00A0'}</td>
        </tr>
        {cap && <tr>{label && <td></td>}<td className="cap">{cap}</td></tr>}
      </tbody>
    </table>
  )
}

// Блок «название документа + номер/дата» в одну строку (как в бланках 562)
function TitleNumDate({ title, number, date }: { title: string; number: string; date: string }) {
  return (
    <table className="p" style={{ marginTop: '6pt' }}>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ width: '62%', fontWeight: 'bold', fontSize: '11pt', verticalAlign: 'middle', border: 'none' }}>{title}</td>
          <th style={{ width: '19%' }}>Номер документа</th>
          <th style={{ width: '19%' }}>Дата составления</th>
        </tr>
        <tr>
          <td style={{ textAlign: 'center' }}>{number}</td>
          <td style={{ textAlign: 'center' }}>{fmtDate(date)}</td>
        </tr>
      </tbody>
    </table>
  )
}

// ============ ФОРМА Р-1: АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ) ============
export function PrintActR1({ doc, cp, s }: { doc: Doc; cp: Counterparty; s: Settings }) {
  const { seller, buyer } = parties(doc, cp, s)
  const lines = doc.lines.filter(l => l.name.trim())
  const totalQty = lines.reduce((x, l) => x + l.qty, 0)

  return (
    <>
      <FormHeader appendix="50" form="Р-1" bin={doc.direction === 'out' ? s.binIin : cp.binIin} />
      <FilledLine label="Заказчик" value={partyLine(buyer)} cap="полное наименование, адрес, данные о средствах связи" />
      <FilledLine label="Исполнитель" value={partyLine(seller)} cap="полное наименование, адрес, данные о средствах связи" />
      <FilledLine label="Договор (контракт)" value={doc.contractRef || ''} />
      <TitleNumDate title="АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)*" number={doc.number} date={doc.date} />
      <table className="p" style={{ marginTop: '4pt' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '4%' }}>Номер по порядку</th>
            <th rowSpan={2}>Наименование работ (услуг) (в разрезе их подвидов в соответствии с технической спецификацией, заданием, графиком выполнения работ (услуг) при их наличии)</th>
            <th rowSpan={2} style={{ width: '9%' }}>Дата выполнения работ (оказания услуг)**</th>
            <th rowSpan={2} style={{ width: '13%' }}>Сведения об отчете о научных исследованиях, маркетинговых, консультационных и прочих услугах (дата, номер, количество страниц) (при их наличии)***</th>
            <th rowSpan={2} style={{ width: '7%' }}>Единица измерения</th>
            <th colSpan={3}>Выполнено работ (оказано услуг)</th>
          </tr>
          <tr>
            <th style={{ width: '8%' }}>количество</th>
            <th style={{ width: '11%' }}>цена за единицу</th>
            <th style={{ width: '12%' }}>стоимость</th>
          </tr>
          <tr className="colnum">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <td key={n} style={{ border: '1px solid #000' }}>{n}</td>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const c = calcLine(l, s.pricesIncludeVat)
            return (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{l.name}</td>
                <td style={{ textAlign: 'center' }}>{fmtDate(doc.date)}</td>
                <td></td>
                <td style={{ textAlign: 'center' }}>{l.unit}</td>
                <td className="pnum">{l.qty}</td>
                <td className="pnum">{money(l.price)}</td>
                <td className="pnum">{money(c.total)}</td>
              </tr>
            )
          })}
          <tr>
            <td></td><td></td><td></td><td></td>
            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>Итого</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{totalQty}</td>
            <td style={{ textAlign: 'center' }}>х</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.total)}</td>
          </tr>
        </tbody>
      </table>
      <FilledLine label="Сведения об использовании запасов, полученных от заказчика" value="" cap="наименование, количество, стоимость" />
      <div className="small" style={{ marginTop: '4pt' }}>
        Приложение: Перечень документации, в том числе отчет(ы) о маркетинговых, научных исследованиях, консультационных
        и прочих услугах (обязательны при его (их) наличии) на {doc.extra?.attachmentPages || '____'} страниц
      </div>
      <table className="p bare-outer" style={{ marginTop: '10pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }} className="sig-wrap">
              Сдал (Исполнитель) ____________ / __________ / {doc.direction === 'out' ? (s.director || '____________________') : '____________________'}
              <SignStamp on={doc.signed && doc.direction === 'out'} s={s} />
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '60pt' }}>должность&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;подпись&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;расшифровка подписи</div>
              <div style={{ marginTop: '14pt' }}>М.П.</div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              Принял (Заказчик) ____________ / __________ / ____________________
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '58pt' }}>должность&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;подпись&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;расшифровка подписи</div>
              <div style={{ marginTop: '8pt' }}>Дата подписания (принятия) работ (услуг) ________________</div>
              <div style={{ marginTop: '6pt' }}>М.П.</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="small" style={{ marginTop: '8pt', fontSize: '8pt' }}>
        * Применяется для приемки-передачи выполненных работ (оказанных услуг), за исключением строительно-монтажных работ.<br />
        ** Заполняется в случае, если даты выполненных работ (оказанных услуг) приходятся на различные периоды, а также в случае,
        если даты выполнения работ (оказания услуг) и даты подписания (принятия) работ (услуг) различны.<br />
        *** Заполняется в случае наличия отчета о научных исследованиях, маркетинговых, консультационных и прочих услугах.
      </div>
    </>
  )
}

// ============ ФОРМА З-2: НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ ============
export function PrintWaybillZ2({ doc, cp, s }: { doc: Doc; cp: Counterparty; s: Settings }) {
  const { seller, buyer } = parties(doc, cp, s)
  const lines = doc.lines.filter(l => l.name.trim())
  const totalQty = lines.reduce((x, l) => x + l.qty, 0)

  return (
    <>
      <FormHeader appendix="26" form="З-2" bin={doc.direction === 'out' ? s.binIin : cp.binIin} orgLine={seller.name} />
      <TitleNumDate title="НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ" number={doc.number} date={doc.date} />
      <table className="p" style={{ marginTop: '4pt' }}>
        <thead>
          <tr>
            <th>Организация (индивидуальный предприниматель) — отправитель</th>
            <th>Организация (индивидуальный предприниматель) — получатель</th>
            <th style={{ width: '15%' }}>Ответственный за поставку (Ф.И.О.)</th>
            <th style={{ width: '15%' }}>Транспортная организация</th>
            <th style={{ width: '16%' }}>Товарно-транспортная накладная (номер, дата)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="small">{partyLine(seller)}</td>
            <td className="small">{partyLine(buyer)}</td>
            <td className="small">{doc.extra?.responsible || '\u00A0'}</td>
            <td className="small">{doc.extra?.transport || '\u00A0'}</td>
            <td className="small">{doc.extra?.ttn || '\u00A0'}</td>
          </tr>
        </tbody>
      </table>
      <table className="p" style={{ marginTop: '4pt' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '4%' }}>Номер по порядку</th>
            <th rowSpan={2}>Наименование, характеристика</th>
            <th rowSpan={2} style={{ width: '9%' }}>Номенклатурный номер</th>
            <th rowSpan={2} style={{ width: '7%' }}>Единица измерения</th>
            <th colSpan={2}>Количество</th>
            <th rowSpan={2} style={{ width: '11%' }}>Цена за единицу, в тенге</th>
            <th rowSpan={2} style={{ width: '12%' }}>Сумма с НДС, в тенге</th>
            <th rowSpan={2} style={{ width: '11%' }}>Сумма НДС, в тенге</th>
          </tr>
          <tr>
            <th style={{ width: '8%' }}>подлежит отпуску</th>
            <th style={{ width: '7%' }}>отпущено</th>
          </tr>
          <tr className="colnum">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <td key={n} style={{ border: '1px solid #000' }}>{n}</td>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const c = calcLine(l, s.pricesIncludeVat)
            return (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{l.name}</td>
                <td></td>
                <td style={{ textAlign: 'center' }}>{l.unit}</td>
                <td className="pnum">{l.qty}</td>
                <td className="pnum">{l.qty}</td>
                <td className="pnum">{money(l.price)}</td>
                <td className="pnum">{money(c.total)}</td>
                <td className="pnum">{money(c.vat)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{totalQty}</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{totalQty}</td>
            <td style={{ textAlign: 'center' }}>х</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.total)}</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.vatTotal)}</td>
          </tr>
        </tbody>
      </table>
      <div className="small" style={{ marginTop: '6pt' }}>
        Всего отпущено количество запасов (прописью) <b>{qtyInWords(totalQty)}</b>{' '}
        на сумму (прописью), в тенге: <b>{CUR_CODE === 'KZT' ? amountInWordsKZT(doc.total) : `${money(doc.total)} ${CUR_CODE}`}</b>
      </div>
      <table className="p bare-outer" style={{ marginTop: '10pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }} className="sig-wrap">
              Отпуск разрешил ____________ / __________ / {doc.direction === 'out' ? (s.director || '____________________') : '____________________'}
              <SignStamp on={doc.signed && doc.direction === 'out'} s={s} />
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '56pt' }}>должность&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;подпись&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;расшифровка подписи</div>
              <div style={{ marginTop: '10pt' }}>Главный бухгалтер __________ / {doc.direction === 'out' ? (s.accountant || '____________________') : '____________________'}&nbsp;&nbsp;&nbsp;М.П.</div>
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '70pt' }}>подпись&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;расшифровка подписи</div>
              <div style={{ marginTop: '10pt' }}>Отпустил __________ / ____________________</div>
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '40pt' }}>подпись&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;расшифровка подписи</div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              По доверенности № {doc.extra?.proxy ? <b>{doc.extra.proxy}</b> : '__________ от «____» _____________ 20__ года, выданной ________________________________________________'}
              <div style={{ marginTop: '14pt' }}>Запасы получил ______________ / ____________________</div>
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '62pt' }}>подпись&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;расшифровка подписи</div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

// ============ СЧЁТ-ФАКТУРА (типовая форма, образец 1С; юридически значимая — через ИС ЭСФ) ============
export function PrintVatInvoice({ doc, cp, s }: { doc: Doc; cp: Counterparty; s: Settings }) {
  const { seller, buyer } = parties(doc, cp, s)
  const lines = doc.lines.filter(l => l.name.trim())
  return (
    <>
      <div className="doc-title" style={{ textAlign: 'center' }}>Счёт-фактура № {doc.number} от {fmtDateLong(doc.date)}</div>
      <div className="small">
        Дата оборота по реализации: {fmtDate(doc.date)}<br />
        <b>Поставщик:</b> {seller.name}<br />
        БИН и адрес места нахождения поставщика: БИН: {seller.bin}{seller.address ? `, ${seller.address}` : ''}<br />
        ИИК поставщика: {seller.iik || '_______________'}{seller.bank ? ` в ${seller.bank}${seller.bik ? `, БИК ${seller.bik}` : ''}` : ''}<br />
        {seller.vat && <>Свидетельство о постановке на учёт по НДС: {seller.vat}<br /></>}
        Договор (контракт) на поставку товаров (работ, услуг): {doc.contractRef || '_______________'}<br />
        Условия оплаты по договору (контракту): {doc.extra?.paymentTerms || '_______________'}<br />
        Пункт назначения поставляемых товаров (работ, услуг): {doc.extra?.destination || '_________________________'}{' '}
        <span className="cap">государство, регион, область, город, район</span><br />
        Поставка товаров (работ, услуг) осуществлена по доверенности: {doc.extra?.proxy || '_______________'}<br />
        Способ отправления: {doc.extra?.transport || '_______________'}<br />
        Товарно-транспортная накладная: {doc.extra?.ttn || '_______________'}<br />
        Грузоотправитель: _______________________________ <span className="cap">(БИН, наименование и адрес)</span><br />
        Грузополучатель: _______________________________ <span className="cap">(БИН, наименование и адрес)</span><br />
        <b>Получатель:</b> {buyer.name}<br />
        БИН и адрес места нахождения получателя: БИН: {buyer.bin}{buyer.address ? `, ${buyer.address}` : ''}<br />
        ИИК получателя: {buyer.iik || '_______________'}
      </div>
      <table className="p" style={{ marginTop: '6pt' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '4%' }}>№ п/п</th>
            <th rowSpan={2}>Наименование товаров (работ, услуг)</th>
            <th rowSpan={2} style={{ width: '6%' }}>Ед. изм.</th>
            <th rowSpan={2} style={{ width: '7%' }}>Кол-во (объем)</th>
            <th rowSpan={2} style={{ width: '10%' }}>Цена ({CUR_CODE})</th>
            <th rowSpan={2} style={{ width: '12%' }}>Стоимость товаров (работ, услуг) без НДС</th>
            <th colSpan={2}>НДС</th>
            <th rowSpan={2} style={{ width: '12%' }}>Всего стоимость реализации</th>
            <th colSpan={2}>Акциз</th>
          </tr>
          <tr>
            <th style={{ width: '6%' }}>Ставка</th>
            <th style={{ width: '10%' }}>Сумма</th>
            <th style={{ width: '5%' }}>Ставка</th>
            <th style={{ width: '6%' }}>Сумма</th>
          </tr>
          <tr className="colnum">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => <td key={n} style={{ border: '1px solid #000' }}>{n}</td>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const c = calcLine(l, s.pricesIncludeVat)
            return (
              <tr key={i}>
                <td className="pnum">{i + 1}</td>
                <td>{l.name}</td>
                <td style={{ textAlign: 'center' }}>{l.unit}</td>
                <td className="pnum">{l.qty}</td>
                <td className="pnum">{money(l.price)}</td>
                <td className="pnum">{money(c.total - c.vat)}</td>
                <td style={{ textAlign: 'center' }}>{l.vatRate === null ? 'Без НДС' : `${l.vatRate}%`}</td>
                <td className="pnum">{money(c.vat)}</td>
                <td className="pnum">{money(c.total)}</td>
                <td></td>
                <td></td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>Всего по счету:</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.total - doc.vatTotal)}</td>
            <td style={{ textAlign: 'center' }}>х</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.vatTotal)}</td>
            <td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.total)}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <table className="p bare-outer" style={{ marginTop: '12pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }} className="sig-wrap">
              Директор: {s.director ? <b>{s.director}</b> : '_____________________________'}
              <SignStamp on={doc.signed && doc.direction === 'out'} s={s} />
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '30pt' }}>(Ф.И.О., подпись)</div>
              <div style={{ marginTop: '12pt' }}>Главный бухгалтер: {s.accountant ? <b>{s.accountant}</b> : 'Не предусмотрен'}</div>
              <div className="cap" style={{ textAlign: 'left', paddingLeft: '50pt' }}>(Ф.И.О., подпись)</div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              ВЫДАЛ (ответственное лицо поставщика)
              <div style={{ marginTop: '8pt' }}>_____________________________ <span className="cap">(должность)</span></div>
              <div style={{ marginTop: '8pt' }}>_____________________________ <span className="cap">(Ф.И.О., подпись)</span></div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ paddingTop: '10pt' }}>
              Подтверждение о получении счета-фактуры получателем:
              <div style={{ marginTop: '8pt' }}>_____________________________ <span className="cap">(должность)</span>&nbsp;&nbsp;&nbsp;&nbsp;
              _____________________________ <span className="cap">(Ф.И.О., подпись)</span></div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="small" style={{ marginTop: '8pt', fontSize: '8.5pt' }}>
        Примечание: Без печати недействительно. Оригинал (первый экземпляр) — покупателю. Копия (второй экземпляр) — поставщику.
      </div>
    </>
  )
}

// ============ СЧЁТ НА ОПЛАТУ (утверждённой формы нет; типовая форма РК) ============
export function PrintInvoice({ doc, cp, s }: { doc: Doc; cp: Counterparty; s: Settings }) {
  const { seller, buyer } = parties(doc, cp, s)
  const lines = doc.lines.filter(l => l.name.trim())
  return (
    <>
      <div className="warn">
        Внимание! Оплата данного счёта означает согласие с условиями поставки товара (выполнения работ, оказания услуг).
        Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара (выполнение работ, оказание услуг).
        Товар отпускается по факту прихода денег на р/с Поставщика.
      </div>
      <table className="p">
        <tbody>
          <tr>
            <td colSpan={2} className="small" style={{ width: '60%' }}><b>Бенефициар:</b><br />{seller.name}<br />БИН/ИИН: {seller.bin}</td>
            <td className="small"><b>ИИК</b><br />{seller.iik}</td>
            <td className="small" style={{ width: '10%' }}><b>Кбе</b><br />{seller.kbe}</td>
          </tr>
          <tr>
            <td colSpan={2} className="small"><b>Банк бенефициара:</b><br />{seller.bank}</td>
            <td className="small"><b>БИК</b><br />{seller.bik}</td>
            <td className="small"><b>КНП</b><br />{s.knp || '859'}</td>
          </tr>
        </tbody>
      </table>
      <div className="doc-title" style={{ textAlign: 'center' }}>Счёт на оплату № {doc.number} от {fmtDateLong(doc.date)}</div>
      <div className="small">
        <b>Поставщик:</b> {partyLine(seller)}<br />
        <b>Покупатель:</b> {partyLine(buyer)}<br />
        {doc.contractRef && <><b>Основание:</b> {doc.contractRef}</>}
      </div>
      <table className="p" style={{ marginTop: '6pt' }}>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>№</th><th>Наименование товаров (работ, услуг)</th>
            <th style={{ width: '9%' }}>Ед. изм.</th><th style={{ width: '9%' }}>Кол-во</th>
            <th style={{ width: '14%' }}>Цена, {CUR}</th><th style={{ width: '15%' }}>Сумма, {CUR}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const c = calcLine(l, s.pricesIncludeVat)
            return (
              <tr key={i}>
                <td className="pnum">{i + 1}</td><td>{l.name}</td>
                <td style={{ textAlign: 'center' }}>{l.unit}</td><td className="pnum">{l.qty}</td>
                <td className="pnum">{money(l.price)}</td><td className="pnum">{money(c.total)}</td>
              </tr>
            )
          })}
          <tr><td colSpan={4} style={{ border: 'none' }}></td><td style={{ fontWeight: 'bold' }}>Итого:</td><td className="pnum" style={{ fontWeight: 'bold' }}>{money(doc.total)}</td></tr>
          <tr><td colSpan={4} style={{ border: 'none' }}></td><td>в т.ч. НДС:</td><td className="pnum">{doc.vatTotal > 0 ? money(doc.vatTotal) : 'без НДС'}</td></tr>
        </tbody>
      </table>
      <div className="small" style={{ marginTop: '6pt' }}>
        Всего наименований {lines.length}, на сумму {money(doc.total)} {CUR}<br />
        <b>Всего к оплате: {CUR_CODE === 'KZT' ? amountInWordsKZT(doc.total) : `${money(doc.total)} ${CUR_CODE}`}</b>
      </div>
      <div className="sign-row">
        <div className="sign sig-wrap">
          Руководитель: {s.director || '_______________'}
          <SignStamp on={doc.signed && doc.direction === 'out'} s={s} />
          <div className="line" />
        </div>
        <div className="sign">Бухгалтер: {s.accountant || '_______________'}<div className="line" /></div>
      </div>
      <div className="small" style={{ marginTop: '8pt' }}>М.П.</div>
    </>
  )
}

export function DocPrint({ doc, cp, s }: { doc: Doc; cp?: Counterparty; s: Settings }) {
  if (!cp) return null
  return (
    <PrintPortal>
      {doc.docType === 'invoice' && <PrintInvoice doc={doc} cp={cp} s={s} />}
      {doc.docType === 'act' && <PrintActR1 doc={doc} cp={cp} s={s} />}
      {doc.docType === 'waybill' && <PrintWaybillZ2 doc={doc} cp={cp} s={s} />}
      {doc.docType === 'vat_invoice' && <PrintVatInvoice doc={doc} cp={cp} s={s} />}
    </PrintPortal>
  )
}
