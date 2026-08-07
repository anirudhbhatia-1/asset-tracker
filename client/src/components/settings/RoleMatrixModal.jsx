import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ShieldCheck, Save, X, Lock } from 'lucide-react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function RoleMatrixModal({ isOpen, onClose, role, permissionsCatalog = [], onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminType, setAdminType] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (role) {
        setName(role.name || '');
        setDescription(role.description || '');
        setAdminType(role.adminType || '');
        const currentKeys = role.permissions ? role.permissions.map(p => typeof p === 'string' ? p : p.key) : [];
        setSelectedKeys(currentKeys);
      } else {
        setName('');
        setDescription('');
        setAdminType('');
        setSelectedKeys([]);
      }
    }
  }, [isOpen, role]);

  // Group permissions catalog by module
  const groupedCatalog = permissionsCatalog.reduce((acc, p) => {
    acc[p.module] = acc[p.module] || [];
    acc[p.module].push(p);
    return acc;
  }, {});

  const handleToggleKey = (key) => {
    if (role?.isDirector) return; // Director has all permissions
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleToggleModule = (moduleKeys) => {
    if (role?.isDirector) return;
    const allSelected = moduleKeys.every(k => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys(prev => prev.filter(k => !moduleKeys.includes(k)));
    } else {
      setSelectedKeys(prev => Array.from(new Set([...prev, ...moduleKeys])));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Role name is required.');
    if (selectedKeys.includes('tickets:resolve') && !adminType) {
      return setError('Roles with ticket resolution capability (tickets:resolve) must select a target support queue (IT, Hardware, or HR).');
    }
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        adminType: adminType || null,
        permissionKeys: selectedKeys
      };

      if (role?.id) {
        await api.put(`/roles/${role.id}`, payload);
        toast.success('Role permissions updated successfully');
      } else {
        await api.post('/roles', payload);
        toast.success('Custom role created successfully');
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={role ? `Edit Role: ${role.name}` : 'Create Custom Role'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
              Role Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              disabled={role?.isSystem}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Auditor"
              className="w-full px-3 py-2 bg-base border border-border rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 cursor-text"
              required
            />
            {role?.isSystem && <p className="text-[11px] text-secondary mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> System role name cannot be edited</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
              Default Target Support Queue (admin_type)
            </label>
            <select
              value={adminType}
              onChange={(e) => setAdminType(e.target.value)}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="">None (Standard User Queue)</option>
              <option value="it">IT Support Queue (it)</option>
              <option value="hardware">Hardware Queue (hardware)</option>
              <option value="hr">HR Operations Queue (hr)</option>
            </select>
            <p className="text-[11px] text-secondary mt-1">Default queue assigned to employees when this role is granted.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
            Role Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe capabilities of this role..."
            className="w-full px-3 py-2 bg-base border border-border rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-text"
          />
        </div>

        {/* Permissions Matrix */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-accent" />
              Permissions Matrix
            </h4>
            {role?.isDirector && (
              <span className="text-xs text-accent font-semibold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                Director has full unrestricted access (*)
              </span>
            )}
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {Object.entries(groupedCatalog).map(([moduleName, modulePerms]) => {
              const moduleKeys = modulePerms.map(p => p.key);
              const allChecked = moduleKeys.every(k => selectedKeys.includes(k));
              const someChecked = moduleKeys.some(k => selectedKeys.includes(k));

              return (
                <div key={moduleName} className="p-3.5 rounded-xl bg-base border border-border">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">{moduleName}</span>
                    <button
                      type="button"
                      disabled={role?.isDirector}
                      onClick={() => handleToggleModule(moduleKeys)}
                      className="text-[11px] text-accent font-medium hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {allChecked ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modulePerms.map(p => {
                      const isChecked = selectedKeys.includes(p.key) || role?.isDirector;
                      return (
                        <label
                          key={p.key}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked ? 'border-accent/40 bg-accent/5 text-primary' : 'border-border/60 bg-surface hover:border-border text-secondary'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={role?.isDirector}
                            checked={isChecked}
                            onChange={() => handleToggleKey(p.key)}
                            className="mt-0.5 text-accent focus:ring-accent rounded border-secondary bg-surface"
                          />
                          <div>
                            <span className="block font-medium text-primary font-mono">{p.key}</span>
                            <span className="block text-[10px] text-secondary mt-0.5">{p.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            <Save className="w-4 h-4" />
            <span>Save Role Permissions</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
