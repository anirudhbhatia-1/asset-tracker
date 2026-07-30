import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../api/employeesApi';
import { getEmployeeAssets } from '../api/employeesApi';
import { User, Mail, Building2, MapPin, ShieldCheck, Laptop, Calendar, PackageX, Loader2 } from 'lucide-react';
import StatusPill from '../components/ui/StatusPill';
import Badge from '../components/ui/Badge';

const roleColors = {
  admin:    'bg-accent/10 text-accent border-accent/20',
  hr:       'bg-info-blue/10 text-info-blue border-info-blue/20',
  employee: 'bg-success/10 text-success border-success/20',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, assetsRes] = await Promise.all([
          getMyProfile(),
          getEmployeeAssets(user.id),
        ]);
        setProfile(profileRes.data?.data || profileRes.data);
        setAssets(assetsRes.data?.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) load();
  }, [user]);

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
          {/* Avatar */}
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 border-4 border-surface flex items-center justify-center text-accent text-3xl font-bold uppercase shadow-md">
              {profile?.email?.[0] || user?.email?.[0] || 'U'}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${roleColors[profile?.role] || roleColors.employee}`}>
              {profile?.role || 'Employee'}
            </span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <InfoRow icon={User} label="Name" value={profile?.name || '—'} />
            <InfoRow icon={Mail} label="Email" value={profile?.email || '—'} />
            <InfoRow icon={Building2} label="Department" value={profile?.department || '—'} />
            <InfoRow icon={MapPin} label="Location" value={profile?.location || '—'} />
            <InfoRow icon={ShieldCheck} label="Role" value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '—'} />
            <InfoRow
              icon={Calendar}
              label="Member Since"
              value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            />
          </div>
        </div>
      </div>

      {/* Assigned Assets */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-base/50 flex items-center gap-2">
          <Laptop className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
            My Assigned Assets
          </h2>
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

// Small reusable info row
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
