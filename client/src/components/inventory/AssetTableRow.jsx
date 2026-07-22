import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import { ChevronRight, MapPin, User } from 'lucide-react';

export default function AssetTableRow({ asset }) {
  return (
    <tr className="hover:bg-slate-700/40 transition-colors group">
      {/* Category Icon & Badge */}
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge
          badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
          color={asset.categoryColor}
          title={asset.categoryName || 'Category'}
        />
      </td>

      {/* Asset Name & Model */}
      <td className="px-6 py-4 whitespace-nowrap min-w-[180px]">
        <Link
          to={`/inventory/${asset.id}`}
          className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors block text-sm"
        >
          {asset.name}
        </Link>
        {asset.model && <span className="text-xs text-slate-400 block truncate max-w-[200px]">{asset.model}</span>}
      </td>

      {/* Serial Number (Monospace per Design 2.2) */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="font-mono text-xs text-slate-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/80 select-all">
          {asset.serialNumber}
        </span>
      </td>

      {/* Status Pill */}
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusPill status={asset.status} />
      </td>

      {/* Location */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
        {asset.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{asset.location}</span>
          </span>
        ) : (
          <span className="text-slate-500 italic">—</span>
        )}
      </td>

      {/* Assigned To */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 min-w-[160px]">
        {asset.status === 'in-use' && asset.assigneeName ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-medium text-slate-200 block truncate max-w-[140px]">{asset.assigneeName}</span>
              {asset.assigneeDepartment && (
                <span className="text-[11px] text-slate-400 block">{asset.assigneeDepartment}</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-slate-500 italic">—</span>
        )}
      </td>

      {/* Assigned Date */}
      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
        {asset.status === 'in-use' && asset.assignedDate ? asset.assignedDate : <span className="text-slate-500 italic">—</span>}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <Link
          to={`/inventory/${asset.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 group-hover:bg-indigo-600/20 text-slate-300 group-hover:text-indigo-300 border border-slate-700 group-hover:border-indigo-500/40 transition-all"
        >
          <span>Detail</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}
