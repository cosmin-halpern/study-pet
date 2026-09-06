'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { SPECIES, type SpeciesId } from '@/lib/creatures';

// Matches public.pet_state in supabase/schema.sql. Without a linked project,
// there's no generated Database type for sb.rpc(...) to infer from, so this
// is asserted by hand. Once `supabase gen types typescript` is wired up,
// drop this and let the generated types flow through instead.
type PetState = {
  user_id: string;
  health: number;
  streak: number;
  best: number;
  total: number;
  active: SpeciesId;
  last_check: string | null;
  synced_through: string | null;
  tz: string;
  updated_at: string;
};

export async function loadGame() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: state } = (await sb.rpc('sync_state').single()) as { data: PetState | null };
  const { data: pets } = await sb.from('pets').select('*');
  const { data: today } = await sb.rpc('user_today', { p_user: user.id });
  const { data: subjectRows } = await sb.from('subjects').select('species_id, label');

  // Every species defaults to its built-in stage name until the user
  // renames it — subjects only ever *overrides* the label, it never
  // introduces a 6th slot or removes one of the 5.
  const labels = Object.fromEntries(SPECIES.map((s) => [s.id, s.stage])) as Record<
    SpeciesId,
    string
  >;
  for (const row of subjectRows ?? []) {
    labels[row.species_id as SpeciesId] = row.label;
  }

  return {
    state,
    pets: pets ?? [],
    today: today as string,
    checkedInToday: state?.last_check === today,
    labels,
  };
}

export async function saveSubjectLabel(species: SpeciesId, label: string) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'not authenticated' };

  const trimmed = label.trim();
  if (!trimmed) return { ok: false, reason: 'label cannot be empty' };

  const { error } = await sb
    .from('subjects')
    .upsert({ user_id: user.id, species_id: species, label: trimmed });

  if (error) return { ok: false, reason: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function checkIn(species: SpeciesId) {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('check_in', { p_species: species });
  if (error) return { ok: false, reason: error.message };
  revalidatePath('/');
  return data;
}

export async function saveActive(species: SpeciesId) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'not authenticated' };

  const { error } = await sb
    .from('pet_state')
    .update({ active: species })
    .eq('user_id', user.id);

  if (error) return { ok: false, reason: error.message };
  revalidatePath('/');
  return { ok: true };
}