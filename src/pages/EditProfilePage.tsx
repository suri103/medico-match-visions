import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { usePersistedState } from '@/hooks/usePersistedState';
import { hasServerSession, saveMyServerProfile, getMyServerProfile, uploadMyPhoto, listMyPhotos, setPrimaryPhoto as serverSetPrimaryPhoto, deletePhoto as serverDeletePhoto } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, Trash2, PlusCircle, Check,
  ShieldCheck
} from 'lucide-react';
import { EMPTY_PROFILE, hasCreatedProfile } from '@/lib/profile';
import { localAvatar } from '@/lib/avatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { religionList, casteList, subcasteSuggestions, gotraList, motherTongueList, rashiList, nakshatraList, manglikList, degreesList, specialtiesList, medicalCouncilsList, careerStagesList } from '@/features/matches/data/constants';

const EditProfilePage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  useCurrentUser();
  const [interests, setInterests] = usePersistedState<string[]>(
    'mm:profileInterests',
    ['Yoga', 'Reading', 'Traveling', 'Music', 'Cooking']
  );
  const [newInterest, setNewInterest] = useState('');
  // Gallery rows: local ids are numeric (dev placeholders); server rows carry
  // string uuids once a wired session has synced. Both shapes coexist until
  // the server sync replaces the cache below.
  const [profilePhotos, setProfilePhotos] = usePersistedState<Array<{ id: number | string; url: string; isPrimary: boolean }>>(
    'mm:profilePhotos',
    // Audit L11: self-hosted placeholder avatars (data URIs) — no third-party
    // CDN hit for the user's own default gallery.
    [
      { id: 1, url: localAvatar('You'), isPrimary: true },
      { id: 2, url: localAvatar('Dr Portfolio 1'), isPrimary: false },
      { id: 3, url: localAvatar('Dr Portfolio 2'), isPrimary: false },
      { id: 4, url: localAvatar('Dr Portfolio 3'), isPrimary: false },
    ]
  );
  const photoFileRef = React.useRef<HTMLInputElement>(null);
  const certFileRef = React.useRef<HTMLInputElement>(null);

  // Server-backed gallery: when a wired session exists the SERVER gallery is
  // the source of truth (photos must survive devices — matrimony parity).
  // The placeholder/local rows are replaced, not merged, to avoid duplicates.
  useEffect(() => {
    if (!hasServerSession()) return;
    let cancelled = false;
    void (async () => {
      try {
        const serverPhotos = await listMyPhotos();
        if (!cancelled && serverPhotos.length > 0) {
          setProfilePhotos(serverPhotos.map((p) => ({
            id: p.id,
            url: p.url,
            isPrimary: p.isPrimary,
          })));
        }
        const sp = await getMyServerProfile();
        if (!cancelled && sp) {
          setProfile((prev) => ({
            ...prev,
            name: prev.name || sp.name.replace(/^Dr\.\s*/i, ''),
            gender: (prev as unknown as Record<string, string>).gender || sp.gender || '',
            specialty: prev.specialty || sp.specialty || '',
            degree: prev.degree || sp.degree || '',
            hospital: prev.hospital || sp.hospital || '',
            location: prev.location || (sp.city ? `${sp.city}${sp.state ? `, ${sp.state}` : ''}` : ''),
            about: prev.about || sp.aboutMe || '',
            lookingFor: prev.lookingFor || sp.lookingFor || '',
            heightCm: prev.heightCm || (sp.heightCm ? String(sp.heightCm) : ''),
            maritalStatus: prev.maritalStatus || sp.maritalStatus || '',
            motherTongue: prev.motherTongue || sp.motherTongue || '',
            religion: prev.religion || sp.religion || '',
            caste: prev.caste || sp.caste || '',
            subcaste: (prev as unknown as Record<string, string>).subcaste || sp.subcaste || '',
            gotra: (prev as unknown as Record<string, string>).gotra || sp.gotra || '',
            rashi: (prev as unknown as Record<string, string>).rashi || sp.rashi || '',
            nakshatra: (prev as unknown as Record<string, string>).nakshatra || sp.nakshatra || '',
            manglik: (prev as unknown as Record<string, string>).manglik || sp.manglik || '',
            birthDate: (prev as unknown as Record<string, string>).birthDate || sp.birthDate || '',
            dob: prev.dob || sp.birthDate || '',
            birthTime: (prev as unknown as Record<string, string>).birthTime || sp.birthTime || '',
            birthCity: (prev as unknown as Record<string, string>).birthCity || sp.birthCity || '',
            familyType: (prev as unknown as Record<string, string>).familyType || sp.familyType || '',
            familyStatus: (prev as unknown as Record<string, string>).familyStatus || sp.familyStatus || '',
            incomeBand: (prev as unknown as Record<string, string>).incomeBand || sp.incomeBand || '',
            diet: (prev as unknown as Record<string, string>).diet || sp.diet || '',
          }));
        }
      } catch { /* offline — local cache remains */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCertificateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Certificates are stored as data URLs in localStorage (~5MB budget).
    // Reject oversized files up front instead of silently dropping them
    // (audit H5 — the previous handler served a false "under review" toast).
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Certificates are limited to 2 MB in this build. Please upload a smaller file.",
        variant: "destructive",
      });
      if (certFileRef.current) certFileRef.current.value = '';
      return;
    }
    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      setProfile(prev => ({
        ...prev,
        verificationDocumentName: fileName,
        verificationDocumentUrl: String(reader.result),
        verificationStatus: 'pending',
      }));
      // Verify the write actually landed — localStorage can silently refuse
      // writes when full; a lost certificate must never toast "under review".
      window.setTimeout(() => {
        try {
          const raw = localStorage.getItem('mm:profileData');
          const saved = raw ? JSON.parse(raw) : null;
          if (saved?.verificationDocumentName !== fileName || !saved?.verificationDocumentUrl) {
            throw new Error('not persisted');
          }
          toast({
            title: "Certificate Submitted",
            description: `${fileName} uploaded. Your profile is now under review for Medical Council verification.`,
          });
        } catch {
          toast({
            title: "Storage full",
            description: "The certificate could not be stored on this device. Free up browser storage or try a smaller file.",
            variant: "destructive",
          });
        }
      }, 50);
    };
    reader.readAsDataURL(file);
    if (certFileRef.current) certFileRef.current.value = '';
  };

  // Persisted profile data
  const [profile, setProfile] = usePersistedState('mm:profileData', EMPTY_PROFILE);

  const [, setProfileCreated] = usePersistedState(
    'mm:profileCreated',
    () => hasCreatedProfile()
  );

  const updateProfile = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please choose an image under 1.5 MB.", variant: "destructive" });
      if (photoFileRef.current) photoFileRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const numericIds = profilePhotos.map(p => (typeof p.id === 'number' ? p.id : 0));
      const nextId = Math.max(0, ...numericIds) + 1;
      setProfilePhotos(prev => [
        ...prev,
        { id: nextId, url: dataUrl, isPrimary: prev.length === 0 },
      ]);
      // Durable upload on the wired backend (Supabase Storage when configured,
      // bounded data URL in Postgres otherwise). Local gallery stays as cache.
      if (hasServerSession()) {
        void uploadMyPhoto(dataUrl).then((r) => {
          if (!r.ok && r.error) {
            toast({ title: "Not synced", description: r.error, variant: "destructive" });
          }
        }).catch(() => {});
      }
      toast({
        title: "Photo uploaded",
        description: "Your photo has been added to your profile.",
      });
    };
    reader.readAsDataURL(file);
    if (photoFileRef.current) photoFileRef.current.value = '';
  };

  const handleCreateProfile = async () => {
    if (!profile.name.trim() || !profile.specialty.trim()) {
      toast({
        title: "Missing information",
        description: "Please add your full name and medical specialty to continue.",
        variant: "destructive",
      });
      return;
    }
    setProfileCreated(true);
    // Durable mirror on the wired backend (whitelisted fields only). Audit H5:
    // a failed server save is surfaced truthfully — never hidden behind a
    // success toast. The user keeps their local copy either way.
    let syncFailed = false;
    if (hasServerSession()) {
      try {
        const stage = (profile as { careerStage?: string }).careerStage || '';
        const degreeDeclared = (profile.degree || '').trim();
        const dobVal = profile.birthDate || profile.dob || null;
        let calculatedAge: number | null = null;
        if (dobVal) {
          const birth = new Date(dobVal);
          if (!Number.isNaN(birth.getTime())) {
            const diffMs = Date.now() - birth.getTime();
            const ageDt = new Date(diffMs);
            calculatedAge = Math.abs(ageDt.getUTCFullYear() - 1970);
          }
        }
        const isCompleted = Boolean(degreeDeclared) && !degreeDeclared.toLowerCase().includes('pursuing') && !degreeDeclared.toLowerCase().includes('student');
        const saved = await saveMyServerProfile({
          // "Dr." prefix only for COMPLETED qualifications (see mayUseDrTitle
          // server-side) — a student or undeclared profile is never titled.
          full_name: `${isCompleted ? 'Dr. ' : ''}${profile.name}`.replace(/^Dr\.\s*Dr\./i, 'Dr.').trim(),
          career_stage: stage || null,
          gender: (profile as { gender?: string }).gender || null,
          age: calculatedAge,
          degree: profile.degree || null,
          specialty: profile.specialty || null,
          hospital: profile.hospital || null,
          city: (profile.location || '').split(',')[0]?.trim() || null,
          state: (profile.location || '').split(',')[1]?.trim() || null,
          about_me: profile.about || null,
          looking_for: profile.lookingFor || null,
          interests: interests ?? [],
          height_cm: profile.heightCm ? Number(profile.heightCm) : null,
          marital_status: profile.maritalStatus || null,
          mother_tongue: profile.motherTongue || null,
          religion: profile.religion || null,
          caste: profile.caste || null,
          subcaste: profile.subcaste || null,
          gotra: profile.gotra || null,
          rashi: profile.rashi || null,
          nakshatra: profile.nakshatra || null,
          manglik: profile.manglik || null,
          // Kundali fidelity: structured birth details (server normalizes an
          // empty birth_date to NULL; other fields are free-text).
          birth_date: dobVal,
          birth_time: (profile as { birthTime?: string }).birthTime || null,
          birth_city: (profile as { birthCity?: string }).birthCity || null,
          phone: profile.phone || null,
          email: profile.email || null,
          // P0-4 family/background depth (Shaadi parity) — whitelisted server-side.
          family_type: (profile as unknown as Record<string, string>).familyType || null,
          family_status: (profile as unknown as Record<string, string>).familyStatus || null,
          income_band: (profile as unknown as Record<string, string>).incomeBand || null,
          diet: (profile as unknown as Record<string, string>).diet || null,
          smoking: (profile as unknown as Record<string, string>).smoking || null,
          drinking: (profile as unknown as Record<string, string>).drinking || null,
          expectations: (profile as unknown as Record<string, string>).expectations || null,
          // P-CONTROL: member-set visibility (enum-validated server-side).
          profile_visibility: (profile as unknown as Record<string, string>).profileVisibility || null,
          income_visibility: (profile as unknown as Record<string, string>).incomeVisibility || null,
        });
        if (!saved) throw new Error('offline-or-rejected');
      } catch {
        syncFailed = true;
      }
    }
    if (syncFailed) {
      toast({
        title: "Saved on this device only",
        description: "Your profile is saved locally, but it could not be synced to the server. You can retry from Settings.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile saved! 🎉",
        description: "Your doctor profile and biodata have been updated successfully."
      });
    }
    navigate('/profile');
  };
  
  const handleAddInterest = () => {
    const trimmed = newInterest.trim();
    if (!trimmed) return;

    if (interests.length >= 5) {
      toast({
        title: "Interest limit reached",
        description: "You can add up to 5 interests.",
        variant: "destructive",
      });
      return;
    }

    if (!interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setNewInterest('');
    }
  };
  
  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const handleSetPrimaryPhoto = (id: number | string) => {
    setProfilePhotos(profilePhotos.map(photo => ({
      ...photo,
      isPrimary: photo.id === id
    })));

    // Durable primary on the wired backend — a failed server update must be
    // visible, not silently masked by the local success state.
    if (hasServerSession() && typeof id === 'string') {
      void serverSetPrimaryPhoto(id).then((r) => {
        if (!r.ok) {
          toast({ title: "Not synced", description: r.error || "Primary photo not updated on the server.", variant: "destructive" });
        }
      }).catch(() => {});
    }
    toast({
      title: "Profile photo updated",
      description: "Your primary profile photo has been changed."
    });
  };

  const handleRemovePhoto = (id: number | string) => {
    if (profilePhotos.find(p => p.id === id)?.isPrimary) {
      toast({
        title: "Cannot remove primary photo",
        description: "Please set another photo as primary first.",
        variant: "destructive"
      });
      return;
    }

    setProfilePhotos(profilePhotos.filter(photo => photo.id !== id));

    // Delete on the wired backend too (primary reassignment is server-side).
    if (hasServerSession() && typeof id === 'string') {
      void serverDeletePhoto(id).then((r) => {
        if (!r.ok) {
          toast({ title: "Not synced", description: r.error || "Photo not deleted on the server.", variant: "destructive" });
        }
      }).catch(() => {});
    }
    toast({
      title: "Photo removed",
      description: "The photo has been removed from your profile."
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-3 sm:p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Edit Your Profile</h1>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Update your doctor biodata and preferences for prospective matrimonial matches.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {/* Column 1: Medical & Personal Details */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Professional & Personal Info</h2>
                <div>
                  <Label htmlFor="create-name">Full Name *</Label>
                  <Input
                    id="create-name"
                    placeholder="Dr. Jane Smith"
                    value={profile.name}
                    onChange={(e) => updateProfile('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="create-career-stage">Career Stage</Label>
                  <Select value={profile.careerStage || 'Medical Student'} onValueChange={(v) => updateProfile('careerStage', v)}>
                    <SelectTrigger id="create-career-stage">
                      <SelectValue placeholder="Select career stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {careerStagesList.map((stage) => (
                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500 mt-0.5">Your stage is shown honestly — a student is fully eligible to marry; only completed qualifications use the "Dr." title.</p>
                </div>

                <div>
                  <Label htmlFor="create-degree">Medical Degree / Qualification *</Label>
                  <Select value={profile.degree || ''} onValueChange={(v) => updateProfile('degree', v)}>
                    <SelectTrigger id="create-degree">
                      <SelectValue placeholder="Select degree" />
                    </SelectTrigger>
                    <SelectContent>
                      {degreesList.map((deg) => (
                        <SelectItem key={deg} value={deg}>{deg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-specialty">Medical Specialty *</Label>
                  <Select value={profile.specialty} onValueChange={(v) => updateProfile('specialty', v)}>
                    <SelectTrigger id="create-specialty">
                      <SelectValue placeholder="Select specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialtiesList.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-hospital">Hospital / Clinic Practice</Label>
                  <Input
                    id="create-hospital"
                    placeholder="e.g. Apollo Hospital"
                    value={profile.hospital}
                    onChange={(e) => updateProfile('hospital', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="create-location">Practice Location (City, State)</Label>
                  <Input
                    id="create-location"
                    placeholder="e.g. Mumbai, Maharashtra"
                    value={profile.location}
                    onChange={(e) => updateProfile('location', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="create-experience">Experience (Years)</Label>
                  <Input
                    id="create-experience"
                    type="number"
                    placeholder="e.g. 8"
                    value={profile.experience}
                    onChange={(e) => updateProfile('experience', e.target.value)}
                  />
                </div>

                {/* State Medical Council Credentials */}
                <div className="pt-2 pb-1 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="text-emerald-600 h-4 w-4" />
                    Medical Council Registration & Verification
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="create-council">Medical Registration Council *</Label>
                      <Select value={profile.councilName || medicalCouncilsList[0]} onValueChange={(v) => updateProfile('councilName', v)}>
                        <SelectTrigger id="create-council"><SelectValue placeholder="Select council" /></SelectTrigger>
                        <SelectContent>
                          {medicalCouncilsList.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="create-reg-no">Registration No. *</Label>
                        <Input
                          id="create-reg-no"
                          placeholder="e.g. MMC-2018-87492"
                          value={profile.registrationNumber}
                          onChange={(e) => updateProfile('registrationNumber', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-reg-year">Registration Year</Label>
                        <Input
                          id="create-reg-year"
                          type="number"
                          placeholder="e.g. 2018"
                          value={profile.registrationYear}
                          onChange={(e) => updateProfile('registrationYear', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Upload Council Certificate / Degree</Label>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <input
                          ref={certFileRef}
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={handleCertificateFile}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => certFileRef.current?.click()}
                        >
                          <Upload size={14} className="mr-1" /> Choose File
                        </Button>
                        {profile.verificationDocumentName ? (
                          <span className="text-xs text-slate-600 font-medium truncate max-w-[200px]">
                            📄 {profile.verificationDocumentName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">PDF or Image</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="create-dob">Date of Birth</Label>
                    <Input id="create-dob" type="date" value={profile.dob} onChange={(e) => updateProfile('dob', e.target.value)} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={profile.gender || 'Other'} onValueChange={(v) => updateProfile('gender', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="create-height">Height (cm)</Label>
                    <Input id="create-height" type="number" placeholder="e.g. 172" value={profile.heightCm} onChange={(e) => updateProfile('heightCm', e.target.value)} />
                  </div>
                  <div>
                    <Label>Marital Status</Label>
                    <Select value={profile.maritalStatus || 'Never Married'} onValueChange={(v) => updateProfile('maritalStatus', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Never Married">Never Married</SelectItem>
                        <SelectItem value="Divorced">Divorced</SelectItem>
                        <SelectItem value="Widowed">Widowed</SelectItem>
                        <SelectItem value="Awaiting Divorce">Awaiting Divorce</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="create-mother">Mother Tongue</Label>
                  <Select value={profile.motherTongue || 'Hindi'} onValueChange={(v) => updateProfile('motherTongue', v)}>
                    <SelectTrigger id="create-mother"><SelectValue placeholder="Select mother tongue" /></SelectTrigger>
                    <SelectContent>
                      {motherTongueList.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Religion</Label>
                    <Select value={profile.religion || 'No preference'} onValueChange={(v) => updateProfile('religion', v === 'No preference' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger>
                      <SelectContent>
                        {religionList.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Caste</Label>
                    <Select value={profile.caste || 'No preference'} onValueChange={(v) => updateProfile('caste', v === 'No preference' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select caste" /></SelectTrigger>
                      <SelectContent>
                        {casteList.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Subcaste</Label>
                  <div className="space-y-1.5">
                    <Select value={profile.subcaste || 'No preference'} onValueChange={(v) => updateProfile('subcaste', v === 'No preference' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select popular subcaste" /></SelectTrigger>
                      <SelectContent>
                        {subcasteSuggestions.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input 
                      placeholder="Or enter subcaste..." 
                      value={profile.subcaste} 
                      onChange={(e) => updateProfile('subcaste', e.target.value)} 
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <div>
                  <Label>Gotra / Lineage</Label>
                  <Select value={profile.gotra || 'No preference'} onValueChange={(v) => updateProfile('gotra', v === 'No preference' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select gotra" /></SelectTrigger>
                    <SelectContent>
                      {gotraList.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Rashi</Label>
                    <Select value={profile.rashi || 'No preference'} onValueChange={(v) => updateProfile('rashi', v === 'No preference' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select rashi" /></SelectTrigger>
                      <SelectContent>
                        {rashiList.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nakshatra</Label>
                    <Select value={profile.nakshatra || 'No preference'} onValueChange={(v) => updateProfile('nakshatra', v === 'No preference' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select nakshatra" /></SelectTrigger>
                      <SelectContent>
                        {nakshatraList.map(n => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Manglik</Label>
                    <Select value={profile.manglik || 'Non-Manglik'} onValueChange={(v) => updateProfile('manglik', v)}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {manglikList.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Birth details: power real kundali matching (rashi/nakshatra
                    self-declaration alone is low-fidelity) + astro consults.
                    ALIGNMENT/WIDTH: this block lives in the LEFT column of an
                    lg:grid-cols-2 parent, so a 3-up row squeezed each field to
                    ~150px — too narrow for the native date text plus its picker
                    icon (which WebKit then clips) and the cause of the wrapped
                    "Date of Birth (for kundali)" label. Two columns gives each
                    field room, so labels no longer wrap at any breakpoint and
                    the date/time icons have space. items-end stays as the
                    structural guard: inputs always sit on one row regardless of
                    label height. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <Label htmlFor="create-birth-date">Date of Birth (for kundali)</Label>
                    <Input
                      id="create-birth-date"
                      type="date"
                      value={(profile as { birthDate?: string }).birthDate || ''}
                      onChange={(e) => updateProfile('birthDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-birth-time">Time of Birth</Label>
                    <Input
                      id="create-birth-time"
                      type="time"
                      value={(profile as { birthTime?: string }).birthTime || ''}
                      onChange={(e) => updateProfile('birthTime', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-birth-city">City of Birth</Label>
                    <Input
                      id="create-birth-city"
                      placeholder="e.g. Mumbai"
                      value={(profile as { birthCity?: string }).birthCity || ''}
                      onChange={(e) => updateProfile('birthCity', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Photos, Bio, Interests & Contact */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Profile Photos</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {profilePhotos.map((photo) => (
                      <div key={photo.id} className="relative group aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                        <img src={photo.url} alt="Profile" className="w-full h-full object-cover" />
                        {photo.isPrimary && (
                          <Badge className="absolute top-1.5 left-1.5 bg-mediblue-600 text-[10px] px-1.5 py-0">Primary</Badge>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                          {!photo.isPrimary && (
                            <Button size="sm" variant="secondary" className="h-7 text-[10px] px-2 bg-white/90" onClick={() => handleSetPrimaryPhoto(photo.id)}>
                              Primary
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => handleRemovePhoto(photo.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => photoFileRef.current?.click()}>
                      <Upload size={14} className="mr-1.5" /> Upload New Photo
                    </Button>
                  </div>
                </div>

                {/* Interests Section */}
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Interests & Hobbies</h2>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {interests.map((interest) => (
                      <Badge key={interest} variant="secondary" className="bg-slate-100 text-slate-700 px-2.5 py-1 text-xs flex items-center gap-1">
                        {interest}
                        <button type="button" onClick={() => handleRemoveInterest(interest)} className="hover:text-red-500">
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add interest (e.g. Hiking)..."
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddInterest(); } }}
                      className="text-xs h-9"
                    />
                    <Button type="button" size="sm" variant="outline" className="h-9 px-3 shrink-0" onClick={handleAddInterest}>
                      <PlusCircle size={14} className="mr-1" /> Add
                    </Button>
                  </div>
                </div>

                {/* About & Looking For */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="create-about">About Me & Medical Life</Label>
                    <Textarea
                      id="create-about"
                      rows={4}
                      placeholder="Share a little about yourself, clinical background, and interests..."
                      value={profile.about}
                      onChange={(e) => updateProfile('about', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-looking-for">What I'm Looking For in a Partner</Label>
                    <Textarea
                      id="create-looking-for"
                      rows={3}
                      placeholder="Desired values, medical specialty preferences, lifestyle..."
                      value={profile.lookingFor}
                      onChange={(e) => updateProfile('lookingFor', e.target.value)}
                    />
                  </div>

                  {/* Partner Preferences Grid */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Partner Age & Location Preferences</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="create-pref-min" className="text-[11px] text-slate-500">Min Age</Label>
                        <Input id="create-pref-min" type="number" placeholder="24" value={profile.prefAgeMin} onChange={(e) => updateProfile('prefAgeMin', e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="create-pref-max" className="text-[11px] text-slate-500">Max Age</Label>
                        <Input id="create-pref-max" type="number" placeholder="36" value={profile.prefAgeMax} onChange={(e) => updateProfile('prefAgeMax', e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="create-pref-loc" className="text-[11px] text-slate-500">Location</Label>
                        <Input id="create-pref-loc" placeholder="e.g. Mumbai / Anywhere" value={profile.prefLocation} onChange={(e) => updateProfile('prefLocation', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Matrimonial Contact Information</h3>                    <div>
                      <Label htmlFor="create-email">Email Address</Label>
                      <Input
                        id="create-email"
                        type="email"
                        placeholder="you@example.com"
                        value={profile.email}
                        onChange={(e) => updateProfile('email', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-phone">Phone Number (with country code)</Label>
                      <Input
                        id="create-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={profile.phone}
                        onChange={(e) => updateProfile('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* P0-4 Family & lifestyle (Shaadi parity). Optional but filterable. */}
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Family & Lifestyle</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Family Type</Label>
                        <Select value={(profile as unknown as Record<string, string>).familyType || ''} onValueChange={(v) => updateProfile('familyType' as never, v as never)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['Joint', 'Nuclear', 'Extended'].map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Family Status</Label>
                        <Select value={(profile as unknown as Record<string, string>).familyStatus || ''} onValueChange={(v) => updateProfile('familyStatus' as never, v as never)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['Middle Class', 'Upper Middle Class', 'Affluent'].map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Annual Income</Label>
                        <Select value={(profile as unknown as Record<string, string>).incomeBand || ''} onValueChange={(v) => updateProfile('incomeBand' as never, v as never)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['Under ₹10L', '₹10–25L', '₹25–50L', '₹50L–1Cr', '₹1Cr+'].map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Diet</Label>
                        <Select value={(profile as unknown as Record<string, string>).diet || ''} onValueChange={(v) => updateProfile('diet' as never, v as never)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'].map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="create-expectations">Partner Expectations</Label>
                      <Textarea id="create-expectations" rows={2} placeholder="What matters most to you in a partner…" value={(profile as unknown as Record<string, string>).expectations || ''} onChange={(e) => updateProfile('expectations' as never, e.target.value as never)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* P-CONTROL: privacy & visibility (launch-gap fix #1). The server
                enforces these on every read; this is the member-facing control
                the Help page promises. */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Privacy & Visibility</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Who can find you — and whether your income band is shown. Your phone, email, and documents are never shown here; they unlock only via a contact view.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Who can see my profile</Label>
                  <Select value={(profile as unknown as Record<string, string>).profileVisibility || 'public'} onValueChange={(v) => updateProfile('profileVisibility' as never, v as never)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Everyone (all members)</SelectItem>
                      <SelectItem value="verified_only">Verified members only</SelectItem>
                      <SelectItem value="hidden">Hidden — no one can find me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Who can see my income</Label>
                  <Select value={(profile as unknown as Record<string, string>).incomeVisibility || 'private'} onValueChange={(v) => updateProfile('incomeVisibility' as never, v as never)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Only me</SelectItem>
                      <SelectItem value="verified_only">Verified members only</SelectItem>
                      <SelectItem value="public">Everyone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
              <Button
                variant="outline"
                onClick={() => navigate('/profile')}
              >
                Cancel
              </Button>
              <Button
                className="bg-mediblue-600 hover:bg-mediblue-700 text-white"
                onClick={handleCreateProfile}
              >
                <Check size={16} className="mr-2" />
                Save & Update Profile
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditProfilePage;
