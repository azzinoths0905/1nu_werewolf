import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '狼人杀一夜版',
  description: '线下朋友局移动端 MVP 界面',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
