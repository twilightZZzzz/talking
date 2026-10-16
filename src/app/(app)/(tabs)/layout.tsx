import { TabBar } from '@/components/shell/TabBar';
import s from '@/components/shell/shell.module.css';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.frame}>
      <TabBar />
      <main className={s.main}>{children}</main>
    </div>
  );
}
