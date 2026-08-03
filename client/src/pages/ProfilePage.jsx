import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, getEmployeeAssets, updateMyProfile } from '../api/employeesApi';
import {
  User, Mail, Building2, MapPin, ShieldCheck, Laptop,
  Calendar, PackageX, Loader2, Pencil, Check, X
} from 'lucide-react';
import StatusPill from '../components/ui/StatusPill';
import Badge from '../components/ui/Badge';
import toast from 'react-hot-toast';

const roleColors = {
  admin:    'bg-accent/10 text-accent border-accent/20',
  hr:       'bg-info-blue/10 text-info-blue border-info-blue/20',
  employee: 'bg-success/10 text-success border-success/20',
};

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Inline name editing state
  const [editingName, setEditingName]   = useState(false);
  const [nameValue, setNameValue]       = useState('');
  const [savingName, setSavingName]     = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [profileRes, assetsRes] = await Promise.all([
        getMyProfile(),
        getEmployeeAssets(user.id),
      ]);
      const p = profileRes.data?.data || profileRes.data;
      setProfile(p);
      setNameValue(p?.name || '');
      setAssets(assetsRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) loadProfile();
  }, [loadProfile]);

  const handleStartEditName = () => {
    setNameValue(profile?.name || '');
    setEditingName(true);
  };

  const handleCancelEditName = () => {
    setNameValue(profile?.name || '');
    setEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    if (trimmed === profile?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await updateMyProfile({ name: trimmed });
      const updated = res.data?.data;
      setProfile(updated);
      setNameValue(updated?.name || trimmed);
      // Sync the name shown in TopBar — update AuthContext user if it stores name
      if (setUser) {
        setUser(prev => ({ ...prev, name: updated?.name || trimmed }));
      }
      setEditingName(false);
      toast.success('Name updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') handleCancelEditName();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
        {error}
      </div>
    );
  }

  const avatarChar = profile?.name?.[0] || profile?.email?.[0] || 'U';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">My Profile</h1>
        <p className="text-sm text-secondary mt-1">Your account information and assigned assets.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Avatar Banner */}
        <div className="h-20 bg-gradient-to-r from-accent/20 to-accent/5" />
        <div className="px-6 pb-6">
          {/* Avatar + Role Badge */}
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 border-4 border-surface flex items-center justify-center text-accent text-3xl font-bold uppercase shadow-md">
              {avatarChar}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${roleColors[profile?.role] || roleColors.employee}`}>
              {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Employee'}
            </span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* NAME — Editable */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-base/60 border border-border/40 group">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1">Name</div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      maxLength={150}
                      className="flex-1 min-w-0 text-sm text-primary bg-base border border-accent rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="p-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
                      title="Save name"
                    >
                      {savingName
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Check className="w-3.5 h-3.5" />
                      }
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditName}
                      disabled={savingName}
                      className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-raised/50 transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-primary">{profile?.name || '—'}</span>
                    <button
                      type="button"
                      onClick={handleStartEditName}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-secondary hover:text-accent hover:bg-accent/10 transition-all cursor-pointer"
                      title="Edit name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* All other fields — read-only InfoRows */}
            <InfoRow icon={Mail} label="Email" value={profile?.email || '—'} />
            <InfoRow icon={Building2} label="Department" value={profile?.department || '—'} />
            <InfoRow
              icon={MapPin}
              label="Location"
              value={profile?.address
                ? `${profile.location} (${profile.address})`
                : (profile?.location || '—')}
            />
            <InfoRow
              icon={ShieldCheck}
              label="Role"
              value={profile?.role
                ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                : '—'}
            />
            <InfoRow
              icon={Calendar}
              label="Member Since"
              value={profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : '—'}
            />
          </div>

          {/* Hint text */}
          <p className="text-xs text-secondary mt-4 flex items-center gap-1.5">
            <Pencil className="w-3 h-3" />
            Hover over your name to edit it. Other details can be changed by an Admin.
          </p>
        </div>
      </div>

      {/* Assigned Assets */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-base/50 flex items-center gap-2">
          <Laptop className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">My Assigned Assets</h2>
          <span className="ml-auto text-xs text-secondary">{assets.length} item{assets.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="p-4">
          {assets.length === 0 ? (
            <div className="py-10 text-center">
              <PackageX className="w-8 h-8 text-secondary mx-auto mb-2" />
              <p className="text-sm text-secondary">No assets currently assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map(asset => (
                <div key={asset.id} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      badgeChar={asset.categoryBadgeChar || asset.categoryName?.[0] || '?'}
                      color={asset.categoryColor}
                      title={asset.categoryName}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-primary truncate">{asset.name}</div>
                      <div className="flex items-center gap-2 text-xs text-secondary mt-0.5">
                        <span className="font-mono text-accent/90">{asset.serialNumber}</span>
                        {asset.model && <span className="truncate">· {asset.model}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusPill status={asset.status} />
                    {asset.assignedDate && (
                      <span className="text-[11px] font-mono text-secondary flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {asset.assignedDate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Read-only info row
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-base/60 border border-border/40">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div>
        <div className="text-[11px] font-semibold text-secondary uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-primary mt-0.5">{value}</div>
      </div>
    </div>
  );
}

