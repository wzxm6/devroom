import React, { useState } from 'react';
import { Settings, Save, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profileService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!displayName.trim() || !username.trim()) {
      setErrorMessage('Display name and username cannot be empty.');
      return;
    }

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await profileService.updateProfile(user.id, {
        display_name: displayName.trim(),
        username: cleanUsername,
        avatar_url: avatarUrl.trim() || null,
      });

      await refreshProfile();
      setSuccessMessage('Profile updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Settings & Profile
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your developer profile and personal account settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Developer Profile
          </CardTitle>
          <CardDescription>
            This information is shown to your teammates in posts, tasks, and team chat.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdate}>
          <CardContent className="space-y-4">
            {successMessage && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Avatar Preview */}
            <div className="flex items-center gap-4 p-3 bg-muted/30 border border-border/50 rounded-lg">
              <Avatar
                size="lg"
                src={avatarUrl || profile?.avatar_url}
                name={displayName || profile?.display_name || 'User'}
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground">Avatar Preview</div>
                <div className="text-[11px] text-muted-foreground">
                  Provide an image URL below or fallback to your developer initials.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Display Name"
                placeholder="Amin Nassar"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <Input
                label="Username"
                placeholder="amin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <Input
              label="Avatar URL (Optional)"
              placeholder="https://images.unsplash.com/photo-..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />

            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email Address
              </label>
              <input
                disabled
                value={user?.email || ''}
                className="flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 py-1 text-sm text-muted-foreground cursor-not-allowed font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Managed by Supabase Auth.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" isLoading={loading} size="sm" className="text-xs">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Profile Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
