import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartCareer — Career Intelligence & Job Matching Platform',
  description: 'Evidence-based career platform connecting candidate GitHub skills, coding sandbox assessments, and intelligent job matching.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
