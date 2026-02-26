import React from 'react';

export function SkeletonRow({ cols = 6 }) {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 8, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
      <div className="h-10 bg-gray-200 rounded w-2/3"></div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="animate-pulse">
      <div className="bg-gray-900 rounded-xl p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="h-3 bg-gray-700 rounded w-1/2 mx-auto mb-2"></div>
              <div className="h-8 bg-gray-700 rounded w-3/4 mx-auto mb-1"></div>
              <div className="h-2 bg-gray-700 rounded w-1/3 mx-auto"></div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700 pt-2">
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => (
              <div key={i} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="h-3 bg-gray-700 rounded w-1/2 mx-auto mb-2"></div>
                <div className="h-6 bg-gray-700 rounded w-2/3 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-xl border bg-gray-50 p-4">
            <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-1"></div>
            <div className="h-2 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
