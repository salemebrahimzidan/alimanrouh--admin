import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { RequireAdmin } from './auth/RequireAdmin'
import { DashboardLayout } from './components/DashboardLayout'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage'
import { BookingsPage } from './pages/bookings/BookingsPage'
import { BookingDetailPage } from './pages/bookings/BookingDetailPage'
import { PackagesPage } from './pages/packages/PackagesPage'
import { PackageFormPage } from './pages/packages/PackageFormPage'
import { HajjPage } from './pages/hajj/HajjPage'
import { SupportInboxPage } from './pages/SupportInboxPage'
import { getSupportConversationForLegacyInquiry } from './lib/api'
import { HajjProgramFormPage } from './pages/hajj/HajjProgramFormPage'
import { VisasPage } from './pages/visas/VisasPage'
import { VisaDetailPage } from './pages/visas/VisaDetailPage'
import { PaymentsPage } from './pages/payments/PaymentsPage'
import { WebsitePage } from './pages/website/WebsitePage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PortalApp } from './portal/PortalApp'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/portal/*" element={<PortalApp />} />
      <Route element={<RequireAdmin />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="umrah" element={<PackagesPage />} />
          <Route path="umrah/new" element={<PackageFormPage />} />
          <Route path="umrah/:id/edit" element={<PackageFormPage />} />
          <Route path="hajj" element={<HajjPage />} />
          <Route path="inquiries" element={<SupportInboxPage />} />
          <Route path="hajj/inquiries" element={<Navigate to="/inquiries" replace />} />
          <Route path="hajj/inquiries/:id" element={<LegacyInquiryRedirect />} />
          <Route path="hajj/new" element={<HajjProgramFormPage />} />
          <Route path="hajj/:id/edit" element={<HajjProgramFormPage />} />
          <Route path="visas" element={<VisasPage />} />
          <Route path="visas/:id" element={<VisaDetailPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="website" element={<WebsitePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function LegacyInquiryRedirect() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    getSupportConversationForLegacyInquiry(id)
      .then((conversationId) => {
        if (!active) return
        const query = conversationId ? `?conversation=${encodeURIComponent(conversationId)}` : ''
        navigate(`/inquiries${query}`, { replace: true })
      })
      .catch(() => { if (active) setError(true) })
    return () => {
      active = false
    }
  }, [id, navigate])

  return error ? (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      تعذّر فتح الاستفسار القديم. <Link className="font-semibold underline" to="/inquiries">العودة إلى صندوق الاستفسارات</Link>
    </div>
  ) : null
}
