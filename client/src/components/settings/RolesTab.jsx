import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2, Lock, Users, ShieldAlert } from 'lucide-react';
import api from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import RoleMatrixModal from './RoleMatrixModal';
import toast from 'react-hot-toast';

export default function RolesTab() {
  const { hasPermission } = useAuth();
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
    } catch (err) {
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border">
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
            <div key={i} className="h-40 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(role => (
            <div key={role.id} className="p-5 rounded-2xl bg-surface border border-border shadow-sm hover:border-border/80 transition-all space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-primary">{role.name}</h4>
                    {role.isDirector ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/30">
                        Director
                      </span>
                    ) : role.isSystem ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> System Role
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">
                        Custom Role
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary mt-1">{role.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center gap-1">
                  {hasPermission('roles:manage') && (
                    <button
                      type="button"
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
                  <span>{role.activeUserCount} active employee(s)</span>
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
        onSaved={fetchRoles}
      />
    </div>
  );
}
