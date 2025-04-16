import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { setupGlobalErrorHandling } from '@/lib/globalErrorHandler';

// Set up global error handling
if (typeof window === 'undefined') {
  // Only run on the server side
  setupGlobalErrorHandling();
}

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Personal Site Backend',
  description: 'Backend API for personal website',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
} 