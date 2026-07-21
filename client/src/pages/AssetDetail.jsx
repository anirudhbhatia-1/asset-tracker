import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

const AssetDetail = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/inventory"
          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Asset Detail #{id}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Full lifecycle timeline, specifications, and assignment status
          </p>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Asset Detail Stub</h3>
        <p className="text-sm text-slate-400 mt-1">
          Detailed card view with timeline feed (`asset_history`), barcode preview, and Assign/Return buttons will be built in Week 4.
        </p>
      </div>
    </div>
  );
};

export default AssetDetail;
