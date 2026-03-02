import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from '@/context/HouseholdContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, ArrowRight } from 'lucide-react';

type Step = 'choice' | 'create' | 'join' | 'pick-user';

const USER_COLORS = ['#0D9488', '#F97066'];

const SetupPage: React.FC = () => {
  const { setHouseholdId, setCurrentMember } = useHousehold();
  const [step, setStep] = useState<Step>('choice');
  const [householdName, setHouseholdName] = useState('Our Home');
  const [pin, setPin] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [userNames, setUserNames] = useState(['', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdHouseholdId, setCreatedHouseholdId] = useState('');
  const [joinedMembers, setJoinedMembers] = useState<any[]>([]);

  const handleCreate = async () => {
    if (!pin || pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (!userNames[0] || !userNames[1]) { setError('Both names are required'); return; }
    setLoading(true);
    setError('');

    const { data: household, error: hErr } = await supabase
      .from('households')
      .insert({ name: householdName, pin })
      .select()
      .single();

    if (hErr || !household) { setError('Failed to create household'); setLoading(false); return; }

    const membersToInsert = userNames.map((name, i) => ({
      household_id: household.id,
      display_name: name,
      avatar_color: USER_COLORS[i],
    }));

    const { data: members, error: mErr } = await supabase
      .from('household_members')
      .insert(membersToInsert)
      .select();

    if (mErr || !members) { setError('Failed to create members'); setLoading(false); return; }

    setCreatedHouseholdId(household.id);
    setJoinedMembers(members);
    setLoading(false);
    setStep('pick-user');
  };

  const handleJoin = async () => {
    if (!joinPin) { setError('Enter your household PIN'); return; }
    setLoading(true);
    setError('');

    const { data: households } = await supabase
      .from('households')
      .select('*')
      .eq('pin', joinPin);

    if (!households || households.length === 0) { setError('No household found with that PIN'); setLoading(false); return; }

    const hId = households[0].id;
    const { data: members } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', hId);

    if (!members || members.length === 0) { setError('Household has no members'); setLoading(false); return; }

    setCreatedHouseholdId(hId);
    setJoinedMembers(members);
    setLoading(false);
    setStep('pick-user');
  };

  const pickUser = (member: any) => {
    setHouseholdId(createdHouseholdId);
    setCurrentMember(member);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary mb-4"
          >
            <Home className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-foreground">HomePace</h1>
          <p className="text-muted-foreground mt-1">Track chores, share the load</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' && (
            <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Button onClick={() => setStep('create')} className="w-full h-14 text-lg font-bold rounded-2xl" size="lg">
                <Home className="mr-2 w-5 h-5" /> Create Household
              </Button>
              <Button onClick={() => setStep('join')} variant="outline" className="w-full h-14 text-lg font-bold rounded-2xl" size="lg">
                <Users className="mr-2 w-5 h-5" /> Join Household
              </Button>
            </motion.div>
          )}

          {step === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-2xl p-6 shadow-sm border space-y-4">
                <h2 className="text-xl font-bold">Create Your Household</h2>
                <Input placeholder="Household name" value={householdName} onChange={e => setHouseholdName(e.target.value)} className="rounded-xl h-12" />
                <Input placeholder="Set a 4-digit PIN" type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} className="rounded-xl h-12" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Household Members</p>
                  {userNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: USER_COLORS[i] }} />
                      <Input
                        placeholder={`Person ${i + 1} name`}
                        value={name}
                        onChange={e => {
                          const copy = [...userNames];
                          copy[i] = e.target.value;
                          setUserNames(copy);
                        }}
                        className="rounded-xl h-12"
                      />
                    </div>
                  ))}
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setStep('choice'); setError(''); }} className="rounded-xl">Back</Button>
                  <Button onClick={handleCreate} disabled={loading} className="flex-1 rounded-xl h-12 font-bold">
                    {loading ? 'Creating...' : 'Create'} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'join' && (
            <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-2xl p-6 shadow-sm border space-y-4">
                <h2 className="text-xl font-bold">Join Household</h2>
                <Input placeholder="Enter household PIN" type="password" maxLength={6} value={joinPin} onChange={e => setJoinPin(e.target.value.replace(/\D/g, ''))} className="rounded-xl h-12" />
                {error && <p className="text-destructive text-sm">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setStep('choice'); setError(''); }} className="rounded-xl">Back</Button>
                  <Button onClick={handleJoin} disabled={loading} className="flex-1 rounded-xl h-12 font-bold">
                    {loading ? 'Joining...' : 'Join'} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'pick-user' && (
            <motion.div key="pick" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-2xl p-6 shadow-sm border space-y-4">
                <h2 className="text-xl font-bold text-center">Who are you?</h2>
                <div className="grid grid-cols-2 gap-4">
                  {joinedMembers.map((member) => (
                    <motion.button
                      key={member.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => pickUser(member)}
                      className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary transition-colors bg-card"
                    >
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground" style={{ backgroundColor: member.avatar_color }}>
                        {member.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-foreground">{member.display_name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SetupPage;
