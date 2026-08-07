import React, { useState } from 'react';
import { Plus, Edit2, MapPin, X, Trash2 } from 'lucide-react';
import useLocations from '../../hooks/useLocations';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { createLocation, updateLocationAddresses } from '../../api/locationsApi';
import toast from 'react-hot-toast';

export default function LocationsTab() {
  const { locations, loading, refresh } = useLocations();
  const { hasPermission } = useAuth();
  const canManageLocations = hasPermission('locations:manage');
  const canEditLocations = canManageLocations || hasPermission('locations:read');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [editAddresses, setEditAddresses] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    
    setSubmitting(true);
    try {
      await createLocation({ name: newLocationName.trim() });
      toast.success('Location added successfully');
      setNewLocationName('');
      setIsAddOpen(false);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add location');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAddresses = async (e) => {
    e.preventDefault();
    if (!editingLocation) return;
    
    setSubmitting(true);
    try {
      // Filter out empty strings
      const cleanedAddresses = editAddresses.map(a => a.trim()).filter(a => a !== '');
      await updateLocationAddresses(editingLocation.id, { addresses: cleanedAddresses });
      toast.success('Addresses updated successfully');
      setIsEditOpen(false);
      setEditingLocation(null);
      refresh();
    } catch (err) {
      toast.error('Failed to update addresses');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (loc) => {
    setEditingLocation(loc);
    // Ensure we have an array
    const addrs = Array.isArray(loc.addresses) ? loc.addresses : (loc.addresses ? JSON.parse(loc.addresses) : []);
    setEditAddresses(addrs.length > 0 ? addrs : ['']);
    setIsEditOpen(true);
  };

  const addAddressField = () => {
    setEditAddresses([...editAddresses, '']);
  };

  const removeAddressField = (index) => {
    const newAddrs = [...editAddresses];
    newAddrs.splice(index, 1);
    setEditAddresses(newAddrs);
  };

  const updateAddressField = (index, value) => {
    const newAddrs = [...editAddresses];
    newAddrs[index] = value;
    setEditAddresses(newAddrs);
  };

  if (loading) {
    return <div className="p-8 text-center text-secondary animate-pulse">Loading locations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface border border-border p-5 rounded-2xl">
        <div>
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent" />
            Office Locations
          </h3>
          <p className="text-sm text-secondary mt-1">
            Manage global office locations and their addresses.
          </p>
        </div>
        {canManageLocations && (
          <Button onClick={() => setIsAddOpen(true)} variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Location
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => {
          const addrs = Array.isArray(loc.addresses) ? loc.addresses : (loc.addresses ? JSON.parse(loc.addresses) : []);
          return (
            <div key={loc.id} className="bg-surface border border-border/80 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-primary">{loc.name}</h4>
                <div className="mt-3 space-y-2">
                  {addrs.length > 0 ? (
                    addrs.map((addr, idx) => (
                      <div key={idx} className="text-xs text-secondary flex items-start gap-2 bg-base p-2 rounded-lg border border-border/50">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{addr}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs italic opacity-50">No addresses set</span>
                  )}
                </div>
              </div>
              
              {canEditLocations && (
                <div className="mt-4 pt-4 border-t border-border/60 flex justify-end">
                  <Button 
                    onClick={() => openEditModal(loc)} 
                    variant="secondary" 
                    size="sm" 
                    className="text-xs py-1 px-3"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Manage Addresses
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Location Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Office Location">
        <form onSubmit={handleAddLocation} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase mb-1.5">
              Location Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="E.g., Chennai Office"
              required
              className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Add Location</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Address Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Manage Location Addresses">
        <form onSubmit={handleSaveAddresses} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-secondary uppercase">
                {editingLocation?.name} Addresses
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={addAddressField} className="text-xs py-1 px-2">
                <Plus className="w-3 h-3 mr-1" /> Add Another
              </Button>
            </div>
            
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {editAddresses.length === 0 && (
                <div className="text-center text-secondary text-sm py-4 italic">No addresses added yet.</div>
              )}
              {editAddresses.map((addr, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <textarea
                    value={addr}
                    onChange={(e) => updateAddressField(idx, e.target.value)}
                    placeholder="Enter full street address..."
                    rows={2}
                    className="w-full rounded-xl bg-base border border-border p-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddressField(idx)}
                    className="mt-2 p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0"
                    title="Remove address"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Save Addresses</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
