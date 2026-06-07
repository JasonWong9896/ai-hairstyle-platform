'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

import { isCurrentAvailabilitySlot, type AvailabilitySlot } from '@/services/stylist'

type AvailabilityWeekEditorProps = {
  slots: AvailabilitySlot[]
  onAddSlot: (slot: AvailabilitySlot) => void
  onChangeSlot: (index: number, patch: Partial<AvailabilitySlot>) => void
  onRemoveSlot: (index: number) => void
}

export function AvailabilityWeekEditor({
  slots,
  onAddSlot,
  onChangeSlot,
  onRemoveSlot,
}: AvailabilityWeekEditorProps) {
  const dates = availabilityDates()
  const pageCount = Math.ceil(dates.length / 7)
  const [page, setPage] = useSafeWeekPage(pageCount)
  const weekDates = dates.slice(page * 7, page * 7 + 7)
  const [selectedDate, setSelectedDate] = useSafeSelectedDate(weekDates)
  const selectedSlots = slots
    .map((slot, index) => ({ slot, index }))
    .filter((item) => item.slot.date === selectedDate && isCurrentAvailabilitySlot(item.slot))

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-zinc-700">
          {formatDateLabel(weekDates[0])} - {formatDateLabel(weekDates[weekDates.length - 1])}
        </div>
        <button
          type="button"
          onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {weekDates.map((date) => {
          const daySlotsCount = slots.filter((slot) => slot.date === date && isCurrentAvailabilitySlot(slot)).length
          const isSelected = selectedDate === date

          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`min-h-24 rounded-md border p-3 text-left transition ${
                isSelected
                  ? 'border-zinc-950 bg-white ring-2 ring-zinc-200'
                  : 'border-zinc-200 bg-zinc-50 hover:border-zinc-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-500">{formatWeekday(date)}</div>
                  <div className="text-sm font-semibold text-zinc-900">{formatDateLabel(date)}</div>
                </div>
                <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-zinc-600">
                  {daySlotsCount}
                </span>
              </div>
              <div className="mt-3 text-xs text-zinc-500">slots</div>
            </button>
          )
        })}
      </div>

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-zinc-900">
              {formatDateLabel(selectedDate)} {formatWeekday(selectedDate)}
            </h5>
            <p className="mt-1 text-xs text-zinc-500">Bookable time slots</p>
          </div>
          <button
            type="button"
            onClick={() => onAddSlot(defaultSlotForDate(selectedDate, selectedSlots.map((item) => item.slot)))}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add slot
          </button>
        </div>

        <div className="grid gap-2">
          {selectedSlots.map(({ slot, index }) => (
            <div key={`${selectedDate}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                type="time"
                value={slot.startTime}
                onChange={(event) => onChangeSlot(index, { startTime: event.target.value })}
                className="h-10 rounded-md border border-zinc-300 px-2 text-sm"
              />
              <input
                type="time"
                value={slot.endTime}
                onChange={(event) => onChangeSlot(index, { endTime: event.target.value })}
                className="h-10 rounded-md border border-zinc-300 px-2 text-sm"
              />
              <button
                type="button"
                onClick={() => onRemoveSlot(index)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-medium text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          ))}

          {!selectedSlots.length && (
            <div className="flex h-16 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
              No slots for this date
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function useSafeWeekPage(pageCount: number) {
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (page >= pageCount) {
      setPage(Math.max(0, pageCount - 1))
    }
  }, [page, pageCount])

  return [page, setPage] as const
}

function useSafeSelectedDate(weekDates: string[]) {
  const [selectedDate, setSelectedDate] = useState(weekDates[0] ?? '')

  useEffect(() => {
    if (!weekDates.includes(selectedDate)) {
      setSelectedDate(weekDates[0] ?? '')
    }
  }, [selectedDate, weekDates])

  return [selectedDate, setSelectedDate] as const
}

function availabilityDates() {
  const start = dateOnly(new Date())
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const result: string[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    result.push(toDateInputValue(cursor))
  }

  return result
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: string | undefined) {
  if (!date) return ''
  return date.slice(5).replace('-', '/')
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${date}T00:00:00`))
}

function defaultSlotForDate(date: string, slots: AvailabilitySlot[]): AvailabilitySlot {
  const sortedSlots = [...slots].sort((left, right) => left.startTime.localeCompare(right.startTime))
  const latestSlot = sortedSlots[sortedSlots.length - 1]
  const startMinutes = latestSlot
    ? minutesFromTime(latestSlot.startTime) + 60
    : isToday(date)
      ? nextWholeHourAfterOneHour()
      : 9 * 60

  return {
    date,
    startTime: timeFromMinutes(startMinutes),
    endTime: timeFromMinutes(startMinutes + 50),
  }
}

function isToday(date: string) {
  return date === toDateInputValue(new Date())
}

function nextWholeHourAfterOneHour() {
  const now = new Date()
  now.setHours(now.getHours() + 1)
  if (now.getMinutes() || now.getSeconds() || now.getMilliseconds()) {
    now.setHours(now.getHours() + 1)
  }

  return now.getHours() * 60
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function timeFromMinutes(value: number) {
  const normalized = Math.max(0, Math.min(value, 23 * 60 + 59))
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
