import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useCategories from '../../hooks/useCategories';
import useEmployees from '../../hooks/useEmployees';
import { createAsset, assignAssetApi } from '../../api/assetsApi';
import { generateUniqueSerial } from '../../utils/serialGenerator';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import useScanner from '../../hooks/useScanner';
import useLocations from '../../hooks/useLocations';
import WebcamFeed from '../scanner/WebcamFeed';
import LaserViewfinder from '../scanner/LaserViewfinder';
import SerialSimulator from '../scanner/SerialSimulator';
import { scanSerial } from '../../api/assetsApi';
import { Wand2, Plus, ArrowLeft, AlertCircle, Calendar, DollarSign, MapPin, Tag, FileText, UserCheck, Search, QrCode, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddAssetForm({ initialData, isEdit = false, onSaveSuccess }) {
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading } = useCategories();
  const { employees, loading: employeesLoading } = useEmployees();
  const { locations, loading: locationsLoading } = useLocations();

  // Form fields
  const [name, setName] = useState(initialData?.name || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [assetType, setAssetType] = useState(initialData?.assetType || 'company');
  const [location, setLocation] = useState(initialData?.location || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [costString, setCostString] = useState(
    initialData?.costCents ? (initialData.costCents / 100).toFixed(2) : ''
  );
  const [purchaseDate, setPurchaseDate] = useState(initialData?.purchaseDate || '');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState(initialData?.warrantyExpiryDate || '');
  const [serialNumber, setSerialNumber] = useState(initialData?.serialNumber || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Extended Category-Specific Fields
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [vendor, setVendor] = useState(initialData?.vendor || '');
  const [processor, setProcessor] = useState(initialData?.processor || '');
  const [ram, setRam] = useState(initialData?.ram || '');
  const [storage, setStorage] = useState(initialData?.storage || '');
  const [screenSize, setScreenSize] = useState(initialData?.screenSize || '');
  const [graphicsCard, setGraphicsCard] = useState(initialData?.graphicsCard || '');
  const [os, setOs] = useState(initialData?.os || '');
  const [msOffice, setMsOffice] = useState(initialData?.msOffice || '');
  const [antiVirus, setAntiVirus] = useState(initialData?.antiVirus || '');
  const [warrantyPlan, setWarrantyPlan] = useState(initialData?.warrantyPlan || '');
  const [warrantyUpgrade, setWarrantyUpgrade] = useState(initialData?.warrantyUpgrade || '');
  const [hardwareType, setHardwareType] = useState(initialData?.hardwareType || '');
  const [color, setColor] = useState(initialData?.color || '');
  const [clientName, setClientName] = useState(initialData?.clientName || '');
  const [receivedOn, setReceivedOn] = useState(initialData?.receivedOn || '');
  const [returnDate, setReturnDate] = useState(initialData?.returnDate || '');

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

  // Sub-Assets (Accessories e.g. Adaptor)
  const [subAssets, setSubAssets] = useState([]); // [{ categoryId, model, serialNumber }]
  const addSubAsset = () => setSubAssets(prev => [...prev, { categoryId: '', model: '', serialNumber: '' }]);
  const removeSubAsset = (i) => setSubAssets(prev => prev.filter((_, idx) => idx !== i));
  const updateSubAsset = (i, field, val) => setSubAssets(prev =>
    prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s)
  );

  // Scanner states — main asset
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scanChecking, setScanChecking] = useState(false);
  const [existingAssetMatch, setExistingAssetMatch] = useState(null);

  // Scanner states — sub-asset
  const [subScanTarget, setSubScanTarget] = useState(null); // index of sub-asset being scanned
  const [isSubScannerModalOpen, setIsSubScannerModalOpen] = useState(false);
  const [subScanChecking, setSubScanChecking] = useState(false);

  const handleScanDecode = useCallback(async (serialText) => {
    setScanChecking(true);
    setExistingAssetMatch(null);
    try {
      const res = await scanSerial(serialText.trim());
      const assetData = res?.data?.data || res?.data;
      if (assetData && assetData.id) {
        setExistingAssetMatch(assetData);
        setIsScannerModalOpen(false);
      }
    } catch (err) {
      if (err?.status === 404 || err?.response?.status === 404 || err?.message?.toLowerCase().includes('not found')) {
        setSerialNumber(serialText.trim());
        setErrors((prev) => ({ ...prev, serialNumber: null }));
        setIsScannerModalOpen(false);
        toast.success(`Scanned new serial: ${serialText}`);
      } else {
        toast.error('Error verifying scanned serial');
      }
    } finally {
      setScanChecking(false);
    }
  }, []);

  const {
    videoRef,
    cameraAvailable,
    isScanning,
    startScanner,
    stopScanner
  } = useScanner({ onDecode: handleScanDecode, autoStart: false });

  // Ensure main scanner stops when modal closes
  React.useEffect(() => {
    if (!isScannerModalOpen) {
      stopScanner();
    }
  }, [isScannerModalOpen, stopScanner]);

  const openScanner = () => {
    setExistingAssetMatch(null);
    setIsScannerModalOpen(true);
    startScanner();
  };

  const closeScanner = () => {
    setIsScannerModalOpen(false);
  };

  // Sub-asset scan handler
  const handleSubScanDecode = useCallback(async (serialText) => {
    setSubScanChecking(true);
    try {
      updateSubAsset(subScanTarget, 'serialNumber', serialText.trim());
      setIsSubScannerModalOpen(false);
      toast.success(`Scanned serial for accessory: ${serialText.trim()}`);
    } catch (err) {
      toast.error('Error capturing scanned serial');
    } finally {
      setSubScanChecking(false);
    }
  }, [subScanTarget]);

  const {
    videoRef: subVideoRef,
    cameraAvailable: subCameraAvailable,
    isScanning: subIsScanning,
    startScanner: subStartScanner,
    stopScanner: subStopScanner
  } = useScanner({ onDecode: handleSubScanDecode, autoStart: false });

  // Ensure sub-scanner stops when modal closes
  React.useEffect(() => {
    if (!isSubScannerModalOpen) {
      subStopScanner();
    }
  }, [isSubScannerModalOpen, subStopScanner]);

  const openSubScanner = (index) => {
    setSubScanTarget(index);
    setIsSubScannerModalOpen(true);
    subStartScanner();
  };

  const closeSubScanner = () => {
    setIsSubScannerModalOpen(false);
  };

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
        assetType,
        model: model.trim() || null,
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        warrantyExpiryDate: warrantyExpiryDate || undefined,
        costCents: costCents || undefined,
        serialNumber: serialNumber.trim(),
        notes: notes.trim() || null,
        subAssets: subAssets.filter(s => s.serialNumber && s.serialNumber.trim()),

        // NEW FIELDS:
        brand: brand.trim() || undefined,
        vendor: vendor.trim() || undefined,
        processor: processor.trim() || undefined,
        ram: ram.trim() || undefined,
        storage: storage.trim() || undefined,
        screenSize: screenSize.trim() || undefined,
        graphicsCard: graphicsCard.trim() || undefined,
        os: os.trim() || undefined,
        msOffice: msOffice.trim() || undefined,
        antiVirus: antiVirus.trim() || undefined,
        warrantyPlan: warrantyPlan.trim() || undefined,
        warrantyUpgrade: warrantyUpgrade.trim() || undefined,
        hardwareType: hardwareType.trim() || undefined,
        color: color.trim() || undefined,
        clientName: clientName.trim() || undefined,
        receivedOn: receivedOn || undefined,
        returnDate: returnDate || undefined,
      };

      if (isEdit && initialData?.id) {
        // If edit mode, pass payload up or call update
        if (onSaveSuccess) await onSaveSuccess(assetPayload);
      } else {
        // Step 1: Create asset
        const createRes = await createAsset(assetPayload);
        const newAssetId = createRes.data?.data?.id || createRes.data.id;

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

  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const selectedCategory = safeCategories.find(c => c.id === Number(categoryId));
  const catName = selectedCategory?.name?.toLowerCase() || '';
  const isLaptop = catName.includes('laptop');
  const isHeadphone = catName.includes('headphone');
  const isKbMouse = catName.includes('keyboard') || catName.includes('mouse');
  const isClient = assetType === 'client';

  const filteredEmployees = safeEmployees.filter((emp) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-surface rounded-2xl border border-border/80 p-6 sm:p-8 shadow-sm max-w-4xl mx-auto">
      {/* Form Section 1: Core Specifications */}
      <div className="space-y-6">
        <div className="border-b border-border/60 pb-3">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Tag className="w-5 h-5 text-accent" />
            <span>Hardware Specifications & Identity</span>
          </h2>
          <p className="text-xs text-secondary mt-1">
            Fill in details to register this device in the global internal inventory.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Asset Name */}
          <div className="sm:col-span-2">
            <label htmlFor="assetName" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Asset Name / Title <span className="text-danger">*</span>
            </label>
            <input
              id="assetName"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
              placeholder="E.g., MacBook Pro 16-inch (M3 Max)"
              className={`w-full rounded-xl bg-base border px-4 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 transition-all ${
                errors.name
                  ? 'border-danger focus:ring-danger'
                  : 'border-border focus:ring-accent focus:border-accent'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* Category Dropdown */}
          <div>
            <label htmlFor="categoryId" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: null }));
              }}
              disabled={categoriesLoading}
              className={`w-full rounded-xl bg-base border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                errors.categoryId
                  ? 'border-danger focus:ring-danger'
                  : 'border-border focus:ring-accent focus:border-accent'
              }`}
            >
              <option value="">Select hardware category...</option>
              {safeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.badgeChar ? `[${cat.badgeChar}] ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.categoryId}</span>
              </p>
            )}
          </div>

          {/* Asset Ownership Type Toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Asset Ownership <span className="text-danger">*</span>
            </label>
            <div className="flex bg-base border border-border p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAssetType('company')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
                  assetType === 'company'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
              >
                Company Owned
              </button>
              <button
                type="button"
                onClick={() => setAssetType('client')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
                  assetType === 'client'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
              >
                Client Provided
              </button>
            </div>
          </div>

          {/* Office Location */}
          <div>
            <label htmlFor="location" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>Office Location <span className="text-danger">*</span></span>
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                if (errors.location) setErrors((prev) => ({ ...prev, location: null }));
              }}
              className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="">Select location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
            {errors.location && (
              <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.location}</span>
              </p>
            )}
          </div>

          {/* Address Dropdown */}
          {location && (() => {
            const selectedLoc = locations.find(l => l.name === location);
            const addrs = selectedLoc?.addresses ? (Array.isArray(selectedLoc.addresses) ? selectedLoc.addresses : JSON.parse(selectedLoc.addresses)) : [];
            if (addrs.length === 0) return null;
            return (
              <div>
                <label htmlFor="address" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Office Address</span>
                </label>
                <select
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="">Select address...</option>
                  {addrs.map((addr, idx) => (
                    <option key={idx} value={addr}>
                      {addr}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Model / Specs */}
          <div>
            <label htmlFor="model" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Model / Descriptor Specs
            </label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="E.g., 36GB Unified RAM, 1TB SSD, Space Black"
              className="w-full rounded-xl bg-base border border-border px-4 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Serial Number with Auto-Gen Wand per PRD 6.7.2 */}
          <div>
            <label htmlFor="serialNumber" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Serial Number <span className="text-danger">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="serialNumber"
                type="text"
                value={serialNumber}
                onChange={(e) => {
                  setSerialNumber(e.target.value);
                  if (errors.serialNumber) setErrors((prev) => ({ ...prev, serialNumber: null }));
                }}
                placeholder="E.g., SN-ABX472 or Barcode"
                className={`flex-1 min-w-0 rounded-xl bg-base font-mono border px-3 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 transition-all ${
                  errors.serialNumber
                    ? 'border-danger focus:ring-danger'
                    : 'border-border focus:ring-accent focus:border-accent'
                }`}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={openScanner}
                className="shrink-0 !px-2.5 bg-surface hover:bg-raised text-secondary border-border"
                title="Scan Barcode / QR"
              >
                <QrCode className="w-4 h-4 text-accent" />
                <span className="sr-only sm:not-sr-only sm:ml-1.5">Scan</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleAutoGenSerial}
                loading={generatingSerial}
                className="shrink-0 !px-2.5 bg-accent/10 hover:bg-accent/20 text-accent border-accent/30"
                title="Auto-generate a verified unique serial number"
              >
                <Wand2 className="w-4 h-4 text-accent" />
                <span className="sr-only sm:not-sr-only sm:ml-1.5">Auto</span>
              </Button>
            </div>
            {errors.serialNumber && (
              <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.serialNumber}</span>
              </p>
            )}

            {/* Already Registered Warning */}
            {existingAssetMatch && (
              <div className="mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 flex flex-col items-start gap-2 animate-fadeIn">
                <div className="flex items-start gap-2 text-warning">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    This asset is already registered ({existingAssetMatch.serialNumber}).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/inventory/${existingAssetMatch.id}`)}
                  className="w-full bg-warning/20 hover:bg-warning/30 text-warning border-transparent text-xs py-1.5"
                >
                  View Existing Asset
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Section 2: Financial & Operational Details */}
      <div className="space-y-6 pt-4 border-t border-border/60">
        <div className="border-b border-border/60 pb-3">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent" />
            <span>Financial & Operational Details</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Purchase Cost (in Dollars) */}
          <div>
            <label htmlFor="costString" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
              Purchase Cost (USD $)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary font-medium">$</span>
              <input
                id="costString"
                type="number"
                step="0.01"
                min="0"
                value={costString}
                onChange={(e) => setCostString(e.target.value)}
                placeholder="2499.00"
                className="w-full rounded-xl bg-base border border-border pl-8 pr-4 py-2.5 text-sm font-mono text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <span className="text-[11px] text-secondary mt-1 block">Stored precisely as cents in database</span>
          </div>

          {/* Purchase Date */}
          <div>
            <label htmlFor="purchaseDate" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Purchase Date</span>
            </label>
            <input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            />
          </div>

          {/* Warranty Expiry */}
          <div>
            <label htmlFor="warrantyExpiryDate" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Warranty Expiry</span>
            </label>
            <input
              id="warrantyExpiryDate"
              type="date"
              value={warrantyExpiryDate}
              onChange={(e) => setWarrantyExpiryDate(e.target.value)}
              className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            />
          </div>

          {/* Notes Textarea */}
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-accent" />
              <span>Admin Freeform Notes</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter warranty notes, serial verification, vendor receipt IDs, or repair history..."
              rows={3}
              className="w-full rounded-xl bg-base border border-border p-3 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* Form Section: Dynamic Extended Specifications */}
      {categoryId && (
        <div className="space-y-6 pt-4 border-t border-border/60">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent" />
              <span>Extended Specifications</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* BRAND & VENDOR (Always show if category selected) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Brand</label>
              <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Lenovo, Dell, Apple" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            {!isClient && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Vendor / Supplier</label>
                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. Swastik Electronics" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            )}
            {/* ── LAPTOP ONLY FIELDS ── */}
            {isLaptop && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Processor</label>
                  <input type="text" value={processor} onChange={e => setProcessor(e.target.value)} placeholder="e.g. 11th Gen Intel Core i5" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">RAM</label>
                  <input type="text" value={ram} onChange={e => setRam(e.target.value)} placeholder="e.g. 16 GB DDR4" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Storage (HDD/SSD)</label>
                  <input type="text" value={storage} onChange={e => setStorage(e.target.value)} placeholder="e.g. 512GB SSD" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Screen Size</label>
                  <input type="text" value={screenSize} onChange={e => setScreenSize(e.target.value)} placeholder="e.g. 15.6" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Graphics Card</label>
                  <input type="text" value={graphicsCard} onChange={e => setGraphicsCard(e.target.value)} placeholder="e.g. Intel Iris Xe" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">OS</label>
                  <input type="text" value={os} onChange={e => setOs(e.target.value)} placeholder="e.g. Windows 11 Home" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">MS Office Version</label>
                  <input type="text" value={msOffice} onChange={e => setMsOffice(e.target.value)} placeholder="e.g. Office Home & Student 2021" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Anti-Virus</label>
                  <input type="text" value={antiVirus} onChange={e => setAntiVirus(e.target.value)} placeholder="e.g. QuickHeal" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Warranty Upgrade</label>
                  <input type="text" value={warrantyUpgrade} onChange={e => setWarrantyUpgrade(e.target.value)} placeholder="e.g. Extended 1 Year" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
              </>
            )}
            {/* ── HEADPHONES ONLY FIELDS ── */}
            {isHeadphone && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Color</label>
                <input type="text" value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. Black, Silver" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            )}
            {/* ── SHARED BY MULTIPLE CATEGORIES ── */}
            {(isLaptop || isHeadphone || isKbMouse) && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Service / Warranty Plan</label>
                <input type="text" value={warrantyPlan} onChange={e => setWarrantyPlan(e.target.value)} placeholder="e.g. 3 Year ADP" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            )}
            
            {(isHeadphone || isKbMouse || isClient) && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Hardware / Device Type</label>
                <input type="text" value={hardwareType} onChange={e => setHardwareType(e.target.value)} placeholder="e.g. Wireless, Over-Ear" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            )}
            {/* ── CLIENT ONLY FIELDS ── */}
            {isClient && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Client Name</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Infosys, TCS" className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">Received On</label>
                  <input type="date" value={receivedOn} onChange={e => setReceivedOn(e.target.value)} className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Form Section 3: Optional Immediate Allocation per PRD 6.7.3 */}
      {!isEdit && (
        <div className="space-y-6 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-accent" />
                <span>Immediate Employee Allocation (Optional)</span>
              </h2>
              <p className="text-xs text-secondary mt-1">
                If enabled, the asset will immediately transition to "In Use" upon registration and log an assignment event.
              </p>
            </div>
            <label htmlFor="assignImmediately" className="relative inline-flex items-center cursor-pointer">
              <input
                id="assignImmediately"
                type="checkbox"
                checked={assignImmediately}
                onChange={(e) => setAssignImmediately(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-raised peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
            </label>
          </div>

          {assignImmediately && (
            <div className="bg-base/60 p-5 rounded-2xl border border-accent/30 space-y-5 animate-fadeIn">
              {/* Employee Selector with Search */}
              <div>
                <label htmlFor="employeeSearch" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Select Employee Assignee <span className="text-danger">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                  <input
                    id="employeeSearch"
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employee directory by name, email, or department..."
                    className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-xl text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-base divide-y divide-border/60 scrollbar-thin">
                  {employeesLoading ? (
                    <div className="p-4 text-center text-xs text-secondary animate-pulse">Loading employee directory...</div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-xs text-secondary">No matching employees found.</div>
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
                            isSelected ? 'bg-accent/20 border-l-4 border-accent' : 'hover:bg-surface'
                          }`}
                        >
                          <div>
                            <span className={`text-sm font-semibold block ${isSelected ? 'text-accent' : 'text-primary'}`}>
                              {emp.name}
                            </span>
                            <span className="text-xs text-secondary block mt-0.5">
                              {emp.email} {emp.department ? `· ${emp.department}` : ''}
                            </span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-accent bg-accent' : 'border-border'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {errors.selectedEmployeeId && (
                  <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.selectedEmployeeId}</span>
                  </p>
                )}
              </div>

              {/* Assignment Date & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="assignedDate" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>Assignment Effective Date</span>
                  </label>
                  <input
                    id="assignedDate"
                    type="date"
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  />
                </div>

                <div>
                  <label htmlFor="assignNote" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5">
                    Assignment Note (Optional)
                  </label>
                  <input
                    id="assignNote"
                    type="text"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="E.g., Issued with laptop sleeve and power adapter."
                    className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accessories / Sub-Assets */}
      {!isEdit && (
        <div className="space-y-4 pt-6 border-t border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <Tag className="w-4 h-4 text-accent" />
                <span>Accessories / Sub-Assets</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Attach accessories (chargers, adaptors, bags) that will be assigned and returned together with this primary asset.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addSubAsset}>
              <Plus className="w-3.5 h-3.5" /> Add Accessory
            </Button>
          </div>
          {subAssets.map((sub, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-base/60 rounded-xl border border-border/60 relative">
              <select
                value={sub.categoryId}
                onChange={e => updateSubAsset(i, 'categoryId', e.target.value)}
                className="rounded-lg bg-base border border-border px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select Category...</option>
                {safeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                type="text"
                value={sub.model}
                onChange={e => updateSubAsset(i, 'model', e.target.value)}
                placeholder="Model / Specs (e.g. 85W USB-C)"
                className="rounded-lg bg-base border border-border px-3 py-2 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sub.serialNumber}
                  onChange={e => updateSubAsset(i, 'serialNumber', e.target.value)}
                  placeholder="Serial number *"
                  className="flex-1 min-w-0 rounded-lg bg-base border border-border px-3 py-2 text-sm font-mono text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => openSubScanner(i)}
                  className="p-2 rounded-lg bg-surface border border-border text-secondary hover:text-accent hover:border-accent/40 transition-colors shrink-0"
                  title="Scan barcode / QR for serial number"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => removeSubAsset(i)}
                  className="p-2 text-secondary hover:text-danger rounded-lg transition-colors" title="Remove Accessory">
                  <AlertCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Submission Actions */}
      <div className="pt-6 border-t border-border flex items-center justify-end gap-4">
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

      <Modal
        isOpen={isScannerModalOpen}
        onClose={closeScanner}
        title="Scan Asset Barcode / QR"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <p className="text-sm text-secondary">
            Hold the barcode or QR code steady within the viewfinder. The scanner will automatically detect and verify it.
          </p>

          <div className="relative">
            {cameraAvailable && isScanning ? (
              <WebcamFeed
                videoRef={videoRef}
                isScanning={isScanning}
                onStop={stopScanner}
              />
            ) : (
              <LaserViewfinder
                onRetryCamera={startScanner}
              />
            )}

            {scanChecking && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-base/60 backdrop-blur-sm rounded-2xl">
                <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3 shadow-xl">
                  <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  <span className="text-sm font-medium text-primary">Verifying serial...</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-border/60">
            <SerialSimulator 
              onSimulateScan={(serial) => handleScanDecode(serial)}
              disabled={scanChecking}
            />
          </div>
          
          <div className="flex justify-end pt-2">
            <Button type="button" variant="secondary" onClick={closeScanner}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sub-Asset Scanner Modal */}
      <Modal
        isOpen={isSubScannerModalOpen}
        onClose={closeSubScanner}
        title={`Scan Serial — Accessory #${(subScanTarget ?? 0) + 1}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <p className="text-sm text-secondary">
            Hold the barcode or QR code of the accessory steady within the viewfinder. The scanned value will be filled in automatically.
          </p>

          <div className="relative">
            {subCameraAvailable && subIsScanning ? (
              <WebcamFeed
                videoRef={subVideoRef}
                isScanning={subIsScanning}
                onStop={subStopScanner}
              />
            ) : (
              <LaserViewfinder
                onRetryCamera={subStartScanner}
              />
            )}

            {subScanChecking && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-base/60 backdrop-blur-sm rounded-2xl">
                <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3 shadow-xl">
                  <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  <span className="text-sm font-medium text-primary">Capturing serial...</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/60">
            <SerialSimulator
              onSimulateScan={(serial) => handleSubScanDecode(serial)}
              disabled={subScanChecking}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="secondary" onClick={closeSubScanner}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
