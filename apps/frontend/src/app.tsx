import { useState } from 'react';

import { ArenaList } from './components/arena/arena-list.js';
import { ArenaView } from './components/arena/arena-view.js';
import { AuthForm } from './components/auth/auth-form.js';
import { Button } from './components/ui/button.js';
import { useAuth } from './contexts/auth-context.js';
import { type Arena } from './types.js';

export default function App() {
  const { isAdmin, logout, user } = useAuth();
  const [selectedArena, setSelectedArena] = useState<Arena | null>(null);

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-base font-bold text-gray-900 sm:text-xl">
            <span className="hidden sm:inline">Game Arena Reservations</span>
            <span className="sm:hidden">Arena Mgmt</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden text-sm text-gray-500 md:inline">
              {user.email}
              {isAdmin && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Admin
                </span>
              )}
            </span>
            {isAdmin && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 md:hidden">
                Admin
              </span>
            )}
            <Button onClick={logout} variant="secondary">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <aside className="lg:w-64 lg:shrink-0">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Arenas
              </h2>
              <ArenaList
                onSelect={setSelectedArena}
                selectedId={selectedArena?.id ?? null}
              />
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            {selectedArena ? (
              <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-6">
                <ArenaView arena={selectedArena} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 sm:h-64">
                <div className="text-center">
                  <p className="text-base font-medium sm:text-lg">
                    Select an arena
                  </p>
                  <p className="text-sm">
                    Choose an arena above to manage its sessions
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
