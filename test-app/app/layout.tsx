import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PWA Test App',
  description: 'Integration test for next-pwa-turbo',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
