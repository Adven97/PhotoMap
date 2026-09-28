import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

export type DateGranularity = 'day' | 'month' | 'year'
type CalendarView = 'days' | 'months' | 'years'

type DateRangePickerProps = {
  granularity: DateGranularity
  dateFrom: string
  dateTo: string
  availableYears: string[]
  onChange: (
    granularity: DateGranularity,
    dateFrom: string,
    dateTo: string,
  ) => void
}

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
    new Date(2020, month, 1),
  ),
)
const weekdayNames = Array.from({ length: 7 }, (_, day) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
    new Date(2023, 0, day + 1),
  ),
)

export function DateRangePicker({
  granularity,
  dateFrom,
  dateTo,
  availableYears,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<CalendarView>(granularityToView(granularity))
  const [selectionGranularity, setSelectionGranularity] = useState(granularity)
  const [displayedYear, setDisplayedYear] = useState(() => getInitialYear(dateFrom))
  const [displayedMonth, setDisplayedMonth] = useState(() => getInitialMonth(dateFrom))
  const [draftFrom, setDraftFrom] = useState(dateFrom)
  const [draftTo, setDraftTo] = useState(dateTo)
  const [hasStartedRange, setHasStartedRange] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  const openPicker = () => {
    setDraftFrom(dateFrom)
    setDraftTo(dateTo)
    setHasStartedRange(false)
    setDisplayedYear(getInitialYear(dateFrom))
    setDisplayedMonth(getInitialMonth(dateFrom))
    setSelectionGranularity(granularity)
    setView(granularityToView(granularity))
    setIsOpen(true)
  }

  const startYear = Math.floor(displayedYear / 10) * 10
  const yearOptions = Array.from({ length: 12 }, (_, index) => startYear - 1 + index)

  const chooseRangeValue = (value: string, precision: DateGranularity) => {
    if (precision !== selectionGranularity) {
      setSelectionGranularity(precision)
      setDraftFrom(value)
      setDraftTo('')
      setHasStartedRange(true)
      return
    }

    if (!hasStartedRange) {
      setDraftFrom(value)
      setDraftTo('')
      setHasStartedRange(true)
      return
    }

    if (value < draftFrom) {
      setDraftFrom(value)
      setDraftTo('')
      return
    }

    setDraftTo(value)
  }

  const saveRange = () => {
    if (!draftFrom) return
    onChange(selectionGranularity, draftFrom, draftTo)
    setIsOpen(false)
  }

  const setSelectionPrecision = (precision: DateGranularity) => {
    setSelectionGranularity(precision)
    setView(granularityToView(precision))
  }

  const moveCalendar = (direction: number) => {
    if (view === 'days') {
      const date = new Date(displayedYear, displayedMonth + direction, 1)
      setDisplayedYear(date.getFullYear())
      setDisplayedMonth(date.getMonth())
    } else if (view === 'months') {
      setDisplayedYear((year) => year + direction)
    } else {
      setDisplayedYear((year) => year + direction * 10)
    }
  }

  const selectedRangeLabel = formatRange(dateFrom, dateTo, granularity)

  return (
    <div className="date-picker" ref={pickerRef}>
      <label className="date-picker-label" htmlFor="date-range-trigger">Date</label>
      <button
        id="date-range-trigger"
        type="button"
        className="date-range-trigger"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
      >
        <CalendarDays aria-hidden="true" size={17} />
        <span>{selectedRangeLabel || 'Choose a date or range'}</span>
      </button>

      {isOpen && (
        <div className="date-picker-popover" role="dialog" aria-label="Choose a date or range">
          <div className="calendar-heading">
            <button type="button" className="calendar-nav" onClick={() => moveCalendar(-1)} aria-label="Previous">
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <div className="calendar-heading-title">
              {view === 'days' ? (
                <>
                  <button type="button" onClick={() => setView('months')}>
                    {monthNames[displayedMonth]}
                  </button>
                  <button type="button" onClick={() => setView('years')}>
                    {displayedYear}
                  </button>
                </>
              ) : view === 'months' ? (
                <button type="button" onClick={() => setView('years')}>
                  {displayedYear}
                </button>
              ) : (
                <span>{startYear}–{startYear + 9}</span>
              )}
            </div>
            <button type="button" className="calendar-nav" onClick={() => moveCalendar(1)} aria-label="Next">
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>

          {view === 'years' && (
            <div className="calendar-period-grid">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={periodClass(String(year), draftFrom, draftTo)}
                  onClick={() => {
                    setDisplayedYear(year)
                    setDisplayedMonth(0)
                    chooseRangeValue(String(year), 'year')
                    setView('months')
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          {view === 'months' && (
            <div className="calendar-period-grid">
              {monthNames.map((month, index) => {
                const value = formatMonth(displayedYear, index)
                return (
                  <button
                    key={month}
                    type="button"
                    className={periodClass(value, draftFrom, draftTo)}
                    onClick={() => {
                      setDisplayedMonth(index)
                      chooseRangeValue(value, 'month')
                      setView('days')
                    }}
                  >
                    {month}
                  </button>
                )
              })}
            </div>
          )}

          {view === 'days' && (
            <div className="calendar-day-grid">
              {weekdayNames.map((weekday, index) => (
                <span key={`${weekday}-${index}`} className="calendar-weekday">{weekday}</span>
              ))}
              {getCalendarDays(displayedYear, displayedMonth).map((date, index) => {
                if (!date) return <span key={`empty-${index}`} className="calendar-empty" />
                const value = formatDay(date)
                return (
                  <button
                    key={value}
                    type="button"
                    className={periodClass(value, draftFrom, draftTo)}
                    onClick={() => chooseRangeValue(value, 'day')}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          )}

          <div className="calendar-footer">
            <span>{formatRange(draftFrom, draftTo, selectionGranularity) || 'Select a date or range'}</span>
            <button type="button" disabled={!draftFrom} onClick={saveRange}>Apply</button>
          </div>
          <div className="calendar-shortcuts" aria-label="Choose date precision">
            <button
              type="button"
              className={selectionGranularity === 'day' ? 'is-active' : ''}
              onClick={() => setSelectionPrecision('day')}
            >Day</button>
            <button
              type="button"
              className={selectionGranularity === 'month' ? 'is-active' : ''}
              onClick={() => setSelectionPrecision('month')}
            >Month</button>
            <button
              type="button"
              className={selectionGranularity === 'year' ? 'is-active' : ''}
              onClick={() => setSelectionPrecision('year')}
            >Year</button>
          </div>
          {availableYears.length === 0 && (
            <p className="calendar-no-dates">No photos have capture dates.</p>
          )}
        </div>
      )}
    </div>
  )
}

function granularityToView(granularity: DateGranularity): CalendarView {
  if (granularity === 'year') return 'years'
  if (granularity === 'month') return 'months'
  return 'days'
}

function getInitialYear(value: string): number {
  const year = Number(value.slice(0, 4))
  return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear()
}

function getInitialMonth(value: string): number {
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12 ? month - 1 : new Date().getMonth()
}

function getCalendarDays(year: number, month: number): Array<Date | null> {
  const firstWeekday = new Date(year, month, 1).getDay()
  const dayCount = new Date(year, month + 1, 0).getDate()
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dayCount }, (_, day) => new Date(year, month, day + 1)),
  ]
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function periodClass(value: string, from: string, to: string): string {
  const isStart = value === from
  const isEnd = value === to
  const isInRange = Boolean(from && to && value > from && value < to)
  return [
    'calendar-period',
    isStart ? 'is-range-start' : '',
    isEnd ? 'is-range-end' : '',
    isInRange ? 'is-in-range' : '',
  ].filter(Boolean).join(' ')
}

function formatRange(from: string, to: string, granularity: DateGranularity): string {
  if (!from) return ''
  if (!to || from === to) return formatPeriod(from, granularity)
  return `${formatPeriod(from, granularity)} – ${formatPeriod(to, granularity)}`
}

function formatPeriod(value: string, granularity: DateGranularity): string {
  if (granularity === 'year') return value
  if (granularity === 'month') {
    const [year, month] = value.split('-').map(Number)
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
      .format(new Date(year, month - 1, 1))
  }
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}
