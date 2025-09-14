'use client';

import { useState, useEffect } from 'react';

interface AuthorDuplicate {
  id: string;
  author1Id: string;
  author1Name: string;
  author2Id: string;
  author2Name: string;
  score: number;
  confidence: string;
  matchReasons: any;
  status: string;
  author1: {
    id: string;
    name: string;
    books: Array<{ id: string; title: string }>;
    deleted?: boolean;
  };
  author2: {
    id: string;
    name: string;
    books: Array<{ id: string; title: string }>;
    deleted?: boolean;
  };
}

interface Stats {
  overview: {
    totalAuthors: number;
    totalDuplicates: number;
    totalMerges: number;
    totalBooksReassigned: number;
    estimatedDuplicateAuthors: number;
    duplicatePercentage: string;
  };
  status: {
    pending: number;
    reviewed: number;
    merged: number;
    dismissed: number;
  };
  confidence: Record<string, number>;
  scoreDistribution: Array<{ label: string; count: number }>;
}

export default function AdminDuplicatesPage() {
  const [duplicates, setDuplicates] = useState<AuthorDuplicate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState({
    status: 'pending',
    minScore: 70,
    confidence: ''
  });
  const [selectedPair, setSelectedPair] = useState<AuthorDuplicate | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchDuplicates();
  }, [filter]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/duplicates/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filter.status,
        minScore: filter.minScore.toString(),
        ...(filter.confidence && { confidence: filter.confidence })
      });
      const res = await fetch(`/api/admin/duplicates?${params}`);
      const data = await res.json();
      setDuplicates(data.duplicates);
    } catch (error) {
      console.error('Error fetching duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const runScan = async (scanType: string) => {
    setScanning(true);
    try {
      const res = await fetch('/api/admin/duplicates/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType, minScore: filter.minScore })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(`Scan completed! Found ${data.duplicatesFound} duplicates.`);
        fetchDuplicates();
        fetchStats();
      }
    } catch (error) {
      console.error('Error running scan:', error);
      alert('Scan failed. Check console for details.');
    } finally {
      setScanning(false);
    }
  };

  const updateDuplicateStatus = async (id: string, status: string, notes?: string) => {
    try {
      const res = await fetch('/api/admin/duplicates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, notes })
      });
      if (res.ok) {
        fetchDuplicates();
        fetchStats();
        setSelectedPair(null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const mergeAuthors = async (duplicate: AuthorDuplicate, targetId: string) => {
    if (!confirm(`Merge ${duplicate.author1Name} and ${duplicate.author2Name}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorIds: [duplicate.author1Id, duplicate.author2Id],
          targetAuthorId: targetId,
          mergeReason: `Duplicate detection: ${duplicate.score}% match`,
          similarityIds: [duplicate.id]
        })
      });
      
      const data = await res.json();
      if (data.status === 'success') {
        alert(`Successfully merged! ${data.booksReassigned} books reassigned.`);
        fetchDuplicates();
        fetchStats();
        setSelectedPair(null);
      }
    } catch (error) {
      console.error('Error merging authors:', error);
      alert('Merge failed. Check console for details.');
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === duplicates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(duplicates.map(d => d.id)));
    }
  };

  const mergeAllSelected = async () => {
    const selectedDuplicates = duplicates.filter(d => selectedIds.has(d.id));
    
    if (selectedDuplicates.length === 0) {
      alert('No duplicates selected');
      return;
    }

    if (!confirm(`Merge ${selectedDuplicates.length} duplicate pairs? Each will be merged into the first author.`)) {
      return;
    }

    setMerging(true);
    let successCount = 0;
    let failCount = 0;

    for (const duplicate of selectedDuplicates) {
      try {
        // Always merge into the first author (author1)
        const res = await fetch('/api/admin/duplicates/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorIds: [duplicate.author1Id, duplicate.author2Id],
            targetAuthorId: duplicate.author1Id,
            mergeReason: `Bulk merge: ${duplicate.score}% match`,
            similarityIds: [duplicate.id]
          })
        });
        
        const data = await res.json();
        if (data.status === 'success') {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Error merging:', error);
        failCount++;
      }
    }

    setMerging(false);
    setSelectedIds(new Set());
    alert(`Merge complete! Success: ${successCount}, Failed: ${failCount}`);
    fetchDuplicates();
    fetchStats();
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Author Duplicate Management</h1>
          <p className="text-gray-600">Review and manage duplicate author entries to maintain data quality.</p>
        </div>

        {/* Statistics Overview */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Authors</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.overview.totalAuthors.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-amber-600 uppercase tracking-wide">Pending Review</h3>
                  <p className="text-3xl font-bold text-amber-700 mt-2">{stats.status.pending}</p>
                </div>
                <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-green-600 uppercase tracking-wide">Merged</h3>
                  <p className="text-3xl font-bold text-green-700 mt-2">{stats.status.merged}</p>
                </div>
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wide">Books Reassigned</h3>
                  <p className="text-3xl font-bold text-blue-700 mt-2">{stats.overview.totalBooksReassigned}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-end flex-1">
              <div className="min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select 
                  value={filter.status}
                  onChange={(e) => setFilter({...filter, status: e.target.value})}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="merged">Merged</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
              
              <div className="min-w-[100px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Score</label>
                <input
                  type="number"
                  value={filter.minScore}
                  onChange={(e) => setFilter({...filter, minScore: parseInt(e.target.value)})}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  min="0"
                  max="100"
                />
              </div>

              <div className="min-w-[120px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">Confidence</label>
                <select 
                  value={filter.confidence}
                  onChange={(e) => setFilter({...filter, confidence: e.target.value})}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="">All</option>
                  <option value="exact">Exact</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Scan Actions */}
            <div className="flex gap-3">
              {selectedIds.size > 0 && (
                <button
                  onClick={mergeAllSelected}
                  disabled={merging}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {merging ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Merging...
                    </>
                  ) : (
                    <>Merge {selectedIds.size} Selected</>
                  )}
                </button>
              )}
              <button
                onClick={() => runScan('exact')}
                disabled={scanning}
                className="inline-flex items-center px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {scanning ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                Exact Scan
              </button>
              <button
                onClick={() => runScan('flipped')}
                disabled={scanning}
                className="inline-flex items-center px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {scanning ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                Flipped Scan
              </button>
              <button
                onClick={() => runScan('full')}
                disabled={scanning}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {scanning ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                Full Scan
              </button>
            </div>
          </div>
        </div>

        {/* Duplicates List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-lg mb-4">
                <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Loading duplicates...</p>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No duplicates found</h3>
              <p className="text-gray-500">Try adjusting your filters or running a new scan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === duplicates.length && duplicates.length > 0}
                        onChange={selectAll}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider">Author 1</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider">Author 2</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider">Match Score</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider">Confidence</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider">Total Books</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {duplicates.map((dup) => (
                    <tr key={dup.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(dup.id)}
                          onChange={() => toggleSelection(dup.id)}
                          className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{dup.author1Name}</div>
                          <div className="text-sm text-gray-500">
                            {dup.author1?.deleted ? (
                              <span className="text-red-500 font-medium">(Deleted)</span>
                            ) : (
                              `${dup.author1?.books?.length || 0} books`
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{dup.author2Name}</div>
                          <div className="text-sm text-gray-500">
                            {dup.author2?.deleted ? (
                              <span className="text-red-500 font-medium">(Deleted)</span>
                            ) : (
                              `${dup.author2?.books?.length || 0} books`
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center justify-center w-12 h-8 rounded-full text-sm font-semibold ${
                          dup.score >= 90 ? 'bg-green-100 text-green-800' :
                          dup.score >= 80 ? 'bg-blue-100 text-blue-800' :
                          dup.score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {dup.score}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          dup.confidence === 'exact' ? 'bg-green-100 text-green-800' :
                          dup.confidence === 'high' ? 'bg-blue-100 text-blue-800' :
                          dup.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {dup.confidence.charAt(0).toUpperCase() + dup.confidence.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {(dup.author1?.books?.length || 0) + (dup.author2?.books?.length || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              console.log('Selected pair:', dup);
                              setSelectedPair(dup);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors text-sm font-medium"
                          >
                            Review
                          </button>
                          {dup.status === 'pending' && (
                            <button
                              onClick={() => updateDuplicateStatus(dup.id, 'dismissed')}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors text-sm font-medium"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Review Modal */}
      {selectedPair && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" 
              onClick={() => setSelectedPair(null)}
            ></div>

            {/* Modal positioning */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Header */}
              <div className="bg-white px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900" id="modal-title">Review Duplicate Authors</h2>
                    <p className="text-sm text-gray-600 mt-1">Compare the authors below and decide how to handle this duplicate.</p>
                  </div>
                  <button
                    onClick={() => setSelectedPair(null)}
                    className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 p-1 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="bg-white px-6 py-6">
                {/* Match Score Banner */}
                <div className={`rounded-lg p-4 mb-6 border-l-4 ${
                  selectedPair.score >= 90 ? 'bg-green-50 border-green-400' :
                  selectedPair.score >= 80 ? 'bg-blue-50 border-blue-400' :
                  selectedPair.score >= 70 ? 'bg-yellow-50 border-yellow-400' :
                  'bg-red-50 border-red-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        selectedPair.score >= 90 ? 'bg-green-400' :
                        selectedPair.score >= 80 ? 'bg-blue-400' :
                        selectedPair.score >= 70 ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`}></div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Match Score: {selectedPair.score}%</h3>
                        <p className="text-sm text-gray-600">Confidence: {selectedPair.confidence.charAt(0).toUpperCase() + selectedPair.confidence.slice(1)}</p>
                      </div>
                    </div>
                    {selectedPair.matchReasons && (
                      <div className="text-sm text-gray-500">
                        <details className="cursor-pointer">
                          <summary className="font-medium hover:text-gray-700">View Match Reasons</summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded whitespace-pre-wrap">
                            {JSON.stringify(selectedPair.matchReasons, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>

                {/* Author Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Author 1 */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">{selectedPair.author1Name}</h3>
                        <p className="text-sm text-gray-500 font-mono">ID: {selectedPair.author1Id}</p>
                        {selectedPair.author1?.deleted && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                            Deleted Author
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="font-medium text-gray-900">Books ({selectedPair.author1?.books?.length || 0})</span>
                      </div>
                      {selectedPair.author1?.books?.length > 0 ? (
                        <div className="bg-white rounded-md border border-gray-200 max-h-40 overflow-y-auto">
                          <ul className="divide-y divide-gray-100">
                            {selectedPair.author1.books.map((book) => (
                              <li key={book.id} className="px-3 py-2 text-sm text-gray-900 hover:bg-gray-50">
                                {book.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="bg-white rounded-md border border-gray-200 px-3 py-4 text-center">
                          <p className="text-sm text-gray-500">No books found</p>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => mergeAuthors(selectedPair, selectedPair.author1Id)}
                      disabled={selectedPair.author1?.deleted}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Keep This Author
                    </button>
                  </div>

                  {/* Author 2 */}
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">{selectedPair.author2Name}</h3>
                        <p className="text-sm text-gray-500 font-mono">ID: {selectedPair.author2Id}</p>
                        {selectedPair.author2?.deleted && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                            Deleted Author
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="font-medium text-gray-900">Books ({selectedPair.author2?.books?.length || 0})</span>
                      </div>
                      {selectedPair.author2?.books?.length > 0 ? (
                        <div className="bg-white rounded-md border border-gray-200 max-h-40 overflow-y-auto">
                          <ul className="divide-y divide-gray-100">
                            {selectedPair.author2.books.map((book) => (
                              <li key={book.id} className="px-3 py-2 text-sm text-gray-900 hover:bg-gray-50">
                                {book.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="bg-white rounded-md border border-gray-200 px-3 py-4 text-center">
                          <p className="text-sm text-gray-500">No books found</p>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => mergeAuthors(selectedPair, selectedPair.author2Id)}
                      disabled={selectedPair.author2?.deleted}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Keep This Author
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <button
                    onClick={() => updateDuplicateStatus(selectedPair.id, 'dismissed', 'Not duplicates')}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Not Duplicates
                  </button>
                  <button
                    onClick={() => updateDuplicateStatus(selectedPair.id, 'reviewed', 'Needs more review')}
                    className="inline-flex items-center justify-center px-4 py-2 border border-yellow-300 text-sm font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mark Reviewed
                  </button>
                  <button
                    onClick={() => setSelectedPair(null)}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}