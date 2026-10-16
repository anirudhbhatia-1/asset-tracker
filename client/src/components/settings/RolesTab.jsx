import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2, Lock, Users } from 'lucide-react';
import api from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Pill from '../ui/Pill';
import RoleMatrixModal from './RoleMatrixModal';
import toast from 'react-hot-toast';

export default function RolesTab() {
  const { hasPermission, refreshUser } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedRole, setSelectedRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/roles');
      setRoles(res.data.data || []);
      setPermissionsCatalog(res.data.permissionsCatalog || []);
    } catch {
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreateRole = () => {
    setSelectedRole(null);
    setIsModalOpen(true);
  };

  const handleEditRole = (role) => {
    setSelectedRole(role);
    setIsModalOpen(true);
  };

  const handleDeleteRole = async (role) => {
    if (role.isSystem) {
      return toast.error('Protected system roles cannot be deleted');
    }
    if (!window.confirm(`Are you sure you want to delete custom role "${role.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/roles/${role.id}`);
      toast.success('Role deleted successfully');
      fetchRoles();
      refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-surface border border-border">
        <div>
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            Roles & Dynamic Permissions Matrix
          </h3>
          <p className="text-xs text-secondary mt-1">
            Configure fine-grained system access controls, custom role matrix, and target support queues.
          </p>
        </div>
        {hasPermission('roles:manage') && (
          <Button variant="primary" onClick={handleCreateRole}>
            <Plus className="w-4 h-4" />
            <span>Create Custom Role</span>
          </Button>
        )}
      </div>

      {/* Roles Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(role => (
            <div key={role.id} className="p-5 rounded-xl bg-surface border border-border shadow-sm hover:border-border/80 transition space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-primary">{role.name}</h4>
                    {role.isDirector ? (
                      <Pill tone="purple">Director</Pill>
                    ) : role.isSystem ? (
                      <Pill tone="info" icon={Lock}>System Role</Pill>
                    ) : (
                      <Pill tone="accent">Custom Role</Pill>
                    )}
                  </div>
                  <p className="text-xs text-secondary mt-1">{role.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center gap-1">
                  {hasPermission('roles:manage') && (
                    <button
                      type="button"
                      aria-label="Edit role permissions"
                      onClick={() => handleEditRole(role)}
                      className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-raised transition-colors cursor-pointer"
                      title="Edit role permissions"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {!role.isSystem && hasPermission('roles:manage') && (
                    <button
                      type="button"
                      aria-label="Delete custom role"
                      onClick={() => handleDeleteRole(role)}
                      className="p-2 rounded-xl text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      title="Delete custom role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Role Meta Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-secondary">
                <div className="flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  <span>{role.activeUserCount} active {Number(role.activeUserCount) === 1 ? 'employee' : 'employees'}</span>
                </div>
                <div>
                  {role.isDirector ? (
                    <span className="font-bold text-accent">Full Access (*)</span>
                  ) : (
                    <span>{role.permissions?.length || 0} permissions granted</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Matrix Modal */}
      <RoleMatrixModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        role={selectedRole}
        permissionsCatalog={permissionsCatalog}
        onSaved={() => {
          fetchRoles();
          // The edited role may be the viewer's own; pick up its permissions.
          refreshUser();
        }}
      />
    </div>
  );
}
