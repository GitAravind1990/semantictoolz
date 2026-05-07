import type { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'Sign Up — Start Free',
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <SignUp />
    </div>
  )
}
