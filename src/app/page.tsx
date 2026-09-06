import { redirect } from 'next/navigation';
import { loadGame } from './actions';
import { Tank } from '@/components/Tank';
import { CheckIn } from '@/components/CheckIn';
import { Stats } from '@/components/Stats';
import { Roster } from '@/components/Roster';
import { EnablePush } from '@/components/EnablePush';

export default async function Home() {
  const game = await loadGame();
  if (!game) redirect('/login');
  if (!game.hasCustomSubjects) redirect('/onboarding');

  const { state, pets, today, labels } = game;
  const activeId = state?.active ?? 'js';
  const activePet = pets.find((p) => p.species === activeId);
  const health = state?.health ?? 100;

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center gap-6 px-5 py-9">
      <h1 className="font-display text-2xl">Study Pets</h1>

      <Tank
        activeId={activeId}
        days={activePet?.days ?? 0}
        health={health}
        today={today}
        lastCheck={state?.last_check ?? null}
        labels={labels}
      >
        <CheckIn
          disabled={game.checkedInToday}
          caughtIds={pets.map((p) => p.species)}
          labels={labels}
        />
      </Tank>

      <Stats
        streak={state?.streak ?? 0}
        best={state?.best ?? 0}
        total={state?.total ?? 0}
        caught={pets.length}
      />

      <Roster activeId={activeId} pets={pets} health={health} labels={labels} />

      <EnablePush />
    </main>
  );
}