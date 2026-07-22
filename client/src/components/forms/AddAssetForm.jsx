import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCategories from '../../hooks/useCategories';
import useEmployees from '../../hooks/useEmployees';
import { createAsset, assignAssetApi } from '../../api/assetsApi';
import { generateUniqueSerial } from '../../utils/serialGenerator';
import Button from '../ui/Button';
import { Wand2, Plus, ArrowLeft, AlertCircle, Calendar, DollarSign, MapPin, Tag, FileText, UserCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const OFFICE_LOCATIONS = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];

export default function AddAssetForm({ initialData, isEdit = false, onSaveSuccess }) {
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading } = useCategories();
  const { employees, loading: employeesLoading } = useEmployees();

  // Form fields
  const [name, setName] = useState(initialData?.name || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [location, setLocation] = useState(initialData?.location || 'Bangalore');
  const [costString, setCostString] = useState(
    initialData?.costCents ? (initialData.costCents / 100).toFixed(2) : ''
  );
  const [purchaseDate, setPurchaseDate] = useState(
    initialData?.purchaseDate || new Date().toISOString().substring(0, 10)
  );
  const [serialNumber, setSerialNumber] = useState(initialData?.serialNumber || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Optional Immediate Allocation (Only for new registrations)
  const [assignImmediately, setAssignImmediately] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().substring(0, 10));
  const [assignNote, setAssignNote] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // UI States
  const [generatingSerial, setGeneratingSerial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleAutoGenSerial = async () => {
    setGeneratingSerial(true);
    try {
      const uniqueSN = await generateUniqueSerial();
      setSerialNumber(uniqueSN);
      setErrors((prev) => ({ ...prev, serialNumber: null }));
      toast.success(`Auto-generated unique serial: ${uniqueSN}`);
    } catch (err) {
      toast.error('Failed to generate unique serial number');
    } finally {
      setGeneratingSerial(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Asset name is required.';
    if (!categoryId) newErrors.categoryId = 'Please select a category.';
    if (!location) newErrors.location = 'Please select an office location.';
    if (!serialNumber.trim()) newErrors.serialNumber = 'Serial number is required.';
    if (assignImmediately && !selectedEmployeeId) {
      newErrors.selectedEmployeeId = 'Please select an employee for immediate assignment.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix validation errors beneath required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Parse cost to cents safely
      let costCents = null;
      if (costString && !isNaN(parseFloat(costString))) {
        costCents = Math.round(parseFloat(costString) * 100);
      }

      const assetPayload = {
        name: name.trim(),
        categoryId: Number(categoryId),
        model: model.trim() || null,
        location,
        costCents,
        purchaseDate: purchaseDate || null,
        serialNumber: serialNumber.trim(),
        notes: notes.trim() || null,
      };

      if (isEdit && initialData?.id) {
        // If edit mode, pass payload up or call update
        if (onSaveSuccess) await onSaveSuccess(assetPayload);
      } else {
        // Step 1: Create asset
        const createRes = await createAsset(assetPayload);
        const newAssetId = createRes.data.id;

        // Step 2: Immediate Allocation if checked
        if (assignImmediately && selectedEmployeeId) {
          await assignAssetApi(newAssetId, {
            employeeId: Number(selectedEmployeeId),
            assignedDate,
            note: assignNote.trim() || 'Assigned immediately upon asset registration.',
          });
        }

        toast.success(
          assignImmediately
            ? 'Asset registered and allocated to employee!'
            : 'Hardware asset registered successfully!'
        );
        navigate(`/inventory/${newAssetId}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save asset');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-slate-800 rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-sm max-w-4xl mx-auto">
      {/* Form Section 1: Core Specifications */}
      <div className="space-y-6">
        <div className="border-b border-slate-700/60 pb-3">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-400" />
            <span>Hardware Specifications & Identity</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Fill in details to register this device in the global internal inventory.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Asset Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Asset Name / Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
              placeholder="E.g., MacBook Pro 16-inch (M3 Max)"
              className={`w-full rounded-xl bg-slate-900 border px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                errors.name
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Category <span className="text-rose-400">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: null }));
              }}
              disabled={categoriesLoading}
              className={`w-full rounded-xl bg-slate-900 border px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                errors.categoryId
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            >
              <option value="">Select hardware category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.badgeChar ? `[${cat.badgeChar}] ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.categoryId}</span>
              </p>
            )}
          </div>

          {/* Office Location */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Office Location <span className="text-rose-400">*</span></span>
            </label>
            <select
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                if (errors.location) setErrors((prev) => ({ ...prev, location: null }));
              }}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Select location...</option>
              {OFFICE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc} Office
                </option>
              ))}
            </select>
            {errors.location && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.location}</span>
              </p>
            )}
          </div>

          {/* Model / Specs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Model / Descriptor Specs
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="E.g., 36GB Unified RAM, 1TB SSD, Space Black"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Serial Number with Auto-Gen Wand per PRD 6.7.2 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Serial Number <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => {
                  setSerialNumber(e.target.value);
                  if (errors.serialNumber) setErrors((prev) => ({ ...prev, serialNumber: null }));
                }}
                placeholder="E.g., SN-ABX472 or OEM Barcode"
                className={`w-full rounded-xl bg-slate-900 font-mono border px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                  errors.serialNumber
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleAutoGenSerial}
                loading={generatingSerial}
                className="shrink-0 !px-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                title="Auto-generate a verified unique serial number"
              >
                <Wand2 className="w-4 h-4 text-indigo-400" />
                <span>Auto-gen</span>
              </Button>
            </div>
            {errors.serialNumber && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.serialNumber}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form Section 2: Financial & Operational Details */}
      <div className="space-y-6 pt-4 border-t border-slate-700/60">
        <div className="border-b border-slate-700/60 pb-3">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-400" />
            <span>Financial & Operational Details</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Purchase Cost (in Dollars) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Purchase Cost (USD $)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costString}
                onChange={(e) => setCostString(e.target.value)}
                placeholder="2499.00"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 pl-8 pr-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Stored precisely as cents in database</span>
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Purchase Date</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Notes Textarea */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin Freeform Notes</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter warranty notes, serial verification, vendor receipt IDs, or repair history..."
              rows={3}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Form Section 3: Optional Immediate Allocation per PRD 6.7.3 */}
      {!isEdit && (
        <div className="space-y-6 pt-4 border-t border-slate-700/60">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <span>Immediate Employee Allocation (Optional)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                If enabled, the asset will immediately transition to "In Use" upon registration and log an assignment event.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={assignImmediately}
                onChange={(e) => setAssignImmediately(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {assignImmediately && (
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-indigo-500/30 space-y-5 animate-fadeIn">
              {/* Employee Selector with Search */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Select Employee Assignee <span className="text-rose-400">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employee directory by name, email, or department..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 divide-y divide-slate-700/60 scrollbar-thin">
                  {employeesLoading ? (
                    <div className="p-4 text-center text-xs text-slate-400 animate-pulse">Loading employee directory...</div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No matching employees found.</div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = Number(selectedEmployeeId) === Number(emp.id);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            if (errors.selectedEmployeeId) setErrors((prev) => ({ ...prev, selectedEmployeeId: null }));
                          }}
                          className={`w-full text-left p-3 flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-600/20 border-l-4 border-indigo-500' : 'hover:bg-slate-800'
                          }`}
                        >
                          <div>
                            <span className={`text-sm font-semibold block ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                              {emp.name}
                            </span>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              {emp.email} {emp.department ? `· ${emp.department}` : ''}
                            </span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-indigo-500 bg-indigo-600' : 'border-slate-600'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {errors.selectedEmployeeId && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.selectedEmployeeId}</span>
                  </p>
                )}
              </div>

              {/* Assignment Date & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Assignment Effective Date</span>
                  </label>
                  <input
                    type="date"
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Assignment Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="E.g., Issued with laptop sleeve and power adapter."
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Submission Actions */}
      <div className="pt-6 border-t border-slate-700 flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/inventory')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isEdit ? 'Save Changes' : 'Register Asset'}</span>
        </Button>
      </div>
    </form>
  );
}
