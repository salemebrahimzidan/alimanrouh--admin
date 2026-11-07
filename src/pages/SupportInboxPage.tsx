import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  CircleDot,
  Mail,
  Phone,
  Send,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  deleteSupportConversation,
  listSupportConversations,
  listSupportMessages,
  markSupportConversationRead,
  sendSupportReply,
  setSupportConversationStatus,
  type SupportConversationRow,
  type SupportConversationStatus,
  type SupportMessageRow,
} from '../lib/api'
import { displayName, errorText, formatDateTime } from '../lib/format'
import { db } from '../lib/supabase'
import { Badge, Button, EmptyState, EnglishWhen, ErrorBanner, FilterSelect, LoadingState, cx } from '../components/ui'
import type { Tone } from '../lib/labels'

const statusLabels: Record<SupportConversationStatus, string> = {
  new: 'جديد',
  in_progress: 'قيد المتابعة',
  resolved: 'تم الحل',
}

const statusTones = {
  new: 'warning',
  in_progress: 'info',
  resolved: 'success',
} as const

const statusFilterOptions = [
  { value: 'new', label: statusLabels.new, tone: statusTones.new },
  { value: 'in_progress', label: statusLabels.in_progress, tone: statusTones.in_progress },
  { value: 'resolved', label: statusLabels.resolved, tone: statusTones.resolved },
]

const topicMeta: Record<string, { label: string; tone: Tone }> = {
  general: { label: 'استفسار عام', tone: 'neutral' },
  hajj: { label: 'استفسار حج', tone: 'gold' },
  umrah: { label: 'استفسار عمرة', tone: 'info' },
  booking: { label: 'استفسار حجز', tone: 'info' },
  complaint: { label: 'شكوى', tone: 'danger' },
}

function resolveTopic(item: SupportConversationRow) {
  if (item.topic && topicMeta[item.topic]) return topicMeta[item.topic]
  const subject = item.subject.trim()
  const match = Object.values(topicMeta).find((meta) => meta.label === subject || subject.includes(meta.label))
  if (match) return match
  if (subject.includes('شكوى')) return topicMeta.complaint
  return {
    label: subject || 'تذكرة',
    tone: 'neutral' as Tone,
  }
}

export function SupportInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialConversationId = searchParams.get('conversation')
  const [conversations, setConversations] = useState<SupportConversationRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SupportConversationStatus | 'all'>('all')
  const [messages, setMessages] = useState<SupportMessageRow[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(selectedId)
  const bottomRef = useRef<HTMLDivElement>(null)

  selectedIdRef.current = selectedId
  const selected = initialConversationId
    ? conversations.find((item) => item.id === initialConversationId) ?? null
    : null
  const unreadTotal = conversations.reduce((total, item) => total + item.admin_unread_count, 0)
  const filteredConversations = statusFilter === 'all'
    ? conversations
    : conversations.filter((item) => item.status === statusFilter)
  const allClientGroups = useMemo(() => groupConversationsByClient(conversations), [conversations])
  const clientGroups = useMemo(() => groupConversationsByClient(filteredConversations), [filteredConversations])
  const selectedClientKey = searchParams.get('client')
  const conversationClientKey = useMemo(() => {
    if (!selected) return null
    return allClientGroups.find(({ tickets }) => tickets.some((item) => item.id === selected.id))?.key ?? null
  }, [selected, allClientGroups])
  const activeClientKey = selectedClientKey || conversationClientKey
  const selectedClient = allClientGroups.find(({ key }) => key === activeClientKey) ?? null
  const selectedClientTickets = selectedClient
    ? statusFilter === 'all'
      ? selectedClient.tickets
      : selectedClient.tickets.filter((item) => item.status === statusFilter)
    : []

  useEffect(() => {
    let active = true
    let conversationRequest = 0
    async function refreshConversations() {
      const request = ++conversationRequest
      try {
        const rows = await listSupportConversations()
        if (active && request === conversationRequest) {
          setConversations(rows)
          if (initialConversationId && rows.some((item) => item.id === initialConversationId)) {
            setSelectedId(initialConversationId)
          }
        }
      } catch (err) {
        if (active && request === conversationRequest) setError(errorText(err))
      } finally {
        if (active && request === conversationRequest) setLoading(false)
      }
    }
    async function refreshSelectedMessages() {
      const conversationId = selectedIdRef.current
      if (!conversationId) return
      try {
        const items = await listSupportMessages(conversationId)
        if (active && selectedIdRef.current === conversationId) setMessages(items)
      } catch (err) {
        if (active && selectedIdRef.current === conversationId) setError(errorText(err))
      }
    }

    void refreshConversations()
    const channel = db()
      .channel('admin-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        void refreshConversations()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        const row = payload.new as { conversation_id?: string }
        if (row.conversation_id === selectedIdRef.current) {
          void refreshSelectedMessages()
        }
        void refreshConversations()
      })
      .subscribe((status) => {
        if (active && status === 'SUBSCRIBED') {
          setError(null)
          void refreshConversations()
          void refreshSelectedMessages()
        } else if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
          setError('تعذّر الاتصال بالتحديث المباشر. أعد تحميل الصفحة للتحقق من الرسائل الجديدة.')
        }
      })

    return () => {
      active = false
      void db().removeChannel(channel)
    }
  }, [initialConversationId])

  useEffect(() => {
    if (!initialConversationId) {
      setSelectedId(null)
    } else if (conversations.some((item) => item.id === initialConversationId)) {
      setSelectedId(initialConversationId)
    }
  }, [initialConversationId, conversations])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    const conversationId = selectedId
    let active = true
    setMessagesLoading(true)
    setError(null)
    async function openConversation() {
      try {
        await markSupportConversationRead(conversationId)
        const [messageRows, conversationRows] = await Promise.all([
          listSupportMessages(conversationId),
          listSupportConversations(),
        ])
        if (!active) return
        setMessages(messageRows)
        setConversations(conversationRows)
      } catch (err) {
        if (active) setError(errorText(err))
      } finally {
        if (active) setMessagesLoading(false)
      }
    }
    void openConversation()
    return () => {
      active = false
    }
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function changeStatus(status: SupportConversationStatus) {
    if (!selected || updatingStatus || deleting || selected.status === status) return
    if (status === 'resolved') {
      await completeAndDelete(selected)
      return
    }
    setUpdatingStatus(true)
    setError(null)
    try {
      await setSupportConversationStatus(selected.id, status)
      setConversations((current) => current.map((item) => item.id === selected.id ? { ...item, status } : item))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function completeAndDelete(item: SupportConversationRow) {
    if (updatingStatus || deleting) return
    setUpdatingStatus(true)
    setDeleting(true)
    setError(null)
    try {
      if (item.status !== 'resolved') {
        await setSupportConversationStatus(item.id, 'resolved')
      }
      await deleteSupportConversation(item.id)
      setConversations((current) => current.filter((row) => row.id !== item.id))
      setDraft('')
      if (selected?.id === item.id || initialConversationId === item.id) {
        closeConversation()
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setUpdatingStatus(false)
      setDeleting(false)
    }
  }

  async function removeConversation(item: SupportConversationRow) {
    if (item.status !== 'resolved' || deleting) return
    await completeAndDelete(item)
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || selected.status === 'resolved' || !draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await sendSupportReply(selected.id, draft)
      if (selected.status === 'new') {
        await setSupportConversationStatus(selected.id, 'in_progress')
      }
      setDraft('')
      const [messageRows, conversationRows] = await Promise.all([
        listSupportMessages(selected.id),
        listSupportConversations(),
      ])
      setMessages(messageRows)
      setConversations(conversationRows)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSending(false)
    }
  }

  function selectConversation(id: string) {
    setSelectedId(id)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('conversation', id)
    const group = allClientGroups.find(({ tickets }) => tickets.some((item) => item.id === id))
    if (group) nextSearchParams.set('client', group.key)
    setSearchParams(nextSearchParams)
  }

  function closeConversation() {
    setSelectedId(null)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('conversation')
    setSearchParams(nextSearchParams)
  }

  function selectClient(key: string) {
    setSelectedId(null)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('client', key)
    nextSearchParams.delete('conversation')
    setSearchParams(nextSearchParams)
  }

  function closeClient() {
    setSelectedId(null)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('client')
    nextSearchParams.delete('conversation')
    setSearchParams(nextSearchParams)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-navy">الاستفسارات</h2>
          <p className="mt-1 text-sm text-muted">صندوق واحد للتواصل مع العملاء والضيوف بشأن الحج والعمرة والحجوزات والشكاوى.</p>
        </div>
        {unreadTotal > 0 ? (
          <Badge tone="warning">{unreadTotal.toLocaleString('en-GB')} رسالة غير مقروءة</Badge>
        ) : null}
      </div>
      {error ? <div className="mb-4"><ErrorBanner message={error} /></div> : null}
      {loading ? (
        <LoadingState />
      ) : (
        <section className="min-h-[30rem] overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          {activeClientKey || selected ? (
            <div className="relative flex min-h-[30rem] flex-col lg:h-[min(36rem,calc(100dvh-11rem))] lg:flex-row">
              {selected ? (
                <aside className="hidden w-44 shrink-0 flex-col border-e border-line bg-slate-50/70 lg:flex">
                  <div className="border-b border-line px-3 py-3">
                    <p className="text-xs font-medium text-muted">التذاكر</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-navy">
                      {selectedClient ? conversationName(selectedClient.client) : 'العميل'}
                    </p>
                  </div>
                  <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                    {selectedClientTickets.map((item) => {
                      const topic = resolveTopic(item)
                      const unread = item.admin_unread_count > 0
                      const active = selected.id === item.id
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectConversation(item.id)}
                            className={cx(
                              'mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start transition',
                              active ? 'bg-white shadow-sm ring-1 ring-gold/40' : 'hover:bg-white/80',
                            )}
                          >
                            <Badge tone={topic.tone}>{topic.label}</Badge>
                            {unread ? (
                              <span className="rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white" dir="ltr">
                                {item.admin_unread_count.toLocaleString('en-GB')}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="border-t border-line p-2">
                    <Button type="button" variant="ghost" className="h-8 w-full px-2 text-xs" onClick={closeConversation}>
                      كل التفاصيل
                    </Button>
                  </div>
                </aside>
              ) : (
                <div className="min-w-0 flex-1 overflow-y-auto">
                  <div className="space-y-3 border-b border-line px-4 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button type="button" variant="ghost" className="h-9 shrink-0 px-2" onClick={closeClient}>
                        <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        <span>العودة إلى العملاء</span>
                      </Button>
                      <FilterSelect
                        label="تصفية حسب الحالة"
                        value={statusFilter === 'all' ? '' : statusFilter}
                        options={statusFilterOptions}
                        onChange={(value) => setStatusFilter((value || 'all') as SupportConversationStatus | 'all')}
                        className="w-48"
                      />
                    </div>
                    {selectedClient ? (
                      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-canvas/70 px-4 py-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-soft text-navy">
                          <UserRound className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-semibold text-navy">
                            {conversationName(selectedClient.client)}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(selectedClient.client.customer_mobile || selectedClient.client.guest_phone) ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink">
                                <Phone className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                                <span dir="ltr">{selectedClient.client.customer_mobile || selectedClient.client.guest_phone}</span>
                              </span>
                            ) : null}
                            {(selectedClient.client.customer_email || selectedClient.client.guest_email) ? (
                              <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                                <span className="truncate">{selectedClient.client.customer_email || selectedClient.client.guest_email}</span>
                              </span>
                            ) : null}
                            {!selectedClient.client.customer_mobile && !selectedClient.client.guest_phone && !selectedClient.client.customer_email && !selectedClient.client.guest_email ? (
                              <span className="text-xs text-muted">لا توجد بيانات تواصل</span>
                            ) : null}
                          </div>
                        </div>
                        <Badge tone="gold">{selectedClientTickets.length.toLocaleString('en-GB')} تذكرة</Badge>
                      </div>
                    ) : null}
                  </div>
                  {!selectedClient ? (
                    <EmptyState title="لم يتم العثور على العميل" body="قد تكون بيانات هذا العميل قد تغيّرت." />
                  ) : selectedClientTickets.length === 0 ? (
                    <EmptyState title="لا توجد تذاكر بهذه الحالة" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-right text-sm">
                        <thead className="bg-slate-50 text-xs text-muted">
                          <tr>
                            {['النوع', 'آخر رسالة', 'المرسل', 'التاريخ', 'الحالة', 'الإجراءات'].map((header) => (
                              <th key={header} className="whitespace-nowrap px-4 py-3 font-medium">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClientTickets.map((item) => {
                            const topic = resolveTopic(item)
                            const unread = item.admin_unread_count > 0
                            return (
                              <tr
                                key={item.id}
                                className={cx(
                                  'cursor-pointer border-t border-line transition hover:bg-slate-100 even:bg-slate-50',
                                  unread && 'bg-gold-soft/30 even:bg-gold-soft/30',
                                )}
                                onClick={() => selectConversation(item.id)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Badge tone={topic.tone}>{topic.label}</Badge>
                                    {unread ? (
                                      <span className="rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white" dir="ltr">
                                        {item.admin_unread_count.toLocaleString('en-GB')}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="max-w-xs px-4 py-3">
                                  <p className={cx('truncate', unread ? 'font-medium text-navy' : 'text-ink')}>
                                    {item.last_message || item.subject || '—'}
                                  </p>
                                  {item.context ? <p className="mt-0.5 truncate text-xs text-muted">{item.context}</p> : null}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-muted">
                                  {item.last_message_sender === 'admin' ? 'الإدارة' : 'العميل'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-muted">
                                  <EnglishWhen value={item.last_message_at} />
                                </td>
                                <td className="px-4 py-3">
                                  <Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                  {item.status === 'resolved' ? (
                                    <button
                                      type="button"
                                      aria-label="حذف التذكرة"
                                      disabled={deleting || updatingStatus}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void removeConversation(item)
                                      }}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {selected ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 bg-navy/35 lg:hidden"
                    aria-label="إغلاق المحادثة"
                    onClick={closeConversation}
                  />
                  <aside className="fixed inset-y-0 start-0 z-40 flex w-[min(100%,26rem)] flex-col border-line bg-white shadow-xl lg:static lg:z-auto lg:h-full lg:min-w-0 lg:flex-1 lg:shadow-none">
                    <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                      <Button type="button" variant="ghost" className="h-8 shrink-0 px-2" onClick={closeConversation}>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        <span className="text-xs">التذاكر</span>
                      </Button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold text-navy">{conversationName(selected)}</h3>
                          <Badge tone={statusTones[selected.status]}>{statusLabels[selected.status]}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted">
                          {selected.guest_email || selected.customer_email || selected.guest_phone || selected.customer_mobile || '—'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-navy"
                        aria-label="إغلاق المحادثة"
                        onClick={closeConversation}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </header>
                    <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-canvas px-3 py-3">
                      {messagesLoading ? (
                        <LoadingState plain />
                      ) : messages.length === 0 ? (
                        <EmptyState title="لا توجد رسائل" />
                      ) : messages.map((item) => <MessageBubble key={item.id} message={item} />)}
                      <div ref={bottomRef} />
                    </div>
                    {selected.status === 'resolved' ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50 px-3 py-3">
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                          المحادثة مغلقة
                        </p>
                        <Button
                          type="button"
                          variant="danger"
                          className="h-8 px-2.5 text-xs"
                          disabled={deleting || updatingStatus}
                          onClick={() => void removeConversation(selected)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {deleting ? 'جارٍ الحذف...' : 'حذف التذكرة'}
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={sendReply} className="border-t border-line bg-white p-3">
                        <label className="sr-only" htmlFor="support-reply">اكتب ردك</label>
                        <div className="flex items-end gap-2">
                          <textarea
                            id="support-reply"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault()
                                event.currentTarget.form?.requestSubmit()
                              }
                            }}
                            rows={2}
                            maxLength={5000}
                            placeholder="اكتب ردك..."
                            className="min-h-10 max-h-28 min-w-0 flex-1 resize-y rounded-lg border border-line bg-slate-50 px-2.5 py-2 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
                          />
                          <Button type="submit" disabled={sending || !draft.trim()} className="h-10 shrink-0 px-3">
                            <Send className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {selected.status === 'new' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-8 px-2.5 text-xs"
                              disabled={updatingStatus}
                              onClick={() => void changeStatus('in_progress')}
                            >
                              <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                              قيد المتابعة
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            className="h-8 px-2.5 text-xs"
                            disabled={updatingStatus || deleting}
                            onClick={() => void changeStatus('resolved')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {updatingStatus || deleting ? 'جارٍ الإنهاء...' : 'تم الحل'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </aside>
                </>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
                <div>
                  <h3 className="font-semibold text-navy">العملاء والتذاكر</h3>
                </div>
                <FilterSelect
                  label="تصفية حسب الحالة"
                  value={statusFilter === 'all' ? '' : statusFilter}
                  options={statusFilterOptions}
                  onChange={(value) => setStatusFilter((value || 'all') as SupportConversationStatus | 'all')}
                  className="w-48"
                />
              </div>
              {filteredConversations.length === 0 ? (
                <EmptyState
                  title={conversations.length === 0 ? 'لا توجد تذاكر' : 'لا توجد تذاكر بهذه الحالة'}
                  body={conversations.length === 0 ? 'ستظهر هنا استفسارات العملاء والشكاوى الجديدة.' : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-right text-sm">
                    <thead className="bg-slate-50 text-xs text-muted">
                      <tr>
                        {['العميل', 'الجوال', 'البريد', 'التذاكر', 'آخر رسالة', 'التاريخ', 'غير مقروء'].map((header) => (
                          <th key={header} className="whitespace-nowrap px-4 py-3 font-medium">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientGroups.map(({ key, client, tickets }) => {
                        const unread = tickets.reduce((total, item) => total + item.admin_unread_count, 0)
                        const latest = tickets[0]
                        const phone = client.customer_mobile || client.guest_phone || ''
                        const email = client.customer_email || client.guest_email || ''
                        return (
                          <tr
                            key={key}
                            className={cx(
                              'cursor-pointer border-t border-line transition hover:bg-slate-100 even:bg-slate-50',
                              unread > 0 && 'bg-gold-soft/30 even:bg-gold-soft/30',
                            )}
                            onClick={() => selectClient(key)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium text-navy">{conversationName(client)}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-muted" dir="ltr">
                              {phone || '—'}
                            </td>
                            <td className="max-w-[14rem] px-4 py-3 text-muted">
                              <span className="block truncate">{email || '—'}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink" dir="ltr">
                              {tickets.length.toLocaleString('en-GB')}
                            </td>
                            <td className="max-w-[16rem] px-4 py-3">
                              <span className="block truncate text-ink">{latest?.last_message || '—'}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-muted">
                              {latest?.last_message_at ? <EnglishWhen value={latest.last_message_at} /> : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {unread > 0 ? (
                                <Badge tone="warning">{unread.toLocaleString('en-GB')}</Badge>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

function conversationName(conversation: SupportConversationRow) {
  return conversation.customer_id
    ? displayName(conversation.customer_name)
    : displayName(conversation.guest_name)
}

function groupConversationsByClient(conversations: SupportConversationRow[]) {
  const groups = new Map<string, SupportConversationRow[]>()

  for (const conversation of conversations) {
    const guestContact = conversation.guest_phone?.trim().replace(/\D/g, '')
      || conversation.guest_email?.trim().toLowerCase()
    const key = conversation.customer_id
      ? `customer:${conversation.customer_id}`
      : guestContact
        ? `guest:${guestContact}`
        : `conversation:${conversation.id}`
    const tickets = groups.get(key) ?? []
    tickets.push(conversation)
    groups.set(key, tickets)
  }

  return Array.from(groups, ([key, tickets]) => ({ key, client: tickets[0], tickets }))
}

function MessageBubble({ message }: { message: SupportMessageRow }) {
  const isAdmin = message.sender === 'admin'
  return (
    <div className={cx('flex', isAdmin ? 'justify-start' : 'justify-end')}>
      <article className={cx(
        'max-w-[92%] rounded-xl px-3 py-2 shadow-sm',
        isAdmin ? 'rounded-ts-sm bg-navy text-white' : 'rounded-te-sm border border-gold/30 bg-white text-ink',
      )}>
        <p className={cx('mb-0.5 flex items-center gap-1 text-[10px]', isAdmin ? 'text-white/70' : 'text-muted')}>
          {isAdmin ? <CheckCheck className="h-3 w-3 text-gold" aria-hidden="true" /> : null}
          {isAdmin ? 'الإدارة' : 'العميل'}
        </p>
        <p className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.body}</p>
        <time className={cx('mt-1 block text-[10px]', isAdmin ? 'text-white/60' : 'text-muted')} dateTime={message.created_at} dir="ltr">
          {formatDateTime(message.created_at)}
        </time>
      </article>
    </div>
  )
}
