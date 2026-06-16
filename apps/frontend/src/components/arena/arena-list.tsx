import { useState, useEffect, useRef } from "react";
import { useQuery } from "@apollo/client";
import { GET_ARENAS } from "../../graphql/queries/arenas.js";
import { Arena } from "../../types.js";
import { Spinner } from "../ui/spinner.js";
import { ErrorMessage } from "../ui/error-message.js";

interface Props {
  selectedId: string | null;
  onSelect: (arena: Arena) => void;
}

export function ArenaList({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const { data, loading, error } = useQuery<{ arenas: Arena[] }>(GET_ARENAS, {
    variables: debouncedSearch ? { search: debouncedSearch } : {},
  });

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search arenas..."
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Search arenas"
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
              key={arena.id}
              onClick={() => onSelect(arena)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                selectedId === arena.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {arena.name}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
