import { useQuery } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';

import { GET_ARENAS } from '../../graphql/queries/arenas.js';
import { type Arena } from '../../types.js';
import { ErrorMessage } from '../ui/error-message.js';
import { Spinner } from '../ui/spinner.js';

const DEBOUNCE_MS = 300;

interface Properties {
  onSelect: (arena: Arena) => void;
  selectedId: null | string;
}

export function ArenaList({ onSelect, selectedId }: Readonly<Properties>) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerReference = useRef<null | ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (timerReference.current) {
      clearTimeout(timerReference.current);
    }

    timerReference.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, DEBOUNCE_MS);

    return () => {
      if (timerReference.current) {
        clearTimeout(timerReference.current);
      }
    };
  }, [search]);

  const { data, error, loading } = useQuery<{ arenas: Arena[] }>(GET_ARENAS, {
    variables: debouncedSearch ? { search: debouncedSearch } : {}
  });

  return (
    <div className="flex flex-col gap-3">
      <input
        aria-label="Search arenas"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        onChange={(event_) => {
          setSearch(event_.target.value);
        }}
        placeholder="Search arenas..."
        type="search"
        value={search}
      />

      {loading && (
        <div className="flex justify-center py-4">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <ErrorMessage message="Failed to load arenas. Please try again." />
      )}

      {!loading && !error && (
        <nav aria-label="Arena list" className="flex flex-col gap-1">
          {data?.arenas.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">
              No arenas found.
            </p>
          )}
          {data?.arenas.map((arena) => (
            <button
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                selectedId === arena.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              key={arena.id}
              onClick={() => {
                onSelect(arena);
              }}
            >
              {arena.name}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
