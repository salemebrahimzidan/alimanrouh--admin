import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addNote, listHajjPrograms, listInquiries, listNotes, setInquiryStatus, type HajjProgramRow, type InquiryRow, type InternalNote } from '../../lib/api'
import { hajjDisclaimer } from '../../lib/config'
import { displayName, errorText, formatDateTime, formatMoney } from '../../lib/format'
import { hajjInquiryStatuses, inquiryTone, label, type HajjInquiryStatus } from '../../lib/labels'
import { useAuth } from '../../auth/AuthProvider'
import { Badge, Button, DataShell, EmptyState, ErrorBanner, LoadingState, Notice, PageHeader } from '../../components/ui'

export function HajjPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'inquiries' ? 'inquiries' : 'programs'
  const [programs, setPrograms] = useState<HajjProgramRow[]>([])
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listHajjPrograms(), listInquiries()])
      .then(([programRows, inquiryRows]) => {
        if (!active) return
        setPrograms(programRows)
        setInquiries(inquiryRows)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [version])

  return (
    <div>
      <PageHeader
        title="برامج الحج"
        description="إدارة معلومات البرامج واستفسارات العملاء. الحالات هنا داخلية ولا تمثل توفر مقاعد رسمية."
        action={tab === 'programs' ? <Link to="/hajj/new"><Button>إضافة برنامج</Button></Link> : undefined}
      />
      <Notice>{hajjDisclaimer}</Notice>
      <div className="my-4 flex gap-2">
        <Button variant={tab === 'programs' ? 'primary' : 'secondary'} onClick={() => setParams({})}>البرامج</Button>
        <Button variant={tab === 'inquiries' ? 'primary' : 'secondary'} onClick={() => setParams({ tab: 'inquiries' })}>الاستفسارات</Button>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {!loading && !error && tab === 'programs' ? <ProgramTable rows={programs} /> : null}
      {!loading && !error && tab === 'inquiries' ? (
        <InquiryTable
          rows={inquiries}
          onChanged={() => setVersion((current) => current + 1)}
          onError={(message) => setError(message)}
        />
      ) : null}
    </div>
  )
}

function ProgramTable({ rows }: { rows: HajjProgramRow[] }) {
  if (rows.length === 0) return <DataShell><EmptyState title="لا توجد برامج حج" /></DataShell>
  return (
    <DataShell>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-slate-50 text-muted">
            <tr>
              {['البرنامج', 'الموسم', 'السعر', 'الحالة الداخلية', ''].map((header) => (
                <th key={header} className="px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{item.title}</td>
                <td className="px-4 py-3">{item.season_label || '—'}</td>
                <td className="px-4 py-3">{item.price_sar == null ? '—' : formatMoney(item.price_sar)}</td>
                <td className="px-4 py-3"><Badge tone={item.is_published ? 'success' : 'neutral'}>{label.program(item.internal_status)}</Badge></td>
                <td className="px-4 py-3"><Link className="text-navy" to={`/hajj/${item.id}/edit`}>تعديل</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataShell>
  )
}

function InquiryTable({
  rows,
  onChanged,
  onError,
}: {
  rows: InquiryRow[]
  onChanged: () => void
  onError: (message: string) => void
}) {
  const { session } = useAuth()
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState<InternalNote[]>([])

  async function changeStatus(id: string, status: HajjInquiryStatus) {
    try {
      await setInquiryStatus(id, status)
      onChanged()
    } catch (err) {
      onError(errorText(err))
    }
  }

  async function openNotes(id: string) {
    setOpenId(id)
    try {
      setNotes(await listNotes('hajj_inquiry', id))
    } catch (err) {
      onError(errorText(err))
    }
  }

  async function saveNote(id: string) {
    if (!session || !note.trim()) return
    try {
      await addNote('hajj_inquiry', id, note.trim(), session.user.id)
      setNote('')
      await openNotes(id)
    } catch (err) {
      onError(errorText(err))
    }
  }

  if (rows.length === 0) return <DataShell><EmptyState title="لا توجد استفسارات" body="تظهر استفسارات الحج التي يرسلها العملاء من حساباتهم." /></DataShell>
  return (
    <DataShell>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-right text-sm">
          <thead className="bg-slate-50 text-muted">
            <tr>
              {['العميل', 'البرنامج', 'المسافرون', 'التاريخ', 'الحالة'].map((header) => (
                <th key={header} className="px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="border-t border-line align-top">
                <td className="px-4 py-3">
                  <Link className="font-medium text-navy" to={`/customers/${item.customer_id}`}>{displayName(item.customer_name)}</Link>
                  <p className="mt-1 text-xs text-muted">{item.customer_mobile || item.customer_email || '—'}</p>
                  {item.message ? <p className="mt-2 max-w-xs whitespace-pre-wrap text-xs leading-5 text-ink">{item.message}</p> : null}
                  <button type="button" className="mt-2 text-xs text-navy" onClick={() => openNotes(item.id)}>الملاحظات الداخلية</button>
                  {openId === item.id ? (
                    <div className="mt-2 space-y-2">
                      {notes.length === 0 ? <p className="text-xs text-muted">لا توجد ملاحظات.</p> : notes.map((item) => <p key={item.id} className="rounded bg-slate-50 p-2 text-xs">{item.body}</p>)}
                      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="w-full rounded-lg border border-line p-2 text-xs" />
                      <Button variant="secondary" onClick={() => saveNote(item.id)}>حفظ الملاحظة</Button>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{item.program_title || 'استفسار عام'}</td>
                <td className="px-4 py-3">{item.travelers_count.toLocaleString('ar-SA')}</td>
                <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
                <td className="px-4 py-3">
                  <Badge tone={inquiryTone(item.internal_status)}>{label.inquiry(item.internal_status)}</Badge>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-2 text-xs"
                    value={item.internal_status}
                    onChange={(event) => changeStatus(item.id, event.target.value as HajjInquiryStatus)}
                  >
                    {hajjInquiryStatuses.map((status) => (
                      <option key={status} value={status}>{label.inquiry(status)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataShell>
  )
}
