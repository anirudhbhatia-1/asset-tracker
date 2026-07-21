import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, PlusCircle } from 'lucide-react';

const AddEditAsset = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          to="/inventory"
          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            {isEdit ? `Edit Asset #${id}` : 'Register New Asset'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isEdit
              ? 'Modify asset metadata and purchase details'
              : 'Add new hardware item to the global company inventory'}
          </p>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <PlusCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">
          {isEdit ? 'Edit Form Stub' : 'Registration Form Stub'}
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Complete registration form with category select, serial number validation, and cost calculation will be implemented in Week 4.
        </p>
      </div>
    </div>
  );
};

export default AddEditAsset;
