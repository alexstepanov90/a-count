// Утилиты форматирования: деньги, даты, сумма прописью (KZT)

export function money(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function fmtDateLong(iso: string): string {
  if (!iso) return ''
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const [y, m, d] = iso.split('-').map(Number)
  return `«${String(d).padStart(2, '0')}» ${months[m - 1]} ${y} г.`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- Сумма прописью ----------

const ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10, n100 = n % 100
  if (n10 === 1 && n100 !== 11) return forms[0]
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1]
  return forms[2]
}

function triad(n: number, feminine: boolean): string {
  const parts: string[] = []
  const h = Math.floor(n / 100), rest = n % 100
  if (h) parts.push(HUNDREDS[h])
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10])
  else {
    const t = Math.floor(rest / 10), o = rest % 10
    if (t) parts.push(TENS[t])
    if (o) parts.push((feminine ? ONES_F : ONES_M)[o])
  }
  return parts.join(' ')
}

export function amountInWordsKZT(amount: number): string {
  const tenge = Math.floor(amount)
  const tiyn = Math.round((amount - tenge) * 100)
  if (tenge === 0 && tiyn === 0) return 'Ноль тенге 00 тиын'

  const groups: string[] = []
  const billions = Math.floor(tenge / 1_000_000_000) % 1000
  const millions = Math.floor(tenge / 1_000_000) % 1000
  const thousands = Math.floor(tenge / 1000) % 1000
  const units = tenge % 1000

  if (billions) groups.push(triad(billions, false) + ' ' + plural(billions, ['миллиард', 'миллиарда', 'миллиардов']))
  if (millions) groups.push(triad(millions, false) + ' ' + plural(millions, ['миллион', 'миллиона', 'миллионов']))
  if (thousands) groups.push(triad(thousands, true) + ' ' + plural(thousands, ['тысяча', 'тысячи', 'тысяч']))
  if (units) groups.push(triad(units, false))
  if (tenge === 0) groups.push('ноль')

  let text = groups.join(' ').replace(/\s+/g, ' ').trim()
  text = text.charAt(0).toUpperCase() + text.slice(1)
  return `${text} ${plural(tenge, ['тенге', 'тенге', 'тенге'])} ${String(tiyn).padStart(2, '0')} ${plural(tiyn, ['тиын', 'тиына', 'тиын'])}`
}

export function downloadFile(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function toCSV(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map(r =>
    r.map(c => {
      const s = String(c ?? '')
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }).join(';')
  ).join('\r\n')
}

// Загрузка изображения (jpg/png) с уменьшением до maxSide px → dataURL (PNG, сохраняет прозрачность)
export function imageFileToDataURL(file: File, maxSide = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      reject(new Error('Поддерживаются изображения PNG или JPG. Если скан в PDF — экспортируйте страницу в PNG/JPG.'))
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')) }
    img.src = url
  })
}
