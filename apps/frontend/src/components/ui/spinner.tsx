export function Spinner({
  size = 'md'
}: Readonly<{ size?: 'lg' | 'md' | 'sm' }>) {
  const sizeClass = { lg: 'h-10 w-10', md: 'h-6 w-6', sm: 'h-4 w-4' }[size];

  return (
    <div
      aria-label="Loading"
      className={`${sizeClass} animate-spin rounded-full border-2 border-gray-300 border-t-blue-600`}
      role="status"
    />
  );
}
