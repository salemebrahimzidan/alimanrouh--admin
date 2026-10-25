import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCheck, Send, UserRound } from 'lucide-react'
import {
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
import { Badge, Button, EmptyState, ErrorBanner, LoadingState, cx } from '../components/ui'

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
  const selectedClient = allClientGroups.find(({ key }) => key === selectedClientKey) ?? null
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
    if (!selected || updatingStatus || selected.status === status) return
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

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await sendSupportReply(selected.id, draft)
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
          {selected ? (
            <div className="flex h-[calc(100dvh-12rem)] min-h-[30rem] flex-col">
              <header className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 shrink-0 px-2"
                  onClick={closeConversation}
                >
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  <span>العودة إلى التذاكر</span>
                </Button>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-navy">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-navy">{conversationName(selected)}</h3>
                  <p className="truncate text-xs text-muted">
                    {selected.guest_email || selected.customer_email || selected.guest_phone || selected.customer_mobile || selected.subject}
                  </p>
                  {selected.context ? <p className="mt-1 truncate text-xs text-muted">{selected.context}</p> : null}
                </div>
                <label className="shrink-0">
                  <span className="sr-only">حالة المحادثة</span>
                  <select
                    value={selected.status}
                    disabled={updatingStatus}
                    onChange={(event) => void changeStatus(event.target.value as SupportConversationStatus)}
                    className="h-9 max-w-32 rounded-lg border border-line bg-white px-2 text-xs text-navy sm:max-w-none sm:px-3 sm:text-sm"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </header>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-5 sm:px-6">
                {messagesLoading ? (
                  <LoadingState plain />
                ) : messages.length === 0 ? (
                  <EmptyState title="لا توجد رسائل" />
                ) : messages.map((item) => <MessageBubble key={item.id} message={item} />)}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendReply} className="border-t border-line bg-white p-3 sm:p-4">
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
                    placeholder="اكتب ردك... (Enter للإرسال)"
                    className="min-h-11 max-h-36 min-w-0 flex-1 resize-y rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
                  />
                  <Button type="submit" disabled={sending || !draft.trim()} className="h-11 shrink-0 px-3 sm:px-4">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{sending ? 'جارٍ الإرسال...' : 'إرسال'}</span>
                  </Button>
                </div>
              </form>
            </div>
          ) : selectedClientKey ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Button type="button" variant="ghost" className="h-9 shrink-0 px-2" onClick={closeClient}>
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    <span>العودة إلى العملاء</span>
                  </Button>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-navy">
                      {selectedClient ? conversationName(selectedClient.client) : 'العميل'}
                    </h3>
                    {selectedClient ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {selectedClient.client.customer_mobile || selectedClient.client.guest_phone || selectedClient.client.customer_email || selectedClient.client.guest_email || 'عميل'}
                      </p>
                    ) : null}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <span>تصفية حسب الحالة</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as SupportConversationStatus | 'all')}
                    className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-navy"
                  >
                    <option value="all">كل الحالات</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {!selectedClient ? (
                <EmptyState title="لم يتم العثور على العميل" body="قد تكون بيانات هذا العميل قد تغيّرت." />
              ) : selectedClientTickets.length === 0 ? (
                <EmptyState title="لا توجد تذاكر بهذه الحالة" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-start text-sm">
                    <thead className="bg-slate-50 text-xs text-muted">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-medium">التذكرة</th>
                        <th scope="col" className="px-5 py-3 font-medium">آخر رسالة</th>
                        <th scope="col" className="px-5 py-3 font-medium">التاريخ</th>
                        <th scope="col" className="px-5 py-3 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {selectedClientTickets.map((item) => (
                        <tr key={item.id} className="transition hover:bg-[#fbf7f1]">
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => selectConversation(item.id)}
                              className="text-start font-semibold text-navy hover:underline"
                            >
                              {item.subject}
                            </button>
                            {item.admin_unread_count > 0 ? (
                              <p className="mt-1 text-xs text-amber-800">
                                {item.admin_unread_count.toLocaleString('en-GB')} رسالة غير مقروءة
                              </p>
                            ) : null}
                          </td>
                          <td className="max-w-72 px-5 py-4 text-muted">
                            <p className="truncate">{item.last_message || '—'}</p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-muted" dir="ltr">
                            {formatDateTime(item.last_message_at)}
                          </td>
                          <td className="px-5 py-4">
                            <Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
                <div>
                  <h3 className="font-semibold text-navy">العملاء والتذاكر</h3>
                  <p className="mt-1 text-xs text-muted">
                    {clientGroups.length.toLocaleString('en-GB')} عميل · {filteredConversations.length.toLocaleString('en-GB')} من {conversations.length.toLocaleString('en-GB')} تذكرة
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <span>تصفية حسب الحالة</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as SupportConversationStatus | 'all')}
                    className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-navy"
                  >
                    <option value="all">كل الحالات</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {filteredConversations.length === 0 ? (
                <EmptyState
                  title={conversations.length === 0 ? 'لا توجد تذاكر' : 'لا توجد تذاكر بهذه الحالة'}
                  body={conversations.length === 0 ? 'ستظهر هنا استفسارات العملاء والشكاوى الجديدة.' : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-start text-sm">
                    <thead className="bg-slate-50 text-xs text-muted">
                      <tr>
                        <th scope="col" className="w-1/4 px-5 py-3 font-medium">العميل</th>
                        <th scope="col" className="px-5 py-3 font-medium">تذاكر العميل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {clientGroups.map(({ key, client, tickets }) => (
                        <tr key={key} className="transition hover:bg-[#fbf7f1]">
                          <td colSpan={2} className="p-0">
                            <button
                              type="button"
                              onClick={() => selectClient(key)}
                              className="flex w-full items-center gap-3 px-5 py-4 text-start transition hover:bg-[#fbf7f1]"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-navy">
                                <UserRound className="h-5 w-5" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-navy">{conversationName(client)}</span>
                                <span className="mt-1 block break-all text-xs text-muted">
                                  {client.customer_mobile || client.guest_phone || client.customer_email || client.guest_email || 'عميل'}
                                </span>
                              </span>
                              <Badge>{tickets.length.toLocaleString('en-GB')} تذكرة</Badge>
                              <span className="shrink-0 text-sm font-medium text-navy">عرض التذاكر</span>
                            </button>
                          </td>
                        </tr>
                      ))}
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
        'max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%]',
        isAdmin ? 'rounded-ts-sm bg-navy text-white' : 'rounded-te-sm border border-gold/30 bg-white text-ink',
      )}>
        <p className={cx('mb-1 flex items-center gap-1.5 text-[11px]', isAdmin ? 'text-white/70' : 'text-muted')}>
          {isAdmin ? <CheckCheck className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> : null}
          {isAdmin ? 'الإدارة' : 'العميل'}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
        <time className={cx('mt-2 block text-[10px]', isAdmin ? 'text-white/60' : 'text-muted')} dateTime={message.created_at} dir="ltr">
          {formatDateTime(message.created_at)}
        </time>
      </article>
    </div>
  )
}
