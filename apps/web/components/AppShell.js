'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '../lib/auth';

function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

const NAV = [
    { href: '/sessions', label: 'Sessions' },
    { href: '/simulation', label: 'Simulation' },
    { href: '/dashboard', label: 'Dashboard' },
];

export default function AppShell({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    function handleLogout() {
        clearToken();
        router.push('/login');
    }

    return (
        <div className="min-h-dvh bg-gray-50">
            <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <div className="text-lg font-semibold">Conversation Sim</div>
                    <button
                        onClick={handleLogout}
                        className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
                <aside>
                    <nav className="flex flex-col gap-1">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cx(
                                    'rounded-lg px-3 py-2 text-sm font-medium',
                                    pathname?.startsWith(item.href)
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </aside>

                <main>{children}</main>
            </div>
        </div>
    );
}
